/**
 * MSB Bank (Maritime Commercial Joint Stock Bank) Integration
 * Hỗ trợ 3 phương thức:
 * 1. Auto login: username + password → tự động lấy captcha + OCR giải (giống MB Bank)
 * 2. Direct login: username + password + captcha nhập tay
 * 3. Session cookie: paste JSESSIONID từ browser (fallback)
 */
import { Client } from "undici";
import { db } from "@workspace/db";
import { bankTransactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getCredential, setCredentials } from "../lib/bankCredStore.js";
import { storage } from "../lib/storage.js";
import { recognizeMsbCaptcha } from "../lib/msbCaptchaOcr.js";

const MSB_BASE_URL = "https://ebank.msb.com.vn";
const MSB_HOST = "ebank.msb.com.vn";
const POLL_INTERVAL_MS = 60_000;

export interface MSBStatus {
  loggedIn: boolean;
  running: boolean;
  accountNumber: string | null;
  sessionSet: boolean;
  lastError: string | null;
  mode: "auto_login" | "direct_login" | "session_cookie";
  username?: string | null;
  autoLoginRunning?: boolean;
  accounts?: MSBAccount[];
  fetchingAccounts?: boolean;
}

interface MSBTransaction {
  transactionDate: string;
  creditAmount: number;
  debitAmount: number;
  description: string;
  refNo: string;
  balance?: number;
}

export interface MSBAccount {
  accountNumber: string;
  accountName: string;
  currency: string;
  balance: number | null;
}

export interface MSBTransferParams {
  fromAccount: string;
  toAccount: string;
  toName: string;
  amount: number;
  description: string;
  type: "internal" | "interbank";
  bankCode?: string;
}

export interface MSBTransferResult {
  success: boolean;
  message: string;
  otpRequired?: boolean;
  transactionId?: string;
  rawHtml?: string;
}

function parseViVND(s: string): number | null {
  const clean = s.replace(/[^0-9,.\-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function parseAccountsFromHtml(html: string): MSBAccount[] {
  const accounts: MSBAccount[] = [];
  const seen = new Set<string>();

  // ── Strategy 1: tr/td table rows (original, but with relaxed matching) ──
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rowHtml = rowMatch[1]!;
    const cells: string[] = [];
    cellRe.lastIndex = 0;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      const text = cellMatch[1]!.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      cells.push(text);
    }
    // RELAXED: find a 10-16 digit sequence anywhere inside a cell (not just exact match)
    const accIdx = cells.findIndex(c => /(?<!\d)\d{10,16}(?!\d)/.test(c));
    if (accIdx === -1) continue;
    const accMatch = cells[accIdx]!.match(/(?<!\d)(\d{10,16})(?!\d)/);
    if (!accMatch) continue;
    const accountNumber = accMatch[1]!;
    if (seen.has(accountNumber)) continue;
    seen.add(accountNumber);

    const nameCandidate = cells.find((c, i) =>
      i !== accIdx && /[A-ZÁÀẢÃẠĂẮẶẰẴẨÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s]{4,}/i.test(c)
    ) || "";
    const balanceStr = cells.find((c, i) => i > accIdx && /\d/.test(c) && !/^\d{8,}$/.test(c.replace(/\D/g, "")));
    const balance = balanceStr ? parseViVND(balanceStr) : null;
    const currency = cells.find(c => /^(VND|USD|EUR|NVD)$/i.test(c.trim()))?.toUpperCase().replace("NVD", "VND") || "VND";
    accounts.push({ accountNumber, accountName: nameCandidate, currency, balance });
  }

  if (accounts.length > 0) return accounts;

  // ── Strategy 2: Full-text scan — find all 10-16 digit sequences with context ──
  const noScript = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  const stripped = noScript.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

  const accRe = /(?<!\d)(\d{10,16})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = accRe.exec(stripped)) !== null) {
    const accountNumber = m[1]!;
    // Skip: likely timestamps (14+ digits starting with 202), repeated patterns
    if (accountNumber.length >= 13 && accountNumber.startsWith("202")) continue;
    if (seen.has(accountNumber)) continue;
    seen.add(accountNumber);

    // Context around the match for name + balance
    const ctxStart = Math.max(0, m.index - 150);
    const ctx = stripped.slice(ctxStart, m.index + 300);

    const balMatch = ctx.match(/(?<!\d)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:VND|NVD|đ|đồng)/i)
      ?? ctx.match(/(?:Số dư|balance|avail)[^\d]*(\d[\d.,]*)/i);
    const balance = balMatch ? parseViVND(balMatch[1]!) : null;

    // Vietnamese uppercase name pattern
    const nameMatch = ctx.match(/([A-Z][A-ZÁÀẢÃẠĂẮẶẰẴẬÂẤẦẨẪẬĐ][A-ZÁÀẢÃẠĂẮẶẰẴẬÂẤẦẨẪẬĐA-Z\s]{3,30})/);
    const name = nameMatch ? nameMatch[0].trim() : "";

    accounts.push({ accountNumber, accountName: name, currency: "VND", balance });
  }

  return accounts;
}

// ─── undici HTTP client (giống MB Bank) ───────────────────────────────────────

type CookieJar = Record<string, string>;

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "max-age=0",
  "Sec-Ch-Ua": '"Not.A/Brand";v="8", "Chromium";v="134", "Google Chrome";v="134"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
};

function buildCookieStr(cookies: CookieJar): string {
  return Object.entries(cookies)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeCookies(existing: CookieJar, setCookieHeaders: string | string[] | undefined): CookieJar {
  const next: CookieJar = { ...existing };
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : setCookieHeaders ? [setCookieHeaders] : [];
  for (const h of headers) {
    const m = h.match(/^([^=]+)=([^;]*)/);
    if (m) {
      const name = m[1]!.trim();
      const val = m[2]!.trim();
      if (name && !["HttpOnly", "Secure", "Path", "Domain", "SameSite"].includes(name)) {
        next[name] = val;
      }
    }
  }
  return next;
}

// Create a fresh undici client per login attempt — avoids TCP keep-alive RST between redirect chain and captcha fetch
function makeClient(): Client {
  return new Client(MSB_BASE_URL, {
    connect: {
      timeout: 25000,
      rejectUnauthorized: false,
      ALPNProtocols: ["http/1.1"],  // force HTTP/1.1, avoid HTTP/2 fingerprint mismatch
    },
    pipelining: 1,
  });
}

// Polling client — shared, long-lived (used for transaction fetching only)
let _pollClient: Client | null = null;
function getPollClient(): Client {
  if (!_pollClient) _pollClient = makeClient();
  return _pollClient;
}

async function httpGetRaw(
  path: string,
  cookies: CookieJar,
  client?: Client,
  referer?: string,
  maxRedirects = 8,
  extraHeaders?: Record<string, string>,
): Promise<{ buffer: Buffer; cookies: CookieJar; status: number; location?: string; contentType?: string; finalPath: string }> {
  const _client = client ?? makeClient();
  const cookieStr = buildCookieStr(cookies);
  const { statusCode, headers, body } = await _client.request({
    method: "GET",
    path,
    headers: {
      ...DEFAULT_HEADERS,
      "Host": MSB_HOST,
      ...(referer ? { Referer: referer } : {}),
      ...(cookieStr ? { Cookie: cookieStr } : {}),
      ...(extraHeaders ?? {}),
    },
  });

  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const setCookieHeader = headers["set-cookie"] as string | string[] | undefined;
  const newCookies = mergeCookies(cookies, setCookieHeader);
  const location = headers["location"] as string | undefined;

  // Follow redirect manually (so we keep cookies across hops)
  if ((statusCode === 301 || statusCode === 302 || statusCode === 303) && location && maxRedirects > 0) {
    let nextPath: string;
    try {
      const u = new URL(location, MSB_BASE_URL);
      nextPath = u.pathname + u.search;
    } catch {
      nextPath = location;
    }
    return httpGetRaw(nextPath, newCookies, _client, `${MSB_BASE_URL}${path}`, maxRedirects - 1, extraHeaders);
  }

  return {
    buffer,
    cookies: newCookies,
    status: statusCode,
    location,
    contentType: headers["content-type"] as string | undefined,
    finalPath: path,
  };
}

async function httpGet(
  path: string,
  cookies: CookieJar,
  client?: Client,
  referer?: string,
): Promise<{ text: string; cookies: CookieJar; status: number; location?: string; finalPath: string }> {
  const r = await httpGetRaw(path, cookies, client, referer);
  return { text: r.buffer.toString("utf-8"), cookies: r.cookies, status: r.status, location: r.location, finalPath: r.finalPath };
}

async function httpPost(
  path: string,
  body: string,
  cookies: CookieJar,
  client?: Client,
  referer?: string,
): Promise<{ text: string; cookies: CookieJar; status: number; location?: string }> {
  const _client = client ?? makeClient();
  const cookieStr = buildCookieStr(cookies);
  const { statusCode, headers, body: respBody } = await _client.request({
    method: "POST",
    path,
    headers: {
      ...DEFAULT_HEADERS,
      "Host": MSB_HOST,
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(body)),
      "Origin": MSB_BASE_URL,
      "Sec-Fetch-Site": "same-origin",
      ...(referer ? { Referer: referer } : {}),
      ...(cookieStr ? { Cookie: cookieStr } : {}),
    },
    body,
  });

  const chunks: Uint8Array[] = [];
  for await (const chunk of respBody) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf-8");

  const setCookieHeader = headers["set-cookie"] as string | string[] | undefined;
  return {
    text,
    cookies: mergeCookies(cookies, setCookieHeader),
    status: statusCode,
    location: headers["location"] as string | undefined,
  };
}

