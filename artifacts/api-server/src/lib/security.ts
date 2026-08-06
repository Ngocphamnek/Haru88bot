/**
 * Shared security helpers: secrets (fail-closed in prod), admin JWT + revoke,
 * optional static token (dev/automation only), game tokens, Telegram initData, encryption.
 */
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  createHash,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";
import { isAdminJtiRevoked } from "./adminSessionStore.js";

const IS_PROD = process.env.NODE_ENV === "production";

// ─── Secrets ─────────────────────────────────────────────────────────────────

function requireOrGenerate(name: string, bytes: number, prodRequired: boolean): string {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;

  if (prodRequired && IS_PROD) {
    const msg = `FATAL: ${name} is required in production. Refusing to start with auto-generated secret.`;
    logger.error(msg);
    throw new Error(msg);
  }

  const generated = randomBytes(bytes).toString("hex");
  logger.warn(
    `⚠️  ${name} env var not set — using auto-generated value (invalidated on restart). Set ${name} for a stable secret.`,
  );
  return generated;
}

export const ADMIN_TOKEN: string = requireOrGenerate("ADMIN_TOKEN", 32, true);
export const JWT_SECRET: string = requireOrGenerate("JWT_SECRET", 32, true);
export const GAME_TOKEN_SECRET: string = requireOrGenerate("GAME_TOKEN_SECRET", 32, true);
export const CRED_ENCRYPTION_KEY: string =
  process.env.CRED_ENCRYPTION_KEY?.trim() ||
  (() => {
    if (IS_PROD) {
      throw new Error("FATAL: CRED_ENCRYPTION_KEY is required in production");
    }
    return JWT_SECRET;
  })();

/** When true (default in production), static ADMIN_TOKEN is rejected — session JWT only. */
export const DISALLOW_STATIC_ADMIN_TOKEN =
  process.env.DISALLOW_STATIC_ADMIN_TOKEN === "1" ||
  (IS_PROD && process.env.DISALLOW_STATIC_ADMIN_TOKEN !== "0");

