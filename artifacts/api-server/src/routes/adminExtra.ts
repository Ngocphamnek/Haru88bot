/**
 * adminExtra.ts — Extended admin routes:
 *  - Withdrawal management (list, approve, reject)
 *  - Analytics (revenue, games, top players)
 *  - Fraud detection (suspicious accounts, IP blacklist)
 *  - Promotions CRUD + weekly cashback
 */
import { Router, type Request, type Response } from "express";
import { eq, and, desc, sql, ilike, or, gte, lte, ne } from "drizzle-orm";
import {
  db,
  botUsersTable,
  transactionsTable,
  gameSessionsTable,
  bettingStatsTable,
  promotionsTable,
  promotionClaimsTable,
  botSettingsTable,
} from "@workspace/db";
import { requireAdmin } from "./admin";
import { logger } from "../lib/logger";
import { bankService } from "../telegram/bankService";

const router = Router();


router.use(requireAdmin);

/* ═══════════════════════════════════════════════════════════════════
   WITHDRAWAL MANAGEMENT
   ═══════════════════════════════════════════════════════════════════ */

/** GET /admin/withdrawals?status=pending&page=1&limit=20 */
router.get("/withdrawals", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || "pending";
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    let baseQuery = db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "withdrawal"))
      .$dynamic();

    let countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "withdrawal"))
      .$dynamic();

    if (status !== "all") {
      baseQuery  = baseQuery.where(eq(transactionsTable.status, status));
      countQuery = countQuery.where(eq(transactionsTable.status, status));
    }

    const [rows, [countRow]] = await Promise.all([
      baseQuery.orderBy(desc(transactionsTable.createdAt)).limit(limit).offset(offset),
      countQuery,
    ]);

    // Enrich with user info
    const userIds = [...new Set(rows.map(r => r.userId))];
    const users = userIds.length
      ? await db.select().from(botUsersTable).where(sql`id = ANY(${userIds})`)
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    res.json({
      total: countRow?.count ?? 0,
      page,
      limit,
      withdrawals: rows.map(r => {
        const meta = (r.metadata as Record<string, any>) ?? {};
        const user = userMap.get(r.userId);
        return {
          id: r.id,
          withdrawId: meta.withdrawId ?? `WD-${r.id}`,
          userId: r.userId,
          username: user?.username ?? user?.firstName ?? r.userId,
          currentBalance: user?.balance ?? "0",
          amount: r.amount,
          status: r.status,
          method: r.method ?? "unknown",
          momoPhone: meta.momoPhone ?? null,
          bankCode: meta.bankCode ?? null,
          bankAccount: meta.bankAccount ?? null,
          accountHolderName: meta.accountHolderName ?? null,
          rejectedReason: meta.rejectedReason ?? null,
          processedAt: meta.processedAt ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
    });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/withdrawals error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/withdrawals/:id/approve */
router.post("/withdrawals/:id/approve", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const txId = parseInt(rawId);
    if (!txId) { res.status(400).json({ error: "Invalid id" }); return; }

    const [txn] = await db
      .select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, txId),
        eq(transactionsTable.type, "withdrawal"),
        eq(transactionsTable.status, "pending"),
      ))
      .limit(1);

    if (!txn) { res.status(404).json({ error: "Không tìm thấy yêu cầu rút tiền đang chờ" }); return; }

    const amount = parseFloat(txn.amount);

    // Atomic deduct balance — prevent going negative
    const [updated] = await db
      .update(botUsersTable)
      .set({
        balance: sql`GREATEST(0, (balance::numeric - ${amount}))::text`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(botUsersTable.id, txn.userId),
        sql`balance::numeric >= ${amount}`,   // only deduct if sufficient
      ))
      .returning({ balance: botUsersTable.balance, id: botUsersTable.id });

    if (!updated) {
      res.status(400).json({ error: "Số dư người dùng không đủ để duyệt rút tiền" });
      return;
    }

    const meta = (txn.metadata as Record<string, any>) ?? {};
    await db
      .update(transactionsTable)
      .set({
        status: "completed",
        metadata: { ...meta, processedAt: new Date().toISOString(), processedBy: "admin" },
      })
      .where(eq(transactionsTable.id, txId));

    // Notify via Telegram bot (fire-and-forget)
    try {
      const { telegramBotService } = await import("../telegram/telegramBot.js");
      await telegramBotService.sendNotification(
        txn.userId,
        `✅ <b>Yêu cầu rút tiền đã được duyệt!</b>\n\n` +
        `💰 Số tiền: <b>${amount.toLocaleString("vi-VN")}đ</b>\n` +
        `💳 Phương thức: ${txn.method ?? "N/A"}\n` +
        `📋 ID: <code>${meta.withdrawId ?? txId}</code>\n\n` +
        `Tiền đã được chuyển đến tài khoản của bạn.`
      );
    } catch { /* bot may not be active */ }

    logger.info({ txId, userId: txn.userId, amount }, "✅ Withdrawal approved");
    res.json({ success: true, newBalance: updated.balance });
  } catch (err: any) {
    logger.error({ err }, "POST /admin/withdrawals/:id/approve error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/withdrawals/:id/reject */
router.post("/withdrawals/:id/reject", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const txId = parseInt(rawId);
    const { reason } = req.body as { reason?: string };
    if (!txId) { res.status(400).json({ error: "Invalid id" }); return; }

    const [txn] = await db
      .select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.id, txId),
        eq(transactionsTable.type, "withdrawal"),
        eq(transactionsTable.status, "pending"),
      ))
      .limit(1);

    if (!txn) { res.status(404).json({ error: "Không tìm thấy yêu cầu rút tiền đang chờ" }); return; }

    const meta = (txn.metadata as Record<string, any>) ?? {};
    await db
      .update(transactionsTable)
      .set({
        status: "failed",
        metadata: { ...meta, rejectedReason: reason ?? "Admin từ chối", processedAt: new Date().toISOString(), processedBy: "admin" },
      })
      .where(eq(transactionsTable.id, txId));

    // Notify user
    try {
      const { telegramBotService } = await import("../telegram/telegramBot.js");
      await telegramBotService.sendNotification(
        txn.userId,
        `❌ <b>Yêu cầu rút tiền bị từ chối</b>\n\n` +
        `💰 Số tiền: <b>${parseFloat(txn.amount).toLocaleString("vi-VN")}đ</b>\n` +
        (reason ? `📝 Lý do: ${reason}\n` : "") +
        `\nVui lòng liên hệ hỗ trợ nếu cần thêm thông tin.`
      );
    } catch { /* bot may not be active */ }

    logger.info({ txId, userId: txn.userId, reason }, "❌ Withdrawal rejected");
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "POST /admin/withdrawals/:id/reject error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   ANALYTICS
   ═══════════════════════════════════════════════════════════════════ */

