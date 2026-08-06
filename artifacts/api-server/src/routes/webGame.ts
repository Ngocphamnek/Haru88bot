import { Router } from "express";
import { db } from "@workspace/db";
import {
  taixiuSessionsTable,
  gameSessionsTable,
  botUsersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getWebUser } from "./webAuth";
import { balanceSyncService } from "../lib/balanceSyncService";
import crypto from "crypto";

const router = Router();

router.get("/web/game/taixiu/state", async (req, res) => {
  try {
    const [lastSession] = await db
      .select()
      .from(taixiuSessionsTable)
      .orderBy(desc(taixiuSessionsTable.createdAt))
      .limit(1);

    if (!lastSession) {
      res.json({ sessionId: 0, status: "waiting", result: null });
      return;
    }

    res.json({
      sessionId: lastSession.sessionId,
      dice: [lastSession.dice1, lastSession.dice2, lastSession.dice3],
      total: lastSession.total,
      isTai: lastSession.isTai,
      isEven: lastSession.isEven,
      md5Hash: lastSession.md5Hash,
      status: "completed",
    });
  } catch (err) {
    req.log.error({ err }, "web/game/taixiu/state error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get("/web/game/history", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 20), 50);
    const sessions = await db
      .select()
      .from(taixiuSessionsTable)
      .orderBy(desc(taixiuSessionsTable.createdAt))
      .limit(limit);

    res.json(
      sessions.map((s) => ({
        sessionId: s.sessionId,
        dice: [s.dice1, s.dice2, s.dice3],
        total: s.total,
        isTai: s.isTai,
        isEven: s.isEven,
        md5Hash: s.md5Hash,
        createdAt: s.createdAt,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "web/game/history error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get("/web/game/my-history", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }

    const userId = user.telegramId ?? String(user.id);
    const sessions = await db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.userId, userId))
      .orderBy(desc(gameSessionsTable.createdAt))
      .limit(20);

    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "web/game/my-history error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

router.get("/web/game/leaderboard", async (req, res) => {
  try {
    const players = await db
      .select({
        id: botUsersTable.id,
        username: botUsersTable.username,
        firstName: botUsersTable.firstName,
        totalWagered: botUsersTable.totalWagered,
        totalGames: botUsersTable.totalGames,
      })
      .from(botUsersTable)
      .orderBy(desc(botUsersTable.totalWagered))
      .limit(10);

    res.json(players);
  } catch (err) {
    req.log.error({ err }, "web/game/leaderboard error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── 5-Dice Tài Xỉu — self-contained web game ────────────────────────────────
// Rules: sum of 5d6 (range 5-30). Tài ≥ 18, Xỉu ≤ 17, Chẵn = even, Lẻ = odd.
// Server rolls the dice, settles the bet atomically, returns verifiable MD5 hash.
router.post("/web/game/taixiu5d/roll", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }

    if (!user.telegramId) {
      res.status(400).json({ error: "Cần liên kết Telegram để chơi" });
      return;
    }

    const { betAmount, betType } = req.body as {
      betAmount?: number;
      betType?: string;
    };

    if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
      res.status(400).json({ error: "Số tiền cược không hợp lệ" }); return;
    }
    const validTypes = ["tai", "xiu", "chan", "le"];
    if (!betType || !validTypes.includes(betType)) {
      res.status(400).json({ error: "Loại cược không hợp lệ (tai/xiu/chan/le)" }); return;
    }

    // Fetch authoritative balance
    const [botUser] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.id, user.telegramId))
      .limit(1);

    if (!botUser) { res.status(404).json({ error: "Tài khoản không tồn tại" }); return; }

    const currentBalance = parseFloat(botUser.balance ?? "0");
    if (currentBalance < betAmount) {
      res.status(400).json({
        error: `Số dư không đủ (có ${Math.floor(currentBalance).toLocaleString("vi-VN")}đ)`,
      });
      return;
    }

    // ── Roll 5 dice (server-side, provably fair) ──────────────────────────────
    const seed   = crypto.randomBytes(16).toString("hex");
    const dice   = Array.from({ length: 5 }, () => Math.ceil(Math.random() * 6)) as [number,number,number,number,number];
    const total  = dice.reduce((s, d) => s + d, 0);
    const isTai  = total >= 18;
    const isEven = total % 2 === 0;
    const md5    = crypto.createHash("md5").update(`${seed}:${dice.join(",")}`).digest("hex");

    // Determine win
    const won =
      (betType === "tai"  && isTai)  ||
      (betType === "xiu"  && !isTai) ||
      (betType === "chan" && isEven) ||
      (betType === "le"   && !isEven);

    const PAYOUT_MULT  = 1.95;
    const payout       = won ? Math.floor(betAmount * PAYOUT_MULT) : 0;
    const newBal       = (currentBalance - betAmount + payout).toFixed(0);

    // Atomic balance update
    await db
      .update(botUsersTable)
      .set({ balance: newBal, updatedAt: new Date() })
      .where(eq(botUsersTable.id, user.telegramId));

    // Push real-time SSE balance update
    balanceSyncService.push(user.telegramId, newBal);

    // Record to game_sessions for history
    await db.insert(gameSessionsTable).values({
      userId:    user.telegramId,
      gameType:  "taixiu5d",
      betAmount: String(betAmount),
      betType,
      won,
      winAmount: String(payout),
      result:    { dice, total, isTai, isEven, md5, seed },
      status:    "completed",
      metadata:  null,
      completedAt: new Date(),
    });

    req.log.info({
      userId: user.telegramId,
      dice,
      total,
      betType,
      betAmount,
      won,
      payout,
      newBalance: newBal,
    }, "taixiu5d roll settled");

    res.json({
      ok: true,
      dice,
      total,
      isTai,
      isEven,
      won,
      payout,
      newBalance: newBal,
      md5,
      seed,
    });
  } catch (err) {
    req.log.error({ err }, "taixiu5d/roll error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ── 5D history (last 30 rounds from game_sessions) ────────────────────────────
router.get("/web/game/taixiu5d/history", async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.gameType, "taixiu5d"))
      .orderBy(desc(gameSessionsTable.createdAt))
      .limit(30);

    res.json(sessions.map(s => ({
      id:        s.id,
      betAmount: s.betAmount,
      betType:   s.betType,
      won:       s.won,
      winAmount: s.winAmount,
      result:    s.result,
      createdAt: s.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "taixiu5d/history error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ── Personal 5D history ────────────────────────────────────────────────────────
router.get("/web/game/taixiu5d/my-history", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) { res.status(401).json({ error: "Chưa đăng nhập" }); return; }
    const userId = user.telegramId ?? String(user.id);
    const sessions = await db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.userId, userId))
      .orderBy(desc(gameSessionsTable.createdAt))
      .limit(20);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
