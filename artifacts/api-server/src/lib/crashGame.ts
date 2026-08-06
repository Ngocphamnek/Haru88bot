import { Response } from "express";
import { WebSocket } from "ws";
import { storage } from "./storage";
import { logger } from "./logger";
import { webGameLock, webGameResolve, getPendingBets, sendBotNotify, registerBalanceListener, broadcastBalance } from "./webGameLock";
import { applyBalanceDelta } from "./ledger.js";
import { validateBetAmount, checkBetRate } from "./limits.js";

// ─── Register crash SSE balance broadcast listener (runs once at module load) ──
// When any game calls broadcastBalance(tgId, balance), this pushes
// balance_update to that user's crash SSE connection if they have one open.
registerBalanceListener((tgId: string, balance: number) => {
  const c = clients.get(tgId);
  if (c) {
    try {
      c.res.write(`data: ${JSON.stringify({ type: "balance_update", balance })}\n\n`);
    } catch {}
  }
});

const WAITING_SECONDS = 8;
const RESULT_DISPLAY_SECONDS = 4;
const TICK_MS = 150;
const HISTORY_SIZE = 20;

interface CrashClient {
  res: Response;
  tgId: string;
  bet: number;
  cashedOut: boolean;
  cashoutMultiplier: number;
}

interface RoundResult {
  roundId: number;
  crashAt: number;
}

type Phase = "idle" | "waiting" | "flying" | "crashed";

let roundId = 0;
let phase: Phase = "idle";
let timeLeft = 0;
let multiplier = 1.0;
let crashPoint = 2.0;
let tickTimer: ReturnType<typeof setInterval> | null = null;
const history: RoundResult[] = [];
const clients = new Map<string, CrashClient>();
const wsClients = new Map<string, WebSocket>();

// Tracks active bets for the current round, keyed by tgId.
// Persists even if the player's SSE connection drops, so we can
// still settle their bet when the round ends and release webGameLock.
const roundBets = new Map<string, number>(); // tgId → bet amount

export function getGameState() {
  const betCount = [...clients.values()].filter(c => c.bet > 0).length;
  return { phase, multiplier, timeLeft: Math.ceil(timeLeft), roundId, history: history.slice(0, HISTORY_SIZE), betCount };
}

export function getCrashClients() {
  return clients;
}

/**
 * Crash point distribution:
 * - 8% chance of instant crash at 1.0x
 * - For the rest: P(survive to x) ≈ 0.65/x
 *   → P(>= 2x)  ≈ 30%
 *   → P(>= 5x)  ≈ 12%
 *   → P(>= 13x) ≈  5%
 *   → P(>= 50x) ≈  1.3%
 */
function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.08) return 1.0;
  const raw = 0.65 / (1 - r);
  return Math.min(Math.floor(raw * 100) / 100, 500);
}

function broadcast(data: object) {
  const payload = JSON.stringify(data);
  const sseMsg = `data: ${payload}\n\n`;
  for (const [, c] of clients) {
    try { c.res.write(sseMsg); } catch {}
  }
  for (const [, ws] of wsClients) {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    } catch {}
  }
}

function sendTo(tgId: string, data: object) {
  const payload = JSON.stringify(data);
  const c = clients.get(tgId);
  if (c) {
    try { c.res.write(`data: ${payload}\n\n`); } catch {}
  }
  const ws = wsClients.get(tgId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(payload); } catch {}
  }
}

function historyPayload() {
  return history.slice(0, HISTORY_SIZE);
}

function betCount() {
  return [...clients.values()].filter(c => c.bet > 0).length;
}

/** Idle: waiting for first player. No countdown. */
function startIdle() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  phase = "idle";
  multiplier = 1.0;
  timeLeft = 0;
  roundId++;

  // Clear stale round bet tracking
  roundBets.clear();

  for (const [, c] of clients) {
    c.bet = 0;
    c.cashedOut = false;
    c.cashoutMultiplier = 0;
  }

  broadcast({ type: "phase", phase: "idle", roundId, history: historyPayload() });
}

