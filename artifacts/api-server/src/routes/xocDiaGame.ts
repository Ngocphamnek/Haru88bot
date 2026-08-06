import { Router, type Request, type Response } from "express";
import { readFileSync } from "fs";
import { join } from "path";
import { storage } from "../lib/storage";
import { gameServer, registerSSEGameClient, removeSSEGameClient } from "../lib/gameServer";
import { resolveGameUserId, issueGameToken } from "../lib/security.js";
import { getSetting } from "../lib/settings.js";
import { validateBetAmount } from "../lib/limits.js";

const router = Router();


async function __gameBotToken(): Promise<string> {
  return (await getSetting("bot_token")) || process.env["BOT_TOKEN"] || "";
}

async function __requireGameTgid(req: import("express").Request, res: import("express").Response): Promise<string | null> {
  const { tgid, error } = resolveGameUserId(req, { botToken: await __gameBotToken(), requireAuth: true });
  if (!tgid) {
    res.status(401).json({ success: false, ok: false, error: error || "Unauthorized", message: error || "Unauthorized" });
    return null;
  }
  return tgid;
}

const GAME_TYPE = "xocdia";
const __htmlCandidates_xoc = [
  join(process.cwd(), "public/games/games/xoc-dia.html"),
  join(process.cwd(), "dist/public/games/games/xoc-dia.html"),
  join(import.meta.dirname ?? __dirname, "../../public/games/games/xoc-dia.html"),
  join(import.meta.dirname ?? __dirname, "../public/games/games/xoc-dia.html"),
];
function __loadHtml_xoc(): string {
  for (const p of __htmlCandidates_xoc) {
    try { return readFileSync(p, "utf-8"); } catch { /* next */ }
  }
  return "<h1>Game asset missing — run build to copy public/</h1>";
}
const XOC_DIA_HTML = __loadHtml_xoc();

function __decorateGameHtml(html: string, lang: string): string {
  const safeLang = lang && lang.length >= 2 ? lang.slice(0, 2) : "vi";
  return html
    .replace('<html lang="vi">', `<html lang="${safeLang}">`)
    .replace('<body>', `<body><script>window.__HARU_LANG__=${JSON.stringify(safeLang)};</script>`);
}

router.get("/games/xoc-dia.html", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const tgid = String(req.query.tgid || "");
  let lang = "vi";
  if (tgid) {
    try {
      lang = await storage.getUserLanguage(tgid);
    } catch {
      lang = "vi";
    }
  }
  res.send(__decorateGameHtml(XOC_DIA_HTML, lang));
});

router.get("/games/xoc-dia", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const tgid = String(req.query.tgid || "");
  let lang = "vi";
  if (tgid) {
    try {
      lang = await storage.getUserLanguage(tgid);
    } catch {
      lang = "vi";
    }
  }
  res.send(__decorateGameHtml(XOC_DIA_HTML, lang));
});

router.get("/games/xoc-dia-stream", async (req: Request, res: Response): Promise<void> => {
  const __authTgid = await __requireGameTgid(req, res);
  if (!__authTgid) return;
  const tgid = __authTgid;
  const tgId = __authTgid;
  if (!tgId) { res.status(400).json({ error: "tgid required" }); return; }

  const user = await storage.getBotUser(tgId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const balance = parseFloat(user.balance);
  const name = user.firstName || user.username || `Player${tgId.slice(-4)}`;

  gameServer.joinRoomSSE(tgId, GAME_TYPE, name, balance);
  registerSSEGameClient(tgId, GAME_TYPE, res);

  res.write(`data: ${JSON.stringify({ type: "init", balance, name })}\n\n`);
  res.write(`data: ${JSON.stringify(gameServer.getSnapshot(GAME_TYPE))}\n\n`);

  const keepalive = setInterval(() => {
    try { res.write(": keepalive\n\n"); } catch { cleanup(); }
  }, 25000);

  function cleanup() {
    clearInterval(keepalive);
    removeSSEGameClient(tgId, GAME_TYPE);
    gameServer.removePlayer(tgId, GAME_TYPE);
  }

  req.on("close", cleanup);
});

router.post("/games/xoc-dia-bet", async (req: Request, res: Response): Promise<void> => {
  const __authTgid = await __requireGameTgid(req, res);
  if (!__authTgid) return;
  const tgid = __authTgid;
  const tgId = __authTgid;
  const { betType, amount } = req.body;
  if (!tgid || !betType || amount == null) {
    res.status(400).json({ success: false, message: "Missing params" });
    return;
  }
  if (!/^\d{5,15}$/.test(String(tgid))) {
    res.status(400).json({ success: false, message: "Invalid tgid" });
    return;
  }
  const amountCheck = validateBetAmount(amount);
  if (!amountCheck.ok) {
    res.status(400).json({ success: false, message: amountCheck.message });
    return;
  }
  const amountNum = amountCheck.amount;
  const result = await gameServer.placeBet(String(tgid), GAME_TYPE, String(betType), amountNum);
  res.json(result);
});

export default router;
