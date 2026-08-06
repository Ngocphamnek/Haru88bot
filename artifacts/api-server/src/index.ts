import { createServer } from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { setupGameWebSocket } from "./lib/gameServer";
import { registerCrashWebSocketClient, removeCrashWebSocketClient } from "./lib/crashGame";
import { resolveGameUserFromToken } from "./lib/security.js";
import { storage } from "./lib/storage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

setupGameWebSocket(wss);

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const gameType = url.searchParams.get("gameType") || "";
  const tgId = url.searchParams.get("tgId") || url.searchParams.get("tgid") || "";
  const token = url.searchParams.get("gameToken") || url.searchParams.get("gtoken") || "";
  const initData = url.searchParams.get("initData") || "";

  if (gameType === "maybay" || gameType === "crash") {
    const botToken = process.env.BOT_TOKEN || "";
    const authed = resolveGameUserFromToken(token, tgId || undefined, initData, botToken);
    if (!authed) {
      ws.close();
      return;
    }
    const user = await storage.getBotUser(authed);
    const name = user?.firstName || user?.username || `Player${authed.slice(-4)}`;
    registerCrashWebSocketClient(authed, ws as any);
    ws.send(JSON.stringify({ type: "user_info", name, tgId: authed, balance: parseFloat(user?.balance ?? "0") }));
    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {}
    });
    ws.on("close", () => removeCrashWebSocketClient(authed));
    return;
  }

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
    } catch {}
  });
});

server.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
