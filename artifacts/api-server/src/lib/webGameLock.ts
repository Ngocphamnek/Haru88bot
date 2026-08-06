/**
 * webGameLock — tracks users currently in an active web game session.
 *
 * globalPendingBets — uses Redis write-through for persistence across restarts.
 * Local in-memory Map is the fast path; Redis is synced in background.
 *
 * balanceBroadcast — shared real-time balance sync across ALL web games.
 */

import {
  getPendingBetsRedis,
  addPendingBetRedis,
  reducePendingBetRedis,
} from "./cache";

type NotifyFn = (tgId: string, msg: string) => Promise<void>;
type BalanceFn = (tgId: string, balance: number) => void;

export interface WebGameSession {
  game: string;
  betAmount: number;
  startedAt: number;
}

// ─── Active sessions (for bot withdrawal lock) ───────────────────────────────

const activeSessions = new Map<string, WebGameSession>();
let _notify: NotifyFn = async () => {};

/** Register the Telegram notify callback (called once on bot startup). */
export function setWebGameNotify(fn: NotifyFn) {
  _notify = fn;
}

/** Lock a user — they are now in an active web game round. */
export function webGameLock(tgId: string, game: string, betAmount: number) {
  activeSessions.set(tgId, { game, betAmount, startedAt: Date.now() });
}

/** Get the current active web game session for a user (null if none). */
export function getWebGameSession(tgId: string): WebGameSession | null {
  return activeSessions.get(tgId) ?? null;
}

/**
 * Resolve the game: unlock the user and send a Telegram result notification.
 */
export async function webGameResolve(tgId: string, message: string) {
  activeSessions.delete(tgId);
  try {
    await _notify(tgId, message);
  } catch {
    // Silent
  }
}

/**
 * Send a Telegram notification to a user without touching active sessions.
 */
export async function sendBotNotify(tgId: string, message: string): Promise<void> {
  try {
    await _notify(tgId, message);
  } catch {
    // Silent
  }
}

// ─── Global Pending Bets (in-memory + Redis write-through) ───────────────────
//
// In-memory Map is the fast path for synchronous access.
// Redis is synced in background for cross-restart persistence.
// On startup, call loadPendingBetsFromRedis() to restore in-flight bets.

const _globalPendingBets = new Map<string, number>();

/** Restore in-flight pending bets from Redis on startup. */
export async function loadPendingBetsFromRedis(): Promise<void> {
  try {
    const { getRedis } = await import("./cache");
    const redis = getRedis();
    if (!redis) return;
    const keys = await redis.keys("pending:*");
    for (const key of keys) {
      const tgId = key.replace("pending:", "");
      const val = await redis.get(key);
      if (val) {
        const amount = parseFloat(val);
        if (amount > 0) _globalPendingBets.set(tgId, amount);
      }
    }
    if (keys.length > 0) {
      console.log(`[webGameLock] Restored ${keys.length} pending bets from Redis`);
    }
  } catch {
    // Redis unavailable — proceed with empty in-memory map
  }
}

/** Get total pending (staged, not yet DB-deducted) bets for a user. */
export function getPendingBets(tgId: string): number {
  return _globalPendingBets.get(tgId) || 0;
}

/** Add to a user's global pending bets (call after staged-bet accepted). */
export function addPendingBet(tgId: string, amount: number): void {
  _globalPendingBets.set(tgId, (_globalPendingBets.get(tgId) || 0) + amount);
  addPendingBetRedis(tgId, amount).catch(() => {});
}

/** Reduce a user's global pending bets (call after DB is updated on resolve). */
export function reducePendingBet(tgId: string, amount: number): void {
  const next = Math.max(0, (_globalPendingBets.get(tgId) || 0) - amount);
  if (next === 0) _globalPendingBets.delete(tgId);
  else _globalPendingBets.set(tgId, next);
  reducePendingBetRedis(tgId, amount).catch(() => {});
}

// ─── Shared Balance Broadcast (cross-game real-time balance sync) ─────────────

const _balanceListeners: BalanceFn[] = [];

export function registerBalanceListener(fn: BalanceFn): void {
  _balanceListeners.push(fn);
}

export function broadcastBalance(tgId: string, balance: number): void {
  for (const fn of _balanceListeners) {
    try { fn(tgId, balance); } catch {}
  }
}
