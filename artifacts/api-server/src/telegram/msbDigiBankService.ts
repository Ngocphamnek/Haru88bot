/**
 * MSB DigiBank Integration — OAuth2 Authorization Code + PKCE
 *
 * Flow:
 * 1. Generate PKCE (code_verifier + code_challenge)
 * 2. GET Keycloak auth URL → parse action URL from window.bbIdentityViewModel
 * 3. POST username/password to action URL (with session cookies)
 * 4. Intercept redirect to digibank.msb.com.vn?code=... (do NOT follow)
 * 5. Exchange code + code_verifier → access_token + refresh_token
 * 6. Use access_token to call DigiBank REST APIs for transactions
 */

import crypto from "node:crypto";
import { logger } from "../lib/logger.js";
import { getCredential, setCredentials } from "../lib/bankCredStore.js";
import { db } from "@workspace/db";
import { bankTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const IDENTITY_BASE = "https://digibank-identity-retail.msb.com.vn";
const DIGIBANK_BASE = "https://digibank.msb.com.vn";
const REALM = "customer";
const CLIENT_ID = "bb-web-client";
const REDIRECT_URI = `${DIGIBANK_BASE}/select-context`;
const TOKEN_ENDPOINT = `${IDENTITY_BASE}/auth/realms/${REALM}/protocol/openid-connect/token`;
const AUTH_ENDPOINT = `${IDENTITY_BASE}/auth/realms/${REALM}/protocol/openid-connect/auth`;
const POLL_INTERVAL_MS = 60_000;

// ─── PKCE helpers ──────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString("base64url").slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ─── Cookie jar ─────────────────────────────────────────────────────────────

type CookieJar = Record<string, string>;

function buildCookieStr(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeCookies(jar: CookieJar, setCookie: string | string[] | undefined): CookieJar {
  const next = { ...jar };
  const arr = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const h of arr) {
    const m = h.match(/^([^=]+)=([^;]*)/);
    if (m) {
      const name = m[1]!.trim();
      const val = m[2]!.trim();
      if (!["HttpOnly", "Secure", "Path", "Domain", "SameSite"].includes(name)) {
        next[name] = val;
      }
    }
  }
  return next;
}

// ─── HTTP helpers (fetch-based, avoids undici connection reuse issues) ───────

async function httpGet(
  url: string,
  jar: CookieJar,
  referer?: string,
  followRedirect = true,
): Promise<{ text: string; jar: CookieJar; status: number; location?: string }> {
  const resp = await fetch(url, {
    method: "GET",
    redirect: followRedirect ? "follow" : "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8",
      ...(referer ? { Referer: referer } : {}),
      ...(Object.keys(jar).length > 0 ? { Cookie: buildCookieStr(jar) } : {}),
    },
  });

  const newJar = mergeCookies(jar, resp.headers.getSetCookie?.() ?? []);
  const text = await resp.text().catch(() => "");
  return { text, jar: newJar, status: resp.status, location: resp.headers.get("location") ?? undefined };
}

async function httpPost(
  url: string,
  body: string,
  jar: CookieJar,
  referer?: string,
  followRedirect = false,
): Promise<{ text: string; jar: CookieJar; status: number; location?: string }> {
  const resp = await fetch(url, {
    method: "POST",
    redirect: followRedirect ? "follow" : "manual",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9",
      "Origin": IDENTITY_BASE,
      ...(referer ? { Referer: referer } : {}),
      ...(Object.keys(jar).length > 0 ? { Cookie: buildCookieStr(jar) } : {}),
    },
    body,
  });

  const newJar = mergeCookies(jar, resp.headers.getSetCookie?.() ?? []);
  const text = await resp.text().catch(() => "");
  return { text, jar: newJar, status: resp.status, location: resp.headers.get("location") ?? undefined };
}

async function httpPostJson(
  url: string,
  body: string,
  jar: CookieJar,
  bearerToken?: string,
): Promise<{ data: unknown; jar: CookieJar; status: number }> {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
  };
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
  if (Object.keys(jar).length > 0) headers["Cookie"] = buildCookieStr(jar);

  const resp = await fetch(url, { method: "POST", headers, body });
  const newJar = mergeCookies(jar, resp.headers.getSetCookie?.() ?? []);
  const data = await resp.json().catch(() => ({}));
  return { data, jar: newJar, status: resp.status };
}

async function apiGet(
  url: string,
  accessToken: string,
): Promise<{ data: unknown; status: number }> {
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
      "Origin": DIGIBANK_BASE,
      "Referer": `${DIGIBANK_BASE}/`,
    },
  });
  const data = await resp.json().catch(() => ({}));
  return { data, status: resp.status };
}

// ─── Parse action URL from Keycloak login page ──────────────────────────────

