/**
 * balanceSyncService — real-time balance push via SSE.
 *
 * The server keeps a registry:  telegramId → Set<Response>
 *
 * When balance changes (bot game, deposit, web game), call:
 *   balanceSyncService.push(telegramId, newBalance)
 *
 * Web clients subscribe by connecting to GET /api/web/wallet/sse
 * (implemented in webWallet.ts), which calls registerClient() and
 * de-registers on close.
 */

import type { Response } from "express";
import { logger } from "./logger";

class BalanceSyncService {
  private clients = new Map<string, Set<Response>>();

  /** Register a new SSE client for a given telegramId (or webUserId fallback). */
  register(userId: string, res: Response): () => void {
    if (!this.clients.has(userId)) this.clients.set(userId, new Set());
    this.clients.get(userId)!.add(res);

    logger.debug({ userId, total: this.clients.get(userId)!.size }, "SSE balance client registered");

    // Return cleanup function
    return () => {
      this.clients.get(userId)?.delete(res);
      if (this.clients.get(userId)?.size === 0) this.clients.delete(userId);
      logger.debug({ userId }, "SSE balance client disconnected");
    };
  }

  /** Push a balance_update event to all SSE connections for this user. */
  push(userId: string, newBalance: string): void {
    const set = this.clients.get(userId);
    if (!set || set.size === 0) return;

    const payload = JSON.stringify({ balance: newBalance, ts: Date.now() });
    const dead: Response[] = [];

    for (const res of set) {
      try {
        res.write(`event: balance_update\ndata: ${payload}\n\n`);
      } catch {
        dead.push(res);
      }
    }
    // Clean up dead connections
    for (const res of dead) set.delete(res);
    if (set.size === 0) this.clients.delete(userId);
  }

  get connectionCount(): number {
    let n = 0;
    for (const s of this.clients.values()) n += s.size;
    return n;
  }
}

export const balanceSyncService = new BalanceSyncService();
