import { db } from "@workspace/db";
import { balanceSyncService } from "./balanceSyncService";
import {
  botUsersTable,
  transactionsTable,
  gameSessionsTable,
  giftCodesTable,
  giftCodeUsesTable,
  bettingStatsTable,
  rewardsTable,
  botSettingsTable,
  luckyNumbersTable,
  luckyNumberClaimsTable,
  taixiuSessionsTable,
  cardSubmissionsTable,
  bankTransactionsTable,
  type BotUser,
  type InsertBotUser,
  type Transaction,
  type InsertTransaction,
  type GameSessionRecord,
  type InsertGameSession,
  type GiftCode,
  type BettingStat,
  type Reward,
  type BotSettings,
  type LuckyNumber,
  type LuckyNumberClaim,
  type InsertLuckyNumberClaim,
  type TaixiuSession,
  type CardSubmission,
  type InsertCardSubmission,
} from "@workspace/db";
import { eq, and, desc, sql, ne, gte, inArray } from "drizzle-orm";

// Callback registered by telegramBot to receive milestone notifications from bet settlement
let _milestoneNotifyFn: ((userId: string, milestoneIdx: number, amount: number, gift: string) => Promise<void>) | null = null;
export function setMilestoneNotifyCallback(fn: (userId: string, milestoneIdx: number, amount: number, gift: string) => Promise<void>) {
  _milestoneNotifyFn = fn;
}

export class MonetaryUtils {
  static format(amount: number): string {
    return amount.toLocaleString("vi-VN") + "đ";
  }
  static parse(value: string): number {
    return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
  }
}

class Storage {
  // ─── Bot Users ─────────────────────────────────────────────────────────────

  async getBotUser(userId: string): Promise<BotUser | null> {
    // Try Redis balance cache for fast reads (5-second TTL)
    try {
      const { getCachedUserBalance } = await import("./cache");
      const cached = await getCachedUserBalance(userId);
      if (cached !== null) {
        // Balance is cached — still fetch full user object from DB but skip if not critical
        // For balance-only checks, callers should use getCachedUserBalance directly.
        // Here we always return fresh DB record to ensure correctness for mutations.
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    const [user] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.id, userId))
      .limit(1);

    // Populate balance cache on successful DB read
    if (user) {
      try {
        const { setCachedUserBalance } = await import("./cache");
        await setCachedUserBalance(userId, parseFloat(user.balance));
      } catch {
        // ignore
      }
    }

    return user ?? null;
  }

