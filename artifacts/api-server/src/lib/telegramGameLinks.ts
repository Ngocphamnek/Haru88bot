import { readFileSync } from "node:fs";
import { join } from "node:path";
import { issueGameToken } from "./security.js";

export function resolvePublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const domains = env.REPLIT_DOMAINS?.split(",").map((d) => d.trim()).filter(Boolean);
  if (domains?.[0]) return `https://${domains[0]}`;
  if (env.REPLIT_DEV_DOMAIN) return `https://${env.REPLIT_DEV_DOMAIN}`;

  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "bot-config.json"), "utf8"));
    if (cfg.publicUrl && typeof cfg.publicUrl === "string" && cfg.publicUrl.startsWith("http")) {
      return cfg.publicUrl.replace(/\/$/, "");
    }
  } catch {
    // ignore
  }

  return "http://localhost:3000";
}

export function buildGameWebAppUrl(gameType: string, userId: string | number, env: NodeJS.ProcessEnv = process.env): string {
  const base = resolvePublicBaseUrl(env).replace(/\/$/, "");
  const gameToken = issueGameToken(String(userId));
  const tgid = String(userId);
  const routeMap: Record<string, string> = {
    xocdia: "/api/xoc-dia/games/xoc-dia",
    xoc: "/api/xoc-dia/games/xoc-dia",
    xocxoc: "/api/xoc-dia/games/xoc-dia",
    quaythu: "/api/quay-thu/games/quay-thu",
    quaythuong: "/api/quay-thu/games/quay-thu",
    baucua: "/api/bau-cua/games/bau-cua",
    maybay: "/api/crash/games/may-bay",
    crash: "/api/crash/games/may-bay",
    rongho: "/api/xoc-dia/games/xoc-dia",
    sicbo: "/api/xoc-dia/games/xoc-dia",
    xucxac: "/api/xoc-dia/games/xoc-dia",
  };
  const route = routeMap[gameType.toLowerCase()] || "/api/xoc-dia/games/xoc-dia";
  return `${base}${route}?tgid=${encodeURIComponent(tgid)}&gtoken=${encodeURIComponent(gameToken)}`;
}
