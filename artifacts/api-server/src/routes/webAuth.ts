import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { webUsersTable, telegramLinkCodesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { randomInt } from "crypto";
import { JWT_SECRET } from "../lib/security.js";
import { telegramBotService } from "../telegram/telegramBot";
import { logger } from "../lib/logger";

const router = Router();

// JWT_SECRET imported from shared security module (env-backed)
const TOKEN_TTL = "7d";

function generateCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < len; i++) code += chars[randomInt(chars.length)];
  return code;
}

function generate6Digit(): string {
  return String(randomInt(100000, 999999));
}

function makeJwt(webUserId: number): string {
  return jwt.sign({ sub: String(webUserId) }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export async function getWebUser(req: import("express").Request) {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const [user] = await db
      .select()
      .from(webUsersTable)
      .where(eq(webUsersTable.id, Number(payload.sub)))
      .limit(1);
    return user ?? null;
  } catch {
    return null;
  }
}

// ─── Register ────────────────────────────────────────────────────────────────

router.post("/web/auth/register", async (req, res) => {
  try {
    const { username, password, displayName } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
    };

    if (!username || !password) {
      res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }
    if (username.length < 4 || username.length > 30) {
      res.status(400).json({ error: "Tên đăng nhập phải từ 4–30 ký tự" });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({ error: "Tên đăng nhập chỉ được dùng chữ, số và dấu gạch dưới" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Mật khẩu phải ít nhất 6 ký tự" });
      return;
    }

    const existing = await db
      .select({ id: webUsersTable.id })
      .from(webUsersTable)
      .where(eq(webUsersTable.username, username.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Tên đăng nhập đã tồn tại" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(webUsersTable).values({
      username: username.toLowerCase(),
      passwordHash,
      displayName: displayName?.trim() || username,
      isVerified: true,
    });

    // Do NOT auto-login — return ok so frontend switches to login tab
    res.json({ ok: true, message: "Đăng ký thành công! Hãy đăng nhập để tiếp tục." });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────

router.post("/web/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }

    const [user] = await db
      .select()
      .from(webUsersTable)
      .where(eq(webUsersTable.username, username.toLowerCase()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Tài khoản đã bị khóa" });
      return;
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      res.status(401).json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" });
      return;
    }

    const token = makeJwt(user.id);
    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        telegramLinked: !!user.telegramId,
        telegramUsername: user.telegramUsername,
      },
    });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── Me ──────────────────────────────────────────────────────────────────────

router.get("/web/auth/me", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      telegramLinked: !!user.telegramId,
      telegramUsername: user.telegramUsername,
    });
  } catch (err) {
    req.log.error({ err }, "me error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

// ─── Telegram Linking ─────────────────────────────────────────────────────────

/**
 * Step 1: Web generates a link session and returns a Telegram deep link.
 * The deep link triggers /start wlink_CODE in the bot.
 */
router.post("/web/auth/link-telegram/init", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }
    if (user.telegramId) {
      res.status(409).json({ error: "Tài khoản đã liên kết Telegram rồi" });
      return;
    }

    // Expire old pending sessions for this user
    const code = generateCode(10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.insert(telegramLinkCodesTable).values({
      webUserId: user.id,
      code,
      expiresAt,
    });

    const botUsername = telegramBotService.getBotUsername();
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=wlink_${code}`
      : null;

    res.json({
      ok: true,
      code,
      deepLink,
      botUsername,
      expiresInMinutes: 15,
    });
  } catch (err) {
    req.log.error({ err }, "link-telegram/init error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

/**
 * Step 2: After bot sends 6-digit code, user submits it here.
 */
router.post("/web/auth/link-telegram/verify", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }

    const { code, verifyCode } = req.body as { code?: string; verifyCode?: string };
    if (!code || !verifyCode) {
      res.status(400).json({ error: "Thiếu mã liên kết hoặc mã xác thực" });
      return;
    }

    const now = new Date();
    const [linkRow] = await db
      .select()
      .from(telegramLinkCodesTable)
      .where(
        and(
          eq(telegramLinkCodesTable.code, code),
          eq(telegramLinkCodesTable.webUserId, user.id),
          eq(telegramLinkCodesTable.used, false),
          gt(telegramLinkCodesTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (!linkRow) {
      res.status(400).json({ error: "Phiên liên kết không hợp lệ hoặc đã hết hạn" });
      return;
    }
    if (!linkRow.verifyCode || !linkRow.pendingTelegramId) {
      res.status(400).json({ error: "Bot chưa xác nhận — hãy hoàn tất bước bên Telegram trước" });
      return;
    }
    if (linkRow.verifyCode !== verifyCode.trim()) {
      res.status(400).json({ error: "Mã xác thực không đúng" });
      return;
    }

    // Complete the link
    await db
      .update(webUsersTable)
      .set({
        telegramId: linkRow.pendingTelegramId,
        telegramUsername: linkRow.pendingPhone ?? null,
      })
      .where(eq(webUsersTable.id, user.id));

    await db
      .update(telegramLinkCodesTable)
      .set({ used: true })
      .where(eq(telegramLinkCodesTable.id, linkRow.id));

    res.json({ ok: true, message: "Liên kết Telegram thành công!" });
  } catch (err) {
    req.log.error({ err }, "link-telegram/verify error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

/**
 * Check if a link session has been confirmed by the bot yet (polling endpoint).
 */
router.get("/web/auth/link-telegram/status", async (req, res) => {
  try {
    const user = await getWebUser(req);
    if (!user) {
      res.status(401).json({ error: "Chưa đăng nhập" });
      return;
    }

    const code = req.query["code"] as string;
    if (!code) {
      res.status(400).json({ error: "Thiếu code" });
      return;
    }

    const now = new Date();
    const [linkRow] = await db
      .select()
      .from(telegramLinkCodesTable)
      .where(
        and(
          eq(telegramLinkCodesTable.code, code),
          eq(telegramLinkCodesTable.webUserId, user.id),
          eq(telegramLinkCodesTable.used, false),
          gt(telegramLinkCodesTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (!linkRow) {
      res.json({ status: "expired" });
      return;
    }

    if (linkRow.verifyCode && linkRow.pendingTelegramId) {
      res.json({ status: "ready", message: "Bot đã gửi mã — nhập mã 6 số vào bên dưới" });
    } else {
      res.json({ status: "waiting", message: "Đang chờ xác nhận từ Telegram..." });
    }
  } catch (err) {
    req.log.error({ err }, "link-telegram/status error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

/**
 * Called by bot internally when user shares phone after deep link /start wlink_CODE.
 * Stores the verify code, so web can confirm.
 */
router.post("/web/auth/link-telegram/bot-confirm", async (req, res) => {
  try {
    const { code, telegramId, phone, verifyCode } = req.body as {
      code?: string;
      telegramId?: string;
      phone?: string;
      verifyCode?: string;
    };

    if (!code || !telegramId || !verifyCode) {
      res.status(400).json({ error: "Thiếu thông tin" });
      return;
    }

    const now = new Date();
    const [linkRow] = await db
      .select()
      .from(telegramLinkCodesTable)
      .where(
        and(
          eq(telegramLinkCodesTable.code, code),
          eq(telegramLinkCodesTable.used, false),
          gt(telegramLinkCodesTable.expiresAt, now),
        ),
      )
      .limit(1);

    if (!linkRow) {
      res.status(400).json({ error: "Mã liên kết không hợp lệ hoặc đã hết hạn" });
      return;
    }

    await db
      .update(telegramLinkCodesTable)
      .set({
        verifyCode,
        pendingTelegramId: telegramId,
        pendingPhone: phone ?? null,
      })
      .where(eq(telegramLinkCodesTable.id, linkRow.id));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "link-telegram/bot-confirm error");
    res.status(500).json({ error: "Lỗi server" });
  }
});

export default router;
