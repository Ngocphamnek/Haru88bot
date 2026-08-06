import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc, sql, ilike, or, gte, lt, and } from "drizzle-orm";
import { db, botUsersTable, transactionsTable, giftCodesTable, botSettingsTable, gameSessionsTable, supportRequestsTable } from "@workspace/db";
import {
  AdminLoginBody,
  AdminLoginResponse,
  GetAdminStatsResponse,
  GetAdminSettingsResponse,
  SaveAdminSettingsBody,
  SaveAdminSettingsResponse,
  GetAdminUsersResponse,
  AdjustUserBalanceParams,
  AdjustUserBalanceBody,
  AdjustUserBalanceResponse,
  BanUserParams,
  BanUserBody,
  BanUserResponse,
  GetAdminTransactionsQueryParams,
  GetAdminTransactionsResponse,
  GetGiftCodesResponse,
  CreateGiftCodeBody,
  DeactivateGiftCodeParams,
  DeactivateGiftCodeResponse,
  GetWithdrawalsQueryParams,
  GetRevenueAnalyticsQueryParams,
  GetTopPlayersQueryParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { telegramBotService } from "../telegram/telegramBot";
import { telegramBot2Service } from "../telegram/telegramBot2";
import { supportBotService } from "../telegram/supportBot";
import { bankService } from "../telegram/bankService";
import { hdBankService } from "../telegram/hdBankService";
import { msbService } from "../telegram/msbService";
import { techcombankService } from "../telegram/techcombankService";
import { getCredential, setCredentials as setBankCreds } from "../lib/bankCredStore";
import { getSetting } from "../lib/settings";
import { runMaintenance } from "../lib/maintenance";
import {
  ADMIN_TOKEN,
  requireAdmin,
  timingSafeStringEqual,
  hashTokenFingerprint,
  issueAdminSession,
} from "../lib/security.js";
import { writeAuditLog } from "../lib/audit.js";

const router: IRouter = Router();

// Re-export for routes that import requireAdmin from ./admin
export { requireAdmin, ADMIN_TOKEN };

// Log fingerprint only — never the raw token
process.nextTick(() => {
  logger.info(
    { adminTokenFp: hashTokenFingerprint(ADMIN_TOKEN) },
    process.env.ADMIN_TOKEN
      ? "Admin auth enabled (ADMIN_TOKEN from env)"
      : "Admin auth enabled (ADMIN_TOKEN auto-generated — set env for stability)",
  );
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Thiếu thông tin đăng nhập" });
    return;
  }

  const { username, password } = parsed.data;

  // Credentials loaded from DB (set via Settings) → fallback to env vars → no hardcoded defaults
  const configuredUsername = (await getSetting("admin_username")) || process.env["ADMIN_USERNAME"] || "";
  const configuredPassword = (await getSetting("admin_password")) || process.env["ADMIN_PASSWORD"] || "";

  if (!configuredUsername || !configuredPassword) {
    logger.warn("⚠️ Admin credentials not configured — set ADMIN_USERNAME & ADMIN_PASSWORD env vars or configure via Settings");
    res.status(503).json({ success: false, error: "Chưa cấu hình tài khoản admin. Vui lòng set biến môi trường ADMIN_USERNAME và ADMIN_PASSWORD." });
    return;
  }

  const userOk = timingSafeStringEqual(username, configuredUsername);
  const passOk = timingSafeStringEqual(password, configuredPassword);
  if (!userOk || !passOk) {
    logger.warn({ username }, "Admin login failed — wrong credentials");
    res.status(401).json({ success: false, error: "Sai tài khoản hoặc mật khẩu" });
    return;
  }

  // Short-lived admin session JWT (preferred). Static ADMIN_TOKEN still works for API automation.
  const sessionToken = issueAdminSession(username);
  try {
    await writeAuditLog({
      actorId: username,
      action: "admin.login",
      targetType: "admin",
      targetId: username,
      req,
      newValue: { authMode: "session" },
    });
  } catch { /* ignore */ }

  const result = AdminLoginResponse.parse({ success: true, token: sessionToken });
  res.json(result);
});

router.post("/logout", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const jti = (req as any).adminJti as string | undefined;
    const token = (req as any).adminTokenRaw as string | undefined;
    if (jti) {
      const { revokeAdminJti } = await import("../lib/adminSessionStore.js");
      // decode exp from session if possible
      const { verifyAdminSession } = await import("../lib/security.js");
      const sess = token ? verifyAdminSession(token) : null;
      await revokeAdminJti(jti, sess?.exp ?? Math.floor(Date.now() / 1000) + 3600);
    }
    await writeAuditLog({
      actorId: (req as any).adminUser || "admin",
      action: "admin.logout",
      req,
    });
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "admin logout error");
    res.status(500).json({ success: false, error: "Logout failed" });
  }
});


router.get("/stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const [usersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(botUsersTable);
  const [depositSum] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "deposit"));
  const [withdrawSum] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "withdraw"));
  const [betSum] = await db
    .select({ total: sql<number>`coalesce(sum(bet_amount::numeric), 0)::float` })
    .from(gameSessionsTable);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [activeToday] = await db
    .select({ count: sql<number>`count(distinct user_id)::int` })
    .from(gameSessionsTable)
    .where(sql`created_at >= ${today.toISOString()}`);

  const stats = GetAdminStatsResponse.parse({
    totalUsers: usersCount?.count ?? 0,
    totalDeposits: depositSum?.total ?? 0,
    totalWithdrawals: withdrawSum?.total ?? 0,
    totalBets: betSum?.total ?? 0,
    activeToday: activeToday?.count ?? 0,
  });
  res.json(stats);
});

