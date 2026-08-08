export interface IssueReportItem {
  severity: "high" | "medium" | "low";
  area: string;
  message: string;
}

export function collectIssueReport(): IssueReportItem[] {
  const issues: IssueReportItem[] = [];

  if (!process.env.DATABASE_URL && !process.env.RENDER_INTERNAL_DATABASE_URL && !process.env.RENDER_EXTERNAL_DATABASE_URL) {
    issues.push({
      severity: "high",
      area: "database",
      message: "DATABASE_URL is not configured, so DB-backed game/user flows will fail.",
    });
  }

  if (!process.env.BOT_TOKEN && !process.env.BOT_TOKEN_FILE) {
    issues.push({ severity: "medium", area: "telegram", message: "BOT_TOKEN is not configured, so the Telegram bot will not initialize." });
  }

  if (!process.env.GAME_TOKEN_SECRET) {
    issues.push({ severity: "medium", area: "auth", message: "GAME_TOKEN_SECRET is auto-generated at startup and will change on restart, breaking existing game links." });
  }

  if (!process.env.PUBLIC_URL && !process.env.RENDER_EXTERNAL_URL && !process.env.REPLIT_DOMAINS && !process.env.REPLIT_DEV_DOMAIN) {
    issues.push({ severity: "medium", area: "telegram", message: "No public URL is configured, so Telegram web app links will fall back to localhost." });
  }

  return issues;
}
