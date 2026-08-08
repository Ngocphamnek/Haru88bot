import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { collectIssueReport } from "../lib/issueReport.js";
import { issueGameToken } from "../lib/security.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/diag", (_req, res) => {
  const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "") || null;
  const botTokenConfigured = Boolean(process.env.BOT_TOKEN || process.env.BOT_TOKEN_FILE);
  const gameTokenSecretConfigured = Boolean(process.env.GAME_TOKEN_SECRET);
  const dbUrlConfigured = Boolean(
    process.env.DATABASE_URL ||
    process.env.RENDER_INTERNAL_DATABASE_URL ||
    process.env.RENDER_EXTERNAL_DATABASE_URL,
  );
  const sampleToken = issueGameToken("123456", "xoc-dia");
  const issues = collectIssueReport();
  res.json({
    ok: true,
    publicUrl,
    botTokenConfigured,
    gameTokenSecretConfigured,
    dbUrlConfigured,
    sampleGameToken: sampleToken,
    issues,
    routes: {
      xocDia: "/api/xoc-dia/games/xoc-dia",
      bauCua: "/api/bau-cua/games/bau-cua",
      quayThu: "/api/quay-thu/games/quay-thu",
      crash: "/api/crash/games/may-bay",
    },
  });
});

export default router;