router.get("/settings", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(botSettingsTable).orderBy(botSettingsTable.key);
  const result = GetAdminSettingsResponse.parse(rows.map((r) => ({ key: r.key, value: r.value })));
  res.json(result);
});

// Validate a Telegram bot token by calling getMe — returns bot username or throws with message
async function validateBotToken(token: string): Promise<string> {
  const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const body = await resp.json() as { ok: boolean; result?: { username?: string }; description?: string };
  if (!resp.ok || !body.ok) {
    throw new Error(body.description ?? `HTTP ${resp.status}`);
  }
  return body.result?.username ?? "unknown";
}

router.post("/settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = SaveAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const savedKeys = parsed.data.settings.map((s: { key: string; value: string }) => s.key);
  const getValue = (k: string) => parsed.data.settings.find((s: { key: string; value: string }) => s.key === k)?.value ?? "";

  // --- Save to DB immediately (no pre-validation — bot will report errors on startup) ---
  for (const { key, value } of parsed.data.settings) {
    await db
      .insert(botSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: botSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  logger.info({ count: parsed.data.settings.length }, "Admin settings saved");

  // Respond immediately — bot restarts run in background so the UI doesn't hang
  res.json(SaveAdminSettingsResponse.parse({ success: true }));

  // Auto-restart bots / services with new values (fire-and-forget, non-blocking)
  setImmediate(async () => {
    if (savedKeys.includes("bot_token")) {
      const token = getValue("bot_token");
      if (token) {
        try {
          await telegramBotService.stop();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await telegramBotService.initialize(token);
          logger.info("✅ Telegram bot restarted with new token");
        } catch (err) {
          logger.error({ err }, "❌ Failed to restart Telegram bot");
        }
      }
    }
    if (savedKeys.includes("bot2_token")) {
      const token = getValue("bot2_token");
      if (token) {
        try {
          await telegramBot2Service.initialize(token);
          logger.info("✅ Bot2 restarted with new token");
        } catch (err) {
          logger.error({ err }, "❌ Failed to restart Bot2");
        }
      }
    }
    if (savedKeys.includes("support_bot_token")) {
      const token = getValue("support_bot_token");
      if (token) {
        try {
          await supportBotService.stop();
          await new Promise(resolve => setTimeout(resolve, 2000));
          await supportBotService.initialize(token);
          logger.info("✅ Support bot (Bot3) restarted with new token");
        } catch (err) {
          logger.error({ err }, "❌ Failed to restart Support bot");
        }
      }
    }
    if (savedKeys.includes("bank_account_number") || savedKeys.includes("bank_name") || savedKeys.includes("bank_account_holder")) {
      try {
        await bankService.loadAccountInfoFromSettings();
        logger.info("✅ Bank account info reloaded");
      } catch (err) {
        logger.warn({ err }, "⚠️ Failed to reload bank account info");
      }
    }
    // Restart bank polling whenever credentials change
    if (savedKeys.includes("bank_username") || savedKeys.includes("bank_password") || savedKeys.includes("bank_api_url")) {
      const newUser = getValue("bank_username") || await getSetting("bank_username");
      const newPass = getValue("bank_password") || await getSetting("bank_password");
      if (newUser && newPass) {
        try {
          await bankService.restart();
          logger.info("✅ Bank service restarted with new credentials");
        } catch (err) {
          logger.warn({ err }, "⚠️ Failed to restart bank service");
        }
      }
    }
    // Restart HD Bank service when credentials change
    if (
      savedKeys.includes("hdbank_username") ||
      savedKeys.includes("hdbank_password") ||
      savedKeys.includes("hdbank_account_number")
    ) {
      try {
        await hdBankService.restart();
        logger.info("✅ HD Bank service restarted with new credentials");
      } catch (err) {
        logger.warn({ err }, "⚠️ Failed to restart HD Bank service");
      }
    }
    // Sync MSB / TCB credentials from settings into bankCredStore
    const bankCredKeys = ["msb_username", "msb_password", "msb_account_number",
                          "tcb_username", "tcb_password", "tcb_account_number"];
    const bankCredUpdates: Record<string, string> = {};
    for (const key of bankCredKeys) {
      if (savedKeys.includes(key)) {
        const val = getValue(key);
        if (val) bankCredUpdates[key] = val;
      }
    }
    if (Object.keys(bankCredUpdates).length > 0) {
      setBankCreds(bankCredUpdates);
      logger.info({ keys: Object.keys(bankCredUpdates) }, "✅ Bank credentials synced to bankCredStore");
    }

    // Nếu cấu hình deposit_banks thay đổi → log để biết
    if (savedKeys.includes("deposit_banks")) {
      logger.info("✅ deposit_banks config updated");
    }

    // MoMo / ZaloPay settings — chỉ cần lưu vào DB là xong (getSetting() sẽ đọc ra)
    const walletKeys = ["momo_phone", "momo_name", "momo_enabled",
                        "zalopay_phone", "zalopay_name", "zalopay_enabled"];
    const walletUpdated = walletKeys.filter(k => savedKeys.includes(k));
    if (walletUpdated.length > 0) {
      logger.info({ keys: walletUpdated }, "✅ MoMo/ZaloPay settings updated");
    }
  });
});

// ── MoMo & ZaloPay wallet settings ────────────────────────────────────────────
router.get("/wallet-settings", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const keys = [
    "momo_phone", "momo_name", "momo_enabled",
    "zalopay_phone", "zalopay_name", "zalopay_enabled",
    "deposit_banks",
  ];
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = await getSetting(key);
  }
  res.json(result);
});

