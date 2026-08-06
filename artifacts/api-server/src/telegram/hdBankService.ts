/**
 * HD Bank Direct Integration
 * Reverse-engineered from ebanking.hdbank.vn IPC platform.
 * Uses Blowfish-ECB key exchange + RSA password encryption.
 */
import https from "node:https";
import { db } from "@workspace/db";
import { bankTransactionsTable, botUsersTable, transactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getCredential } from "../lib/bankCredStore.js";
import { storage } from "../lib/storage.js";
import { initHDBankCrypto } from "../lib/hdbank-crypto.js";

// ─── Constants ───────────────────────────────────────────────────────────────
const HDB_BASE   = "https://ebanking.hdbank.vn";
const SERVLET    = "/ipc/netSymbolsServlet";
const TOUCHPOINT = "iPC";
const MODULE_INDIVIDUAL = "INDIVIDUAL";
const LOGIN_PAGE = "/ipc/vi/";
const MAIN_PAGE  = "/";

// ─── HTTP helper that preserves cookies ──────────────────────────────────────
type CookieJar = Record<string, string>;

function buildCookieStr(cookies: CookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeCookies(existing: CookieJar, setCookieHeaders: string[]): CookieJar {
  const next: CookieJar = { ...existing };
  for (const header of setCookieHeaders) {
    const m = header.match(/^([^=]+)=([^;]*)/);
    if (m) {
      const name = m[1]!.trim();
      const val  = m[2]!.trim();
      if (name && name !== "HttpOnly" && name !== "Secure") {
        next[name] = val;
      }
    }
  }
  return next;
}

interface HttpResult { text: string; cookies: CookieJar; status: number; location?: string }

async function httpPost(
  path: string,
  body: string,
  cookies: CookieJar,
  referer?: string,
  extraHeaders?: Record<string, string>
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const cookieStr = buildCookieStr(cookies);
    const options: https.RequestOptions = {
      hostname: "ebanking.hdbank.vn",
      port: 443,
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Origin": HDB_BASE,
        "Referer": referer || `${HDB_BASE}${LOGIN_PAGE}`,
        ...(cookieStr ? { Cookie: cookieStr } : {}),
        ...(extraHeaders ?? {}),
      },
    };

    const req = https.request(options, (res) => {
      const newCookies = mergeCookies(cookies, res.headers["set-cookie"] || []);
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({
        text: data,
        cookies: newCookies,
        status: res.statusCode ?? 0,
        location: res.headers["location"],
      }));
    });

    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("HD Bank request timeout")); });
    req.write(body);
    req.end();
  });
}

async function httpGet(
  path: string,
  cookies: CookieJar,
  referer?: string
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const cookieStr = buildCookieStr(cookies);
    const options: https.RequestOptions = {
      hostname: "ebanking.hdbank.vn",
      port: 443,
      path,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        ...(referer ? { Referer: referer } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    };

    const req = https.request(options, (res) => {
      const newCookies = mergeCookies(cookies, res.headers["set-cookie"] || []);
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({
        text: data,
        cookies: newCookies,
        status: res.statusCode ?? 0,
        location: res.headers["location"],
      }));
    });

    req.on("error", reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("HD Bank GET timeout")); });
    req.end();
  });
}

// ─── Parse server responses ───────────────────────────────────────────────────

function parseGetPublicKeyResponse(html: string): { publicKey: string; pubkeyId: string } | null {
  const keyMatch = html.match(/parent\.PublicKey\s*=\s*'([^']+)'/);
  const idMatch  = html.match(/parent\.PublicKeyID\s*=\s*'([^']*)'/);
  if (!keyMatch) return null;
  return {
    publicKey: keyMatch[1]!,
    pubkeyId:  idMatch?.[1] ?? "0",
  };
}

function parseModulusFromPage(html: string): string | null {
  // Try various patterns HDBank might use for RSA modulus
  const patterns = [
    /MODULUS\s*=\s*'([a-fA-F0-9]+)'/,
    /modulus\s*[=:]\s*['"]([a-fA-F0-9]{64,})['"]/, // hex string ≥ 64 chars
    /PublicKeyModulus\s*=\s*'([a-fA-F0-9]+)'/i,
    /RSAModulus\s*=\s*'([a-fA-F0-9]+)'/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1]!;
  }
  return null;
}

function parseSessionId(cookies: CookieJar): string {
  return cookies["JSESSIONID"] || "";
}

function parseLoginSuccess(html: string): boolean {
  if (html.includes("FRAME_PAGE") && !html.includes("login_error") && !html.includes("LOGIN_FAILED")) return true;
  if (html.includes("body.html")) return true;
  if (html.match(/SessionID\s*=\s*'[a-f0-9]+'/i)) return true;
  if (html.includes("WELCOME") || html.includes("welcome")) return true;
  return false;
}