// ─── Extract hidden fields from HTML form ─────────────────────────────────────

function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const re = /<input[^>]+type=["']?hidden["']?[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0]!;
    const nameM = tag.match(/name=["']([^"']+)["']/i);
    const valueM = tag.match(/value=["']([^"']*)["']/i);
    if (nameM) fields[nameM[1]!] = valueM ? valueM[1]! : "";
  }
  return fields;
}

function extractDseSessionId(html: string, url?: string): string {
  // Try from URL param
  if (url) {
    const m = url.match(/dse_sessionId=([^&]+)/);
    if (m) return m[1]!;
  }
  // Try from form hidden fields
  const m2 = html.match(/dse_sessionId["':\s=]+([A-Za-z0-9_\-]{8,})/);
  if (m2) return m2[1]!;
  return "";
}

// Trích JS redirect từ window.location.href = '...' hoặc window.location = '...'
function extractJsRedirect(html: string): string | null {
  const m = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1]! : null;
}

// ─── Parse transactions from MSB IBSRetail HTML ─────────────────────────────

function parseTransactionsFromHtml(html: string): MSBTransaction[] {
  const txs: MSBTransaction[] = [];

  // Try JSON embedded in page
  const jsonMatch = html.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
      for (const item of arr) {
        const credit = parseFloat(String(item["creditAmount"] ?? item["credit"] ?? item["soTienCo"] ?? 0));
        const debit = parseFloat(String(item["debitAmount"] ?? item["debit"] ?? item["soTienNo"] ?? 0));
        if (credit > 0 || debit > 0) {
          txs.push({
            transactionDate: String(item["transactionDate"] ?? item["ngayGiaoDich"] ?? item["date"] ?? ""),
            creditAmount: credit,
            debitAmount: debit,
            description: String(item["description"] ?? item["moTa"] ?? item["noiDung"] ?? ""),
            refNo: String(item["refNo"] ?? item["soThamChieu"] ?? item["id"] ?? `msb_${Date.now()}_${Math.random()}`),
          });
        }
      }
      return txs;
    } catch { /* try next parser */ }
  }

  // Try HTML table parsing (Vietnamese banking table format)
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1]!;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m =>
      m[1]!.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim()
    );
    if (cells.length >= 4) {
      const creditStr = cells.find(c => /[\d,.]+/.test(c) && !c.includes("/")) || "0";
      const credit = parseFloat(creditStr.replace(/[,.]/g, "").replace(/[^\d]/g, "")) / 100 || 0;
      if (credit > 100) {
        txs.push({
          transactionDate: cells[0] || "",
          creditAmount: credit,
          debitAmount: 0,
          description: cells[cells.length - 1] || "",
          refNo: `msb_table_${Date.now()}_${txs.length}`,
        });
      }
    }
  }

  return txs;
}

// ─── Service ──────────────────────────────────────────────────────────────────

// Lưu trạng thái captcha session tạm thời cho login flow
interface CaptchaSession {
  client: Client;  // reuse same TCP connection for captcha + login POST
  cookies: CookieJar;
  dseSessionId: string;
  hiddenFields: Record<string, string>;
  captchaBase64: string;
  captchaContentType: string;
  createdAt: number;
}

class MSBService {
  private cookies: CookieJar = {};
  private dseSessionId: string = "";
  private loggedIn = false;
  private running = false;
  private lastError: string | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private loginUsername: string | null = null;
  private autoLoginRunning = false;
  private cachedAccounts: MSBAccount[] = [];
  private fetchingAccounts = false;

  // Lưu captcha session tạm (hết hạn sau 5 phút)
  private captchaSession: CaptchaSession | null = null;