router.post("/wallet-settings", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const allowed = [
    "momo_phone", "momo_name", "momo_enabled",
    "zalopay_phone", "zalopay_name", "zalopay_enabled",
    "deposit_banks",
  ];
  const body = req.body as Record<string, string>;
  let saved = 0;
  for (const key of allowed) {
    if (key in body) {
      const value = body[key] ?? "";
      await db
        .insert(botSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: botSettingsTable.key, set: { value, updatedAt: new Date() } });
      saved++;
    }
  }
  logger.info({ saved }, "✅ wallet-settings saved");
  res.json({ success: true, saved });
});

// ── Bank overview — all configured accounts + monitor status ─────────────────
router.get("/bank-overview", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const bankName        = await getSetting("bank_name");
    const bankCode        = await getSetting("bank_code");
    const bankAccNumber   = await getSetting("bank_account_number");
    const bankAccHolder   = await getSetting("bank_account_holder");
    const hdbankUsername  = await getSetting("hdbank_username");
    const hdbankAccNumber = await getSetting("hdbank_account_number");

    const msbStatus  = msbService.getStatus();
    const tcbStatus  = techcombankService.getStatus();
    const hdbStatus  = hdBankService.getStatus();

    const msbAccNumber  = getCredential("msb_account_number");
    const msbUsername   = getCredential("msb_username");
    const tcbAccNumber  = getCredential("tcb_account_number");
    const tcbUsername   = getCredential("tcb_username");

    // Fetch live accounts from bank sessions when logged in
    let msbLiveAccounts: Array<{ accountNumber: string; accountName: string; currency: string; balance: number | null }> = [];
    let tcbLiveAccounts: Array<{ accountNumber: string; accountName: string; currency: string; balance: number }> = [];
    if (msbStatus.loggedIn) {
      try { msbLiveAccounts = await msbService.fetchAccounts(); } catch {}
    }
    if (tcbStatus.loggedIn) {
      try { tcbLiveAccounts = await techcombankService.getAccounts(); } catch {}
    }

    const accounts: any[] = [];

    if (bankAccNumber) {
      accounts.push({
        id: "bank",
        bank: bankName || "Ngân hàng chính",
        code: bankCode || "",
        accountNumber: bankAccNumber,
        accountHolder: bankAccHolder || "",
        liveAccounts: [],
        type: "webhook",
        loggedIn: true,
        monitorRunning: false,
        monitorAvailable: false,
      });
    }

    if (msbAccNumber || msbUsername) {
      accounts.push({
        id: "msb",
        bank: "MSB",
        code: "MSB",
        accountNumber: msbLiveAccounts[0]?.accountNumber ?? msbAccNumber ?? null,
        username: msbUsername || null,
        liveAccounts: msbLiveAccounts,
        type: "direct",
        loggedIn: msbStatus.loggedIn,
        monitorRunning: msbStatus.running,
        monitorAvailable: true,
      });
    }

    if (tcbAccNumber || tcbUsername) {
      accounts.push({
        id: "tcb",
        bank: "Techcombank",
        code: "TCB",
        accountNumber: tcbLiveAccounts[0]?.accountNumber ?? tcbAccNumber ?? null,
        username: tcbUsername || null,
        liveAccounts: tcbLiveAccounts,
        type: "direct",
        loggedIn: tcbStatus.loggedIn,
        monitorRunning: tcbStatus.running,
        monitorAvailable: true,
      });
    }

    if (hdbankAccNumber || hdbankUsername) {
      accounts.push({
        id: "hdbank",
        bank: "HDBank",
        code: "HDB",
        accountNumber: hdbankAccNumber || null,
        username: hdbankUsername || null,
        liveAccounts: [],
        type: "direct",
        loggedIn: hdbStatus.loggedIn,
        monitorRunning: hdbStatus.running,
        monitorAvailable: true,
      });
    }

    res.json({ success: true, accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/users", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  let query = db.select().from(botUsersTable).orderBy(desc(botUsersTable.createdAt)).$dynamic();
  if (search) {
    query = query.where(
      or(
        ilike(botUsersTable.id, `%${search}%`),
        ilike(botUsersTable.username, `%${search}%`),
        ilike(botUsersTable.firstName, `%${search}%`)
      )
    );
  }
  const users = await query.limit(500);
  const result = GetAdminUsersResponse.parse({
    users: users.map((u) => ({
      id: u.id,
      username: u.username ?? null,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      balance: u.balance,
      totalWagered: u.totalWagered,
      totalGames: u.totalGames ?? 0,
      vipLevel: u.vipLevel ?? null,
      commission: u.commission ?? "0",
      referralCode: u.referralCode ?? null,
      referredBy: u.referredBy ?? null,
      referralCount: u.referralCount ?? 0,
      referralEarnings: u.referralEarnings ?? "0",
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
    total: users.length,
  });
  res.json(result);
});

router.post("/users/:userId/ban", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const params = BanUserParams.safeParse({ userId: req.params.userId });
  if (!params.success) { res.status(400).json({ error: "Invalid userId" }); return; }
  const body = BanUserBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [updated] = await db
    .update(botUsersTable)
    .set({ isBanned: body.data.banned, updatedAt: new Date() })
    .where(eq(botUsersTable.id, params.data.userId))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  logger.info({ userId: params.data.userId, banned: body.data.banned }, "Admin ban/unban user");
  res.json(BanUserResponse.parse({ success: true, message: body.data.banned ? "Đã ban người dùng" : "Đã gỡ ban người dùng" }));
});

router.post("/users/:userId/balance", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const rawUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const params = AdjustUserBalanceParams.safeParse({ userId: rawUserId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = AdjustUserBalanceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const amount = Number(body.data.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    res.status(400).json({ error: "Số tiền không hợp lệ" });
    return;
  }
  if (Math.abs(amount) > 100_000_000) {
    res.status(400).json({ error: "Vượt giới hạn điều chỉnh admin" });
    return;
  }

  const { applyBalanceDelta } = await import("../lib/ledger.js");
  const actor = (req as any).adminUser || "admin";
  const result = await applyBalanceDelta({
    userId: params.data.userId,
    delta: amount,
    type: amount > 0 ? "admin_add" : "admin_deduct",
    externalId: `admin-adjust:${params.data.userId}:${Date.now()}:${amount}`,
    method: "admin",
    metadata: { reason: body.data.note, by: actor },
    clampZero: true,
    rejectIfInsufficient: amount < 0,
  });
  if (!result.ok) {
    const status = result.reason === "user_not_found" ? 404 : 400;
    res.status(status).json({ error: result.reason || "Cập nhật thất bại", message: result.reason });
    return;
  }
  await writeAuditLog({
    actorId: actor,
    action: "admin.balance_adjust",
    targetType: "bot_user",
    targetId: params.data.userId,
    oldValue: { balance: result.previousBalance },
    newValue: { balance: result.newBalance, delta: amount, note: body.data.note },
    req,
  });
  logger.info({ userId: params.data.userId, amount, newBalance: result.newBalance, actor }, "Admin balance adjustment");
  res.json(AdjustUserBalanceResponse.parse({ success: true, newBalance: result.newBalance, message: `Số dư mới: ${result.newBalance}` }));
});

router.get("/transactions", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const qp = GetAdminTransactionsQueryParams.safeParse(req.query);
  const limit = qp.success ? (qp.data.limit ?? 50) : 50;
  const page = qp.success ? (qp.data.page ?? 1) : 1;
  const offset = (page - 1) * limit;
  const typeFilter = qp.success ? qp.data.type : undefined;

  let baseQuery = db.select().from(transactionsTable).orderBy(desc(transactionsTable.createdAt)).$dynamic();
  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(transactionsTable).$dynamic();
  if (typeFilter) {
    baseQuery = baseQuery.where(eq(transactionsTable.type, typeFilter));
    countQuery = countQuery.where(eq(transactionsTable.type, typeFilter));
  }
  const [rows, [countRow]] = await Promise.all([
    baseQuery.limit(limit).offset(offset),
    countQuery,
  ]);
  const result = GetAdminTransactionsResponse.parse({
    total: countRow?.count ?? 0,
    transactions: rows.map((t) => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      status: t.status,
      method: t.method ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  });
  res.json(result);
});

router.get("/gift-codes", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const codes = await db.select().from(giftCodesTable).orderBy(desc(giftCodesTable.createdAt));
  const result = GetGiftCodesResponse.parse(
    codes.map((c) => ({
      id: c.id,
      code: c.code,
      amount: c.amount,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    }))
  );
  res.json(result);
});

router.post("/gift-codes/:id/deactivate", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const params = DeactivateGiftCodeParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [updated] = await db
    .update(giftCodesTable)
    .set({ isActive: false })
    .where(eq(giftCodesTable.id, params.data.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Gift code not found" }); return; }
  logger.info({ id: params.data.id }, "Admin deactivated gift code");
  res.json(DeactivateGiftCodeResponse.parse({ success: true }));
});

// ── Bot2 Gift Broadcast: restart scheduler (apply toggle immediately) ────────
router.post("/gift-broadcast/restart", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    if (telegramBot2Service.isActive()) {
      await telegramBot2Service.restartGiftBroadcastScheduler();
      res.json({ ok: true, message: "Đã cập nhật lịch phát code tặng" });
    } else {
      res.json({ ok: true, message: "Bot2 chưa khởi động — lịch sẽ tự áp dụng khi bot start" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi khi restart scheduler" });
  }
});

router.post("/gift-codes", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateGiftCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [code] = await db
    .insert(giftCodesTable)
    .values({
      code: parsed.data.code,
      amount: parsed.data.amount,
      maxUses: parsed.data.maxUses,
    })
    .returning();
  if (!code) {
    res.status(500).json({ error: "Tạo mã thất bại" });
    return;
  }
  res.status(201).json(code);
});

// ── Broadcast: gửi banner + nội dung vào group Telegram ────────────────────

router.post("/broadcast/stat", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const groupRaw = await getSetting('group_chat_id') ?? await getSetting('admin_chat_id');
    const groupChatId = groupRaw ? parseInt(groupRaw) : 6030019812;
    if (isNaN(groupChatId)) { res.status(400).json({ error: 'Chưa cấu hình group_chat_id' }); return; }

    const [usersRes] = await db.select({ count: sql<number>`count(*)` }).from(botUsersTable);
    const [depositsRes] = await db
      .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
      .from(transactionsTable)
      .where(eq(transactionsTable.type, 'deposit'));
    const [betsRes] = await db
      .select({ total: sql<number>`coalesce(sum(bet_amount::numeric), 0)::float` })
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.status, 'completed'));

    const totalUsers = Number(usersRes?.count ?? 0);
    const totalDeposits = Math.round(depositsRes?.total ?? 0);
    const totalBets = Math.round(betsRes?.total ?? 0);

    const caption =
      `📊 <b>THỐNG KÊ HARU88</b>\n\n` +
      `👥 Tổng thành viên: <b>${totalUsers.toLocaleString('vi-VN')}</b>\n` +
      `💰 Tổng nạp: <b>${totalDeposits.toLocaleString('vi-VN')}đ</b>\n` +
      `🎲 Tổng cược: <b>${totalBets.toLocaleString('vi-VN')}đ</b>`;

    const result = await telegramBotService.broadcastToGroup(groupChatId, 'main', caption);
    if (result.ok) {
      res.json({ ok: true, message: 'Đã gửi stat vào nhóm' });
    } else {
      res.status(500).json({ error: result.error ?? 'Gửi thất bại' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Lỗi server' });
  }
});

router.post("/broadcast/banner", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { bannerType, caption: customCaption } = req.body as { bannerType?: string; caption?: string };
    if (!bannerType || !['main', 'naplandau', 'tichluynap'].includes(bannerType)) {
      res.status(400).json({ error: 'bannerType không hợp lệ' }); return;
    }

    const groupRaw = await getSetting('group_chat_id') ?? await getSetting('admin_chat_id');
    const groupChatId = groupRaw ? parseInt(groupRaw) : 6030019812;
    if (isNaN(groupChatId)) { res.status(400).json({ error: 'Chưa cấu hình group_chat_id' }); return; }

    const defaultCaptions: Record<string, string> = {
      main: '🔥 <b>HARU88</b> — Sân chơi đỉnh cao, thắng lớn mỗi ngày!',
      naplandau: '🎁 <b>SỰ KIỆN X125% TIỀN NẠP LẦN ĐẦU</b>\n\nNạp 1 nhận 125% — Nhận thưởng cực khủng ngay lần đầu tiên!',
      tichluynap: '📣 <b>TÍCH LŨY NẠP, SĂN GIFTCODE</b>\n\nNạp tích lũy để nhận code thưởng siêu hấp dẫn!',
    };

    const caption = customCaption?.trim() || defaultCaptions[bannerType];
    const result = await telegramBotService.broadcastToGroup(groupChatId, bannerType as any, caption);
    if (result.ok) {
      res.json({ ok: true, message: 'Đã gửi banner vào nhóm' });
    } else {
      res.status(500).json({ error: result.error ?? 'Gửi thất bại' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Lỗi server' });
  }
});

// ─── System stats & maintenance ───────────────────────────────────────────────

router.get("/system-stats", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    // Bot running states
    const botMainRunning = telegramBotService.isActive();
    const bot2Running = telegramBot2Service.isActive();
    // SupportBotService doesn't expose isActive — check indirectly via polling flag
    const supportBotRunning = (supportBotService as any).bot != null;
    const redisConnected = false; // Redis optional — set to false if not configured

    // Bank connectivity
    const msbSt = msbService.getStatus();
    const tcbSt = techcombankService.getStatus();
    const hdbSt = hdBankService.getStatus();
    const bankConnected = msbSt.loggedIn || tcbSt.loggedIn || hdbSt.loggedIn;

    // Pending counts
    const [pendingWithdrawalsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, "pending")));
    const [pendingSupportRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportRequestsTable)
      .where(eq(supportRequestsTable.status, "pending"));

    res.json({
      uptime: process.uptime(),
      botMainRunning,
      bot2Running,
      supportBotRunning,
      redisConnected,
      bankConnected,
      pendingWithdrawals: pendingWithdrawalsRow?.count ?? 0,
      pendingSupport: pendingSupportRow?.count ?? 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

router.post("/maintenance", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runMaintenance();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Lỗi server" });
  }
});

// ─── Bank login test ───────────────────────────────────────────────────────────

router.post("/bank-login", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const username = await getSetting("bank_username");
    const password = await getSetting("bank_password");

    if (!username || !password) {
      res.status(400).json({ success: false, message: "Chưa cấu hình bank_username hoặc bank_password trong Cài đặt." });
      return;
    }

    const configuredUrl = await getSetting("bank_api_url");
    const raw = (configuredUrl || "https://nganhangnay.onrender.com").replace(/\/+$/, "");
    const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const apiBase = base.endsWith("/api") ? base : `${base}/api`;

    const resp = await fetch(`${apiBase}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await resp.json() as {
      success: boolean;
      message: string;
      attempts?: number;
      data?: { sessionId?: string; customerName?: string; lastLogin?: string };
    };

    if (data.success) {
      logger.info({ customerName: data.data?.customerName }, "✅ Bank login thành công từ Admin Panel");

      // Fetch balance to get account number + holder, then auto-save to DB
      let accountNumber = "";
      let accountHolder = data.data?.customerName ?? "";
      try {
        const balResp = await fetch(`${apiBase}/balance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (balResp.ok) {
          const balData = await balResp.json() as {
            success: boolean;
            data?: { accounts?: Array<{ number: string; name: string }> };
          };
          if (balData.success && balData.data?.accounts?.[0]) {
            const primary = balData.data.accounts[0]!;
            accountNumber = primary.number;
            accountHolder = primary.name || accountHolder;

            // Save to DB settings
            const { db: dbConn, botSettingsTable: tbl } = await import("@workspace/db");
            const { eq: eqFn } = await import("drizzle-orm");
            for (const [key, value] of Object.entries({ bank_account_number: accountNumber, bank_account_holder: accountHolder })) {
              if (value) {
                await dbConn.insert(tbl).values({ key, value })
                  .onConflictDoUpdate({ target: tbl.key, set: { value, updatedAt: new Date() } });
              }
            }
            logger.info({ accountNumber, accountHolder }, "💾 Account info saved to settings after admin login");
          }
        }
      } catch (balErr) {
        logger.warn({ balErr }, "Could not fetch balance after admin bank login");
      }

      // Start/restart bankService polling with new session
      setImmediate(async () => {
        try {
          await bankService.restart();
          logger.info("✅ Bank polling restarted after admin login");
        } catch (e) {
          logger.warn({ e }, "Could not restart bank polling after admin login");
        }
      });

      res.json({
        success: true,
        message: `Đăng nhập thành công!`,
        attempts: data.attempts ?? 1,
        customerName: data.data?.customerName,
        accountNumber,
        accountHolder,
        lastLogin: data.data?.lastLogin,
        apiUrl: apiBase,
        pollingStarted: true,
      });
    } else {
      logger.warn({ message: data.message }, "❌ Bank login test thất bại");
      res.json({ success: false, message: data.message ?? "Đăng nhập thất bại", apiUrl: apiBase });
    }
  } catch (err: any) {
    const msg = err?.message ?? "Lỗi kết nối";
    logger.error({ err }, "❌ Bank login test error");
    res.status(500).json({ success: false, message: `Lỗi kết nối tới Bank API: ${msg}` });
  }
});

