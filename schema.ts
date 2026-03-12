import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, boolean, real, integer, serial, bigint, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type PlanType = "free" | "pro" | "premium" | "enterprise" | "admin";

export interface UserSettings {
  currency: string;
  notifications: boolean;
  biometricAuth: boolean;
  theme: string;
}

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(), // scrypt hash — never plaintext
  plan: text("plan").$type<PlanType>().notNull().default("free"),
  avatar: text("avatar"),
  refreshToken: text("refresh_token"),
  connectedExchanges: json("connected_exchanges").$type<string[]>(),
  settings: json("settings").$type<UserSettings>(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  // ── 2FA / TOTP ──────────────────────────────────────────
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpSecret: text("totp_secret"),    // active verified TOTP secret
  totpPending: text("totp_pending"),  // temp secret during setup (unverified)
  emailVerified: boolean("email_verified").notNull().default(false),
  userLevel: text("user_level").$type<"beginner" | "intermediate" | "advanced">().notNull().default("beginner"),
  // ── Risk Mode (Guardião / Predador / Vault) — Sprint Imediato ───────────
  riskMode: text("risk_mode").$type<"guardian" | "predator" | "vault">().notNull().default("guardian"),
  // ── HiveMind opt-in anonymous signal sharing — Sprint 11 ──────────────
  hiveMindOptIn: boolean("hive_mind_opt_in").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  plan: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ────────────────────────────────────────────────────────────
// Session — active authenticated sessions per user
// ────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string;
  /** Hashed refresh token — for server-side revocation */
  refreshTokenHash: string;
  ip: string;
  userAgent: string;
  deviceLabel: string; // e.g. "Chrome on Windows", "Expo Go (iOS)"
  createdAt: string;
  lastUsedAt: string;
}

// ────────────────────────────────────────────────────────────
// ApiKey — encrypted exchange credentials per user
// ────────────────────────────────────────────────────────────

export type ApiKeyPermission = "read" | "trade" | "withdraw";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  exchange: string;          // "binance" | "bybit" | ...
  label: string;             // user-friendly label
  encryptedKey: string;      // AES-256-GCM hex
  encryptedSecret: string;   // AES-256-GCM hex
  permissions: ApiKeyPermission[];
  createdAt: string;
}

// ────────────────────────────────────────────────────────────
// Sessions — active authenticated sessions per user (Drizzle table)
// ────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  ip: text("ip").notNull().default(""),
  userAgent: text("user_agent").notNull().default(""),
  deviceLabel: text("device_label").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`now()`),
  lastUsedAt: text("last_used_at").notNull().default(sql`now()`),
}, (t) => ({
  userIdIdx: index("sessions_user_id_idx").on(t.userId),
}));

// ────────────────────────────────────────────────────────────
// ApiKeys — encrypted exchange credentials per user (Drizzle table)
// ────────────────────────────────────────────────────────────

export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  exchange: text("exchange").notNull(),
  label: text("label").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  permissions: json("permissions").$type<ApiKeyPermission[]>().notNull().default([]),
  createdAt: text("created_at").notNull().default(sql`now()`),
}, (t) => ({
  userIdIdx: index("api_keys_user_id_idx").on(t.userId),
}));

// ────────────────────────────────────────────────────────────
// BotRecord — persisted trading bot configuration
// ────────────────────────────────────────────────────────────

