import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botUsersTable = pgTable("bot_users", {
  id: text("id").primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  balance: text("balance").notNull().default("0"),
  totalWagered: text("total_wagered").notNull().default("0"),
  totalGames: integer("total_games").notNull().default(0),
  vipLevel: text("vip_level"),
  commission: text("commission").notNull().default("0"),
  referralCode: text("referral_code"),
  referredBy: text("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  referralEarnings: text("referral_earnings").notNull().default("0"),
  wageringRequirement: text("wagering_requirement").notNull().default("0"),
  wageringCompleted: text("wagering_completed").notNull().default("0"),
  vaultBalance: text("vault_balance").notNull().default("0"),
  vaultPin: text("vault_pin"),
  language: text("language").notNull().default("vi"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBotUserSchema = createInsertSchema(botUsersTable).omit({ createdAt: true, updatedAt: true });
export type InsertBotUser = z.infer<typeof insertBotUserSchema>;
export type BotUser = typeof botUsersTable.$inferSelect;

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("pending"),
  method: text("method"),
  externalId: text("external_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("transactions_user_idx").on(t.userId),
  index("transactions_type_idx").on(t.type),
  // Partial unique: only enforce uniqueness when external_id is present
  uniqueIndex("transactions_external_id_uidx").on(t.externalId),
]);

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  gameType: text("game_type").notNull(),
  betAmount: text("bet_amount").notNull(),
  betType: text("bet_type"),
  result: jsonb("result"),
  won: boolean("won"),
  winAmount: text("win_amount"),
  status: text("status").notNull().default("active"),
  metadata: jsonb("metadata"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameSessionSchema = createInsertSchema(gameSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSessionRecord = typeof gameSessionsTable.$inferSelect;

export const giftCodesTable = pgTable("gift_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  amount: text("amount").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GiftCode = typeof giftCodesTable.$inferSelect;

export const giftCodeUsesTable = pgTable("gift_code_uses", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull(),
  userId: text("user_id").notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
});

export const bettingStatsTable = pgTable("betting_stats", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  weekYear: text("week_year").notNull(),
  totalBetAmount: text("total_bet_amount").notNull().default("0"),
  gameCount: integer("game_count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BettingStat = typeof bettingStatsTable.$inferSelect;

export const rewardsTable = pgTable("rewards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  rank: integer("rank"),
  rewardAmount: text("reward_amount").notNull(),
  date: text("date"),
  weekYear: text("week_year"),
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Reward = typeof rewardsTable.$inferSelect;

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotSettings = typeof botSettingsTable.$inferSelect;

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  refNo: text("ref_no").notNull().unique(),
  userId: text("user_id"),
  amount: text("amount").notNull(),
  description: text("description"),
  transactionDate: text("transaction_date"),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BankTransaction = typeof bankTransactionsTable.$inferSelect;

export const luckyNumbersTable = pgTable("lucky_numbers", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  luckyNumber: integer("lucky_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LuckyNumber = typeof luckyNumbersTable.$inferSelect;

export const luckyNumberClaimsTable = pgTable("lucky_number_claims", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  luckyNumber: integer("lucky_number").notNull(),
  rewardAmount: text("reward_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LuckyNumberClaim = typeof luckyNumberClaimsTable.$inferSelect;
export type InsertLuckyNumberClaim = typeof luckyNumberClaimsTable.$inferInsert;

export const taixiuSessionsTable = pgTable("taixiu_sessions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  dice1: integer("dice1").notNull(),
  dice2: integer("dice2").notNull(),
  dice3: integer("dice3").notNull(),
  total: integer("total").notNull(),
  isTai: boolean("is_tai").notNull(),
  isEven: boolean("is_even").notNull(),
  md5Original: text("md5_original").notNull(),
  md5Hash: text("md5_hash").notNull(),
  totalWinnings: text("total_winnings").notNull().default("0"),
  totalLosings: text("total_losings").notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TaixiuSession = typeof taixiuSessionsTable.$inferSelect;

export const cardSubmissionsTable = pgTable("card_submissions", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  userId: text("user_id").notNull(),
  telco: text("telco").notNull(),
  code: text("code").notNull(),
  serial: text("serial").notNull(),
  declaredAmount: integer("declared_amount").notNull(),
  status: integer("status").notNull().default(99),
  realAmount: integer("real_amount"),
  receivedAmount: integer("received_amount"),
  tsrTransId: text("tsr_trans_id"),
  message: text("message"),
  credited: boolean("credited").notNull().default(false),
  chatId: text("chat_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CardSubmission = typeof cardSubmissionsTable.$inferSelect;
export type InsertCardSubmission = typeof cardSubmissionsTable.$inferInsert;

export const supportRequestsTable = pgTable("support_requests", {
  userId: text("user_id").primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  content: text("content").notNull(),
  status: text("status").notNull().default("pending"),
  isConnected: boolean("is_connected").notNull().default(false),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
});

export type SupportRequest = typeof supportRequestsTable.$inferSelect;

export const webUsersTable = pgTable("web_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  telegramId: text("telegram_id").unique(),
  telegramUsername: text("telegram_username"),
  isVerified: boolean("is_verified").notNull().default(true),
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WebUser = typeof webUsersTable.$inferSelect;
export type InsertWebUser = typeof webUsersTable.$inferInsert;

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull().default("register"),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpCode = typeof otpCodesTable.$inferSelect;

export const telegramLinkCodesTable = pgTable("telegram_link_codes", {
  id: serial("id").primaryKey(),
  webUserId: integer("web_user_id").notNull(),
  code: text("code").notNull().unique(),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  verifyCode: text("verify_code"),
  pendingTelegramId: text("pending_telegram_id"),
  pendingPhone: text("pending_phone"),
});

export type TelegramLinkCode = typeof telegramLinkCodesTable.$inferSelect;

export const webSessionsTable = pgTable("web_sessions", {
  id: text("id").primaryKey(),
  webUserId: integer("web_user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WebSession = typeof webSessionsTable.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════════════
   ENTERPRISE TABLES — added per architecture spec
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── wallets ─────────────────────────────────────────────────────────────── */
export const walletsTable = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  mainBalance: text("main_balance").notNull().default("0"),
  bonusBalance: text("bonus_balance").notNull().default("0"),
  commissionBalance: text("commission_balance").notNull().default("0"),
  vipBalance: text("vip_balance").notNull().default("0"),
  lockedBalance: text("locked_balance").notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("wallets_user_id_idx").on(t.userId)]);

export const insertWalletSchema = createInsertSchema(walletsTable).omit({ id: true, updatedAt: true });
export type Wallet = typeof walletsTable.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

/* ── deposits ────────────────────────────────────────────────────────────── */
export const depositsTable = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: text("amount").notNull(),
  method: text("method").notNull().default("bank"),
  status: text("status").notNull().default("pending"),
  externalId: text("external_id"),
  proofUrl: text("proof_url"),
  note: text("note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("deposits_user_id_idx").on(t.userId), index("deposits_status_idx").on(t.status)]);

export const insertDepositSchema = createInsertSchema(depositsTable).omit({ id: true, createdAt: true });
export type Deposit = typeof depositsTable.$inferSelect;
export type InsertDeposit = z.infer<typeof insertDepositSchema>;

/* ── withdrawals ─────────────────────────────────────────────────────────── */
export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: text("amount").notNull(),
  bankName: text("bank_name"),
  bankNumber: text("bank_number"),
  bankOwner: text("bank_owner"),
  status: text("status").notNull().default("pending"),
  note: text("note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("withdrawals_user_id_idx").on(t.userId), index("withdrawals_status_idx").on(t.status)]);

export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({ id: true, createdAt: true });
export type Withdrawal = typeof withdrawalsTable.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

/* ── referrals ───────────────────────────────────────────────────────────── */
export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").notNull(),
  referredId: integer("referred_id").notNull(),
  level: integer("level").notNull().default(1),
  commission: text("commission").notNull().default("0"),
  totalCommissionEarned: text("total_commission_earned").notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("referrals_referrer_idx").on(t.referrerId),
  uniqueIndex("referrals_referred_unique_idx").on(t.referredId),
]);

export type Referral = typeof referralsTable.$inferSelect;

/* ── notifications ───────────────────────────────────────────────────────── */
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_id_idx").on(t.userId), index("notifications_is_read_idx").on(t.isRead)]);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

/* ── announcements ───────────────────────────────────────────────────────── */
export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("info"),
  isActive: boolean("is_active").notNull().default(true),
  isPinned: boolean("is_pinned").notNull().default(false),
  imageUrl: text("image_url"),
  targetAudience: text("target_audience").notNull().default("all"),
  publishedAt: timestamp("published_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Announcement = typeof announcementsTable.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

/* ── promotions ──────────────────────────────────────────────────────────── */
export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  code: text("code").unique(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  bonusType: text("bonus_type").notNull().default("fixed"),
  bonusValue: text("bonus_value").notNull().default("0"),
  minDeposit: text("min_deposit").notNull().default("0"),
  maxBonus: text("max_bonus"),
  wageringMultiplier: integer("wagering_multiplier").notNull().default(1),
  maxClaims: integer("max_claims"),
  totalClaimed: integer("total_claimed").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  imageUrl: text("image_url"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

/* ── promotion_claims ────────────────────────────────────────────────────── */
export const promotionClaimsTable = pgTable("promotion_claims", {
  id: serial("id").primaryKey(),
  promotionId: integer("promotion_id").notNull(),
  userId: integer("user_id").notNull(),
  bonusAmount: text("bonus_amount").notNull(),
  status: text("status").notNull().default("active"),
  wageringRequired: text("wagering_required").notNull().default("0"),
  wageringCompleted: text("wagering_completed").notNull().default("0"),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  expiredAt: timestamp("expired_at"),
}, (t) => [
  index("promo_claims_user_idx").on(t.userId),
  index("promo_claims_promo_idx").on(t.promotionId),
]);

export type PromotionClaim = typeof promotionClaimsTable.$inferSelect;

/* ── vip_levels ──────────────────────────────────────────────────────────── */
export const vipLevelsTable = pgTable("vip_levels", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull().unique(),
  name: text("name").notNull(),
  minWagered: text("min_wagered").notNull().default("0"),
  cashbackRate: text("cashback_rate").notNull().default("0"),
  withdrawLimit: text("withdraw_limit").notNull().default("0"),
  withdrawSpeed: text("withdraw_speed").notNull().default("normal"),
  bonusMultiplier: text("bonus_multiplier").notNull().default("1"),
  badgeColor: text("badge_color").notNull().default("#888888"),
  benefits: jsonb("benefits"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertVipLevelSchema = createInsertSchema(vipLevelsTable).omit({ id: true });
export type VipLevel = typeof vipLevelsTable.$inferSelect;
export type InsertVipLevel = z.infer<typeof insertVipLevelSchema>;

/* ── vip_histories ───────────────────────────────────────────────────────── */
export const vipHistoriesTable = pgTable("vip_histories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fromLevel: integer("from_level").notNull().default(0),
  toLevel: integer("to_level").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("vip_histories_user_idx").on(t.userId)]);

export type VipHistory = typeof vipHistoriesTable.$inferSelect;

/* ── jackpots ────────────────────────────────────────────────────────────── */
export const jackpotsTable = pgTable("jackpots", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull(),
  amount: text("amount").notNull().default("0"),
  seedAmount: text("seed_amount").notNull().default("0"),
  incrementRate: text("increment_rate").notNull().default("0.01"),
  lastWinnerId: integer("last_winner_id"),
  lastWonAmount: text("last_won_amount"),
  lastWonAt: timestamp("last_won_at"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("jackpots_game_type_idx").on(t.gameType)]);

export const insertJackpotSchema = createInsertSchema(jackpotsTable).omit({ id: true, updatedAt: true });
export type Jackpot = typeof jackpotsTable.$inferSelect;
export type InsertJackpot = z.infer<typeof insertJackpotSchema>;

/* ── daily_rewards ───────────────────────────────────────────────────────── */
export const dailyRewardsTable = pgTable("daily_rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  day: integer("day").notNull().default(1),
  rewardType: text("reward_type").notNull().default("balance"),
  rewardAmount: text("reward_amount").notNull(),
  claimed: boolean("claimed").notNull().default(true),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
}, (t) => [
  index("daily_rewards_user_idx").on(t.userId),
  uniqueIndex("daily_rewards_user_date_idx").on(t.userId, t.date),
]);

export const insertDailyRewardSchema = createInsertSchema(dailyRewardsTable).omit({ id: true, claimedAt: true });
export type DailyReward = typeof dailyRewardsTable.$inferSelect;
export type InsertDailyReward = z.infer<typeof insertDailyRewardSchema>;

/* ── login_histories ─────────────────────────────────────────────────────── */
export const loginHistoriesTable = pgTable("login_histories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceId: text("device_id"),
  country: text("country"),
  city: text("city"),
  success: boolean("success").notNull().default(true),
  failReason: text("fail_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("login_histories_user_idx").on(t.userId), index("login_histories_ip_idx").on(t.ipAddress)]);

export const insertLoginHistorySchema = createInsertSchema(loginHistoriesTable).omit({ id: true, createdAt: true });
export type LoginHistory = typeof loginHistoriesTable.$inferSelect;
export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;

/* ── devices ─────────────────────────────────────────────────────────────── */
export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fingerprint: text("fingerprint").notNull(),
  browser: text("browser"),
  os: text("os"),
  screen: text("screen"),
  timezone: text("timezone"),
  canvasHash: text("canvas_hash"),
  isTrusted: boolean("is_trusted").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("devices_user_idx").on(t.userId),
  index("devices_fingerprint_idx").on(t.fingerprint),
]);

export type Device = typeof devicesTable.$inferSelect;

/* ── bank_accounts ───────────────────────────────────────────────────────── */
export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code"),
  accountNumber: text("account_number").notNull(),
  accountOwner: text("account_owner").notNull(),
  branch: text("branch"),
  isDefault: boolean("is_default").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("bank_accounts_user_idx").on(t.userId)]);

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, createdAt: true });
export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

/* ── user_settings ───────────────────────────────────────────────────────── */
export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  musicEnabled: boolean("music_enabled").notNull().default(true),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  telegramNotify: boolean("telegram_notify").notNull().default(true),
  language: text("language").notNull().default("vi"),
  theme: text("theme").notNull().default("dark"),
  showBalance: boolean("show_balance").notNull().default(true),
  betConfirmation: boolean("bet_confirmation").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("user_settings_user_idx").on(t.userId)]);

export const insertUserSettingSchema = createInsertSchema(userSettingsTable).omit({ id: true, updatedAt: true });
export type UserSetting = typeof userSettingsTable.$inferSelect;
export type InsertUserSetting = z.infer<typeof insertUserSettingSchema>;

/* ── support_tickets ─────────────────────────────────────────────────────── */
export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("support_tickets_user_idx").on(t.userId),
  index("support_tickets_status_idx").on(t.status),
  index("support_tickets_assigned_idx").on(t.assignedTo),
]);

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

/* ── support_messages ────────────────────────────────────────────────────── */
export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  senderId: integer("sender_id"),
  senderRole: text("sender_role").notNull().default("user"),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("support_messages_ticket_idx").on(t.ticketId)]);

export const insertSupportMessageSchema = createInsertSchema(supportMessagesTable).omit({ id: true, createdAt: true });
export type SupportMessage = typeof supportMessagesTable.$inferSelect;
export type InsertSupportMessage = z.infer<typeof insertSupportMessageSchema>;

/* ── audit_logs ──────────────────────────────────────────────────────────── */
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id"),
  actorRole: text("actor_role").notNull().default("admin"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_logs_actor_idx").on(t.actorId),
  index("audit_logs_action_idx").on(t.action),
  index("audit_logs_created_idx").on(t.createdAt),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

/* ── ip_blacklist ────────────────────────────────────────────────────────── */
export const ipBlacklistTable = pgTable("ip_blacklist", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),           // "ip" | "phone" | "bank_account" | "telegram_id" | "user_id"
  value: text("value").notNull(),
  reason: text("reason"),
  bannedBy: text("banned_by"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ip_blacklist_type_idx").on(t.type),
  uniqueIndex("ip_blacklist_type_value_idx").on(t.type, t.value),
]);

export type IpBlacklist = typeof ipBlacklistTable.$inferSelect;
