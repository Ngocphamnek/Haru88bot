/**
 * Pending Deposit Watcher
 * Stores deposit requests from the bot, monitors for matching bank transactions,
 * and fires callbacks on match or expiry.
 */

interface PendingDeposit {
  code: string;
  amount: number;
  callbackUrl: string;
  secret?: string;
  createdAt: number;
  timer: NodeJS.Timeout;
}

class PendingDepositService {
  private pending = new Map<string, PendingDeposit>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  register(code: string, amount: number, callbackUrl: string, secret?: string): void {
    // Cancel existing timer if same code re-registered
    const existing = this.pending.get(code);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => { this.expire(code).catch(console.error); }, this.TTL_MS);

    this.pending.set(code, { code, amount, callbackUrl, secret, createdAt: Date.now(), timer });
    console.log(`📋 Pending deposit registered: ${code} = ${amount.toLocaleString('vi-VN')}đ (expires in 5m)`);
  }

  /**
   * Try to match a bank transaction against all pending deposits.
   * Checks if the registered code appears anywhere in the transaction description (case-insensitive).
   * Amount tolerance: ±1 VND.
   */
  match(description: string, creditAmount: number): PendingDeposit | null {
    if (!description) return null;

    const descUpper = description.toUpperCase();

    for (const dep of this.pending.values()) {
      const codeUpper = dep.code.toUpperCase();

      // Code must appear in description
      if (!descUpper.includes(codeUpper)) continue;

      // Amount must match within ±1 VND
      if (Math.abs(creditAmount - dep.amount) <= 1) {
        return dep;
      }

      console.warn(`⚠️  Amount mismatch for ${dep.code}: expected ${dep.amount}, got ${creditAmount}`);
    }

    return null;
  }

  /**
   * Consume a pending deposit (remove from watch list, cancel timer).
   * Called after a successful match.
   */
  consume(code: string): void {
    const dep = this.pending.get(code);
    if (dep) {
      clearTimeout(dep.timer);
      this.pending.delete(code);
      console.log(`✅ Pending deposit consumed: ${code}`);
    }
  }

  get size(): number { return this.pending.size; }

  list(): Array<{ code: string; amount: number; ageSeconds: number }> {
    return [...this.pending.values()].map(d => ({
      code: d.code,
      amount: d.amount,
      ageSeconds: Math.floor((Date.now() - d.createdAt) / 1000),
    }));
  }

  private async expire(code: string): Promise<void> {
    const dep = this.pending.get(code);
    if (!dep) return;

    this.pending.delete(code);
    console.log(`⏰ Pending deposit expired: ${code} (${dep.amount.toLocaleString('vi-VN')}đ)`);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (dep.secret) headers['X-Webhook-Secret'] = dep.secret;

      const resp = await fetch(dep.callbackUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: 'expired', code, amount: dep.amount }),
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) {
        console.error(`❌ Expiry callback HTTP ${resp.status} for ${code}`);
      } else {
        console.log(`📤 Expiry callback sent for ${code}`);
      }
    } catch (err: any) {
      console.error(`❌ Expiry callback failed for ${code}: ${err.message}`);
    }
  }
}

export const pendingDepositService = new PendingDepositService();