export interface BotRecord {
  id: string;           // UUID — same as botId in BotConfig
  userId: string;
  name: string;
  symbol: string;
  exchange: string;
  interval: string;     // "1h" | "15m" etc.
  apiKeyId: string;
  sizeUSDT: number;
  maxOpenPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  paperMode: boolean;
  enabled: boolean;
  strategyName: string;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// TradeRecord — closed trade log (paper or live)
// ────────────────────────────────────────────────────────────

export type TradeDirection = "long" | "short";
export type TradeOutcome = "win" | "loss" | "breakeven";

export interface TradeRecord {
  id: string;
  userId: string;
  botId?: string;           // which bot triggered this trade (optional for manual)
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  sizeUSDT: number;
  pnl: number;              // realised PnL in USDT
  pnlPercent: number;       // % return on trade
  outcome: TradeOutcome;
  closeReason: "take-profit" | "stop-loss" | "manual" | "signal";
  openedAt: string;
  closedAt: string;
}

// ────────────────────────────────────────────────────────────
// Drizzle table definitions for PostgreSQL persistence
// Run `npm run db:push` with DATABASE_URL set to migrate.
// ────────────────────────────────────────────────────────────

export const bots = pgTable(
  "bots",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    exchange: text("exchange").notNull(),
    interval: text("interval").notNull(),
    apiKeyId: text("api_key_id").notNull(),
    sizeUSDT: real("size_usdt").notNull(),
    maxOpenPositions: integer("max_open_positions").notNull().default(1),
    stopLossPercent: real("stop_loss_percent").notNull(),
    takeProfitPercent: real("take_profit_percent").notNull(),
    paperMode: boolean("paper_mode").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    strategyName: text("strategy_name").notNull(),
    createdAt: text("created_at").notNull().default(sql`now()`),
    updatedAt: text("updated_at").notNull().default(sql`now()`),
  },
  (t) => ({
    // Fast lookup of all bots for a user (list page, scheduler)
    userIdIdx: index("bots_user_id_idx").on(t.userId),
    // Fast lookup of enabled bots for scheduling
    userIdEnabledIdx: index("bots_user_id_enabled_idx").on(t.userId, t.enabled),
  }),
);

export const trades = pgTable(
  "trades",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    botId: varchar("bot_id"),
    symbol: text("symbol").notNull(),
    direction: text("direction").$type<TradeDirection>().notNull(),
    entryPrice: real("entry_price").notNull(),
    exitPrice: real("exit_price").notNull(),
    sizeUSDT: real("size_usdt").notNull(),
    pnl: real("pnl").notNull(),
    pnlPercent: real("pnl_percent").notNull(),
    outcome: text("outcome").$type<TradeOutcome>().notNull(),
    closeReason: text("close_reason").$type<"take-profit" | "stop-loss" | "manual" | "signal">().notNull(),
    openedAt: text("opened_at").notNull(),
    closedAt: text("closed_at").notNull(),
  },
  (t) => ({
    // Most common query: all trades for a user, newest first
    userIdClosedAtIdx: index("trades_user_id_closed_at_idx").on(t.userId, t.closedAt),
    // Join with bots — frequent in analytics queries
    botIdIdx: index("trades_bot_id_idx").on(t.botId),
    // Filter by symbol across users (market analytics)
    symbolIdx: index("trades_symbol_idx").on(t.symbol),
  }),
);

// ────────────────────────────────────────────────────────────
// UserStreaks — one row per userId (win/loss streak tracking)
// ────────────────────────────────────────────────────────────

export const userStreaks = pgTable("user_streaks", {
  userId: varchar("user_id").primaryKey(),
  winStreak: integer("win_streak").notNull().default(0),
  lossStreak: integer("loss_streak").notNull().default(0),
  /** Positive = win streak length, negative = loss streak length */
  streak: integer("streak").notNull().default(0),
  /** ISO-8601 string — set by application on every upsert */
  updatedAt: text("updated_at").notNull().default("1970-01-01T00:00:00.000Z"),
});

// ────────────────────────────────────────────────────────────
// SecurityIncidents — Module 15 Defense Grid
// ────────────────────────────────────────────────────────────

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentType =
  | "bruteforce"
  | "rate_anomaly"
  | "honeypot"
  | "geo_anomaly"
  | "behavioral"
  | "sql_injection"
  | "path_traversal"
  | "ip_blocked"
  | "other";
export type IncidentAction = "blocked" | "logged" | "alerted";

