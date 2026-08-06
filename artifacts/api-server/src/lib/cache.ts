/**
 * cache.ts — Redis-backed cache for api-server.
 *
 * Redis is OPTIONAL. If REDIS_URL is not set, all operations silently
 * fall back to in-memory / no-op so the server runs fine without Redis.
 *
 * Provides:
 *  1. getCachedUserBalance() / setCachedUserBalance() / invalidateUserCache()
 *  2. getPendingBetsRedis() / addPendingBetRedis() / reducePendingBetRedis()
 *  3. Redis pub/sub for "balance:update" and "tg:notify" channels
 */

import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL; // undefined → Redis disabled

// Exponential backoff capped at 30 s, stops after 5 failures
function retryStrategy(times: number): number | null {
  if (times > 5) {
    logger.warn("Redis unavailable after 5 attempts — giving up. Set REDIS_URL to enable Redis.");
    return null; // stop reconnecting
  }
  return Math.min(times * 2000, 30_000);
}

function makeRedis(): Redis | null {
  if (!REDIS_URL) return null;
  const client = new Redis(REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy,
  });
  client.on("error", (err) => logger.warn({ err }, "Redis error"));
  return client;
}

// ─── Singleton clients ────────────────────────────────────────────────────────

let _pub: Redis | null | undefined; // undefined = not yet initialised
let _sub: Redis | null | undefined;

function getPub(): Redis | null {
  if (_pub === undefined) _pub = makeRedis();
  return _pub;
}

function getSub(): Redis | null {
  if (_sub === undefined) _sub = makeRedis();
  return _sub;
}

/** Exported for external use (e.g. webGameLock) */
export function getRedis(): Redis | null {
  return getPub();
}

// ─── User balance cache ───────────────────────────────────────────────────────

const USER_TTL = 5; // seconds

export async function getCachedUserBalance(tgId: string): Promise<number | null> {
  const r = getPub();
  if (!r) return null;
  try {
    const val = await r.get(`cache:user:${tgId}`);
    if (val !== null) return parseFloat(val);
  } catch {
    // ignore
  }
  return null;
}

export async function setCachedUserBalance(tgId: string, balance: number): Promise<void> {
  const r = getPub();
  if (!r) return;
  try {
    await r.set(`cache:user:${tgId}`, balance.toString(), "EX", USER_TTL);
  } catch {
    // ignore
  }
}

export async function invalidateUserCache(tgId: string): Promise<void> {
  const r = getPub();
  if (!r) return;
  try {
    await r.del(`cache:user:${tgId}`);
  } catch {
    // ignore
  }
}

// ─── Pending bets (Redis write-through, in-memory fallback) ──────────────────

export async function getPendingBetsRedis(tgId: string): Promise<number> {
  const r = getPub();
  if (!r) return 0;
  try {
    const val = await r.get(`pending:${tgId}`);
    return val ? parseFloat(val) : 0;
  } catch {
    return 0;
  }
}

export async function addPendingBetRedis(tgId: string, amount: number): Promise<void> {
  const r = getPub();
  if (!r) return;
  try {
    await r.incrbyfloat(`pending:${tgId}`, amount);
    await r.expire(`pending:${tgId}`, 600);
  } catch {
    // ignore
  }
}

export async function reducePendingBetRedis(tgId: string, amount: number): Promise<void> {
  const r = getPub();
  if (!r) return;
  try {
    const cur = await getPendingBetsRedis(tgId);
    const next = Math.max(0, cur - amount);
    if (next === 0) {
      await r.del(`pending:${tgId}`);
    } else {
      await r.set(`pending:${tgId}`, next.toString(), "EX", 600);
    }
  } catch {
    // ignore
  }
}

// ─── Pub/Sub ──────────────────────────────────────────────────────────────────

type BalanceUpdateHandler = (tgId: string, balance: number) => void;
type NotifyHandler = (tgId: string, message: string) => Promise<void>;

let _balanceHandler: BalanceUpdateHandler | null = null;
let _notifyHandler: NotifyHandler | null = null;

export function setBalanceUpdateHandler(fn: BalanceUpdateHandler): void {
  _balanceHandler = fn;
}

export function setNotifyHandler(fn: NotifyHandler): void {
  _notifyHandler = fn;
}

export function startRedisSubscriptions(): void {
  const sub = getSub();
  if (!sub) {
    logger.info("Redis not configured — pub/sub disabled (set REDIS_URL to enable)");
    return;
  }

  const doSubscribe = () => {
    sub.subscribe("balance:update", "tg:notify", (err) => {
      if (err) logger.warn({ err }, "Redis subscribe error");
      else logger.info("Redis subscriptions active (balance:update, tg:notify)");
    });
  };

  if ((sub.status as string) === "ready") {
    doSubscribe();
  } else {
    sub.once("ready", doSubscribe);
  }

  sub.on("message", (channel, message) => {
    if (channel === "balance:update") {
      const colonIdx = message.indexOf(":");
      if (colonIdx === -1) return;
      const tgId = message.slice(0, colonIdx);
      const balance = parseFloat(message.slice(colonIdx + 1));
      if (_balanceHandler) _balanceHandler(tgId, balance);
    } else if (channel === "tg:notify") {
      try {
        const { tgId, message: msg } = JSON.parse(message);
        if (_notifyHandler) _notifyHandler(tgId, msg).catch(() => {});
      } catch {
        // ignore malformed
      }
    }
  });

  logger.info("Redis subscriptions started (balance:update, tg:notify)");
}