// ── Khởi tạo deposit_banks mặc định (MB x2, TCB x2, MSB x1) ─────────────────
router.post("/init-deposit-banks", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const current = await getSetting("deposit_banks");
  if (current && req.body?.force !== true) {
    res.json({ success: false, message: "deposit_banks đã được cấu hình. Gửi force:true để ghi đè.", current: JSON.parse(current) });
    return;
  }

  // Đọc tài khoản thực từ MSB (đang đăng nhập) và Techcombank
  const msbStatus = msbService.getStatus();
  const tcbStatus = techcombankService.getStatus();

  // Lấy danh sách tài khoản đang có từ các bank
  let msbAccounts: Array<{ accountNumber: string; accountName: string }> = [];
  let tcbAccounts: Array<{ accountNumber: string; accountName: string }> = [];

  if (msbStatus.loggedIn) {
    try { msbAccounts = (await msbService.fetchAccounts()).map(a => ({ accountNumber: a.accountNumber, accountName: a.accountName })); } catch {}
  }
  if (tcbStatus.loggedIn) {
    try { tcbAccounts = (await techcombankService.getAccounts()).map(a => ({ accountNumber: a.accountNumber, accountName: a.accountName })); } catch {}
  }

  // Build deposit_banks JSON từ tài khoản đang có
  const banks: Array<{ bankCode: string; accountNumber: string; accountHolder: string }> = [];

  // MB bank accounts — đọc từ setting hoặc bankCredStore
  const mbAccNum1 = await getSetting("bank_account_number");
  const mbAccHolder1 = await getSetting("bank_account_holder");
  if (mbAccNum1 && mbAccHolder1) {
    banks.push({ bankCode: "MB", accountNumber: mbAccNum1, accountHolder: mbAccHolder1 });
  }
  const mbAccNum2 = await getSetting("mb_account_number_2");
  const mbAccHolder2 = await getSetting("mb_account_holder_2");
  if (mbAccNum2 && mbAccHolder2) {
    banks.push({ bankCode: "MB", accountNumber: mbAccNum2, accountHolder: mbAccHolder2 });
  }

  // TCB accounts
  for (const acct of tcbAccounts.slice(0, 2)) {
    banks.push({ bankCode: "TCB", accountNumber: acct.accountNumber, accountHolder: acct.accountName });
  }
  // Fallback TCB from settings
  if (tcbAccounts.length === 0) {
    const tcbAccNum = getCredential("tcb_account_number");
    const tcbName = await getSetting("tcb_account_holder");
    if (tcbAccNum && tcbName) banks.push({ bankCode: "TCB", accountNumber: tcbAccNum, accountHolder: tcbName });
  }

  // MSB accounts
  for (const acct of msbAccounts.slice(0, 1)) {
    banks.push({ bankCode: "MSB", accountNumber: acct.accountNumber, accountHolder: acct.accountName });
  }
  // Fallback MSB from settings
  if (msbAccounts.length === 0) {
    const msbAccNum = getCredential("msb_account_number");
    const msbName = await getSetting("msb_account_holder");
    if (msbAccNum && msbName) banks.push({ bankCode: "MSB", accountNumber: msbAccNum, accountHolder: msbName });
  }

  if (banks.length === 0) {
    res.json({ success: false, message: "Không có tài khoản nào. Hãy cấu hình thủ công trong Settings." });
    return;
  }

  const value = JSON.stringify(banks);
  await db.insert(botSettingsTable).values({ key: "deposit_banks", value })
    .onConflictDoUpdate({ target: botSettingsTable.key, set: { value, updatedAt: new Date() } });

  logger.info({ count: banks.length }, "✅ deposit_banks initialized from live bank accounts");
  res.json({ success: true, banks, message: `Đã cấu hình ${banks.length} tài khoản nạp tiền.` });
});