export interface SecurityIncident {
  id: number;
  timestamp: string;
  severity: IncidentSeverity;
  type: IncidentType;
  sourceIp?: string;
  userId?: number;
  endpoint?: string;
  description: string;
  action: IncidentAction;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: number;
  /** AI GAP-10: market regime at the time of the incident (from regimeDetector) */
  marketRegime?: string;
}

export const securityIncidents = pgTable("security_incidents", {
  id: serial("id").primaryKey(),
  timestamp: text("timestamp").notNull().default(sql`now()`),
  severity: text("severity").$type<IncidentSeverity>().notNull(),
  type: text("type").$type<IncidentType>().notNull(),
  sourceIp: text("source_ip"),
  userId: integer("user_id"),
  endpoint: text("endpoint"),
  description: text("description").notNull(),
  action: text("action").$type<IncidentAction>().notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: text("resolved_at"),
  resolvedBy: integer("resolved_by"),
});

// ────────────────────────────────────────────────────────────
// Market Candles — Module 16 Data Ingestion Layer
// Stores normalized OHLCV candles from all exchanges/intervals.
// Indexed for fast time-range and symbol queries.
// ────────────────────────────────────────────────────────────

export const marketCandles = pgTable(
  "market_candles",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),            // e.g. "BTC"
    exchange: text("exchange").notNull(),          // e.g. "binance"
    interval: text("interval").notNull(),          // e.g. "1h"
    /** Open time as unix ms — stored as bigint to preserve full precision */
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull(),
    trades: integer("trades"),                    // number of trades in interval (optional)
    source: text("source").notNull().default("binance"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    symbolExchangeIntervalTs: index("mc_symbol_exchange_interval_ts_idx").on(
      t.symbol, t.exchange, t.interval, t.timestamp,
    ),
    symbolTs: index("mc_symbol_ts_idx").on(t.symbol, t.timestamp),
  }),
);

export type MarketCandle = typeof marketCandles.$inferSelect;
export type InsertMarketCandle = typeof marketCandles.$inferInsert;

// ────────────────────────────────────────────────────────────
// Funding Rates — perpetual futures funding rates per exchange
// ────────────────────────────────────────────────────────────

export const fundingRates = pgTable(
  "funding_rates",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    exchange: text("exchange").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    rate: doublePrecision("rate").notNull(),       // e.g. 0.0001 = 0.01%
    nextFundingTime: bigint("next_funding_time", { mode: "number" }),  // unix ms
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    symbolExchangeTs: index("fr_symbol_exchange_ts_idx").on(
      t.symbol, t.exchange, t.timestamp,
    ),
  }),
);

export type FundingRate = typeof fundingRates.$inferSelect;
export type InsertFundingRate = typeof fundingRates.$inferInsert;

// ────────────────────────────────────────────────────────────
// Open Interest — perpetual futures open interest per exchange
// ────────────────────────────────────────────────────────────

export const openInterest = pgTable(
  "open_interest",
  {
    id: serial("id").primaryKey(),
    symbol: text("symbol").notNull(),
    exchange: text("exchange").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    value: doublePrecision("value").notNull(),     // in contracts
    valueUsd: doublePrecision("value_usd").notNull(), // notional USD
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    symbolExchangeTs: index("oi_symbol_exchange_ts_idx").on(
      t.symbol, t.exchange, t.timestamp,
    ),
  }),
);

export type OpenInterestRecord = typeof openInterest.$inferSelect;
export type InsertOpenInterest = typeof openInterest.$inferInsert;

// ────────────────────────────────────────────────────────────
// Brain Weights — adaptive per-brain performance weights (I-03)
// ────────────────────────────────────────────────────────────