function parseActionUrl(html: string): string | null {
  // Try window.bbIdentityViewModel.action first (MSB custom theme)
  const bbMatch = html.match(/action\s*:\s*"([^"]+)"/);
  if (bbMatch) return bbMatch[1]!;
  // Fallback: standard Keycloak form action
  const formMatch = html.match(/action="([^"]+)"/);
  if (formMatch) return formMatch[1]!.replace(/&amp;/g, "&");
  return null;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  }).toString();

  const { data, status } = await httpPostJson(TOKEN_ENDPOINT, body, {});
  const d = data as Record<string, unknown>;

  if (status !== 200 || !d["access_token"]) {
    logger.warn({ status, error: d["error"], desc: d["error_description"] }, "MSB DigiBank: token exchange failed");
    return null;
  }

  return {
    accessToken: d["access_token"] as string,
    refreshToken: (d["refresh_token"] as string) ?? "",
    expiresIn: (d["expires_in"] as number) ?? 300,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  }).toString();

  const { data, status } = await httpPostJson(TOKEN_ENDPOINT, body, {});
  const d = data as Record<string, unknown>;

  if (status !== 200 || !d["access_token"]) {
    logger.warn({ status, error: d["error"] }, "MSB DigiBank: token refresh failed");
    return null;
  }

  return {
    accessToken: d["access_token"] as string,
    refreshToken: (d["refresh_token"] as string) ?? refreshToken,
    expiresIn: (d["expires_in"] as number) ?? 300,
  };
}

// ─── DigiBank API — discover accounts & transactions ─────────────────────────

interface DigiAccount {
  accountNumber: string;
  balance?: number;
  currencyCode?: string;
  productName?: string;
}

interface DigiTransaction {
  transactionDate: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
  refNo: string;
  balance?: number;
}

async function fetchAccounts(accessToken: string): Promise<DigiAccount[]> {
  const endpoints = [
    `${DIGIBANK_BASE}/api/retail/account/list`,
    `${DIGIBANK_BASE}/api/v1/accounts`,
    `${DIGIBANK_BASE}/api/retail/v1/accounts`,
    `${DIGIBANK_BASE}/api/account/list`,
  ];

  for (const url of endpoints) {
    try {
      const { data, status } = await apiGet(url, accessToken);
      const d = data as Record<string, unknown>;
      if (status === 200 && d) {
        const arr = (d["data"] ?? d["accounts"] ?? d["result"] ?? d) as unknown[];
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.map((a: unknown) => {
            const acc = a as Record<string, unknown>;
            return {
              accountNumber: String(acc["accountNumber"] ?? acc["account_number"] ?? acc["soTaiKhoan"] ?? ""),
              balance: Number(acc["balance"] ?? acc["availableBalance"] ?? 0),
              currencyCode: String(acc["currencyCode"] ?? acc["currency"] ?? "VND"),
              productName: String(acc["productName"] ?? acc["name"] ?? ""),
            };
          });
        }
      }
    } catch { /* try next */ }
  }
  return [];
}

async function fetchTransactions(
  accessToken: string,
  accountNumber: string,
  fromDate?: string,
  toDate?: string,
): Promise<DigiTransaction[]> {
  const now = new Date();
  const from = fromDate ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  const to = toDate ?? now.toISOString().slice(0, 10).replace(/-/g, "");

  const endpoints = [
    `${DIGIBANK_BASE}/api/retail/account/${accountNumber}/transactions?fromDate=${from}&toDate=${to}&pageSize=50`,
    `${DIGIBANK_BASE}/api/v1/accounts/${accountNumber}/transactions?from=${from}&to=${to}`,
    `${DIGIBANK_BASE}/api/retail/transaction/history?accountNumber=${accountNumber}&fromDate=${from}&toDate=${to}`,
  ];

  for (const url of endpoints) {
    try {
      const { data, status } = await apiGet(url, accessToken);
      const d = data as Record<string, unknown>;
      if (status === 200 && d) {
        const arr = (d["data"] ?? d["transactions"] ?? d["result"] ?? d) as unknown[];
        if (Array.isArray(arr)) {
          return arr.map((t: unknown) => {
            const tx = t as Record<string, unknown>;
            return {
              transactionDate: String(tx["transactionDate"] ?? tx["date"] ?? tx["ngayGiaoDich"] ?? ""),
              creditAmount: Number(tx["creditAmount"] ?? tx["credit"] ?? tx["soTienCo"] ?? 0),
              debitAmount: Number(tx["debitAmount"] ?? tx["debit"] ?? tx["soTienNo"] ?? 0),
              description: String(tx["description"] ?? tx["content"] ?? tx["moTa"] ?? tx["noiDung"] ?? ""),
              refNo: String(tx["refNo"] ?? tx["referenceNo"] ?? tx["transactionId"] ?? `msb_digi_${Date.now()}`),
              balance: Number(tx["balance"] ?? tx["runningBalance"] ?? 0),
            };
          });
        }
      }
    } catch { /* try next */ }
  }
  return [];
}

