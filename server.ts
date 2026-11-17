import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthoritativeWorldStore, type LiveWorld, type PlayerAccount } from './server/worldStore.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { isCloudSqlConfigured } from './src/db/index.ts';
import {
  getOrCreateUser,
  getUsers,
  syncAppStateToSql,
  syncPlayerSnapshotToSql,
  syncWorldSnapshotToSql,
} from './src/db/users.ts';
import type { ClientMessage, ResumePosition, ServerMessage } from './src/game/network.ts';
import { TILE_SIZE } from './src/game/constants.ts';
import { addXp, tileIndexIn, worldHeight, worldWidth } from './src/game/rules.ts';

interface WsSessionRecord {
  sessionId: string;
  accountId: string;
  authToken: string;
  issuedAt: number;
  expiresAt: number;
}

interface ClientSession {
  ws: WebSocket;
  account: PlayerAccount | null;
  worldName: string | null;
  lastSeenAt: number;
  wsToken: string | null;
  wsSessionId: string | null;
  authToken: string | null;
  sessionExpiresAt: number | null;
  lastTeleportAt?: number;
}

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  const store = new AuthoritativeWorldStore();
  await store.hydrateFromDatabase();
  
  function extractBearerToken(req: express.Request): string | undefined {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return undefined;
  }

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    let bundle = isProd ? 'unknown' : 'vite-dev';
    if (isProd) {
      try {
        const html = fs.readFileSync(path.resolve(process.cwd(), 'dist', 'index.html'), 'utf8');
        const match = html.match(/\/assets\/index-([a-zA-Z0-9_-]+)\.js/);
        if (match) bundle = match[1];
      } catch {
        bundle = 'missing-dist';
      }
    }
    res.json({
      ok: true,
      mode: isProd ? 'production' : 'development',
      bundle,
      worlds: store.listWorlds().length,
    });
  });

  app.get('/api/worlds', (_req, res) => {
    res.json({ worlds: store.listWorlds() });
  });

  app.get('/api/admin/player-profile', (req, res) => {
    const token = extractBearerToken(req);
    const caller = store.getAccountByToken(token);
    // Enforce admin privileges if token is supplied
    if (caller && caller.role !== 'admin') {
      res.status(403).json({ ok: false, message: 'Forbidden: Administrator privileges required.' });
      return;
    }
    const identifier = (req.query.id as string) || (req.query.name as string);
    if (!identifier) {
      res.status(400).json({ ok: false, message: 'Missing target player id or name.' });
      return;
    }
    const profile = store.getAdminPlayerProfile(identifier);
    if (!profile) {
      res.status(404).json({ ok: false, message: `Player '${identifier}' not found.` });
      return;
    }
    res.json({ ok: true, profile });
  });

  app.get('/api/config', (_req, res) => {
    res.json({ gameConfig: store.getGameConfig() });
  });

  app.get('/api/exchange', (_req, res) => {
    res.json({ ok: true, exchange: store.getExchangeSnapshot() });
  });

  app.post('/api/auth/register', (req, res) => {
    const { email, username, password } = req.body ?? {};
    const result = store.registerAccount({ email, username, password });
    if (!result.ok) {
      res.status(400).json({ ok: false, message: result.message });
      return;
    }
    res.json({
      ok: true,
      token: result.token,
      user: store.toAuthUserProfile(result.account),
      gameConfig: store.getGameConfig(),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { identifier, password } = req.body ?? {};
    const result = store.loginAccount({ identifier, password });
    if (!result.ok) {
      res.status(401).json({ ok: false, message: result.message });
      return;
    }
    res.json({
      ok: true,
      token: result.token,
      user: store.toAuthUserProfile(result.account),
      gameConfig: store.getGameConfig(),
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractBearerToken(req);
    const account = store.getAccountByToken(token);
    if (!account) {
      res.status(401).json({ ok: false, message: 'Session expired or invalid.' });
      return;
    }
    res.json({
      ok: true,
      user: store.toAuthUserProfile(account),
      gameConfig: store.getGameConfig(),
    });
  });

  app.post('/api/auth/firebase', async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, message: 'Unauthorized: Missing Firebase ID token.' });
      return;
    }
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const result = store.loginOrCreateFirebaseAccount({
        uid: decoded.uid,
        email: decoded.email ?? '',
        displayName: typeof decoded.name === 'string' ? decoded.name : undefined,
        emailVerified: Boolean(decoded.email_verified),
      });
      if (!result.ok) {
        res.status(400).json({ ok: false, message: result.message });
        return;
      }
      if (isCloudSqlConfigured()) {
        await getOrCreateUser(decoded.uid, decoded.email ?? '', result.account.name).catch((err) => {
          console.error('Cloud SQL Firebase user sync error:', err);
        });
      }
      res.json({
        ok: true,
        token: result.token,
        user: store.toAuthUserProfile(result.account),
        gameConfig: store.getGameConfig(),
      });
    } catch (error) {
      console.error('Error verifying Firebase ID token:', error);
      res.status(401).json({ ok: false, message: 'Unauthorized: Invalid Firebase ID token.' });
    }
  });

  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid) {
        res.status(401).json({ error: 'Unauthorized: Missing user identity' });
        return;
      }
      const allUsers = await getUsers();
      res.json({ users: allUsers });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch users';
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    store.logoutToken(token);
    if (token) {
      revokeWsSessionsForAuthToken(token);
    }
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const sessions = new Set<ClientSession>();
  const WS_SESSION_SECRET =
    process.env.WS_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
  const WS_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  const activeWsSessions = new Map<string, WsSessionRecord>();

  function timingSafeEqualStr(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  function signWsSessionPayload(payloadB64: string): string {
    return crypto
      .createHmac('sha256', WS_SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');
  }

  function issueWsSessionToken(
    accountId: string,
    authToken: string
  ): { wsToken: string; record: WsSessionRecord } {
    const sessionId = crypto.randomBytes(18).toString('base64url');
    const issuedAt = Date.now();
    const expiresAt = issuedAt + WS_SESSION_TTL_MS;
    const payload = JSON.stringify({
      sid: sessionId,
      aid: accountId,
      iat: issuedAt,
      exp: expiresAt,
    });
    const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
    const sig = signWsSessionPayload(payloadB64);
    const wsToken = `bgws.${payloadB64}.${sig}`;
    const record: WsSessionRecord = {
      sessionId,
      accountId,
      authToken,
      issuedAt,
      expiresAt,
    };
    activeWsSessions.set(sessionId, record);
    return { wsToken, record };
  }

  function validateWsSessionToken(
    wsToken: string | null | undefined
  ): { record: WsSessionRecord; account: PlayerAccount } | null {
    if (!wsToken || typeof wsToken !== 'string') return null;
    const parts = wsToken.split('.');
    if (parts.length !== 3 || parts[0] !== 'bgws') return null;
    const [, payloadB64, sig] = parts;
    if (!payloadB64 || !sig) return null;
    const expectedSig = signWsSessionPayload(payloadB64);
    if (!timingSafeEqualStr(sig, expectedSig)) return null;
    let parsed: { sid?: unknown; aid?: unknown; exp?: unknown };
    try {
      parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
        sid?: unknown;
        aid?: unknown;
        exp?: unknown;
      };
    } catch {
      return null;
    }
    if (
      typeof parsed.sid !== 'string' ||
      typeof parsed.aid !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    const now = Date.now();
    if (parsed.exp <= now) {
      activeWsSessions.delete(parsed.sid);
      return null;
    }
    const record = activeWsSessions.get(parsed.sid);
    if (!record || record.accountId !== parsed.aid || record.expiresAt <= now) {
      activeWsSessions.delete(parsed.sid);
      return null;
    }
    const account = store.getAccountByToken(record.authToken);
    if (!account || account.id !== record.accountId) {
      activeWsSessions.delete(parsed.sid);
      return null;
    }
    return { record, account };
  }

  function clearSessionAuth(session: ClientSession) {
    if (session.wsSessionId) {
      activeWsSessions.delete(session.wsSessionId);
    }
    session.account = null;
    session.wsToken = null;
    session.wsSessionId = null;
    session.authToken = null;
    session.sessionExpiresAt = null;
  }

  function revokeWsSessionsForAuthToken(authToken: string) {
    for (const [sid, rec] of activeWsSessions.entries()) {
      if (rec.authToken === authToken) {
        activeWsSessions.delete(sid);
      }
    }
    for (const s of sessions) {
      if (s.authToken === authToken) {
        clearSessionAuth(s);
        sendTo(s.ws, { type: 'auth_error', message: 'Signed out.' });
        try {
          s.ws.close(4001, 'Signed out');
        } catch {
          // ignore
        }
      }
    }
  }

  function sendTo(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcastAll(msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    for (const s of sessions) {
      if (s.ws.readyState === WebSocket.OPEN) {
        s.ws.send(payload);
      }
    }
  }

  function sendToPlayerId(playerId: string, msg: ServerMessage) {
    for (const session of sessions) {
      if (session.account?.id === playerId) sendTo(session.ws, msg);
    }
  }

  function sendProfileUpdate(ws: WebSocket, account: PlayerAccount, notice?: string) {
    sendTo(ws, {
      type: 'profile_updated',
      gems: account.gems,
      alterbits: account.alterbits ?? 0,
      pixobytes: account.pixobytes ?? 0,
      xp: account.xp,
      level: account.level,
      cropMasteryXp: account.cropMasteryXp ?? 0,
      cropMasteryLevel: account.cropMasteryLevel ?? 1,
      farmablockMasteryXp: account.farmablockMasteryXp ?? 0,
      farmablockMasteryLevel: account.farmablockMasteryLevel ?? 1,
      role: account.role,
      email: account.email,
      inventory: account.inventory,
      equipped: account.equipped,
      stats: account.stats,
      claimedAchievements: account.claimedAchievements,
      friends: store.getFriendEntries(account),
      incomingRequests: account.incomingRequests,
      favoriteWorlds: account.favoriteWorlds,
      recentWorlds: account.recentWorlds,
      activeBuffs: store.pruneAndGetBuffs(account),
      unclaimedWl: account.unclaimedWl ?? 0,
      hasClaimedStarterLootbox: Boolean(account.hasClaimedStarterLootbox),
      notice,
    });
    if (isCloudSqlConfigured()) {
      void syncPlayerSnapshotToSql({
        uid: account.id,
        email: account.email,
        username: account.name,
        role: account.role,
        gems: account.gems,
        xp: account.xp,
        level: account.level,
        profileData: account as unknown as Record<string, unknown>,
      });
    }
  }

  function sendProfileToPlayerId(playerId: string, notice?: string) {
    for (const s of sessions) {
      if (s.account && s.account.id === playerId) {
        sendProfileUpdate(s.ws, s.account, notice);
      }
    }
  }

  function broadcastWorld(worldName: string, msg: ServerMessage, excludeWs?: WebSocket) {
    const payload = JSON.stringify(msg);
    for (const s of sessions) {
      if (s.worldName === worldName && s.ws !== excludeWs && s.ws.readyState === WebSocket.OPEN) {
        s.ws.send(payload);
      }
    }
  }

  function broadcastTileSnapshot(live: LiveWorld, tx: number, ty: number) {
    const idx = tileIndexIn(live.state, tx, ty);
    const key = `${tx},${ty}`;
    broadcastWorld(live.state.name, {
      type: 'tile_updated',
      tx,
      ty,
      fg: live.state.fg[idx],
      bg: live.state.bg[idx],
      fluidType: live.state.fluidType?.[idx] ?? 0,
      fluidLevel: live.state.fluidLevel?.[idx] ?? 0,
      plant: live.state.plants[key] ?? null,
      worldLock: live.state.worldLock,
      areaLock: live.state.areaLocks?.[key] ?? null,
      shareLock: live.state.shareLocks?.[key] ?? null,
      vendingMachine: live.state.vendingMachines?.[key] ?? null,
      furnace: live.state.furnaces?.[key] ?? null,
      bfgCollector: live.state.bfgCollectors?.[key] ?? null,
      seedPot: live.state.seedPots?.[key] ?? null,
      matteragenEngine: live.state.matteragenEngines?.[key] ?? null,
      atmMachine: live.state.atmMachines?.[key] ?? null,
      vaultbox: live.state.vaultboxes?.[key] ?? null,
      signText: live.state.signs?.[key] ?? null,
      doorLink: live.state.doorLinks?.[key] ?? null,
      revision: live.state.revision,
    });
    if (isCloudSqlConfigured()) {
      void syncWorldSnapshotToSql(live.state);
    }
  }

  function leaveCurrentWorld(session: ClientSession, explicitExit = false) {
    if (!session.account || !session.worldName) return;
    const prevWorld = session.worldName;
    const accountId = session.account.id;
    session.worldName = null;

    // Only remove player from world if no other active socket for the same account is in that world
    let hasOtherActiveSocketInWorld = false;
    for (const s of sessions) {
      if (
        s !== session &&
        s.account?.id === accountId &&
        s.worldName === prevWorld &&
        s.ws.readyState === WebSocket.OPEN
      ) {
        hasOtherActiveSocketInWorld = true;
        break;
      }
    }

    if (!hasOtherActiveSocketInWorld) {
      store.leaveWorld(prevWorld, accountId, explicitExit);
      broadcastWorld(prevWorld, { type: 'player_left', playerId: accountId });
      broadcastAll({ type: 'worlds_list', worlds: store.listWorlds() });
    }
  }

  function enterWorldSession(
    session: ClientSession,
    ws: WebSocket,
    account: PlayerAccount,
    targetWorldName: string,
    resumePosition?: ResumePosition,
    explicitLeavePrev = false
  ): { ok: true } | { ok: false; message: string } {
    if (session.worldName && session.worldName !== targetWorldName.trim().toUpperCase()) {
      leaveCurrentWorld(session, explicitLeavePrev);
    }
    const res = store.joinWorld(account, targetWorldName, resumePosition);
    if (!res.ok) {
      sendTo(ws, { type: 'world_error', message: res.message });
      return { ok: false, message: res.message };
    }
    session.worldName = res.world.state.name;
    sendTo(ws, {
      type: 'world_joined',
      world: res.world.state,
      players: Array.from(res.world.players.values()),
      drops: Array.from(res.world.drops.values()),
      chatHistory: res.world.chatHistory,
      resumed: res.resumed,
    });
    sendProfileUpdate(ws, account);
    broadcastWorld(
      res.world.state.name,
      { type: 'player_joined', player: res.remote },
      ws
    );
    broadcastAll({ type: 'worlds_list', worlds: store.listWorlds() });
    return { ok: true };
  }

  function processAuthenticatedClientAction(
    session: ClientSession,
    ws: WebSocket,
    account: PlayerAccount,
    msg: ClientMessage
  ): { ok: boolean; errorMessage?: string; pose?: ResumePosition } {
    if (msg.type === 'create_world') {
      if (session.worldName !== 'NEXUS') {
        const message = 'Visit the Nexus Landlord to create a realm.';
        sendTo(ws, { type: 'world_error', message });
        return { ok: false, errorMessage: message };
      }
      const result = store.createOwnedWorld(account, msg.worldName, Boolean(msg.terraBlast));
      if (!result.ok) {
        sendTo(ws, { type: 'world_error', message: result.message });
        return { ok: false, errorMessage: result.message };
      }
      const entered = enterWorldSession(session, ws, account, result.worldName, undefined, true);
      sendProfileUpdate(ws, account, result.notice);
      broadcastAll({ type: 'worlds_list', worlds: store.listWorlds() });
      return entered.ok ? { ok: true } : { ok: false, errorMessage: entered.message };
    }

    if (msg.type === 'list_worlds') {
      sendTo(ws, { type: 'worlds_list', worlds: store.listWorlds() });
      return { ok: true };
    }

    if (msg.type === 'leave_world') {
      leaveCurrentWorld(session, true);
      return { ok: true };
    }

    if (msg.type === 'join_world') {
      const entered = enterWorldSession(session, ws, account, msg.worldName, msg.resumePosition, false);
      return entered.ok ? { ok: true } : { ok: false, errorMessage: entered.message };
    }

    if (msg.type === 'upgrade_fishing_rod') {
      const res = store.handleUpgradeFishingRod(account, msg.rodInstanceId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'use_consumable') {
      const res = store.handleUseConsumable(account, msg.itemId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      if (res.kind === 'mine_scroll' && res.mineWorldName) {
        const entered = enterWorldSession(session, ws, account, res.mineWorldName, undefined, true);
        sendProfileUpdate(ws, account, res.notice);
        return entered.ok ? { ok: true } : { ok: false, errorMessage: entered.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'exit_mine_shaft') {
      const entered = enterWorldSession(session, ws, account, 'START', undefined, true);
      return entered.ok ? { ok: true } : { ok: false, errorMessage: entered.message };
    }

    if (msg.type === 'exchange_action') {
      if (msg.action === 'list') {
        sendTo(ws, { type: 'exchange_updated', exchange: store.getExchangeSnapshot() });
        return { ok: true };
      }
      const res = store.handleExchangeAction(account, msg);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      broadcastAll({ type: 'exchange_updated', exchange: store.getExchangeSnapshot() });
      if (res.sellerIdToNotify) {
        sendProfileToPlayerId(res.sellerIdToNotify, 'Global Exchange sale! Claim WL in your Vault.');
      }
      return { ok: true };
    }

    if (msg.type === 'splice_seeds') {
      const res = store.handleSplice(account, msg.seedA, msg.seedB);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, `Spliced ${res.resultName}!`);
      return { ok: true };
    }

    if (msg.type === 'buy_gem_store') {
      const res = store.handleBuyGemStore(account, msg.listingId, msg.txId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'vendor_action') {
      const res = store.handleVendorAction(account, {
        action: msg.action,
        itemId: msg.itemId,
        qty: msg.qty,
        currency: msg.currency,
        cart: msg.cart,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'equip_wearable') {
      const res = store.handleEquipWearable(account, msg.itemId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      if (session.worldName) {
        const live = store.getOrCreateWorld(session.worldName);
        const remote = live.players.get(account.id);
        if (remote) {
          remote.equipped = account.equipped;
          broadcastWorld(live.state.name, { type: 'player_moved', player: remote });
        }
      }
      return { ok: true };
    }

    if (msg.type === 'friend_action') {
      const res = store.handleFriendAction(account, msg.action, msg.targetNameOrId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      if (res.targetAccount) {
        sendProfileToPlayerId(res.targetAccount.id, `Friend update from ${account.name}`);
      }
      return { ok: true };
    }

    if (msg.type === 'claim_achievement') {
      const res = store.handleClaimAchievement(account, msg.achievementId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'toggle_favorite_world') {
      const notice = store.handleToggleFavoriteWorld(account, msg.worldName);
      sendProfileUpdate(ws, account, notice);
      return { ok: true };
    }

    if (msg.type === 'update_game_config') {
      const res = store.updateGameConfig(account, msg.config);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastAll({
        type: 'config_updated',
        gameConfig: res.gameConfig,
        notice: `Game configuration updated by ${account.name}.`,
      });
      if (isCloudSqlConfigured()) {
        void syncAppStateToSql('game_config', res.gameConfig as unknown as Record<string, unknown>);
      }
      return { ok: true };
    }

    if (msg.type === 'admin_action') {
      const liveForAction = session.worldName ? store.getOrCreateWorld(session.worldName) : null;
      const res = store.handleAdminAction(account, liveForAction, {
        action: msg.action,
        itemId: msg.itemId,
        qty: msg.qty,
        gems: msg.gems,
        slotIndex: msg.slotIndex,
        rodInstanceId: msg.rodInstanceId,
        tx: msg.tx,
        ty: msg.ty,
        tx2: msg.tx2,
        ty2: msg.ty2,
        layer: msg.layer,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      if (res.configReset) {
        broadcastAll({
          type: 'config_updated',
          gameConfig: store.getGameConfig(),
          notice: res.notice,
        });
      }
      if (res.grownTiles && liveForAction) {
        for (const t of res.grownTiles) {
          broadcastTileSnapshot(liveForAction, t.tx, t.ty);
        }
      }
      if (res.updatedTiles && liveForAction) {
        for (const t of res.updatedTiles) {
          broadcastTileSnapshot(liveForAction, t.tx, t.ty);
        }
      }
      if (res.fullWorldSync) {
        const targetLive =
          msg.action === 'rebuild_nexus'
            ? store.getOrCreateWorld('NEXUS')
            : liveForAction;
        if (targetLive) {
          broadcastWorld(targetLive.state.name, {
            type: 'world_joined',
            world: targetLive.state,
            players: Array.from(targetLive.players.values()),
            drops: Array.from(targetLive.drops.values()),
            chatHistory: targetLive.chatHistory,
            resumed: false,
          });
        }
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'inspect_player') {
      const profile = store.getPublicPlayerProfile(msg.targetPlayerId);
      if (!profile) {
        const message = 'Player profile not found.';
        sendTo(ws, { type: 'world_error', message });
        return { ok: false, errorMessage: message };
      }
      sendTo(ws, { type: 'player_profile', profile });
      return { ok: true };
    }

    if (msg.type === 'trash_inventory_item') {
      const res = store.trashInventoryItem(account, {
        itemId: msg.itemId,
        qty: msg.qty,
        rodInstanceId: msg.rodInstanceId,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (!session.worldName) {
      return { ok: false, errorMessage: 'Player is not inside an active world.' };
    }
    const live: LiveWorld = store.getOrCreateWorld(session.worldName);
    const remote = live.players.get(account.id);
    if (!remote) {
      return { ok: false, errorMessage: 'Player presence not initialized in world.' };
    }

    if (msg.type === 'admin_list_entities') {
      if (account.role !== 'admin') {
        const message = 'Administrator role required.';
        sendTo(ws, { type: 'world_error', message });
        return { ok: false, errorMessage: message };
      }
      const snapshot = store.listWorldEntities(live, account);
      sendTo(ws, {
        type: 'world_entities',
        ...snapshot,
      });
      return { ok: true };
    }

    if (msg.type === 'admin_teleport_entity') {
      const res = store.handleAdminTeleportEntity(account, live, {
        entityKind: msg.entityKind,
        entityId: msg.entityId,
        targetTx: msg.targetTx,
        targetTy: msg.targetTy,
        summon: msg.summon,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      if (res.kind === 'player') {
        let targetWs: WebSocket | undefined;
        for (const s of sessions) {
          if (s.account?.id === res.playerId && s.worldName === live.state.name) {
            s.lastTeleportAt = Date.now();
            targetWs = s.ws;
            sendTo(s.ws, {
              type: 'player_teleported',
              tx: res.tx,
              ty: res.ty,
              notice: res.notice,
            });
          }
        }
        broadcastWorld(live.state.name, { type: 'player_moved', player: res.remote }, targetWs);
      } else {
        if (res.oldTx !== res.tx || res.oldTy !== res.ty) {
          broadcastTileSnapshot(live, res.oldTx, res.oldTy);
          broadcastTileSnapshot(live, res.tx, res.ty);
        }
      }
      sendTo(ws, {
        type: 'world_entities',
        ...res.snapshot,
        notice: res.notice,
      });
      return { ok: true };
    }

    if (msg.type === 'move') {
      // Ignore stale in-flight move packets sent right before a door or NEXUS teleport
      if (
        session.lastTeleportAt &&
        Date.now() - session.lastTeleportAt < 500 &&
        Math.hypot(msg.x - remote.x, msg.y - remote.y) > 192
      ) {
        const postTeleportPose: ResumePosition = {
          x: remote.x,
          y: remote.y,
          vx: remote.vx,
          vy: remote.vy,
          facing: remote.facing,
          grounded: remote.grounded,
        };
        return { ok: true, pose: postTeleportPose };
      }
      const maxPxX = (worldWidth(live.state) - 1) * TILE_SIZE;
      const maxPxY = (worldHeight(live.state) - 1) * TILE_SIZE;
      let nextX = Math.max(0, Math.min(maxPxX, msg.x));
      let nextY = Math.max(0, Math.min(maxPxY, msg.y));
      let nextVx = msg.vx;
      let nextVy = msg.vy;
      if (
        live.state.name === 'NEXUS' &&
        nextY > (worldHeight(live.state) - 4) * TILE_SIZE
      ) {
        nextX = live.state.spawnX * TILE_SIZE + 9;
        nextY = (live.state.spawnY + 1) * TILE_SIZE - 42;
        nextVx = 0;
        nextVy = 0;
      }
      remote.x = nextX;
      remote.y = nextY;
      remote.vx = nextVx;
      remote.vy = nextVy;
      remote.facing = msg.facing;
      remote.grounded = msg.grounded;
      remote.punching = msg.punching;
      remote.placing = Boolean(msg.placing);
      remote.equipped = account.equipped;
      const authoritativePose: ResumePosition = {
        x: remote.x,
        y: remote.y,
        vx: remote.vx,
        vy: remote.vy,
        facing: remote.facing,
        grounded: remote.grounded,
      };
      store.recordPlayerPose(live.state.name, account.id, authoritativePose);
      broadcastWorld(live.state.name, { type: 'player_moved', player: remote }, ws);
      return { ok: true, pose: authoritativePose };
    }

    if (msg.type === 'punch_tile') {
      const adminEdit = account.role === 'admin' && Boolean(msg.adminEdit);
      const res = store.handlePunchTile(live, account, msg.tx, msg.ty, msg.toolItemId, adminEdit);
      if (!res.ok) {
        if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
        return { ok: false, errorMessage: res.reason ?? 'Cannot break tile.' };
      }
      if (!res.broken && res.drops.length === 0) {
        broadcastWorld(live.state.name, {
          type: 'tile_damaged',
          tx: msg.tx,
          ty: msg.ty,
          hits: res.hits,
          maxHits: res.maxHits,
          layer: res.layer as 'fg' | 'bg' | 'plant',
        });
      } else {
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        for (const d of res.drops) {
          broadcastWorld(live.state.name, { type: 'drop_spawned', drop: d });
        }
        if (res.worldXpUpdate) {
          broadcastWorld(live.state.name, {
            type: 'world_xp_updated',
            worldName: live.state.name,
            worldXp: res.worldXpUpdate.worldXp,
            worldLevel: res.worldXpUpdate.worldLevel,
            coreTokens: res.worldXpUpdate.coreTokens,
          });
        }
        sendProfileUpdate(ws, account, res.notice);
      }
      return { ok: true };
    }

    if (msg.type === 'plow_tile') {
      const adminEdit = account.role === 'admin' && Boolean(msg.adminEdit);
      const res = store.handlePlowTile(live, account, msg.tx, msg.ty, adminEdit);
      if (!res.ok) {
        if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
        return { ok: false, errorMessage: res.reason ?? 'Cannot plow tile.' };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      if (res.worldXpUpdate) {
        broadcastWorld(live.state.name, {
          type: 'world_xp_updated',
          worldName: live.state.name,
          worldXp: res.worldXpUpdate.worldXp,
          worldLevel: res.worldXpUpdate.worldLevel,
          coreTokens: res.worldXpUpdate.coreTokens,
        });
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'place_tile') {
      const adminEdit = account.role === 'admin' && Boolean(msg.adminEdit);
      const res = store.handlePlaceTile(live, account, msg.itemId, msg.tx, msg.ty, adminEdit);
      if (!res.ok) {
        if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
        return { ok: false, errorMessage: res.reason ?? 'Cannot place tile.' };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'configure_lock') {
      const res = store.handleConfigureLock(live, account, msg.tx, msg.ty, {
        addEditorName: msg.addEditorName,
        removeEditorId: msg.removeEditorId,
        permissionTargetId: msg.permissionTargetId,
        permissions: msg.permissions,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'configure_vending') {
      const res = store.handleConfigureVending(live, account, msg.tx, msg.ty, {
        action: msg.action,
        stockItemId: msg.stockItemId,
        stockQty: msg.stockQty,
        priceItemId: msg.priceItemId,
        priceQty: msg.priceQty,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'buy_vending') {
      const res = store.handleBuyVending(live, account, msg.tx, msg.ty, msg.units, msg.txId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'configure_sign') {
      const res = store.handleConfigureSign(live, account, msg.tx, msg.ty, msg.text);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'pickup_drop') {
      const res = store.handlePickupDrop(live, account, msg.dropId);
      if (!res.ok) {
        if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
        return { ok: false, errorMessage: res.reason ?? 'Pickup failed.' };
      }
      if (res.partialRemaining && res.partialRemaining > 0) {
        broadcastWorld(live.state.name, { type: 'drop_spawned', drop: res.drop });
      } else {
        broadcastWorld(live.state.name, { type: 'drop_removed', dropId: res.drop.id });
      }
      sendProfileUpdate(ws, account);
      return { ok: true };
    }

    if (msg.type === 'configure_furnace') {
      const res = store.handleConfigureFurnace(live, account, msg.tx, msg.ty, {
        action: msg.action,
        recipeId: msg.recipeId,
        toolItemId: msg.toolItemId,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      if (msg.action === 'collect') {
        broadcastWorld(live.state.name, {
          type: 'world_xp_updated',
          worldName: live.state.name,
          worldXp: live.state.worldXp ?? 0,
          worldLevel: live.state.worldLevel ?? 1,
          coreTokens: live.state.coreTokens ?? 0,
        });
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'configure_bfg') {
      const res = store.handleConfigureBfg(live, account, msg.tx, msg.ty, {
        action: msg.action,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'upgrade_matteragen') {
      const res = store.upgradeMatteragenEngine(account, live.state.name, msg.tx, msg.ty);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      broadcastWorld(live.state.name, {
        type: 'world_xp_updated',
        worldName: live.state.name,
        worldXp: live.state.worldXp ?? 0,
        worldLevel: live.state.worldLevel ?? 1,
        coreTokens: res.coreTokens,
      });
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'claim_matteragen') {
      const res = store.claimMatteragenEngine(account, live.state.name, msg.tx, msg.ty);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      if (res.worldXpUpdate) {
        broadcastWorld(live.state.name, {
          type: 'world_xp_updated',
          worldName: live.state.name,
          worldXp: res.worldXpUpdate.worldXp,
          worldLevel: res.worldXpUpdate.worldLevel,
          coreTokens: res.worldXpUpdate.coreTokens,
        });
      }
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'unlock_worldcore_furnace') {
      const res = store.unlockWorldCoreFurnace(account, live.state.name);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, res.tx, res.ty);
      broadcastWorld(live.state.name, {
        type: 'world_xp_updated',
        worldName: live.state.name,
        worldXp: live.state.worldXp ?? 0,
        worldLevel: live.state.worldLevel ?? 1,
        coreTokens: res.coreTokens,
        hasFurnaceExpansion: true,
      });
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'unlock_worldcore_vaultbox') {
      const res = store.unlockWorldCoreVaultbox(account, live.state.name, msg.tx, msg.ty);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, res.tx, res.ty);
      broadcastWorld(live.state.name, {
        type: 'world_xp_updated',
        worldName: live.state.name,
        worldXp: live.state.worldXp ?? 0,
        worldLevel: live.state.worldLevel ?? 1,
        coreTokens: live.state.coreTokens ?? 0,
        hasVaultboxExpansion: true,
      });
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'configure_door') {
      const res = store.handleConfigureDoor(
        live,
        account,
        msg.tx,
        msg.ty,
        msg.targetX,
        msg.targetY,
        msg.label
      );
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'use_door') {
      const res = store.handleUseDoor(live, account, msg.tx, msg.ty);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      session.lastTeleportAt = Date.now();
      sendTo(ws, {
        type: 'player_teleported',
        tx: res.targetX,
        ty: res.targetY,
        notice: res.notice,
      });
      broadcastWorld(live.state.name, { type: 'player_moved', player: res.remote }, ws);
      return { ok: true };
    }

    if (msg.type === 'nexus_teleport') {
      const res = store.handleNexusTeleport(live, account, msg.targetX, msg.targetY, msg.label);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      session.lastTeleportAt = Date.now();
      sendTo(ws, {
        type: 'player_teleported',
        tx: res.targetX,
        ty: res.targetY,
        notice: res.notice,
      });
      broadcastWorld(live.state.name, { type: 'player_moved', player: res.remote }, ws);
      return { ok: true };
    }

    if (msg.type === 'use_entrance_portal') {
      if (live.state.name === 'NEXUS') {
        return { ok: true };
      }
      store.clearSavedPose('NEXUS', account.id);
      const entered = enterWorldSession(session, ws, account, 'NEXUS', undefined, false);
      return entered.ok ? { ok: true } : { ok: false, errorMessage: entered.message };
    }

    if (msg.type === 'configure_vaultbox') {
      const res = store.handleConfigureVaultbox(live, account, msg.tx, msg.ty, {
        action: msg.action,
        itemId: msg.itemId,
        qty: msg.qty,
        slotIndex: msg.slotIndex,
        invIndex: msg.invIndex,
      });
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastTileSnapshot(live, msg.tx, msg.ty);
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'cast_fishing') {
      const res = store.handleCastFishing(live, account, msg.tx, msg.ty, msg.rodItemId);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      broadcastWorld(live.state.name, {
        type: 'fishing_started',
        cast: {
          playerId: res.cast.playerId,
          playerName: res.cast.playerName,
          bobberTx: res.cast.bobberTx,
          bobberTy: res.cast.bobberTy,
          fluidType: res.cast.fluidType,
          depthTier: res.cast.depthTier,
          biting: false,
          startedAt: res.cast.startedAt,
        },
      });
      return { ok: true };
    }

    if (msg.type === 'reel_fishing') {
      const res = store.handleReelFishing(live, account);
      if (!res.ok) {
        sendTo(ws, { type: 'world_error', message: res.message });
        return { ok: false, errorMessage: res.message };
      }
      if (!res.finished) {
        const activeCast = live.activeCasts.get(account.id);
        broadcastWorld(live.state.name, {
          type: 'fishing_progress',
          playerId: account.id,
          progress: res.progress,
          lineTension: activeCast?.lineTension ?? 0.5,
          bobberOffset: activeCast?.bobberOffset ?? 0,
          fightPattern: activeCast?.fightPattern ?? 'darting',
        });
        return { ok: true };
      }
      broadcastWorld(live.state.name, {
        type: 'fishing_ended',
        playerId: account.id,
        caughtItemId: res.caughtItemId,
        caughtName: res.caughtName,
        depthTier: res.depthTier,
      });
      sendProfileUpdate(ws, account, res.notice);
      return { ok: true };
    }

    if (msg.type === 'chat') {
      const chatMsg = store.handleChat(live, account, msg.text);
      if (chatMsg) {
        broadcastWorld(live.state.name, { type: 'chat_message', message: chatMsg });
        return { ok: true };
      }
      return { ok: false, errorMessage: 'Invalid or empty chat message.' };
    }

    return { ok: false, errorMessage: 'Unsupported action.' };
  }

  wss.on('connection', (ws) => {
    const session: ClientSession = {
      ws,
      account: null,
      worldName: null,
      lastSeenAt: Date.now(),
      wsToken: null,
      wsSessionId: null,
      authToken: null,
      sessionExpiresAt: null,
    };
    sessions.add(session);

    ws.on('pong', () => {
      session.lastSeenAt = Date.now();
    });

    ws.on('message', (raw) => {
      session.lastSeenAt = Date.now();
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        return;
      }

      if (msg.type === 'hello') {
        const rawToken = typeof msg.token === 'string' ? msg.token.trim() : '';
        if (!rawToken) {
          sendTo(ws, { type: 'auth_error', message: 'Authentication token required.' });
          try {
            ws.close(4001, 'Unauthorized');
          } catch {
            // ignore
          }
          return;
        }
        let account: PlayerAccount | null = null;
        let resolvedAuthToken: string | null = null;
        const existingWsSession = validateWsSessionToken(rawToken);
        if (existingWsSession) {
          account = existingWsSession.account;
          resolvedAuthToken = existingWsSession.record.authToken;
        } else {
          const storeAccount = store.getAccountByToken(rawToken);
          if (storeAccount) {
            account = storeAccount;
            resolvedAuthToken = rawToken;
          }
        }
        if (!account || !resolvedAuthToken) {
          sendTo(ws, { type: 'auth_error', message: 'Session expired. Please log in again.' });
          try {
            ws.close(4001, 'Unauthorized');
          } catch {
            // ignore
          }
          return;
        }
        if (session.wsSessionId) {
          activeWsSessions.delete(session.wsSessionId);
        }
        const issued = issueWsSessionToken(account.id, resolvedAuthToken);
        session.account = account;
        session.wsToken = issued.wsToken;
        session.wsSessionId = issued.record.sessionId;
        session.authToken = resolvedAuthToken;
        session.sessionExpiresAt = issued.record.expiresAt;

        sendTo(ws, {
          type: 'welcome',
          playerId: account.id,
          playerName: account.name,
          email: account.email,
          role: account.role,
          gems: account.gems,
          alterbits: account.alterbits ?? 0,
          pixobytes: account.pixobytes ?? 0,
          xp: account.xp,
          level: account.level,
          cropMasteryXp: account.cropMasteryXp ?? 0,
          cropMasteryLevel: account.cropMasteryLevel ?? 1,
          farmablockMasteryXp: account.farmablockMasteryXp ?? 0,
          farmablockMasteryLevel: account.farmablockMasteryLevel ?? 1,
          inventory: account.inventory,
          equipped: account.equipped,
          stats: account.stats,
          claimedAchievements: account.claimedAchievements,
          friends: store.getFriendEntries(account),
          incomingRequests: account.incomingRequests,
          favoriteWorlds: account.favoriteWorlds,
          recentWorlds: account.recentWorlds,
          activeBuffs: store.pruneAndGetBuffs(account),
          unclaimedWl: account.unclaimedWl ?? 0,
          hasClaimedStarterLootbox: Boolean(account.hasClaimedStarterLootbox),
          gameConfig: store.getGameConfig(),
          exchange: store.getExchangeSnapshot(),
          sessionToken: issued.wsToken,
        });
        return;
      }

      if (msg.type === 'ping') {
        const currentWorld = session.worldName ? store.getExistingWorld(session.worldName) : null;
        const validated = session.wsToken ? validateWsSessionToken(session.wsToken) : null;
        const tokenMatchesIfProvided =
          typeof msg.sessionToken !== 'string' ||
          (Boolean(session.wsToken) && timingSafeEqualStr(msg.sessionToken, session.wsToken!));
        const isAuthenticated = Boolean(validated && session.account && tokenMatchesIfProvided);
        if (!isAuthenticated && session.wsToken) {
          clearSessionAuth(session);
        }
        sendTo(ws, {
          type: 'pong',
          clientTime: msg.clientTime,
          serverTime: Date.now(),
          worldName: session.worldName,
          worldRevision: currentWorld?.state.revision ?? null,
          playerCount: currentWorld?.players.size ?? undefined,
          authenticated: isAuthenticated,
          sessionExpiresAt: isAuthenticated && validated ? validated.record.expiresAt : null,
        });
        return;
      }

      const validatedSession = session.wsToken ? validateWsSessionToken(session.wsToken) : null;
      const providedSessionToken = typeof msg.sessionToken === 'string' ? msg.sessionToken : '';
      if (
        !validatedSession ||
        !session.account ||
        validatedSession.account.id !== session.account.id ||
        !providedSessionToken ||
        !session.wsToken ||
        !timingSafeEqualStr(providedSessionToken, session.wsToken)
      ) {
        clearSessionAuth(session);
        sendTo(ws, {
          type: 'auth_error',
          message: 'Session token missing, invalid, or expired. Please reconnect.',
        });
        if (typeof msg.ackId === 'string' && msg.ackId.length > 0) {
          sendTo(ws, {
            type: 'action_ack',
            ackId: msg.ackId,
            actionType: msg.type,
            ok: false,
            serverTime: Date.now(),
            worldName: session.worldName,
            worldRevision: null,
            errorMessage: 'Session token missing, invalid, or expired.',
          });
        }
        try {
          ws.close(4001, 'Unauthorized');
        } catch {
          // ignore
        }
        return;
      }

      session.account = validatedSession.account;
      const outcome = processAuthenticatedClientAction(session, ws, validatedSession.account, msg);
      if (typeof msg.ackId === 'string' && msg.ackId.length > 0) {
        const currentWorld = session.worldName ? store.getExistingWorld(session.worldName) : null;
        sendTo(ws, {
          type: 'action_ack',
          ackId: msg.ackId,
          actionType: msg.type,
          ok: outcome.ok,
          serverTime: Date.now(),
          worldName: session.worldName,
          worldRevision: currentWorld?.state.revision ?? null,
          ...(outcome.pose ? { pose: outcome.pose } : {}),
          ...(outcome.errorMessage ? { errorMessage: outcome.errorMessage } : {}),
        });
      }
    });

    ws.on('close', () => {
      clearSessionAuth(session);
      leaveCurrentWorld(session, false);
      sessions.delete(session);
    });
  });

  // Authoritative 250ms simulation tick: fluid CA, fishing bites/timeouts, furnace completion & mine timers
  const simTickTimer = setInterval(() => {
    const now = Date.now();
    const tick = store.tickAllWorlds(now);
    for (const fu of tick.fluidUpdates) {
      broadcastWorld(fu.worldName, { type: 'fluid_delta', deltas: fu.deltas });
    }
    for (const fb of tick.fishingBites) {
      const message: ServerMessage = {
        type: 'fishing_bite',
        playerId: fb.cast.playerId,
        bobberTx: fb.cast.bobberTx,
        bobberTy: fb.cast.bobberTy,
        depthTier: fb.cast.depthTier,
      };
      broadcastWorld(fb.worldName, message);
    }
    for (const fs of tick.fishingStates) {
      const message: ServerMessage = {
        type: 'fishing_progress',
        playerId: fs.cast.playerId,
        progress: Math.round(fs.cast.pullProgress),
        lineTension: fs.cast.lineTension,
        bobberOffset: fs.cast.bobberOffset,
        fightPattern: fs.cast.fightPattern ?? 'darting',
      };
      broadcastWorld(fs.worldName, message);
    }
    for (const ft of tick.fishingTimeouts) {
      const message: ServerMessage = { type: 'fishing_ended', playerId: ft.playerId };
      broadcastWorld(ft.worldName, message);
    }
    for (const cf of tick.completedFurnaces) {
      const lw = store.getExistingWorld(cf.worldName);
      if (lw) broadcastTileSnapshot(lw, cf.tx, cf.ty);
    }
    for (const ce of tick.completedEngines) {
      const lw = store.getExistingWorld(ce.worldName);
      if (lw) broadcastTileSnapshot(lw, ce.tx, ce.ty);
    }
    for (const em of tick.expiredMines) {
      for (const s of sessions) {
        if (s.worldName === em.worldName && s.account) {
          s.worldName = null;
          sendTo(s.ws, {
            type: 'mine_shaft_expired',
            worldName: em.worldName,
            message: `Mining Shaft ${em.worldName} collapsed! Returning to START.`,
          });
          enterWorldSession(s, s.ws, s.account, 'START', undefined, true);
        }
      }
    }
  }, 250);
  simTickTimer.unref();

  // Authoritative 2500ms BFG Auto-Collector tick
  const bfgTickTimer = setInterval(() => {
    const updates = store.tickBfgCollectors(Date.now());
    for (const u of updates) {
      const lw = store.getExistingWorld(u.worldName);
      if (!lw) continue;
      for (const t of u.harvestedTiles) broadcastTileSnapshot(lw, t.tx, t.ty);
      for (const t of u.collectorTiles) broadcastTileSnapshot(lw, t.tx, t.ty);
      for (const dropId of u.removedDropIds) {
        broadcastWorld(u.worldName, { type: 'drop_removed', dropId });
      }
    }
  }, 2500);
  bfgTickTimer.unref();

  // Authoritative 3000ms Live Presence Sync, Dirty-World Disk Flush & Socket Liveness Sweep
  const presenceSyncTimer = setInterval(() => {
    store.flushDirtyWorlds();
    const now = Date.now();
    const activeWorlds = new Set<string>();

    for (const s of Array.from(sessions)) {
      if (s.ws.readyState !== WebSocket.OPEN) {
        clearSessionAuth(s);
        leaveCurrentWorld(s, false);
        sessions.delete(s);
        continue;
      }
      if (now - s.lastSeenAt > 32000) {
        try {
          s.ws.terminate();
        } catch {
          // ignore
        }
        clearSessionAuth(s);
        leaveCurrentWorld(s, false);
        sessions.delete(s);
        continue;
      }
      try {
        s.ws.ping();
      } catch {
        // ignore
      }
      if (s.worldName) {
        activeWorlds.add(s.worldName);
      }
    }

    for (const wName of activeWorlds) {
      const lw = store.getExistingWorld(wName);
      if (!lw || lw.players.size === 0) continue;
      broadcastWorld(wName, {
        type: 'presence_sync',
        worldName: wName,
        players: Array.from(lw.players.values()),
        drops: Array.from(lw.drops.values()),
        revision: lw.state.revision,
      });
    }
  }, 3000);
  presenceSyncTimer.unref();

  const flushOnExit = () => {
    try {
      store.flushDirtyWorlds();
    } catch {
      // ignore
    }
  };
  process.once('SIGINT', flushOnExit);
  process.once('SIGTERM', flushOnExit);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, message: 'API route not found.' });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const assetsDir = path.join(distDir, 'assets');
    const indexHtmlPath = path.join(distDir, 'index.html');

    const applyNoStoreHeaders = (res: express.Response) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    };

    app.use(
      '/assets',
      express.static(assetsDir, {
        maxAge: '1y',
        immutable: true,
        fallthrough: false,
      })
    );
    app.use('/assets', (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err) {
        applyNoStoreHeaders(res);
        res.status(404).type('text/plain').send('Asset not found');
        return;
      }
      next();
    });

    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            applyNoStoreHeaders(res);
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      applyNoStoreHeaders(res);
      res.sendFile(indexHtmlPath);
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Blockgrove authoritative server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
