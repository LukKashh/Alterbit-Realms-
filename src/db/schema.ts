import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  username: text('username'),
  role: text('role').notNull().default('player'),
  gems: integer('gems').notNull().default(0),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  profileData: jsonb('profile_data'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
  accountId: text('account_id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  usernameLower: text('username_lower').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('player'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  accountId: text('account_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const worlds = pgTable('worlds', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  ownerUid: text('owner_uid').references(() => users.uid),
  ownerName: text('owner_name'),
  revision: integer('revision').notNull().default(1),
  width: integer('width').notNull().default(100),
  height: integer('height').notNull().default(60),
  worldKind: text('world_kind').notNull().default('standard'),
  stateData: jsonb('state_data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const appState = pgTable('app_state', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  worlds: many(worlds),
}));

export const worldsRelations = relations(worlds, ({ one }) => ({
  owner: one(users, {
    fields: [worlds.ownerUid],
    references: [users.uid],
  }),
}));