// ─── Main Service Class ──────────────────────────────────────────────────────

export interface MSBDigiBankStatus {
  loggedIn: boolean;
  running: boolean;
  accountNumber: string | null;
  accountList: DigiAccount[];
  lastError: string | null;
  username: string | null;
  tokenExpiry: number | null;
}

class MSBDigiBankService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private loggedIn = false;
  private running = false;
  private lastError: string | null = null;
  private username: string | null = null;
  private accountNumber: string | null = null;
  private accountList: DigiAccount[] = [];
  private pollingTimer: NodeJS.Timeout | null = null;

  getStatus(): MSBDigiBankStatus {
    return {
      loggedIn: this.loggedIn,
      running: this.running,
      accountNumber: this.accountNumber,
      accountList: this.accountList,
      lastError: this.lastError,
      username: this.username,
      tokenExpiry: this.tokenExpiry,
    };
  }

  // ── Core login: PKCE + Keycloak browser simulation ─────────────────────────
  async login(
    username: string,
    password: string,
    onProgress?: (msg: string) => void,
  ): Promise<{ success: boolean; message: string; accounts?: DigiAccount[] }> {
    const notify = (msg: string) => { logger.info(msg); onProgress?.(msg); };

    try {
      notify("🔐 MSB DigiBank: bắt đầu đăng nhập...");

      // 1. Generate PKCE
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = crypto.randomBytes(24).toString("base64url");
      const nonce = crypto.randomBytes(24).toString("base64url");

      // 2. GET auth URL → parse Keycloak login form
      const authUrl = `${AUTH_ENDPOINT}?response_type=code&client_id=${CLIENT_ID}&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid&code_challenge=${codeChallenge}&code_challenge_method=S256&nonce=${nonce}&ui_locales=vi`;

      notify("   📡 Đang lấy trang đăng nhập...");
      const { text: loginHtml, jar, status: loginStatus } = await httpGet(authUrl, {});

      if (loginStatus !== 200) {
        return { success: false, message: `Không lấy được trang đăng nhập: HTTP ${loginStatus}` };
      }

      const actionUrl = parseActionUrl(loginHtml);
      if (!actionUrl) {
        logger.warn({ html: loginHtml.slice(0, 500) }, "MSB DigiBank: không parse được action URL");
        return { success: false, message: "Không tìm thấy form đăng nhập trong trang Keycloak" };
      }

      notify(`   ✅ Đã lấy form action`);

      // 3. POST credentials to Keycloak action URL
      notify("   📤 Đang gửi thông tin đăng nhập...");
      const postBody = new URLSearchParams({
        username,
        password,
        rememberMe: "on",
        credentialId: "",
      }).toString();

      const { jar: jar2, status: postStatus, location } = await httpPost(
        actionUrl,
        postBody,
        jar,
        authUrl,
        false,
      );

      notify(`   📨 Phản hồi: HTTP ${postStatus}, location: ${location?.slice(0, 80) ?? "none"}`);

      // 4. Extract authorization code from redirect
      let authCode: string | null = null;
      let finalLocation = location;

      // Follow redirects to capture the auth code
      for (let i = 0; i < 8 && finalLocation; i++) {
        const urlObj = (() => { try { return new URL(finalLocation); } catch { return null; } })();
        if (!urlObj) break;

        const code = urlObj.searchParams.get("code");
        if (code) {
          authCode = code;
          break;
        }

        // If redirect goes to identity server, follow it
        if (finalLocation.includes(IDENTITY_BASE.replace("https://", ""))) {
          const r = await httpGet(finalLocation, jar2, actionUrl, false);
          finalLocation = r.location;
        } else {
          // Final redirect to digibank.msb.com.vn — extract code
          const code2 = urlObj.searchParams.get("code");
          if (code2) { authCode = code2; break; }
          // Don't follow external redirects
          break;
        }
      }

      // If 302 to redirect_uri directly, parse code from location
      if (!authCode && location) {
        const match = location.match(/[?&]code=([^&]+)/);
        if (match) authCode = match[1]!;
      }

      if (!authCode) {
        // Check if login failed (still on login page)
        if (postStatus === 200 && loginHtml.includes("kc-feedback-text") || location?.includes("error")) {
          return { success: false, message: "Sai tên đăng nhập hoặc mật khẩu MSB DigiBank" };
        }
        return { success: false, message: `Không lấy được authorization code (status: ${postStatus}, location: ${location ?? "none"})` };
      }

      notify(`   🎫 Đã lấy authorization code`);

      // 5. Exchange code for tokens
      notify("   🔑 Đang lấy access token...");
      const tokens = await exchangeCodeForTokens(authCode, codeVerifier);

      if (!tokens) {
        return { success: false, message: "Token exchange thất bại — code có thể đã hết hạn" };
      }

      // 6. Store tokens
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.tokenExpiry = Date.now() + tokens.expiresIn * 1000;
      this.loggedIn = true;
      this.lastError = null;
      this.username = username;

      // Save credentials
      setCredentials({
        msb_digibank_username: username,
        msb_digibank_password: password,
        msb_digibank_refresh_token: tokens.refreshToken,
      });

      notify("   ✅ Đã lấy access token!");

      // 7. Fetch account list
      notify("   💳 Đang lấy danh sách tài khoản...");
      const accounts = await fetchAccounts(tokens.accessToken);
      this.accountList = accounts;
      if (accounts.length > 0) {
        this.accountNumber = accounts[0]!.accountNumber;
        notify(`   💰 Tài khoản: ${accounts.map(a => a.accountNumber).join(", ")}`);
      } else {
        notify("   ⚠️ Không lấy được danh sách tài khoản (API endpoint chưa xác định)");
      }

      logger.info({ username, accounts: accounts.length }, "✅ MSB DigiBank: đăng nhập thành công");
      return {
        success: true,
        message: `Đăng nhập MSB DigiBank thành công! ${accounts.length > 0 ? `Tìm thấy ${accounts.length} tài khoản.` : "Cần xác định API endpoint tài khoản."}`,
        accounts,
      };

    } catch (err: any) {
      logger.error({ err }, "MSB DigiBank: login error");
      this.lastError = err.message;
      return { success: false, message: `Lỗi đăng nhập: ${err.message}` };
    }
  }

  // ── Ensure token is valid, refresh if needed ──────────────────────────────
  private async ensureToken(): Promise<boolean> {
    if (!this.accessToken || !this.tokenExpiry) return false;

    // Refresh 60 seconds before expiry
    if (Date.now() < this.tokenExpiry - 60_000) return true;

    if (!this.refreshToken) {
      this.loggedIn = false;
      return false;
    }

    logger.info("MSB DigiBank: refreshing access token...");
    const tokens = await refreshAccessToken(this.refreshToken);
    if (!tokens) {
      this.loggedIn = false;
      this.lastError = "Token hết hạn — cần đăng nhập lại";
      return false;
    }

    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenExpiry = Date.now() + tokens.expiresIn * 1000;
    setCredentials({ msb_digibank_refresh_token: tokens.refreshToken });
    return true;
  }

  // ── Poll transactions ─────────────────────────────────────────────────────
  async poll(): Promise<void> {
    if (!this.loggedIn || !this.accessToken || !this.accountNumber) return;

    const ok = await this.ensureToken();
    if (!ok) return;

    try {
      const txs = await fetchTransactions(this.accessToken!, this.accountNumber!);
      logger.info({ count: txs.length, account: this.accountNumber }, "MSB DigiBank: fetched transactions");

      for (const tx of txs) {
        if (tx.creditAmount <= 0 || !tx.refNo) continue;
        // Upsert into DB
        await db
          .insert(bankTransactionsTable)
          .values({
            refNo: tx.refNo,
            amount: String(tx.creditAmount),
            description: tx.description,
            transactionDate: tx.transactionDate,
          })
          .onConflictDoNothing();
      }
    } catch (err: any) {
      logger.error({ err }, "MSB DigiBank: poll error");
      this.lastError = err.message;
    }
  }

  // ── Fetch transactions on demand ─────────────────────────────────────────
  async getTransactions(
    accountNumber?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<{ success: boolean; transactions?: DigiTransaction[]; message?: string }> {
    const ok = await this.ensureToken();
    if (!ok) return { success: false, message: "Chưa đăng nhập hoặc token hết hạn" };

    const account = accountNumber ?? this.accountNumber;
    if (!account) return { success: false, message: "Chưa có tài khoản — cần chọn tài khoản" };

    try {
      const txs = await fetchTransactions(this.accessToken!, account, fromDate, toDate);
      return { success: true, transactions: txs };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ── Start auto polling ────────────────────────────────────────────────────
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.poll();
    this.pollingTimer = setInterval(() => { void this.poll(); }, POLL_INTERVAL_MS);
    logger.info("MSB DigiBank: polling started");
  }

  stop(): void {
    this.running = false;
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    logger.info("MSB DigiBank: polling stopped");
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.loggedIn = false;
    this.running = false;
    this.lastError = null;
    this.accountNumber = null;
    this.accountList = [];
    this.stop();
  }

  setAccountNumber(accountNumber: string): void {
    this.accountNumber = accountNumber;
    setCredentials({ msb_digibank_account_number: accountNumber });
  }
}

export const msbDigiBankService = new MSBDigiBankService();
