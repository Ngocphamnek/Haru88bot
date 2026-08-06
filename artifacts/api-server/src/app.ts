import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { scheduleMaintenance } from "./lib/maintenance";
import { migratePlaintextCredentials } from "./lib/bankCredStore.js";
import { securityHeaders } from "./lib/securityHeaders.js";

const app: Express = express();

app.use(securityHeaders);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── CORS whitelist ──────────────────────────────────────────────────────────
const extraOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const replitDomains = (process.env.REPLIT_DOMAINS || "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => `https://${d}`);

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  ...replitDomains,
  ...extraOrigins,
];

app.use(
  cors({
    origin(origin, cb) {
      // Allow non-browser clients (no Origin) and Telegram webviews
      if (!origin) return cb(null, true);
      if (defaultOrigins.includes(origin)) return cb(null, true);
      // Allow same-host deployments
      try {
        const u = new URL(origin);
        if (u.hostname.endsWith(".replit.dev") || u.hostname.endsWith(".repl.co")) {
          return cb(null, true);
        }
      } catch {
        /* ignore */
      }
      if (process.env.NODE_ENV !== "production") {
        return cb(null, true);
      }
      logger.warn({ origin }, "CORS blocked origin");
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-token",
      "x-game-token",
      "x-telegram-init-data",
    ],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Rate limiting ───────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Quá nhiều yêu cầu đăng nhập, thử lại sau 15 phút." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded, vui lòng thử lại sau." },
});

// Admin API gets its own tighter limiter (token auth is not a free pass for abuse)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Admin rate limit exceeded." },
});

// Bet endpoints — tighter per-IP limit (per-user limits also enforced in gameServer)
const betLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bet rate limit exceeded" },
});

app.use("/api/admin/login", authLimiter);
app.use("/api/auth/web/auth/login", authLimiter);
app.use("/api/auth/web/auth/register", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api/bau-cua/games/bau-cua-bet", betLimiter);
app.use("/api/xoc-dia/games/xoc-dia-bet", betLimiter);
app.use("/api/quay-thu/games/quay-thu-bet", betLimiter);
app.use("/api/dua-xe/games/dua-xe-bet", betLimiter);
app.use("/api/crash/games/crash-bet", betLimiter);
app.use("/api", apiLimiter);

app.use("/api", router);

// ── Auto-startup ────────────────────────────────────────────────────────────
setTimeout(async () => {
  try {
    // Encrypt any legacy plaintext bank creds on boot
    try {
      const { ensureLedgerIndexes } = await import("./lib/ledger.js");
      await ensureLedgerIndexes();
    } catch (err) {
      logger.warn({ err }, "ledger index ensure skipped");
    }

    try {
      const n = migratePlaintextCredentials();
      if (n > 0) logger.info({ count: n }, "🔐 Migrated plaintext bank credentials to encrypted storage");
    } catch (err) {
      logger.warn({ err }, "bank cred migration skipped");
    }

    const { getSetting } = await import("./lib/settings.js");

    const botToken = await getSetting("bot_token") || process.env["BOT_TOKEN"];
    if (botToken) {
      try {
        const { telegramBotService } = await import("./telegram/telegramBot.js");
        await telegramBotService.initialize(botToken);
        logger.info("✅ Bot chính đã khởi động từ token đã lưu");
      } catch (err) {
        logger.warn({ err }, "⚠️ Bot chính không khởi động được — kiểm tra token");
      }
    } else {
      logger.warn("⚠️ Không tìm thấy BOT_TOKEN — bot chưa khởi động. Cấu hình qua admin panel.");
    }

    const bot2Token = await getSetting("bot2_token") || process.env["BOT2_TOKEN"];
    if (bot2Token) {
      try {
        const { telegramBot2Service } = await import("./telegram/telegramBot2.js");
        await telegramBot2Service.initialize(bot2Token);
        logger.info("✅ Bot2 đã khởi động từ token đã lưu");
      } catch (err) {
        logger.warn({ err }, "⚠️ Bot2 không khởi động được");
      }
    }

    const supportToken = await getSetting("support_bot_token") || process.env["SUPPORT_BOT_TOKEN"];
    if (supportToken) {
      try {
        const { supportBotService } = await import("./telegram/supportBot.js");
        await supportBotService.initialize(supportToken);
        logger.info("✅ Support bot đã khởi động từ token đã lưu");
      } catch (err) {
        logger.warn({ err }, "⚠️ Support bot không khởi động được");
      }
    }

    try {
      const { msbService } = await import("./telegram/msbService.js");
      const { getCredential } = await import("./lib/bankCredStore.js");
      const msbUser = getCredential("msb_username") || await getSetting("msb_username");
      const msbPass = getCredential("msb_password") || await getSetting("msb_password");
      const isAutoMode = getCredential("msb_auto_mode") === "1";

      if (isAutoMode && msbUser && msbPass) {
        logger.info({ username: msbUser }, "🏦 MSB Bank: bắt đầu auto-login...");
        msbService.autoLogin(msbUser, msbPass).then(async (result) => {
          if (result.success) {
            logger.info({ attempts: result.attempts }, "✅ MSB Bank: auto-login thành công");
            await msbService.start();
            const accounts = await msbService.fetchAccounts();
            if (accounts.length > 0) {
              logger.info({ accounts: accounts.map(a => a.accountNumber) }, "💰 MSB: tài khoản đã lấy");
            }
          } else {
            logger.warn({ msg: result.message }, "⚠️ MSB auto-login thất bại — vào Admin Panel → MSB để đăng nhập thủ công");
            msbService.fetchLoginPage().catch(() => {});
          }
        }).catch(err => {
          logger.warn({ err }, "⚠️ MSB auto-login error");
          msbService.fetchLoginPage().catch(() => {});
        });
      } else if (msbUser) {
        msbService.fetchLoginPage().then(() => {
          logger.info("✅ MSB login page pre-loaded — vào Admin Panel → MSB để đăng nhập");
        }).catch(() => {
          logger.debug("⚠️ MSB login page pre-load skipped");
        });
      }
    } catch (err) {
      logger.warn({ err }, "⚠️ MSB startup skipped");
    }

  } catch (err) {
    logger.error({ err }, "❌ Auto-startup initialization failed");
  }
}, 3_000);

scheduleMaintenance();

export default app;
