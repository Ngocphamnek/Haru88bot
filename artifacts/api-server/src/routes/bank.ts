import { Router, type Request, type Response } from "express";
import { db, pool, bankTransactionsTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../lib/storage.js";
import { logger } from "../lib/logger.js";
import { getSetting } from "../lib/settings.js";
import { bankService } from "../telegram/bankService.js";
import { balanceSyncService } from "../lib/balanceSyncService.js";
import { requireAdmin } from "../lib/security.js";

const router = Router();


// Admin auth for all bank routes except inbound webhook (uses its own secret)
router.use((req, res, next) => {
  if (req.path === "/webhook" || req.path === "/bank/webhook") return next();
  return requireAdmin(req, res, next);
});

// ── MB Bank status ────────────────────────────────────────────────────────────
router.get("/status", (_req: Request, res: Response) => {
  const info = bankService.getAccountInfo();
  res.json({
    success: true,
    loggedIn: info.isLoggedIn,
    running: info.isPolling,
    accountNumber: info.accountNumber || null,
    accountHolder: info.accountHolder || null,
  });
});

// ── MB Bank accounts (lấy từ external API) ────────────────────────────────────
router.get("/accounts", async (_req: Request, res: Response) => {
  try {
    const configuredUrl = await getSetting("bank_api_url");
    const raw = (configuredUrl || "https://nganhangnay.onrender.com").replace(/\/+$/, "");
    const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;

    const balResp = await fetch(`${apiBase}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!balResp.ok) {
      res.json({ success: false, message: `Bank API trả về ${balResp.status}` });
      return;
    }

    const balData = await balResp.json() as {
      success: boolean;
      data?: { accounts?: Array<{ number: string; name: string; balance?: number; currency?: string }> };
      message?: string;
    };

    if (!balData.success || !balData.data?.accounts) {
      res.json({ success: false, message: balData.message || "Không lấy được tài khoản — chưa đăng nhập?" });
      return;
    }

    const accounts = balData.data.accounts.map(a => ({
      accountNumber: a.number,
      accountName: a.name,
      balance: a.balance != null ? Number(a.balance) : null,
      currency: a.currency || "VND",
    }));

    res.json({ success: true, data: accounts, totalBalance: accounts.reduce((s, a) => s + (a.balance ?? 0), 0) });
  } catch (err: any) {
    res.json({ success: false, message: `Lỗi kết nối Bank API: ${err.message}` });
  }
});

interface WebhookPayload {
  status?: string;          // "success" | "expired" (from CoreBank)
  code?: string;            // HARU88XXXXXX (present on expired / matched)
  creditAmount?: number | string;
  amount?: number | string; // also used for "expired" amount
  description?: string;
  refNo?: string;
  transactionDate?: string;
  beneficiaryName?: string;
  beneficiaryBank?: string;
}

router.post("/bank/webhook", async (req: Request, res: Response): Promise<void> => {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret =
    (await getSetting("bank_webhook_secret")) ||
    process.env.BANK_WEBHOOK_SECRET ||
    "";
  if (!secret) {
    // Fail closed: webhook must be configured
    res.status(503).json({ error: "Webhook secret not configured" });
    return;
  }
  const provided =
    (req.headers["x-webhook-secret"] as string) ??
    (req.query["secret"] as string) ??
    "";
  // timing-safe compare
  const { timingSafeStringEqual } = await import("../lib/security.js");
  if (!provided || !timingSafeStringEqual(String(provided), String(secret))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const data = req.body as WebhookPayload;
  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  // ── Handle expired notification ───────────────────────────────────────────
  if (data.status === "expired" && data.code) {
    const code = data.code;
    req.log.info({ code }, "⏰ Deposit code expired — notifying user");

    // Try in-memory first, fall back to DB (handles server-restart scenarios)
    let pending = bankService.getAndRemovePendingCode(code);
    if (!pending) {
      const dbPending = await bankService.findPendingCodeInDB(code);
      if (dbPending) pending = { userId: dbPending.userId, amount: dbPending.amount, createdAt: new Date() };
    }

    // Mark the pending transaction as cancelled in DB regardless
    await bankService.cancelPendingDepositInDB(code);

    if (pending) {
      try {
        const { telegramBotService } = await import("../telegram/telegramBot.js");
        await telegramBotService.sendNotification(
          pending.userId,
          `⏰ <b>Yêu cầu nạp tiền đã hết hạn!</b>\n\n` +
          `Mã: <code>${code}</code>\n` +
          `Số tiền: <b>${pending.amount.toLocaleString("vi-VN")}đ</b>\n\n` +
          `❌ Đã hết 5 phút mà chưa nhận được giao dịch.\n` +
          `Vui lòng tạo yêu cầu nạp tiền mới nếu bạn muốn nạp.`
        );
      } catch (err) {
        logger.error({ err }, "Failed to notify user of expired deposit");
      }
    } else {
      req.log.warn({ code }, "Expired code not found in memory or DB — cannot notify user");
    }

    res.json({ ok: true, handled: "expired" });
    return;
  }

  // ── Handle success / incoming transaction ────────────────────────────────
  const creditAmount = Number(data.creditAmount ?? data.amount ?? 0);
  if (creditAmount <= 0) {
    res.json({ ok: true, skipped: "no credit amount" });
    return;
  }

  const description = data.description ?? "";
  const refNo =
    data.refNo ||
    `${data.transactionDate ?? "nodate"}_${creditAmount}_${description.slice(0, 20)}`;

  req.log.info({ refNo, creditAmount, description, status: data.status }, "📥 Bank webhook received");

  // ── Dedup ─────────────────────────────────────────────────────────────────
  const [existing] = await db
    .select()
    .from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.refNo, refNo))
    .limit(1);

  if (existing?.processed) {
    req.log.info({ refNo }, "⏭ Already processed — skipping");
    res.json({ ok: true, skipped: "already processed" });
    return;
  }

  // ── Resolve user from code or legacy pattern ──────────────────────────────
  let resolvedUserId: string | null = null;
  let amountVerified = true;
  let isBonus125Code = false; // true = giao dịch nạp 125% khuyến mãi

  if (data.status === "success" && data.code) {
    // CoreBank confirmed match — code AND amount already verified by CoreBank
    isBonus125Code = data.code.toUpperCase().startsWith("125H88");
    // Try in-memory Map first, fall back to DB if bot was restarted
    const memPending = bankService.getAndRemovePendingCode(data.code);
    if (memPending) {
      resolvedUserId = memPending.userId;
    } else {
      // In-memory lost (restart) — look up from DB
      const dbPending = await bankService.findPendingCodeInDB(data.code);
      if (dbPending) {
        resolvedUserId = dbPending.userId;
        req.log.info({ code: data.code, userId: resolvedUserId }, "🔄 Recovered userId from DB after restart");
      } else {
        req.log.warn({ code: data.code }, "Code not in memory or DB — may be duplicate callback");
      }
    }
  }

  if (!resolvedUserId) {
    // Try matchAndConsumeCode (for direct CoreBank generic webhook without status field)
    const match = bankService.matchAndConsumeCode(description, creditAmount);
    if (match) {
      isBonus125Code = match.isBonus125;
      if (!match.amountMatches) {
        req.log.warn({ code: match.code, expected: match.expectedAmount, got: creditAmount }, "❌ Amount mismatch");
        if (!existing) {
          await db.insert(bankTransactionsTable).values({
            refNo, userId: match.userId, amount: String(creditAmount),
            description, transactionDate: data.transactionDate ?? "", processed: false,
          }).onConflictDoNothing();
        }
        try {
          const { telegramBotService } = await import("../telegram/telegramBot.js");
          await telegramBotService.sendNotification(
            match.userId,
            `⚠️ <b>Nạp tiền không khớp số tiền!</b>\n\n` +
            `Mã: <code>${match.code}</code>\n` +
            `Số tiền yêu cầu: <b>${match.expectedAmount.toLocaleString("vi-VN")}đ</b>\n` +
            `Số tiền nhận được: <b>${creditAmount.toLocaleString("vi-VN")}đ</b>\n\n` +
            `❌ Chưa được cộng do sai số tiền. Vui lòng liên hệ admin.`
          );
        } catch { /* non-critical */ }
        res.json({ ok: true, skipped: "amount_mismatch" });
        return;
      }
      resolvedUserId = match.userId;
    }
  }

  if (!resolvedUserId) {
    // Legacy fallback: "NAP {userId}" pattern
    const napMatch = description.toUpperCase().match(/NAP\s*(\d{5,12})/);
    if (napMatch) { resolvedUserId = napMatch[1]!; amountVerified = false; }
  }

  // ── Insert raw record ─────────────────────────────────────────────────────
  if (!existing) {
    await db.insert(bankTransactionsTable).values({
      refNo, userId: resolvedUserId, amount: String(creditAmount),
      description, transactionDate: data.transactionDate ?? "", processed: false,
    }).onConflictDoNothing();
  }

  if (!resolvedUserId) {
    req.log.warn({ refNo, description }, "⚠️ No matching user — manual review needed");
    res.json({ ok: true, skipped: "no_user_id" });
    return;
  }

  // ── Atomic Credit (DB transaction — eliminates race condition) ───────────
  // Uses SELECT FOR UPDATE to serialize concurrent webhooks for the same refNo.
  // Only ONE request will credit; the other sees processed=true and skips.
  const client = await pool.connect();
  let newBalance = "0";
  try {
    await client.query("BEGIN");

    // Exclusive row lock: serializes concurrent webhooks with identical refNo.
    // The row must exist at this point (inserted above with onConflictDoNothing).
    const lockResult = await client.query<{ processed: boolean }>(
      `SELECT processed FROM bank_transactions WHERE ref_no = $1 FOR UPDATE`,
      [refNo]
    );
    if (!lockResult.rows.length) {
      // Row is missing — cannot safely proceed without dedup guarantee
      await client.query("ROLLBACK");
      req.log.error({ refNo }, "❌ bank_transactions row missing during lock — aborting credit");
      res.status(500).json({ error: "Lỗi dedup — thử lại sau" });
      return;
    }
    if (lockResult.rows[0]?.processed) {
      await client.query("ROLLBACK");
      req.log.info({ refNo }, "⏭ Already processed (exclusive lock) — skipping");
      res.json({ ok: true, skipped: "already_processed" });
      return;
    }

    // Verify user exists
    const userCheck = await client.query(`SELECT id FROM bot_users WHERE id = $1`, [resolvedUserId]);
    if (!userCheck.rows.length) {
      await client.query("ROLLBACK");
      req.log.warn({ refNo, resolvedUserId }, "⚠️ User not found in DB");
      res.json({ ok: true, skipped: "user_not_found" });
      return;
    }

    // Atomic balance credit — single SQL, no read-modify-write
    const creditResult = await client.query<{ balance: string }>(
      `UPDATE bot_users
       SET balance    = ROUND(CAST(balance AS NUMERIC) + $1, 2)::TEXT,
           updated_at = NOW()
       WHERE id = $2
       RETURNING balance`,
      [creditAmount, resolvedUserId]
    );
    newBalance = creditResult.rows[0]?.balance ?? "0";

    // Transaction log
    await client.query(
      `INSERT INTO transactions (user_id, type, amount, status, method, metadata)
       VALUES ($1, 'deposit', $2, 'completed', 'bank', $3::jsonb)`,
      [resolvedUserId, String(creditAmount), JSON.stringify({
        refNo, description, transactionDate: data.transactionDate,
        beneficiaryName: data.beneficiaryName, source: "webhook", amountVerified,
      })]
    );

    // Mark bank_transaction as processed
    await client.query(
      `UPDATE bank_transactions SET processed = true, processed_at = NOW(), user_id = $1 WHERE ref_no = $2`,
      [resolvedUserId, refNo]
    );

    // Close matching pending deposit transaction (non-critical)
    if (data.code) {
      await client.query(
        `UPDATE transactions SET status = 'completed'
         WHERE status = 'pending' AND method = 'bank'
           AND metadata->>'paymentCode' = $1`,
        [data.code]
      ).catch((cleanupErr) => {
        logger.warn({ cleanupErr, code: data.code }, "Could not close original pending transaction");
      });
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    req.log.error({ err, refNo }, "❌ DB transaction failed during deposit credit");
    res.status(500).json({ error: "Lỗi xử lý giao dịch" });
    return;
  } finally {
    client.release();
  }

  // Push balance to SSE clients & invalidate Redis cache
  balanceSyncService.push(resolvedUserId, newBalance);
  try {
    const { invalidateUserCache } = await import("../lib/cache.js");
    await invalidateUserCache(resolvedUserId);
  } catch { /* ignore */ }

  req.log.info({ refNo, userId: resolvedUserId, creditAmount, newBalance, isBonus125Code }, "✅ Webhook deposit credited");

  // Áp dụng bonus 125% nếu đây là giao dịch khuyến mãi
  if (isBonus125Code) {
    try {
      const bonusResult = await storage.applyBonus125Deposit(resolvedUserId, creditAmount);
      if (bonusResult.ok) {
        req.log.info({ refNo, userId: resolvedUserId, bonusAmount: bonusResult.bonusAmount, wageringRequired: bonusResult.wageringRequired }, "🎁 125% bonus applied");
        try {
          const { telegramBotService } = await import("../telegram/telegramBot.js");
          await telegramBotService.sendNotification(
            resolvedUserId,
            `🎉 <b>THƯỞNG NẠP 125% ĐÃ ĐƯỢC CẤP!</b>\n\n` +
            `💰 Số tiền nạp: <b>${creditAmount.toLocaleString("vi-VN")}đ</b>\n` +
            `🎁 Bonus thêm: <b>+${bonusResult.bonusAmount.toLocaleString("vi-VN")}đ</b>\n` +
            `💳 Số dư hiện tại: <b>${Math.floor(parseFloat(bonusResult.newBalance)).toLocaleString("vi-VN")}đ</b>\n\n` +
            `⚠️ <b>Điều kiện rút tiền:</b>\n` +
            `Cần cược đủ: <b>${bonusResult.wageringRequired.toLocaleString("vi-VN")}đ</b>\n` +
            `<i>(Gốc × 2 + Thưởng × 4)</i>`
          );
        } catch { /* ignore */ }
      }
    } catch (bonusErr) {
      logger.error({ bonusErr, refNo }, "⚠️ Failed to apply 125% bonus (deposit credited normally)");
    }
  }

  try {
    const { telegramBotService } = await import("../telegram/telegramBot.js");
    await telegramBotService.notifyPaymentSuccess(resolvedUserId, creditAmount, refNo);
  } catch (err) {
    logger.error({ err }, "Failed to notify user of deposit");
  }

  res.json({ ok: true, credited: creditAmount, userId: resolvedUserId, newBalance, isBonus125: isBonus125Code });
});

export default router;