export const brainWeights = pgTable(
  "brain_weights",
  {
    brainId: text("brain_id").primaryKey(),
    weight: doublePrecision("weight").notNull().default(1.0),
    correctCount: integer("correct_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    accuracy: doublePrecision("accuracy").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`now()`),
  },
);

export type BrainWeightRecord = typeof brainWeights.$inferSelect;
export type InsertBrainWeightRecord = typeof brainWeights.$inferInsert;

// ────────────────────────────────────────────────────────────
// Hormone States — per-user endocrine state persistence (I-03)
// ────────────────────────────────────────────────────────────

export const hormoneStates = pgTable(
  "hormone_states",
  {
    userId: text("user_id").primaryKey(),
    /** JSON-serialised HormoneState object */
    state: json("state").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`now()`),
  },
);

export type HormoneStateRecord = typeof hormoneStates.$inferSelect;
export type InsertHormoneStateRecord = typeof hormoneStates.$inferInsert;

// ────────────────────────────────────────────────────────────
// Alert Rules — price/technical alert engine backend (I-07)
// ────────────────────────────────────────────────────────────

export const alertRules = pgTable(
  "alert_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),      // "price_above" | "price_below" | "score_above" | "score_below"
    symbol: text("symbol").notNull(),
    threshold: doublePrecision("threshold").notNull(),
    /** Optional Telegram chat ID for webhook delivery */
    telegramChatId: text("telegram_chat_id"),
    enabled: boolean("enabled").notNull().default(true),
    /** Last time this alert fired (ISO string) */
    lastFiredAt: text("last_fired_at"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index("ar_user_id_idx").on(t.userId),
  }),
);

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;
export type InsertPerformanceSnapshot = typeof performanceSnapshots.$inferInsert;

// ────────────────────────────────────────────────────────────
// User IPs — IP tracking for security & fraud detection (LXIII)
// ────────────────────────────────────────────────────────────

export const userIps = pgTable(
  "user_ips",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    ipAddress: text("ip_address").notNull(),
    firstSeen: text("first_seen").notNull().default(sql`now()`),
    lastSeen: text("last_seen").notNull().default(sql`now()`),
    requestCount: integer("request_count").notNull().default(1),
    country: text("country"),
    flagged: boolean("flagged").notNull().default(false),
  },
  (t) => ({
    userIdIdx: index("uips_user_id_idx").on(t.userId),
    ipIdx: index("uips_ip_idx").on(t.ipAddress),
    userIpUnique: uniqueIndex("uips_user_ip_unique_idx").on(t.userId, t.ipAddress),
  }),
);

export type UserIpRecord = typeof userIps.$inferSelect;
export type InsertUserIpRecord = typeof userIps.$inferInsert;

// ────────────────────────────────────────────────────────────
// User Modules — add-on module subscriptions (LXIII)
// ────────────────────────────────────────────────────────────

export const userModules = pgTable(
  "user_modules",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    moduleId: text("module_id").notNull(),
    /** Stripe subscription ID for monthly billing */
    stripeSubscriptionId: text("stripe_subscription_id"),
    active: boolean("active").notNull().default(true),
    subscribedAt: text("subscribed_at").notNull().default(sql`now()`),
    expiresAt: text("expires_at"),
  },
  (t) => ({
    userIdIdx: index("umod_user_id_idx").on(t.userId),
    moduleIdx: index("umod_module_id_idx").on(t.moduleId),
    userModuleUniq: uniqueIndex("umod_user_module_idx").on(t.userId, t.moduleId),
  }),
);

export type UserModuleRecord = typeof userModules.$inferSelect;
export type InsertUserModuleRecord = typeof userModules.$inferInsert;

// ────────────────────────────────────────────────────────────
// Performance Fee Config — Enterprise tier fee rules (LXIII)
// ────────────────────────────────────────────────────────────

export const performanceFeeConfig = pgTable(
  "performance_fee_config",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().unique(),
    /** Capital threshold in BRL above which performance fee applies */
    thresholdBrl: doublePrecision("threshold_brl").notNull().default(1000000),
    /** Fee percentage as a decimal (0.07 = 7%) applied on monthly profit */
    feePercentage: doublePrecision("fee_percentage").notNull().default(0.0007),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
);

