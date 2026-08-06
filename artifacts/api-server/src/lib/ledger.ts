/**
 * Atomic balance ledger — single write path for money movements.
 * SQL atomic update + transactions row; externalId = idempotency key.
 *
 * Game flow (multiplayer rooms):
 *  1. placeBet  → holdBet()     debit stake immediately (status completed, type game_bet_hold)
 *  2. settle    → settleAfterHold()  credit winAmount only (type game_win)
 * Crash already debits on bet; cashout credits payout the same way.
 */
import { db } from "@workspace/db";
import { botUsersTable, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger.js";

export type LedgerType =
  | "game_settle"
  | "game_bet_hold"
  | "game_win"
  | "game_bet"
  | "admin_add"
  | "admin_deduct"
  | "admin_adjust"
  | "deposit"
  | "withdraw"
  | "gift"
  | "refund"
  | "other";

export interface LedgerApplyInput {
  userId: string;
  /** Signed delta: +credit / -debit */
  delta: number;
  type: LedgerType | string;
  externalId?: string;
  method?: string;
  metadata?: Record<string, unknown>;
  clampZero?: boolean;
  rejectIfInsufficient?: boolean;
}

export interface LedgerApplyResult {
  ok: boolean;
  duplicate?: boolean;
  newBalance: string;
  previousBalance?: string;
  appliedDelta: number;
  reason?: string;
  transactionId?: number;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

async function pushBalance(userId: string, newBalance: string): Promise<void> {
  try {
    const { balanceSyncService } = await import("./balanceSyncService.js");
    balanceSyncService.push(userId, newBalance);
  } catch { /* ignore */ }
  try {
    const { invalidateUserCache } = await import("./cache.js");
    await invalidateUserCache(userId);
  } catch { /* ignore */ }
}

/**
 * Apply a signed balance delta atomically.
 * Idempotent when externalId is provided.
 */
export async function applyBalanceDelta(input: LedgerApplyInput): Promise<LedgerApplyResult> {
  const userId = String(input.userId || "").trim();
  const delta = Number(input.delta);
  const clampZero = input.clampZero !== false;

  if (!userId) {
    return { ok: false, newBalance: "0", appliedDelta: 0, reason: "invalid_user" };
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, newBalance: "0", appliedDelta: 0, reason: "invalid_delta" };
  }
  if (Math.abs(delta) > 500_000_000) {
    return { ok: false, newBalance: "0", appliedDelta: 0, reason: "delta_cap" };
  }

  const externalId = input.externalId?.trim() || null;

  if (externalId) {
    try {
      const existing = await db.execute(sql`
        SELECT id, amount
        FROM transactions
        WHERE external_id = ${externalId}
          AND status = 'completed'
        LIMIT 1
      `);
      if (existing.rows?.length) {
        const row = existing.rows[0] as { id: number; amount: string };
        const [user] = await db
          .select({ balance: botUsersTable.balance })
          .from(botUsersTable)
          .where(eq(botUsersTable.id, userId))
          .limit(1);
        return {
          ok: true,
          duplicate: true,
          newBalance: user?.balance ?? "0",
          appliedDelta: Number(row.amount) || delta,
          transactionId: row.id,
          reason: "duplicate_external_id",
        };
      }
    } catch (err) {
      logger.warn({ err, externalId }, "ledger idempotency lookup failed — continuing");
    }
  }

  try {
    let result;
    if (delta < 0 && input.rejectIfInsufficient) {
      const debit = Math.abs(delta);
      result = await db.execute(sql`
        UPDATE bot_users
        SET balance = ROUND(CAST(balance AS NUMERIC) - ${debit}, 2)::TEXT,
            updated_at = NOW()
        WHERE id = ${userId}
          AND CAST(balance AS NUMERIC) >= ${debit}
        RETURNING balance,
          (CAST(balance AS NUMERIC) + ${debit})::TEXT AS previous_balance
      `);
      if (!result.rows?.length) {
        const [user] = await db
          .select({ id: botUsersTable.id, balance: botUsersTable.balance })
          .from(botUsersTable)
          .where(eq(botUsersTable.id, userId))
          .limit(1);
        if (!user) return { ok: false, newBalance: "0", appliedDelta: 0, reason: "user_not_found" };
        return {
          ok: false,
          newBalance: user.balance,
          appliedDelta: 0,
          reason: "insufficient_balance",
        };
      }
    } else if (clampZero) {
      result = await db.execute(sql`
        UPDATE bot_users
        SET balance = GREATEST(0, ROUND(CAST(balance AS NUMERIC) + ${delta}, 2))::TEXT,
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING balance,
          ROUND(CAST(balance AS NUMERIC) - ${delta}, 2)::TEXT AS previous_balance
      `);
    } else {
      result = await db.execute(sql`
        UPDATE bot_users
        SET balance = ROUND(CAST(balance AS NUMERIC) + ${delta}, 2)::TEXT,
            updated_at = NOW()
        WHERE id = ${userId}
        RETURNING balance,
          ROUND(CAST(balance AS NUMERIC) - ${delta}, 2)::TEXT AS previous_balance
      `);
    }

    if (!result.rows?.length) {
      return { ok: false, newBalance: "0", appliedDelta: 0, reason: "user_not_found" };
    }

    const row = result.rows[0] as { balance: string; previous_balance?: string };
    const newBalance = row.balance;
    const previousBalance = row.previous_balance;

    let transactionId: number | undefined;
    try {
      const [tx] = await db
        .insert(transactionsTable)
        .values({
          userId,
          type: String(input.type),
          amount: round2(delta),
          status: "completed",
          method: input.method ?? null,
          externalId: externalId,
          metadata: {
            ...(input.metadata ?? {}),
            previousBalance,
            newBalance,
          },
        })
        .returning({ id: transactionsTable.id });
      transactionId = tx?.id;
    } catch (err: any) {
      if (externalId && (err?.code === "23505" || String(err?.message || "").includes("unique"))) {
        const [user] = await db
          .select({ balance: botUsersTable.balance })
          .from(botUsersTable)
          .where(eq(botUsersTable.id, userId))
          .limit(1);
        return {
          ok: true,
          duplicate: true,
          newBalance: user?.balance ?? newBalance,
          appliedDelta: delta,
          reason: "duplicate_external_id_race",
        };
      }
      logger.error({ err, userId, delta }, "ledger tx insert failed after balance update");
    }

    await pushBalance(userId, newBalance);

    return {
      ok: true,
      newBalance,
      previousBalance,
      appliedDelta: delta,
      transactionId,
    };
  } catch (err) {
    logger.error({ err, userId, delta }, "applyBalanceDelta failed");
    return { ok: false, newBalance: "0", appliedDelta: 0, reason: "server_error" };
  }
}

/** Debit stake at bet time (hold). */
export async function holdBet(opts: {
  userId: string;
  amount: number;
  gameType: string;
  sessionId: number | string;
  betType: string;
  /** Monotonic client/server nonce so multi-door bets don't collide */
  nonce?: string | number;
}): Promise<LedgerApplyResult> {
  const amount = Math.abs(Number(opts.amount));
  const nonce = opts.nonce ?? `${opts.betType}:${amount}:${Date.now()}`;
  return applyBalanceDelta({
    userId: opts.userId,
    delta: -amount,
    type: "game_bet_hold",
    externalId: `hold:${opts.gameType}:${opts.sessionId}:${opts.userId}:${nonce}`,
    method: opts.gameType,
    metadata: {
      betType: opts.betType,
      sessionId: opts.sessionId,
      amount,
    },
    rejectIfInsufficient: true,
    clampZero: true,
  });
}

/**
 * After hold: only credit winnings (stake already removed).
 * winAmount is gross payout (what player receives back), not net profit.
 */
export async function settleAfterHold(opts: {
  userId: string;
  winAmount: number;
  totalBet: number;
  gameType: string;
  sessionKey: string;
  bets?: unknown;
}): Promise<LedgerApplyResult> {
  const win = Math.max(0, Number(opts.winAmount) || 0);
  if (win === 0) {
    // Loss — stake already held; record zero-credit settle marker for audit trail
    // without touching balance (delta 0 not allowed) — return current balance
    try {
      const [user] = await db
        .select({ balance: botUsersTable.balance })
        .from(botUsersTable)
        .where(eq(botUsersTable.id, opts.userId))
        .limit(1);
      // Optional audit row with external id for loss
      try {
        await db.insert(transactionsTable).values({
          userId: opts.userId,
          type: "game_settle",
          amount: "0",
          status: "completed",
          method: opts.gameType,
          externalId: `settle-loss:${opts.sessionKey}:${opts.userId}`,
          metadata: {
            totalBet: opts.totalBet,
            winAmount: 0,
            bets: opts.bets,
            outcome: "loss",
          },
        });
      } catch {
        /* duplicate loss marker ok */
      }
      return {
        ok: true,
        newBalance: user?.balance ?? "0",
        appliedDelta: 0,
        reason: "loss_no_credit",
      };
    } catch {
      return { ok: false, newBalance: "0", appliedDelta: 0, reason: "server_error" };
    }
  }

  return applyBalanceDelta({
    userId: opts.userId,
    delta: win,
    type: "game_win",
    externalId: `settle-win:${opts.sessionKey}:${opts.userId}`,
    method: opts.gameType,
    metadata: {
      totalBet: opts.totalBet,
      winAmount: win,
      bets: opts.bets,
      outcome: "win",
    },
    clampZero: true,
  });
}

/**
 * Legacy net settle (no prior hold): netChange = -totalBet + winAmount.
 * Prefer hold + settleAfterHold for multiplayer rooms.
 */
export async function applyGameSettle(opts: {
  userId: string;
  totalBet: number;
  winAmount: number;
  gameType: string;
  sessionKey: string;
  bets?: unknown;
}): Promise<LedgerApplyResult> {
  const net = -Math.abs(opts.totalBet) + Math.max(0, opts.winAmount);
  if (net === 0) {
    return settleAfterHold({ ...opts, winAmount: 0 });
  }
  return applyBalanceDelta({
    userId: opts.userId,
    delta: net,
    type: "game_settle",
    externalId: `game:${opts.gameType}:${opts.sessionKey}:${opts.userId}`,
    method: opts.gameType,
    metadata: {
      totalBet: opts.totalBet,
      winAmount: opts.winAmount,
      bets: opts.bets,
    },
    clampZero: true,
  });
}

/** Ensure unique index exists (safe to call on boot). */
export async function ensureLedgerIndexes(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_uidx
      ON transactions (external_id)
      WHERE external_id IS NOT NULL
    `);
    logger.info("ledger: unique index on transactions.external_id ready");
  } catch (err) {
    logger.warn({ err }, "ledger: could not ensure unique index (non-fatal)");
  }
}