  async createBotUser(data: InsertBotUser): Promise<BotUser> {
    const [user] = await db
      .insert(botUsersTable)
      .values(data)
      .onConflictDoNothing()
      .returning();
    if (user) return user;
    // Already exists — fetch and return
    const [existing] = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.id, data.id))
      .limit(1);
    return existing!;
  }

  async getUserLanguage(userId: string): Promise<string> {
    const user = await this.getBotUser(userId);
    return user?.language ?? "vi";
  }

  async setUserLanguage(userId: string, lang: string): Promise<void> {
    await this.updateBotUser(userId, { language: lang });
  }

  async updateBotUser(userId: string, data: Partial<BotUser>): Promise<void> {
    await db
      .update(botUsersTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(botUsersTable.id, userId));

    // Push real-time balance update to any connected web SSE clients
    if (data.balance !== undefined) {
      balanceSyncService.push(userId, String(data.balance));

      // Invalidate Redis balance cache on every balance change
      try {
        const { invalidateUserCache } = await import("./cache");
        await invalidateUserCache(userId);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Atomic credit — adds `amount` to user balance in ONE SQL statement.
   * Eliminates read-modify-write race condition for concurrent deposits.
   */
  async atomicCreditBalance(userId: string, amount: number): Promise<{ newBalance: string; ok: boolean }> {
    // Guard: negative/zero/NaN amount would silently debit the user
    if (!Number.isFinite(amount) || amount <= 0) return { newBalance: "0", ok: false };
    const result = await db.execute(sql`
      UPDATE bot_users
      SET balance    = ROUND(CAST(balance AS NUMERIC) + ${amount}, 2)::TEXT,
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING balance
    `);
    if (!result.rows?.length) return { newBalance: "0", ok: false };
    const row = result.rows[0] as { balance: string };
    balanceSyncService.push(userId, row.balance);
    try {
      const { invalidateUserCache } = await import("./cache");
      await invalidateUserCache(userId);
    } catch { /* ignore */ }
    return { newBalance: row.balance, ok: true };
  }

  /**
   * Atomic debit — deducts `amount` only when sufficient balance exists.
   * Returns ok=false with reason if balance insufficient or user not found.
   * Eliminates TOCTOU race condition for concurrent bets.
   */
  async atomicDebitBalance(userId: string, amount: number): Promise<{
    newBalance: string; ok: boolean; reason?: string;
  }> {
    // Guard: negative amount bypasses the balance >= amount check (always true for negatives)
    if (!Number.isFinite(amount) || amount <= 0) return { newBalance: "0", ok: false, reason: "invalid_amount" };
    const result = await db.execute(sql`
      UPDATE bot_users
      SET balance    = ROUND(CAST(balance AS NUMERIC) - ${amount}, 2)::TEXT,
          updated_at = NOW()
      WHERE id = ${userId}
        AND CAST(balance AS NUMERIC) >= ${amount}
      RETURNING balance
    `);
    if (!result.rows?.length) {
      const [user] = await db
        .select({ id: botUsersTable.id })
        .from(botUsersTable)
        .where(eq(botUsersTable.id, userId))
        .limit(1);
      if (!user) return { newBalance: "0", ok: false, reason: "user_not_found" };
      return { newBalance: "0", ok: false, reason: "insufficient_balance" };
    }
    const row = result.rows[0] as { balance: string };
    balanceSyncService.push(userId, row.balance);
    try {
      const { invalidateUserCache } = await import("./cache");
      await invalidateUserCache(userId);
    } catch { /* ignore */ }
    return { newBalance: row.balance, ok: true };
  }

  async getAllBotUsers(): Promise<BotUser[]> {
    return db.select().from(botUsersTable);
  }

  async getTotalBalance(userId: string): Promise<number> {
    const user = await this.getBotUser(userId);
    return parseFloat(user?.balance ?? "0");
  }

  async generateReferralCode(userId: string): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await db
      .select()
      .from(botUsersTable)
      .where(eq(botUsersTable.referralCode, code))
      .limit(1);
    if (existing.length > 0) return this.generateReferralCode(userId);
    await this.updateBotUser(userId, { referralCode: code });
    return code;
  }

  async trackReferral(referrerId: string, newUserId: string): Promise<{ bonus: number }> {
    const referrer = await this.getBotUser(referrerId);
    if (!referrer) return { bonus: 0 };

    // Read referral_bonus from bot_settings (fallback: 10,000đ)
    const bonusStr = await this.getSetting("referral_bonus");
    const bonus = Math.max(0, parseInt(bonusStr || "10000") || 10000);

    const newBalance = (parseFloat(referrer.balance) + bonus).toFixed(2);
    const newEarnings = (parseFloat(referrer.referralEarnings) + bonus).toFixed(2);
    await this.updateBotUser(referrerId, {
      balance: newBalance,
      referralCount: (referrer.referralCount || 0) + 1,
      referralEarnings: newEarnings,
    });
    await this.createTransaction({
      userId: referrerId,
      type: "referral",
      amount: bonus.toString(),
      status: "completed",
      method: "referral",
      metadata: { referredUserId: newUserId },
    });
    return { bonus };
  }

  async getReferralStats(userId: string): Promise<{
    referralCount: number;
    totalEarnings: number;
    nextMilestone: number;
  }> {
    const user = await this.getBotUser(userId);
    const count = user?.referralCount ?? 0;
    const milestones = [5, 10, 20, 50, 100];
    const nextMilestone = milestones.find((m) => m > count) ?? count + 10;
    return {
      referralCount: count,
      totalEarnings: parseFloat(user?.referralEarnings ?? "0"),
      nextMilestone,
    };
  }

  // ─── Transactions ───────────────────────────────────────────────────────────

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactionsTable).values(data).returning();
    return tx!;
  }

  async getTransactionsByUser(userId: string, limit = 50): Promise<Transaction[]> {
    return db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit);
  }

  // ─── Game Sessions ──────────────────────────────────────────────────────────

  async createGameSession(data: InsertGameSession): Promise<GameSessionRecord> {
    const [session] = await db.insert(gameSessionsTable).values(data).returning();
    return session!;
  }

  async updateGameSession(id: number, data: Partial<GameSessionRecord>): Promise<void> {
    await db
      .update(gameSessionsTable)
      .set(data)
      .where(eq(gameSessionsTable.id, id));
  }

  async getGameSessionsByUser(userId: string, limit = 50): Promise<GameSessionRecord[]> {
    return db
      .select()
      .from(gameSessionsTable)
      .where(eq(gameSessionsTable.userId, userId))
      .orderBy(desc(gameSessionsTable.createdAt))
      .limit(limit);
  }

  // ─── Betting Stats ──────────────────────────────────────────────────────────

  async trackBet(userId: string, amount: number): Promise<void> {
    const user = await this.getBotUser(userId);
    if (!user) return;
    const newWagered = (parseFloat(user.totalWagered) + amount).toFixed(2);
    const earnedPoints = Math.floor(parseFloat(newWagered) / 300000);
    const thresholds = [0, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
    let newVipLevel = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (earnedPoints >= thresholds[i]) { newVipLevel = i; break; }
    }
    await this.updateBotUser(userId, { totalWagered: newWagered, vipLevel: String(newVipLevel) });
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  async createOrUpdateBettingStats(
    userId: string,
    date: string,
    weekYear: string,
    amount: number
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(bettingStatsTable)
      .where(
        and(
          eq(bettingStatsTable.userId, userId),
          eq(bettingStatsTable.date, date)
        )
      )
      .limit(1);

    if (existing) {
      const newTotal = (parseFloat(existing.totalBetAmount) + amount).toFixed(2);
      await db
        .update(bettingStatsTable)
        .set({ totalBetAmount: newTotal, weekYear, gameCount: (existing.gameCount || 0) + 1, updatedAt: new Date() })
        .where(eq(bettingStatsTable.id, existing.id));
    } else {
      await db.insert(bettingStatsTable).values({
        userId,
        date,
        weekYear,
        totalBetAmount: amount.toFixed(2),
        gameCount: 1,
      });
    }

    // Cập nhật tiến trình cược khuyến mãi 125% (nếu user đang có wagering requirement chưa đủ)
    await db.execute(sql`
      UPDATE bot_users
      SET wagering_completed = ROUND(
            LEAST(
              CAST(wagering_completed AS NUMERIC) + ${amount},
              CAST(wagering_requirement AS NUMERIC)
            ), 2)::TEXT,
          updated_at = NOW()
      WHERE id = ${userId}
        AND CAST(wagering_requirement AS NUMERIC) > 0
        AND CAST(wagering_completed  AS NUMERIC) < CAST(wagering_requirement AS NUMERIC)
    `).catch(() => {}); // non-critical

    // Fire-and-forget: check Tích Lũy Nạp milestones after bet settlement
    this.checkAndGrantTichLuyNapMilestones(userId).then((newMilestones) => {
      if (newMilestones.length > 0 && _milestoneNotifyFn) {
        for (const m of newMilestones) {
          _milestoneNotifyFn(userId, m.milestoneIdx, m.amount, m.gift).catch(() => {});
        }
      }
    }).catch(() => {});
  }

  async getDailyBettingStats(date: string): Promise<BettingStat[]> {
    return db
      .select()
      .from(bettingStatsTable)
      .where(eq(bettingStatsTable.date, date))
      .orderBy(desc(sql`CAST(${bettingStatsTable.totalBetAmount} AS NUMERIC)`))
      .limit(10);
  }

  async getWeeklyBettingStats(weekYear: string): Promise<BettingStat[]> {
    return db
      .select()
      .from(bettingStatsTable)
      .where(eq(bettingStatsTable.weekYear, weekYear))
      .orderBy(desc(sql`CAST(${bettingStatsTable.totalBetAmount} AS NUMERIC)`))
      .limit(10);
  }

  async getTopBettingUsers(period: "day" | "week", limit: number): Promise<
    Array<{ userId: string; totalBetAmount: string; gameCount: number; user?: BotUser }>
  > {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const weekNum = this.getWeekNumber(today);
    const weekYearStr = `${today.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

    let rows: BettingStat[];
    if (period === "day") {
      rows = await db
        .select()
        .from(bettingStatsTable)
        .where(eq(bettingStatsTable.date, dateStr))
        .orderBy(desc(sql`CAST(${bettingStatsTable.totalBetAmount} AS NUMERIC)`))
        .limit(limit);
    } else {
      rows = await db
        .select()
        .from(bettingStatsTable)
        .where(eq(bettingStatsTable.weekYear, weekYearStr))
        .orderBy(desc(sql`CAST(${bettingStatsTable.totalBetAmount} AS NUMERIC)`))
        .limit(limit);
    }

    const result = [];
    for (const row of rows) {
      const user = await this.getBotUser(row.userId);
      result.push({
        userId: row.userId,
        totalBetAmount: row.totalBetAmount,
        gameCount: row.gameCount ?? 0,
        user: user ?? undefined,
      });
    }
    return result;
  }

  // ─── Gift Codes ─────────────────────────────────────────────────────────────

  async createGiftCode(data: {
    code: string;
    amount: string;
    maxUses: number;
    isActive: boolean;
    createdBy: string | null;
  }): Promise<GiftCode> {
    const [code] = await db.insert(giftCodesTable).values(data).returning();
    return code!;
  }

  async getGiftCode(code: string): Promise<GiftCode | null> {
    const [giftCode] = await db
      .select()
      .from(giftCodesTable)
      .where(eq(giftCodesTable.code, code.toUpperCase()))
      .limit(1);
    return giftCode ?? null;
  }

  async updateGiftCode(id: number, data: Partial<GiftCode>): Promise<void> {
    await db.update(giftCodesTable).set(data).where(eq(giftCodesTable.id, id));
  }

  async useGiftCode(codeId: number, userId: string): Promise<void> {
    // Check if already recorded
    const [existing] = await db
      .select()
      .from(giftCodeUsesTable)
      .where(
        and(eq(giftCodeUsesTable.codeId, codeId), eq(giftCodeUsesTable.userId, userId))
      )
      .limit(1);
    if (!existing) {
      await db.insert(giftCodeUsesTable).values({ codeId, userId });
    }
  }

  async processBonusCode(userId: string, amount: number): Promise<void> {
    const user = await this.getBotUser(userId);
    if (!user) return;
    const newBalance = (parseFloat(user.balance) + amount).toFixed(2);
    await this.updateBotUser(userId, { balance: newBalance });
  }

  async redeemGiftCode(
    userId: string,
    code: string
  ): Promise<{ success: boolean; amount?: number; message?: string }> {
    const [giftCode] = await db
      .select()
      .from(giftCodesTable)
      .where(and(eq(giftCodesTable.code, code.toUpperCase().trim()), eq(giftCodesTable.isActive, true)))
      .limit(1);

    if (!giftCode) return { success: false, message: "Mã code không hợp lệ hoặc đã hết hạn!" };
    if (giftCode.usedCount >= giftCode.maxUses)
      return { success: false, message: "Mã code đã được sử dụng hết!" };

    const [alreadyUsed] = await db
      .select()
      .from(giftCodeUsesTable)
      .where(
        and(
          eq(giftCodeUsesTable.codeId, giftCode.id),
          eq(giftCodeUsesTable.userId, userId)
        )
      )
      .limit(1);

    if (alreadyUsed) return { success: false, message: "Bạn đã sử dụng mã code này rồi!" };

    // Daily limit: each user can only redeem 1 gift code per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [usedToday] = await db
      .select()
      .from(giftCodeUsesTable)
      .where(
        and(
          eq(giftCodeUsesTable.userId, userId),
          sql`used_at >= ${todayStart.toISOString()}`
        )
      )
      .limit(1);
    if (usedToday) return { success: false, message: "Bạn đã nhận gift code hôm nay rồi! Vui lòng quay lại vào ngày mai. 🕐" };

    const amount = parseFloat(giftCode.amount);

    await db.insert(giftCodeUsesTable).values({ codeId: giftCode.id, userId });

    const newUsedCount = giftCode.usedCount + 1;

    if (newUsedCount >= giftCode.maxUses) {
      // Hết lượt → xóa code và toàn bộ lịch sử dùng
      await db.delete(giftCodeUsesTable).where(eq(giftCodeUsesTable.codeId, giftCode.id));
      await db.delete(giftCodesTable).where(eq(giftCodesTable.id, giftCode.id));
    } else {
      await db
        .update(giftCodesTable)
        .set({ usedCount: newUsedCount })
        .where(eq(giftCodesTable.id, giftCode.id));
    }

    const user = await this.getBotUser(userId);
    if (user) {
      const newBalance = (parseFloat(user.balance) + amount).toFixed(2);
      await this.updateBotUser(userId, { balance: newBalance });
    }

    await this.createTransaction({
      userId,
      type: "deposit",
      amount: amount.toString(),
      status: "completed",
      method: "gift_code",
      metadata: { code },
    });

    return { success: true, amount };
  }

  async updateTransactionStatus(txId: number, status: string): Promise<void> {
    await db.update(transactionsTable).set({ status }).where(eq(transactionsTable.id, txId));
  }

  // ─── Rewards ────────────────────────────────────────────────────────────────

  async getDailyReward(userId: string, date: string): Promise<Reward | null> {
    const [reward] = await db
      .select()
      .from(rewardsTable)
      .where(
        and(
          eq(rewardsTable.userId, userId),
          eq(rewardsTable.type, "daily"),
          eq(rewardsTable.date, date)
        )
      )
      .limit(1);
    return reward ?? null;
  }

  async getWeeklyReward(userId: string, weekYear: string): Promise<Reward | null> {
    const [reward] = await db
      .select()
      .from(rewardsTable)
      .where(
        and(
          eq(rewardsTable.userId, userId),
          eq(rewardsTable.type, "weekly"),
          eq(rewardsTable.weekYear, weekYear)
        )
      )
      .limit(1);
    return reward ?? null;
  }

  async claimDailyReward(rewardId: number): Promise<void> {
    await db
      .update(rewardsTable)
      .set({ claimed: true, claimedAt: new Date() })
      .where(eq(rewardsTable.id, rewardId));
  }

  async claimWeeklyReward(rewardId: number): Promise<void> {
    await db
      .update(rewardsTable)
      .set({ claimed: true, claimedAt: new Date() })
      .where(eq(rewardsTable.id, rewardId));
  }

  async distributeWeeklyRewards(
    weekYear: string,
    rewards: Array<{ userId: string; rank: number; amount: number }>
  ): Promise<void> {
    for (const r of rewards) {
      await db.insert(rewardsTable).values({
        userId: r.userId,
        type: "weekly",
        rank: r.rank,
        rewardAmount: r.amount.toString(),
        weekYear,
      });
    }
  }

  async distributeDailyRewards(
    date: string,
    rewards: Array<{ userId: string; rank: number; amount: number }>
  ): Promise<void> {
    for (const r of rewards) {
      await db.insert(rewardsTable).values({
        userId: r.userId,
        type: "daily",
        rank: r.rank,
        rewardAmount: r.amount.toString(),
        date,
      });
    }
  }

  async getUnclaimedRewards(userId: string): Promise<Reward[]> {
    return db
      .select()
      .from(rewardsTable)
      .where(
        and(eq(rewardsTable.userId, userId), eq(rewardsTable.claimed, false))
      )
      .orderBy(desc(rewardsTable.createdAt));
  }

  // ─── processBotReward — add reward balance to user ──────────────────────────
  async processBotReward(userId: string, amount: number, type: string): Promise<void> {
    const user = await this.getBotUser(userId);
    if (!user) return;
    const currentBalance = parseFloat(user.balance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);
    await this.updateBotUser(userId, { balance: newBalance });
  }

  // ─── createWeeklyReward / createDailyReward ──────────────────────────────────
  async createWeeklyReward(data: {
    userId: string;
    weekYear: string;
    rank: number;
    rewardAmount: string;
    totalBetAmount?: string;
  }): Promise<Reward> {
    const [reward] = await db
      .insert(rewardsTable)
      .values({
        userId: data.userId,
        type: "weekly",
        rank: data.rank,
        rewardAmount: data.rewardAmount,
        weekYear: data.weekYear,
      })
      .returning();
    return reward;
  }

  async createDailyReward(data: {
    userId: string;
    date: string;
    rank: number;
    rewardAmount: string;
    totalBetAmount?: string;
  }): Promise<Reward> {
    const [reward] = await db
      .insert(rewardsTable)
      .values({
        userId: data.userId,
        type: "daily",
        rank: data.rank,
        rewardAmount: data.rewardAmount,
        date: data.date,
      })
      .returning();
    return reward;
  }

  // ─── getTopBettorsForWeek / getTopBettorsForDay ──────────────────────────────
  async getTopBettorsForWeek(
    weekYear: string,
    limit: number
  ): Promise<Array<{ userId: string; totalBetAmount: number; rank: number }>> {
    const rows = await db
      .select()
      .from(bettingStatsTable)
      .where(eq(bettingStatsTable.weekYear, weekYear))
      .orderBy(desc(sql`cast(${bettingStatsTable.totalBetAmount} as numeric)`))
      .limit(limit);
    return rows.map((r, i) => ({
      userId: r.userId,
      totalBetAmount: parseFloat(r.totalBetAmount),
      rank: i + 1,
    }));
  }

  async getTopBettorsForDay(
    date: string,
    limit: number
  ): Promise<Array<{ userId: string; totalBetAmount: number; rank: number }>> {
    const rows = await db
      .select()
      .from(bettingStatsTable)
      .where(eq(bettingStatsTable.date, date))
      .orderBy(desc(sql`cast(${bettingStatsTable.totalBetAmount} as numeric)`))
      .limit(limit);
    return rows.map((r, i) => ({
      userId: r.userId,
      totalBetAmount: parseFloat(r.totalBetAmount),
      rank: i + 1,
    }));
  }

  // ─── resetWeeklyBettingStats — delete stats not from current week ────────────
  async resetWeeklyBettingStats(currentWeekYear: string): Promise<void> {
    await db
      .delete(bettingStatsTable)
      .where(ne(bettingStatsTable.weekYear, currentWeekYear));
  }

  // ─── Withdraw Requests (stored as transactions) ──────────────────────────────
  async createWithdrawRequest(data: {
    userId: string;
    amount: string;
    method: string;
    momoPhone?: string;
    bankCode?: string;
    bankAccount?: string;
    accountHolderName?: string;
    fee?: string;
    netAmount?: string;
  }): Promise<{ id: string; status: string }> {
    const id = `WD-${Date.now()}-${data.userId.slice(-4)}`;
    await db.insert(transactionsTable).values({
      userId: data.userId,
      type: "withdrawal",
      amount: data.amount,
      status: "pending",
      method: data.method,
      metadata: {
        withdrawId: id,
        momoPhone: data.momoPhone,
        bankCode: data.bankCode,
        bankAccount: data.bankAccount,
        accountHolderName: data.accountHolderName,
        fee: data.fee,
        netAmount: data.netAmount,
      },
    });
    return { id, status: "pending" };
  }

  async updateWithdrawalStatus(withdrawId: string, status: "completed" | "failed", payosPayoutId?: string): Promise<void> {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.type, "withdrawal"))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(200);
    const row = rows.find((r) => {
      const meta = (r.metadata as Record<string, any>) || {};
      return meta["withdrawId"] === withdrawId;
    });
    if (!row) return;
    const existingMeta = (row.metadata as Record<string, any>) || {};
    await db
      .update(transactionsTable)
      .set({
        status,
        metadata: { ...existingMeta, payosPayoutId: payosPayoutId || null, processedAt: new Date().toISOString() },
      })
      .where(eq(transactionsTable.id, row.id));
  }

  async canUserWithdraw(userId: string): Promise<{ canWithdraw: boolean; reason?: string }> {
    const user = await this.getBotUser(userId);
    if (!user) return { canWithdraw: false, reason: "Không tìm thấy tài khoản!" };
    const balance = parseFloat(user.balance || "0");
    if (balance < 10000) {
      return { canWithdraw: false, reason: "Số dư phải ít nhất 10,000đ để rút tiền!" };
    }
    // Kiểm tra điều kiện cược khuyến mãi 125%
    const wageringReq  = parseFloat(user.wageringRequirement  || "0");
    const wageringDone = parseFloat(user.wageringCompleted    || "0");
    if (wageringReq > 0 && wageringDone < wageringReq) {
      const remaining = Math.ceil(wageringReq - wageringDone);
      return {
        canWithdraw: false,
        reason: `⚠️ Điều kiện khuyến mãi 125%: cần cược thêm <b>${remaining.toLocaleString("vi-VN")}đ</b> nữa mới được rút!\n(Đã cược: ${Math.floor(wageringDone).toLocaleString("vi-VN")}đ / ${Math.floor(wageringReq).toLocaleString("vi-VN")}đ)`,
      };
    }
    return { canWithdraw: true };
  }

  /**
   * Áp dụng khuyến mãi nạp 125%: cộng bonus 25% vào số dư, đặt điều kiện cược.
   * Công thức: wagering = (depositAmount × 2) + (bonusAmount × 4)
   */
  async applyBonus125Deposit(userId: string, depositAmount: number): Promise<{
    ok: boolean; bonusAmount: number; newBalance: string; wageringRequired: number;
  }> {
    const MIN = 10_000;
    const MAX = 1_000_000;
    if (depositAmount < MIN) return { ok: false, bonusAmount: 0, newBalance: "0", wageringRequired: 0 };

    const capped       = Math.min(depositAmount, MAX);
    const bonusAmount  = Math.floor(capped * 0.25);
    const wageringReq  = Math.floor(capped * 2 + bonusAmount * 4);

    // Atomic: cộng bonus + tăng wagering requirement
    const result = await db.execute(sql`
      UPDATE bot_users
      SET balance              = ROUND(CAST(balance AS NUMERIC) + ${bonusAmount}, 2)::TEXT,
          wagering_requirement = ROUND(CAST(wagering_requirement AS NUMERIC) + ${wageringReq}, 2)::TEXT,
          updated_at           = NOW()
      WHERE id = ${userId}
      RETURNING balance
    `);
    if (!result.rows?.length) return { ok: false, bonusAmount: 0, newBalance: "0", wageringRequired: 0 };

    const row = result.rows[0] as { balance: string };
    balanceSyncService.push(userId, row.balance);
    try {
      const { invalidateUserCache } = await import("./cache");
      await invalidateUserCache(userId);
    } catch { /* ignore */ }

    // Ghi nhận transaction bonus
    await this.createTransaction({
      userId,
      type: "bonus",
      amount: bonusAmount.toString(),
      status: "completed",
      method: "deposit_bonus_125",
      metadata: { depositAmount: capped, bonusPercent: 25, wageringRequired: wageringReq, note: "Khuyến mãi nạp 125%" },
    });

    return { ok: true, bonusAmount, newBalance: row.balance, wageringRequired: wageringReq };
  }

  async getWithdrawRequestsByUser(
    userId: string
  ): Promise<Array<{ id: string; amount: string; status: string; method: string; createdAt: Date }>> {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "withdrawal")
        )
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20);
    return rows.map((r) => {
      const meta = (r.metadata as Record<string, any>) || {};
      return {
        id: meta["withdrawId"] || String(r.id),
        amount: r.amount,
        status: r.status,
        method: r.method || "unknown",
        createdAt: r.createdAt,
      };
    });
  }

  // ─── Bank Transactions ───────────────────────────────────────────────────────

  async createBankTransaction(data: {
    refNo: string;
    userId: string | null;
    amount: string;
    description: string | null;
    transactionDate: string | null;
  }) {
    const [tx] = await db
      .insert(bankTransactionsTable)
      .values(data)
      .returning();
    return tx;
  }

  async hasUserClaimedToday(userId: string, date: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(luckyNumberClaimsTable)
      .where(and(eq(luckyNumberClaimsTable.userId, userId), eq(luckyNumberClaimsTable.date, date)))
      .limit(1);
    return rows.length > 0;
  }

  async createLuckyNumberClaim(data: InsertLuckyNumberClaim): Promise<LuckyNumberClaim> {
    const [claim] = await db
      .insert(luckyNumberClaimsTable)
      .values(data)
      .returning();
    return claim;
  }

  // ─── Bot Settings ────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(botSettingsTable)
      .where(eq(botSettingsTable.key, key))
      .limit(1);
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== null) {
      await db
        .update(botSettingsTable)
        .set({ value, updatedAt: new Date() })
        .where(eq(botSettingsTable.key, key));
    } else {
      await db.insert(botSettingsTable).values({ key, value });
    }
  }

  async getAllSettings(): Promise<BotSettings[]> {
    return db.select().from(botSettingsTable);
  }

  // ─── Lucky Numbers ───────────────────────────────────────────────────────────

  async getLuckyNumberByDate(date: string): Promise<LuckyNumber | null> {
    const [row] = await db
      .select()
      .from(luckyNumbersTable)
      .where(eq(luckyNumbersTable.date, date))
      .limit(1);
    return row ?? null;
  }

  async createLuckyNumber(data: { luckyNumber: number; date: string }): Promise<LuckyNumber> {
    const [row] = await db
      .insert(luckyNumbersTable)
      .values(data)
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const [existing] = await db
      .select()
      .from(luckyNumbersTable)
      .where(eq(luckyNumbersTable.date, data.date))
      .limit(1);
    return existing!;
  }

  // ─── Tài Xỉu Sessions (Bot2 history) ───────────────────────────────────────

  async saveTaixiuSession(data: {
    sessionId: number;
    dice1: number;
    dice2: number;
    dice3: number;
    total: number;
    isTai: boolean;
    isEven: boolean;
    md5Original: string;
    md5Hash: string;
    totalWinnings: number;
    totalLosings: number;
  }): Promise<void> {
    await db.insert(taixiuSessionsTable).values({
      sessionId: data.sessionId,
      dice1: data.dice1,
      dice2: data.dice2,
      dice3: data.dice3,
      total: data.total,
      isTai: data.isTai,
      isEven: data.isEven,
      md5Original: data.md5Original,
      md5Hash: data.md5Hash,
      totalWinnings: data.totalWinnings.toString(),
      totalLosings: data.totalLosings.toString(),
    });
  }

  async getTaixiuSessions(limit = 50): Promise<TaixiuSession[]> {
    return db
      .select()
      .from(taixiuSessionsTable)
      .orderBy(desc(taixiuSessionsTable.createdAt))
      .limit(limit);
  }

  async getSpentVipPoints(userId: string): Promise<number> {
    const txns = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "vip_exchange")));
    return txns.reduce((sum, t) => {
      const meta = t.metadata as { pointsSpent?: number } | null;
      return sum + (meta?.pointsSpent ?? 0);
    }, 0);
  }

  async getDepositsSinceDate(userId: string, since: Date): Promise<number> {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "deposit"),
          eq(transactionsTable.status, "completed"),
          gte(transactionsTable.createdAt, since),
          // Chỉ tính nạp thật (ngân hàng / thẻ cào) — không tính gift code
          sql`${transactionsTable.method} NOT IN ('gift_code', 'bonus', 'referral', 'vip_exchange', 'attendance')`
        )
      );
    return rows.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
  }

  async getBetsSinceDate(userId: string, sinceDate: string): Promise<number> {
    const rows = await db
      .select()
      .from(bettingStatsTable)
      .where(
        and(
          eq(bettingStatsTable.userId, userId),
          gte(bettingStatsTable.date, sinceDate)
        )
      );
    return rows.reduce((sum, r) => sum + parseFloat(r.totalBetAmount || "0"), 0);
  }

  async hasUsedGiftCode(userId: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(giftCodeUsesTable)
      .where(eq(giftCodeUsesTable.userId, userId))
      .limit(1);
    return rows.length > 0;
  }

  // ─── Card Submissions ───────────────────────────────────────────────────────

  async createCardSubmission(data: InsertCardSubmission): Promise<CardSubmission> {
    const [row] = await db.insert(cardSubmissionsTable).values(data).returning();
    return row!;
  }

  async getCardSubmissionByRequestId(requestId: string): Promise<CardSubmission | null> {
    const [row] = await db
      .select()
      .from(cardSubmissionsTable)
      .where(eq(cardSubmissionsTable.requestId, requestId))
      .limit(1);
    return row ?? null;
  }

  async updateCardSubmission(requestId: string, data: Partial<CardSubmission>): Promise<void> {
    await db
      .update(cardSubmissionsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cardSubmissionsTable.requestId, requestId));
  }

  async getCardSubmissionsByUser(userId: string, limit = 10): Promise<CardSubmission[]> {
    return db
      .select()
      .from(cardSubmissionsTable)
      .where(eq(cardSubmissionsTable.userId, userId))
      .orderBy(desc(cardSubmissionsTable.createdAt))
      .limit(limit);
  }

  // ─── Tích Lũy Nạp — milestone check & grant ──────────────────────────────
  async checkAndGrantTichLuyNapMilestones(userId: string): Promise<Array<{ milestoneIdx: number; amount: number; gift: string }>> {
    const EVENT_START = new Date("2026-06-01T00:00:01+07:00");
    const EVENT_START_STR = "2026-06-01";
    const now = new Date();
    if (now < EVENT_START) return [];

    const MILESTONES = [
      { nap: 50_000,           cuoc: 1_000_000,         gift: "20K",  amount: 20_000 },
      { nap: 1_000_000,        cuoc: 15_000_000,        gift: "60K",  amount: 60_000 },
      { nap: 5_000_000,        cuoc: 50_000_000,        gift: "170K", amount: 170_000 },
      { nap: 10_000_000,       cuoc: 120_000_000,       gift: "300K", amount: 300_000 },
      { nap: 20_000_000,       cuoc: 200_000_000,       gift: "600K", amount: 600_000 },
      { nap: 50_000_000,       cuoc: 500_000_000,       gift: "1M",   amount: 1_000_000 },
      { nap: 1_000_000_000,    cuoc: 10_000_000_000,    gift: "4M",   amount: 4_000_000 },
      { nap: 2_000_000_000,    cuoc: 20_000_000_000,    gift: "7M",   amount: 7_000_000 },
      { nap: 5_000_000_000,    cuoc: 50_000_000_000,    gift: "10M",  amount: 10_000_000 },
    ];

    let napEvent = 0;
    let cuocEvent = 0;
    try {
      napEvent = await this.getDepositsSinceDate(userId, EVENT_START);
      cuocEvent = await this.getBetsSinceDate(userId, EVENT_START_STR);
    } catch { return []; }

    const newlyGranted: Array<{ milestoneIdx: number; amount: number; gift: string }> = [];

    for (let i = 0; i < MILESTONES.length; i++) {
      const m = MILESTONES[i];
      if (napEvent < m.nap || cuocEvent < m.cuoc) continue;

      const rewardType = `tich_luy_nap_moc_${i + 1}`;
      const existing = await db
        .select({ id: rewardsTable.id })
        .from(rewardsTable)
        .where(and(eq(rewardsTable.userId, userId), eq(rewardsTable.type, rewardType)))
        .limit(1);

      if (existing.length > 0) continue;

      await db.insert(rewardsTable).values({
        userId,
        type: rewardType,
        rank: i + 1,
        rewardAmount: m.amount.toString(),
      });

      newlyGranted.push({ milestoneIdx: i + 1, amount: m.amount, gift: m.gift });
    }

    return newlyGranted;
  }
}

export const storage = new Storage();
