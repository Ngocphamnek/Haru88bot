import { getSettings, saveSettings } from './settings.js';
import { broadcastTransaction } from './notifier.js';
import { CoreBankService } from './core-bank.js';
import { db } from '@workspace/db';
import { bankTransactionsTable, botUsersTable, transactionsTable } from '@workspace/db';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../lib/logger.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawTx {
  refNo?: string;
  transactionDate?: string;
  creditAmount: number;
  debitAmount: number;
  description?: string;
  accountNo?: string;
  postDate?: string;
  beneficiaryName?: string;
}

// ─── Transaction Monitor ─────────────────────────────────────────────────────

export class TransactionMonitor {
  private timer: NodeJS.Timeout | null = null;
  private seenTxIds = new Set<string>();
  private readonly MAX_SEEN_IDS = 2000;
  private coreBankService: CoreBankService;

  constructor(coreBankService: CoreBankService) {
    this.coreBankService = coreBankService;
    const settings = getSettings();
    if (settings.monitor.running) {
      this.start();
    }
  }

  public start() {
    if (this.timer) return;
    logger.info('🚀 CoreBank Transaction Monitor started');
    // Auto-persist running=true
    const s = getSettings();
    if (!s.monitor.running) {
      s.monitor.running = true;
      saveSettings(s);
    }
    this.tick();
  }