function parseLoginError(html: string): string | null {
  // Extract Vietnamese error messages from HDBank response
  const msgMatch = html.match(/SUBWINDOWMSG2\s*=\s*'([^']+)'/);
  if (msgMatch) {
    return msgMatch[1]!
      .replace(/&ecirc;/g, "ê").replace(/&#7883;/g, "ị").replace(/&#7911;/g, "ủ")
      .replace(/&#273;/g, "đ").replace(/&atilde;/g, "ã").replace(/&#7871;/g, "ế")
      .replace(/&uacute;/g, "ú").replace(/&ograve;/g, "ò").replace(/&ocirc;/g, "ô")
      .replace(/&#7879;/g, "ệ").replace(/&ugrave;/g, "ù").replace(/&#432;/g, "ư")
      .replace(/&#7907;/g, "ợ").replace(/&iacute;/g, "í").replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  if (html.includes("Sai mật khẩu") || html.includes("wrong password")) return "Sai mật khẩu";
  if (html.includes("Tài khoản bị khoá") || html.includes("locked")) return "Tài khoản bị khoá";
  if (html.includes("Sai tên đăng nhập")) return "Sai tên đăng nhập hoặc mật khẩu";
  return null;
}

function parseTransactions(html: string): HDBTransaction[] {
  const txs: HDBTransaction[] = [];
  const jsonMatch = html.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
      for (const item of arr) {
        txs.push({
          transactionDate: String(item["transactionDate"] ?? item["txDate"] ?? ""),
          creditAmount: parseFloat(String(item["creditAmount"] ?? item["credit"] ?? 0)),
          debitAmount:  parseFloat(String(item["debitAmount"]  ?? item["debit"]  ?? 0)),
          description:  String(item["description"] ?? item["desc"] ?? item["narration"] ?? ""),
          refNo:        String(item["refNo"] ?? item["reference"] ?? item["id"] ?? ""),
        });
      }
    } catch { /* ignore */ }
  }
  return txs;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface HDBTransaction {
  transactionDate: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
  refNo: string;
}

interface HDBSession {
  cookies: CookieJar;
  sessionId: string;
  modulus: string;
  loggedIn: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────
const POLL_IDLE_MS   = 60_000;

class HDBankService {
  private session: HDBSession | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private activePollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private accountNumber = "";
  private lastLoginError = "";

  // ── Step 1: Load main page + login page to establish proper session ────
  private async initSession(): Promise<HDBSession | null> {
    try {
      let cookies: CookieJar = {};

      // Step 1a: GET main page to establish base session (like a browser would)
      try {
        const main = await httpGet(MAIN_PAGE, cookies);
        cookies = main.cookies;
        // Follow redirect if needed
        if (main.location) {
          const redirect = await httpGet(main.location, cookies, `${HDB_BASE}${MAIN_PAGE}`);
          cookies = redirect.cookies;
        }
      } catch {
        // Non-fatal — continue
      }

      // Step 1b: GET login page to get JSESSIONID and MODULUS
      const loginPage = await httpGet(LOGIN_PAGE, cookies, HDB_BASE);
      cookies = loginPage.cookies;

      // Log login page snippet to help diagnose crypto flow
      const loginSnippet = loginPage.text
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").substring(0, 400);
      logger.debug({ loginSnippet, httpStatus: loginPage.status }, "HD Bank: login page loaded");

      const modulus = parseModulusFromPage(loginPage.text);
      if (modulus) {
        logger.info({ modulusLen: modulus.length, modulusHead: modulus.substring(0, 16) }, "HD Bank: RSA modulus found on login page");
      } else {
        logger.warn("HD Bank: no RSA modulus on login page — using Blowfish fallback for password");
      }

      this.session = {
        cookies,
        sessionId: parseSessionId(cookies),
        modulus: modulus ?? "",
        loggedIn: false,
      };
      return this.session;
    } catch (err) {
      logger.error({ err }, "HD Bank: initSession failed");
      return null;
    }
  }

  // ── Step 2: Get public key from server ──────────────────────────────────
  private async getPublicKey(session: HDBSession): Promise<{ publicKey: string; pubkeyId: string } | null> {
    try {
      const body = new URLSearchParams({
        type:    TOUCHPOINT,
        module:  "SYSTEM",
        purpose: "GET_PUBLICKEY",
      }).toString();

      const res = await httpPost(SERVLET, body, session.cookies, `${HDB_BASE}${LOGIN_PAGE}`);
      session.cookies = res.cookies;
      session.sessionId = parseSessionId(res.cookies) || session.sessionId;

      const parsed = parseGetPublicKeyResponse(res.text);
      if (!parsed) {
        logger.warn({ preview: res.text.slice(0, 300) }, "HD Bank: GET_PUBLICKEY parse failed");
        return null;
      }
      logger.info({ pubkeyId: parsed.pubkeyId, keyLen: parsed.publicKey.length }, "HD Bank: Got public key");
      return parsed;
    } catch (err) {
      logger.error({ err }, "HD Bank: getPublicKey failed");
      return null;
    }
  }

  // ── Step 3: Login ───────────────────────────────────────────────────────
  async login(): Promise<boolean> {
    const username = getCredential("hdbank_username");
    const password = getCredential("hdbank_password");

    if (!username || !password) {
      logger.info("HD Bank: credentials not configured — skipping");
      return false;
    }

    try {
      const session = await this.initSession();
      if (!session) return false;

      const pkResult = await this.getPublicKey(session);
      if (!pkResult) return false;

      const { publicKey, pubkeyId } = pkResult;

      // Generate Blowfish symmetric key + encrypt with server's public key
      const hdbCrypto    = initHDBankCrypto(publicKey);
      const encryptedKey = hdbCrypto.encryptedKey; // Blowfish key encrypted with server public key (private_key field)

      // Encrypt password:
      // - If RSA modulus available from login page: use RSA
      // - Otherwise: use Blowfish symmetric encryption (fallback)
      const encPassword = session.modulus
        ? hdbCrypto.encryptWithRSA(session.modulus, password)
        : hdbCrypto.encryptPassword(password);

      logger.info({ pubkeyId, hasModulus: !!session.modulus, sessionId: session.sessionId || "(none)" }, "HD Bank: attempting login");

      // Build login body — include all fields the IPC platform expects
      const loginParams: Record<string, string> = {
        type:         TOUCHPOINT,
        module:       MODULE_INDIVIDUAL,
        purpose:      "LOGIN",
        user_id:      username,
        password:     encPassword,
        private_key:  encryptedKey,
        publickey_id: pubkeyId,
        language:     "vi",
        country:      "VN",
      };
      // Include session_id if we have a JSESSIONID
      if (session.sessionId) {
        loginParams["session_id"] = session.sessionId;
      }

      const body = new URLSearchParams(loginParams).toString();

      const res = await httpPost(SERVLET, body, session.cookies, `${HDB_BASE}${LOGIN_PAGE}`, {
        "X-Requested-With": "XMLHttpRequest",
      });
      session.cookies = res.cookies;
      session.sessionId = parseSessionId(res.cookies) || session.sessionId;

      const success = parseLoginSuccess(res.text);
      const errorMsg = success ? null : parseLoginError(res.text);
      session.loggedIn = success;
      this.session = session;

      if (success) {
        logger.info({ username }, "✅ HD Bank: Login successful");
        this.lastLoginError = "";
        this.accountNumber = getCredential("hdbank_account_number");
        return true;
      } else {
        this.lastLoginError = errorMsg ?? "Đăng nhập thất bại";
        logger.warn({ errorMsg, preview: res.text.slice(0, 500) }, "❌ HD Bank: Login failed");
        return false;
      }
    } catch (err: any) {
      this.lastLoginError = err.message ?? "Lỗi kết nối";
      logger.error({ err }, "❌ HD Bank: login error");
      return false;
    }
  }

  // ── Fetch transactions ──────────────────────────────────────────────────
  private async fetchTransactions(fromDate: string, toDate: string): Promise<HDBTransaction[]> {
    if (!this.session?.loggedIn) return [];
    const accountNumber = this.accountNumber;
    if (!accountNumber) {
      logger.warn("HD Bank: no account number configured");
      return [];
    }

    try {
      const body = new URLSearchParams({
        type:          TOUCHPOINT,
        module:        MODULE_INDIVIDUAL,
        purpose:       "INQUIRY_ACCOUNT_STATEMENT",
        session_id:    this.session.sessionId,
        accountNumber: accountNumber,
        fromDate,
        toDate,
        language:      "vi",
        country:       "VN",
      }).toString();

      const res = await httpPost(SERVLET, body, this.session.cookies, `${HDB_BASE}${LOGIN_PAGE}`);
      this.session.cookies = res.cookies;
      return parseTransactions(res.text);
    } catch (err) {
      logger.error({ err }, "HD Bank: fetchTransactions error");
      return [];
    }
  }

  private getDateRange(): { fromDate: string; toDate: string } {
    const now  = new Date();
    const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fmt  = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return { fromDate: fmt(from), toDate: fmt(now) };
  }

  // ── Poll ────────────────────────────────────────────────────────────────
  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      if (!this.session?.loggedIn) {
        const ok = await this.login();
        if (!ok) return;
      }

      const { fromDate, toDate } = this.getDateRange();
      const txs = await this.fetchTransactions(fromDate, toDate);

      for (const tx of txs) {
        if (tx.creditAmount > 0) {
          await this.processDeposit(tx);
        }
      }

      logger.info({ count: txs.filter(t => t.creditAmount > 0).length, bank: "HDBank" }, "📊 HD Bank poll complete");
    } catch (err) {
      logger.error({ err }, "❌ HD Bank poll error");
      this.session = null;
    } finally {
      this.isPolling = false;
    }
  }

  private extractUserId(description: string): string | null {
    if (!description) return null;
    const haruMatch = description.match(/HARU88([A-Z0-9]{6})/i);
    if (haruMatch) return `HARU88${haruMatch[1]!.toUpperCase()}`;
    const napMatch = description.match(/(?:nap|naptien)\s*(\d{5,12})/i);
    if (napMatch) return napMatch[1]!;
    const numMatch = description.match(/\b(\d{7,12})\b/);
    if (numMatch) return numMatch[1]!;
    return null;
  }

  private async processDeposit(tx: HDBTransaction): Promise<void> {
    const refNo = tx.refNo || `hdbank_${tx.transactionDate}_${tx.creditAmount}`;
    const creditAmount = tx.creditAmount;

    const [existing] = await db
      .select()
      .from(bankTransactionsTable)
      .where(and(eq(bankTransactionsTable.refNo, refNo), eq(bankTransactionsTable.processed, true)))
      .limit(1);
    if (existing) return;

    const userId = this.extractUserId(tx.description ?? "");

    await db.insert(bankTransactionsTable).values({
      refNo,
      userId,
      amount: String(creditAmount),
      description: tx.description,
      transactionDate: tx.transactionDate,
      processed: false,
    }).onConflictDoNothing();

    if (!userId) {
      logger.warn({ refNo, description: tx.description }, "HD Bank: deposit no user match");
      return;
    }

    const user = await storage.getBotUser(userId);
    if (!user) {
      logger.warn({ refNo, userId }, "HD Bank: deposit user not found");
      return;
    }

    const newBalance = (parseFloat(user.balance || "0") + creditAmount).toFixed(2);
    await storage.updateBotUser(userId, { balance: newBalance });

    await storage.createTransaction({
      userId,
      type: "deposit",
      amount: String(creditAmount),
      status: "completed",
      method: "bank",
      metadata: { refNo, description: tx.description, transactionDate: tx.transactionDate, bank: "HDBank" },
    });

    await db
      .update(bankTransactionsTable)
      .set({ processed: true, processedAt: new Date(), userId })
      .where(eq(bankTransactionsTable.refNo, refNo));

    logger.info({ refNo, userId, amount: creditAmount, bank: "HDBank" }, "✅ HD Bank deposit credited");

    try {
      const { telegramBotService } = await import("./telegramBot.js");
      await telegramBotService.notifyPaymentSuccess(userId, creditAmount, refNo);
    } catch (err) {
      logger.error({ err }, "HD Bank: notify user failed");
    }
  }

  // ── Start / Stop ────────────────────────────────────────────────────────
  async start(): Promise<void> {
    const username = getCredential("hdbank_username");
    const password = getCredential("hdbank_password");
    if (!username || !password) {
      logger.info("HD Bank service not started: credentials missing");
      return;
    }

    if (this.pollingTimer) return;

    const ok = await this.login();
    if (!ok) {
      logger.warn("HD Bank: initial login failed — will retry on next poll");
    }

    this.pollingTimer = setInterval(async () => {
      if (!this.isPolling) await this.poll();
    }, POLL_IDLE_MS);

    logger.info({ intervalMs: POLL_IDLE_MS }, "🏦 HD Bank polling started");
  }

  stop(): void {
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    if (this.activePollTimer) { clearInterval(this.activePollTimer); this.activePollTimer = null; }
    logger.info("🏦 HD Bank polling stopped");
  }

  getStatus(): { running: boolean; loggedIn: boolean; accountNumber: string; lastError: string } {
    return {
      running:       !!this.pollingTimer,
      loggedIn:      this.session?.loggedIn ?? false,
      accountNumber: this.accountNumber,
      lastError:     this.lastLoginError,
    };
  }

  /** Force re-login */
  async restart(): Promise<{ success: boolean; message: string }> {
    this.stop();
    this.session = null;
    this.lastLoginError = "";
    await this.start();
    const session = this.session as HDBSession | null;
    const loggedIn = session?.loggedIn ?? false;
    return {
      success: loggedIn,
      message: loggedIn ? "Đăng nhập HD Bank thành công" : (this.lastLoginError || "Đăng nhập thất bại — kiểm tra lại thông tin đăng nhập"),
    };
  }
}

export const hdBankService = new HDBankService();
