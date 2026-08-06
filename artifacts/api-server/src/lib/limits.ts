/**
 * Game / money path limits and lightweight in-memory rate limiters.
 */
import type { Request, Response, NextFunction } from "express";

// ─── Bet amount limits (VND) ─────────────────────────────────────────────────
export const MIN_BET = Number(process.env.MIN_BET || 1_000);
export const MAX_BET = Number(process.env.MAX_BET || 50_000_000);
export const MAX_BETS_PER_MINUTE = Number(process.env.MAX_BETS_PER_MINUTE || 30);
export const MAX_BETS_PER_ROUND_DOORS = Number(process.env.MAX_BETS_PER_ROUND_DOORS || 12);

export function validateBetAmount(amount: unknown): { ok: true; amount: number } | { ok: false; message: string } {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, message: "Số tiền cược không hợp lệ" };
  }
  if (n < MIN_BET) {
    return { ok: false, message: `Cược tối thiểu ${MIN_BET.toLocaleString("vi-VN")}đ` };
  }
  if (n > MAX_BET) {
    return { ok: false, message: `Cược tối đa ${MAX_BET.toLocaleString("vi-VN")}đ` };
  }
  // Integer đồng
  if (Math.floor(n) !== n) {
    return { ok: false, message: "Số tiền phải là số nguyên" };
  }
  return { ok: true, amount: n };
}

// ─── Sliding window counter (per key) ────────────────────────────────────────
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(b: Bucket, windowMs: number, now: number) {
  const cut = now - windowMs;
  while (b.timestamps.length && b.timestamps[0]! < cut) b.timestamps.shift();
}

export function hitRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { timestamps: [] };
    buckets.set(key, b);
  }
  prune(b, windowMs, now);
  if (b.timestamps.length >= max) {
    const oldest = b.timestamps[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - oldest)),
    };
  }
  b.timestamps.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, max - b.timestamps.length),
    retryAfterMs: 0,
  };
}

/** Express middleware factory: rate limit by game user id or IP */
export function rateLimitByKey(opts: {
  name: string;
  max: number;
  windowMs: number;
  keyFn: (req: Request) => string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const raw = opts.keyFn(req) || req.ip || "unknown";
    const key = `${opts.name}:${raw}`;
    const r = hitRateLimit(key, opts.max, opts.windowMs);
    res.setHeader("X-RateLimit-Remaining", String(r.remaining));
    if (!r.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(r.retryAfterMs / 1000) || 1));
      res.status(429).json({
        success: false,
        ok: false,
        error: "Rate limit exceeded",
        message: "Quá nhiều yêu cầu, thử lại sau.",
      });
      return;
    }
    next();
  };
}

export function checkBetRate(tgid: string): { ok: true } | { ok: false; message: string } {
  const r = hitRateLimit(`bet:${tgid}`, MAX_BETS_PER_MINUTE, 60_000);
  if (!r.allowed) {
    return { ok: false, message: "Bạn cược quá nhanh, chờ vài giây." };
  }
  return { ok: true };
}

// Periodic cleanup to avoid unbounded map growth
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    prune(b, 120_000, now);
    if (b.timestamps.length === 0) buckets.delete(k);
  }
}, 60_000).unref?.();