/** Waiting: countdown started, accepting bets. */
function startWaiting() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  phase = "waiting";
  timeLeft = WAITING_SECONDS;
  crashPoint = generateCrashPoint();

  broadcast({ type: "phase", phase: "waiting", timeLeft: WAITING_SECONDS, roundId, betCount: betCount() });

  tickTimer = setInterval(() => {
    timeLeft -= TICK_MS / 1000;
    if (timeLeft <= 0) {
      clearInterval(tickTimer!);
      tickTimer = null;
      startFlying();
    } else {
      broadcast({ type: "tick_wait", timeLeft: Math.max(0, Math.ceil(timeLeft)), roundId, betCount: betCount() });
    }
  }, TICK_MS);
}

function startFlying() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  phase = "flying";
  multiplier = 1.0;
  let elapsed = 0;

  broadcast({ type: "phase", phase: "flying", multiplier: 1.0, roundId });

  tickTimer = setInterval(() => {
    elapsed += TICK_MS;
    multiplier = Math.floor(Math.pow(Math.E, 0.00006 * elapsed) * 100) / 100;
    if (multiplier < 1.0) multiplier = 1.0;

    if (multiplier >= crashPoint) {
      clearInterval(tickTimer!);
      tickTimer = null;
      multiplier = crashPoint;
      startCrashed();
    } else {
      broadcast({ type: "tick_fly", multiplier, roundId });
    }
  }, TICK_MS);
}

async function startCrashed() {
  phase = "crashed";
  history.unshift({ roundId, crashAt: crashPoint });
  if (history.length > HISTORY_SIZE) history.pop();

  broadcast({ type: "phase", phase: "crashed", crashAt: crashPoint, roundId, history: historyPayload() });

  // Settle ALL active bets — including players who disconnected (not in clients map)
  // roundBets tracks everyone who placed a bet, even if their SSE closed
  const settledIds = new Set<string>();

  for (const [tgId, betAmount] of roundBets) {
    const c = clients.get(tgId);
    if (c?.cashedOut) {
      // Already cashed out during flying phase — nothing to do
      settledIds.add(tgId);
      continue;
    }

    // Bet is a loss: balance was already deducted at bet time, just notify & release lock
    try {
      const user = await storage.getBotUser(tgId);
      if (user) {
        const bal = parseFloat(user.balance || "0");
        if (c) sendTo(tgId, { type: "result", won: false, payout: 0, balance: bal });
        await webGameResolve(tgId,
          `✈️ <b>Máy Bay — Nổ!</b>\n` +
          `💥 Máy bay nổ tại <b>x${crashPoint.toFixed(2)}</b>\n` +
          `📉 Thua: <b>${betAmount.toLocaleString("vi-VN")}đ</b>\n` +
          `💳 Số dư: ${bal.toLocaleString("vi-VN")}đ`
        );

        // Track betting stats for this loss
        try {
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
          const weekYearStr = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
          await storage.createOrUpdateBettingStats(tgId, dateStr, weekYearStr, betAmount);
          await storage.trackBet(tgId, betAmount);
          await storage.createGameSession({
            userId: tgId,
            gameType: "may-bay",
            betType: "crash",
            betAmount: betAmount.toString(),
            winAmount: "0",
            won: false,
            status: "completed",
            result: { crashAt: crashPoint },
            metadata: { source: "web" },
          });
        } catch (statsErr) {
          logger.error({ err: statsErr }, "crash stats save error (non-critical)");
        }
      }
    } catch (err) {
      logger.error({ err }, "crash settle error");
    }
    settledIds.add(tgId);
  }

  // Clear all settled bets
  for (const id of settledIds) roundBets.delete(id);

  setTimeout(() => startIdle(), RESULT_DISPLAY_SECONDS * 1000);
}