// ─── Withdrawals ───────────────────────────────────────────────────────────────

router.get("/withdrawals", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const qp = GetWithdrawalsQueryParams.safeParse(req.query);
  const limit = qp.success ? (qp.data.limit ?? 50) : 50;
  const page = qp.success ? (qp.data.page ?? 1) : 1;
  const statusFilter = qp.success ? qp.data.status : undefined;
  const offset = (page - 1) * limit;

  let baseQ = db.select().from(transactionsTable)
    .where(eq(transactionsTable.type, "withdraw"))
    .orderBy(desc(transactionsTable.createdAt))
    .$dynamic();
  let countQ = db.select({ count: sql<number>`count(*)::int` })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "withdraw"))
    .$dynamic();

  if (statusFilter) {
    baseQ = baseQ.where(eq(transactionsTable.status, statusFilter));
    countQ = countQ.where(eq(transactionsTable.status, statusFilter));
  }

  const [rows, [countRow]] = await Promise.all([
    baseQ.limit(limit).offset(offset),
    countQ,
  ]);

  res.json({
    withdrawals: rows.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      bankName: (t.metadata as any)?.bankName ?? null,
      bankNumber: (t.metadata as any)?.bankNumber ?? null,
      bankOwner: (t.metadata as any)?.bankOwner ?? null,
      method: t.method ?? null,
      status: t.status,
      note: (t.metadata as any)?.note ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    total: countRow?.count ?? 0,
  });
});