/** GET /admin/analytics/revenue?period=day|week|month */
router.get("/analytics/revenue", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || "month";
    const intervals: Record<string, string> = { day: "30 days", week: "12 weeks", month: "12 months" };
    const interval = intervals[period] ?? "30 days";

    const groupExpr: Record<string, string> = {
      day:   "DATE(created_at)",
      week:  "DATE_TRUNC('week', created_at)",
      month: "DATE_TRUNC('month', created_at)",
    };
    const grp = groupExpr[period] ?? "DATE(created_at)";

    const [deposits, withdrawals] = await Promise.all([
      db.execute(sql.raw(`
        SELECT ${grp} as period,
               COALESCE(SUM(amount::numeric), 0)::float as total,
               COUNT(*)::int as count
        FROM transactions
        WHERE type = 'deposit' AND status = 'completed'
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY ${grp}
        ORDER BY ${grp}
      `)),
      db.execute(sql.raw(`
        SELECT ${grp} as period,
               COALESCE(SUM(amount::numeric), 0)::float as total,
               COUNT(*)::int as count
        FROM transactions
        WHERE type = 'withdrawal' AND status = 'completed'
          AND created_at >= NOW() - INTERVAL '${interval}'
        GROUP BY ${grp}
        ORDER BY ${grp}
      `)),
    ]);

    // Summary totals
    const summaryResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit'    AND status = 'completed' THEN amount::numeric ELSE 0 END), 0)::float AS total_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN amount::numeric ELSE 0 END), 0)::float AS total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'deposit'    AND status = 'pending'   THEN amount::numeric ELSE 0 END), 0)::float AS pending_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'pending'   THEN amount::numeric ELSE 0 END), 0)::float AS pending_withdrawals,
        COUNT(DISTINCT CASE WHEN type = 'deposit' AND status = 'completed' THEN user_id END)::int AS depositing_users
      FROM transactions
    `);

    const summaryRow = summaryResult.rows?.[0] ?? null;

    res.json({
      period,
      deposits: deposits.rows,
      withdrawals: withdrawals.rows,
      summary: summaryRow,
    });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/analytics/revenue error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** GET /admin/analytics/games */
router.get("/analytics/games", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT
        game_type,
        COUNT(*)::int                                                          AS total_games,
        COUNT(*) FILTER (WHERE won = true)::int                               AS wins,
        COUNT(*) FILTER (WHERE won = false)::int                              AS losses,
        ROUND(COUNT(*) FILTER (WHERE won = true)::numeric / NULLIF(COUNT(*),0) * 100, 2)::float AS win_rate_pct,
        COALESCE(SUM(bet_amount::numeric), 0)::float                          AS total_bets,
        COALESCE(SUM(CASE WHEN won = true THEN win_amount::numeric ELSE 0 END), 0)::float AS total_paid,
        COALESCE(SUM(bet_amount::numeric) - SUM(CASE WHEN won = true THEN win_amount::numeric ELSE 0 END), 0)::float AS house_profit
      FROM game_sessions
      WHERE status = 'completed'
      GROUP BY game_type
      ORDER BY total_bets DESC
    `);

    // Game activity last 7 days
    const daily = await db.execute(sql`
      SELECT
        DATE(created_at) AS day,
        COUNT(*)::int    AS games,
        COALESCE(SUM(bet_amount::numeric), 0)::float AS total_bets
      FROM game_sessions
      WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY day
      ORDER BY day
    `);

    res.json({ gameStats: rows.rows, dailyActivity: daily.rows });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/analytics/games error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** GET /admin/analytics/top-players?type=deposit|bet&limit=10 */
