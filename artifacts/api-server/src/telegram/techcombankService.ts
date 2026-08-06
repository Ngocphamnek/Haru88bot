/**
 * Techcombank Direct Integration
 * Uses Keycloak OpenID Connect web form login (onlinebanking.techcombank.com.vn)
 * Flow: GET login page → parse form action → POST credentials → 
 *       if push confirmation needed → background poll → exchange code → access token
 */
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import * as zlib from "node:zlib";
import { db } from "@workspace/db";
import { bankTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getCredential } from "../lib/bankCredStore.js";
import { storage } from "../lib/storage.js";

// ─── Number parser (handles Vietnamese format: "2.500.000" or "2,500,000") ──
function parseVNNumber(v: any): number {
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (!v && v !== 0) return 0;
  const s = String(v).trim().replace(/\s/g, "");
  // VN uses dots as thousands sep and comma as decimal point
  const withoutThousands = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(withoutThousands);
  return isNaN(n) ? 0 : n;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TCB_HOST   = "onlinebanking.techcombank.com.vn";
const TCB_BASE   = `https://${TCB_HOST}`;
const REALM      = "backbase";
const CLIENT_ID  = "tcb-web-client";
const REDIRECT_URI = `${TCB_BASE}/`;
const API_MS_BASE = "/api";
const CHANNEL     = "ONLINEBANKING";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TCBSession {
  accessToken: string;
  refreshToken?: string;
  username: string;
  loggedIn: boolean;
}

interface TCBAccount {
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  accountType: string;
}

export interface TCBTransaction {
  transactionDate: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
  refNo: string;
  balance?: number;
}

// ─── Low-level HTTP helpers ───────────────────────────────────────────────────

interface RawResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  location?: string;
}

/** Make a raw HTTP/HTTPS request without auto-following redirects */
function rawRequest(
  method: "GET" | "POST",
  url: string,
  options: {
    headers?: Record<string, string>;
    body?: string;
    followRedirects?: boolean;
    maxRedirects?: number;
    cookieJar?: Map<string, string>;
  } = {}
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const { headers = {}, body, followRedirects = false, maxRedirects = 5, cookieJar } = options;

    function doRequest(reqUrl: string, redirectsLeft: number): void {
      const parsed = new URL(reqUrl);
      const isHttps = parsed.protocol === "https:";
      const port = parsed.port ? parseInt(parsed.port) : (isHttps ? 443 : 80);

      // Build Cookie header from jar
      let cookieHeader = "";
      if (cookieJar && cookieJar.size > 0) {
        cookieHeader = [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      }

      const reqHeaders: Record<string, string> = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        "User-Agent": BROWSER_UA,
        "Connection": "keep-alive",
        ...headers,
      };
      if (cookieHeader) reqHeaders["Cookie"] = cookieHeader;
      if (body) {
        reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
        reqHeaders["Content-Length"] = String(Buffer.byteLength(body));
      }

      const reqOptions: https.RequestOptions = {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method,
        headers: reqHeaders,
      };

      const lib = isHttps ? https : http;
      const req = (lib as typeof https).request(reqOptions, (res) => {
        // Capture Set-Cookie headers into jar
        const setCookieHeaders = res.headers["set-cookie"] ?? [];
        if (cookieJar) {
          for (const cookieStr of setCookieHeaders) {
            const [pair] = cookieStr.split(";");
            if (!pair) continue;
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) continue;
            const name = pair.slice(0, eqIdx).trim();
            const val = pair.slice(eqIdx + 1).trim();
            if (name) cookieJar.set(name, val);
          }
        }

        const location = res.headers["location"];
        const status = res.statusCode ?? 0;

        // Follow redirects if requested
        if (followRedirects && [301, 302, 303, 307, 308].includes(status) && location && redirectsLeft > 0) {
          const nextUrl = location.startsWith("http") ? location : new URL(location, reqUrl).href;
          const nextMethod = [301, 302, 303].includes(status) ? "GET" : method;
          rawRequest(nextMethod, nextUrl, { ...options, body: nextMethod === "GET" ? undefined : body })
            .then(resolve)
            .catch(reject);
          res.resume();
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const respHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) respHeaders[k] = v;
          }
          const raw = Buffer.concat(chunks);
          const encoding = res.headers["content-encoding"];
          const finish = (decoded: Buffer) => {
            resolve({
              status,
              headers: respHeaders,
              body: decoded.toString("utf-8"),
              location: typeof location === "string" ? location : undefined,
            });
          };
          if (encoding === "gzip") {
            zlib.gunzip(raw, (err, buf) => finish(err ? raw : buf));
          } else if (encoding === "deflate") {
            zlib.inflate(raw, (err, buf) => finish(err ? raw : buf));
          } else if (encoding === "br") {
            zlib.brotliDecompress(raw, (err, buf) => finish(err ? raw : buf));
          } else {
            finish(raw);
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(25000, () => { req.destroy(); reject(new Error("Request timeout")); });
      if (body) req.write(body);
      req.end();
    }

    doRequest(url, maxRedirects);
  });
}

