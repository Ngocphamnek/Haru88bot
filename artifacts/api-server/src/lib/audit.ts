/**
 * Best-effort audit log writer for admin / money actions.
 */
import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";
import { logger } from "./logger.js";

export async function writeAuditLog(input: {
  actorId?: string | null;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  req?: Request;
}): Promise<void> {
  try {
    const ip =
      (input.req?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      input.req?.ip ||
      null;
    const ua = (input.req?.headers["user-agent"] as string) || null;
    await db.insert(auditLogsTable).values({
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? "admin",
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      oldValue: (input.oldValue as any) ?? null,
      newValue: (input.newValue as any) ?? null,
      ipAddress: ip,
      userAgent: ua,
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, "audit log write failed");
  }
}
