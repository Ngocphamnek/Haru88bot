/**
 * Admin session revoke list (jti denylist).
 * In-memory + optional Redis key `haru88:admin:revoked:<jti>`.
 */
import { logger } from "./logger.js";

const localRevoked = new Map<string, number>(); // jti -> exp unix sec

function pruneLocal(now = Math.floor(Date.now() / 1000)) {
  for (const [jti, exp] of localRevoked) {
    if (exp <= now) localRevoked.delete(jti);
  }
}

export async function revokeAdminJti(jti: string, expUnix: number): Promise<void> {
  if (!jti) return;
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(1, expUnix - now);
  localRevoked.set(jti, expUnix);
  try {
    const { getRedis } = await import("./cache.js");
    const redis = typeof getRedis === "function" ? getRedis() : null;
    if (redis) {
      await redis.set(`haru88:admin:revoked:${jti}`, "1", "EX", ttl);
    }
  } catch {
    /* redis optional */
  }
  logger.info({ jti: jti.slice(0, 8) }, "admin session revoked");
}

export async function isAdminJtiRevoked(jti: string): Promise<boolean> {
  if (!jti) return true;
  pruneLocal();
  const localExp = localRevoked.get(jti);
  if (localExp && localExp > Math.floor(Date.now() / 1000)) return true;
  try {
    const { getRedis } = await import("./cache.js");
    const redis = typeof getRedis === "function" ? getRedis() : null;
    if (redis) {
      const v = await redis.get(`haru88:admin:revoked:${jti}`);
      if (v) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

setInterval(() => pruneLocal(), 60_000).unref?.();
