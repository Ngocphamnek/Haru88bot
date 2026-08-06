import { Router, type Request, type Response } from "express";
import { storage } from "../lib/storage";
import { gameSession, type GameId } from "../telegram/gameSession";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  issueGameToken,
  resolveGameUserId,
  requireAdmin,
  ADMIN_TOKEN,
  timingSafeStringEqual,
  verifyAdminSession,
  isValidAdminTokenSync,
} from "../lib/security.js";
import { getSetting } from "../lib/settings.js";
import { applyBalanceDelta } from "../lib/ledger.js";
import { writeAuditLog } from "../lib/audit.js";

const router = Router();

async function botToken(): Promise<string> {
  return (await getSetting("bot_token")) || process.env["BOT_TOKEN"] || "";
}

/**
 * Issue a short-lived game session token.
 * - Admin can mint for any tgid (support / testing)
 * - Telegram WebApp initData can mint for the signed-in user only
 */
router.post("/game/session", async (req: Request, res: Response) => {
  try {
    const initData = String(
      req.headers["x-telegram-init-data"] ?? req.body?.initData ?? "",
    ).trim();
    // Admin mint path
    const bearer = String(req.headers.authorization ?? "");
    const bearerTok = bearer.startsWith("Bearer ") ? bearer.slice(7).trim() : "";
    const xAdmin = String(req.headers["x-admin-token"] ?? "").trim();
    const adminTok = bearerTok || xAdmin;
    if (adminTok && isValidAdminTokenSync(adminTok)) {
      const tgid = String(req.body?.tgid ?? "").trim();
      if (!/^\d{5,15}$/.test(tgid)) {
        res.status(400).json({ error: "Invalid tgid" });
        return;
      }
      const token = issueGameToken(tgid, String(req.body?.game ?? ""));
      res.json({ ok: true, token, tgid, expiresInSec: 7200 });
      return;
    }

    if (!initData) {
      res.status(401).json({ error: "initData or admin auth required" });
      return;
    }

    const { tgid, error } = resolveGameUserId(req, {
      botToken: await botToken(),
      requireAuth: true,
    });
    if (!tgid) {
      res.status(401).json({ error: error || "Unauthorized" });
      return;
    }
    const token = issueGameToken(tgid, String(req.body?.game ?? ""));
    res.json({ ok: true, token, tgid, expiresInSec: 7200 });
  } catch (err) {
    req.log?.error?.({ err }, "game/session error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/game/balance", async (req, res) => {
  try {
    const { tgid, error } = resolveGameUserId(req, {
      botToken: await botToken(),
      requireAuth: true,
    });
    if (!tgid) {
      res.status(401).json({ error: error || "Unauthorized" });
      return;
    }
    const user = await storage.getBotUser(tgid);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      balance: user.balance,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    req.log.error({ err }, "game/balance error");
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Direct client balance mutation is DISABLED.
 * Wins/losses must go through gameServer.placeBet / server-side settle.
 * Kept as 410 so old clients fail closed with a clear message.
 */
router.post("/game/update-balance", async (req, res) => {
  req.log?.warn?.(
    { ip: req.ip, bodyKeys: Object.keys(req.body ?? {}) },
    "Blocked deprecated /game/update-balance call",
  );
  res.status(410).json({
    error:
      "Endpoint removed. Balance changes are server-authoritative via placeBet / game settlement only.",
  });
});

/**
 * Admin-only manual balance adjustment (audited). Prefer /admin/users/:id/balance.
 */
router.post("/game/admin-adjust-balance", requireAdmin, async (req, res) => {
  try {
    const { tgid, delta, reason } = req.body as {
      tgid: string;
      delta: number;
      reason?: string;
    };
    if (!tgid || delta === undefined) {
      res.status(400).json({ error: "tgid and delta are required" });
      return;
    }
    if (!/^\d{5,15}$/.test(String(tgid))) {
      res.status(400).json({ error: "Invalid tgid" });
      return;
    }
    const deltaNum = Number(delta);
    if (!Number.isFinite(deltaNum) || deltaNum === 0) {
      res.status(400).json({ error: "Invalid delta" });
      return;
    }
    if (Math.abs(deltaNum) > 100_000_000) {
      res.status(400).json({ error: "Delta exceeds admin safety cap" });
      return;
    }

    const actor = (req as any).adminUser || "admin";
    const result = await applyBalanceDelta({
      userId: String(tgid),
      delta: deltaNum,
      type: deltaNum > 0 ? "admin_add" : "admin_deduct",
      externalId: `game-admin-adjust:${tgid}:${Date.now()}:${deltaNum}`,
      method: "admin",
      metadata: { reason: reason ?? null, by: actor },
      clampZero: true,
      rejectIfInsufficient: deltaNum < 0,
    });
    if (!result.ok) {
      res.status(result.reason === "user_not_found" ? 404 : 400).json({ error: result.reason || "failed" });
      return;
    }
    await writeAuditLog({
      actorId: actor,
      action: "game.admin_adjust_balance",
      targetType: "bot_user",
      targetId: String(tgid),
      newValue: { delta: deltaNum, balance: result.newBalance, reason },
      req,
    });
    req.log?.info?.({ tgid, delta: deltaNum, reason: reason ?? null, newBalance: result.newBalance }, "Admin balance adjust");
    res.json({ ok: true, balance: result.newBalance });
  } catch (err) {
    req.log.error({ err }, "game/admin-adjust-balance error");
    res.status(500).json({ error: "Server error" });
  }
});

const VALID_GAMES: GameId[] = ["bau-cua", "xoc-dia", "quay-thu", "dua-xe"];

router.get("/game/state", (req, res) => {
  const game = req.query["game"] as string;
  if (!VALID_GAMES.includes(game as GameId)) {
    res.status(400).json({ error: "invalid game" });
    return;
  }
  res.json(gameSession.getState(game as GameId));
});

export default router;
