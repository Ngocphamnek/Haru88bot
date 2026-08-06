import { db } from "@workspace/db";
import { bankTransactionsTable, botSettingsTable, botUsersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "../lib/storage.js";
import { logger } from "../lib/logger.js";
import { getSetting } from "../lib/settings.js";

async function upsertSetting(key: string, value: string): Promise<void> {
  await db
    .insert(botSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: botSettingsTable.key, set: { value, updatedAt: new Date() } });
}

const DEFAULT_BANK_API = "https://nganhangnay.onrender.com";
const IDLE_POLL_MS   = 30_000;                 // 30s khi không có lệnh nạp pending
const ACTIVE_POLL_MS = 3_000;                  // 3s khi đang có lệnh nạp chờ xác nhận
const KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000; // 10 phút — ngăn Render cold start

async function getBankApiBase(): Promise<string> {
  const configured = await getSetting("bank_api_url");
  const raw = (configured || DEFAULT_BANK_API).replace(/\/+$/, "");
  // Tự động thêm https:// nếu user nhập domain không có protocol
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  // Support both "/api" suffix and bare domain
  return base.endsWith("/api") ? base : `${base}/api`;
}

interface BankTransaction {
  transactionDate: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
  beneficiaryName?: string;
  beneficiaryBank?: string;
  refNo: string;
}

interface BankStatusResponse {
  status: string;
  loggedIn: boolean;
  username?: string;
  sessionAge?: number;
}

interface PendingCode {
  userId: string;
  amount: number;
  createdAt: Date;
  isBonus125?: boolean; // true = nạp 125% khuyến mãi
}

class BankService {
  private pollingTimer: NodeJS.Timeout | null = null;  // idle poll (30s)
  private activePollTimer: NodeJS.Timeout | null = null; // active poll (3s)
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private isPolling = false; // ngăn concurrent polls
  private isLoggedIn = false;
  private accountNumber: string = "";
  private customerName: string = "";
  private allAccounts: Array<{ number: string; name: string; currency: string; balance: number }> = [];
  private lastPollDate: string = "";
  private pendingCodes: Map<string, PendingCode> = new Map();

  // ========== SETTINGS-BASED ACCOUNT INFO ==========

  async loadAccountInfoFromSettings(): Promise<void> {
    const accNum = await getSetting("bank_account_number");
    const accHolder = await getSetting("bank_account_holder");
    if (accNum) this.accountNumber = accNum;
    if (accHolder) this.customerName = accHolder;
  }

  // ========== COREBANK REGISTRATION ==========

