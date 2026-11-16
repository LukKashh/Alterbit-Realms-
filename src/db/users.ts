import { eq } from 'drizzle-orm';
import { db, isCloudSqlConfigured } from './index.ts';
import { appState, users, worlds } from './schema.ts';
import type { WorldState } from '../game/worldGen.ts';

function toSafeJsonb<T>(input: T): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(input ?? {})) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function withSqlRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
}

export async function getOrCreateUser(uid: string, email: string, username?: string) {
  try {
    const result = await withSqlRetry(() =>
      db
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
        .returning()
    );

    return result[0];
  } catch (error) {
    console.warn('Database user upsert failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await withSqlRetry(() => db.select().from(users));
  } catch (error) {
    console.warn('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await withSqlRetry(() =>
      db.select().from(users).where(eq(users.uid, uid)).limit(1)
    );
    return rows[0] ?? null;
  } catch (error) {
    console.warn('Database query failed:', error);
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
  const safeProfile = toSafeJsonb(input.profileData);
  const safeGems = Math.max(0, Math.round(Number(input.gems) || 0));
  const safeXp = Math.max(0, Math.round(Number(input.xp) || 0));
  const safeLevel = Math.max(1, Math.round(Number(input.level) || 1));
  try {
    await withSqlRetry(() =>
      db
        .insert(users)
        .values({
          uid: input.uid,
          email: input.email,
          username: input.username,
          role: input.role,
          gems: safeGems,
          xp: safeXp,
          level: safeLevel,
          profileData: safeProfile,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email: input.email,
            username: input.username,
            role: input.role,
            gems: safeGems,
            xp: safeXp,
            level: safeLevel,
            profileData: safeProfile,
            updatedAt: new Date(),
          },
        })
    );
  } catch {
    // Best-effort background SQL snapshot sync; local disk + Firestore remain primary
  }
}

export async function syncWorldSnapshotToSql(state: WorldState) {
  if (!isCloudSqlConfigured()) return;
  const safeState = toSafeJsonb(state);
  const safeRevision = Math.max(1, Math.round(Number(state.revision) || 1));
  const safeWidth = Math.max(1, Math.round(Number(state.width) || 100));
  const safeHeight = Math.max(1, Math.round(Number(state.height) || 60));
  try {
    await withSqlRetry(() =>
      db
        .insert(worlds)
        .values({
          name: state.name,
          ownerName: state.worldLock?.ownerName ?? null,
          revision: safeRevision,
          width: safeWidth,
          height: safeHeight,
          worldKind: state.worldKind ?? 'standard',
          stateData: safeState,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: worlds.name,
          set: {
            ownerName: state.worldLock?.ownerName ?? null,
            revision: safeRevision,
            width: safeWidth,
            height: safeHeight,
            worldKind: state.worldKind ?? 'standard',
            stateData: safeState,
            updatedAt: new Date(),
          },
        })
    );
  } catch {
    // Best-effort background SQL snapshot sync
  }
}

const pendingAppStateChains = new Map<string, Promise<void>>();

export async function syncAppStateToSql(key: string, value: Record<string, unknown>) {
  if (!isCloudSqlConfigured()) return;
  const safeKey = String(key ?? '').trim();
  if (!safeKey) return;
  const safeValue = toSafeJsonb(value);

  const prev = pendingAppStateChains.get(safeKey) ?? Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(async () => {
      try {
        await withSqlRetry(() =>
          db
            .insert(appState)
            .values({
              key: safeKey,
              value: safeValue,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: appState.key,
              set: {
                value: safeValue,
                updatedAt: new Date(),
              },
            })
        );
      } catch {
        // Best-effort background SQL app_state sync
      }
    });

  pendingAppStateChains.set(safeKey, next);
  await next;
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
    const [userRows, worldRows, stateRows] = await withSqlRetry(() =>
      Promise.all([
        db.select().from(users),
        db.select().from(worlds),
        db.select().from(appState),
      ])
    );

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
  } catch {
    return { userProfiles: [], worldStates: [], appStates: {} };
  }
}