  // ── Lấy trang login + captcha image từ MSB ──────────────────────────────
  async fetchLoginPage(): Promise<{ captchaBase64: string; captchaContentType: string; sessionId: string }> {
    // MSB dùng NHIỀU CẤP JS redirect:
    //   /IBSRetail/ → [JS] → retailJumpProc → [JS] → retailIndexProc (form thật)
    // Phải loop qua JS redirects cho đến khi tìm được trang có form login.

    let cookies: CookieJar = {};
    let currentHtml = "";
    let currentPath = "/IBSRetail/";
    let lastClient = makeClient();

    // Bước 1: GET /IBSRetail/ — bắt đầu session
    const initRes = await httpGet(currentPath, cookies, lastClient);
    cookies = initRes.cookies;
    currentHtml = initRes.text;
    currentPath = initRes.finalPath;

    // Bước 2: Loop theo JS redirects cho đến khi có form (tối đa 6 bước)
    for (let hop = 0; hop < 6; hop++) {
      const jsRedirect = extractJsRedirect(currentHtml);
      if (!jsRedirect) break; // Không còn JS redirect → đã đến trang login thật

      let nextPath: string;
      try {
        const u = new URL(jsRedirect, MSB_BASE_URL);
        nextPath = u.pathname + u.search;
      } catch {
        nextPath = jsRedirect;
      }

      // Decode HTML entities trong URL (MSB đôi khi trả &amp; thay vì &)
      nextPath = nextPath.replace(/&amp;/g, "&");

      logger.info({ hop, nextPath }, "MSB: following JS redirect hop");

      // Fresh client mỗi hop để tránh ECONNRESET/TCP state issues
      const hopClient = makeClient();
      const hopRes = await httpGet(nextPath, cookies, hopClient, `${MSB_BASE_URL}${currentPath}`);
      cookies = hopRes.cookies;
      currentHtml = hopRes.text;
      currentPath = hopRes.finalPath;
      lastClient = hopClient;

      // Kiểm tra đã có form chưa
      const fields = extractHiddenFields(currentHtml);
      if (Object.keys(fields).length > 0 || currentHtml.includes("_userName") || currentHtml.includes("_verifyCode")) {
        logger.info({ hop, currentPath }, "MSB: found login form");
        break;
      }
    }

    // Bước 3: Trích dseSessionId và hidden fields từ trang login thực
    let hiddenFields = extractHiddenFields(currentHtml);
    let dseSessionId = hiddenFields["dse_sessionId"] || extractDseSessionId(currentHtml, currentPath);

    // Nếu vẫn chưa có form, thử trực tiếp lấy retailIndexProc
    if (!dseSessionId || Object.keys(hiddenFields).length === 0) {
      logger.info({ dseSessionId, hasFields: Object.keys(hiddenFields).length }, "MSB: no form yet, trying retailIndexProc directly");
      // Lấy dseSessionId từ cookies hoặc URL hiện tại
      const sessionIdFromUrl = currentPath.match(/dse_sessionId=([^&]+)/)?.[1];
      if (sessionIdFromUrl) {
        const indexPath = `/IBSRetail/Request?dse_sessionId=${sessionIdFromUrl}&dse_applicationId=-1&dse_pageId=2&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
        const indexClient = makeClient();
        const indexRes = await httpGet(indexPath, cookies, indexClient, `${MSB_BASE_URL}${currentPath}`);
        cookies = indexRes.cookies;
        currentHtml = indexRes.text;
        currentPath = indexRes.finalPath;
        lastClient = indexClient;
        hiddenFields = extractHiddenFields(currentHtml);
        dseSessionId = hiddenFields["dse_sessionId"] || sessionIdFromUrl;
      }
    }

    logger.info({
      dseSessionId,
      currentPath,
      hasForm: Object.keys(hiddenFields).length > 0,
      hasVerifyCode: currentHtml.includes("_verifyCode"),
    }, "MSB: login page state");

    if (!dseSessionId) {
      throw new Error("Không lấy được dse_sessionId từ trang login MSB");
    }

    // Bước 4: Lấy ảnh captcha — dùng CÙNG cookies (JSESSIONID gắn với captcha)
    // servlet/ImageServlet trả ảnh captcha 4 chữ số của MSB
    const captchaPath = `/IBSRetail/servlet/ImageServlet`;
    const imageHeaders: Record<string, string> = {
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Site": "same-origin",
    };
    const referer = `${MSB_BASE_URL}${currentPath}`;
    // Dùng fresh client cho captcha nhưng với cùng cookies (JSESSIONID)
    const captchaClient = makeClient();
    const captchaRes = await httpGetRaw(captchaPath, cookies, captchaClient, referer, 3, imageHeaders);
    cookies = captchaRes.cookies;

    const captchaBase64 = captchaRes.buffer.toString("base64");
    const captchaContentType = captchaRes.contentType?.split(";")[0]?.trim() || "image/jpeg";

    logger.info({ captchaSize: captchaRes.buffer.length, captchaContentType, captchaStatus: captchaRes.status }, "MSB: captcha fetched");

    if (captchaRes.status !== 200 || captchaRes.buffer.length < 100) {
      throw new Error(`Không lấy được captcha từ MSB (status ${captchaRes.status}, size ${captchaRes.buffer.length})`);
    }

    // Lưu captcha session — dùng lastClient cho login POST
    this.captchaSession = {
      client: lastClient,
      cookies,
      dseSessionId,
      hiddenFields,
      captchaBase64,
      captchaContentType,
      createdAt: Date.now(),
    };

    return { captchaBase64, captchaContentType, sessionId: dseSessionId };
  }

  // ── Lấy captcha dùng cookies paste từ browser (bypass F5 WAF) ─────────────
  // User paste toàn bộ Cookie header từ browser → dùng đúng session/WAF token
  async fetchLoginPageWithBrowserCookies(
    rawCookieStr: string,
    msbLoginUrl?: string,
  ): Promise<{ captchaBase64: string; captchaContentType: string; sessionId: string }> {
    // ── Bước 1: Parse cookie string → CookieJar ──
    // Hỗ trợ 2 format:
    //   a) "name=value; name2=value2" (Cookie header / DevTools copy)
    //   b) Tab-separated export từ browser extension (EditThisCookie, etc.)
    const cookies: CookieJar = {};
    const lines = rawCookieStr.split(/\n/);
    if (lines.length > 1 && lines[0]!.includes("\t")) {
      // Tab-separated: name\tvalue\tdomain\tpath\t...
      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const name = parts[0]!.trim();
          const value = parts[1]!.trim();
          if (name && value && !name.startsWith("//") && !name.startsWith("#")) {
            cookies[name] = value;
          }
        }
      }
    } else {
      // Semicolon-separated Cookie header
      for (const part of rawCookieStr.split(";")) {
        const idx = part.indexOf("=");
        if (idx > 0) {
          const name = part.substring(0, idx).trim();
          const value = part.substring(idx + 1).trim();
          if (name) cookies[name] = value;
        }
      }
    }

    if (!cookies["JSESSIONID"]) {
      throw new Error("Không tìm thấy JSESSIONID trong cookies. Vui lòng copy đúng định dạng.");
    }

    // ── Bước 2: Lấy dseSessionId từ URL hoặc từ JSESSIONID ──
    // JSESSIONID của MSB có dạng: 0000{dseSessionId}:{serverId}
    let dseSessionId = "";
    if (msbLoginUrl) {
      try {
        const u = new URL(msbLoginUrl);
        dseSessionId = u.searchParams.get("dse_sessionId") || "";
      } catch { /* ignore */ }
    }
    if (!dseSessionId && cookies["JSESSIONID"]) {
      // Strip leading zeros và server suffix: "00008WYPBVA..." → "8WYPBVA..."
      const jsid = cookies["JSESSIONID"].replace(/^0+/, "").split(":")[0] || "";
      if (jsid.length >= 10) dseSessionId = jsid;
    }

    if (!dseSessionId) {
      throw new Error("Không tìm được dse_sessionId. Vui lòng dán thêm URL trang đăng nhập MSB.");
    }

    logger.info({ dseSessionId, cookieKeys: Object.keys(cookies) }, "MSB: browser cookies — loading login page");

    // ── Bước 3: GET trang login dùng browser cookies để lấy form fields ──
    const loginPath = `/IBSRetail/Request?dse_sessionId=${dseSessionId}&dse_applicationId=-1&dse_pageId=2&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
    const pageClient = makeClient();
    const pageRes = await httpGet(loginPath, cookies, pageClient, `${MSB_BASE_URL}/IBSRetail/`);
    const mergedCookies = pageRes.cookies;
    const hiddenFields = extractHiddenFields(pageRes.text);
    const realDseSessionId = hiddenFields["dse_sessionId"] || dseSessionId;

    // ── Bước 4: Lấy captcha bằng session đó ──
    const captchaClient = makeClient();
    const captchaRes = await httpGetRaw(
      "/IBSRetail/servlet/ImageServlet",
      mergedCookies,
      captchaClient,
      `${MSB_BASE_URL}${loginPath}`,
    );
    const finalCookies = captchaRes.cookies;
    const captchaBase64 = captchaRes.buffer.toString("base64");
    const captchaContentType = captchaRes.contentType?.split(";")[0]?.trim() || "image/jpeg";

    logger.info(
      { captchaSize: captchaRes.buffer.length, captchaStatus: captchaRes.status, realDseSessionId },
      "MSB: browser-cookies captcha fetched",
    );

    if (captchaRes.status !== 200 || captchaRes.buffer.length < 100) {
      throw new Error(`Không lấy được captcha (status=${captchaRes.status}, size=${captchaRes.buffer.length})`);
    }

    // Lưu captcha session — dùng đúng cookies của browser (có WAF token)
    this.captchaSession = {
      client: pageClient,
      cookies: finalCookies,
      dseSessionId: realDseSessionId,
      hiddenFields,
      captchaBase64,
      captchaContentType,
      createdAt: Date.now(),
    };

    return { captchaBase64, captchaContentType, sessionId: realDseSessionId };
  }

  // ── Làm mới captcha (không load lại trang, chỉ lấy ảnh mới) ─────────────
  async refreshCaptcha(): Promise<{ captchaBase64: string; captchaContentType: string }> {
    if (!this.captchaSession) {
      return this.fetchLoginPage();
    }
    const { client: sessionClient, cookies, dseSessionId } = this.captchaSession;
    const captchaPath = `/IBSRetail/servlet/ImageServlet`;
    const captchaRes = await httpGetRaw(captchaPath, cookies, sessionClient, `${MSB_BASE_URL}/IBSRetail/`);
    this.captchaSession.captchaBase64 = captchaRes.buffer.toString("base64");
    this.captchaSession.captchaContentType = captchaRes.contentType || "image/jpeg";
    this.captchaSession.cookies = captchaRes.cookies;
    return {
      captchaBase64: this.captchaSession.captchaBase64,
      captchaContentType: this.captchaSession.captchaContentType,
    };
  }

  // ── OCR giải captcha hiện tại trong session ──────────────────────────────
  async solveCaptcha(): Promise<{ success: boolean; code?: string; message?: string }> {
    if (!this.captchaSession) {
      return { success: false, message: "Chưa có session captcha — vui lòng tải trang đăng nhập trước" };
    }
    try {
      const buf = Buffer.from(this.captchaSession.captchaBase64, "base64");
      const code = await recognizeMsbCaptcha(buf);
      if (code) {
        logger.info({ code }, "MSB: OCR giải captcha thành công");
        return { success: true, code };
      }
      return { success: false, message: "OCR không nhận diện được captcha (thử làm mới ảnh)" };
    } catch (err: any) {
      return { success: false, message: `OCR lỗi: ${err.message}` };
    }
  }

  // ── Đăng nhập trực tiếp với username/password/captcha ─────────────────────
  async login(username: string, password: string, captchaCode: string, accountNumber?: string): Promise<{ success: boolean; message: string }> {
    if (!this.captchaSession || Date.now() - this.captchaSession.createdAt > 5 * 60 * 1000) {
      return { success: false, message: "Phiên captcha hết hạn — vui lòng tải lại trang đăng nhập" };
    }

    const { client: sessionClient, cookies, dseSessionId, hiddenFields } = this.captchaSession;

    try {
      // Build login POST body — đúng field names theo HTML thật của MSB (DevTools)
      // Các hidden fields từ form: dse_sessionId, dse_applicationId, dse_pageId,
      // dse_operationName=retailUserLoginProc, dse_nextEventName=start, _userNameEncode, msbPassword...
      // loginIB() trong msb.login.js làm đúng như sau (không hash gì cả):
      //   $("#passwordToSend").val($("#msbPassword").val())  → copy plaintext → name="_password"
      //   $("#_userNameEncode").val(encodeURIComponent($("#_userName").val()))
      //   $(":password").prop("disabled", true)  → _passwordS bị disabled, KHÔNG submit
      //   form.submit()
      // Vậy server nhận: _userName, _userNameEncode, _password (plaintext), _verifyCode
      const params: Record<string, string> = {
        // Spread tất cả hidden fields từ trang login trước
        ...hiddenFields,
        // Override các dse params (hiddenFields thường đã có đúng giá trị, đây là fallback)
        dse_sessionId: hiddenFields["dse_sessionId"] || dseSessionId,
        dse_applicationId: hiddenFields["dse_applicationId"] || "-1",
        dse_pageId: hiddenFields["dse_pageId"] || "3",
        dse_operationName: hiddenFields["dse_operationName"] || "retailUserLoginProc",
        dse_errorPage: hiddenFields["dse_errorPage"] || "index.jsp",
        dse_processorState: hiddenFields["dse_processorState"] || "initial",
        dse_nextEventName: hiddenFields["dse_nextEventName"] || "start",
        // Đúng field names theo HTML MSB + loginIB() trong msb.login.js:
        "_userName": username,                         // input name="_userName"
        "_userNameEncode": encodeURIComponent(username), // $("#_userNameEncode").val(encodeURIComponent(...))
        "_password": password,                         // id="passwordToSend" name="_password" — nhận plaintext từ JS
        "_verifyCode": captchaCode,                    // input name="_verifyCode" maxlength="4"
        // _passwordS bị disabled trước khi submit → không gửi (giống browser)
      };

      const body = new URLSearchParams(params).toString();
      // Referer phải khớp với URL của trang login thật (pageId=2, retailIndexProc)
      const referer = `${MSB_BASE_URL}/IBSRetail/Request?dse_sessionId=${params["dse_sessionId"] || dseSessionId}&dse_applicationId=-1&dse_pageId=2&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;

      // Log POST params (ẩn password) để debug
      const debugParams = { ...params, _password: "***" };
      logger.info({ username, dseSessionId, postParams: debugParams }, "MSB: đang đăng nhập — POST params");
      const res = await httpPost("/IBSRetail/Request", body, cookies, sessionClient, referer);

      // Log raw POST response để debug
      logger.info({
        postStatus: res.status,
        postHtmlLen: res.text.length,
        postRawHtml: res.text.substring(0, 2000),
        postJsRedirect: extractJsRedirect(res.text),
        postCookies: Object.keys(res.cookies),
      }, "MSB: raw POST response");

      // ── Detect kết quả bằng cách follow JS redirect cho đến trang thật ──
      // MSB DSE luôn trả JS redirect sau POST. Ta follow hết redirect rồi kiểm tra
      // trang cuối có phải login page không (sai tk/mk → về login, đúng → về dashboard).
      let currentHtml = res.text;
      let currentCookies = res.cookies;
      let finalDseSessionId = dseSessionId;

      // Trang login thật có CẢ HAI input: _verifyCode (captcha) VÀ _userName
      // Các trang khác (menu, dashboard) không có đủ cả hai → tránh false positive
      const isLoginPage = (html: string) =>
        html.includes("_verifyCode") && html.includes("_userName");

      // Follow tối đa 10 hop JS redirect để đến trang cuối
      for (let hop = 0; hop < 10; hop++) {
        const jsRedir = extractJsRedirect(currentHtml);
        if (!jsRedir) break; // Không còn redirect → đã đến trang thật

        let nextPath: string;
        try {
          const u = new URL(jsRedir, MSB_BASE_URL);
          nextPath = (u.pathname + u.search).replace(/&amp;/g, "&");
        } catch {
          nextPath = jsRedir.replace(/&amp;/g, "&");
        }

        const hopClient = makeClient();
        const hopRes = await httpGet(nextPath, currentCookies, hopClient, `${MSB_BASE_URL}/IBSRetail/Request`);
        currentCookies = hopRes.cookies;
        currentHtml = hopRes.text;

        const newDse = nextPath.match(/dse_sessionId=([^&]+)/)?.[1];
        if (newDse) finalDseSessionId = newDse;

        logger.info({
          hop,
          nextPath,
          hopStatus: hopRes.status,
          hopHtmlLen: hopRes.text.length,
          hopJsRedirect: extractJsRedirect(hopRes.text),
          isLoginNow: isLoginPage(hopRes.text),
          hopSnippet: hopRes.text.substring(0, 300),
        }, "MSB: login follow hop");

        // Nếu đã đến trang có nội dung thật (không phải JS-only redirect), dừng
        if (currentHtml.length > 1000 && !extractJsRedirect(currentHtml)) break;
      }

      logger.info({
        username,
        finalHtmlLen: currentHtml.length,
        isLoginPage: isLoginPage(currentHtml),
        hasLogout: currentHtml.includes("Đăng xuất") || currentHtml.includes("logout"),
        finalHtml: currentHtml.substring(0, 1000),
      }, "MSB: login result page");

      // Sai thông tin → trang cuối là login page
      if (isLoginPage(currentHtml)) {
        logger.warn({ username }, "MSB: đăng nhập thất bại — sai thông tin hoặc captcha");
        try { await this.refreshCaptcha(); } catch { /* ignore */ }
        this.captchaSession = null;
        return { success: false, message: "Sai tên đăng nhập, mật khẩu hoặc mã xác nhận. Vui lòng thử lại." };
      }

      // Đúng thông tin → trang cuối không phải login page
      this.cookies = currentCookies;
      this.dseSessionId = finalDseSessionId;
      this.loggedIn = true;
      this.lastError = null;
      this.loginUsername = username;
      this.captchaSession = null;

      setCredentials({
        msb_jsessionid: currentCookies["JSESSIONID"] || "",
        msb_dse_sessionid: this.dseSessionId,
        msb_username: username,
        msb_password: password,
        ...(accountNumber ? { msb_account_number: accountNumber } : {}),
      });

      logger.info({ username }, "✅ MSB Bank: đăng nhập thành công");
      if (this.dseSessionId) {
        setTimeout(() => this.fetchAccounts().catch(() => {}), 2000);
      }
      return { success: true, message: "Đăng nhập MSB Bank thành công!" };

    } catch (err: any) {
      logger.error({ err }, "MSB Bank: login error");
      this.captchaSession = null;
      return { success: false, message: `Lỗi kết nối MSB: ${err.message}` };
    }
  }

  // ── Tự động đăng nhập (giống MB Bank): lấy captcha → OCR → login, retry ─────
  async autoLogin(
    username: string,
    password: string,
    accountNumber?: string,
    maxRetries = 15,
    onProgress?: (msg: string) => void,
  ): Promise<{ success: boolean; message: string; attempts: number }> {
    if (this.autoLoginRunning) {
      return { success: false, message: "Đang có quá trình đăng nhập tự động đang chạy", attempts: 0 };
    }
    this.autoLoginRunning = true;
    const notify = (msg: string) => {
      logger.info(msg);
      onProgress?.(msg);
    };

    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        notify(`🔄 MSB auto-login lần ${attempt}/${maxRetries}...`);

        // 1. Lấy trang login + ảnh captcha
        let captchaBuffer: Buffer;
        let captchaSession: CaptchaSession;
        try {
          const page = await this.fetchLoginPage();
          captchaBuffer = Buffer.from(page.captchaBase64, "base64");
          captchaSession = this.captchaSession!;
          notify(`   📸 Đã lấy captcha, kích thước: ${captchaBuffer.length} bytes`);
        } catch (err: any) {
          notify(`   ⚠️ Không lấy được captcha: ${err.message}, thử lại...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        // 2. OCR giải captcha
        const captchaText = await recognizeMsbCaptcha(captchaBuffer);
        if (!captchaText) {
          notify(`   ❌ OCR không nhận diện được captcha, thử lại...`);
          this.captchaSession = captchaSession;
          continue;
        }
        notify(`   🔍 OCR kết quả: ${captchaText}`);

        // 3. Thực hiện đăng nhập
        this.captchaSession = captchaSession;
        const result = await this.login(username, password, captchaText, accountNumber);
        if (result.success) {
          notify(`   ✅ Đăng nhập MSB thành công sau ${attempt} lần thử!`);
          this.autoLoginRunning = false;
          return { success: true, message: result.message, attempts: attempt };
        }

        const isCaptchaWrong = result.message.toLowerCase().includes("captcha") ||
          result.message.toLowerCase().includes("xác nhận") ||
          result.message.toLowerCase().includes("hết hạn");

        if (!isCaptchaWrong) {
          // Sai username/password — không cần retry
          notify(`   ❌ Sai thông tin đăng nhập: ${result.message}`);
          this.autoLoginRunning = false;
          return { success: false, message: result.message, attempts: attempt };
        }

        notify(`   ⟳ Sai captcha (${captchaText}), thử captcha mới...`);
        await new Promise(r => setTimeout(r, 1000));
      }

      const msg = `Không đăng nhập được sau ${maxRetries} lần — captcha OCR chưa đủ chính xác`;
      this.lastError = msg;
      this.autoLoginRunning = false;
      return { success: false, message: msg, attempts: maxRetries };
    } catch (err: any) {
      this.autoLoginRunning = false;
      logger.error({ err }, "MSB autoLogin fatal error");
      return { success: false, message: `Lỗi nghiêm trọng: ${err.message}`, attempts: 0 };
    }
  }

  // ── Auto-login silent: giống autoLogin nhưng KHÔNG gọi fetchAccounts sau đó ──
  // Dùng khi handleExpired() trong fetchAccounts trigger re-login để tránh vòng lặp vô tận
  private async autoLoginSilent(username: string, password: string): Promise<void> {
    if (this.autoLoginRunning) return;
    this.autoLoginRunning = true;
    try {
      for (let attempt = 1; attempt <= 15; attempt++) {
        logger.info(`🔄 MSB auto-login (silent) lần ${attempt}/15...`);
        try {
          const page = await this.fetchLoginPage();
          const captchaBuffer = Buffer.from(page.captchaBase64, "base64");
          const captchaText = await recognizeMsbCaptcha(captchaBuffer);
          if (!captchaText) continue;
          logger.info(`   🔍 OCR: ${captchaText}`);
          const result = await this.login(username, password, captchaText);
          if (result.success) {
            logger.info(`   ✅ MSB auto-login silent thành công sau ${attempt} lần`);
            return;
          }
          const isCaptchaWrong = result.message.toLowerCase().includes("captcha") ||
            result.message.toLowerCase().includes("xác nhận");
          if (!isCaptchaWrong) {
            logger.warn({ msg: result.message }, "MSB auto-login silent: sai credentials, dừng");
            return;
          }
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) {
          logger.warn({ err: err.message }, "MSB auto-login silent: lỗi attempt, thử lại");
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      logger.warn("MSB auto-login silent: hết 15 lần");
    } finally {
      this.autoLoginRunning = false;
    }
  }

  // ── Set session từ browser cookie (phương thức cũ - giữ nguyên) ───────────
  setSession(jsessionId: string, dseSessionId: string, accountNumber?: string): { success: boolean; message: string } {
    if (!jsessionId) {
      return { success: false, message: "JSESSIONID không được để trống" };
    }

    this.cookies = { JSESSIONID: jsessionId };
    this.dseSessionId = dseSessionId || "";
    this.loggedIn = true;
    this.lastError = null;

    setCredentials({
      msb_jsessionid: jsessionId,
      msb_dse_sessionid: dseSessionId || "",
      ...(accountNumber ? { msb_account_number: accountNumber } : {}),
    });

    logger.info("✅ MSB Bank: session đã được cấu hình từ browser");
    return { success: true, message: "Session MSB Bank đã lưu thành công" };
  }

  // ── Import session từ browser đã đăng nhập thành công (bỏ qua captcha) ──────
  // User mở MSB trên browser thật → đăng nhập → copy Cookie header → paste vào đây.
  // Nếu session hợp lệ (truy cập được dashboard), lưu luôn mà không cần captcha.
  async importBrowserSession(
    rawCookieStr: string,
    accountNumber?: string,
  ): Promise<{ success: boolean; message: string; accounts?: MSBAccount[] }> {
    // 1. Parse cookie string → CookieJar
    const cookies: CookieJar = {};
    const lines = rawCookieStr.split(/\n/);
    if (lines.length > 1 && lines[0]!.includes("\t")) {
      for (const line of lines) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const name = parts[0]!.trim();
          const value = parts[1]!.trim();
          if (name && value && !name.startsWith("//") && !name.startsWith("#")) {
            cookies[name] = value;
          }
        }
      }
    } else {
      for (const part of rawCookieStr.split(";")) {
        const idx = part.indexOf("=");
        if (idx > 0) {
          const name = part.substring(0, idx).trim();
          const value = part.substring(idx + 1).trim();
          if (name) cookies[name] = value;
        }
      }
    }

    if (!cookies["JSESSIONID"]) {
      return { success: false, message: "Không tìm thấy JSESSIONID. Vui lòng copy đúng Cookie header từ browser." };
    }

    // 2. Trích dseSessionId từ JSESSIONID (MSB: 0000{dseSessionId}:{serverId})
    let dseSessionId = "";
    const jsid = cookies["JSESSIONID"].replace(/^0+/, "").split(":")[0] || "";
    if (jsid.length >= 8) dseSessionId = jsid;

    logger.info({ dseSessionId, cookieKeys: Object.keys(cookies) }, "MSB importBrowserSession: kiểm tra session");

    // 3. Thử truy cập trang account list để xác minh session
    const isLoginPage = (html: string) =>
      (html.includes("_verifyCode") && html.includes("_userName")) ||
      html.includes("retailUserLoginProc");
    const isTimeout = (html: string) =>
      html.includes("SessionTimeout") || html.includes("timeout.jsp");

    // Thử các path để lấy được dashboard
    const testPaths: string[] = [];
    if (dseSessionId) {
      testPaths.push(
        `/IBSRetail/Request?dse_sessionId=${dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`,
        `/IBSRetail/Request?dse_sessionId=${dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailAccountListProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`,
      );
    }
    testPaths.push("/IBSRetail/");

    let verifiedCookies = { ...cookies };
    let verifiedDseSessionId = dseSessionId;
    let dashboardHtml = "";

    for (const path of testPaths) {
      try {
        const client = makeClient();
        const res = await httpGet(path, verifiedCookies, client, `${MSB_BASE_URL}/IBSRetail/`);
        verifiedCookies = res.cookies;

        let html = res.text;
        // Follow một cấp JS redirect nếu có
        const jsRedir = extractJsRedirect(html);
        if (jsRedir) {
          try {
            const u = new URL(jsRedir, MSB_BASE_URL);
            const nextPath = (u.pathname + u.search).replace(/&amp;/g, "&");
            const newDse = nextPath.match(/dse_sessionId=([^&]+)/)?.[1];
            if (newDse) verifiedDseSessionId = newDse;
            const redir2 = await httpGet(nextPath, verifiedCookies, makeClient(), `${MSB_BASE_URL}${path}`);
            verifiedCookies = redir2.cookies;
            html = redir2.text;
          } catch { /* ignore */ }
        }

        if (isLoginPage(html) || isTimeout(html)) {
          logger.warn({ path }, "MSB importBrowserSession: trang trả về login/timeout — session không hợp lệ");
          continue;
        }

        if (html.length > 2000) {
          dashboardHtml = html;
          logger.info({ path, htmlLen: html.length, dseSessionId: verifiedDseSessionId }, "MSB importBrowserSession: session hợp lệ!");
          break;
        }
      } catch (err: any) {
        logger.warn({ path, err: err.message }, "MSB importBrowserSession: lỗi thử path");
      }
    }

    if (!dashboardHtml) {
      return { success: false, message: "Session không còn hiệu lực — vui lòng mở MSB trên browser, đăng nhập mới, rồi copy lại cookies." };
    }

    // 4. Lưu session
    this.cookies = verifiedCookies;
    this.dseSessionId = verifiedDseSessionId;
    this.loggedIn = true;
    this.lastError = null;
    this.loginUsername = null;

    setCredentials({
      msb_jsessionid: verifiedCookies["JSESSIONID"] || "",
      msb_dse_sessionid: verifiedDseSessionId,
      ...(accountNumber ? { msb_account_number: accountNumber } : {}),
    });

    logger.info("✅ MSB Bank: import session từ browser thành công");

    // 5. Thử parse tài khoản từ dashboard HTML
    let accounts: MSBAccount[] = [];
    try {
      accounts = parseAccountsFromHtml(dashboardHtml);
      if (accounts.length > 0) {
        this.cachedAccounts = accounts;
        logger.info({ accounts: accounts.map(a => a.accountNumber) }, "MSB importBrowserSession: đã parse tài khoản");
      } else {
        // Fetch accounts async
        setTimeout(() => this.fetchAccounts().catch(() => {}), 1500);
      }
    } catch { /* ignore */ }

    return { success: true, message: "Import session MSB thành công!", accounts };
  }

  // ── Verify session is still valid ────────────────────────────────────────
  async verifySession(): Promise<boolean> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) return false;
    try {
      const path = this.dseSessionId
        ? `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`
        : "/IBSRetail/";
      const res = await httpGet(path, this.cookies, getPollClient(), `${MSB_BASE_URL}/IBSRetail/`);
      this.cookies = res.cookies;

      const isExpired = res.text.includes("SessionTimeout") ||
        res.text.includes("dse_operationName=retailJumpProc") ||
        res.status === 302;

      if (isExpired) {
        logger.warn("MSB Bank: session hết hạn");
        this.loggedIn = false;
        this.lastError = "Session hết hạn — vui lòng đăng nhập lại";
        return false;
      }
      return true;
    } catch (err: any) {
      logger.error({ err }, "MSB Bank: verify session error");
      return false;
    }
  }

  // ── Transfer (chuyển khoản) ───────────────────────────────────────────────
  async transfer(params: MSBTransferParams): Promise<MSBTransferResult> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) {
      return { success: false, message: "Chưa đăng nhập MSB Bank" };
    }
    const { fromAccount, toAccount, toName, amount, description, type, bankCode } = params;
    try {
      // Step 1: Lấy trang chuyển khoản để lấy hidden fields + session tokens
      const opName = type === "internal" ? "retailTransferProc" : "retailIBTransferProc";
      const initPath = `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=${opName}&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
      const referer = `${MSB_BASE_URL}/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_operationName=retailIndexProc`;
      const initRes = await httpGet(initPath, this.cookies, getPollClient(), referer);
      this.cookies = initRes.cookies;

      if (initRes.text.includes("SessionTimeout") || initRes.text.includes("retailJumpProc")) {
        this.loggedIn = false;
        this.lastError = "Session hết hạn";
        return { success: false, message: "Session MSB đã hết hạn — vui lòng đăng nhập lại" };
      }

      const hidden = extractHiddenFields(initRes.text);

      // Step 2: Submit transfer form
      const formBody = new URLSearchParams({
        ...hidden,
        dse_sessionId: this.dseSessionId,
        dse_applicationId: "-1",
        dse_operationName: opName,
        dse_errorPage: "error_page.jsp",
        dse_processorState: "initial",
        dse_nextEventName: "next",
        fromAccount,
        toAccount,
        toAccountName: toName,
        amount: String(amount),
        description,
        currency: "VND",
        ...(type === "interbank" && bankCode ? { bankCode, toBank: bankCode } : {}),
      }).toString();

      const submitRef = `${MSB_BASE_URL}${initPath}`;
      const res = await httpPost("/IBSRetail/Request", formBody, this.cookies, getPollClient(), submitRef);
      this.cookies = res.cookies;

      const html = res.text;
      logger.info({ length: html.length, status: res.status }, "MSB transfer response");

      // Kiểm tra thành công
      if (
        html.includes("thành công") ||
        html.includes("Thanh cong") ||
        html.includes("success") ||
        html.includes("successTransaction") ||
        html.includes("Giao dịch thành công")
      ) {
        return { success: true, message: "Chuyển khoản thành công!" };
      }

      // Kiểm tra OTP
      if (
        html.includes("OTP") ||
        html.includes("otp") ||
        html.includes("Mã xác nhận") ||
        html.includes("smartOTP") ||
        html.includes("otpCode")
      ) {
        const txMatch = html.match(/transactionId["'\s:=]+([A-Za-z0-9\-_]+)/i);
        return {
          success: false,
          otpRequired: true,
          transactionId: txMatch ? txMatch[1] : undefined,
          message: "Cần nhập OTP để xác nhận giao dịch",
        };
      }

      // Trích xuất thông báo lỗi từ HTML
      const errMatch = html.match(/(?:class="error[^"]*"|class="message[^"]*")[^>]*>\s*([^<]{5,200})/i) ||
        html.match(/(?:Lỗi|Error|loi|FAILED)[:\s]*([^\n<]{5,200})/i);
      const errMsg = errMatch ? errMatch[1]!.trim() : "Giao dịch không thành công — kiểm tra lại thông tin";

      return { success: false, message: errMsg };
    } catch (err: any) {
      logger.error({ err }, "MSB transfer error");
      return { success: false, message: `Lỗi kết nối MSB: ${err.message}` };
    }
  }

  // ── Confirm transfer OTP ──────────────────────────────────────────────────
  async confirmTransferOTP(otpCode: string, transactionId?: string): Promise<MSBTransferResult> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) {
      return { success: false, message: "Chưa đăng nhập MSB Bank" };
    }
    try {
      const body = new URLSearchParams({
        dse_sessionId: this.dseSessionId,
        dse_applicationId: "-1",
        dse_operationName: "retailTransferOTPProc",
        dse_errorPage: "error_page.jsp",
        dse_processorState: "initial",
        dse_nextEventName: "next",
        otpCode,
        ...(transactionId ? { transactionId } : {}),
      }).toString();

      const res = await httpPost("/IBSRetail/Request", body, this.cookies, getPollClient(),
        `${MSB_BASE_URL}/IBSRetail/Request?dse_sessionId=${this.dseSessionId}`);
      this.cookies = res.cookies;

      const html = res.text;
      if (html.includes("thành công") || html.includes("success") || html.includes("Giao dịch thành công")) {
        return { success: true, message: "Xác nhận OTP thành công — Chuyển khoản hoàn tất!" };
      }
      const errMatch = html.match(/(?:Lỗi|Error|sai|wrong)[:\s]*([^\n<]{5,200})/i);
      return { success: false, message: errMatch ? errMatch[1]!.trim() : "OTP không hợp lệ hoặc đã hết hạn" };
    } catch (err: any) {
      logger.error({ err }, "MSB confirmTransferOTP error");
      return { success: false, message: `Lỗi: ${err.message}` };
    }
  }

  // ── Fetch account list with balances ─────────────────────────────────────
  // Sau khi login, MSB trả trang JS redirect (nhỏ ~400 bytes).
  // Phải follow JS redirects giống fetchLoginPage để đến dashboard thật.
  async fetchAccounts(): Promise<MSBAccount[]> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) return this.getCachedAccounts();
    if (this.fetchingAccounts) return this.getCachedAccounts(); // tránh gọi song song
    this.fetchingAccounts = true;

    // Helper: kiểm tra HTML có phải trang login không
    const isLoginPage = (html: string) =>
      html.includes("_verifyCode") || html.includes("retailUserLoginProc") ||
      html.includes("retailIndexProc") && html.includes("_userName");

    // Helper: trigger auto-login nếu session hết hạn (không gọi fetchAccounts trong đó)
    const handleExpired = () => {
      logger.warn("MSB fetchAccounts: redirected to login page — session expired");
      this.loggedIn = false;
      this.lastError = "Session hết hạn — đang auto-login lại";
      const u = getCredential("msb_username");
      const p = getCredential("msb_password");
      if (u && p && getCredential("msb_auto_mode") === "1" && !this.autoLoginRunning) {
        // Chỉ trigger auto-login, KHÔNG gọi fetchAccounts sau đó để phá vòng lặp
        this.autoLoginSilent(u, p).catch(() => {});
      }
    };

    try {
      // ── Bước 1: Lấy authenticated session ID mới từ retailIndexProc (nó luôn trả JS redirect đến session đã xác thực) ──
      if (this.dseSessionId) {
        try {
          const indexPath = `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
          const indexRes = await httpGet(indexPath, this.cookies, getPollClient(), `${MSB_BASE_URL}/IBSRetail/`);
          this.cookies = indexRes.cookies;

          // retailIndexProc trả JS redirect đến session ID mới (authenticated) → follow nó
          const jsRedir = extractJsRedirect(indexRes.text);
          if (jsRedir) {
            const u = new URL(jsRedir, MSB_BASE_URL);
            const nextPath = (u.pathname + u.search).replace(/&amp;/g, "&");
            const newDse = nextPath.match(/dse_sessionId=([^&]+)/)?.[1];
            if (newDse && newDse !== this.dseSessionId) {
              logger.info({ old: this.dseSessionId, new: newDse }, "MSB fetchAccounts: got new authenticated dseSessionId");
              this.dseSessionId = newDse;
            }
            // Follow đến trang authenticated — lấy pageId hiện tại từ nextPath
            const curPageId = nextPath.match(/dse_pageId=(\d+)/)?.[1] || "3";
            const authRes = await httpGet(nextPath, this.cookies, getPollClient(), `${MSB_BASE_URL}${indexPath}`);
            this.cookies = authRes.cookies;
            logger.info({ htmlLen: authRes.text.length, pageId: curPageId, htmlPreview: authRes.text.substring(0, 2000) }, "MSB fetchAccounts: authenticated dashboard page");

            const parsedDash = parseAccountsFromHtml(authRes.text);
            if (parsedDash.length > 0) {
              this.saveAccounts(parsedDash);
              return parsedDash;
            }

            // ── Bước 2: từ authenticated page, thử các operation với pageId đúng ──
            const accountOps = [
              `retailAccountListProc`,
              `retailDashboardProc`,
              `retailAccountDetailProc`,
              `retailIndexProc`,
            ];

            for (const opName of accountOps) {
              // Thử nhiều pageId: pageId từ redirect + 1, và 1, 3, 4, 5
              for (const pid of [curPageId, String(Number(curPageId) + 1), "1", "3", "4", "5"]) {
                try {
                  const path = `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=${pid}&dse_operationName=${opName}&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
                  const res = await httpGet(path, this.cookies, getPollClient(), `${MSB_BASE_URL}${nextPath}`);
                  this.cookies = res.cookies;

                  // Follow JS redirect nếu có
                  const jsR2 = extractJsRedirect(res.text);
                  let finalHtml = res.text;
                  if (jsR2) {
                    try {
                      const u2 = new URL(jsR2, MSB_BASE_URL);
                      const rPath2 = (u2.pathname + u2.search).replace(/&amp;/g, "&");
                      const r2 = await httpGet(rPath2, this.cookies, getPollClient(), `${MSB_BASE_URL}${path}`);
                      this.cookies = r2.cookies;
                      finalHtml = r2.text;
                      const newDse2 = rPath2.match(/dse_sessionId=([^&]+)/)?.[1];
                      if (newDse2) this.dseSessionId = newDse2;
                    } catch {}
                  }

                  if (finalHtml.includes("section-timeout") || finalHtml.includes("timeout.jsp") || isLoginPage(finalHtml)) continue;

                  logger.info({ opName, pid, htmlLen: finalHtml.length, htmlSnippet: finalHtml.substring(0, 500) }, "MSB fetchAccounts: auth op path");

                  const parsed = parseAccountsFromHtml(finalHtml);
                  if (parsed.length > 0) {
                    this.saveAccounts(parsed);
                    return parsed;
                  }
                } catch { /* try next */ }
              }
            }
          }
        } catch { /* tiếp tục với fallback */ }
      }

      // ── Fallback: follow JS redirect từ /IBSRetail/ (chỉ dùng khi chưa có dseSessionId) ──
      if (!this.dseSessionId) {
        let currentHtml = "";
        let currentPath = "/IBSRetail/";
        let cookies = { ...this.cookies };

        const initRes = await httpGet(currentPath, cookies, getPollClient());
        cookies = initRes.cookies;
        this.cookies = cookies;
        currentHtml = initRes.text;
        currentPath = initRes.finalPath;

        for (let hop = 0; hop < 8; hop++) {
          const jsRedirect = extractJsRedirect(currentHtml);
          if (!jsRedirect) break;

          let nextPath: string;
          try {
            const u = new URL(jsRedirect, MSB_BASE_URL);
            nextPath = u.pathname + u.search;
          } catch {
            nextPath = jsRedirect;
          }
          nextPath = nextPath.replace(/&amp;/g, "&");

          logger.info({ hop, nextPath, htmlLen: currentHtml.length }, "MSB fetchAccounts: following JS redirect");

          const hopRes = await httpGet(nextPath, cookies, getPollClient(), `${MSB_BASE_URL}${currentPath}`);
          cookies = hopRes.cookies;
          this.cookies = cookies;
          currentHtml = hopRes.text;
          currentPath = hopRes.finalPath;

          const newDse = extractDseSessionId(currentHtml, currentPath);
          if (newDse) this.dseSessionId = newDse;

          const parsed = parseAccountsFromHtml(currentHtml);
          if (parsed.length > 0) {
            this.saveAccounts(parsed);
            return parsed;
          }

          if (isLoginPage(currentHtml)) {
            handleExpired();
            break;
          }
        }
      }

      // Fallback: dùng cache gần nhất (có balance) nếu có
      if (this.cachedAccounts.length > 0) {
        logger.info({ count: this.cachedAccounts.length }, "MSB fetchAccounts: returning cached accounts");
        return this.cachedAccounts;
      }
      // Fallback cuối: dùng số tài khoản đã lưu (không có balance)
      const storedAcc = getCredential("msb_account_number");
      if (storedAcc) {
        logger.info({ storedAcc }, "MSB fetchAccounts: using stored account number");
        return [{ accountNumber: storedAcc, accountName: this.loginUsername || getCredential("msb_username") || "", currency: "VND", balance: null }];
      }
      logger.warn("MSB fetchAccounts: could not determine account number — set msb_account_number in bank-creds.json");
      return [];
    } catch (err: any) {
      logger.error({ err }, "MSB Bank: fetchAccounts error");
      // Trả về cache nếu có
      if (this.cachedAccounts.length > 0) return this.cachedAccounts;
      const storedAcc = getCredential("msb_account_number");
      if (storedAcc) {
        return [{ accountNumber: storedAcc, accountName: this.loginUsername || getCredential("msb_username") || "", currency: "VND", balance: null }];
      }
      return [];
    } finally {
      this.fetchingAccounts = false;
    }
  }

  private saveAccounts(accounts: MSBAccount[]): void {
    this.cachedAccounts = accounts;
    const first = accounts[0];
    if (first?.accountNumber) {
      setCredentials({ msb_account_number: first.accountNumber });
      logger.info({ accountNumber: first.accountNumber, balance: first.balance }, "💾 MSB account number saved");
    }
  }

  /** Trả về accounts đã cache (không cần crawl lại MSB) */
  getCachedAccounts(): MSBAccount[] {
    if (this.cachedAccounts.length > 0) return this.cachedAccounts;
    // Fallback: dùng số tài khoản đã lưu
    const storedAcc = getCredential("msb_account_number");
    if (storedAcc && this.loggedIn) {
      return [{ accountNumber: storedAcc, accountName: this.loginUsername || getCredential("msb_username") || "", currency: "VND", balance: null }];
    }
    return [];
  }

  // ── Get transactions ─────────────────────────────────────────────────────
  async getTransactions(accountNumber: string): Promise<MSBTransaction[]> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) return [];

    try {
      const now = new Date();
      const from = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

      const fromDate = fmt(from);
      const toDate = fmt(now);

      const body = new URLSearchParams({
        dse_sessionId: this.dseSessionId,
        dse_applicationId: "-1",
        dse_pageId: "10",
        dse_operationName: "retailAccountHistoryProc",
        dse_errorPage: "error_page.jsp",
        dse_processorState: "initial",
        dse_nextEventName: "next",
        accountNumber,
        fromDate,
        toDate,
        currency: "VND",
        type: "C",
      }).toString();

      const referer = `${MSB_BASE_URL}/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_operationName=retailIndexProc`;
      const res = await httpPost("/IBSRetail/Request", body, this.cookies, getPollClient(), referer);
      this.cookies = res.cookies;

      return parseTransactionsFromHtml(res.text);
    } catch (err: any) {
      logger.error({ err }, "MSB Bank: getTransactions error");
      return [];
    }
  }

  // ── Process deposit ──────────────────────────────────────────────────────
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

  private async processDeposit(tx: MSBTransaction): Promise<void> {
    const refNo = tx.refNo;
    const creditAmount = tx.creditAmount;

    const [existing] = await db
      .select()
      .from(bankTransactionsTable)
      .where(and(eq(bankTransactionsTable.refNo, refNo), eq(bankTransactionsTable.processed, true)))
      .limit(1);
    if (existing) return;

    const userId = this.extractUserId(tx.description || "");

    await db.insert(bankTransactionsTable).values({
      refNo,
      userId,
      amount: String(creditAmount),
      description: tx.description,
      transactionDate: tx.transactionDate,
      processed: false,
    }).onConflictDoNothing();

    if (!userId) {
      logger.warn({ refNo, description: tx.description }, "MSB Bank: deposit no user match");
      return;
    }

    const user = await storage.getBotUser(userId);
    if (!user) {
      logger.warn({ refNo, userId }, "MSB Bank: deposit user not found");
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
      metadata: { refNo, description: tx.description, transactionDate: tx.transactionDate, bank: "MSB" },
    });

    await db
      .update(bankTransactionsTable)
      .set({ processed: true, processedAt: new Date(), userId })
      .where(eq(bankTransactionsTable.refNo, refNo));

    logger.info({ refNo, userId, amount: creditAmount }, "✅ MSB Bank deposit credited");

    try {
      const { telegramBotService } = await import("./telegramBot.js");
      await telegramBotService.notifyPaymentSuccess(userId, creditAmount, refNo);
    } catch (err) {
      logger.error({ err }, "MSB Bank: notify user failed");
    }
  }

  // ── Poll ─────────────────────────────────────────────────────────────────
  async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    try {
      if (!this.loggedIn) return;
      const accountNumber = getCredential("msb_account_number");
      if (!accountNumber) return;

      const txs = await this.getTransactions(accountNumber);
      for (const tx of txs) {
        if (tx.creditAmount > 0) await this.processDeposit(tx);
      }
      logger.info({ count: txs.filter(t => t.creditAmount > 0).length, bank: "MSB" }, "📊 MSB Bank poll complete");
    } catch (err) {
      logger.error({ err }, "❌ MSB Bank poll error");
    } finally {
      this.isPolling = false;
    }
  }

  // ── Start / Stop ─────────────────────────────────────────────────────────
  async start(): Promise<void> {
    // Ưu tiên auto-login nếu có username/password
    const savedUsername = getCredential("msb_username");
    const savedPassword = getCredential("msb_password");
    const isAutoMode = getCredential("msb_auto_mode") === "1";

    if (!this.loggedIn && isAutoMode && savedUsername && savedPassword) {
      // Chỉ auto-login nếu chưa đăng nhập
      logger.info({ username: savedUsername }, "MSB Bank: khởi động auto-login...");
      const accountNumber = getCredential("msb_account_number") || undefined;
      this.autoLogin(savedUsername, savedPassword, accountNumber).catch(err => {
        logger.error({ err }, "MSB Bank: auto-login on start failed");
      });
    } else {
      const savedJsession = getCredential("msb_jsessionid");
      if (savedJsession) {
        this.cookies = { JSESSIONID: savedJsession };
        this.dseSessionId = getCredential("msb_dse_sessionid") || "";
        this.loginUsername = savedUsername || null;
        this.loggedIn = true;
      }
    }

    if (!this.loggedIn && !isAutoMode) {
      logger.info("MSB Bank: chưa có session — cần đăng nhập trong Admin Panel → MSB Bank");
      return;
    }

    if (this.pollingTimer) return;
    this.running = true;
    this.pollingTimer = setInterval(async () => {
      if (!this.isPolling) await this.poll();
    }, POLL_INTERVAL_MS);
    logger.info({ intervalMs: POLL_INTERVAL_MS }, "🏦 MSB Bank polling started");
  }

  stop(): void {
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    this.stopActivePoll();
    this.running = false;
    logger.info("🏦 MSB Bank polling stopped");
  }

  // ── Active polling (5s) — bật khi có lệnh nạp đang chờ ──────────────────
  private activePollTimer: NodeJS.Timeout | null = null;
  private readonly ACTIVE_POLL_MS = 5_000;

  startActivePoll(): void {
    if (this.activePollTimer) return;       // đang chạy rồi
    if (!this.pollingTimer || !this.loggedIn) return; // chưa start hoặc chưa login

    this.activePollTimer = setInterval(async () => {
      if (!this.isPolling) await this.poll();
    }, this.ACTIVE_POLL_MS);
    logger.info({ intervalMs: this.ACTIVE_POLL_MS }, "⚡ MSB Bank active polling started (pending deposit)");
  }

  stopActivePoll(): void {
    if (this.activePollTimer) {
      clearInterval(this.activePollTimer);
      this.activePollTimer = null;
      logger.info("⏸ MSB Bank active polling stopped");
    }
  }

  logout(): void {
    this.stop();
    this.loggedIn = false;
    this.cookies = {};
    this.dseSessionId = "";
    this.lastError = null;
    this.loginUsername = null;
    this.captchaSession = null;
    setCredentials({ msb_jsessionid: "", msb_dse_sessionid: "", msb_username: "", msb_password: "" });
    logger.info("🏦 MSB Bank logged out");
  }

  // ── DEBUG METHODS ────────────────────────────────────────────────────────

  /**
   * Debug: Theo dõi từng bước GET /IBSRetail/ → redirect chain → login form.
   * Trả về HTML thật + metadata tại MỖI bước để kiểm tra redirect flow và
   * form field names thực tế của MSB.
   */
  async debugLoginPage(): Promise<{
    steps: Array<{
      hop: number;
      path: string;
      status: number;
      htmlLen: number;
      html: string;
      jsRedirect: string | null;
      hiddenFields: Record<string, string>;
      isLoginForm: boolean;
      hasImageServlet: boolean;
    }>;
    dseSessionId: string;
    cookies: Record<string, string>;
    error?: string;
  }> {
    const steps: any[] = [];
    let cookies: CookieJar = {};
    let currentPath = "/IBSRetail/";
    let currentHtml = "";

    try {
      // Hop 0: GET /IBSRetail/
      const initRes = await httpGet(currentPath, cookies, makeClient());
      cookies = initRes.cookies;
      currentHtml = initRes.text;
      currentPath = initRes.finalPath;
      const initFields = extractHiddenFields(currentHtml);
      steps.push({
        hop: 0,
        path: currentPath,
        status: initRes.status,
        htmlLen: currentHtml.length,
        html: currentHtml.substring(0, 8000),
        jsRedirect: extractJsRedirect(currentHtml),
        hiddenFields: initFields,
        isLoginForm: currentHtml.includes("_verifyCode") && currentHtml.includes("_userName"),
        hasImageServlet: currentHtml.includes("ImageServlet"),
      });

      // Follow JS redirects
      for (let hop = 1; hop <= 8; hop++) {
        const jsRedirect = extractJsRedirect(currentHtml);
        if (!jsRedirect) break;

        let nextPath: string;
        try {
          const u = new URL(jsRedirect, MSB_BASE_URL);
          nextPath = (u.pathname + u.search).replace(/&amp;/g, "&");
        } catch {
          nextPath = jsRedirect.replace(/&amp;/g, "&");
        }

        const hopRes = await httpGet(nextPath, cookies, makeClient(), `${MSB_BASE_URL}${currentPath}`);
        cookies = hopRes.cookies;
        currentHtml = hopRes.text;
        currentPath = hopRes.finalPath;
        const hopFields = extractHiddenFields(currentHtml);

        steps.push({
          hop,
          path: nextPath,
          status: hopRes.status,
          htmlLen: currentHtml.length,
          html: currentHtml.substring(0, 8000),
          jsRedirect: extractJsRedirect(currentHtml),
          hiddenFields: hopFields,
          isLoginForm: currentHtml.includes("_verifyCode") && currentHtml.includes("_userName"),
          hasImageServlet: currentHtml.includes("ImageServlet"),
        });

        // Stop when we've reached an actual form page
        if (Object.keys(hopFields).length > 2 || currentHtml.includes("_verifyCode")) break;
      }

      const lastStep = steps[steps.length - 1];
      const dseSessionId =
        lastStep?.hiddenFields?.["dse_sessionId"] ||
        extractDseSessionId(lastStep?.html || "", currentPath);

      return { steps, dseSessionId, cookies };
    } catch (err: any) {
      return { steps, dseSessionId: "", cookies, error: err.message };
    }
  }

  /**
   * Debug: Dùng session hiện tại, lấy HTML dashboard + thử các operation
   * để xem trang thật MSB trả về gì sau khi đã đăng nhập.
   */
  async debugDashboard(): Promise<{
    sessionInfo: { hasSession: boolean; jsessionId: string; dseSessionId: string };
    attempts: Array<{
      label: string;
      path: string;
      status: number;
      htmlLen: number;
      html: string;
      jsRedirect: string | null;
      redirectedPath?: string;
      redirectedHtml?: string;
      parsedAccounts: MSBAccount[];
      isLoginPage: boolean;
      isTimeout: boolean;
    }>;
    error?: string;
  }> {
    const sessionInfo = {
      hasSession: !!(this.cookies.JSESSIONID && this.dseSessionId),
      jsessionId: this.cookies.JSESSIONID ? `...${this.cookies.JSESSIONID.slice(-8)}` : "(none)",
      dseSessionId: this.dseSessionId || "(none)",
    };

    if (!this.cookies.JSESSIONID || !this.dseSessionId) {
      return { sessionInfo, attempts: [], error: "Chưa đăng nhập — cần login trước" };
    }

    const isLoginPage = (html: string) =>
      html.includes("_verifyCode") || html.includes("retailUserLoginProc");
    const isTimeout = (html: string) =>
      html.includes("SessionTimeout") || html.includes("section-timeout") || html.includes("timeout.jsp");

    const ops = [
      { label: "retailIndexProc", pageId: "1" },
      { label: "retailDashboardProc", pageId: "1" },
      { label: "retailAccountListProc", pageId: "1" },
      { label: "retailAccountListProc", pageId: "3" },
      { label: "retailAccountListProc", pageId: "4" },
      { label: "retailAccountDetailProc", pageId: "1" },
    ];

    const attempts: any[] = [];

    for (const { label, pageId } of ops) {
      const path = `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=${pageId}&dse_operationName=${label}&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`;
      try {
        const res = await httpGet(path, this.cookies, makeClient(), `${MSB_BASE_URL}/IBSRetail/`);
        this.cookies = res.cookies;

        let redirectedPath: string | undefined;
        let redirectedHtml: string | undefined;
        let finalHtml = res.text;
        const jsRedir = extractJsRedirect(res.text);

        if (jsRedir) {
          try {
            const u = new URL(jsRedir, MSB_BASE_URL);
            redirectedPath = (u.pathname + u.search).replace(/&amp;/g, "&");
            const newDse = redirectedPath.match(/dse_sessionId=([^&]+)/)?.[1];
            if (newDse) this.dseSessionId = newDse;
            const res2 = await httpGet(redirectedPath, this.cookies, makeClient(), `${MSB_BASE_URL}${path}`);
            this.cookies = res2.cookies;
            redirectedHtml = res2.text.substring(0, 8000);
            finalHtml = res2.text;
          } catch {}
        }

        attempts.push({
          label: `${label} (pageId=${pageId})`,
          path,
          status: res.status,
          htmlLen: finalHtml.length,
          html: finalHtml.substring(0, 8000),
          jsRedirect: jsRedir,
          redirectedPath,
          redirectedHtml,
          parsedAccounts: parseAccountsFromHtml(finalHtml),
          isLoginPage: isLoginPage(finalHtml),
          isTimeout: isTimeout(finalHtml),
        });
      } catch (err: any) {
        attempts.push({
          label: `${label} (pageId=${pageId})`,
          path,
          status: 0,
          htmlLen: 0,
          html: "",
          jsRedirect: null,
          parsedAccounts: [],
          isLoginPage: false,
          isTimeout: false,
          error: err.message,
        });
      }
    }

    return { sessionInfo, attempts };
  }

  /**
   * Debug: Thử POST retailAccountHistoryProc với nhiều pageId khác nhau.
   * Dùng để tìm đúng dse_pageId cho transaction history của tài khoản cụ thể.
   */
  async debugTransactions(accountNumber: string, pageIds: number[] = [3, 4, 5, 8, 10, 11, 12, 15, 20]): Promise<{
    accountNumber: string;
    results: Array<{
      pageId: number;
      status: number;
      htmlLen: number;
      html: string;
      parsedTxCount: number;
      parsedTxSample: MSBTransaction[];
      isLoginPage: boolean;
      isError: boolean;
    }>;
    error?: string;
  }> {
    if (!this.loggedIn || !this.cookies.JSESSIONID) {
      return { accountNumber, results: [], error: "Chưa đăng nhập" };
    }

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 ngày
    const fmt = (d: Date) =>
      `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    const results: any[] = [];

    for (const pageId of pageIds) {
      const body = new URLSearchParams({
        dse_sessionId: this.dseSessionId,
        dse_applicationId: "-1",
        dse_pageId: String(pageId),
        dse_operationName: "retailAccountHistoryProc",
        dse_errorPage: "error_page.jsp",
        dse_processorState: "initial",
        dse_nextEventName: "next",
        accountNumber,
        fromDate: fmt(from),
        toDate: fmt(now),
        currency: "VND",
        type: "C",
      }).toString();

      try {
        const referer = `${MSB_BASE_URL}/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_operationName=retailIndexProc`;
        const res = await httpPost("/IBSRetail/Request", body, this.cookies, makeClient(), referer);
        this.cookies = res.cookies;

        const isLoginPage = res.text.includes("_verifyCode") || res.text.includes("retailUserLoginProc");
        const isError = res.text.toLowerCase().includes("error") || res.status >= 400;
        const txs = parseTransactionsFromHtml(res.text);

        results.push({
          pageId,
          status: res.status,
          htmlLen: res.text.length,
          html: res.text.substring(0, 6000),
          parsedTxCount: txs.length,
          parsedTxSample: txs.slice(0, 3),
          isLoginPage,
          isError,
        });
      } catch (err: any) {
        results.push({
          pageId,
          status: 0,
          htmlLen: 0,
          html: "",
          parsedTxCount: 0,
          parsedTxSample: [],
          isLoginPage: false,
          isError: true,
          error: err.message,
        });
      }
    }

    return { accountNumber, results };
  }

  /** Debug: trả về raw HTML từ các account page — dùng để kiểm tra parser (legacy) */
  async fetchAccountsRaw(): Promise<Record<string, string>> {
    if (!this.cookies.JSESSIONID || !this.dseSessionId) {
      return { error: `không có session — jsession:${!!this.cookies.JSESSIONID} dse:${this.dseSessionId}` };
    }
    const result: Record<string, string> = {};
    const paths = [
      ["dashboard", `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailDashboardProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`],
      ["index", `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailIndexProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`],
      ["accountList", `/IBSRetail/Request?dse_sessionId=${this.dseSessionId}&dse_applicationId=-1&dse_pageId=1&dse_operationName=retailAccountListProc&dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start`],
    ];
    for (const [label, path] of paths) {
      try {
        const res = await httpGet(path, this.cookies, getPollClient(), `${MSB_BASE_URL}/IBSRetail/`);
        this.cookies = res.cookies;
        // follow một bước JS redirect nếu có
        const jsRedir = extractJsRedirect(res.text);
        if (jsRedir) {
          try {
            const u = new URL(jsRedir, MSB_BASE_URL);
            const nextPath = (u.pathname + u.search).replace(/&amp;/g, "&");
            const res2 = await httpGet(nextPath, this.cookies, getPollClient(), `${MSB_BASE_URL}${path}`);
            this.cookies = res2.cookies;
            result[label] = res2.text.substring(0, 3000);
            result[`${label}_redirect`] = nextPath;
            continue;
          } catch {}
        }
        result[label] = res.text.substring(0, 3000);
      } catch (err: any) {
        result[label] = `ERROR: ${err.message}`;
      }
    }
    return result;
  }

  getStatus(): MSBStatus {
    return {
      loggedIn: this.loggedIn,
      running: this.running,
      accountNumber: getCredential("msb_account_number") || null,
      sessionSet: !!this.cookies.JSESSIONID,
      lastError: this.lastError,
      mode: this.loginUsername
        ? (getCredential("msb_auto_mode") === "1" ? "auto_login" : "direct_login")
        : "session_cookie",
      username: this.loginUsername || getCredential("msb_username") || null,
      autoLoginRunning: this.autoLoginRunning,
      accounts: this.getCachedAccounts(),
      fetchingAccounts: this.fetchingAccounts,
    };
  }
}

export const msbService = new MSBService();