export type PerformanceFeeConfigRecord = typeof performanceFeeConfig.$inferSelect;

// ────────────────────────────────────────────────────────────
// Performance Fee Invoices — monthly fee records (LXIII)
// ────────────────────────────────────────────────────────────

export const performanceFeeInvoices = pgTable(
  "performance_fee_invoices",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    netProfitBrl: doublePrecision("net_profit_brl").notNull(),
    feeAmountBrl: doublePrecision("fee_amount_brl").notNull(),
    /** "pending" | "invoiced" | "paid" | "waived" */
    status: text("status").notNull().default("pending"),
    stripeInvoiceId: text("stripe_invoice_id"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index("pfee_user_id_idx").on(t.userId),
  }),
);

export type PerformanceFeeInvoice = typeof performanceFeeInvoices.$inferSelect;

// ────────────────────────────────────────────────────────────
// Telegram Config — User bot notifications (T003)
// ────────────────────────────────────────────────────────────

export const telegramConfigs = pgTable("telegram_configs", {
  userId: varchar("user_id").primaryKey(),
  botTokenEncrypted: text("bot_token_encrypted"),
  chatId: varchar("chat_id"),
  enabled: boolean("enabled").notNull().default(false),
  alertTypes: json("alert_types").$type<string[]>().notNull().default(["signal", "trade", "circuit_breaker", "liquidation"]),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export type TelegramConfig = typeof telegramConfigs.$inferSelect;
export type InsertTelegramConfig = typeof telegramConfigs.$inferInsert;

// ─── Sprint LXVIII: Device Fingerprints ──────────────────────────────────────

export const userFingerprints = pgTable(
  "user_fingerprints",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    fingerprintHash: text("fingerprint_hash").notNull(),
    firstSeen: text("first_seen").notNull().default(sql`now()`),
    lastSeen: text("last_seen").notNull().default(sql`now()`),
    trusted: boolean("trusted").notNull().default(false),
  },
  (t) => ({
    userFpUniqueIdx: index("user_fp_unique_idx").on(t.userId, t.fingerprintHash),
    userFpUserIdx: index("user_fp_user_id_idx").on(t.userId),
  }),
);

export type UserFingerprintRecord = typeof userFingerprints.$inferSelect;

// ─── Sprint LXIX: Enterprise Team Members ────────────────────────────────────

/**
 * Stores enterprise sub-account invitations and memberships.
 * An enterprise user can invite other users (by email) to their team.
 * Once the invited user registers/logs in, member_id is populated.
 */
export const enterpriseTeamMembers = pgTable(
  "enterprise_team_members",
  {
    id: serial("id").primaryKey(),
    /** The enterprise account that owns this team */
    enterpriseId: text("enterprise_id").notNull(),
    /** Email of the invited member */
    memberEmail: text("member_email").notNull(),
    /** User ID once the invited member has accepted / registered */
    memberId: text("member_id"),
    /** Invitation token (UUID) sent by email */
    inviteToken: text("invite_token").notNull(),
    /** pending | active | removed */
    status: text("status").notNull().default("pending"),
    invitedAt: text("invited_at").notNull().default(sql`now()`),
    joinedAt: text("joined_at"),
  },
  (t) => ({
    enterpriseIdx: index("etm_enterprise_id_idx").on(t.enterpriseId),
    emailIdx: index("etm_member_email_idx").on(t.memberEmail),
    tokenIdx: index("etm_invite_token_idx").on(t.inviteToken),
  }),
);

export type EnterpriseTeamMember = typeof enterpriseTeamMembers.$inferSelect;
export type InsertEnterpriseTeamMember = typeof enterpriseTeamMembers.$inferInsert;

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    tokenIdx: index("prt_token_idx").on(t.token),
    userIdx: index("prt_user_id_idx").on(t.userId),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ─── Email Verification Tokens ────────────────────────────────────────────────

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    used: boolean("used").notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    tokenIdx: index("evt_token_idx").on(t.token),
    userIdx: index("evt_user_id_idx").on(t.userId),
  }),
);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

