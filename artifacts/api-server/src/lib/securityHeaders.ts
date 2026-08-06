import type { Request, Response, NextFunction } from "express";

/**
 * Baseline security headers (helmet-lite, no extra dependency).
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  // API-oriented CSP — allow nothing by default for JSON; HTML game pages may override
  if (!_req.path.includes("/games/") && !_req.path.endsWith(".html")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  }
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}
