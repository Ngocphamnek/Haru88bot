/**
 * maintenance.ts — Scheduled data retention + storage optimization.
 *
 * Runs automatically at server startup (once) and then every 6 hours.
 *
 * Jobs:
 *  1. Purge game_sessions older than RETAIN_DAYS (default 30)
 *  2. Purge transactions older than RETAIN_DAYS (default 90)
 *  3. Flush expired Redis keys (Redis handles via TTL, just log stats)
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { getRedis } from "./cache";

const GAME_SESSION_RETAIN_DAYS = Number(process.env.GAME_SESSION_RETAIN_DAYS ?? "30");
const TRANSACTION_RETAIN_DAYS = Number(process.env.TRANSACTION_RETAIN_DAYS ?? "90");
const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function runMaintenance(): Promise<{
  deletedSessions: number;
  deletedTransactions: number;
  redisMemMB: number;
  redisKeys: number;
}> {
  const startMs = Date.now();
  logger.info("🧹 Maintenance: starting data retention job...");

  // ── 1. Purge old game sessions ───────────────────────────────────────────────
  let deletedSessions = 0;
  try {
    const result = await db.execute(
      sql`DELETE FROM game_sessions
          WHERE created_at < NOW() - INTERVAL '${sql.raw(String(GAME_SESSION_RETAIN_DAYS))} days'`
    );
    deletedSessions = (result as any).rowCount ?? 0;
    if (deletedSessions > 0) {
      logger.info({ deletedSessions, retainDays: GAME_SESSION_RETAIN_DAYS },
        "🗑️  Purged old game sessions");
    }
  } catch (err) {
    logger.warn({ err }, "Maintenance: failed to purge game_sessions");
  }

  // ── 2. Purge old transactions ────────────────────────────────────────────────
  let deletedTransactions = 0;
  try {
    const result = await db.execute(
      sql`DELETE FROM transactions
          WHERE created_at < NOW() - INTERVAL '${sql.raw(String(TRANSACTION_RETAIN_DAYS))} days'
          AND type = 'game'`
    );
    deletedTransactions = (result as any).rowCount ?? 0;
    if (deletedTransactions > 0) {
      logger.info({ deletedTransactions, retainDays: TRANSACTION_RETAIN_DAYS },
        "🗑️  Purged old game transactions");
    }
  } catch (err) {
    logger.warn({ err }, "Maintenance: failed to purge transactions");
  }

  // ── 3. Redis stats ────────────────────────────────────────────────────────────
  let redisMemMB = 0;
  let redisKeys = 0;
  try {
    const redis = getRedis();
    if (redis) {
      const info = await redis.info("memory");
      const memMatch = info.match(/used_memory:(\d+)/);
      if (memMatch) redisMemMB = Math.round(Number(memMatch[1]) / 1024 / 1024 * 10) / 10;
      redisKeys = await redis.dbsize();
      logger.info({ redisMemMB, redisKeys }, "📊 Redis stats");
    }
  } catch {
    // Redis unavailable
  }

  const durMs = Date.now() - startMs;
  logger.info({ deletedSessions, deletedTransactions, redisMemMB, redisKeys, durMs },
    "✅ Maintenance: done");

  return { deletedSessions, deletedTransactions, redisMemMB, redisKeys };
}

/** Schedule maintenance to run every 6 hours automatically. */
export function scheduleMaintenance(): void {
  // Run once at startup (after 30s delay to not compete with boot)
  setTimeout(() => {
    runMaintenance().catch((err) => logger.warn({ err }, "Maintenance startup run failed"));
  }, 30_000);

  // Then every 6 hours
  setInterval(() => {
    runMaintenance().catch((err) => logger.warn({ err }, "Maintenance scheduled run failed"));
  }, RUN_INTERVAL_MS);

  logger.info(`🕐 Maintenance scheduler started (every 6h, retain sessions ${GAME_SESSION_RETAIN_DAYS}d)`);
}