// ─── DecisionDNA — Perfil de trading personalizado por usuário ────────────────

export type DnaProfileType = "conservative" | "moderate" | "aggressive" | "kamikaze";
export type PositionSizingMethod = "fixed" | "kelly" | "percent_equity";

export const decisionDna = pgTable("decision_dna", {
  userId: varchar("user_id").primaryKey(),
  profileType: text("profile_type").$type<DnaProfileType>().notNull().default("moderate"),
  maxLeverage: integer("max_leverage").notNull().default(3),
  positionSizingMethod: text("position_sizing_method").$type<PositionSizingMethod>().notNull().default("percent_equity"),
  riskPerTradePct: real("risk_per_trade_pct").notNull().default(2.0),
  maxDailyLossPct: real("max_daily_loss_pct").notNull().default(5.0),
  preferredStrategies: json("preferred_strategies").$type<string[]>().default([]),
  autoEvolve: boolean("auto_evolve").notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`now()`),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export type DecisionDna = typeof decisionDna.$inferSelect;
export type InsertDecisionDna = typeof decisionDna.$inferInsert;

// ─── Profit Skim Config — configuração de dízimo por usuário ─────────────────

export const profitSkimConfig = pgTable("profit_skim_config", {
  userId: varchar("user_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  skimPct: real("skim_pct").notNull().default(20.0),
  vaultBalanceUsdt: real("vault_balance_usdt").notNull().default(0.0),
  totalSkimmedUsdt: real("total_skimmed_usdt").notNull().default(0.0),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

export type ProfitSkimConfig = typeof profitSkimConfig.$inferSelect;
export type InsertProfitSkimConfig = typeof profitSkimConfig.$inferInsert;

// ─── Profit Skim Ledger — registro imutável de cada skim ─────────────────────

export const profitSkimLedger = pgTable(
  "profit_skim_ledger",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    tradeId: varchar("trade_id"),
    profitUsdt: real("profit_usdt").notNull(),
    skimmedUsdt: real("skimmed_usdt").notNull(),
    vaultBalanceAfter: real("vault_balance_after").notNull(),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index("psl_user_id_idx").on(t.userId),
  }),
);

export type ProfitSkimLedger = typeof profitSkimLedger.$inferSelect;
export type InsertProfitSkimLedger = typeof profitSkimLedger.$inferInsert;

// ─── Telegram Configs — configuração de alertas Telegram por usuário ──────────



// ─── Audit Logs — trail imutável de todas as ações críticas ──────────────────

export type AuditAction =
  | "TRADE_OPEN" | "TRADE_CLOSE" | "TRADE_STOP_LOSS" | "TRADE_TAKE_PROFIT"
  | "DNA_CREATED" | "DNA_UPDATED"
  | "CIRCUIT_BREAKER_TRIPPED" | "CIRCUIT_BREAKER_RESET"
  | "BOT_STARTED" | "BOT_STOPPED"
  | "API_KEY_ADDED" | "API_KEY_DELETED"
  | "PLAN_CHANGED"
  | "PROFIT_SKIMMED" | "VAULT_WITHDRAWAL"
  | "TELEGRAM_CONFIGURED"
  | "LEVERAGE_BLOCKED"
  | "ANALOG_FORECAST_GENERATED"
  | "SHADOW_STRATEGY_PROMOTED";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id"),
    action: text("action").$type<AuditAction>().notNull(),
    entity: varchar("entity"),
    entityId: varchar("entity_id"),
    payload: json("payload"),
    ipAddress: varchar("ip_address"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index("al_user_id_idx").on(t.userId),
    actionIdx: index("al_action_idx").on(t.action),
    createdAtIdx: index("al_created_at_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;

// ─── Performance Snapshots — métricas diárias de performance ─────────────────

export const performanceSnapshots = pgTable(
  "performance_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    snapshotDate: text("snapshot_date").notNull(),
    equityUsdt: real("equity_usdt").notNull().default(0),
    dailyPnlUsdt: real("daily_pnl_usdt").notNull().default(0),
    dailyPnlPct: real("daily_pnl_pct").notNull().default(0),
    peakEquity: real("peak_equity").notNull().default(0),
    drawdownPct: real("drawdown_pct").notNull().default(0),
    winRate: real("win_rate").notNull().default(0),
    totalTrades: integer("total_trades").notNull().default(0),
    sharpeRatio: real("sharpe_ratio").notNull().default(0),
    sortinoRatio: real("sortino_ratio").notNull().default(0),
    profitFactor: real("profit_factor").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userDateIdx: uniqueIndex("ps_user_date_idx").on(t.userId, t.snapshotDate),
    userIdx: index("ps_user_id_idx").on(t.userId),
  }),
);


// ─── Historical Analogs — vetores de padrões históricos (LSH) ────────────────

export const historicalAnalogs = pgTable(
  "historical_analogs",
  {
    id: serial("id").primaryKey(),
    symbol: varchar("symbol").notNull(),
    timestampMs: bigint("timestamp_ms", { mode: "number" }).notNull(),
    features: json("features").notNull(), // float[8]: rsi, adx, atr_pct, vol_ratio, ema_slope, bb_pos, macd_hist, trend
    outcome24h: real("outcome_24h"),
    outcome72h: real("outcome_72h"),
    regime: varchar("regime"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    symbolIdx: index("ha_symbol_idx").on(t.symbol),
    symbolTsIdx: index("ha_symbol_ts_idx").on(t.symbol, t.timestampMs),
  }),
);

export type HistoricalAnalog = typeof historicalAnalogs.$inferSelect;

// ─── Shadow Strategies — estratégias em teste sem capital real ────────────────

export type ShadowStrategyStatus = "testing" | "promoted" | "rejected";

export const shadowStrategies = pgTable(
  "shadow_strategies",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    name: varchar("name").notNull(),
    config: json("config").notNull(),
    status: text("status").$type<ShadowStrategyStatus>().notNull().default("testing"),
    paperPnl: real("paper_pnl").notNull().default(0.0),
    paperTrades: integer("paper_trades").notNull().default(0),
    paperWinRate: real("paper_win_rate").notNull().default(0.0),
    sharpeRatio: real("sharpe_ratio").notNull().default(0.0),
    testStartedAt: text("test_started_at").notNull().default(sql`now()`),
    testEndsAt: text("test_ends_at"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userIdx: index("ss_user_id_idx").on(t.userId),
    statusIdx: index("ss_status_idx").on(t.status),
  }),
);

export type ShadowStrategy = typeof shadowStrategies.$inferSelect;
export type InsertShadowStrategy = typeof shadowStrategies.$inferInsert;

// ────────────────────────────────────────────────────────────
// PriceAlerts — user-defined price alert lines on the chart
// ────────────────────────────────────────────────────────────
export const priceAlerts = pgTable(
  "price_alerts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    symbol: text("symbol").notNull(),
    price: doublePrecision("price").notNull(),
    direction: text("direction").$type<"above" | "below">().notNull().default("above"),
    label: text("label"),
    triggered: boolean("triggered").notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userSymbolIdx: index("pa_user_symbol_idx").on(t.userId, t.symbol),
  }),
);

// ────────────────────────────────────────────────────────────
// ChartAnnotations — user notes pinned to specific candles
// ────────────────────────────────────────────────────────────
export const chartAnnotations = pgTable(
  "chart_annotations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    symbol: text("symbol").notNull(),
    candleTime: text("candle_time").notNull(),
    text: text("text").notNull(),
    color: text("color").notNull().default("#f59e0b"),
    createdAt: text("created_at").notNull().default(sql`now()`),
  },
  (t) => ({
    userSymbolIdx: index("ca_user_symbol_idx").on(t.userId, t.symbol),
  }),
);

