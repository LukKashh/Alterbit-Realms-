import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { WebSocket } from 'ws';
import { GameSocketClient, type ClientMessage, type ServerMessage } from '../src/game/network.ts';

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close(() => reject(new Error('Failed to resolve free port')));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseHttp: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseHttp}/api/health`);
      if (res.ok) return;
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Timed out waiting for test server health');
}

function connectWs(baseWs: string): Promise<{
  ws: WebSocket;
  nextMessage: (predicate?: (m: ServerMessage) => boolean, timeoutMs?: number) => Promise<ServerMessage>;
  waitForClose: (timeoutMs?: number) => Promise<{ code: number; reason: string }>;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(baseWs);
    const queue: ServerMessage[] = [];
    const waiters: Array<{
      predicate?: (m: ServerMessage) => boolean;
      resolve: (m: ServerMessage) => void;
      reject: (e: Error) => void;
      timer: NodeJS.Timeout;
    }> = [];

    let closedInfo: { code: number; reason: string } | null = null;
    const closeWaiters: Array<(info: { code: number; reason: string }) => void> = [];

    ws.on('message', (raw) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(raw.toString()) as ServerMessage;
      } catch {
        return;
      }
      const idx = waiters.findIndex((w) => !w.predicate || w.predicate(parsed));
      if (idx >= 0) {
        const [waiter] = waiters.splice(idx, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(parsed);
      } else {
        queue.push(parsed);
      }
    });

    ws.on('close', (code, reasonBuf) => {
      closedInfo = { code, reason: reasonBuf.toString() };
      while (closeWaiters.length > 0) {
        closeWaiters.shift()!(closedInfo);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        nextMessage(predicate, timeoutMs = 4000) {
          const idx = queue.findIndex((m) => !predicate || predicate(m));
          if (idx >= 0) {
            return Promise.resolve(queue.splice(idx, 1)[0]);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const wIdx = waiters.findIndex((w) => w.resolve === res);
              if (wIdx >= 0) waiters.splice(wIdx, 1);
              rej(new Error('Timed out waiting for WebSocket message'));
            }, timeoutMs);
            waiters.push({ predicate, resolve: res, reject: rej, timer });
          });
        },
        waitForClose(timeoutMs = 4000) {
          if (closedInfo) return Promise.resolve(closedInfo);
          return new Promise((res, rej) => {
            const timer = setTimeout(() => rej(new Error('Timed out waiting for WS close')), timeoutMs);
            closeWaiters.push((info) => {
              clearTimeout(timer);
              res(info);
            });
          });
        },
      });
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

test('Server WebSocket enforces hardened session tokens, removes playerId bypass, and emits action_ack', async (t) => {
  const testPort = await getFreePort();
  const BASE_HTTP = `http://127.0.0.1:${testPort}`;
  const BASE_WS = `ws://127.0.0.1:${testPort}/ws`;

  const proc: ChildProcess = spawn('./node_modules/.bin/tsx', ['server.ts'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(testPort),
      WS_SESSION_SECRET: 'test-ws-secret-hardening-0123456789abcdef',
    },
    stdio: 'ignore',
  });

  t.after(() => {
    if (proc.pid) {
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        // ignore already exited
      }
    }
  });

  await waitForHealth(BASE_HTTP);

  // 1. Register a test user via HTTP
  const suffix = Math.random().toString(36).slice(2, 8);
  const regRes = await fetch(`${BASE_HTTP}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `ws_hard_${suffix}@example.com`,
      username: `WsHard_${suffix}`,
      password: 'password123',
    }),
  });
  assert.equal(regRes.status, 200);
  const regJson = (await regRes.json()) as { ok: boolean; token: string };
  assert.equal(regJson.ok, true);
  const authToken = regJson.token;
  assert.ok(authToken.length > 0);

  // 2. Legacy client-provided playerId hello without token must be rejected
  {
    const conn = await connectWs(BASE_WS);
    conn.ws.send(JSON.stringify({ type: 'hello', playerId: 'spoofed_admin', playerName: 'Spoofer' }));
    const errMsg = await conn.nextMessage((m) => m.type === 'auth_error');
    assert.equal(errMsg.type, 'auth_error');
    const closeInfo = await conn.waitForClose();
    assert.equal(closeInfo.code, 4001);
  }

  // 3. Invalid/tampered token must be rejected
  {
    const conn = await connectWs(BASE_WS);
    conn.ws.send(JSON.stringify({ type: 'hello', token: 'bgws.fake.signature' }));
    const errMsg = await conn.nextMessage((m) => m.type === 'auth_error');
    assert.equal(errMsg.type, 'auth_error');
    const closeInfo = await conn.waitForClose();
    assert.equal(closeInfo.code, 4001);
  }

  // 4. Valid hello issues bgws.* sessionToken, validates sessionToken on actions, and emits action_ack
  {
    const conn = await connectWs(BASE_WS);
    conn.ws.send(JSON.stringify({ type: 'hello', token: authToken }));
    const welcome = await conn.nextMessage((m) => m.type === 'welcome');
    assert.equal(welcome.type, 'welcome');
    assert.ok(welcome.sessionToken?.startsWith('bgws.'), 'Server must issue bgws.* session token');
    const sessionToken = welcome.sessionToken!;

    // Ping reflects authenticated status and expiration
    conn.ws.send(JSON.stringify({ type: 'ping', clientTime: 12345, sessionToken }));
    const pong = await conn.nextMessage((m) => m.type === 'pong');
    assert.equal(pong.type, 'pong');
    assert.equal(pong.authenticated, true);
    assert.ok(typeof pong.sessionExpiresAt === 'number' && pong.sessionExpiresAt > Date.now());

    // Action with valid sessionToken + ackId emits action_ack
    const joinAckId = 'ack_join_1';
    conn.ws.send(
      JSON.stringify({
        type: 'join_world',
        worldName: 'NEXUS',
        ackId: joinAckId,
        sessionToken,
      })
    );
    const joined = await conn.nextMessage((m) => m.type === 'world_joined');
    assert.equal(joined.type, 'world_joined');
    const joinAck = await conn.nextMessage((m) => m.type === 'action_ack' && m.ackId === joinAckId);
    assert.equal(joinAck.type, 'action_ack');
    assert.equal(joinAck.ok, true);
    assert.equal(joinAck.actionType, 'join_world');
    assert.equal(joinAck.worldName, 'NEXUS');
    assert.equal(typeof joinAck.worldRevision, 'number');

    // Move action emits action_ack with authoritative pose
    const moveAckId = 'ack_move_1';
    conn.ws.send(
      JSON.stringify({
        type: 'move',
        x: 320,
        y: 320,
        vx: 0,
        vy: 0,
        facing: 1,
        grounded: true,
        punching: false,
        ackId: moveAckId,
        sessionToken,
      })
    );
    const moveAck = await conn.nextMessage((m) => m.type === 'action_ack' && m.ackId === moveAckId);
    assert.equal(moveAck.type, 'action_ack');
    assert.equal(moveAck.ok, true);
    assert.equal(moveAck.actionType, 'move');
    assert.ok(moveAck.pose);
    assert.equal(moveAck.pose?.x, 320);

    // Invalid action (empty chat) still emits action_ack with ok=false
    const chatAckId = 'ack_chat_empty';
    conn.ws.send(
      JSON.stringify({
        type: 'chat',
        text: '   ',
        ackId: chatAckId,
        sessionToken,
      })
    );
    const chatAck = await conn.nextMessage((m) => m.type === 'action_ack' && m.ackId === chatAckId);
    assert.equal(chatAck.type, 'action_ack');
    assert.equal(chatAck.ok, false);

    conn.ws.close();
    await conn.waitForClose();
  }

  // 5. Tampered sessionToken on post-hello action closes session with auth_error
  {
    const conn = await connectWs(BASE_WS);
    conn.ws.send(JSON.stringify({ type: 'hello', token: authToken }));
    const welcome = await conn.nextMessage((m) => m.type === 'welcome');
    assert.equal(welcome.type, 'welcome');

    conn.ws.send(
      JSON.stringify({
        type: 'list_worlds',
        ackId: 'ack_tampered',
        sessionToken: 'bgws.tampered.sig',
      })
    );
    const errMsg = await conn.nextMessage((m) => m.type === 'auth_error');
    assert.equal(errMsg.type, 'auth_error');
    const ackFail = await conn.nextMessage((m) => m.type === 'action_ack' && m.ackId === 'ack_tampered');
    assert.equal(ackFail.type, 'action_ack');
    assert.equal(ackFail.ok, false);
    const closeInfo = await conn.waitForClose();
    assert.equal(closeInfo.code, 4001);
  }
});

test('GameSocketClient attaches ackId/sessionToken and clears pendingAcks on action_ack', () => {
  const sentFrames: ClientMessage[] = [];

  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = MockWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(_url: string) {
      mocks.push(this);
    }

    send(data: string) {
      sentFrames.push(JSON.parse(data) as ClientMessage);
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
    }

    triggerOpen() {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }

    triggerMessage(msg: ServerMessage) {
      this.onmessage?.({ data: JSON.stringify(msg) });
    }
  }

  const mocks: MockWebSocket[] = [];
  const origWebSocket = globalThis.WebSocket;
  const origWindow = (globalThis as unknown as { window?: unknown }).window;

  try {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    (globalThis as unknown as { window: unknown }).window = {
      location: { protocol: 'http:', host: '127.0.0.1:3000' },
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setInterval: globalThis.setInterval.bind(globalThis),
      clearInterval: globalThis.clearInterval.bind(globalThis),
    };

    const client = new GameSocketClient();
    client.connectWithToken('http-auth-token-123');
    const mockWs = mocks[0];
    assert.ok(mockWs);
    mockWs.triggerOpen();

    // Expect hello frame immediately without playerId
    assert.equal(sentFrames.length, 1);
    assert.deepEqual(sentFrames[0], { type: 'hello', token: 'http-auth-token-123' });

    // Deliver welcome with server-issued sessionToken
    mockWs.triggerMessage({
      type: 'welcome',
      playerId: 'p1',
      playerName: 'Tester',
      email: 't@example.com',
      role: 'player',
      gems: 0,
      alterbits: 0,
      xp: 0,
      level: 1,
      cropMasteryXp: 0,
      cropMasteryLevel: 1,
      farmablockMasteryXp: 0,
      farmablockMasteryLevel: 1,
      inventory: [],
      equipped: {},
      stats: {
        blocksBroken: 0,
        blocksPlaced: 0,
        treesHarvested: 0,
        seedsSpliced: 0,
        storePurchases: 0,
        vendingTrades: 0,
        locksPlaced: 0,
        friendsAdded: 0,
        oresMined: 0,
        fishCaught: 0,
        itemsSmelted: 0,
        exchangeTrades: 0,
      },
      claimedAchievements: [],
      friends: [],
      incomingRequests: [],
      favoriteWorlds: ['NEXUS'],
      recentWorlds: ['NEXUS'],
      activeBuffs: [],
      unclaimedWl: 0,
      gameConfig: {} as never,
      exchange: { listings: [], priceStats: {}, totalWlBurned: 0, totalGemsCleared: 0 },
      sessionToken: 'bgws.server.issued.sig',
    });

    assert.equal(client.getConnectionDiagnostics().hasSessionToken, true);

    // Send a discrete action
    client.send({ type: 'punch_tile', tx: 4, ty: 5 });
    assert.equal(sentFrames.length, 2);
    const punchFrame = sentFrames[1];
    assert.equal(punchFrame.type, 'punch_tile');
    assert.ok(punchFrame.ackId, 'Action must automatically include ackId');
    assert.equal(punchFrame.sessionToken, 'bgws.server.issued.sig');
    assert.equal(client.getConnectionDiagnostics().pendingAckCount, 1);

    // Deliver action_ack -> clears pendingAckCount
    mockWs.triggerMessage({
      type: 'action_ack',
      ackId: punchFrame.ackId!,
      actionType: 'punch_tile',
      ok: true,
      serverTime: Date.now(),
      worldName: 'NEXUS',
      worldRevision: 7,
    });
    assert.equal(client.getConnectionDiagnostics().pendingAckCount, 0);

    client.disconnect();
  } finally {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = origWebSocket;
    (globalThis as unknown as { window?: unknown }).window = origWindow;
  }
});
