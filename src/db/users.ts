import { eq } from 'drizzle-orm';
import { db, isCloudSqlConfigured } from './index.ts';
import { appState, users, worlds } from './schema.ts';
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

export async function loadAllSnapshotsFromSql(): Promise<{
  userProfiles: Array<{ uid: string; profileData: Record<string, unknown> }>;
  worldStates: WorldState[];
  appStates: Record<string, Record<string, unknown>>;
}> {
  if (!isCloudSqlConfigured()) {
    return { userProfiles: [], worldStates: [], appStates: {} };
  }
  try {
    const [userRows, worldRows, stateRows] = await Promise.all([
      db.select().from(users),
      db.select().from(worlds),
      db.select().from(appState),
    ]);

    const userProfiles: Array<{ uid: string; profileData: Record<string, unknown> }> = [];
    for (const row of userRows) {
      if (row.profileData && typeof row.profileData === 'object') {
        userProfiles.push({
          uid: row.uid,
          profileData: row.profileData as Record<string, unknown>,
        });
      }
    }

    const worldStates: WorldState[] = [];
    for (const row of worldRows) {
      if (row.stateData && typeof row.stateData === 'object') {
        worldStates.push(row.stateData as unknown as WorldState);
      }
    }

    const appStates: Record<string, Record<string, unknown>> = {};
    for (const row of stateRows) {
      if (row.value && typeof row.value === 'object') {
        appStates[row.key] = row.value as Record<string, unknown>;
      }
    }

    return { userProfiles, worldStates, appStates };
  } catch (error) {
    console.error('Failed to hydrate snapshots from SQL:', error);
    return { userProfiles: [], worldStates: [], appStates: {} };
  }
}