export async function handleBet(tgId: string, amount: number): Promise<{ ok: boolean; msg: string; balance?: number }> {
  if (phase !== "waiting" && phase !== "idle") {
    return { ok: false, msg: "Chỉ có thể đặt cược khi đang chờ!" };
  }

  const c = clients.get(tgId);
  // Prevent double-bet: check both SSE client AND roundBets (survives disconnect)
  if ((c && c.bet > 0) || roundBets.has(tgId)) return { ok: false, msg: "Bạn đã đặt cược rồi!" };
  const amtCheck = validateBetAmount(amount);
  if (!amtCheck.ok) return { ok: false, msg: amtCheck.message };
  amount = amtCheck.amount;
  const rate = checkBetRate(tgId);
  if (!rate.ok) return { ok: false, msg: rate.message };

  try {
    const user = await storage.getBotUser(tgId);
    if (!user) return { ok: false, msg: "Không tìm thấy tài khoản!" };
    const balance = parseFloat(user.balance || "0");

    // ── Cross-game double-spend check ──
    // If user has staged bets in baucua/xocdia/quaythu that haven't settled yet,
    // subtract them from available balance before accepting this bet.
    const pending = getPendingBets(tgId);
    const available = balance - pending;
    if (available < amount) {
      const pendingMsg = pending > 0
        ? ` (đang chờ ${Math.round(pending).toLocaleString("vi-VN")}đ ở game khác)`
        : "";
      return { ok: false, msg: `Số dư không đủ! Khả dụng: ${Math.max(0, Math.round(available)).toLocaleString("vi-VN")}đ${pendingMsg}` };
    }

    // Crash deducts balance immediately via atomic ledger (idempotent per round+user)
    const ledger = await applyBalanceDelta({
      userId: tgId,
      delta: -amount,
      type: "game_bet",
      externalId: `crash-bet:${roundId}:${tgId}`,
      method: "crash",
      metadata: { phase: "bet", roundId, amount },
      rejectIfInsufficient: true,
      clampZero: true,
    });
    if (!ledger.ok) {
      return { ok: false, msg: ledger.reason === "insufficient_balance" ? "Số dư không đủ!" : "Không trừ được số dư" };
    }
    const newBalance = parseFloat(ledger.newBalance);

    const wasIdle = phase === "idle";

    // Track bet in roundBets (persists even if SSE disconnects)
    roundBets.set(tgId, amount);

    if (c) {
      c.bet = amount;
      sendTo(tgId, { type: "bet_ok", amount, balance: newBalance, roundId });
    }

    // Sync new balance to ALL open web game tabs
    broadcastBalance(tgId, newBalance);

    // Lock user — prevents bot withdrawal while round is active
    webGameLock(tgId, "✈️ Máy Bay", amount);

    // First bet triggers countdown
    if (wasIdle) {
      startWaiting();
    } else {
      broadcast({ type: "bet_count", betCount: betCount(), roundId });
    }

    // Telegram bet notification
    sendBotNotify(tgId,
      `✈️ <b>Máy Bay — Phiên #${roundId}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 Đặt cược: <b>${amount.toLocaleString("vi-VN")}đ</b>\n` +
      `💰 Số dư còn: <b>${newBalance.toLocaleString("vi-VN")}đ</b>\n` +
      `⏳ Chờ máy bay cất cánh...`
    ).catch(() => {});

    return { ok: true, msg: "Đặt cược thành công!", balance: newBalance };
  } catch (err) {
    logger.error({ err }, "bet error");
    return { ok: false, msg: "Lỗi xử lý cược!" };
  }
}