  public stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info('🛑 CoreBank Transaction Monitor stopped');
  }

  public isRunning(): boolean {
    return this.timer !== null;
  }

  private async tick() {
    try {
      const settings = getSettings();
      if (!settings.monitor.running) {
        this.stop();
        return;
      }
      await this.checkTransactions();
    } catch (error: any) {
      logger.error({ err: error.message }, 'Monitor tick error');
    } finally {
      const settings = getSettings();
      if (settings.monitor.running) {
        const interval = Math.max(10, settings.monitor.intervalSeconds) * 1000;
        this.timer = setTimeout(() => this.tick(), interval);
      }
    }
  }

  private async checkTransactions() {
    let session = this.coreBankService.getSession();
    if (!session?.sessionId) {
      if (!this.coreBankService.hasCredentials()) return;
      logger.info('🔄 Monitor: session expired, re-authenticating...');
      const ok = await this.coreBankService.reAuthenticate();
      if (!ok) {
        logger.warn('⚠️ Monitor: re-auth failed, will retry next tick');
        return;
      }
      session = this.coreBankService.getSession();
      if (!session?.sessionId) return;
      logger.info('✅ Monitor: re-authenticated');
    }

    const balanceSummary = await this.coreBankService.getBalance();
    const accounts = balanceSummary?.accounts || [];
    if (!accounts.length) return;

    const mainAccount = accounts[0]!.number;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${pad(yesterday.getDate())}/${pad(yesterday.getMonth() + 1)}/${yesterday.getFullYear()}`;

    const txList = await this.coreBankService.getTransactions(mainAccount, yesterdayStr, todayStr);
    const chronologicalTx = [...txList].reverse();

    for (const tx of chronologicalTx) {
      const txId = tx.refNo || `${tx.transactionDate}-${tx.creditAmount}-${tx.debitAmount}`;

      if (this.seenTxIds.has(txId)) continue;

      if (this.seenTxIds.size >= this.MAX_SEEN_IDS) {
        const entries = [...this.seenTxIds];
        entries.slice(0, this.MAX_SEEN_IDS / 2).forEach(id => this.seenTxIds.delete(id));
      }
      this.seenTxIds.add(txId);

      if (tx.creditAmount > 0) {
        // Try to process as a Haru88 deposit directly (no third-party)
        const handled = await this.processDepositDirect({ ...tx, accountNo: mainAccount });
        if (handled) continue;
      }

      // Broadcast to Telegram/Discord/Webhook notifications (non-deposit or unmatched)
      await broadcastTransaction({ ...tx, accountNo: mainAccount });
    }
  }

  /**
   * Directly credit the Haru88 user from a detected bank transaction.
   * Returns true if the tx was a recognized Haru88 deposit (matched or logged).
   * Returns false if it's unrelated to Haru88 (let normal broadcast handle it).
   */
  private async processDepositDirect(tx: RawTx): Promise<boolean> {
    const refNo = tx.refNo || `${tx.transactionDate}_${tx.creditAmount}_${(tx.description || '').slice(0, 20)}`;
    const creditAmount = Number(tx.creditAmount);
    const description = tx.description || '';

    // ── Dedup: skip if already fully processed ───────────────────────────────
    try {
      const [existing] = await db
        .select({ processed: bankTransactionsTable.processed })
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.refNo, refNo))
        .limit(1);
      if (existing?.processed) return true;
    } catch {
      // DB unavailable — fall through
    }

    // ── Match HARU88 code in description ────────────────────────────────────
    const haruMatch = description.match(/HARU88([A-Z0-9]{6})/i);
    const haruCode = haruMatch ? `HARU88${haruMatch[1]!.toUpperCase()}` : null;

    // Also handle legacy "nap [userId]" / bare Telegram ID patterns
    const napMatch = !haruCode ? description.match(/(?:nap|naptien|naphe|deposit)\s*(\d{5,12})/i) : null;
    const numMatch = !haruCode && !napMatch ? description.match(/\b(\d{7,12})\b/) : null;

    const isHaru88Tx = !!haruCode || !!napMatch || !!numMatch;

    if (!isHaru88Tx) {
      // Not a Haru88 deposit — let caller broadcast it normally
      return false;
    }

    // ── Log unprocessed bank transaction ─────────────────────────────────────
    try {
      await db.insert(bankTransactionsTable).values({
        refNo,
        userId: null,
        amount: String(creditAmount),
        description,
        transactionDate: tx.transactionDate || new Date().toISOString(),
        processed: false,
      }).onConflictDoNothing();
    } catch {
      // ignore duplicate insert error
    }

    // ── Find user ID ──────────────────────────────────────────────────────────
    let userId: string | null = null;

    if (haruCode) {
      // Look up pending transaction in DB by HARU88 code
      try {
        const [pendingRow] = await db
          .select({ userId: transactionsTable.userId, amount: transactionsTable.amount })
          .from(transactionsTable)
          .where(
            and(
              eq(transactionsTable.status, 'pending'),
              eq(transactionsTable.method, 'bank'),
              sql`${transactionsTable.metadata}->>'paymentCode' = ${haruCode}`
            )
          )
          .limit(1);
        if (pendingRow) {
          userId = pendingRow.userId;
          logger.info({ haruCode, userId, creditAmount }, '🎯 Matched HARU88 code → user in DB');

          // Mark the original pending transaction as completed
          await db
            .update(transactionsTable)
            .set({ status: 'completed', externalId: refNo } as any)
            .where(
              and(
                eq(transactionsTable.status, 'pending'),
                eq(transactionsTable.method, 'bank'),
                sql`${transactionsTable.metadata}->>'paymentCode' = ${haruCode}`
              )
            );
        }
      } catch (err: any) {
        logger.warn({ err: err.message, haruCode }, 'DB lookup for HARU88 code failed');
      }
    }

    // Legacy: userId from "nap XXXXX" or bare digit ID
    if (!userId && napMatch) userId = napMatch[1]!;
    if (!userId && numMatch) userId = numMatch[1]!;

    if (!userId) {
      logger.warn({ refNo, description }, '⚠️ Haru88 deposit with no matching user — manual review needed');
      return true; // still "handled" — don't double-broadcast
    }

    // ── Verify user exists ────────────────────────────────────────────────────
    let userRow: { balance: string } | null = null;
    try {
      const [u] = await db
        .select({ balance: botUsersTable.balance })
        .from(botUsersTable)
        .where(eq(botUsersTable.id, userId))
        .limit(1);
      userRow = u ?? null;
    } catch (err: any) {
      logger.warn({ err: err.message, userId }, 'DB user lookup failed');
    }

    if (!userRow) {
      logger.warn({ refNo, userId }, '⚠️ Deposit user not found in DB — skipped');
      return true;
    }

    // ── Credit balance ────────────────────────────────────────────────────────
    const currentBalance = parseFloat(userRow.balance || '0');
    const newBalance = (currentBalance + creditAmount).toFixed(2);

    try {
      await db
        .update(botUsersTable)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(botUsersTable.id, userId));
    } catch (err: any) {
      logger.error({ err: err.message, userId, creditAmount }, '❌ Failed to credit user balance');
      return true;
    }

    // ── Record deposit transaction ────────────────────────────────────────────
    try {
      await db.insert(transactionsTable).values({
        userId,
        type: 'deposit',
        amount: String(creditAmount),
        status: 'completed',
        method: 'bank',
        externalId: refNo,
        metadata: {
          refNo,
          description,
          transactionDate: tx.transactionDate,
          beneficiaryName: tx.beneficiaryName,
          accountNo: tx.accountNo,
          source: 'corebank-monitor',
        },
      });
    } catch (err: any) {
      logger.warn({ err: err.message, refNo }, 'Failed to insert deposit transaction record');
    }

    // ── Mark bank transaction as processed ────────────────────────────────────
    try {
      await db
        .update(bankTransactionsTable)
        .set({ processed: true, processedAt: new Date(), userId })
        .where(eq(bankTransactionsTable.refNo, refNo));
    } catch {
      // non-critical
    }

    logger.info({ refNo, userId, creditAmount, newBalance }, '✅ Deposit credited directly to user');

    // ── Notify user via Telegram bot ─────────────────────────────────────────
    try {
      const { telegramBotService } = await import('../telegram/telegramBot.js');
      await telegramBotService.notifyPaymentSuccess(userId, creditAmount, refNo);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Telegram deposit notification failed (non-fatal)');
    }

    // ── Check Tích Lũy Nạp milestones ────────────────────────────────────────
    try {
      const { storage } = await import('../lib/storage.js');
      const newMilestones = await storage.checkAndGrantTichLuyNapMilestones(userId);
      if (newMilestones.length > 0) {
        const { telegramBotService } = await import('../telegram/telegramBot.js');
        for (const m of newMilestones) {
          await telegramBotService.notifyTichLuyNapMilestone(userId, m.milestoneIdx, m.amount, m.gift);
        }
      }
    } catch {
      // non-critical
    }

    return true;
  }
}
