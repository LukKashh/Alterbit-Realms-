import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase.ts';
import type { AuthUserProfile } from '../game/network.ts';
import type { WorldState } from '../game/worldGen.ts';

export interface LivePresenceEntry {
  uid: string;
  playerName: string;
  worldName: string;
  x: number;
  y: number;
  level: number;
  online: boolean;
}

export function encodeTilesRle(tiles: number[]): string {
  if (!tiles.length) return '';
  const parts: string[] = [];
  let cur = tiles[0];
  let count = 1;
  for (let i = 1; i < tiles.length; i++) {
    if (tiles[i] === cur) {
      count += 1;
    } else {
      parts.push(count > 1 ? `${cur}x${count}` : `${cur}`);
      cur = tiles[i];
      count = 1;
    }
  }
  parts.push(count > 1 ? `${cur}x${count}` : `${cur}`);
  return parts.join(',');
}

export async function syncUserToFirestore(
  profile: AuthUserProfile,
  currentWorld: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = user.uid;
  const publicPath = `users/${uid}/public/profile`;
  const privatePath = `users/${uid}/private/account`;

  try {
    const publicRef = doc(db, 'users', uid, 'public', 'profile');
    const publicSnap = await getDoc(publicRef);
    const publicData = {
      uid,
      playerName: profile.playerName.slice(0, 32) || 'Explorer',
      level: Math.max(1, Math.min(999, Math.floor(profile.level || 1))),
      role: profile.role === 'admin' ? 'admin' : 'player',
      currentWorld: (currentWorld || '').slice(0, 32),
      updatedAt: serverTimestamp(),
    };
    if (!publicSnap.exists()) {
      await setDoc(publicRef, publicData);
    } else {
      await updateDoc(publicRef, {
        playerName: publicData.playerName,
        level: publicData.level,
        role: publicData.role,
        currentWorld: publicData.currentWorld,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privateRef = doc(db, 'users', uid, 'private', 'account');
    const privateSnap = await getDoc(privateRef);
    const payload = {
      uid,
      email: (profile.email || user.email || '').slice(0, 160),
      gems: Math.max(0, Math.min(100000000, Math.floor(profile.gems || 0))),
      xp: Math.max(0, Math.floor(profile.xp || 0)),
      level: Math.max(1, Math.min(999, Math.floor(profile.level || 1))),
      favoriteWorlds: (profile.favoriteWorlds || []).slice(0, 30),
      recentWorlds: (profile.recentWorlds || []).slice(0, 30),
      inventory: (profile.inventory || []).slice(0, 200),
      equipped: profile.equipped || {},
      stats: profile.stats || {},
      unclaimedWl: Math.max(0, Math.min(1000000, Math.floor(profile.unclaimedWl || 0))),
      activeBuffs: (profile.activeBuffs || []).slice(0, 10),
      updatedAt: serverTimestamp(),
    };
    if (!privateSnap.exists()) {
      await setDoc(privateRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function syncWorldToFirestore(world: WorldState): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const worldId = world.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
  if (!worldId) return;
  const worldPath = `worlds/${worldId}`;

  try {
    const worldRef = doc(db, 'worlds', worldId);
    const existing = await getDoc(worldRef);
    const baseData = {
      worldId,
      name: world.name.slice(0, 24),
      ownerUid: existing.exists() ? existing.data().ownerUid ?? null : null,
      ownerName: world.worldLock?.ownerName ? world.worldLock.ownerName.slice(0, 32) : null,
      revision: Math.max(0, Math.floor(world.revision || 0)),
      spawnX: Math.max(0, Math.min(99, Math.floor(world.spawnX))),
      spawnY: Math.max(0, Math.min(149, Math.floor(world.spawnY))),
      fgRle: encodeTilesRle(world.fg),
      bgRle: encodeTilesRle(world.bg),
      fluidTypeRle: encodeTilesRle(world.fluidType ?? []),
      fluidLevelRle: encodeTilesRle(world.fluidLevel ?? []),
      publicAccess: world.worldLock ? Boolean(world.worldLock.publicAccess) : true,
      updatedByUid: user.uid,
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      await setDoc(worldRef, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(worldRef, {
        ownerUid: baseData.ownerUid,
        ownerName: baseData.ownerName,
        revision: baseData.revision,
        spawnX: baseData.spawnX,
        spawnY: baseData.spawnY,
        fgRle: baseData.fgRle,
        bgRle: baseData.bgRle,
        fluidTypeRle: baseData.fluidTypeRle,
        fluidLevelRle: baseData.fluidLevelRle,
        publicAccess: baseData.publicAccess,
        updatedByUid: user.uid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, worldPath);
  }
}

export async function publishWorldPresence(opts: {
  worldName: string;
  playerName: string;
  x: number;
  y: number;
  level: number;
  online: boolean;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const worldId = opts.worldName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  if (!worldId) return;
  const presencePath = `worlds/${worldId}/presence/${user.uid}`;

  try {
    const presenceRef = doc(db, 'worlds', worldId, 'presence', user.uid);
    const snap = await getDoc(presenceRef);
    const data = {
      uid: user.uid,
      playerName: (opts.playerName || 'Explorer').slice(0, 32),
      worldName: worldId,
      x: Math.max(0, Math.min(4800, Math.round(opts.x))),
      y: Math.max(0, Math.min(7200, Math.round(opts.y))),
      level: Math.max(1, Math.min(999, Math.floor(opts.level || 1))),
      online: Boolean(opts.online),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(presenceRef, data);
    } else {
      await updateDoc(presenceRef, {
        playerName: data.playerName,
        x: data.x,
        y: data.y,
        level: data.level,
        online: data.online,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, presencePath);
  }
}

export function subscribeWorldPresence(
  worldName: string,
  onPresence: (players: LivePresenceEntry[]) => void
): Unsubscribe {
  const worldId = worldName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  if (!auth.currentUser || !worldId) {
    return () => {};
  }
  const path = `worlds/${worldId}/presence`;
  const q = query(
    collection(db, 'worlds', worldId, 'presence'),
    where('online', '==', true),
    where('worldName', '==', worldId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const entries: LivePresenceEntry[] = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          uid: String(raw.uid ?? d.id),
          playerName: String(raw.playerName ?? 'Explorer'),
          worldName: String(raw.worldName ?? worldId),
          x: Number(raw.x ?? 0),
          y: Number(raw.y ?? 0),
          level: Number(raw.level ?? 1),
          online: Boolean(raw.online),
        };
      });
      onPresence(entries);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