export async function handleCashout(tgId: string): Promise<{ ok: boolean; msg: string; multiplier?: number; payout?: number; balance?: number }> {
  if (phase !== "flying") return { ok: false, msg: "Chưa đến lúc rút!" };

  const c = clients.get(tgId);
  const betAmount = roundBets.get(tgId);

  // Need either an active SSE client with a bet, or a roundBets entry
  if (!betAmount && (!c || c.bet <= 0)) return { ok: false, msg: "Bạn chưa đặt cược!" };
  if (c?.cashedOut) return { ok: false, msg: "Bạn đã rút rồi!" };

  const activeBet = betAmount ?? c!.bet;

  try {
    const cashoutAt = multiplier;
    const payout = Math.floor(activeBet * cashoutAt);
    const user = await storage.getBotUser(tgId);
    if (!user) return { ok: false, msg: "Không tìm thấy tài khoản!" };

    const ledger = await applyBalanceDelta({
      userId: tgId,
      delta: payout, // bet already deducted at place time — credit full payout
      type: "game_win",
      externalId: `crash-cashout:${roundId}:${tgId}`,
      method: "may-bay",
      metadata: { game: "may-bay", multiplier: cashoutAt, roundId, bet: activeBet, payout },
      clampZero: true,
    });
    if (!ledger.ok) {
      return { ok: false, msg: "Không cộng được tiền thắng" };
    }
    const newBalance = parseFloat(ledger.newBalance);

    // Mark as cashed out in SSE client if connected
    if (c) {
      c.cashedOut = true;
      c.cashoutMultiplier = cashoutAt;
    }

    // Mark as settled in roundBets so startCrashed skips this player
    roundBets.delete(tgId);

    sendTo(tgId, { type: "cashout_ok", multiplier: cashoutAt, payout, balance: newBalance, roundId });

    // Sync new balance to ALL open web game tabs
    broadcastBalance(tgId, newBalance);

    // Track stats for cashout win
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
      const weekYearStr = `${now.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      await storage.createOrUpdateBettingStats(tgId, dateStr, weekYearStr, activeBet);
      await storage.trackBet(tgId, activeBet);
      await storage.createGameSession({
        userId: tgId,
        gameType: "may-bay",
        betType: "crash",
        betAmount: activeBet.toString(),
        winAmount: payout.toString(),
        won: true,
        status: "completed",
        result: { cashoutAt, crashAt: crashPoint },
        metadata: { source: "web" },
      });
    } catch (statsErr) {
      logger.error({ err: statsErr }, "cashout stats save error (non-critical)");
    }

    await webGameResolve(tgId,
      `✈️ <b>Máy Bay — Thắng!</b>\n` +
      `📈 Rút tại <b>x${cashoutAt.toFixed(2)}</b>\n` +
      `💰 Nhận: <b>${payout.toLocaleString("vi-VN")}đ</b>\n` +
      `💳 Số dư: ${newBalance.toLocaleString("vi-VN")}đ`
    );

    return { ok: true, msg: "Rút thành công!", multiplier: cashoutAt, payout, balance: newBalance };
  } catch (err) {
    logger.error({ err }, "cashout error");
    return { ok: false, msg: "Lỗi rút tiền!" };
  }
}

export function registerSSEClient(tgId: string, res: Response) {
  const old = clients.get(tgId);
  if (old) {
    try { old.res.end(); } catch {}
  }

  const client: CrashClient = { res, tgId, bet: 0, cashedOut: false, cashoutMultiplier: 0 };
  clients.set(tgId, client);

  res.on("close", () => { if (clients.get(tgId)?.res === res) clients.delete(tgId); });

  return client;
}

export function registerCrashWebSocketClient(tgId: string, ws: WebSocket) {
  const old = wsClients.get(tgId);
  if (old && old !== ws) {
    try { old.close(); } catch {}
  }
  wsClients.set(tgId, ws);
  ws.on("close", () => {
    const current = wsClients.get(tgId);
    if (current === ws) wsClients.delete(tgId);
  });
}

export function removeCrashWebSocketClient(tgId: string) {
  wsClients.delete(tgId);
}

export function startCrashGame() {
  startIdle();
  logger.info("✅ Crash game server started (idle mode)");
}
