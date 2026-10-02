// Вход владельца через Telegram-бота (план owner-login-telegram). В БД — только SHA-256 токенов
// сессии, вызова и привязки; сырые значения живут в cookie браузера и в ссылке на бота.
import { sql } from "drizzle-orm";
import { bigint, check, customType, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const at = (name: string) => timestamp(name, { withTimezone: true });

export const ownerSessions = pgTable(
  "owner_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: bytea("token_hash").notNull().unique(),
    telegramId: bigint("telegram_id", { mode: "bigint" }).notNull(),
    displayName: text("display_name"),
    createdAt: at("created_at").notNull().defaultNow(),
    expiresAt: at("expires_at").notNull(),
    revokedAt: at("revoked_at"),
  },
  (t) => [index("owner_sessions_expires_at_idx").on(t.expiresAt)],
);

export const LOGIN_STATUSES = ["pending", "confirmed", "rejected", "consumed", "cancelled"] as const;
export type LoginStatus = (typeof LOGIN_STATUSES)[number];

export const ownerLoginChallenges = pgTable(
  "owner_login_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengeHash: bytea("challenge_hash").notNull().unique(),
    bindingHash: bytea("binding_hash").notNull().unique(),
    // Код «для глаз» — не секрет: виден на экране входа и в сообщении бота.
    code: text("code").notNull(),
    status: text("status", { enum: LOGIN_STATUSES }).notNull().default("pending"),
    ipHash: bytea("ip_hash").notNull(),
    telegramId: bigint("telegram_id", { mode: "bigint" }),
    displayName: text("display_name"),
    createdAt: at("created_at").notNull().defaultNow(),
    expiresAt: at("expires_at").notNull(),
    confirmedAt: at("confirmed_at"),
    consumedAt: at("consumed_at"),
  },
  (t) => [
    check("owner_login_challenges_status_check", sql`${t.status} in ('pending', 'confirmed', 'rejected', 'consumed', 'cancelled')`),
    check("owner_login_challenges_code_check", sql`${t.code} ~ '^[0-9]{4}$'`),
    index("owner_login_challenges_ip_created_idx").on(t.ipHash, t.createdAt),
    index("owner_login_challenges_expires_at_idx").on(t.expiresAt),
  ],
);

// Обработанные обновления Telegram: повтор того же update_id ничего не меняет.
export const telegramUpdates = pgTable(
  "telegram_updates",
  {
    updateId: bigint("update_id", { mode: "number" }).primaryKey(),
    receivedAt: at("received_at").notNull().defaultNow(),
  },
  (t) => [index("telegram_updates_received_at_idx").on(t.receivedAt)],
);