/** Parse Keycloak form action from the login page HTML */
function parseFormAction(html: string): string | null {
  const match = html.match(/action="([^"]+)"/);
  if (!match) return null;
  return match[1]!.replace(/&amp;/g, "&");
}

/** URL-encode a form body */
function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** JSON API request using Bearer token */
async function apiRequest(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  token?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "identity",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "x-channel": CHANNEL,
    "x-client-id": CLIENT_ID,
    "User-Agent": BROWSER_UA,
    "Origin": TCB_BASE,
    "Referer": `${TCB_BASE}/`,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const bodyStr = body ? JSON.stringify(body) : undefined;
  if (bodyStr) headers["Content-Length"] = String(Buffer.byteLength(bodyStr));

  const res = await rawRequest(method, `${TCB_BASE}${API_MS_BASE}${path}`, {
    headers,
    body: bodyStr,
  });

  try {
    const parsed = res.body.trim() ? JSON.parse(res.body) : {};
    return { status: res.status, data: parsed };
  } catch {
    return { status: res.status, data: { raw: res.body } };
  }
}

/** Exchange an authorization code for tokens */
async function exchangeCode(cookieJar: Map<string, string>, code: string): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const tokenEndpoint = `${TCB_BASE}/auth/realms/${REALM}/protocol/openid-connect/token`;
  const tokenBody = formEncode({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const tokenRes = await rawRequest("POST", tokenEndpoint, {
    cookieJar,
    body: tokenBody,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": TCB_BASE,
      "Origin": TCB_BASE,
    },
  });

  let tokenData: any;
  try {
    tokenData = JSON.parse(tokenRes.body);
  } catch {
    return null;
  }

  if (!tokenData?.access_token) return null;
  return { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token };
}

