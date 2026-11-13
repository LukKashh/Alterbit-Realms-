import React, { useEffect, useMemo, useState } from 'react';
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
  onCreate: (tier: number) => void;
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
  const [notice, setNotice] = useState('');
  const worldLocks = inventory.find((slot) => slot.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;
  const localPlayer = snapshot?.players.find((member) => member.id === playerId);
  const atExit = Boolean(localPlayer && Math.hypot(localPlayer.x - (snapshot?.width ?? 17) + 2, localPlayer.y - 5) <= 0.85);
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
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      const moves: Record<string, [number, number]> = {
        arrowup: [0, -1], w: [0, -1],
        arrowdown: [0, 1], s: [0, 1],
        arrowleft: [-1, 0], a: [-1, 0],
        arrowright: [1, 0], d: [1, 0],
      };
      if (moves[key]) {
        event.preventDefault();
        onAction('move', moves[key][0], moves[key][1]);
      } else if (key === ' ' || key === 'j') {
        event.preventDefault();
        onAction('attack');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [snapshot?.runId, snapshot?.phase, onAction]);

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
                <div className="font-pixel text-xs sm:text-sm text-[#f5d18a]">STATION · DUNGEON GATE</div>
                <div className="text-[10px] text-[#91a4b8] mt-1">Co-operative top-down expeditions · up to 4 explorers</div>
              </div>
              <button type="button" onClick={close} className="px-3 py-1.5 rounded border border-[#42566b] text-xs font-bold hover:bg-[#1b2c3e]">Close</button>
            </header>

            {snapshot ? (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#f5d18a]">Gate Key Tier {snapshot.tier} · Room {Math.min(snapshot.roomIndex + 1, snapshot.roomCount)}/{snapshot.roomCount}</div>
                    <div className="text-[10px] text-[#91a4b8]">Party code <span className="font-mono text-[#9ce7ff] tracking-[0.2em]">{snapshot.code}</span></div>
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-[#c5b38e]">{snapshot.phase}</div>
                </div>

                <div className="rounded-lg border border-[#34485c] bg-[#080f18] p-2">
                  <div className="mx-auto w-full max-w-[680px] grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(' + snapshot.width + ', minmax(0, 1fr))' }}>
                    {snapshot.map.flatMap((line, y) => Array.from(line).map((tile, x) => {
                      const enemy = snapshot.enemies.find((entry) => entry.hp > 0 && entry.x === x && entry.y === y);
                      const player = snapshot.players.find((entry) => entry.hp > 0 && entry.x === x && entry.y === y);
                      const isWall = tile === '#';
                      const isExit = tile === '>';
                      const isEntry = tile === '<';
                      const symbol = enemy ? (enemy.boss ? '♛' : '☠') : player ? (player.id === playerId ? '●' : '◆') : isExit ? '▸' : isEntry ? '◂' : '';
                      const background = isWall ? '#35414b' : enemy ? (enemy.boss ? '#6b292b' : '#563b32') : player ? (player.id === playerId ? '#1d6372' : '#315b8a') : isExit ? '#80612a' : '#182a28';
                      return (
                        <div key={x + ':' + y} title={enemy?.name ?? player?.name ?? ''} className="aspect-square flex items-center justify-center rounded-[2px] text-[clamp(7px,1.8vw,14px)] font-bold" style={{ background, color: enemy ? '#ffd3a0' : player ? '#e8fbff' : isExit ? '#ffe8a9' : '#82938b' }}>
                          {symbol}
                        </div>
                      );
                    }))}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2 text-[9px] text-[#91a4b8]">
                    <span>● You</span><span>◆ Party</span><span>☠ Dweller</span><span>♛ Guardian</span><span>▸ Exit</span>
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
                    <div className="grid grid-cols-3 gap-1.5">
                      <span />
                      <button type="button" onClick={() => onAction('move', 0, -1)} className="w-12 h-10 rounded border border-[#52677b] bg-[#203247] font-bold">▲</button>
                      <span />
                      <button type="button" onClick={() => onAction('move', -1, 0)} className="w-12 h-10 rounded border border-[#52677b] bg-[#203247] font-bold">◀</button>
                      <button type="button" onClick={() => onAction('move', 0, 1)} className="w-12 h-10 rounded border border-[#52677b] bg-[#203247] font-bold">▼</button>
                      <button type="button" onClick={() => onAction('move', 1, 0)} className="w-12 h-10 rounded border border-[#52677b] bg-[#203247] font-bold">▶</button>
                    </div>
                    <button type="button" onClick={() => onAction('attack')} className="w-full sm:w-auto px-8 py-4 rounded-lg border-2 border-[#e7a16c] bg-[#713d2d] hover:bg-[#8a4b36] text-sm font-black tracking-widest">ATTACK</button>
                    <button type="button" onClick={leave} className="px-4 py-2 rounded border border-[#7d4b4b] text-xs text-[#ffb7ae]">Leave party</button>
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
                    <div className="text-center text-xs text-[#a9bbca]">{snapshot.phase === 'completed' ? 'XP and ore fragments have been delivered to your account.' : 'The Gate Key was consumed. No completion rewards were granted.'}</div>
                    <button type="button" onClick={() => { onDismiss(); setOpen(false); }} className="w-full py-2 rounded bg-[#28435a] font-bold">Return to world</button>
                  </div>
                )}

                <div className="text-[9px] text-[#71879a]">Controls: WASD / arrow keys to move · Space / J to attack. Touch controls are available above.</div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 flex flex-col gap-3">
                <div className="rounded-lg border border-[#3c5368] bg-[#0b1520] p-3">
                  <div className="text-sm font-bold text-[#f5d18a]">Open an expedition</div>
                  <div className="text-[10px] text-[#91a4b8] mt-1">Choose one payment method: Gems OR World Locks. A purchased key is consumed when you activate its gate.</div>
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
                          <button type="button" disabled={owned <= 0 || !canUnlock} onClick={() => onCreate(key.tier)} className="col-span-2 py-2 rounded bg-[#9a7332] disabled:opacity-40 text-[10px] font-black text-[#1a1208]">Activate Gate · {owned} Key(s)</button>
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
                {notice && <div className="text-xs text-[#f5d18a]">{notice}</div>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};