router.post("/withdrawals/:id/approve", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ success: false, message: "Invalid id" }); return; }
  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "completed" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdraw")))
    .returning();
  if (!updated) { res.status(404).json({ success: false, message: "Withdrawal not found" }); return; }
  logger.info({ id }, "Admin approved withdrawal");
  res.json({ success: true, message: "Đã duyệt lệnh rút tiền" });
});

router.post("/withdrawals/:id/reject", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ success: false, message: "Invalid id" }); return; }
  const reason = (req.body as any)?.reason ?? "";
  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "rejected", metadata: { reason } })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdraw")))
    .returning();
  if (!updated) { res.status(404).json({ success: false, message: "Withdrawal not found" }); return; }
  logger.info({ id, reason }, "Admin rejected withdrawal");
  res.json({ success: true, message: "Đã từ chối lệnh rút tiền" });
});

// ─── Analytics ─────────────────────────────────────────────────────────────────

router.get("/analytics/revenue", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const qp = GetRevenueAnalyticsQueryParams.safeParse(req.query);
  const period = qp.success ? (qp.data.period ?? "daily") : "daily";
  const days = period === "monthly" ? 30 : period === "weekly" ? 7 : 14;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const depositRows = await db
    .select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      total: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), gte(transactionsTable.createdAt, since)))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  const withdrawRows = await db
    .select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      total: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdraw"), gte(transactionsTable.createdAt, since)))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  const depositByDate = Object.fromEntries(depositRows.map((r) => [r.date, r.total]));
  const withdrawByDate = Object.fromEntries(withdrawRows.map((r) => [r.date, r.total]));

  const allDates = Array.from(new Set([...Object.keys(depositByDate), ...Object.keys(withdrawByDate)])).sort();
  const dailyData = allDates.map((date) => ({
    date,
    deposit: depositByDate[date] ?? 0,
    withdrawal: withdrawByDate[date] ?? 0,
  }));

  const totalDeposit = depositRows.reduce((s, r) => s + r.total, 0);
  const totalWithdrawal = withdrawRows.reduce((s, r) => s + r.total, 0);

  res.json({
    totalDeposit,
    totalWithdrawal,
    netRevenue: totalDeposit - totalWithdrawal,
    dailyData,
  });
});

