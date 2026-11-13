import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthoritativeWorldStore, type LiveWorld, type PlayerAccount } from './server/worldStore.ts';
import { DungeonStore } from './server/dungeonStore.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import type { ClientMessage, ResumePosition, ServerMessage } from './src/game/network.ts';
import { TILE_SIZE } from './src/game/constants.ts';
import { addXp, tileIndexIn, worldHeight, worldWidth } from './src/game/rules.ts';

interface ClientSession {
  ws: WebSocket;
  account: PlayerAccount | null;
  worldName: string | null;
  lastSeenAt: number;
}

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  const store = new AuthoritativeWorldStore();
  const dungeonStore = new DungeonStore(store);

  function extractBearerToken(req: express.Request): string | undefined {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7).trim();
    }
    return undefined;
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, worlds: store.listWorlds().length });
  });

  app.get('/api/worlds', (_req, res) => {
    res.json({ worlds: store.listWorlds() });
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

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    store.logoutToken(token);
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const sessions = new Set<ClientSession>();

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

  function sendProfileUpdate(ws: WebSocket, account: PlayerAccount, notice?: string) {
    sendTo(ws, {
      type: 'profile_updated',
      gems: account.gems,
      xp: account.xp,
      level: account.level,
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
      notice,
    });
  }

  function sendProfileToPlayerId(playerId: string, notice?: string) {
    for (const s of sessions) {
      if (s.account && s.account.id === playerId) {
        sendProfileUpdate(s.ws, s.account, notice);
      }
    }
  }

  function broadcastDungeon(snapshot: import('./src/game/dungeon.ts').DungeonSnapshot, playerIds: string[]) {
    const payload: ServerMessage = { type: 'dungeon_state', snapshot };
    for (const session of sessions) {
      if (session.account && playerIds.includes(session.account.id)) sendTo(session.ws, payload);
    }
  }

  function applyDungeonRewards(rewards: import('./src/game/dungeon.ts').DungeonReward[]) {
    for (const reward of rewards) {
      const account = dungeonStore.getAccountRef(reward.playerId);
      if (!account) continue;
      const progress = addXp(account.level, account.xp, reward.xp);
      account.level = progress.level;
      account.xp = progress.xp;
      for (const item of reward.items) store.addInventory(account, item.itemId, item.qty);
      store.savePlayer(account);
      sendProfileToPlayerId(account.id, 'Dungeon cleared! +' + reward.xp + ' XP and expedition materials secured.');
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
      vendingMachine: live.state.vendingMachines?.[key] ?? null,
      furnace: live.state.furnaces?.[key] ?? null,
      bfgCollector: live.state.bfgCollectors?.[key] ?? null,
      signText: live.state.signs?.[key] ?? null,
      revision: live.state.revision,
    });
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
  ) {
    if (session.worldName && session.worldName !== targetWorldName.trim().toUpperCase()) {
      leaveCurrentWorld(session, explicitLeavePrev);
    }
    const res = store.joinWorld(account, targetWorldName, resumePosition);
    if (!res.ok) {
      sendTo(ws, { type: 'world_error', message: res.message });
      return;
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
  }

  wss.on('connection', (ws) => {
    const session: ClientSession = {
      ws,
      account: null,
      worldName: null,
      lastSeenAt: Date.now(),
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
        let account: PlayerAccount | null = null;
        if (msg.token) {
          account = store.getAccountByToken(msg.token);
          if (!account) {
            sendTo(ws, { type: 'auth_error', message: 'Session expired. Please log in again.' });
            return;
          }
        } else if (msg.playerId) {
          account = store.getOrCreatePlayer(msg.playerId, msg.playerName ?? 'Explorer');
        } else {
          sendTo(ws, { type: 'auth_error', message: 'Authentication required.' });
          return;
        }
        session.account = account;
        sendTo(ws, {
          type: 'welcome',
          playerId: account.id,
          playerName: account.name,
          email: account.email,
          role: account.role,
          gems: account.gems,
          xp: account.xp,
          level: account.level,
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
          gameConfig: store.getGameConfig(),
          exchange: store.getExchangeSnapshot(),
        });
        return;
      }

      if (msg.type === 'ping') {
        const currentWorld = session.worldName ? store.getExistingWorld(session.worldName) : null;
        sendTo(ws, {
          type: 'pong',
          clientTime: msg.clientTime,
          serverTime: Date.now(),
          worldName: session.worldName,
          worldRevision: currentWorld?.state.revision ?? null,
          playerCount: currentWorld?.players.size ?? undefined,
        });
        return;
      }

      if (!session.account) return;
      const account = session.account;

      if (msg.type === 'dungeon_buy_key') {
        if (session.worldName !== 'STATION') {
          sendTo(ws, { type: 'dungeon_error', message: 'Visit the STATION world and speak with the Station Commander to purchase Gate Keys.' });
          return;
        }
        const result = dungeonStore.buyGateKey(account, msg.tier, msg.payment, msg.txId);
        if (!result.ok) {
          sendTo(ws, { type: 'dungeon_error', message: result.message ?? 'Could not purchase Gate Key.' });
          return;
        }
        sendProfileUpdate(ws, account, result.message);
        return;
      }

      if (msg.type === 'dungeon_create') {
        if (session.worldName !== 'STATION') {
          sendTo(ws, { type: 'dungeon_error', message: 'Dungeon gates can only be activated from STATION.' });
          return;
        }
        const result = dungeonStore.createRun(account, msg.tier);
        if (!result.ok || !result.snapshot) {
          sendTo(ws, { type: 'dungeon_error', message: result.message ?? 'Could not create dungeon.' });
          return;
        }
        sendProfileUpdate(ws, account, result.message);
        broadcastDungeon(result.snapshot, dungeonStore.getParticipantIds(result.snapshot.runId));
        return;
      }

      if (msg.type === 'dungeon_join') {
        if (session.worldName !== 'STATION') {
          sendTo(ws, { type: 'dungeon_error', message: 'Return to STATION before joining a dungeon party.' });
          return;
        }
        const result = dungeonStore.joinRun(account, msg.code);
        if (!result.ok || !result.snapshot) {
          sendTo(ws, { type: 'dungeon_error', message: result.message ?? 'Could not join dungeon.' });
          return;
        }
        broadcastDungeon(result.snapshot, dungeonStore.getParticipantIds(result.snapshot.runId));
        return;
      }

      if (msg.type === 'dungeon_resume') {
        if (session.worldName !== 'STATION') return;
        const result = dungeonStore.resume(account);
        if (result.ok && result.snapshot) {
          broadcastDungeon(result.snapshot, [account.id]);
          broadcastDungeon(result.snapshot, dungeonStore.getParticipantIds(result.snapshot.runId).filter((id) => id !== account.id));
        }
        return;
      }

      if (msg.type === 'dungeon_action') {
        if (session.worldName !== 'STATION') {
          sendTo(ws, { type: 'dungeon_error', message: 'Dungeon controls are only available while stationed at STATION.' });
          return;
        }
        const result = dungeonStore.act(account, msg.action, msg.dx ?? 0, msg.dy ?? 0);
        if (!result.ok) {
          sendTo(ws, { type: 'dungeon_error', message: result.message ?? 'Dungeon action failed.' });
          return;
        }
        if (result.rewards) applyDungeonRewards(result.rewards);
        if (result.snapshot && result.affectedPlayerIds?.length) {
          broadcastDungeon(result.snapshot, result.affectedPlayerIds);
        } else if (msg.action === 'leave') {
          sendTo(ws, { type: 'dungeon_error', message: 'You left the expedition.' });
        }
        return;
      }

      if (msg.type === 'list_worlds') {
        sendTo(ws, { type: 'worlds_list', worlds: store.listWorlds() });
        return;
      }

      if (msg.type === 'leave_world') {
        leaveCurrentWorld(session, true);
        return;
      }

      if (msg.type === 'join_world') {
        enterWorldSession(session, ws, account, msg.worldName, msg.resumePosition, false);
        return;
      }

      if (msg.type === 'upgrade_fishing_rod') {
        const res = store.handleUpgradeFishingRod(account, msg.rodInstanceId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'use_consumable') {
        const res = store.handleUseConsumable(account, msg.itemId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        if (res.kind === 'mine_scroll' && res.mineWorldName) {
          enterWorldSession(session, ws, account, res.mineWorldName, undefined, true);
          sendProfileUpdate(ws, account, res.notice);
        } else {
          sendProfileUpdate(ws, account, res.notice);
        }
        return;
      }

      if (msg.type === 'exit_mine_shaft') {
        enterWorldSession(session, ws, account, 'START', undefined, true);
        return;
      }

      if (msg.type === 'exchange_action') {
        if (msg.action === 'list') {
          sendTo(ws, { type: 'exchange_updated', exchange: store.getExchangeSnapshot() });
          return;
        }
        const res = store.handleExchangeAction(account, msg);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, res.notice);
        broadcastAll({ type: 'exchange_updated', exchange: store.getExchangeSnapshot() });
        if (res.sellerIdToNotify) {
          sendProfileToPlayerId(res.sellerIdToNotify, 'Global Exchange sale! Claim WL in your Vault.');
        }
        return;
      }

      if (msg.type === 'splice_seeds') {
        const res = store.handleSplice(account, msg.seedA, msg.seedB);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, `Spliced ${res.resultName}!`);
        return;
      }

      if (msg.type === 'buy_gem_store') {
        const res = store.handleBuyGemStore(account, msg.listingId, msg.txId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'equip_wearable') {
        const res = store.handleEquipWearable(account, msg.itemId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
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
        return;
      }

      if (msg.type === 'friend_action') {
        const res = store.handleFriendAction(account, msg.action, msg.targetNameOrId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, res.notice);
        if (res.targetAccount) {
          sendProfileToPlayerId(res.targetAccount.id, `Friend update from ${account.name}`);
        }
        return;
      }

      if (msg.type === 'claim_achievement') {
        const res = store.handleClaimAchievement(account, msg.achievementId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'toggle_favorite_world') {
        const notice = store.handleToggleFavoriteWorld(account, msg.worldName);
        sendProfileUpdate(ws, account, notice);
        return;
      }

      if (msg.type === 'update_game_config') {
        const res = store.updateGameConfig(account, msg.config);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastAll({
          type: 'config_updated',
          gameConfig: res.gameConfig,
          notice: `Game configuration updated by ${account.name}.`,
        });
        return;
      }

      if (msg.type === 'admin_action') {
        const liveForAction = session.worldName ? store.getOrCreateWorld(session.worldName) : null;
        const res = store.handleAdminAction(account, liveForAction, {
          action: msg.action,
          itemId: msg.itemId,
          qty: msg.qty,
          gems: msg.gems,
        });
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
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
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (!session.worldName) return;
      const live: LiveWorld = store.getOrCreateWorld(session.worldName);
      const remote = live.players.get(account.id);
      if (!remote) return;

      if (msg.type === 'move') {
        const maxPxX = (worldWidth(live.state) - 1) * TILE_SIZE;
        const maxPxY = (worldHeight(live.state) - 1) * TILE_SIZE;
        remote.x = Math.max(0, Math.min(maxPxX, msg.x));
        remote.y = Math.max(0, Math.min(maxPxY, msg.y));
        remote.vx = msg.vx;
        remote.vy = msg.vy;
        remote.facing = msg.facing;
        remote.grounded = msg.grounded;
        remote.punching = msg.punching;
        remote.placing = Boolean(msg.placing);
        remote.equipped = account.equipped;
        store.recordPlayerPose(live.state.name, account.id, {
          x: remote.x,
          y: remote.y,
          vx: remote.vx,
          vy: remote.vy,
          facing: remote.facing,
          grounded: remote.grounded,
        });
        broadcastWorld(live.state.name, { type: 'player_moved', player: remote }, ws);
        return;
      }

      if (msg.type === 'punch_tile') {
        const res = store.handlePunchTile(live, account, msg.tx, msg.ty, msg.toolItemId);
        if (!res.ok) {
          if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
          return;
        }
        if (!res.broken) {
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
          sendProfileUpdate(ws, account, res.notice);
        }
        return;
      }

      if (msg.type === 'place_tile') {
        const res = store.handlePlaceTile(live, account, msg.itemId, msg.tx, msg.ty);
        if (!res.ok) {
          if (res.reason) sendTo(ws, { type: 'world_error', message: res.reason });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'configure_lock') {
        const res = store.handleConfigureLock(live, account, msg.tx, msg.ty, {
          publicAccess: msg.publicAccess,
          addEditorName: msg.addEditorName,
          removeEditorId: msg.removeEditorId,
        });
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
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
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'buy_vending') {
        const res = store.handleBuyVending(live, account, msg.tx, msg.ty, msg.units, msg.txId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'configure_sign') {
        const res = store.handleConfigureSign(live, account, msg.tx, msg.ty, msg.text);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'pickup_drop') {
        const res = store.handlePickupDrop(live, account, msg.dropId);
        if (!res.ok) return;
        broadcastWorld(live.state.name, { type: 'drop_removed', dropId: res.drop.id });
        sendProfileUpdate(ws, account);
        return;
      }

      if (msg.type === 'configure_furnace') {
        const res = store.handleConfigureFurnace(live, account, msg.tx, msg.ty, {
          action: msg.action,
          recipeId: msg.recipeId,
          toolItemId: msg.toolItemId,
        });
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'configure_bfg') {
        const res = store.handleConfigureBfg(live, account, msg.tx, msg.ty, {
          action: msg.action,
        });
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
        }
        broadcastTileSnapshot(live, msg.tx, msg.ty);
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'cast_fishing') {
        const res = store.handleCastFishing(live, account, msg.tx, msg.ty, msg.rodItemId);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
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
        return;
      }

      if (msg.type === 'reel_fishing') {
        const res = store.handleReelFishing(live, account);
        if (!res.ok) {
          sendTo(ws, { type: 'world_error', message: res.message });
          return;
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
          return;
        }
        broadcastWorld(live.state.name, {
          type: 'fishing_ended',
          playerId: account.id,
          caughtItemId: res.caughtItemId,
          caughtName: res.caughtName,
          depthTier: res.depthTier,
        });
        sendProfileUpdate(ws, account, res.notice);
        return;
      }

      if (msg.type === 'chat') {
        const chatMsg = store.handleChat(live, account, msg.text);
        if (chatMsg) {
          broadcastWorld(live.state.name, { type: 'chat_message', message: chatMsg });
        }
      }
    });

    ws.on('close', () => {
      const playerId = session.account?.id;
      const hasOtherSession = playerId
        ? [...sessions].some((other) => other !== session && other.account?.id === playerId && other.ws.readyState === WebSocket.OPEN)
        : false;
      if (playerId && !hasOtherSession) dungeonStore.disconnect(playerId);
      leaveCurrentWorld(session, false);
      sessions.delete(session);
    });
  });

  // Authoritative 250ms simulation tick: fluid CA, fishing bites/timeouts, furnace completion & mine timers
  const simTickTimer = setInterval(() => {
    const now = Date.now();
    const tick = store.tickAllWorlds(now);
    for (const snapshot of dungeonStore.tick(now)) {
      broadcastDungeon(snapshot, dungeonStore.getParticipantIds(snapshot.runId));
    }
    for (const fu of tick.fluidUpdates) {
      broadcastWorld(fu.worldName, { type: 'fluid_delta', deltas: fu.deltas });
    }
    for (const fb of tick.fishingBites) {
      broadcastWorld(fb.worldName, {
        type: 'fishing_bite',
        playerId: fb.cast.playerId,
        bobberTx: fb.cast.bobberTx,
        bobberTy: fb.cast.bobberTy,
        depthTier: fb.cast.depthTier,
      });
    }
    for (const fs of tick.fishingStates) {
      broadcastWorld(fs.worldName, {
        type: 'fishing_progress',
        playerId: fs.cast.playerId,
        progress: Math.round(fs.cast.pullProgress),
        lineTension: fs.cast.lineTension,
        bobberOffset: fs.cast.bobberOffset,
        fightPattern: fs.cast.fightPattern ?? 'darting',
      });
    }
    for (const ft of tick.fishingTimeouts) {
      broadcastWorld(ft.worldName, { type: 'fishing_ended', playerId: ft.playerId });
    }
    for (const cf of tick.completedFurnaces) {
      const lw = store.getExistingWorld(cf.worldName);
      if (lw) broadcastTileSnapshot(lw, cf.tx, cf.ty);
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

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
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
