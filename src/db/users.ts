import { eq } from 'drizzle-orm';
import { db, isCloudSqlConfigured } from './index.ts';
import { accounts, appState, sessions, users, worlds } from './schema.ts';
import type { WorldState } from '../game/worldGen.ts';

export async function getOrCreateUser(uid: string, email: string, username?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        ...(username ? { username } : {}),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(username ? { username } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function syncPlayerSnapshotToSql(input: {
  uid: string;
  email: string;
  username: string;
  role: string;
  gems: number;
  xp: number;
  level: number;
  profileData: Record<string, unknown>;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(users)
      .values({
        uid: input.uid,
        email: input.email,
        username: input.username,
        role: input.role,
        gems: input.gems,
        xp: input.xp,
        level: input.level,
        profileData: input.profileData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.email,
          username: input.username,
          role: input.role,
          gems: input.gems,
          xp: input.xp,
          level: input.level,
          profileData: input.profileData,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to sync player snapshot to SQL:', error);
  }
}

export async function syncWorldSnapshotToSql(state: WorldState) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(worlds)
      .values({
        name: state.name,
        ownerName: state.worldLock?.ownerName ?? null,
        revision: state.revision,
        width: state.width,
        height: state.height,
        worldKind: state.worldKind ?? 'standard',
        stateData: state as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: worlds.name,
        set: {
          ownerName: state.worldLock?.ownerName ?? null,
          revision: state.revision,
          width: state.width,
          height: state.height,
          worldKind: state.worldKind ?? 'standard',
          stateData: state as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to sync world snapshot to SQL:', error);
  }
}

export async function deleteWorldFromSql(worldName: string) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db.delete(worlds).where(eq(worlds.name, worldName));
  } catch (error) {
    console.error('Failed to delete world from SQL:', error);
  }
}

export async function syncAccountToSql(input: {
  usernameKey: string;
  username: string;
  email: string;
  passwordHash: string;
  role: string;
  playerId: string;
  createdAt: number;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(accounts)
      .values({
        usernameKey: input.usernameKey,
        username: input.username,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
        playerId: input.playerId,
        createdAt: input.createdAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: accounts.usernameKey,
        set: {
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          role: input.role,
          playerId: input.playerId,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to sync account to SQL:', error);
  }
}

export async function syncSessionToSql(input: {
  token: string;
  usernameKey: string;
  playerId: string;
  createdAt: number;
}) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(sessions)
      .values({
        token: input.token,
        usernameKey: input.usernameKey,
        playerId: input.playerId,
        createdAt: input.createdAt,
      })
      .onConflictDoUpdate({
        target: sessions.token,
        set: {
          usernameKey: input.usernameKey,
          playerId: input.playerId,
          createdAt: input.createdAt,
        },
      });
  } catch (error) {
    console.error('Failed to sync session to SQL:', error);
  }
}

export async function deleteSessionFromSql(token: string) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db.delete(sessions).where(eq(sessions.token, token));
  } catch (error) {
    console.error('Failed to delete session from SQL:', error);
  }
}

export async function syncAppStateToSql(key: string, value: Record<string, unknown>) {
  if (!isCloudSqlConfigured()) return;
  try {
    await db
      .insert(appState)
      .values({
        key,
        value,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appState.key,
        set: {
          value,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`Failed to sync app state (${key}) to SQL:`, error);
  }
}

export async function loadAllStateFromSql() {
  if (!isCloudSqlConfigured()) return null;
  try {
    const [userRows, accountRows, sessionRows, worldRows, appStateRows] = await Promise.all([
      db.select().from(users),
      db.select().from(accounts),
      db.select().from(sessions),
      db.select().from(worlds),
      db.select().from(appState),
    ]);
    return {
      userRows,
      accountRows,
      sessionRows,
      worldRows,
      appStateRows,
    };
  } catch (error) {
    console.error('Failed to hydrate state from Cloud SQL:', error);
    return null;
  }
}

