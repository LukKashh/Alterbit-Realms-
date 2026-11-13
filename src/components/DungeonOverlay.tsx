import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GATE_KEYS } from '../game/expansion.ts';
import { ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import { DEFAULT_DUNGEON_BALANCE, isDungeonPositionWalkable } from '../game/dungeon.ts';
import type { DungeonAction, DungeonSnapshot } from '../game/dungeon.ts';
import { BlockgroveEngine, renderDungeonThirdPerson } from '../game/engine.ts';

interface DungeonOverlayProps {
  engine?: BlockgroveEngine | null;
  playerId: string;
  level: number;
  gems: number;
  inventory: InventorySlot[];
  snapshot: DungeonSnapshot | null;
  onBuyKey: (tier: number, payment: 'gems' | 'world_locks') => void;
  onCreate: (tier: number, partyMode: 'solo' | 'cooperative') => void;
  onJoin: (code: string) => void;
  onAction: (action: DungeonAction, dx?: number, dy?: number) => void;
  onClose: () => void;
  onDismiss: () => void;
}

const KEY_ITEM_IDS = [
  ITEM_IDS.GATE_KEY_I,
  ITEM_IDS.GATE_KEY_II,
  ITEM_IDS.GATE_KEY_III,
  ITEM_IDS.GATE_KEY_IV,
  ITEM_IDS.GATE_KEY_V,
];



export const DungeonOverlay: React.FC<DungeonOverlayProps> = ({
  engine,
  playerId,
  level,
  gems,
  inventory,
  snapshot,
  onBuyKey,
  onCreate,
  onJoin,
  onAction,
  onClose,
  onDismiss,
}) => {
  const [partyCode, setPartyCode] = useState('');
  const [partyMode, setPartyMode] = useState<'solo' | 'cooperative'>('solo');
  const [selectedPreviewTier, setSelectedPreviewTier] = useState<number>(1);
  const [deckCollapsed, setDeckCollapsed] = useState<boolean>(false);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const yawRef = useRef<number>(0);
  const bobPhaseRef = useRef<number>(0);
  const slashTimerRef = useRef<number>(0);
  const hitFlashRef = useRef<number>(0);
  const prevHpRef = useRef<number | null>(null);
  const prevRoomKeyRef = useRef<string>('');

  const keyboardRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const stickPointerIdRef = useRef<number | null>(null);
  const predictedPositionRef = useRef<{ runId: string; roomIndex: number; x: number; y: number } | null>(null);

  const worldLocks = inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;
  const localPlayer = snapshot?.players.find((member) => member.id === playerId);
  const livingEnemies = useMemo(
    () => (snapshot ? snapshot.enemies.filter((enemy) => enemy.hp > 0) : []),
    [snapshot]
  );

  const atExit = Boolean(
    localPlayer &&
      Math.hypot(localPlayer.x - ((snapshot?.width ?? 17) - 1.5), localPlayer.y - 5.5) <= 0.95
  );

  const nearestEnemyDistance = useMemo(() => {
    if (!localPlayer || livingEnemies.length === 0) return Infinity;
    return Math.min(
      ...livingEnemies.map((e) => Math.hypot(e.x - localPlayer.x, e.y - localPlayer.y))
    );
  }, [localPlayer, livingEnemies]);

  const keyCounts = useMemo(
    () => KEY_ITEM_IDS.map((id) => inventory.find((slot) => slot.itemId === id)?.qty ?? 0),
    [inventory]
  );

  // Keep the local camera position responsive while reconciling against server snapshots.
  useEffect(() => {
    if (!snapshot || !localPlayer) {
      predictedPositionRef.current = null;
      prevRoomKeyRef.current = '';
      prevHpRef.current = null;
      return;
    }
    const roomKey = snapshot.runId + ':' + snapshot.roomIndex;
    const predicted = predictedPositionRef.current;
    if (prevRoomKeyRef.current !== roomKey || !predicted || predicted.runId !== snapshot.runId || predicted.roomIndex !== snapshot.roomIndex) {
      prevRoomKeyRef.current = roomKey;
      predictedPositionRef.current = { runId: snapshot.runId, roomIndex: snapshot.roomIndex, x: localPlayer.x, y: localPlayer.y };
      keyboardRef.current.clear();
      joystickRef.current = { x: 0, y: 0 };
      setJoystickKnob({ x: 0, y: 0 });
      yawRef.current = Math.abs(localPlayer.facingX) > 0.01 || Math.abs(localPlayer.facingY) > 0.01 ? Math.atan2(localPlayer.facingY, localPlayer.facingX) : 0;
    } else {
      const error = Math.hypot(localPlayer.x - predicted.x, localPlayer.y - predicted.y);
      if (error > 0.65) { predicted.x = localPlayer.x; predicted.y = localPlayer.y; }
      else if (error > 0.015) { predicted.x += (localPlayer.x - predicted.x) * 0.22; predicted.y += (localPlayer.y - predicted.y) * 0.22; }
    }
  }, [snapshot?.runId, snapshot?.roomIndex, localPlayer?.x, localPlayer?.y, localPlayer?.facingX, localPlayer?.facingY]);
  // Trigger a brief damage flash when the player takes a hit
  useEffect(() => {
    if (!localPlayer) return;
    if (prevHpRef.current !== null && localPlayer.hp < prevHpRef.current) {
      hitFlashRef.current = 1;
    }
    prevHpRef.current = localPlayer.hp;
  }, [localPlayer?.hp]);

  // Melee strike follows the player's last authoritative facing direction
  const triggerStrike = useCallback(() => {
    slashTimerRef.current = 1;
    const dirX = localPlayer?.facingX ?? Math.cos(yawRef.current);
    const dirY = localPlayer?.facingY ?? Math.sin(yawRef.current);
    onAction('attack', dirX, dirY);
  }, [onAction, localPlayer?.facingX, localPlayer?.facingY]);

  // Third-person dungeon render loop
  useEffect(() => {
    let rafId = 0;
    let lastMs = performance.now();

    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;

      if (snapshot && (snapshot.phase === 'active' || snapshot.phase === 'cleared')) {
        const keys = keyboardRef.current;
        let moveX = joystickRef.current.x;
        let moveY = -joystickRef.current.y;
        if (keys.has('arrowleft') || keys.has('a')) moveX -= 1;
        if (keys.has('arrowright') || keys.has('d')) moveX += 1;
        if (keys.has('arrowup') || keys.has('w')) moveY -= 1;
        if (keys.has('arrowdown') || keys.has('s')) moveY += 1;
        const magnitude = Math.hypot(moveX, moveY);
        if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
        const predicted = predictedPositionRef.current;
        if (predicted && predicted.runId === snapshot.runId && predicted.roomIndex === snapshot.roomIndex && magnitude > 0.14) {
          const distance = DEFAULT_DUNGEON_BALANCE.playerMoveStep / (110 / 1000) * dt * Math.min(1, magnitude);
          const dx = moveX * distance;
          const dy = moveY * distance;
          const canOccupy = (x: number, y: number) => isDungeonPositionWalkable(snapshot.map, x, y) && (snapshot.phase === 'cleared' || snapshot.map[Math.floor(y)]?.[Math.floor(x)] !== '>') &&
            !snapshot.players.some((member) => member.id !== playerId && member.hp > 0 && Math.hypot(member.x - x, member.y - y) < 0.48) &&
            !snapshot.enemies.some((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) < 0.5);
          const nextX = Math.max(1.22, Math.min(snapshot.width - 1.22, predicted.x + dx));
          const nextY = Math.max(1.22, Math.min(snapshot.height - 1.22, predicted.y + dy));
          if (canOccupy(nextX, nextY)) { predicted.x = nextX; predicted.y = nextY; }
          else {
            if (canOccupy(nextX, predicted.y)) predicted.x = nextX;
            if (canOccupy(predicted.x, nextY)) predicted.y = nextY;
          }
          bobPhaseRef.current += dt * 11 * magnitude;
        }
      } else {
        // Gentle scenic pan inside preview sanctuary when choosing a Gate Key
        yawRef.current = Math.sin(nowMs * 0.00035) * 0.35;
      }

      if (slashTimerRef.current > 0) {
        slashTimerRef.current = Math.max(0, slashTimerRef.current - dt * 4.5);
      }
      if (hitFlashRef.current > 0) {
        hitFlashRef.current = Math.max(0, hitFlashRef.current - dt * 3.2);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(320, Math.floor(rect.width));
        const h = Math.max(200, Math.floor(rect.height));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const opts = {
            nowMs,
            bobPhase: bobPhaseRef.current,
            slashTimer: slashTimerRef.current,
            hitFlash: hitFlashRef.current,
            previewTier: selectedPreviewTier,
          };
          const predicted = predictedPositionRef.current;
          const renderSnapshot = predicted && snapshot && predicted.runId === snapshot.runId && predicted.roomIndex === snapshot.roomIndex
            ? { ...snapshot, players: snapshot.players.map((member) => member.id === playerId ? { ...member, x: predicted.x, y: predicted.y } : member) }
            : snapshot;
          if (engine) {
            renderDungeonThirdPerson(ctx, w, h, renderSnapshot, playerId, opts);
          } else {
            renderDungeonThirdPerson(ctx, w, h, renderSnapshot, playerId, opts);
          }
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [engine, snapshot, playerId, selectedPreviewTier]);

  // Third-person 8-direction movement sync + keyboard controls
  useEffect(() => {
    if (!snapshot || (snapshot.phase !== 'active' && snapshot.phase !== 'cleared')) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyboardRef.current.add(key);
      } else if (!event.repeat && (key === ' ' || key === 'j')) {
        event.preventDefault();
        triggerStrike();
      } else if (!event.repeat && key === 'e' && snapshot.phase === 'cleared' && atExit) {
        event.preventDefault();
        onAction(snapshot.roomIndex + 1 >= snapshot.roomCount ? 'extract' : 'next_room');
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keyboardRef.current.delete(event.key.toLowerCase());

    const movementTimer = window.setInterval(() => {
      const keys = keyboardRef.current;
      let dx = joystickRef.current.x;
      let dy = -joystickRef.current.y;
      if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
      if (keys.has('arrowright') || keys.has('d')) dx += 1;
      if (keys.has('arrowup') || keys.has('w')) dy -= 1;
      if (keys.has('arrowdown') || keys.has('s')) dy += 1;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude > 1) { dx /= magnitude; dy /= magnitude; }
      if (magnitude > 0.14) onAction('move', dx, dy);
    }, 110);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.clearInterval(movementTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keyboardRef.current.clear();
      joystickRef.current = { x: 0, y: 0 };
      setJoystickKnob({ x: 0, y: 0 });
    };
  }, [snapshot?.runId, snapshot?.phase, snapshot?.roomIndex, snapshot?.roomCount, atExit, onAction, triggerStrike]);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxRadius = rect.width * 0.34;
    let x = (event.clientX - (rect.left + rect.width / 2)) / maxRadius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / maxRadius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    joystickRef.current = { x, y };
    setJoystickKnob({ x: x * maxRadius, y: y * maxRadius });
  };

  const resetJoystick = () => {
    stickPointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setJoystickKnob({ x: 0, y: 0 });
  };

  const leave = () => {
    onAction('leave');
    onDismiss();
    onClose();
  };

  return (
    <div
      data-testid="dungeon-3d-modal"
      className="fixed inset-0 z-[70] bg-[#060c14] overflow-hidden select-none"
    >
      {/* Third-person room view canvas */}
      <canvas
        ref={canvasRef}
        data-testid="dungeon-third-person-canvas"
        className="absolute inset-0 w-full h-full pixelated touch-none"
      />

      {/* Top Bar: Matching Blockgrove Pixel-Art & Silkscreen Font Aesthetic */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-[#0f1d2c]/92 border-b-2 border-[#3b5978] text-[#eaf2fa]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border-2 border-[#f2b738] bg-[#16283c] flex items-center justify-center font-pixel text-[11px] text-[#ffe18c]">
            3D
          </div>
          <div>
            <div className="font-pixel text-[11px] sm:text-xs text-[#ffe18c]">
              {snapshot
                ? `GATE TIER ${snapshot.tier} · ROOM ${Math.min(snapshot.roomIndex + 1, snapshot.roomCount)}/${snapshot.roomCount}`
                : '3D ADVENTURE DUNGEONS'}
            </div>
            <div className="text-[11px] text-[#9cb5cc]">
              {snapshot ? (
                <>
                  <span className="font-pixel text-[9px] text-[#89d6ff]">
                    {snapshot.partyMode === 'solo' ? 'SOLO RUN' : 'CO-OP'}
                  </span>
                  {snapshot.partyMode === 'cooperative' && (
                    <>
                      {' · CODE '}
                      <span className="font-mono-num font-bold text-[#8cf7ee] tracking-widest">
                        {snapshot.code}
                      </span>
                    </>
                  )}
                  {' · '}
                  <span className="text-[#fff3cf]">{snapshot.message}</span>
                </>
              ) : (
                <span className="font-mono-num">
                  LVL {level} · {Math.round(gems)} GEMS · {worldLocks} WL
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!snapshot && (
            <button
              type="button"
              onClick={() => setDeckCollapsed((v) => !v)}
              className="px-2.5 py-1.5 rounded border border-[#46678a] bg-[#142538] hover:bg-[#1e3752] font-pixel text-[10px] text-[#89d6ff] cursor-pointer"
            >
              {deckCollapsed ? 'SHOW DECK' : 'VIEW 3D'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#46678a] bg-[#16283c] hover:bg-[#213c57] font-pixel text-[10px] text-[#fff8e8] cursor-pointer"
          >
            {snapshot ? 'WORLD MENU' : 'BACK'}
          </button>
        </div>
      </header>

      {/* ACTIVE THIRD-PERSON DUNGEON HUD */}
      {snapshot ? (
        <>
          {/* Top-left compact explorer & enemy HP bars */}
          <div className="relative z-10 pointer-events-none px-3 pt-2 flex flex-col gap-1.5 max-w-xs">
            {snapshot.players.map((member) => (
              <div
                key={member.id}
                className="rounded border-2 border-[#314e6b] bg-[#0f1d2c]/90 px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-pixel text-[9px] text-[#fff8e8] truncate">
                    {member.name}
                    {member.id === playerId ? ' (YOU)' : ''}
                  </span>
                  <span className="font-mono-num font-bold text-[#82e068]">
                    {member.hp}/{member.maxHp}
                  </span>
                </div>
                <div className="h-1.5 rounded bg-[#08101a] mt-1 overflow-hidden border border-[#243c54]">
                  <div
                    className="h-full bg-[#4ec46a]"
                    style={{ width: `${Math.max(0, (member.hp / member.maxHp) * 100)}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="rounded border border-[#314e6b] bg-[#09131d]/85 px-2.5 py-1 font-pixel text-[9px] text-[#8cf7ee]">
              FOES LEFT: {livingEnemies.length}
            </div>
          </div>

          {/* Bottom Peripheral Third-Person Movement Joystick & Strike */}
          <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none p-3 sm:p-5 flex items-end justify-between gap-3">
            {(snapshot.phase === 'active' || snapshot.phase === 'cleared') && (
              <div className="pointer-events-auto flex flex-col items-center gap-1.5">
                <div
                  data-testid="dungeon-joystick"
                  className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-full border-2 border-[#78c8f5] bg-[#0f1d2c]/90 shadow-2xl touch-none select-none cursor-grab active:cursor-grabbing"
                  onPointerDown={(event) => {
                    stickPointerIdRef.current = event.pointerId;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    updateJoystick(event);
                  }}
                  onPointerMove={(event) => {
                    if (stickPointerIdRef.current === event.pointerId) updateJoystick(event);
                  }}
                  onPointerUp={(event) => {
                    if (stickPointerIdRef.current === event.pointerId) resetJoystick();
                  }}
                  onPointerCancel={resetJoystick}
                >
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 font-pixel text-[8px] text-[#89d6ff]">
                    UP
                  </span>
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-pixel text-[8px] text-[#89d6ff]">
                    DOWN
                  </span>
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 font-pixel text-[10px] text-[#ffe18c]">
                    ◀
                  </span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 font-pixel text-[10px] text-[#ffe18c]">
                    ▶
                  </span>
                  <div
                    className="absolute left-1/2 top-1/2 w-11 h-11 rounded-full border-2 border-[#f2b738] bg-[#214463] shadow-lg"
                    style={{
                      transform: `translate(calc(-50% + ${joystickKnob.x}px), calc(-50% + ${joystickKnob.y}px))`,
                    }}
                  />
                </div>
                <span className="font-pixel text-[8px] text-[#b9d2e8] bg-[#09131d]/90 px-2 py-1 rounded border border-[#314e6b]">
                  W/S MOVE · A/D TURN · DRAG LOOK
                </span>
              </div>
            )}

            {/* Center: Portal Extraction / Room Advance / Run Completion Banner */}
            <div className="pointer-events-auto flex flex-col items-center gap-2 max-w-md mx-auto">
              {snapshot.phase === 'cleared' && (
                <button
                  type="button"
                  disabled={!atExit}
                  onClick={() =>
                    onAction(
                      snapshot.roomIndex + 1 >= snapshot.roomCount ? 'extract' : 'next_room'
                    )
                  }
                  className="px-5 py-3 rounded-md border-2 border-[#ffe18c] bg-[#b8862d] hover:bg-[#d19a38] disabled:opacity-60 text-[#171005] font-pixel text-[10px] sm:text-xs shadow-xl cursor-pointer"
                >
                  {!atExit
                    ? 'WALK TO GREEN EXIT PORTAL →'
                    : snapshot.roomIndex + 1 >= snapshot.roomCount
                      ? 'EXTRACT · CLAIM ORE & XP'
                      : 'NEXT CHAMBER (E)'}
                </button>
              )}

              {(snapshot.phase === 'completed' || snapshot.phase === 'failed') && (
                <div className="rounded-lg border-2 border-[#f2b738] bg-[#0f1d2c]/96 p-4 text-center shadow-2xl flex flex-col gap-2.5 min-w-[270px]">
                  <div className="font-pixel text-xs sm:text-sm text-[#ffe18c]">
                    {snapshot.phase === 'completed'
                      ? 'EXPEDITION COMPLETE'
                      : 'EXPEDITION FAILED'}
                  </div>
                  <div className="text-xs text-[#b9d2e8]">
                    {snapshot.phase === 'completed'
                      ? 'Raw Ores and Expedition XP have been delivered to your backpack.'
                      : 'Your explorer fell in battle. Gate Key was consumed.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDismiss();
                      onClose();
                    }}
                    className="w-full py-2.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] font-pixel text-[11px] text-[#081709] cursor-pointer"
                  >
                    RETURN TO WORLD MENU
                  </button>
                </div>
              )}
            </div>

            {/* Right: Melee Strike & Leave */}
            {(snapshot.phase === 'active' || snapshot.phase === 'cleared') && (
              <div className="pointer-events-auto flex flex-col items-end gap-2">
                <button
                  type="button"
                  data-testid="dungeon-attack-button"
                  onClick={triggerStrike}
                  className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 font-pixel text-xs shadow-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform ${
                    nearestEnemyDistance <= 1.5
                      ? 'border-[#ffe18c] bg-[#a83827] hover:bg-[#bf422f] text-[#fff8e8]'
                      : 'border-[#d97757] bg-[#692c20] hover:bg-[#7d3527] text-[#ffe4db]'
                  }`}
                >
                  <span>STRIKE</span>
                  <span className="font-mono-num text-[10px] font-bold text-[#ffd7c9]">
                    {nearestEnemyDistance <= 1.5 ? 'IN RANGE!' : 'SPACE / J'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={leave}
                  className="px-3 py-1.5 rounded border border-[#7a343d] bg-[#3b1b1f]/95 hover:bg-[#52242a] font-pixel text-[9px] text-[#ffd4d4] cursor-pointer"
                >
                  {snapshot.partyMode === 'solo' ? 'ABANDON' : 'LEAVE PARTY'}
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* GATE COMMAND DECK (When opening Dungeons straight from World Menu) */
        !deckCollapsed && (
          <div className="fixed inset-x-0 bottom-0 z-20 max-h-[82vh] overflow-y-auto p-2 sm:p-4 flex justify-center">
            <section className="w-full max-w-4xl rounded-lg border-2 border-[#3b5978] bg-[#0f1d2c]/95 p-3 sm:p-4 shadow-[0_10px_0_rgba(6,12,20,0.9)] text-[#eaf2fa] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#28425e] pb-2.5">
                <div>
                  <div className="font-pixel text-xs text-[#ffe18c]">
                    3D Adventure Dungeon Gates
                  </div>
                  <div className="text-[11px] text-[#9cb5cc] mt-0.5">
                    Preview each tier in the third-person dungeon view behind this deck. Unlock Gate Keys with Gems or World Locks.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPartyMode('solo')}
                    className={`px-3 py-1.5 rounded border font-pixel text-[10px] cursor-pointer ${
                      partyMode === 'solo'
                        ? 'border-[#f2b738] bg-[#5c441e] text-[#ffe18c]'
                        : 'border-[#314e6b] bg-[#09131d] text-[#9cb5cc]'
                    }`}
                  >
                    SOLO (1P)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartyMode('cooperative')}
                    className={`px-3 py-1.5 rounded border font-pixel text-[10px] cursor-pointer ${
                      partyMode === 'cooperative'
                        ? 'border-[#38e8d8] bg-[#16423d] text-[#8cf7ee]'
                        : 'border-[#314e6b] bg-[#09131d] text-[#9cb5cc]'
                    }`}
                  >
                    CO-OP (4P)
                  </button>
                </div>
              </div>

              {/* 5 Progressive Gate Key Tiers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {GATE_KEYS.map((key, index) => {
                  const owned = keyCounts[index] ?? 0;
                  const canUnlock = level >= key.minLevel;
                  const canBuyGems = canUnlock && gems >= key.gemPrice;
                  const canBuyLocks = canUnlock && worldLocks >= key.worldLockPrice;
                  const isSelected = selectedPreviewTier === key.tier;
                  return (
                    <div
                      key={key.id}
                      onClick={() => setSelectedPreviewTier(key.tier)}
                      className={`rounded border-2 p-2.5 flex flex-col gap-1.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-[#f2b738] bg-[#15283c]'
                          : 'border-[#28425e] bg-[#09131d] hover:border-[#46678a]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-pixel text-[10px] text-[#ffe18c]">
                          TIER {key.tier}
                        </span>
                        <span className="text-[10px] font-mono-num font-bold text-[#8cf7ee]">
                          {owned} Key{owned === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono-num text-[#9cb5cc]">
                        Req LVL {key.minLevel} · {key.rooms} Rooms
                      </div>
                      <div className="text-[11px] font-bold text-[#e2eef8] truncate">
                        {key.enemyFamily}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-auto pt-1">
                        <button
                          type="button"
                          disabled={!canBuyGems}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBuyKey(key.tier, 'gems');
                          }}
                          className="py-1.5 rounded bg-[#214463] hover:bg-[#2d5b82] disabled:opacity-35 font-mono-num text-[10px] font-bold cursor-pointer"
                        >
                          {key.gemPrice} G
                        </button>
                        <button
                          type="button"
                          disabled={!canBuyLocks}
                          onClick={(e) => {
                            e.stopPropagation();
                            onBuyKey(key.tier, 'world_locks');
                          }}
                          className="py-1.5 rounded bg-[#2d5432] hover:bg-[#3a6b41] disabled:opacity-35 font-mono-num text-[10px] font-bold cursor-pointer"
                        >
                          {key.worldLockPrice} WL
                        </button>
                        <button
                          type="button"
                          disabled={owned <= 0 || !canUnlock}
                          onClick={(e) => {
                            e.stopPropagation();
                            onCreate(key.tier, partyMode);
                          }}
                          className="col-span-2 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border border-[#82e068] disabled:opacity-35 font-pixel text-[9px] text-[#081709] cursor-pointer"
                        >
                          ENTER GATE ({owned})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Co-op Party Code Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded border border-[#28425e] bg-[#09131d] px-3 py-2">
                <div className="font-pixel text-[10px] text-[#ffe18c]">
                  JOIN CO-OP 3D PARTY
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={partyCode}
                    onChange={(event) =>
                      setPartyCode(event.target.value.toUpperCase().slice(0, 6))
                    }
                    placeholder="6-CHAR CODE"
                    className="w-36 rounded border border-[#2d4863] bg-[#08101a] px-2.5 py-1.5 text-xs font-mono-num tracking-[0.2em] uppercase text-white focus:outline-none focus:border-[#f2b738]"
                  />
                  <button
                    type="button"
                    disabled={partyCode.length !== 6}
                    onClick={() => onJoin(partyCode)}
                    className="px-4 py-1.5 rounded bg-[#214463] hover:bg-[#2d5b82] border border-[#78c8f5] disabled:opacity-40 font-pixel text-[10px] text-white cursor-pointer"
                  >
                    JOIN
                  </button>
                </div>
              </div>
            </section>
          </div>
        )
      )}
    </div>
  );
};