/** Extract code from a redirect location string */
function extractCode(location: string): string | null {
  try {
    const url = new URL(location.startsWith("http") ? location : `${TCB_BASE}${location}`);
    return url.searchParams.get("code");
  } catch {
    const match = location.match(/[?&]code=([^&]+)/);
    return match?.[1] ?? null;
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;
const CONFIRM_POLL_MS  = 3_000;   // how often to poll for push confirmation
const CONFIRM_TIMEOUT_MS = 3 * 60 * 1000;  // 3 minutes max wait

class TechcombankService {
  private session: TCBSession | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private accountNumber = "";

  // Pending push confirmation state
  private pendingConfirmation = false;
  private pendingCookieJar: Map<string, string> | null = null;
  private pendingAuthUrl: string | null = null;
  private pendingUsername = "";
  private confirmTimer: NodeJS.Timeout | null = null;

  // ── Keycloak Login Flow ─────────────────────────────────────────────────
  async login(usernameOverride?: string, passwordOverride?: string): Promise<{ success: boolean; message: string; pendingConfirmation?: boolean }> {
    const username = usernameOverride ?? getCredential("tcb_username");
    const password = passwordOverride ?? getCredential("tcb_password");

    if (!username || !password) {
      return { success: false, message: "Chưa cấu hình thông tin đăng nhập Techcombank" };
    }

    // Clear any previous pending state
    this._clearPending();

    try {
      logger.info({ username }, "Techcombank: Keycloak login starting...");

      const cookieJar = new Map<string, string>();

      // ── Step 1: GET the Keycloak login page ─────────────────────────────
      const authUrl =
        `${TCB_BASE}/auth/realms/${REALM}/protocol/openid-connect/auth` +
        `?response_type=code&client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=openid%20profile%20email`;

      const loginPageRes = await rawRequest("GET", authUrl, {
        cookieJar,
        headers: { "Referer": `${TCB_BASE}/` },
      });

      if (loginPageRes.status !== 200) {
        logger.warn({ status: loginPageRes.status }, "Techcombank: failed to load login page");
        return { success: false, message: `Không tải được trang đăng nhập (HTTP ${loginPageRes.status})` };
      }

      const formAction = parseFormAction(loginPageRes.body);
      if (!formAction) {
        logger.warn("Techcombank: could not parse form action from login page");
        return { success: false, message: "Không parse được form action từ trang đăng nhập" };
      }

      logger.info({ formAction: formAction.substring(0, 80) + "..." }, "Techcombank: login form action found");

      // ── Step 2: POST credentials to form action ─────────────────────────
      const formBody = formEncode({
        username,
        password,
        credentialId: "",
        threatMetrixBrowserType: "DESKTOP_BROWSER",
        login: "Đăng nhập",
      });

      const submitRes = await rawRequest("POST", formAction, {
        cookieJar,
        body: formBody,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": authUrl,
          "Origin": TCB_BASE,
        },
      });

      // Check if credentials were wrong (wrong password = stays on login page with error)
      if (submitRes.status === 200) {
        const body = submitRes.body;
        if (
          body.includes("Sai tên đăng nhập") ||
          body.includes("Invalid credentials") ||
          body.includes("invalid_credentials") ||
          (body.includes("kc-form-login") && body.includes("alert-error"))
        ) {
          return { success: false, message: "Sai tên đăng nhập hoặc mật khẩu" };
        }

        // Status 200 but no error → waiting for push confirmation / Smart OTP
        // Try to find a continuation action URL in the page body
        const bodyAction = parseFormAction(body);
        const continuationUrl = bodyAction && bodyAction.startsWith("http") ? bodyAction : formAction;
        logger.info({ username, bodyLen: body.length, continuationUrl: continuationUrl.substring(0, 80) },
          "Techcombank: credentials submitted, waiting for push confirmation...");

        this._startPendingConfirmation(cookieJar, continuationUrl, username);
        return {
          success: false,
          pendingConfirmation: true,
          message: "Vui lòng xác nhận đăng nhập trên ứng dụng TCB. Hệ thống sẽ tự động hoàn tất sau khi bạn xác nhận.",
        };
      }

      // Check redirect response
      const redirectLocation = submitRes.location ?? submitRes.headers["location"];
      const locationStr = Array.isArray(redirectLocation) ? redirectLocation[0] : redirectLocation;

      if (!locationStr) {
        logger.warn({ status: submitRes.status, bodySnippet: submitRes.body.substring(0, 300) }, "Techcombank: no redirect after login");
        return { success: false, message: "Đăng nhập thất bại — không nhận được redirect" };
      }

      // ── Step 3: Check redirect destination ──────────────────────────────

      // Redirect to redirect_uri?code= → direct success
      const code = extractCode(locationStr);
      if (code) {
        logger.info("Techcombank: authorization code received directly, exchanging for token...");
        const tokens = await exchangeCode(cookieJar, code);
        if (!tokens) {
          return { success: false, message: "Lấy token thất bại" };
        }
        this.session = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, username, loggedIn: true };
        this.accountNumber = getCredential("tcb_account_number");
        logger.info({ username }, "✅ Techcombank: Login successful (direct)");
        return { success: true, message: "Đăng nhập thành công" };
      }

      // Redirect to intermediate page (waiting/OTP page):
      // Use the REDIRECT TARGET as the polling URL — that is the live Keycloak action URL
      // that will eventually 302→redirect_uri?code= once user approves push
      const waitingUrl = locationStr.startsWith("http") ? locationStr : `${TCB_BASE}${locationStr}`;
      logger.info({ waitingUrl: waitingUrl.substring(0, 120) }, "Techcombank: redirected to intermediate page, polling from there...");

      // Follow the waiting page once to update cookies, then poll from it
      try {
        const waitingPageRes = await rawRequest("GET", waitingUrl, {
          cookieJar,
          headers: { "Referer": formAction },
        });
        // If the waiting page itself already has the code in redirect
        const waitingLocation = waitingPageRes.location ?? String(waitingPageRes.headers["location"] ?? "");
        if (waitingLocation) {
          const directCode = extractCode(waitingLocation);
          if (directCode) {
            logger.info("Techcombank: code found immediately after redirect follow");
            const tokens = await exchangeCode(cookieJar, directCode);
            if (tokens) {
              this.session = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, username, loggedIn: true };
              this.accountNumber = getCredential("tcb_account_number");
              return { success: true, message: "Đăng nhập thành công" };
            }
          }
        }
      } catch {
        // Non-fatal — continue to pending state
      }

      this._startPendingConfirmation(cookieJar, waitingUrl, username);
      return {
        success: false,
        pendingConfirmation: true,
        message: "Vui lòng xác nhận đăng nhập trên ứng dụng TCB. Hệ thống sẽ tự động hoàn tất sau khi bạn xác nhận.",
      };

    } catch (err: any) {
      logger.error({ err }, "❌ Techcombank: login error");
      return { success: false, message: err.message ?? "Lỗi không xác định" };
    }
  }

  // ── Pending confirmation background poll ────────────────────────────────
  private _startPendingConfirmation(cookieJar: Map<string, string>, authUrl: string, username: string): void {
    this._clearPending();
    this.pendingConfirmation = true;
    this.pendingCookieJar = cookieJar;
    this.pendingAuthUrl = authUrl;
    this.pendingUsername = username;

    const startTime = Date.now();

    logger.info({ username }, "🔔 Techcombank: Waiting for push confirmation (polling every 3s, timeout 3min)...");

    const tryCompleteWithCode = async (code: string): Promise<boolean> => {
      logger.info({ username }, "✅ Techcombank: Push confirmed! Exchanging code for token...");
      const tokens = await exchangeCode(this.pendingCookieJar!, code);
      if (!tokens) return false;
      this.session = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        username,
        loggedIn: true,
      };
      this.accountNumber = getCredential("tcb_account_number");
      this._clearPending();
      if (!this.pollingTimer) {
        this.pollingTimer = setInterval(async () => {
          if (!this.isPolling) await this.poll();
        }, POLL_INTERVAL_MS);
        logger.info({ intervalMs: POLL_INTERVAL_MS }, "🏦 Techcombank polling started after push confirm");
      }
      return true;
    };

    const poll = async () => {
      if (!this.pendingConfirmation || !this.pendingCookieJar || !this.pendingAuthUrl) return;
      if (Date.now() - startTime > CONFIRM_TIMEOUT_MS) {
        logger.warn({ username }, "⏰ Techcombank: Push confirmation timeout (3 min)");
        this._clearPending();
        return;
      }

      try {
        // GET the waiting/continuation URL — Keycloak will redirect to redirect_uri?code= once user approves
        const checkRes = await rawRequest("GET", this.pendingAuthUrl, {
          cookieJar: this.pendingCookieJar,
          headers: {
            "Referer": TCB_BASE,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });

        // 1. Check Location header for code
        const location = checkRes.location ?? String(checkRes.headers["location"] ?? "");
        if (location) {
          const code = extractCode(location);
          if (code) {
            await tryCompleteWithCode(code);
            return;
          }

          // If redirect is to another intermediate page, follow it and update pendingAuthUrl
          if (!location.includes("error=")) {
            const nextUrl = location.startsWith("http") ? location : `${TCB_BASE}${location}`;
            // Only update if it's still on TCB domain and not the redirect_uri itself
            if (nextUrl.includes(TCB_HOST) && !nextUrl.startsWith(REDIRECT_URI + "?")) {
              this.pendingAuthUrl = nextUrl;
              logger.debug({ nextUrl: nextUrl.substring(0, 80) }, "Techcombank: following intermediate redirect in poll");
            }
          }

          // Redirect indicates error or denial
          if (location.includes("error=") && !location.includes("code=")) {
            logger.warn({ location: location.substring(0, 120) }, "Techcombank: confirmation denied or error redirect");
            this._clearPending();
            return;
          }
        }

        // 2. Check body for authorization code (some Keycloak flows embed it in the page)
        if (checkRes.body) {
          const bodyCodeMatch = checkRes.body.match(/[?&]code=([a-zA-Z0-9._\-]+)/);
          if (bodyCodeMatch?.[1]) {
            await tryCompleteWithCode(bodyCodeMatch[1]);
            return;
          }
          // Embedded in a <meta redirect> or JS window.location
          const metaMatch = checkRes.body.match(/(?:href|location)[=:]["']([^"']*[?&]code=[^"']+)["']/);
          if (metaMatch?.[1]) {
            const code = extractCode(metaMatch[1]);
            if (code) {
              await tryCompleteWithCode(code);
              return;
            }
          }
        }

        // Session error on page body → give up
        if (
          checkRes.status === 200 &&
          checkRes.body &&
          checkRes.body.includes("kc-form-login") &&
          checkRes.body.includes("alert-error")
        ) {
          logger.warn({ username }, "Techcombank: confirmation failed — invalid session on poll");
          this._clearPending();
          return;
        }

        // Still waiting — schedule next poll
        this.confirmTimer = setTimeout(poll, CONFIRM_POLL_MS);
      } catch (err) {
        logger.debug({ err }, "Techcombank: confirmation poll error (will retry)");
        this.confirmTimer = setTimeout(poll, CONFIRM_POLL_MS * 2);
      }
    };

    this.confirmTimer = setTimeout(poll, CONFIRM_POLL_MS);
  }

  private _clearPending(): void {
    this.pendingConfirmation = false;
    this.pendingCookieJar = null;
    this.pendingAuthUrl = null;
    this.pendingUsername = "";
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
  }

  // ── Refresh token via Keycloak ──────────────────────────────────────────
  private async refreshToken(): Promise<boolean> {
    if (!this.session?.refreshToken) return false;
    try {
      const tokenEndpoint = `${TCB_BASE}/auth/realms/${REALM}/protocol/openid-connect/token`;
      const body = formEncode({
        grant_type: "refresh_token",
        client_id: CLIENT_ID,
        refresh_token: this.session.refreshToken,
      });

      const res = await rawRequest("POST", tokenEndpoint, {
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const data = JSON.parse(res.body);
      if (data?.access_token) {
        this.session.accessToken = data.access_token;
        if (data.refresh_token) this.session.refreshToken = data.refresh_token;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ── Probe multiple API endpoint paths to find the correct one ─────────
  async probeApiEndpoints(): Promise<Record<string, any>> {
    if (!this.session?.loggedIn || !this.session.accessToken) {
      return { error: "Not logged in" };
    }
    const token = this.session.accessToken;
    // API_MS_BASE = "/api", so these resolve to /api/{path}
    const paths = [
      "/user-manager/client-api/v2/users/me",
      "/arrangement-manager/client-api/v2/productsummary/context/arrangements",
      "/arrangement-manager/client-api/v2/productsummary",
      "/arrangement-manager/client-api/v2/arrangements",
      "/arrangement-manager/client-api/v2/productsummary/context/arrangements?businessFunction=DEBIT_ACCOUNT&privilege=view",
    ];
    const results: Record<string, any> = {};
    for (const path of paths) {
      try {
        const res = await apiRequest("GET", path, undefined, token);
        const isHtml = typeof res.data?.raw === "string" && res.data.raw.trim().startsWith("<!DOCTYPE");
        results[path] = {
          status: res.status,
          isHtml,
          dataType: Array.isArray(res.data) ? `array[${res.data.length}]` : typeof res.data,
          keys: Array.isArray(res.data) ? undefined : Object.keys(res.data ?? {}).slice(0, 10),
          snippet: isHtml ? "<HTML PAGE>" : JSON.stringify(res.data).slice(0, 200),
        };
      } catch (err: any) {
        results[path] = { error: err.message };
      }
    }
    return results;
  }

  // ── Get accounts ───────────────────────────────────────────────────────
  async getAccounts(): Promise<TCBAccount[]> {
    if (!this.session?.loggedIn) return [];
    try {
      // Backbase productsummary endpoint — returns grouped accounts
      const res = await apiRequest("GET", "/arrangement-manager/client-api/v2/productsummary", undefined, this.session.accessToken);
      logger.info({ status: res.status, dataKeys: Array.isArray(res.data) ? `array[${res.data.length}]` : Object.keys(res.data ?? {}).join(","), dataSnippet: JSON.stringify(res.data).slice(0, 500) }, "TCB getAccounts: raw response");
      if (res.status === 401) {
        const refreshed = await this.refreshToken();
        if (!refreshed) { this.session.loggedIn = false; return []; }
        return this.getAccounts();
      }

      // Backbase productsummary shape:
      // { currentAccounts: { products: [...] }, savingsAccounts: { products: [...] }, ... }
      const d = res.data;
      const sections = ["currentAccounts", "savingsAccounts", "termDeposits", "loans", "creditCards", "investmentAccounts", "customProductKinds"];
      const rawList: any[] = sections.flatMap(key => {
        const section = d?.[key];
        if (!section) return [];
        if (Array.isArray(section?.products)) return section.products;
        if (Array.isArray(section)) return section;
        return [];
      });

      // Also handle flat array / other shapes
      if (rawList.length === 0) {
        const flat: any[] =
          Array.isArray(d) ? d :
          Array.isArray(d?.accounts) ? d.accounts :
          Array.isArray(d?.items) ? d.items :
          [];
        rawList.push(...flat);
      }

      if (rawList.length === 0) {
        logger.warn({ status: res.status, snippet: JSON.stringify(d).slice(0, 300) }, "TCB getAccounts: no accounts found in productsummary response");
      }

      return rawList.map((a: any) => ({
        accountNumber: a.BBAN ?? a.accountNumber ?? a.accountNo ?? a.number ?? a.id ?? "",
        accountName: a.name ?? a.displayName ?? a.accountName ?? a.accountHolderName ?? "",
        balance: parseVNNumber(a.currentBalance ?? a.availableBalance ?? a.balance ?? a.amount ?? 0),
        currency: (a.currency ?? "VND").toString().toUpperCase(),
        accountType: a.productKind ?? a.accountType ?? a.type ?? "DEMAND",
      }));
    } catch (err) {
      logger.error({ err }, "Techcombank: getAccounts error");
      return [];
    }
  }

  // ── Get transactions ────────────────────────────────────────────────────
  async getTransactions(accountNumber: string, fromDate: string, toDate: string): Promise<TCBTransaction[]> {
    if (!this.session?.loggedIn) return [];
    try {
      // Backbase v3 transaction endpoint — GET with query params
      const params = new URLSearchParams({
        arrangementId: accountNumber,
        bookingDateGreaterThan: fromDate,
        bookingDateLessThan: toDate,
        size: "100",
        from: "0",
      });
      const res = await apiRequest("GET", `/transaction-manager/client-api/v3/transactions?${params}`, undefined, this.session.accessToken);

      if (res.status === 401) {
        const refreshed = await this.refreshToken();
        if (!refreshed) { this.session.loggedIn = false; return []; }
        return this.getTransactions(accountNumber, fromDate, toDate);
      }

      // Backbase v3 response: array or { transactionItems: [...] } or { data: [...] }
      const raw = res.data;
      const list: any[] =
        Array.isArray(raw) ? raw :
        Array.isArray(raw?.transactionItems) ? raw.transactionItems :
        Array.isArray(raw?.transactions) ? raw.transactions :
        Array.isArray(raw?.data) ? raw.data :
        Array.isArray(raw?.items) ? raw.items :
        [];
      return list.map((t: any) => ({
        transactionDate: t.bookingDate ?? t.transactionDate ?? t.txDate ?? t.date ?? "",
        creditAmount: parseVNNumber(
          t.creditAmount ?? t.credit ??
          ((t.creditDebitIndicator ?? t.type) === "CRDT" || (t.creditDebitIndicator ?? t.type) === "CR" ? (t.transactionAmountCurrency?.amount ?? t.amount) : 0) ?? 0
        ),
        debitAmount: parseVNNumber(
          t.debitAmount ?? t.debit ??
          ((t.creditDebitIndicator ?? t.type) === "DBIT" || (t.creditDebitIndicator ?? t.type) === "DR" ? (t.transactionAmountCurrency?.amount ?? t.amount) : 0) ?? 0
        ),
        description: t.description ?? t.narration ?? t.remark ?? t.remittanceInformation ?? "",
        refNo: t.externalId ?? t.refNo ?? t.referenceNo ?? t.id ?? "",
        balance: parseVNNumber(t.runningBalance ?? t.availableBalance ?? t.balance ?? t.currentBalance ?? 0),
      }));
    } catch (err) {
      logger.error({ err }, "Techcombank: getTransactions error");
      return [];
    }
  }

  // ── Extract user from description ──────────────────────────────────────
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

  // ── Process deposit ────────────────────────────────────────────────────
  private async processDeposit(tx: TCBTransaction): Promise<void> {
    const refNo = tx.refNo || `tcb_${tx.transactionDate}_${tx.creditAmount}`;
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
      logger.warn({ refNo, description: tx.description }, "Techcombank: deposit no user match");
      return;
    }

    const user = await storage.getBotUser(userId);
    if (!user) {
      logger.warn({ refNo, userId }, "Techcombank: deposit user not found");
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
      metadata: { refNo, description: tx.description, transactionDate: tx.transactionDate, bank: "Techcombank" },
    });

    await db
      .update(bankTransactionsTable)
      .set({ processed: true, processedAt: new Date(), userId })
      .where(eq(bankTransactionsTable.refNo, refNo));

    logger.info({ refNo, userId, amount: creditAmount, bank: "Techcombank" }, "✅ Techcombank deposit credited");

    try {
      const { telegramBotService } = await import("./telegramBot.js");
      await telegramBotService.notifyPaymentSuccess(userId, creditAmount, refNo);
    } catch (err) {
      logger.error({ err }, "Techcombank: notify user failed");
    }
  }

  // ── Poll ────────────────────────────────────────────────────────────────
  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      if (!this.session?.loggedIn) {
        const r = await this.login();
        if (!r.success) return;
      }

      const accountNumber = this.accountNumber || getCredential("tcb_account_number");
      if (!accountNumber) {
        logger.warn("Techcombank: no account number — skipping poll");
        return;
      }

      const now  = new Date();
      const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fmt  = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const txs  = await this.getTransactions(accountNumber, fmt(from), fmt(now));

      for (const tx of txs) {
        if (tx.creditAmount > 0) await this.processDeposit(tx);
      }
      logger.info({ count: txs.filter(t => t.creditAmount > 0).length }, "📊 Techcombank poll complete");
    } catch (err) {
      logger.error({ err }, "❌ Techcombank poll error");
      this.session = null;
    } finally {
      this.isPolling = false;
    }
  }

  // ── Start / Stop ─────────────────────────────────────────────────────────
  async start(): Promise<void> {
    const username = getCredential("tcb_username");
    const password = getCredential("tcb_password");
    if (!username || !password) {
      logger.info("Techcombank service not started: credentials missing");
      return;
    }
    if (this.pollingTimer) return;

    const r = await this.login();
    if (!r.success && !r.pendingConfirmation) logger.warn("Techcombank: initial login failed — will retry on next poll");

    if (!r.pendingConfirmation) {
      this.pollingTimer = setInterval(async () => {
        if (!this.isPolling) await this.poll();
      }, POLL_INTERVAL_MS);
      logger.info({ intervalMs: POLL_INTERVAL_MS }, "🏦 Techcombank polling started");
    }
  }

  stop(): void {
    this._clearPending();
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    this.stopActivePoll();
    logger.info("🏦 Techcombank polling stopped");
  }

  // ── Active polling (5s) — bật khi có lệnh nạp đang chờ ──────────────────
  private activePollTimer: NodeJS.Timeout | null = null;
  private readonly ACTIVE_POLL_MS = 5_000;

  startActivePoll(): void {
    if (this.activePollTimer) return;
    if (!this.pollingTimer) return; // chưa start

    this.activePollTimer = setInterval(async () => {
      if (!this.isPolling) await this.poll();
    }, this.ACTIVE_POLL_MS);
    logger.info({ intervalMs: this.ACTIVE_POLL_MS }, "⚡ Techcombank active polling started (pending deposit)");
  }

  stopActivePoll(): void {
    if (this.activePollTimer) {
      clearInterval(this.activePollTimer);
      this.activePollTimer = null;
      logger.info("⏸ Techcombank active polling stopped");
    }
  }

  getStatus(): { running: boolean; loggedIn: boolean; username: string; accountNumber: string; pendingConfirmation: boolean } {
    return {
      running: !!this.pollingTimer,
      loggedIn: this.session?.loggedIn ?? false,
      username: this.session?.username ?? this.pendingUsername,
      accountNumber: this.accountNumber,
      pendingConfirmation: this.pendingConfirmation,
    };
  }

  async restart(): Promise<{ success: boolean; message: string; pendingConfirmation?: boolean }> {
    this.stop();
    this.session = null;
    this.accountNumber = getCredential("tcb_account_number");
    const username = getCredential("tcb_username");
    const password  = getCredential("tcb_password");
    const result = await this.login(username, password);
    if (result.success) {
      this.pollingTimer = setInterval(async () => {
        if (!this.isPolling) await this.poll();
      }, POLL_INTERVAL_MS);
      logger.info({ intervalMs: POLL_INTERVAL_MS }, "🏦 Techcombank polling started");
    }
    return result;
  }

  /** Cancel pending push confirmation */
  cancelPending(): void {
    this._clearPending();
    logger.info("🔕 Techcombank: push confirmation cancelled");
  }

  logout(): void {
    this.stop();
    this.session = null;
  }
}

export const techcombankService = new TechcombankService();
