import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthoritativeWorldStore, type LiveWorld, type PlayerAccount } from './server/worldStore.ts';
import type { ClientMessage, ServerMessage } from './src/game/network.ts';
import { tileIndex } from './src/game/rules.ts';

interface ClientSession {
  ws: WebSocket;
  account: PlayerAccount | null;
  worldName: string | null;
}

const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  const store = new AuthoritativeWorldStore();

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

  function broadcastWorld(worldName: string, msg: ServerMessage, excludeWs?: WebSocket) {
    const payload = JSON.stringify(msg);
    for (const s of sessions) {
      if (s.worldName === worldName && s.ws !== excludeWs && s.ws.readyState === WebSocket.OPEN) {
        s.ws.send(payload);
      }
    }
  }

  function broadcastTileSnapshot(live: LiveWorld, tx: number, ty: number) {
    const idx = tileIndex(tx, ty);
    const key = `${tx},${ty}`;
    broadcastWorld(live.state.name, {
      type: 'tile_updated',
      tx,
      ty,
      fg: live.state.fg[idx],
      bg: live.state.bg[idx],
      plant: live.state.plants[key] ?? null,
      worldLock: live.state.worldLock,
      areaLock: live.state.areaLocks?.[key] ?? null,
      vendingMachine: live.state.vendingMachines?.[key] ?? null,
      signText: live.state.signs?.[key] ?? null,
      revision: live.state.revision,
    });
  }

  function leaveCurrentWorld(session: ClientSession) {
    if (!session.account || !session.worldName) return;
    const prevWorld = session.worldName;
    store.leaveWorld(prevWorld, session.account.id);
    session.worldName = null;
    broadcastWorld(prevWorld, { type: 'player_left', playerId: session.account.id });
  }

  wss.on('connection', (ws) => {
    const session: ClientSession = { ws, account: null, worldName: null };
    sessions.add(session);

    ws.on('message', (raw) => {
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
          gameConfig: store.getGameConfig(),
        });
        return;
      }

      if (!session.account) return;
      const account = session.account;

      if (msg.type === 'list_worlds') {
        sendTo(ws, { type: 'worlds_list', worlds: store.listWorlds() });
        return;
      }

      if (msg.type === 'leave_world') {
        leaveCurrentWorld(session);
        return;
      }

      if (msg.type === 'join_world') {
        leaveCurrentWorld(session);
        const res = store.joinWorld(account, msg.worldName);
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
        });
        sendProfileUpdate(ws, account);
        broadcastWorld(
          res.world.state.name,
          { type: 'player_joined', player: res.remote },
          ws
        );
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
        remote.x = Math.max(0, Math.min(99 * 32, msg.x));
        remote.y = Math.max(0, Math.min(59 * 32, msg.y));
        remote.vx = msg.vx;
        remote.vy = msg.vy;
        remote.facing = msg.facing;
        remote.grounded = msg.grounded;
        remote.punching = msg.punching;
        remote.equipped = account.equipped;
        broadcastWorld(live.state.name, { type: 'player_moved', player: remote }, ws);
        return;
      }

      if (msg.type === 'punch_tile') {
        const res = store.handlePunchTile(live, account, msg.tx, msg.ty);
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
            layer: res.layer,
          });
        } else {
          broadcastTileSnapshot(live, msg.tx, msg.ty);
          for (const d of res.drops) {
            broadcastWorld(live.state.name, { type: 'drop_spawned', drop: d });
          }
          sendProfileUpdate(ws, account);
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

      if (msg.type === 'chat') {
        const chatMsg = store.handleChat(live, account, msg.text);
        if (chatMsg) {
          broadcastWorld(live.state.name, { type: 'chat_message', message: chatMsg });
        }
      }
    });

    ws.on('close', () => {
      leaveCurrentWorld(session);
      sessions.delete(session);
    });
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