router.get("/analytics/top-players", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const type  = (req.query.type as string) === "bet" ? "bet" : "deposit";
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);

    let rows;
    if (type === "deposit") {
      rows = await db.execute(sql.raw(`
        SELECT
          t.user_id,
          u.username,
          u.first_name,
          u.balance,
          u.vip_level,
          COALESCE(SUM(t.amount::numeric), 0)::float AS total_deposit,
          COUNT(*)::int AS deposit_count
        FROM transactions t
        LEFT JOIN bot_users u ON u.id = t.user_id
        WHERE t.type = 'deposit' AND t.status = 'completed'
        GROUP BY t.user_id, u.username, u.first_name, u.balance, u.vip_level
        ORDER BY total_deposit DESC
        LIMIT ${limit}
      `));
    } else {
      rows = await db.execute(sql.raw(`
        SELECT
          g.user_id,
          u.username,
          u.first_name,
          u.balance,
          u.vip_level,
          COALESCE(SUM(g.bet_amount::numeric), 0)::float AS total_bets,
          COUNT(*)::int AS game_count,
          COUNT(*) FILTER (WHERE g.won = true)::int AS wins
        FROM game_sessions g
        LEFT JOIN bot_users u ON u.id = g.user_id
        WHERE g.status = 'completed'
        GROUP BY g.user_id, u.username, u.first_name, u.balance, u.vip_level
        ORDER BY total_bets DESC
        LIMIT ${limit}
      `));
    }

    res.json({ type, players: rows.rows });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/analytics/top-players error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/**
 * GET /admin/analytics/reconciliation — đối chiếu số dư thực tế (ngân hàng)
 * với số dư hệ thống (tổng balance của tất cả bot_users), và với số dư kỳ
 * vọng tính từ sổ cái giao dịch (nạp - rút + bonus - (cược - thắng)).
 */