  /**
   * Register a pending deposit with CoreBank so it can watch for the
   * matching bank transaction and fire a callback when found or expired.
   */
  async registerPendingWithCoreBank(
    code: string,
    amount: number,
    callbackUrl: string,
    secret?: string
  ): Promise<void> {
    const corebankUrl = await getSetting("corebank_api_url");
    const base = (corebankUrl || "http://localhost:2002").replace(/\/$/, "");

    try {
      const res = await fetch(`${base}/api/pending-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount, callbackUrl, secret: secret || undefined }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const body = await res.json() as { message?: string };
        logger.info({ code, amount, msg: body.message }, "📋 Registered pending deposit with CoreBank");
      } else {
        logger.warn({ code, status: res.status }, "⚠️ CoreBank pending-deposit registration failed");
      }
    } catch (err) {
      logger.warn({ err, code }, "⚠️ Could not reach CoreBank to register pending deposit");
    }
  }

  /**
   * Look up a pending code (for expired callback handling) and remove it.
   */
  getAndRemovePendingCode(code: string): PendingCode | null {
    const pending = this.pendingCodes.get(code);
    if (pending) {
      this.pendingCodes.delete(code);
      return pending;
    }
    return null;
  }

  /**
   * DB fallback: find a pending deposit transaction by HARU88 code.
   * Used when the in-memory Map is lost (e.g. server restart).
   */
  async findPendingCodeInDB(code: string): Promise<{ userId: string; amount: number } | null> {
    try {
      const [row] = await db
        .select({ userId: transactionsTable.userId, amount: transactionsTable.amount })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.status, "pending"),
            eq(transactionsTable.method, "bank"),
            sql`${transactionsTable.metadata}->>'paymentCode' = ${code}`
          )
        )
        .limit(1);
      if (!row) return null;
      return { userId: row.userId, amount: Number(row.amount) };
    } catch (err) {
      logger.warn({ err, code }, "DB fallback lookup for pending code failed");
      return null;
    }
  }

  /**
   * Mark a pending deposit transaction as cancelled in DB (on expiry).
   */
  async cancelPendingDepositInDB(code: string): Promise<void> {
    try {
      await db
        .update(transactionsTable)
        .set({ status: "cancelled" } as any)
        .where(
          and(
            eq(transactionsTable.status, "pending"),
            eq(transactionsTable.method, "bank"),
            sql`${transactionsTable.metadata}->>'paymentCode' = ${code}`
          )
        );
    } catch (err) {
      logger.warn({ err, code }, "Failed to cancel pending deposit in DB");
    }
  }

  // ========== PUBLIC CODE MATCHING (for webhook handler) ==========

  /**
   * Match an incoming webhook transaction by description + amount.
   * Returns match result including whether the amount is correct.
   * Consumes the pending code on a full match only.
   */
  matchAndConsumeCode(description: string, incomingAmount: number): {
    userId: string;
    expectedAmount: number;
    amountMatches: boolean;
    code: string;
    isBonus125: boolean;
  } | null {
    if (!description) return null;

    // Thử khớp mã thường HARU88XXXXXX hoặc mã 125% 125H88XXXXXX
    let match = description.match(/125H88([A-Z0-9]{6})/i);
    let prefix = "125H88";
    if (!match) {
      match = description.match(/HARU88([A-Z0-9]{6})/i);
      prefix = "HARU88";
    }
    if (!match) return null;

    const code = `${prefix}${match[1]!.toUpperCase()}`;
    const isBonus125 = prefix === "125H88";
    const pending = this.pendingCodes.get(code);
    if (!pending) return null;

    // Cho phép sai lệch ±1đ do làm tròn
    const amountMatches = Math.abs(incomingAmount - pending.amount) <= 1;

    if (amountMatches) {
      this.pendingCodes.delete(code);
      logger.info({ code, userId: pending.userId, amount: incomingAmount, isBonus125 }, "✅ Code + amount matched");
    } else {
      logger.warn({ code, userId: pending.userId, expected: pending.amount, got: incomingAmount }, "❌ Amount mismatch — not consuming code");
    }

    return { userId: pending.userId, expectedAmount: pending.amount, amountMatches, code, isBonus125 };
  }

  // ========== API HELPERS ==========

  private async apiPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    const base = await getBankApiBase();
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Bank API ${path} returned ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async apiGet<T>(path: string): Promise<T> {
    const base = await getBankApiBase();
    const res = await fetch(`${base}${path}`);
    if (!res.ok) throw new Error(`Bank API GET ${path} returned ${res.status}`);
    return res.json() as Promise<T>;
  }

  // ========== AUTH ==========

  async login(): Promise<boolean> {
    const username = await getSetting("bank_username");
    const password = await getSetting("bank_password");
    if (!username || !password) {
      logger.warn("bank_username or bank_password not set — bank integration disabled");
      return false;
    }

    try {
      const res = await this.apiPost<{
        success: boolean;
        message: string;
        attempts: number;
        data?: { sessionId: string; customerName: string };
      }>("/login", { username, password });

      if (res.success) {
        this.isLoggedIn = true;
        if (res.data?.customerName) this.customerName = res.data.customerName;
        logger.info({ customerName: res.data?.customerName, accountNumber: this.accountNumber }, "✅ Bank login successful");
        // Auto-fetch account info from balance
        await this.fetchAndStoreAccountInfo();
        return true;
      } else {
        logger.error({ message: res.message }, "❌ Bank login failed");
        this.isLoggedIn = false;
        return false;
      }
    } catch (err) {
      logger.error({ err }, "❌ Bank login error");
      this.isLoggedIn = false;
      return false;
    }
  }

  async ensureLoggedIn(): Promise<boolean> {
    try {
      const status = await this.apiGet<BankStatusResponse>("/status");
      if (status.loggedIn) {
        this.isLoggedIn = true;
        return true;
      }
    } catch {
      // ignore — fall through to login
    }
    return this.login();
  }

  // ========== BALANCE ==========

  async getBalance(): Promise<{ totalBalance: number; accounts: Array<{ number: string; name: string; balance: number; currency: string }> } | null> {
    try {
      if (!(await this.ensureLoggedIn())) return null;
      const res = await this.apiPost<{ success: boolean; data: { totalBalance: number; currencyEquivalent: string; accounts: Array<{ number: string; name: string; currency: string; balance: number }> } }>("/balance");
      return res.success ? res.data : null;
    } catch (err) {
      logger.error({ err }, "Failed to get bank balance");
      return null;
    }
  }

  private async fetchAndStoreAccountInfo(): Promise<void> {
    try {
      const res = await this.apiPost<{
        success: boolean;
        data: {
          totalBalance: number;
          currencyEquivalent: string;
          accounts: Array<{ number: string; name: string; currency: string; balance: number }>;
        };
      }>("/balance");

      if (res.success && res.data.accounts.length > 0) {
        this.allAccounts = res.data.accounts as any;
        const primary = res.data.accounts[0]!;
        // Use account number from API if not already set via env
        if (!this.accountNumber) this.accountNumber = primary.number;
        // Use account holder name from API
        if (primary.name) this.customerName = primary.name;

        // Auto-save to DB settings so they persist across restarts
        try {
          if (primary.number) await upsertSetting("bank_account_number", primary.number);
          if (primary.name)   await upsertSetting("bank_account_holder", primary.name);
          logger.info({ accountNumber: primary.number, holder: primary.name }, "💾 Bank account info auto-saved to settings");
        } catch (saveErr) {
          logger.warn({ saveErr }, "Could not auto-save bank account info to DB");
        }

        logger.info(
          {
            accounts: res.data.accounts.map(a => `${a.number} (${a.name})`),
            totalBalance: res.data.totalBalance,
          },
          `🏦 Bank account info loaded — ${res.data.accounts.length} tài khoản`
        );
      }
    } catch (err) {
      logger.warn({ err }, "Could not fetch account info from balance API");
    }
  }

  /** Return current in-memory account info */
  getAccountInfo(): { accountNumber: string; accountHolder: string; isLoggedIn: boolean; isPolling: boolean } {
    return {
      accountNumber: this.accountNumber,
      accountHolder: this.customerName,
      isLoggedIn: this.isLoggedIn,
      isPolling: !!this.pollingTimer,
    };
  }

  // ========== TRANSACTION POLLING ==========

  private getDateRange(): { fromDate: string; toDate: string } {
    const now = new Date();
    const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // last 2 days
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return { fromDate: fmt(from), toDate: fmt(now) };
  }

  private generateCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `HARU88${suffix}`;
  }

  private generateBonus125Code(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let suffix = "";
    for (let i = 0; i < 6; i++) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `125H88${suffix}`;
  }

  /** Tạo mã 125H88XXXXXX cho giao dịch nạp 125% khuyến mãi */
  createBonus125Code(userId: string, amount: number): { code: string } {
    // Dọn mã hết hạn (> 24h)
    const expiry = Date.now() - 24 * 60 * 60 * 1000;
    for (const [c, d] of this.pendingCodes.entries()) {
      if (d.createdAt.getTime() < expiry) this.pendingCodes.delete(c);
    }
    let code = this.generateBonus125Code();
    while (this.pendingCodes.has(code)) code = this.generateBonus125Code();
    this.pendingCodes.set(code, { userId, amount, createdAt: new Date(), isBonus125: true });
    this.startActivePoll();
    logger.info({ code, userId, amount }, "💳 Mã nạp 125% được tạo");
    return { code };
  }

  createPaymentCode(userId: string, amount: number): {
    code: string;
    qrUrl: string;
    accountNumber: string;
    accountHolder: string;
    bank: string;
  } {
    // Clean up expired codes (older than 24h)
    const expiry = Date.now() - 24 * 60 * 60 * 1000;
    for (const [code, data] of this.pendingCodes.entries()) {
      if (data.createdAt.getTime() < expiry) this.pendingCodes.delete(code);
    }

    // Generate unique code
    let code = this.generateCode();
    while (this.pendingCodes.has(code)) code = this.generateCode();

    this.pendingCodes.set(code, { userId, amount, createdAt: new Date() });

    // Có lệnh nạp mới → chuyển sang active polling 3s để phát hiện giao dịch ngay
    this.startActivePoll();

    // Use in-memory values (loaded from DB at startup or on first use)
    const accountNumber = this.accountNumber;
    const accountHolder = this.customerName || process.env["BANK_ACCOUNT_HOLDER"] || "CHU TAI KHOAN";
    const bank = process.env["BANK_NAME"] || "MB Bank";

    const qrUrl = `https://img.vietqr.io/image/${bank.replace(/\s/g,'')}-${accountNumber}-compact2.png` +
      `?amount=${amount}` +
      `&addInfo=${encodeURIComponent(code)}` +
      `&accountName=${encodeURIComponent(accountHolder)}`;

    logger.info({ code, userId, amount }, "💳 Payment code created");
    return { code, qrUrl, accountNumber, accountHolder, bank };
  }

  // ========== SMART POLLING — active khi có lệnh nạp pending ==========

  startActivePoll(): void {
    if (this.activePollTimer) return; // đang chạy rồi
    if (!this.pollingTimer) return;   // bank service chưa start (không có credentials)

    logger.info({ intervalMs: ACTIVE_POLL_MS }, "⚡ Active polling started (pending deposit detected)");

    // Thông báo MSB và TCB cũng chuyển sang active poll
    Promise.all([
      import('./msbService.js').then(({ msbService }) => msbService.startActivePoll()).catch(() => {}),
      import('./techcombankService.js').then(({ techcombankService }) => techcombankService.startActivePoll()).catch(() => {}),
    ]);

    this.activePollTimer = setInterval(async () => {
      // Dừng khi không còn pending codes
      if (this.pendingCodes.size === 0) {
        this.stopActivePoll();
        return;
      }
      // Ngăn poll chạy đồng thời
      if (this.isPolling) return;
      this.isPolling = true;
      try {
        await this.pollTransactions();
      } finally {
        this.isPolling = false;
      }
    }, ACTIVE_POLL_MS);
  }

  private stopActivePoll(): void {
    if (this.activePollTimer) {
      clearInterval(this.activePollTimer);
      this.activePollTimer = null;
      logger.info("⏸ Active polling stopped (no more pending deposits)");

      // Dừng active poll ở MSB và TCB khi không còn pending
      Promise.all([
        import('./msbService.js').then(({ msbService }) => msbService.stopActivePoll()).catch(() => {}),
        import('./techcombankService.js').then(({ techcombankService }) => techcombankService.stopActivePoll()).catch(() => {}),
      ]);
    }
  }

  private extractUserId(description: string): string | null {
    if (!description) return null;

    // Pattern 1: HARU88XXXXXX — look up in pendingCodes map
    const haruMatch = description.match(/HARU88([A-Z0-9]{6})/i);
    if (haruMatch) {
      const code = `HARU88${haruMatch[1]!.toUpperCase()}`;
      const pending = this.pendingCodes.get(code);
      if (pending) {
        logger.info({ code, userId: pending.userId }, "✅ Matched HARU88 code to user");
        this.pendingCodes.delete(code); // remove after match
        return pending.userId;
      }
    }

    // Pattern 2: legacy "nap [digits]"
    const napMatch = description.match(/(?:nap|naptien|naphe|deposit)\s*(\d{5,12})/i);
    if (napMatch) return napMatch[1]!;

    // Pattern 3: standalone Telegram user ID (7-12 digits)
    const numMatch = description.match(/\b(\d{7,12})\b/);
    if (numMatch) return numMatch[1]!;

    return null;
  }

  private async isAlreadyProcessed(refNo: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bankTransactionsTable)
      .where(and(eq(bankTransactionsTable.refNo, refNo), eq(bankTransactionsTable.processed, true)))
      .limit(1);
    return !!existing;
  }

  private async getExistingUnprocessed(refNo: string): Promise<{ userId: string | null } | null> {
    const [existing] = await db
      .select()
      .from(bankTransactionsTable)
      .where(and(eq(bankTransactionsTable.refNo, refNo), eq(bankTransactionsTable.processed, false)))
      .limit(1);
    return existing ?? null;
  }

  async pollTransactions(): Promise<void> {
    try {
      if (!(await this.ensureLoggedIn())) {
        logger.warn("Bank poll skipped — not logged in");
        this.isLoggedIn = false;
        return;
      }

      // Build list of accounts to poll — all known accounts or fallback to env var
      const accountsToPoll: string[] = this.allAccounts.length > 0
        ? this.allAccounts.map(a => a.number)
        : this.accountNumber
          ? [this.accountNumber]
          : [];

      if (accountsToPoll.length === 0) {
        logger.warn("No account numbers available — skipping poll");
        return;
      }

      const { fromDate, toDate } = this.getDateRange();
      let totalCredits = 0;

      for (const accountNumber of accountsToPoll) {
        const res = await this.apiPost<{ success: boolean; data: BankTransaction[] }>("/transactions", {
          accountNumber,
          fromDate,
          toDate,
        });

        if (!res.success || !Array.isArray(res.data)) {
          logger.warn({ accountNumber }, "Bank transactions fetch returned non-success");
          continue;
        }

        const credits = res.data.filter((tx) => parseFloat(String(tx.creditAmount)) > 0);
        totalCredits += credits.length;

        for (const tx of credits) {
          await this.processDepositTransaction(tx);
        }
      }

      logger.info(
        { totalCredits, accounts: accountsToPoll.length, fromDate, toDate },
        "📊 Bank poll complete"
      );
    } catch (err) {
      logger.error({ err }, "❌ Bank poll error");
      this.isLoggedIn = false;
    }
  }

  private async processDepositTransaction(tx: BankTransaction): Promise<void> {
    const refNo = tx.refNo || `${tx.transactionDate}_${tx.creditAmount}_${tx.description?.slice(0, 20)}`;
    const creditAmount = parseFloat(String(tx.creditAmount));

    // Skip if already fully processed
    if (await this.isAlreadyProcessed(refNo)) return;

    // Check if a previous attempt started but crashed (processed=false in DB)
    const existingRecord = await this.getExistingUnprocessed(refNo);

    // Try to extract userId — from HARU88 code or legacy patterns
    // If the code was already consumed from pendingCodes in a previous crashed attempt,
    // fall back to the userId stored in the DB record
    let extractedUserId = this.extractUserId(tx.description || "");
    if (!extractedUserId && existingRecord?.userId) {
      extractedUserId = existingRecord.userId;
      logger.info({ refNo, userId: extractedUserId }, "🔄 Recovering failed deposit from DB record");
    }

    // Insert or update the DB record
    if (!existingRecord) {
      await db.insert(bankTransactionsTable).values({
        refNo,
        userId: extractedUserId,
        amount: String(creditAmount),
        description: tx.description,
        transactionDate: tx.transactionDate,
        processed: false,
      }).onConflictDoNothing();
    }

    if (!extractedUserId) {
      logger.warn({ refNo, description: tx.description }, "⚠️ Bank deposit with no matching user ID — manual review needed");
      return;
    }

    // Verify user exists
    const user = await storage.getBotUser(extractedUserId);
    if (!user) {
      logger.warn({ refNo, extractedUserId }, "⚠️ Bank deposit user ID not found in DB");
      return;
    }

    // Credit user balance — parse both values as numbers (API may return strings)
    const currentBalance = parseFloat(user.balance || "0");
    const newBalance = (currentBalance + creditAmount).toFixed(2);
    await storage.updateBotUser(extractedUserId, { balance: newBalance });

    // Record transaction
    await storage.createTransaction({
      userId: extractedUserId,
      type: "deposit",
      amount: String(creditAmount),
      status: "completed",
      method: "bank",
      metadata: {
        refNo,
        description: tx.description,
        transactionDate: tx.transactionDate,
        beneficiaryName: tx.beneficiaryName,
      },
    });

    // Mark as processed
    await db
      .update(bankTransactionsTable)
      .set({ processed: true, processedAt: new Date(), userId: extractedUserId })
      .where(eq(bankTransactionsTable.refNo, refNo));

    logger.info({ refNo, userId: extractedUserId, amount: creditAmount }, "✅ Deposit credited to user");

    // Notify user via Telegram bot
    try {
      const { telegramBotService } = await import("./telegramBot.js");
      await telegramBotService.notifyPaymentSuccess(extractedUserId, creditAmount, refNo);
    } catch (err) {
      logger.error({ err }, "Failed to notify user of deposit");
    }

    // Check Tích Lũy Nạp milestones after deposit
    try {
      const newMilestones = await storage.checkAndGrantTichLuyNapMilestones(extractedUserId);
      if (newMilestones.length > 0) {
        const { telegramBotService } = await import("./telegramBot.js");
        for (const m of newMilestones) {
          await telegramBotService.notifyTichLuyNapMilestone(extractedUserId, m.milestoneIdx, m.amount, m.gift);
        }
      }
    } catch (err) {
      logger.warn({ err }, "Failed to check tich luy nap milestones");
    }
  }

  // ========== PAYMENT INFO ==========

  getPaymentInfo(userId: string, amount: number): {
    accountNumber: string;
    accountHolder: string;
    bank: string;
    description: string;
    amount: number;
  } {
    return {
      accountNumber: this.accountNumber,
      accountHolder: this.customerName || process.env["BANK_ACCOUNT_HOLDER"] || "CHU TAI KHOAN",
      bank: process.env["BANK_NAME"] || "MB Bank",
      description: `NAP ${userId}`,
      amount,
    };
  }

  // ========== KEEPALIVE (ngăn Render cold start) ==========

  /**
   * Ping nhẹ GET /api/status mỗi 10 phút để giữ service không ngủ.
   * Chạy độc lập — không cần credentials, không ảnh hưởng polling.
   */
  startKeepalive(): void {
    if (this.keepaliveTimer) return; // đã chạy rồi

    const ping = async () => {
      try {
        // Dùng apiGet("/status") — tự build URL đúng từ getBankApiBase()
        const body = await this.apiGet<{ status?: string; loggedIn?: boolean }>("/status");
        logger.info({ status: body.status, loggedIn: body.loggedIn }, "🏓 Bank API keepalive OK");
      } catch (err) {
        logger.warn({ err }, "🏓 Bank API keepalive ping failed (non-fatal)");
      }
    };

    // Ping ngay lập tức để warm up Render instance
    ping();

    this.keepaliveTimer = setInterval(ping, KEEPALIVE_INTERVAL_MS);
    logger.info({ intervalMs: KEEPALIVE_INTERVAL_MS }, "🏓 Bank API keepalive started");
  }

  // ========== LIFECYCLE ==========

  async start(): Promise<void> {
    const username = await getSetting("bank_username");
    const password = await getSetting("bank_password");
    if (!username || !password) {
      logger.warn("bank_username/bank_password not set in DB or env — bank polling disabled");
      return;
    }
    // Prefill accountNumber from DB setting if available
    const dbAccNum = await getSetting("bank_account_number");
    if (dbAccNum) this.accountNumber = dbAccNum;

    logger.info("🏦 Starting bank integration service...");

    // Warmup WASM engine
    try {
      await this.apiPost("/warmup");
      logger.info("🔥 Bank WASM engine warmed up");
    } catch {
      // non-critical
    }

    const loggedIn = await this.login();
    if (!loggedIn) {
      logger.warn("Initial bank login failed — will retry on next poll cycle");
    }

    // Idle poll — chạy mỗi 30s khi không có pending deposit
    // Active poll (3s) sẽ tự khởi động khi createPaymentCode() được gọi
    this.pollingTimer = setInterval(async () => {
      if (this.isPolling) return; // active poll đang chạy → skip idle tick
      this.isPolling = true;
      try {
        await this.pollTransactions();
      } catch (err) {
        logger.error({ err }, "Unhandled error in idle bank poll");
      } finally {
        this.isPolling = false;
      }
    }, IDLE_POLL_MS);

    // Chạy ngay 1 lần khi khởi động
    this.isPolling = true;
    this.pollTransactions()
      .catch((err) => logger.error({ err }, "Initial bank poll error"))
      .finally(() => { this.isPolling = false; });

    logger.info({ idleMs: IDLE_POLL_MS, activeMs: ACTIVE_POLL_MS }, "✅ Bank polling started (idle 30s / active 3s when deposit pending)");
  }

  stop(): void {
    if (this.activePollTimer) {
      clearInterval(this.activePollTimer);
      this.activePollTimer = null;
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.isLoggedIn = false;
  }

  /** Stop then re-start the bank service (called when credentials change) */
  async restart(): Promise<void> {
    logger.info("🔄 Restarting bank service...");
    this.stop();
    // reset state
    this.accountNumber = "";
    this.customerName = "";
    this.allAccounts = [];
    this.lastPollDate = "";
    await this.start();
  }
}

export const bankService = new BankService();
