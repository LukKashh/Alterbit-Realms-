import React, { useEffect, useState } from 'react';
import { Coins, Flame, Hammer, Lock, Package, Power, Sparkles } from 'lucide-react';
import { FURNACE_RECIPES, getItemDef, ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import { formatHudNumber } from '../game/format.ts';
import {
  VAULTBOX_SLOT_COUNT,
  type AtmMachineRecord,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type VaultboxRecord,
} from '../game/worldGen.ts';
import { RedGemIcon } from './RedGemIcon.tsx';

interface FurnacePanelProps {
  furnace: FurnaceRecord;
  inventory: InventorySlot[];
  onCraft: (recipeId: string) => void;
  onCollect: () => void;
}

export const FurnacePanel: React.FC<FurnacePanelProps> = ({
  furnace,
  inventory,
  onCraft,
  onCollect,
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!furnace.recipeId || !furnace.finishesAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [furnace.recipeId, furnace.finishesAt]);

  const getQty = (itemId: number) => inventory.find((s) => s.itemId === itemId)?.qty ?? 0;
  const coalQty = getQty(ITEM_IDS.COAL_FUEL);

  const activeRecipe = furnace.recipeId
    ? FURNACE_RECIPES.find((r) => r.id === furnace.recipeId)
    : null;
  const remainingMs = furnace.finishesAt ? Math.max(0, furnace.finishesAt - now) : 0;
  const totalMs =
    furnace.startedAt && furnace.finishesAt
      ? Math.max(1, furnace.finishesAt - furnace.startedAt)
      : 1;
  const pct = furnace.recipeId ? Math.min(100, Math.round((1 - remainingMs / totalMs) * 100)) : 0;
  const smeltingRecipes = FURNACE_RECIPES.filter((r) => r.category === 'smelting');

  return (
    <div
      data-testid="furnace-panel"
      className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#c2410c]">
          <Flame className="w-3.5 h-3.5" />
          <span>Stone Furnace</span>
        </div>
        <span className="text-[11px] font-mono-num text-[#23476d]">
          Coal Fuel: {formatHudNumber(coalQty)}
        </span>
      </div>

      {/* Active Batch or Ready Output */}
      {(furnace.readyOutputItemId > 0 || furnace.recipeId) && (
        <div className="pixel-slot p-2 flex items-center justify-between gap-2">
          {furnace.readyOutputItemId > 0 ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={getItemIconUrl(furnace.readyOutputItemId)}
                  alt="Output"
                  className="w-7 h-7 pixelated shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="text-xs font-bold text-[#14532d] truncate">
                  Ready: {furnace.readyOutputQty}×{' '}
                  {getItemDef(furnace.readyOutputItemId)?.name ?? 'Item'}
                </div>
              </div>
              <button
                type="button"
                onClick={onCollect}
                className="pixel-btn pixel-btn-emerald !py-1 !px-3 !text-xs shrink-0"
              >
                Collect
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#92400e]">
                  Smelting {activeRecipe?.name ?? 'Batch'}...
                </span>
                <span className="font-mono-num text-[#c2410c] font-bold">
                  {Math.ceil(remainingMs / 1000)}s
                </span>
              </div>
              <div className="h-2 rounded-[6px] bg-white/80 overflow-hidden border border-[#4172a3]">
                <div className="h-full rounded-[4px] bg-[#ea580c]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ore Smelting Recipes */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
        {smeltingRecipes.map((recipe) => {
          const hasCoal = coalQty >= recipe.fuelQty;
          const hasInputs = recipe.inputs.every((inp) => getQty(inp.itemId) >= inp.qty);
          const busy = Boolean(furnace.recipeId || furnace.readyOutputItemId > 0);
          const canCraft = !busy && hasCoal && hasInputs;
          return (
            <div
              key={recipe.id}
              className="hud-subpanel flex items-center justify-between gap-2 p-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <img
                  src={getItemIconUrl(recipe.outputItemId)}
                  alt={recipe.name}
                  className="w-6 h-6 pixelated shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#091e3a] truncate">
                    {recipe.outputQty}× {recipe.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#23476d] truncate">
                    {recipe.inputs
                      .map((i) => `${i.qty}× ${getItemDef(i.itemId)?.name ?? ''}`)
                      .join(' + ')}
                    {recipe.fuelQty > 0 ? ` + ${recipe.fuelQty} Coal` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={!canCraft}
                onClick={() => onCraft(recipe.id)}
                className="px-2.5 py-1.5 rounded-[8px] bg-[#ea580c] border border-[#9a3412] disabled:bg-[#c5dcf0]/70 disabled:border-[#4172a3]/60 disabled:text-[#23476d] text-white font-bold text-[11px] shrink-0 cursor-pointer"
              >
                {Math.round(recipe.durationMs / 1000)}s
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BfgPanelProps {
  bfg: BfgCollectorRecord;
  canManage: boolean;
  onToggle: () => void;
  onWithdraw: () => void;
}

export const BfgPanel: React.FC<BfgPanelProps> = ({
  bfg,
  canManage,
  onToggle,
  onWithdraw,
}) => {
  const totalItems = bfg.storedItems.reduce((s, i) => s + i.qty, 0);
  return (
    <div data-testid="bfg-panel" className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#0e7490]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>BFG Auto-Collector</span>
        </div>
        <span className="text-[11px] font-mono-num font-bold text-[#23476d]">
          {bfg.active ? 'ACTIVE' : 'PAUSED'}
        </span>
      </div>

      <div className="pixel-slot p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#23476d]">Buffered Gems</span>
          <strong className="inline-flex items-center gap-1 font-mono-num font-bold text-[#991b1b]">
            <RedGemIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{formatHudNumber(bfg.storedGems)}</span>
          </strong>
        </div>
        {bfg.storedItems.length === 0 ? (
          <div className="text-[11px] text-[#23476d]">
            Harvests mature trees (3 tiles) &amp; magnets drops (5 tiles) into buffer.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {bfg.storedItems.map((it, idx) => (
              <div
                key={`${it.itemId}-${idx}`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] bg-white/80 border border-[#4172a3] text-[#091e3a] text-[10px] font-mono-num"
              >
                <img
                  src={getItemIconUrl(it.itemId)}
                  alt=""
                  className="w-4 h-4 pixelated"
                  referrerPolicy="no-referrer"
                />
                <span>×{formatHudNumber(it.qty)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            className={`pixel-btn !py-1.5 !text-[10px] gap-1 ${
              bfg.active ? 'pixel-btn-emerald' : 'pixel-btn-primary'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{bfg.active ? 'Turn OFF' : 'Turn ON'}</span>
          </button>
          <button
            type="button"
            disabled={bfg.storedGems === 0 && totalItems === 0}
            onClick={onWithdraw}
            className="pixel-btn pixel-btn-gold !py-1.5 !text-[10px] gap-1 disabled:opacity-45"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Withdraw ({formatHudNumber(totalItems)})</span>
          </button>
        </div>
      )}
    </div>
  );
};

interface AtmPanelProps {
  atm: AtmMachineRecord;
  nowMs: number;
}

export const AtmPanel: React.FC<AtmPanelProps> = ({ atm, nowMs }) => {
  const intervalMs = Math.max(1, atm.intervalMs || 30 * 60 * 1000);
  const lastMs = atm.lastHarvestMs || atm.placedAtMs || nowMs;
  const elapsedMs = Math.max(0, nowMs - lastMs);
  const remSec = Math.max(0, Math.ceil((intervalMs - elapsedMs) / 1000));
  const remMin = Math.floor(remSec / 60);
  const remS = remSec % 60;
  const pct = Math.min(100, Math.round((elapsedMs / intervalMs) * 100));

  return (
    <div data-testid="atm-panel" className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#92400e]">
          <Coins className="w-3.5 h-3.5 text-[#b45309] shrink-0" />
          <span>ATM Machine</span>
        </div>
        <span className="px-1.5 py-0.5 rounded-[6px] bg-[#fef3c7]/90 border border-[#b45309] text-[9px] font-mono-num font-bold text-[#92400e]">
          5–125 GEMS
        </span>
      </div>
      <div className="text-[10px] text-[#23476d]">
        Generates 5–125 Gems every 30m–90m.
      </div>
      {atm.isReady ? (
        <div className="rounded-[8px] bg-[#dcfce7]/90 border-2 border-[#16a34a] p-2 flex items-center justify-between gap-2">
          <span className="font-pixel text-[10px] text-[#14532d]">
            READY! PUNCH ATM TO COLLECT!
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#fef3c7]/90 border border-[#b45309] text-xs font-mono-num font-bold text-[#92400e] shrink-0">
            <RedGemIcon className="w-3.5 h-3.5 shrink-0" />
            <span>+{formatHudNumber(atm.storedGems)}</span>
          </span>
        </div>
      ) : (
        <div className="hud-subpanel p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#23476d]">Mint Cycle ({Math.round(intervalMs / 60000)}m)</span>
            <span className="font-mono-num font-bold text-[#0369a1]">
              {remMin}m {String(remS).padStart(2, '0')}s
            </span>
          </div>
          <div className="h-2 rounded-[6px] bg-white/80 border border-[#4172a3] overflow-hidden">
            <div className="h-full rounded-[4px] bg-[#eab308] transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};

interface VaultboxPanelProps {
  vaultbox: VaultboxRecord;
  playerId: string;
  isAdminBypass?: boolean;
  inventory: InventorySlot[];
  onDeposit: (itemId: number, qty: number, slotIndex?: number, invIndex?: number) => void;
  onWithdraw: (slotIndex: number, qty?: number) => void;
}

export const VaultboxPanel: React.FC<VaultboxPanelProps> = ({
  vaultbox,
  playerId,
  isAdminBypass = false,
  inventory,
  onDeposit,
  onWithdraw,
}) => {
  const isOwner = vaultbox.ownerId === playerId || isAdminBypass;
  const slots = Array.from({ length: VAULTBOX_SLOT_COUNT }, (_, idx) => vaultbox.slots?.[idx] ?? null);
  const usedCount = slots.filter(Boolean).length;
  const depositable = inventory
    .map((slot, invIndex) => ({ slot, invIndex }))
    .filter(
      ({ slot }) =>
        slot.qty > 0 && slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH
    );

  const [selectedInvKey, setSelectedInvKey] = useState<string>('');
  const [selectedTargetTile, setSelectedTargetTile] = useState<number | null>(null);

  const resolvedInvEntry =
    depositable.find(
      ({ slot, invIndex }) => (slot.rodInstanceId ?? `${slot.itemId}-${invIndex}`) === selectedInvKey
    ) ?? depositable[0];

  return (
    <div data-testid="vaultbox-panel" className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#92400e]">
          <Package className="w-3.5 h-3.5 text-[#b45309] shrink-0" />
          <span>Vaultbox</span>
        </div>
        <span className="px-1.5 py-0.5 rounded-[6px] bg-[#dff1ff]/90 border border-[#0284c7] text-[10px] font-mono-num font-bold text-[#0369a1]">
          {usedCount}/{VAULTBOX_SLOT_COUNT} Tiles
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#23476d]">
        <span>Owner: <strong className="text-[#091e3a]">{vaultbox.ownerName}</strong></span>
        {isOwner ? (
          <span className="text-[#047857] font-semibold">Tap filled tile to withdraw</span>
        ) : (
          <span className="flex items-center gap-1 text-[#b91c1c] font-semibold">
            <Lock className="w-3 h-3" />
            <span>Owner Only</span>
          </span>
        )}
      </div>

      {/* 10 Storage Tiles (5x2 grid) */}
      <div data-testid="vaultbox-grid" className="grid grid-cols-5 gap-1.5">
        {slots.map((slot, idx) => {
          const def = slot ? getItemDef(slot.itemId) : undefined;
          const hasDur = slot && typeof slot.maxDurability === 'number' && slot.maxDurability > 0;
          const isSelectedEmpty = !slot && selectedTargetTile === idx;
          return (
            <button
              key={`vb-slot-${idx}`}
              type="button"
              data-testid={`vaultbox-tile-${idx}`}
              disabled={!isOwner}
              title={
                slot
                  ? `${def?.name ?? 'Item'} ×${formatHudNumber(slot.qty)}${isOwner ? ' (Click to withdraw)' : ''}`
                  : `Empty Storage Tile ${idx + 1}`
              }
              onClick={() => {
                if (!isOwner) return;
                if (slot) {
                  onWithdraw(idx);
                } else {
                  setSelectedTargetTile((cur) => (cur === idx ? null : idx));
                }
              }}
              className={`pixel-slot relative h-12 flex flex-col items-center justify-center p-1 ${
                slot
                  ? isOwner
                    ? 'cursor-pointer hover:!border-[#b45309]'
                    : 'cursor-default'
                  : isSelectedEmpty
                    ? '!border-[#0284c7] !bg-[#dbeafe] cursor-pointer'
                    : isOwner
                      ? 'opacity-85 cursor-pointer hover:opacity-100'
                      : 'opacity-70 cursor-default'
              }`}
            >
              {slot ? (
                <>
                  <img
                    src={getItemIconUrl(slot.itemId)}
                    alt={def?.name ?? 'Stored'}
                    className="w-6 h-6 pixelated"
                    referrerPolicy="no-referrer"
                  />
                  {!hasDur && (
                    <span className="absolute bottom-0.5 right-1 text-[8px] font-mono-num font-bold text-[#92400e] leading-none">
                      {formatHudNumber(slot.qty)}
                    </span>
                  )}
                  {hasDur && (
                    <div className="absolute inset-x-1 bottom-0.5 h-1 rounded-full bg-[#b8d4ee]">
                      <div
                        className="h-full rounded-full bg-[#16a34a]"
                        style={{
                          width: `${Math.round(
                            ((slot.durability ?? slot.maxDurability!) / slot.maxDurability!) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[8px] font-mono-num text-[#23476d] font-semibold">
                  {isSelectedEmpty ? 'TARGET' : idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Owner Deposit Controls */}
      {isOwner && (
        <div className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-1.5">
          {depositable.length === 0 ? (
            <span className="text-[10px] text-[#23476d]">No items in Backpack available to store.</span>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#92400e]">Deposit Item</span>
                {selectedTargetTile !== null && (
                  <span className="text-[#0369a1] font-mono-num font-semibold">
                    Into Tile #{selectedTargetTile + 1}
                  </span>
                )}
              </div>
              <select
                aria-label="Select item to deposit into Vaultbox"
                value={
                  resolvedInvEntry
                    ? resolvedInvEntry.slot.rodInstanceId ??
                      `${resolvedInvEntry.slot.itemId}-${resolvedInvEntry.invIndex}`
                    : ''
                }
                onChange={(e) => setSelectedInvKey(e.target.value)}
                className="hud-input w-full px-2 py-1 text-[11px] font-semibold"
              >
                {depositable.map(({ slot, invIndex }) => {
                  const key = slot.rodInstanceId ?? `${slot.itemId}-${invIndex}`;
                  const def = getItemDef(slot.itemId);
                  return (
                    <option key={key} value={key}>
                      {def?.name ?? `#${slot.itemId}`} (×{formatHudNumber(slot.qty)})
                    </option>
                  );
                })}
              </select>
              {resolvedInvEntry && (
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDeposit(
                        resolvedInvEntry.slot.itemId,
                        1,
                        selectedTargetTile ?? undefined,
                        resolvedInvEntry.invIndex
                      );
                      setSelectedTargetTile(null);
                    }}
                    className="pixel-btn pixel-btn-primary !py-1 !text-[10px]"
                  >
                    Store 1
                  </button>
                  <button
                    type="button"
                    disabled={resolvedInvEntry.slot.qty < 5}
                    onClick={() => {
                      onDeposit(
                        resolvedInvEntry.slot.itemId,
                        5,
                        selectedTargetTile ?? undefined,
                        resolvedInvEntry.invIndex
                      );
                      setSelectedTargetTile(null);
                    }}
                    className="pixel-btn pixel-btn-primary !py-1 !text-[10px] disabled:opacity-40"
                  >
                    Store 5
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeposit(
                        resolvedInvEntry.slot.itemId,
                        resolvedInvEntry.slot.qty,
                        selectedTargetTile ?? undefined,
                        resolvedInvEntry.invIndex
                      );
                      setSelectedTargetTile(null);
                    }}
                    className="pixel-btn pixel-btn-emerald !py-1 !text-[10px]"
                  >
                    Store All
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

