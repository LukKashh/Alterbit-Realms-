import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getItemDef } from '../game/catalog.ts';
import type { FishingCastState, FiscoreProgress, FishFightPattern, InventorySlot } from '../game/network.ts';
import { getRodUpgradeGemCost } from '../game/expansion.ts';
import type { GameConfig } from '../game/config.ts';

interface Fishing3dOverlayProps {
  gems: number;
  inventory: InventorySlot[];
  fiscore: FiscoreProgress;
  gameConfig: GameConfig;
  activeCast: FishingCastState | null;
  biting: boolean;
  progress: number;
  lineTension: number;
  fightPattern: FishFightPattern;
  lastCatchName: string | null;
  onClose: () => void;
  onCastFishing: (rodInstanceId: string, depthLevel: number) => void;
  onReelFishing: () => void;
  onUpgradeFishingRod: (rodInstanceId: string) => void;
}

export const Fishing3dOverlay: React.FC<Fishing3dOverlayProps> = ({
  gems,
  inventory,
  fiscore,
  gameConfig,
  activeCast,
  biting,
  progress,
  lineTension,
  fightPattern,
  lastCatchName,
  onClose,
  onCastFishing,
  onReelFishing,
  onUpgradeFishingRod,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const knobElRef = useRef<HTMLDivElement | null>(null);
  const keyboardRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const stickPointerIdRef = useRef<number | null>(null);
  const positionRef = useRef({ x: 0.5, y: 0.5, yaw: 0 });
  const encounterRef = useRef({ active: false, biting: false, tension: 0.15 });

  const [selectedRodInstanceId, setSelectedRodInstanceId] = useState('');
  const [selectedDepth, setSelectedDepth] = useState(1);

  const rods = useMemo(
    () => inventory.filter((slot) => slot.qty > 0 && Boolean(slot.rodInstanceId) && getItemDef(slot.itemId)?.toolKind === 'rod'),
    [inventory]
  );
  const selectedRod = rods.find((slot) => slot.rodInstanceId === selectedRodInstanceId) ?? rods[0];
  const rodDef = selectedRod ? getItemDef(selectedRod.itemId) : undefined;
  const rodType = rodDef?.rodType ?? 0;
  const upgradeLevel = selectedRod?.rodUpgradeLevel ?? 1;
  const upgradeCost = rodType > 0 && upgradeLevel < 3
    ? getRodUpgradeGemCost(rodType, upgradeLevel + 1, gameConfig.fishing)
    : 0;
  const isCasted = Boolean(activeCast);

  useEffect(() => {
    if (!rods.some((slot) => slot.rodInstanceId === selectedRodInstanceId)) {
      setSelectedRodInstanceId(rods[0]?.rodInstanceId ?? '');
    }
  }, [rods, selectedRodInstanceId]);

  useEffect(() => {
    if (selectedDepth > Math.max(1, rodType)) setSelectedDepth(Math.max(1, rodType));
  }, [selectedDepth, rodType]);

  useEffect(() => {
    encounterRef.current = { active: isCasted, biting, tension: lineTension };
  }, [isCasted, biting, lineTension]);

  const castOrReel = useCallback(() => {
    if (activeCast) {
      if (biting) onReelFishing();
      return;
    }
    if (!selectedRod?.rodInstanceId || selectedDepth > rodType) return;
    onCastFishing(selectedRod.rodInstanceId, selectedDepth);
  }, [activeCast, biting, onReelFishing, onCastFishing, selectedRod, selectedDepth, rodType]);

  const setKnobOffset = useCallback((pxX: number, pxY: number) => {
    if (knobElRef.current) {
      knobElRef.current.style.transform = `translate(calc(-50% + ${Math.round(pxX)}px), calc(-50% + ${Math.round(pxY)}px))`;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyboardRef.current.add(key);
      } else if (!event.repeat && (key === ' ' || key === 'j')) {
        event.preventDefault();
        castOrReel();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keyboardRef.current.delete(event.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keyboardRef.current.clear();
    };
  }, [castOrReel]);

  // Lightweight island scene: movement updates a player marker without forcing
  // React to render at 60fps. Encounter state is supplied only by the server.
  useEffect(() => {
    let rafId = 0;
    let lastMs = performance.now();

    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      const keys = keyboardRef.current;
      const pos = positionRef.current;
      if (keys.has('arrowleft') || keys.has('a')) pos.yaw -= dt * 1.9;
      if (keys.has('arrowright') || keys.has('d')) pos.yaw += dt * 1.9;
      let moveX = joystickRef.current.x;
      let moveY = joystickRef.current.y;
      if (keys.has('arrowup') || keys.has('w')) moveY -= 1;
      if (keys.has('arrowdown') || keys.has('s')) moveY += 1;
      const magnitude = Math.hypot(moveX, moveY);
      if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
      const speed = 0.28 * dt;
      pos.x = Math.max(0.08, Math.min(0.92, pos.x + moveX * speed));
      pos.y = Math.max(0.18, Math.min(0.82, pos.y + moveY * speed));

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
          ctx.imageSmoothingEnabled = false;
          const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
          skyGrad.addColorStop(0, '#123b5c');
          skyGrad.addColorStop(1, '#79bfe5');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h * 0.52);

          const waterGrad = ctx.createLinearGradient(0, h * 0.48, 0, h);
          waterGrad.addColorStop(0, '#087ca8');
          waterGrad.addColorStop(1, '#042e55');
          ctx.fillStyle = waterGrad;
          ctx.fillRect(0, h * 0.48, w, h * 0.52);

          ctx.fillStyle = 'rgba(195,244,255,0.32)';
          const waveOffset = Math.sin(nowMs * 0.004) * 16;
          for (let i = 0; i < 8; i++) {
            const x = ((i * 137 + waveOffset) % (w + 70)) - 35;
            ctx.fillRect(x, h * 0.54 + i * 19, 58, 3);
            ctx.fillRect((x + w * 0.43) % w, h * 0.58 + i * 17, 32, 2);
          }

          ctx.fillStyle = '#d9b96b';
          ctx.beginPath();
          ctx.moveTo(0, h * 0.72);
          ctx.bezierCurveTo(w * 0.2, h * 0.52, w * 0.8, h * 0.52, w, h * 0.72);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();
          ctx.fillStyle = '#3d9a58';
          ctx.beginPath();
          ctx.ellipse(w * 0.5, h * 0.67, w * 0.23, h * 0.105, 0, Math.PI, Math.PI * 2);
          ctx.fill();

          // Palm silhouette and small island hut.
          ctx.fillStyle = '#754522';
          ctx.fillRect(w * 0.31, h * 0.49, 9, h * 0.18);
          ctx.strokeStyle = '#276b3e';
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(w * 0.315, h * 0.51);
          ctx.lineTo(w * 0.25, h * 0.43);
          ctx.moveTo(w * 0.315, h * 0.51);
          ctx.lineTo(w * 0.38, h * 0.42);
          ctx.moveTo(w * 0.315, h * 0.51);
          ctx.lineTo(w * 0.31, h * 0.39);
          ctx.stroke();
          ctx.fillStyle = '#b66c3d';
          ctx.fillRect(w * 0.61, h * 0.57, 36, 27);
          ctx.fillStyle = '#74422f';
          ctx.beginPath();
          ctx.moveTo(w * 0.59, h * 0.58);
          ctx.lineTo(w * 0.63, h * 0.52);
          ctx.lineTo(w * 0.68, h * 0.58);
          ctx.fill();

          // Player marker responds to the movement controls.
          const px = w * (0.35 + pos.x * 0.3);
          const py = h * (0.59 + pos.y * 0.12);
          ctx.fillStyle = '#15263b';
          ctx.fillRect(px - 7, py - 20, 14, 22);
          ctx.fillStyle = '#e7b88c';
          ctx.fillRect(px - 6, py - 29, 12, 10);
          ctx.fillStyle = '#38e8d8';
          ctx.fillRect(px - 6, py - 17, 12, 7);
          ctx.fillStyle = '#111827';
          ctx.fillRect(px - 6, py + 1, 5, 7);
          ctx.fillRect(px + 1, py + 1, 5, 7);

          const encounter = encounterRef.current;
          if (encounter.active) {
            const bx = w * 0.78 + Math.sin(nowMs * 0.003) * 8;
            const by = h * 0.68 + Math.cos(nowMs * 0.005) * 5;
            ctx.strokeStyle = encounter.biting ? '#ff6b62' : '#ffe18c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(bx, by, encounter.biting ? 11 : 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = encounter.tension > 0.82 ? '#ef4444' : '#38e8d8';
            ctx.fillRect(bx - 16, by + 17, 32 * Math.min(1, encounter.tension), 3);
          }

          ctx.strokeStyle = '#254965';
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, w, h);
        }
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxRadius = Math.max(18, rect.width * 0.34);
    let x = (event.clientX - (rect.left + rect.width / 2)) / maxRadius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / maxRadius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    joystickRef.current = { x, y };
    setKnobOffset(x * maxRadius, y * maxRadius);
  };

  const resetJoystick = () => {
    stickPointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setKnobOffset(0, 0);
  };

  const durability = selectedRod
    ? Math.max(0, Math.min(100, Math.round(((selectedRod.durability ?? selectedRod.maxDurability ?? 0) / Math.max(1, selectedRod.maxDurability ?? 1)) * 100)))
    : 0;

  return (
    <div data-testid="fishing-3d-modal" className="fixed inset-0 z-[70] bg-[#060c14] overflow-hidden select-none flex flex-col">
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#0f1d2c] border-b-2 border-[#3b5978] text-[#eaf2fa]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border-2 border-[#38e8d8] bg-[#144c52] flex items-center justify-center font-pixel text-[11px] text-[#e8ffff]">3D</div>
          <div>
            <div className="font-pixel text-xs text-[#38e8d8]">FISCORE · OCEAN EXPEDITION</div>
            <div className="text-[11px] text-[#9cb5cc] font-mono-num">
              FISCORE LVL {fiscore.level} · {fiscore.catches} CATCHES · DEEPEST {fiscore.deepestDepth}/6 · {Math.round(gems)} GEMS
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded border border-[#46678a] bg-[#16283c] hover:bg-[#213c57] font-pixel text-[10px] text-[#fff8e8] cursor-pointer">
          RETURN TO REALMS
        </button>
      </header>

      <div className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} data-testid="fishing-3d-canvas" className="absolute inset-0 w-full h-full pixelated touch-none" />

        <div className="absolute top-3 left-3 z-20 rounded-lg border border-[#37617c] bg-[#081725]/90 px-3 py-2 text-[11px] text-[#d6edf8]">
          <div className="font-pixel text-[9px] text-[#8de8ff]">ISLAND SHORE</div>
          <div>Explore the island · Cast into the selected depth zone</div>
          <div className="mt-1 text-[#9cb5cc]">Movement: WASD / Arrow Keys / Joystick</div>
        </div>

        {lastCatchName && (
          <div className="absolute inset-x-0 top-16 z-20 flex justify-center px-3">
            <div className="rounded-lg border-2 border-[#f2b738] bg-[#0f1d2c]/96 px-6 py-3 shadow-2xl text-center">
              <span className="font-pixel text-xs text-[#ffe18c] block">SERVER CONFIRMED CATCH</span>
              <span className="text-sm font-bold text-[#e8ffff] mt-1 block">{lastCatchName}</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <div
              data-testid="fishing-joystick"
              className="relative w-24 h-24 rounded-full border-2 border-[#38e8d8] bg-[#0f1d2c]/90 shadow-xl touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
              onPointerDown={(event) => {
                stickPointerIdRef.current = event.pointerId;
                try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
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
              <div ref={knobElRef} className="absolute w-11 h-11 rounded-full border-2 border-[#f2b738] bg-[#144c52] shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
            </div>
            <span className="font-pixel text-[8px] text-[#9cb5cc] bg-[#09131d]/90 px-2 py-0.5 rounded border border-[#314e6b]">WASD / STICK</span>
          </div>

          <div className="pointer-events-auto w-full sm:w-[min(440px,calc(100%-120px))] rounded-xl border border-[#314e6b] bg-[#0f1d2c]/95 p-3 sm:p-4 shadow-2xl">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-[#9cb5cc]">
                EQUIPPED ROD
                <select
                  value={selectedRod?.rodInstanceId ?? ''}
                  onChange={(event) => setSelectedRodInstanceId(event.target.value)}
                  disabled={isCasted || rods.length === 0}
                  className="mt-1 w-full rounded border border-[#46678a] bg-[#091725] px-2 py-2 text-xs text-white"
                >
                  {rods.map((slot) => {
                    const def = getItemDef(slot.itemId);
                    return <option key={slot.rodInstanceId} value={slot.rodInstanceId}>{def?.name ?? 'Fishing Rod'} · Lv {slot.rodUpgradeLevel ?? 1}</option>;
                  })}
                </select>
              </label>
              <label className="text-[10px] text-[#9cb5cc]">
                FISHING DEPTH
                <select
                  value={selectedDepth}
                  onChange={(event) => setSelectedDepth(Number(event.target.value))}
                  disabled={isCasted || !selectedRod}
                  className="mt-1 w-full rounded border border-[#46678a] bg-[#091725] px-2 py-2 text-xs text-white"
                >
                  {[1, 2, 3, 4, 5, 6].map((depth) => <option key={depth} value={depth} disabled={depth > rodType}>Depth {depth}{depth > rodType ? ' · Rod required' : ''}</option>)}
                </select>
              </label>
            </div>

            {selectedRod && (
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#b9d2e8]">
                <span>{rodDef?.name} · Type {rodType} · Upgrade {upgradeLevel}/3</span>
                <span>Durability {durability}%</span>
              </div>
            )}
            {selectedRod && upgradeLevel < 3 && (
              <button
                type="button"
                disabled={isCasted || gems < upgradeCost}
                onClick={() => onUpgradeFishingRod(selectedRod.rodInstanceId!)}
                className="mt-2 w-full rounded border border-[#a87b2b] bg-[#4d3917] px-3 py-2 text-[10px] font-bold text-[#ffe18c] disabled:opacity-40"
              >
                UPGRADE ROD · {upgradeCost} GEMS
              </button>
            )}

            {isCasted ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] text-[#ffe18c]">{biting ? 'FISH ON THE LINE!' : 'WAITING FOR A BITE...'}</span>
                  <span className="text-[10px] text-[#9cb5cc]">Depth {activeCast?.depthLevel ?? selectedDepth}</span>
                </div>
                <div className="mt-2 h-3 rounded bg-[#08101a] overflow-hidden border border-[#243c54]">
                  <div className="h-full bg-[#38e8d8] transition-[width] duration-150" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-[#9cb5cc]">
                  <span>Line tension: {Math.round(lineTension * 100)}%</span>
                  <span>Fish movement: {fightPattern.replace('_', ' ')}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-[#08101a] overflow-hidden">
                  <div className={lineTension > 0.82 ? 'h-full bg-[#ef4444]' : 'h-full bg-[#f2b738]'} style={{ width: `${Math.max(0, Math.min(100, lineTension * 100))}%` }} />
                </div>
                <button
                  type="button"
                  disabled={!biting}
                  onClick={onReelFishing}
                  className="mt-3 w-full rounded-lg border-2 border-[#f2b738] bg-[#b8862d] px-5 py-3 text-[#171005] font-pixel text-xs shadow-lg disabled:opacity-40"
                >
                  REEL IN! (SPACE)
                </button>
                {!biting && <p className="mt-2 text-center text-[10px] text-[#9cb5cc]">The server will signal when a fish bites. Reeling early is not allowed.</p>}
              </div>
            ) : (
              <div className="mt-3">
                {!selectedRod ? (
                  <p className="rounded bg-[#311d1d] px-3 py-2 text-center text-xs text-[#ffc6c6]">Preparing starter rod… If it does not appear, reconnect and reopen Fiscore.</p>
                ) : (
                  <button
                    type="button"
                    disabled={selectedDepth > rodType}
                    onClick={castOrReel}
                    className="w-full rounded-xl border-2 border-[#38e8d8] bg-[#144c52] px-6 py-4 text-[#e8ffff] font-pixel text-xs shadow-xl disabled:opacity-40"
                  >
                    CAST LINE · DEPTH {selectedDepth} (SPACE)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