router.get("/analytics/reconciliation", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Số dư hệ thống — tổng balance hiện tại của toàn bộ user trong DB
    const systemRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(balance::numeric), 0)::float AS system_balance,
        COUNT(*)::int AS user_count
      FROM bot_users
    `);
    const systemBalance = (systemRow.rows[0] as any)?.system_balance ?? 0;
    const userCount = (systemRow.rows[0] as any)?.user_count ?? 0;

    // 2. Số dư thực tế — lấy trực tiếp từ tài khoản ngân hàng đang kết nối
    let realBalance: number | null = null;
    let bankAccounts: Array<{ number: string; name: string; balance: number; currency: string }> = [];
    let bankError: string | null = null;
    try {
      const bankBalance = await bankService.getBalance();
      if (bankBalance) {
        realBalance = bankBalance.totalBalance;
        bankAccounts = bankBalance.accounts;
      } else {
        bankError = "Không lấy được số dư ngân hàng (chưa đăng nhập hoặc lỗi kết nối)";
      }
    } catch (err: any) {
      bankError = err?.message ?? "Lỗi khi gọi API ngân hàng";
    }

    // 3. Số dư kỳ vọng theo sổ cái — nạp đã duyệt trừ rút đã duyệt trừ (cược thắng ròng của người chơi)
    //    expected = deposits - withdrawals - netPlayerWinnings
    //    (netPlayerWinnings = tổng tiền thắng - tổng tiền cược; số dương nghĩa là nhà cái lỗ ròng cho người chơi)
    const ledgerRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount::numeric) FILTER (WHERE type = 'deposit' AND status = 'completed'), 0)::float AS total_deposits,
        COALESCE(SUM(amount::numeric) FILTER (WHERE type = 'withdrawal' AND status = 'completed'), 0)::float AS total_withdrawals
      FROM transactions
    `);
    const totalDeposits = (ledgerRow.rows[0] as any)?.total_deposits ?? 0;
    const totalWithdrawals = (ledgerRow.rows[0] as any)?.total_withdrawals ?? 0;

    const gameRow = await db.execute(sql`
      SELECT
        COALESCE(SUM(bet_amount::numeric), 0)::float AS total_bets,
        COALESCE(SUM(CASE WHEN won = true THEN win_amount::numeric ELSE 0 END), 0)::float AS total_won
      FROM game_sessions
      WHERE status = 'completed'
    `);
    const totalBets = (gameRow.rows[0] as any)?.total_bets ?? 0;
    const totalWon = (gameRow.rows[0] as any)?.total_won ?? 0;
    const netPlayerGameResult = totalWon - totalBets; // dương = người chơi thắng ròng, âm = nhà cái thắng ròng

    const expectedSystemBalance = totalDeposits - Math.abs(totalWithdrawals) + netPlayerGameResult;

    const ledgerDiscrepancy = systemBalance - expectedSystemBalance;
    const bankDiscrepancy = realBalance !== null ? realBalance - systemBalance : null;

    // Ngưỡng cảnh báo: lệch > 1% hoặc > 500,000đ được coi là bất thường
    const flagThreshold = Math.max(500_000, systemBalance * 0.01);
    const ledgerFlag = Math.abs(ledgerDiscrepancy) > flagThreshold;
    const bankFlag = bankDiscrepancy !== null && Math.abs(bankDiscrepancy) > flagThreshold;

    res.json({
      systemBalance,
      userCount,
      realBankBalance: realBalance,
      bankAccounts,
      bankError,
      ledger: {
        totalDeposits,
        totalWithdrawals: Math.abs(totalWithdrawals),
        totalBets,
        totalWon,
        netPlayerGameResult,
        expectedSystemBalance,
      },
      discrepancy: {
        systemVsLedger: ledgerDiscrepancy,
        systemVsLedgerFlagged: ledgerFlag,
        bankVsSystem: bankDiscrepancy,
        bankVsSystemFlagged: bankFlag,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/analytics/reconciliation error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   FRAUD DETECTION
   ═══════════════════════════════════════════════════════════════════ */

/** GET /admin/fraud/suspicious — accounts with unusual patterns */
router.get("/fraud/suspicious", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Users with very high win rates (> 70% over 10+ games)
    const highWinRate = await db.execute(sql`
      SELECT
        user_id,
        COUNT(*)::int AS total_games,
        COUNT(*) FILTER (WHERE won = true)::int AS wins,
        ROUND(COUNT(*) FILTER (WHERE won = true)::numeric / COUNT(*) * 100, 1)::float AS win_pct,
        COALESCE(SUM(win_amount::numeric) - SUM(bet_amount::numeric), 0)::float AS net_profit
      FROM game_sessions
      WHERE status = 'completed'
      GROUP BY user_id
      HAVING COUNT(*) >= 10
        AND (COUNT(*) FILTER (WHERE won = true)::numeric / COUNT(*)) > 0.70
      ORDER BY win_pct DESC
      LIMIT 20
    `);

    // 2. Users with many rapid deposits (> 5 deposits in 1 hour, possible money laundering)
    const rapidDeposits = await db.execute(sql`
      SELECT
        user_id,
        COUNT(*)::int AS deposit_count,
        COALESCE(SUM(amount::numeric),0)::float AS total_amount,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
      FROM transactions
      WHERE type = 'deposit' AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY user_id
      HAVING COUNT(*) >= 5
      ORDER BY deposit_count DESC
      LIMIT 20
    `);

    // 3. Banned users
    const bannedCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(botUsersTable)
      .where(eq(botUsersTable.isBanned, true));

    // 4. Users with 0 balance but high total wagered (churned whales)
    const churnedWhales = await db.execute(sql`
      SELECT id, username, first_name, balance, total_wagered, vip_level
      FROM bot_users
      WHERE balance::numeric < 1000
        AND total_wagered::numeric > 500000
      ORDER BY total_wagered::numeric DESC
      LIMIT 10
    `);

    res.json({
      highWinRate: highWinRate.rows,
      rapidDeposits: rapidDeposits.rows,
      bannedCount: bannedCount[0]?.count ?? 0,
      churnedWhales: churnedWhales.rows,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err }, "GET /admin/fraud/suspicious error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** GET /admin/fraud/blacklist */
router.get("/fraud/blacklist", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT id, type, value, reason, banned_by, is_active, created_at
      FROM ip_blacklist
      ORDER BY created_at DESC
      LIMIT 200
    `).catch(() => ({ rows: [] })); // table may not exist yet
    res.json({ blacklist: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/fraud/blacklist */
router.post("/fraud/blacklist", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, value, reason } = req.body as { type?: string; value?: string; reason?: string };
    if (!type || !value) { res.status(400).json({ error: "Cần cung cấp type và value" }); return; }
    const allowed = ["ip", "phone", "bank_account", "telegram_id", "user_id"];
    if (!allowed.includes(type)) { res.status(400).json({ error: `type phải là: ${allowed.join(", ")}` }); return; }

    await db.execute(sql`
      INSERT INTO ip_blacklist (type, value, reason, banned_by, is_active)
      VALUES (${type}, ${value}, ${reason ?? null}, 'admin', true)
      ON CONFLICT (type, value) DO UPDATE SET is_active = true, reason = EXCLUDED.reason
    `);

    // If banning a user_id or telegram_id, also ban in bot_users
    if (type === "user_id" || type === "telegram_id") {
      await db
        .update(botUsersTable)
        .set({ isBanned: true, updatedAt: new Date() })
        .where(eq(botUsersTable.id, value));
    }

    logger.info({ type, value, reason }, "🚫 Blacklist entry added");
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "POST /admin/fraud/blacklist error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** DELETE /admin/fraud/blacklist/:id */
router.delete("/fraud/blacklist/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.execute(sql`UPDATE ip_blacklist SET is_active = false WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   PROMOTIONS
   ═══════════════════════════════════════════════════════════════════ */

/** GET /admin/promotions */
router.get("/promotions", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(promotionsTable)
      .orderBy(desc(promotionsTable.createdAt));
    res.json({ promotions: rows });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/promotions */
router.post("/promotions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title, description, type, bonusType, bonusValue,
      minDeposit, maxBonus, wageringMultiplier, maxClaims,
      isActive, startAt, endAt, code,
    } = req.body as Record<string, any>;

    if (!title || !type || !bonusValue) {
      res.status(400).json({ error: "Cần cung cấp title, type, bonusValue" });
      return;
    }

    const validTypes = ["welcome", "deposit_bonus", "cashback", "free_spin", "referral", "vip", "event"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `type phải là: ${validTypes.join(", ")}` });
      return;
    }

    const [promo] = await db.insert(promotionsTable).values({
      title,
      description: description ?? null,
      type,
      bonusType: bonusType ?? "fixed",
      bonusValue: String(bonusValue),
      minDeposit: String(minDeposit ?? "0"),
      maxBonus: maxBonus ? String(maxBonus) : null,
      wageringMultiplier: Number(wageringMultiplier ?? 1),
      maxClaims: maxClaims ? Number(maxClaims) : null,
      isActive: Boolean(isActive ?? true),
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      code: code ?? null,
    }).returning();

    logger.info({ promoId: promo?.id, title, type }, "✅ Promotion created");
    res.status(201).json(promo);
  } catch (err: any) {
    logger.error({ err }, "POST /admin/promotions error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** PUT /admin/promotions/:id */
router.put("/promotions/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

    const allowed = ["title","description","bonusType","bonusValue","minDeposit","maxBonus",
                     "wageringMultiplier","maxClaims","isActive","startAt","endAt","code"];
    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if (updates.startAt) updates.startAt = new Date(updates.startAt);
    if (updates.endAt)   updates.endAt   = new Date(updates.endAt);

    const [updated] = await db
      .update(promotionsTable)
      .set(updates)
      .where(eq(promotionsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Không tìm thấy khuyến mãi" }); return; }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** DELETE /admin/promotions/:id */
router.delete("/promotions/:id", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId);
    if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
    await db.update(promotionsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(promotionsTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/promotions/cashback/run — distribute weekly cashback to all active users */
router.post("/promotions/cashback/run", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get active cashback promotion
    const [cashbackPromo] = await db
      .select()
      .from(promotionsTable)
      .where(and(
        eq(promotionsTable.type, "cashback"),
        eq(promotionsTable.isActive, true),
      ))
      .limit(1);

    if (!cashbackPromo) {
      res.status(404).json({ error: "Không có khuyến mãi cashback nào đang hoạt động" });
      return;
    }

    const ratePercent = parseFloat(cashbackPromo.bonusValue) || 5; // default 5%
    const minBets = parseFloat(cashbackPromo.minDeposit) || 100000; // min 100k bets to qualify

    // Get this week's bets per user
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const weeklyBets = await db.execute(sql`
      SELECT user_id, COALESCE(SUM(bet_amount::numeric), 0)::float AS total_bets
      FROM game_sessions
      WHERE status = 'completed' AND created_at >= ${weekStart.toISOString()}
      GROUP BY user_id
      HAVING SUM(bet_amount::numeric) >= ${minBets}
    `);

    let distributed = 0;
    let totalAmount = 0;

    for (const row of weeklyBets.rows as Array<{ user_id: string; total_bets: number }>) {
      const cashback = Math.floor(row.total_bets * ratePercent / 100);
      if (cashback < 1000) continue; // minimum 1,000đ cashback

      // Atomic credit balance
      await db
        .update(botUsersTable)
        .set({
          balance: sql`(balance::numeric + ${cashback})::text`,
          updatedAt: new Date(),
        })
        .where(eq(botUsersTable.id, row.user_id));

      await db.insert(transactionsTable).values({
        userId: row.user_id,
        type: "deposit",
        amount: String(cashback),
        status: "completed",
        method: "cashback",
        metadata: { promotionId: cashbackPromo.id, weekStart: weekStart.toISOString(), bets: row.total_bets },
      });

      distributed++;
      totalAmount += cashback;

      // Notify via Telegram
      try {
        const { telegramBotService } = await import("../telegram/telegramBot.js");
        await telegramBotService.sendNotification(
          row.user_id,
          `🎁 <b>Cashback tuần này của bạn!</b>\n\n` +
          `💰 Hoàn tiền: <b>${cashback.toLocaleString("vi-VN")}đ</b>\n` +
          `📊 Tổng cược: ${row.total_bets.toLocaleString("vi-VN")}đ\n` +
          `📈 Tỷ lệ hoàn: ${ratePercent}%\n\n` +
          `Số tiền đã được cộng vào tài khoản của bạn! 🎉`
        );
      } catch { /* ignore */ }
    }

    logger.info({ distributed, totalAmount, ratePercent }, "💸 Cashback distribution complete");
    res.json({ success: true, distributed, totalAmount, ratePercent });
  } catch (err: any) {
    logger.error({ err }, "POST /admin/promotions/cashback/run error");
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

/** POST /admin/promotions/welcome-bonus/setup — configure welcome bonus */
router.get("/promotions/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [total, active] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(promotionsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(promotionsTable).where(eq(promotionsTable.isActive, true)),
    ]);
    const claims = await db.execute(sql`
      SELECT promo.type, COUNT(pc.id)::int AS claims, COALESCE(SUM(pc.bonus_amount::numeric),0)::float AS total_bonus
      FROM promotion_claims pc
      JOIN promotions promo ON promo.id = pc.promotion_id
      GROUP BY promo.type
      ORDER BY total_bonus DESC
    `).catch(() => ({ rows: [] }));

    res.json({
      totalPromotions: total[0]?.count ?? 0,
      activePromotions: active[0]?.count ?? 0,
      claimsByType: claims.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

export default router;