router.get("/analytics/games", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const gameStats = await db
    .select({
      gameType: gameSessionsTable.gameType,
      totalBets: sql<number>`count(*)::int`,
      totalWagered: sql<number>`coalesce(sum(bet_amount::numeric), 0)::float`,
      totalPayout: sql<number>`coalesce(sum(case when won then win_amount::numeric else 0 end), 0)::float`,
      wins: sql<number>`count(case when won then 1 end)::int`,
    })
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.status, "completed"))
    .groupBy(gameSessionsTable.gameType);

  const games = gameStats.map((g) => ({
    gameType: g.gameType,
    totalBets: g.totalBets,
    totalWagered: g.totalWagered,
    totalPayout: g.totalPayout,
    houseProfit: g.totalWagered - g.totalPayout,
    winRate: g.totalBets > 0 ? Math.round((g.wins / g.totalBets) * 10000) / 100 : 0,
  }));

  const since = new Date();
  since.setDate(since.getDate() - 14);
  const activityRows = await db
    .select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      bets: sql<number>`count(*)::int`,
    })
    .from(gameSessionsTable)
    .where(gte(gameSessionsTable.createdAt, since))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`);

  res.json({
    games,
    activity: activityRows.map((r) => ({ date: r.date, bets: r.bets })),
  });
});

router.get("/analytics/top-players", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const qp = GetTopPlayersQueryParams.safeParse(req.query);
  const by = qp.success ? (qp.data.by ?? "deposit") : "deposit";
  const limit = qp.success ? (qp.data.limit ?? 10) : 10;

  if (by === "wagering") {
    const rows = await db
      .select({
        id: botUsersTable.id,
        username: botUsersTable.username,
        firstName: botUsersTable.firstName,
        totalWagered: botUsersTable.totalWagered,
        vipLevel: botUsersTable.vipLevel,
      })
      .from(botUsersTable)
      .orderBy(desc(sql`total_wagered::numeric`))
      .limit(limit);

    res.json(rows.map((u) => ({
      userId: u.id,
      username: u.username ?? null,
      firstName: u.firstName ?? null,
      amount: parseFloat(u.totalWagered) || 0,
      vipLevel: u.vipLevel ?? null,
    })));
  } else {
    const rows = await db
      .select({
        userId: transactionsTable.userId,
        total: sql<number>`coalesce(sum(amount::numeric), 0)::float`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "deposit"))
      .groupBy(transactionsTable.userId)
      .orderBy(desc(sql`sum(amount::numeric)`))
      .limit(limit);

    const userIds = rows.map((r) => r.userId);
    const users = userIds.length > 0
      ? await db.select().from(botUsersTable).where(sql`id = ANY(${userIds}::text[])`)
      : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(rows.map((r) => ({
      userId: r.userId,
      username: userMap[r.userId]?.username ?? null,
      firstName: userMap[r.userId]?.firstName ?? null,
      amount: r.total,
      vipLevel: userMap[r.userId]?.vipLevel ?? null,
    })));
  }
});

router.get("/analytics/reconciliation", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const [systemBalanceRow] = await db
    .select({ total: sql<number>`coalesce(sum(balance::numeric), 0)::float` })
    .from(botUsersTable);

  const [depositTotal] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));

  const [withdrawTotal] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdraw"), eq(transactionsTable.status, "completed")));

  const [adminAddTotal] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "admin_add"));

  const [adminDeductTotal] = await db
    .select({ total: sql<number>`coalesce(sum(amount::numeric), 0)::float` })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "admin_deduct"));

  const systemBalance = systemBalanceRow?.total ?? 0;
  const expectedBalance = (depositTotal?.total ?? 0) - (withdrawTotal?.total ?? 0)
    + (adminAddTotal?.total ?? 0) - (adminDeductTotal?.total ?? 0);
  const discrepancy = Math.abs(systemBalance - expectedBalance);
  const hasAlert = discrepancy > 10000;

  res.json({
    systemBalance,
    bankBalance: null,
    expectedBalance,
    discrepancy,
    hasAlert,
    alertMessage: hasAlert ? `Chênh lệch ${discrepancy.toLocaleString("vi-VN")}đ — cần kiểm tra!` : null,
  });
});

// ─── Fraud detection ───────────────────────────────────────────────────────────

router.get("/fraud/suspicious", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  // Users with very high win rates (>80%) on many games
  const highWinRate = await db
    .select({
      userId: gameSessionsTable.userId,
      totalGames: sql<number>`count(*)::int`,
      wins: sql<number>`count(case when won then 1 end)::int`,
    })
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.status, "completed"))
    .groupBy(gameSessionsTable.userId)
    .having(sql`count(*) >= 10 AND count(case when won then 1 end)::float / count(*) > 0.8`)
    .limit(50);

  // Users with many deposits in last 24h (potential money laundering signals)
  const since24h = new Date(Date.now() - 86400_000);
  const multiDeposit = await db
    .select({
      userId: transactionsTable.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), gte(transactionsTable.createdAt, since24h)))
    .groupBy(transactionsTable.userId)
    .having(sql`count(*) >= 5`)
    .limit(50);

  const suspiciousUserIds = Array.from(new Set([
    ...highWinRate.map((r) => r.userId),
    ...multiDeposit.map((r) => r.userId),
  ]));

  const users = suspiciousUserIds.length > 0
    ? await db.select().from(botUsersTable).where(sql`id = ANY(${suspiciousUserIds}::text[])`)
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const winRateMap = Object.fromEntries(
    highWinRate.map((r) => [r.userId, { winRate: r.totalGames > 0 ? r.wins / r.totalGames : 0 }])
  );
  const depositCountMap = Object.fromEntries(multiDeposit.map((r) => [r.userId, r.count]));

  const result = suspiciousUserIds.map((userId) => {
    const isHighWin = userId in winRateMap;
    const isMultiDeposit = userId in depositCountMap;
    const reasons: string[] = [];
    if (isHighWin) reasons.push("Win rate cao bất thường (>80%)");
    if (isMultiDeposit) reasons.push(`${depositCountMap[userId]} lần nạp trong 24h`);
    const score = (isHighWin ? 60 : 0) + (isMultiDeposit ? 40 : 0);
    return {
      userId,
      username: userMap[userId]?.username ?? null,
      reason: reasons.join(" | "),
      score,
      winRate: winRateMap[userId]?.winRate ?? null,
      depositCount24h: depositCountMap[userId] ?? null,
    };
  }).sort((a, b) => b.score - a.score);

  res.json(result);
});

// ── Kiểm tra số dư tức thì (trigger manual balance check) ────────────────────
router.post("/check-balance-now", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const results: Record<string, any> = {};

  // MSB balance
  try {
    const msbSt = msbService.getStatus();
    if (msbSt.loggedIn) {
      const accounts = await msbService.fetchAccounts();
      results.msb = accounts.map(a => ({
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        balance: a.balance,
        currency: a.currency,
      }));
    } else {
      results.msb = { error: "Chưa đăng nhập MSB" };
    }
  } catch (err: any) {
    results.msb = { error: err?.message ?? "MSB error" };
  }

  // TCB balance
  try {
    const tcbSt = techcombankService.getStatus();
    if (tcbSt.loggedIn) {
      const accounts = await techcombankService.getAccounts();
      results.tcb = accounts.map(a => ({
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        balance: a.balance,
        currency: a.currency,
      }));
    } else {
      results.tcb = { error: "Chưa đăng nhập Techcombank" };
    }
  } catch (err: any) {
    results.tcb = { error: err?.message ?? "TCB error" };
  }

  // Trigger active poll ngay lập tức để kiểm tra giao dịch mới
  try {
    bankService.startActivePoll();
    results.pollTriggered = true;
  } catch { results.pollTriggered = false; }

  res.json({ success: true, checkedAt: new Date().toISOString(), balances: results });
});

export default router;
