import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GATE_KEYS } from '../game/expansion.ts';
import { ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import type { DungeonAction, DungeonSnapshot } from '../game/dungeon.ts';

interface DungeonOverlayProps {
  playerId: string;
  level: number;
  gems: number;
  inventory: InventorySlot[];
  snapshot: DungeonSnapshot | null;
  onBuyKey: (tier: number, payment: 'gems' | 'world_locks') => void;
  onCreate: (tier: number, partyMode: 'solo' | 'cooperative') => void;
  onJoin: (code: string) => void;
  onAction: (action: DungeonAction, dx?: number, dy?: number) => void;
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
  playerId, level, gems, inventory, snapshot, onBuyKey, onCreate, onJoin, onAction, onDismiss,
}) => {
  const [open, setOpen] = useState(false);
  const [partyCode, setPartyCode] = useState('');
  const [partyMode, setPartyMode] = useState<'solo' | 'cooperative' | null>(null);
  const keyboardRef = useRef(new Set<string>());
  const joystickRef = useRef({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const worldLocks = inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;
  const localPlayer = snapshot?.players.find((member) => member.id === playerId);
  const atExit = Boolean(localPlayer && Math.hypot(localPlayer.x - ((snapshot?.width ?? 17) - 1.5), localPlayer.y - 5.5) <= 0.85);
  const keyCounts = useMemo(
    () => KEY_ITEM_IDS.map((id) => inventory.find((slot) => slot.itemId === id)?.qty ?? 0),
    [inventory],
  );

  useEffect(() => {
    if (snapshot) setOpen(true);
  }, [snapshot?.runId, snapshot?.phase, snapshot?.roomIndex]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'active') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        keyboardRef.current.add(key);
      } else if (!event.repeat && (key === ' ' || key === 'j')) {
        event.preventDefault();
        onAction('attack');
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keyboardRef.current.delete(event.key.toLowerCase());
    const movementTimer = window.setInterval(() => {
      let x = joystickRef.current.x;
      let y = joystickRef.current.y;
      const keys = keyboardRef.current;
      if (keys.has('arrowleft') || keys.has('a')) x -= 1;
      if (keys.has('arrowright') || keys.has('d')) x += 1;
      if (keys.has('arrowup') || keys.has('w')) y -= 1;
      if (keys.has('arrowdown') || keys.has('s')) y += 1;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 0.05) onAction('move', x / magnitude, y / magnitude);
    }, 95);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.clearInterval(movementTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keyboardRef.current.clear();
      joystickRef.current = { x: 0, y: 0 };
    };
  }, [snapshot?.runId, snapshot?.phase, onAction]);

  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const maxRadius = rect.width * 0.34;
    let x = (event.clientX - (rect.left + rect.width / 2)) / maxRadius;
    let y = (event.clientY - (rect.top + rect.height / 2)) / maxRadius;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    joystickRef.current = { x, y };
    setJoystickKnob({ x: x * maxRadius, y: y * maxRadius });
  };

  const resetJoystick = () => {
    pointerIdRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    setJoystickKnob({ x: 0, y: 0 });
  };

  const close = () => setOpen(false);
  const leave = () => {
    onAction('leave');
    onDismiss();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 left-3 top-3 px-3 py-2 rounded-md border-2 border-[#9c8050] bg-[#182332]/95 text-[#ffe3a2] text-[11px] font-bold shadow-lg hover:bg-[#26384b]"
      >
        {snapshot ? 'EXPEDITION · ' + snapshot.phase.toUpperCase() : 'STATION COMMANDER'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-[#050b12]/95 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <section className="w-full max-w-3xl max-h-[96vh] overflow-y-auto rounded-xl border-2 border-[#6b5a43] bg-[#111c29] shadow-2xl text-[#e8edf4]">
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-[#0a121d] border-b border-[#4c4639]">
              <div>
                <div className="flex items-center gap-2"><img src="/assets/dungeon/station-commander.svg" alt="Station Commander" className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} /><div><div className="font-pixel text-xs sm:text-sm text-[#f5d18a]">STATION COMMANDER</div><div className="text-[9px] text-[#91a4b8]">Adventure Gate Operations</div></div></div>
                <div className="text-[10px] text-[#91a4b8] mt-1">Top-down expeditions · Solo or co-operative</div>
              </div>
              <button type="button" onClick={close} className="px-3 py-1.5 rounded border border-[#42566b] text-xs font-bold hover:bg-[#1b2c3e]">Close</button>
            </header>

            {snapshot ? (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#f5d18a]">Gate Key Tier {snapshot.tier} · Room {Math.min(snapshot.roomIndex + 1, snapshot.roomCount)}/{snapshot.roomCount}</div>
                    <div className="text-[10px] text-[#91a4b8]">{snapshot.partyMode === 'solo' ? 'SOLO EXPEDITION' : 'CO-OP · UP TO 4'}{snapshot.partyMode === 'cooperative' && <> · Party code <span className="font-mono text-[#9ce7ff] tracking-[0.2em]">{snapshot.code}</span></>}</div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#c5b38e]">{snapshot.phase}</div>
                </div>

                <div className="rounded-lg border border-[#34485c] bg-[#080f18] p-2">
                  <div className="relative mx-auto w-full max-w-[680px]" style={{ aspectRatio: snapshot.width + ' / ' + snapshot.height }}>
                    <div className="absolute inset-0 grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(' + snapshot.width + ', minmax(0, 1fr))', gridTemplateRows: 'repeat(' + snapshot.height + ', minmax(0, 1fr))' }}>
                      {snapshot.map.flatMap((line, y) => Array.from(line).map((tile, x) => {
                        const isWall = tile === '#';
                        const isExit = tile === '>';
                        const isEntry = tile === '<';
                        const background = isWall ? '#35414b' : isExit ? (snapshot.phase === 'active' ? '#4c422e' : '#80612a') : '#182a28';
                        return <div key={x + ':' + y} className="flex items-center justify-center rounded-[2px] text-[clamp(7px,1.8vw,14px)] font-bold" style={{ background, color: isExit ? '#ffe8a9' : '#82938b' }}>{isExit ? <img src="/assets/dungeon/extraction-portal.svg" alt="Extraction portal" className={'w-full h-full object-contain ' + (snapshot.phase === 'active' ? 'opacity-40' : 'opacity-100')} style={{ imageRendering: 'pixelated' }} /> : isEntry ? '◂' : ''}</div>;
                      }))}
                    </div>
                    <div className="absolute inset-0 pointer-events-none">
                      {snapshot.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => {
                        const enemySprite = enemy.boss ? '/assets/dungeon/gate-guardian.svg'
                          : enemy.kind === 'drone' ? '/assets/dungeon/station-drone.svg'
                          : snapshot.tier === 1 ? '/assets/dungeon/cavern-slime.svg'
                          : snapshot.tier === 2 ? '/assets/dungeon/sentinel-golem.svg'
                          : snapshot.tier === 3 ? '/assets/dungeon/emerald-stalker.svg'
                          : snapshot.tier === 4 ? '/assets/dungeon/divinium-warden.svg'
                          : '/assets/dungeon/omegazyte-overlord.svg';
                        return (
                          <div key={enemy.id} title={enemy.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: (enemy.x / snapshot.width * 100) + '%', top: (enemy.y / snapshot.height * 100) + '%', width: (100 / snapshot.width * 1.15) + '%', aspectRatio: '1' }}>
                            <img src={enemySprite} alt={enemy.name} draggable={false} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                          </div>
                        );
                      })}
                      {snapshot.players.filter((member) => member.hp > 0).map((member) => (
                        <div key={member.id} title={member.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: (member.x / snapshot.width * 100) + '%', top: (member.y / snapshot.height * 100) + '%', width: (100 / snapshot.width * 1.05) + '%', aspectRatio: '1' }}>
                          <img src="/assets/dungeon/player.svg" alt={member.name} draggable={false} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2 text-[9px] text-[#91a4b8]">
                    <span>● You</span><span>◆ Party</span><span>☠ Dweller</span><span>♛ Guardian</span><span>⇢ Exit</span>
                  </div>
                </div>

                <div className="text-center text-xs text-[#f5d18a] min-h-5">{snapshot.message}</div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {snapshot.players.map((member) => (
                    <div key={member.id} className="rounded border border-[#34485c] bg-[#0b1520] p-2">
                      <div className="text-[10px] font-bold truncate">{member.name}{member.id === playerId ? ' (You)' : ''}</div>
                      <div className="h-1.5 rounded bg-[#263340] mt-1 overflow-hidden"><div className="h-full bg-[#59c987]" style={{ width: (member.hp / member.maxHp * 100) + '%' }} /></div>
                      <div className="text-[9px] text-[#a9bbca] mt-1">{member.hp}/{member.maxHp} HP · {member.connected ? 'Online' : 'Offline'}</div>
                    </div>
                  ))}
                  {snapshot.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => (
                    <div key={enemy.id} className="rounded border border-[#68403c] bg-[#201316] p-2">
                      <div className="text-[10px] font-bold truncate text-[#ffb2a3]">{enemy.name}</div>
                      <div className="h-1.5 rounded bg-[#44282a] mt-1 overflow-hidden"><div className="h-full bg-[#d45b51]" style={{ width: (enemy.hp / enemy.maxHp * 100) + '%' }} /></div>
                      <div className="text-[9px] text-[#d2a5a0] mt-1">{enemy.hp}/{enemy.maxHp} HP</div>
                    </div>
                  ))}
                </div>

                {snapshot.phase === 'active' && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div
                      className="relative w-32 h-32 shrink-0 rounded-full border-2 border-[#607b91] bg-[#1a2b3b]/90 touch-none select-none"
                      onPointerDown={(event) => { pointerIdRef.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); updateJoystick(event); }}
                      onPointerMove={(event) => { if (pointerIdRef.current === event.pointerId) updateJoystick(event); }}
                      onPointerUp={(event) => { if (pointerIdRef.current === event.pointerId) resetJoystick(); }}
                      onPointerCancel={resetJoystick}
                    >
                      <div className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full border-2 border-[#b9d8e9] bg-[#547a91] shadow-lg" style={{ transform: 'translate(calc(-50% + ' + joystickKnob.x + 'px), calc(-50% + ' + joystickKnob.y + 'px))' }} />
                    </div>
                    <button type="button" onClick={() => onAction('attack')} className="w-full sm:w-auto px-8 py-5 rounded-lg border-2 border-[#e7a16c] bg-[#713d2d] hover:bg-[#8a4b36] text-sm font-black tracking-widest">ATTACK</button>
                    <button type="button" onClick={leave} className="px-4 py-2 rounded border border-[#7d4b4b] text-xs text-[#ffb7ae]">{snapshot.partyMode === 'solo' ? 'Abandon expedition' : 'Leave party'}</button>
                  </div>
                )}

                {snapshot.phase === 'cleared' && (
                  <button type="button" disabled={!atExit} onClick={() => onAction(snapshot.roomIndex + 1 >= snapshot.roomCount ? 'extract' : 'next_room')} className="w-full py-3 rounded-lg bg-[#b78b3c] hover:bg-[#d1a54f] disabled:opacity-40 text-[#1a1208] font-black tracking-wider">
                    {!atExit ? 'REACH THE UNLOCKED EXIT PORTAL' : snapshot.roomIndex + 1 >= snapshot.roomCount ? 'EXTRACT · CLAIM REWARDS' : 'ENTER NEXT ROOM'}
                  </button>
                )}

                {(snapshot.phase === 'completed' || snapshot.phase === 'failed') && (
                  <div className="flex flex-col gap-2">
                    <div className="text-center text-sm font-bold text-[#f5d18a]">{snapshot.phase === 'completed' ? 'EXPEDITION COMPLETE' : 'EXPEDITION FAILED'}</div>
                    <div className="text-center text-xs text-[#a9bbca]">{snapshot.phase === 'completed' ? 'XP and eligible raw ore has been delivered to your account.' : 'The Gate Key was consumed. No completion rewards were granted.'}</div>
                    <button type="button" onClick={() => { onDismiss(); setOpen(false); }} className="w-full py-2 rounded bg-[#28435a] font-bold">Return to world</button>
                  </div>
                )}

                <div className="text-[9px] text-[#71879a]">Controls: 360° joystick or WASD / arrows to move · Space / J / Attack button to strike.</div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="rounded-lg border border-[#3c5368] bg-[#0b1520] p-3">
                  <div className="text-sm font-bold text-[#f5d18a]">Open an expedition</div>
                  <div className="text-[10px] text-[#91a4b8] mt-1">Choose one payment method: Gems OR World Locks. A purchased key is consumed when you activate its gate.</div>
                  <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#a9bbca]">Expedition type · choose before activation</div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button type="button" onClick={() => setPartyMode('solo')} className={'py-2 rounded border text-xs font-bold ' + (partyMode === 'solo' ? 'border-[#e7c27a] bg-[#6c522d] text-[#ffe7b3]' : 'border-[#40566b] bg-[#152332] text-[#a9bbca]')}>Solo · 1 explorer</button>
                    <button type="button" onClick={() => setPartyMode('cooperative')} className={'py-2 rounded border text-xs font-bold ' + (partyMode === 'cooperative' ? 'border-[#8acfc1] bg-[#28574f] text-[#d4fff4]' : 'border-[#40566b] bg-[#152332] text-[#a9bbca]')}>Co-op · up to 4</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {GATE_KEYS.map((key, index) => {
                    const owned = keyCounts[index] ?? 0;
                    const canUnlock = level >= key.minLevel;
                    const canBuyGems = canUnlock && gems >= key.gemPrice;
                    const canBuyLocks = canUnlock && worldLocks >= key.worldLockPrice;
                    return (
                      <div key={key.id} className="rounded-lg border border-[#3a4d60] bg-[#0b1520] p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-xs text-[#f5d18a]">Gate Key Tier {key.tier}</div>
                          <div className="text-[10px] text-[#9ce7ff]">{owned} owned</div>
                        </div>
                        <div className="text-[10px] text-[#a9bbca]">Level {key.minLevel} · {key.rooms} rooms</div>
                        <div className="text-[10px] text-[#a9bbca]">{key.enemyFamily}</div>
                        <div className="text-[10px] text-[#d9c7a3]">Choose: {key.gemPrice} Gems OR {key.worldLockPrice} World Lock(s)</div>
                        <div className="grid grid-cols-2 gap-2 mt-auto">
                          <button type="button" disabled={!canBuyGems} onClick={() => onBuyKey(key.tier, 'gems')} className="py-2 rounded bg-[#314f68] disabled:opacity-40 text-[10px] font-bold">Buy · {key.gemPrice} Gems</button>
                          <button type="button" disabled={!canBuyLocks} onClick={() => onBuyKey(key.tier, 'world_locks')} className="py-2 rounded bg-[#425b42] disabled:opacity-40 text-[10px] font-bold">Buy · {key.worldLockPrice} WL</button>
                          <button type="button" disabled={owned <= 0 || !canUnlock || !partyMode} onClick={() => partyMode && onCreate(key.tier, partyMode)} className="col-span-2 py-2 rounded bg-[#9a7332] disabled:opacity-40 text-[10px] font-black text-[#1a1208]">Activate Gate · {owned} Key(s)</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-lg border border-[#3a4d60] bg-[#0b1520] p-3 flex flex-col gap-2">
                  <div className="text-xs font-bold text-[#f5d18a]">Join a party</div>
                  <div className="flex gap-2">
                    <input value={partyCode} onChange={(event) => setPartyCode(event.target.value.toUpperCase().slice(0, 6))} placeholder="6-character code" className="min-w-0 flex-1 rounded border border-[#40566b] bg-[#07101a] px-3 py-2 text-sm font-mono tracking-[0.2em] uppercase" />
                    <button type="button" disabled={partyCode.length !== 6} onClick={() => onJoin(partyCode)} className="px-4 rounded bg-[#386d63] disabled:opacity-40 text-xs font-bold">Join</button>
                  </div>
                </div>
                
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};