export const ADMIN_IP_ALLOWLIST: string[] = (process.env.ADMIN_IP_ALLOWLIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const ADMIN_JWT_TTL_SEC = Number(process.env.ADMIN_JWT_TTL_SEC || 8 * 3600);
export const GAME_TOKEN_TTL_MS = Number(process.env.GAME_TOKEN_TTL_MS || 2 * 60 * 60 * 1000);

export function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      timingSafeEqual(ba, ba);
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

// ─── Admin session JWT ───────────────────────────────────────────────────────

export interface AdminJwtPayload {
  role: "admin";
  sub: string;
  exp: number;
  iat: number;
  jti: string;
}

export function issueAdminSession(username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminJwtPayload = {
    role: "admin",
    sub: username,
    iat: now,
    exp: now + ADMIN_JWT_TTL_SEC,
    jti: randomBytes(16).toString("hex"),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", JWT_SECRET).update(`admin.v1.${body}`).digest();
  return `adm1.${body}.${b64url(sig)}`;
}

export function verifyAdminSession(token: string): AdminJwtPayload | null {
  if (!token || !token.startsWith("adm1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = parts[1]!;
  const sigB64 = parts[2]!;
  const expected = createHmac("sha256", JWT_SECRET).update(`admin.v1.${body}`).digest();
  let given: Buffer;
  try {
    given = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as AdminJwtPayload;
    if (payload.role !== "admin") return null;
    if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) return null;
    if (!payload.sub || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}

function clientIp(req: Request): string {
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xff || req.ip || "";
}

function ipAllowed(ip: string): boolean {
  if (ADMIN_IP_ALLOWLIST.length === 0) return true;
  if (!ip) return false;
  return ADMIN_IP_ALLOWLIST.some((rule) => {
    if (rule.endsWith("*")) return ip.startsWith(rule.slice(0, -1));
    if (rule.endsWith(".")) return ip.startsWith(rule);
    return ip === rule;
  });
}

export type AuthedAdminRequest = Request & {
  adminUser?: string;
  adminAuthMode?: "session" | "static_token";
  adminJti?: string;
  adminTokenRaw?: string;
};

/**
 * Require admin session JWT (preferred) OR legacy static ADMIN_TOKEN (if allowed).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      if (!ipAllowed(clientIp(req))) {
        res.status(403).json({ success: false, error: "Forbidden (IP)" });
        return;
      }

      const header = req.headers.authorization ?? "";
      const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
      const xAdmin = String(req.headers["x-admin-token"] ?? "").trim();
      const token = bearer || xAdmin;

      if (!token) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const session = verifyAdminSession(token);
      if (session) {
        if (await isAdminJtiRevoked(session.jti)) {
          res.status(401).json({ success: false, error: "Session revoked" });
          return;
        }
        (req as AuthedAdminRequest).adminUser = session.sub;
        (req as AuthedAdminRequest).adminAuthMode = "session";
        (req as AuthedAdminRequest).adminJti = session.jti;
        (req as AuthedAdminRequest).adminTokenRaw = token;
        next();
        return;
      }

      if (!DISALLOW_STATIC_ADMIN_TOKEN && timingSafeStringEqual(token, ADMIN_TOKEN)) {
        (req as AuthedAdminRequest).adminUser = "static-token";
        (req as AuthedAdminRequest).adminAuthMode = "static_token";
        next();
        return;
      }

      res.status(401).json({ success: false, error: "Unauthorized" });
    } catch (err) {
      logger.error({ err }, "requireAdmin error");
      res.status(500).json({ success: false, error: "Auth error" });
    }
  })();
}

/** Sync check used outside middleware (e.g. game session mint). */
export function isValidAdminTokenSync(token: string): boolean {
  if (!token) return false;
  if (verifyAdminSession(token)) return true;
  if (!DISALLOW_STATIC_ADMIN_TOKEN && timingSafeStringEqual(token, ADMIN_TOKEN)) return true;
  return false;
}

// ─── Game session tokens ─────────────────────────────────────────────────────

export function issueGameToken(tgid: string, game?: string): string {
  const exp = Date.now() + GAME_TOKEN_TTL_MS;
  const payload = `${tgid}.${exp}${game ? `.${game}` : ""}`;
  const sig = createHmac("sha256", GAME_TOKEN_SECRET).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

export function verifyGameToken(token: string, expectedTgid?: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  let payload: string;
  try {
    payload = fromB64url(payloadB64).toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = createHmac("sha256", GAME_TOKEN_SECRET).update(payload).digest();
  let givenSig: Buffer;
  try {
    givenSig = fromB64url(sigB64);
  } catch {
    return null;
  }
  if (expectedSig.length !== givenSig.length || !timingSafeEqual(expectedSig, givenSig)) {
    return null;
  }

  const segs = payload.split(".");
  const tgid = segs[0];
  const exp = Number(segs[1]);
  if (!tgid || !/^\d{5,15}$/.test(tgid)) return null;
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  if (expectedTgid && tgid !== String(expectedTgid)) return null;
  return tgid;
}

export function verifyTelegramWebAppInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86400,
): { ok: true; userId: string; user?: Record<string, unknown> } | { ok: false; error: string } {
  if (!initData || !botToken) return { ok: false, error: "missing initData or bot token" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "missing hash" };
  params.delete("hash");

  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!timingSafeStringEqual(calculated, hash)) {
    return { ok: false, error: "invalid signature" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    return { ok: false, error: "initData expired" };
  }

  let user: Record<string, unknown> | undefined;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  const userId = user?.id != null ? String(user.id) : "";
  if (!userId) return { ok: false, error: "missing user id" };
  return { ok: true, userId, user };
}

export function resolveGameUserId(
  req: Request,
  opts: { botToken?: string; requireAuth?: boolean } = {},
): { tgid: string | null; error?: string } {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const q = req.query as Record<string, unknown>;

  const gameToken = String(
    req.headers["x-game-token"] ?? body.gameToken ?? body.gtoken ?? q.gtoken ?? q.gameToken ?? "",
  ).trim();
  if (gameToken) {
    const claimed =
      String(body.tgid ?? body.tgId ?? q.tgid ?? q.tgId ?? "").trim() || undefined;
    const tgid = verifyGameToken(gameToken, claimed);
    if (tgid) return { tgid };
    return { tgid: null, error: "Invalid or expired game token" };
  }

  const initData = String(
    req.headers["x-telegram-init-data"] ?? body.initData ?? body.telegramInitData ?? "",
  ).trim();
  if (initData && opts.botToken) {
    const v = verifyTelegramWebAppInitData(initData, opts.botToken);
    if (v.ok) return { tgid: v.userId };
    return { tgid: null, error: v.error };
  }

  if (opts.requireAuth !== false) {
    return { tgid: null, error: "Authentication required (game token or Telegram initData)" };
  }

  const legacy = String(body.tgid ?? body.tgId ?? q.tgid ?? q.tgId ?? "").trim();
  if (legacy && /^\d{5,15}$/.test(legacy)) return { tgid: legacy };
  return { tgid: null, error: "tgid required" };
}

export function resolveGameUserFromToken(
  gameToken: string | undefined,
  claimedTgid?: string,
  initData?: string,
  botToken?: string,
): string | null {
  if (gameToken) {
    return verifyGameToken(gameToken, claimedTgid || undefined);
  }
  if (initData && botToken) {
    const v = verifyTelegramWebAppInitData(initData, botToken);
    return v.ok ? v.userId : null;
  }
  return null;
}

export function requireGameAuth(botTokenGetter: () => string | Promise<string | undefined>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const botToken = (await botTokenGetter()) || process.env.BOT_TOKEN || "";
      const { tgid, error } = resolveGameUserId(req, { botToken, requireAuth: true });
      if (!tgid) {
        res.status(401).json({ success: false, error: error || "Unauthorized" });
        return;
      }
      (req as Request & { gameTgid?: string }).gameTgid = tgid;
      if (req.body && typeof req.body === "object") {
        (req.body as Record<string, unknown>).tgid = tgid;
      }
      next();
    } catch (err) {
      logger.error({ err }, "requireGameAuth error");
      res.status(500).json({ success: false, error: "Auth error" });
    }
  };
}

// ─── Credential encryption (AES-256-GCM) ─────────────────────────────────────

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "haru88-bank-creds-v1", 32);
}

export function encryptSecret(plaintext: string, secret = CRED_ENCRYPTION_KEY): string {
  if (!plaintext) return "";
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function decryptSecret(ciphertext: string, secret = CRED_ENCRYPTION_KEY): string {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith("enc:v1:")) return ciphertext;
  const parts = ciphertext.split(":");
  if (parts.length !== 5) return "";
  try {
    const iv = Buffer.from(parts[2]!, "base64url");
    const tag = Buffer.from(parts[3]!, "base64url");
    const data = Buffer.from(parts[4]!, "base64url");
    const key = deriveKey(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}

export function hashTokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 12);
}
