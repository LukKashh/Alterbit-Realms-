import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import { soundEngine } from '../game/audio.ts';

interface Fishing3dOverlayProps {
  playerId: string;
  level: number;
  gems: number;
  inventory: InventorySlot[];
  onClose: () => void;
  onCastFishing?: (tx: number, ty: number, rodItemId: number) => void;
  onReelFishing?: () => void;
}

export const Fishing3dOverlay: React.FC<Fishing3dOverlayProps> = ({
  playerId,
  level,
  gems,
  inventory,
  onClose,
  onCastFishing,
  onReelFishing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const knobElRef = useRef<HTMLDivElement | null>(null);

  const [pos, setPos] = useState({ x: 8.5, y: 5.5, yaw: 0 });
  const [isCasted, setIsCasted] = useState(false);
  const [biting, setBiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tension, setTension] = useState(0.25);
  const [fishCaught, setFishCaught] = useState<string | null>(null);

  const keyboardRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const stickPointerIdRef = useRef<number | null>(null);

  const rodSlot = inventory.find((s) => s.itemId === ITEM_IDS.BAMBOO_ROD || s.itemId === ITEM_IDS.ANGLER_ROD);
  const hasRod = Boolean(rodSlot);

  const setKnobOffset = useCallback((pxX: number, pxY: number) => {
    if (knobElRef.current) {
      knobElRef.current.style.transform = `translate(calc(-50% + ${Math.round(pxX)}px), calc(-50% + ${Math.round(pxY)}px))`;
    }
  }, []);

  // Keyboard listeners for 3D navigation
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyboardRef.current.add(key);
      } else if (!event.repeat && (key === ' ' || key === 'j')) {
        event.preventDefault();
        if (!isCasted) {
          setIsCasted(true);
          setProgress(0);
          setTension(0.25);
          soundEngine.fishingBite();
          setTimeout(() => {
            setBiting(true);
            soundEngine.fishingBite();
          }, 2200);
        } else {
          setProgress((p) => {
            const next = p + 28;
            if (next >= 100) {
              setFishCaught('Golden Sand Carp (Depth 1)');
              soundEngine.gem();
              setTimeout(() => {
                setIsCasted(false);
                setBiting(false);
                setProgress(0);
                setFishCaught(null);
              }, 1800);
            }
            return next;
          });
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keyboardRef.current.delete(event.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keyboardRef.current.clear();
    };
  }, [isCasted]);

  // 60fps 3D Render loop
  useEffect(() => {
    let rafId = 0;
    let lastMs = performance.now();

    const frame = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;

      setPos((prev) => {
        let nx = prev.x;
        let ny = prev.y;
        let nyaw = prev.yaw;

        const keys = keyboardRef.current;
        let moveX = joystickRef.current.x;
        let moveY = joystickRef.current.y;
        if (keys.has('arrowleft') || keys.has('a')) nyaw -= dt * 2.2;
        if (keys.has('arrowright') || keys.has('d')) nyaw += dt * 2.2;
        if (keys.has('arrowup') || keys.has('w')) moveY -= 1;
        if (keys.has('arrowdown') || keys.has('s')) moveY += 1;

        if (Math.abs(moveY) > 0.1) {
          const speed = 3.5 * dt;
          nx += Math.cos(nyaw) * -moveY * speed;
          ny += Math.sin(nyaw) * -moveY * speed;
        }
        nx = Math.max(2, Math.min(18, nx));
        ny = Math.max(2, Math.min(10, ny));

        return { x: nx, y: ny, yaw: nyaw };
      });

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
          skyGrad.addColorStop(0, '#1a4b6e');
          skyGrad.addColorStop(1, '#68b5e8');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, w, h * 0.5);

          const waterGrad = ctx.createLinearGradient(0, h * 0.5, 0, h);
          waterGrad.addColorStop(0, '#0284c7');
          waterGrad.addColorStop(1, '#0369a1');
          ctx.fillStyle = waterGrad;
          ctx.fillRect(0, h * 0.5, w, h * 0.5);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          const waveOffset = Math.sin(nowMs * 0.005) * 12;
          for (let i = 0; i < 6; i++) {
            ctx.fillRect((i * 120 + waveOffset) % w, h * 0.55 + i * 22, 60, 3);
          }

          ctx.fillStyle = '#d9b96b';
          ctx.beginPath();
          ctx.moveTo(0, h * 0.65);
          ctx.bezierCurveTo(w * 0.25, h * 0.55, w * 0.75, h * 0.55, w, h * 0.65);
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.fill();

          ctx.fillStyle = '#b45309';
          ctx.fillRect(w * 0.35, h * 0.58, 20, 45);
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(w * 0.35 + 10, h * 0.56, 30, 0, Math.PI * 2);
          ctx.fill();

          if (isCasted) {
            ctx.strokeStyle = biting ? '#ef4444' : '#facc15';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(w * 0.5 + Math.sin(nowMs * 0.01) * 6, h * 0.62 + Math.cos(nowMs * 0.012) * 4, biting ? 10 : 7, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.strokeStyle = '#3b5978';
          ctx.lineWidth = 4;
          ctx.strokeRect(0, 0, w, h);
        }
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [isCasted, biting]);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxRadius = Math.max(18, rect.width * 0.34);
    let x = (event.clientX - (rect.left + rect.width / 2)) / maxRadius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / maxRadius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    joystickRef.current = { x, y };
    setKnobOffset(x * maxRadius, y * maxRadius);
  };

  const resetJoystick = () => {
    stickPointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setKnobOffset(0, 0);
  };

  return (
    <div
      data-testid="fishing-3d-modal"
      className="fixed inset-0 z-[70] bg-[#060c14] overflow-hidden select-none flex flex-col"
    >
      <header className="relative z-10 flex items-center justify-between px-4 py-2.5 bg-[#0f1d2c] border-b-2 border-[#3b5978] text-[#eaf2fa]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border-2 border-[#38e8d8] bg-[#144c52] flex items-center justify-center font-pixel text-[11px] text-[#e8ffff]">
            3D
          </div>
          <div>
            <div className="font-pixel text-xs text-[#38e8d8]">
              FISCORE · 3D DESERT ISLAND EXPEDITION
            </div>
            <div className="text-[11px] text-[#9cb5cc] font-mono-num">
              LVL {level} · {Math.round(gems)} GEMS · ROD: {hasRod ? 'Bamboo Fishing Rod (Tier 1)' : 'Default Rod'} + Starter Bait
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded border border-[#46678a] bg-[#16283c] hover:bg-[#213c57] font-pixel text-[10px] text-[#fff8e8] cursor-pointer"
        >
          RETURN TO REALMS
        </button>
      </header>

      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          data-testid="fishing-3d-canvas"
          className="absolute inset-0 w-full h-full pixelated touch-none"
        />

        {fishCaught && (
          <div className="absolute inset-x-0 top-12 z-20 flex justify-center">
            <div className="rounded-lg border-2 border-[#f2b738] bg-[#0f1d2c]/96 px-6 py-3 shadow-2xl text-center animate-bounce">
              <span className="font-pixel text-xs text-[#ffe18c] block">SUCCESS! CAUGHT FISH</span>
              <span className="text-sm font-bold text-[#e8ffff] mt-1 block">{fishCaught}</span>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-20 p-4 flex items-end justify-between gap-4 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center gap-1.5">
            <div
              data-testid="fishing-joystick"
              className="relative w-24 h-24 rounded-full border-2 border-[#38e8d8] bg-[#0f1d2c]/90 shadow-xl touch-none select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
              onPointerDown={(event) => {
                stickPointerIdRef.current = event.pointerId;
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {}
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
              <div
                ref={knobElRef}
                className="absolute w-11 h-11 rounded-full border-2 border-[#f2b738] bg-[#144c52] shadow-lg"
                style={{ transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <span className="font-pixel text-[8px] text-[#9cb5cc] bg-[#09131d]/90 px-2 py-0.5 rounded border border-[#314e6b]">
              WASD / STICK
            </span>
          </div>

          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {!isCasted ? (
              <button
                type="button"
                onClick={() => {
                  setIsCasted(true);
                  setProgress(0);
                  setTension(0.25);
                  soundEngine.fishingBite();
                  setTimeout(() => {
                    setBiting(true);
                    soundEngine.fishingBite();
                  }, 2200);
                }}
                className="px-6 py-4 rounded-xl border-2 border-[#38e8d8] bg-[#144c52] hover:bg-[#1a5d63] text-[#e8ffff] font-pixel text-xs shadow-2xl cursor-pointer"
              >
                CAST LINE (SPACE)
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 bg-[#0f1d2c]/92 p-4 rounded-xl border border-[#314e6b]">
                <span className="font-pixel text-[10px] text-[#ffe18c]">
                  {biting ? 'FISH BITTING! REEL NOW!' : 'WAITING FOR BITE...'}
                </span>
                <div className="w-48 h-3 rounded bg-[#08101a] overflow-hidden border border-[#243c54]">
                  <div className="h-full bg-[#38e8d8]" style={{ width: `${progress}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProgress((p) => {
                      const next = p + 34;
                      if (next >= 100) {
                        setFishCaught('Abyssal Desert Carp (Depth 2)');
                        soundEngine.gem();
                        setTimeout(() => {
                          setIsCasted(false);
                          setBiting(false);
                          setProgress(0);
                          setFishCaught(null);
                        }, 1800);
                      }
                      return next;
                    });
                  }}
                  className="px-6 py-3 rounded-lg border-2 border-[#f2b738] bg-[#b8862d] hover:bg-[#d19a38] text-[#171005] font-pixel text-xs cursor-pointer shadow-lg"
                >
                  REEL IN! (SPACE)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
