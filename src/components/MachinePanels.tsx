import React, { useEffect, useState } from 'react';
import { Coins, Flame, Hammer, Lock, Package, Power, Sparkles } from 'lucide-react';
import { FURNACE_RECIPES, getItemDef, ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import {
  VAULTBOX_SLOT_COUNT,
  type AtmMachineRecord,
  type BfgCollectorRecord,
  type FurnaceRecord,
  type VaultboxRecord,
} from '../game/worldGen.ts';

interface FurnacePanelProps {
  furnace: FurnaceRecord;
  inventory: InventorySlot[];
  onCraft: (recipeId: string) => void;
  onCollect: () => void;
  onRepair?: (toolItemId: number) => void;
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

  return (
    <div
      data-testid="furnace-panel"
      className="border-t border-[#28425e] pt-2 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#ffad6b]">
          <Flame className="w-3.5 h-3.5" />
          <span>Ore Smeltery</span>
        </div>
        <span className="text-[11px] font-mono-num text-[#b5cde3]">Coal: {coalQty}</span>
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
                <div className="text-xs font-bold text-[#82e068] truncate">
                  {furnace.readyOutputQty}× {getItemDef(furnace.readyOutputItemId)?.name ?? 'Bar'}
                </div>
              </div>
              <button
                type="button"
                onClick={onCollect}
                className="pixel-btn pixel-btn-emerald !py-1 !px-3 !text-xs shrink-0"
              >
                Claim
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#ffe18c]">
                  {activeRecipe?.name ?? 'Smelting'}
                </span>
                <span className="font-mono-num text-[#ffad6b]">
                  {Math.ceil(remainingMs / 1000)}s
                </span>
              </div>
              <div className="h-2 bg-[#060d14] overflow-hidden border border-[#243c54]">
                <div className="h-full bg-[#e67832]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ore Smelting Recipes (with explicit Fuel-to-Ore Ratios) */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
        {FURNACE_RECIPES.filter((r) => r.category === 'smelting').map((recipe) => {
          const hasCoal = coalQty >= recipe.fuelQty;
          const hasInputs = recipe.inputs.every((inp) => getQty(inp.itemId) >= inp.qty);
          const busy = Boolean(furnace.recipeId || furnace.readyOutputItemId > 0);
          const canCraft = !busy && hasCoal && hasInputs;
          return (
            <div
              key={recipe.id}
              data-testid={`furnace-recipe-${recipe.id}`}
              className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <img
                  src={getItemIconUrl(recipe.outputItemId)}
                  alt={recipe.name}
                  className="w-6 h-6 pixelated shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#f7f4eb] truncate">
                    {recipe.outputQty}× {recipe.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#9cb5cc] truncate">
                    {recipe.inputs
                      .map((i) => `${i.qty}× ${getItemDef(i.itemId)?.name ?? ''}`)
                      .join(' + ')}
                    {recipe.fuelQty > 0 ? ` : ${recipe.fuelQty}× Coal` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={!canCraft}
                onClick={() => onCraft(recipe.id)}
                className="px-2.5 py-1.5 rounded bg-[#e67832] disabled:bg-[#1e2d3b] disabled:text-[#65849c] text-[#1a0c04] font-bold text-[11px] shrink-0 cursor-pointer"
              >
                Smelt ({Math.round(recipe.durationMs / 1000)}s)
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
    <div data-testid="bfg-panel" className="border-t border-[#28425e] pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#38e8d8]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>BFG Collector</span>
        </div>
        <span className="text-[11px] font-mono-num text-[#9cb5cc]">
          {bfg.active ? 'ON' : 'OFF'}
        </span>
      </div>

      <div className="pixel-slot p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#9cb5cc]">Gems</span>
          <strong className="font-mono-num text-[#8cf7ee]">{Math.floor(bfg.storedGems)} G</strong>
        </div>
        {bfg.storedItems.length === 0 ? (
          <div className="text-[10px] font-mono-num text-[#6d8ba8]">
            Range: 3-tile harvest · 5-tile magnet
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {bfg.storedItems.map((it, idx) => (
              <div
                key={`${it.itemId}-${idx}`}
                className="flex items-center gap-1 px-1.5 py-0.5 bg-[#112233] border border-[#2b4763] text-[10px] font-mono-num"
              >
                <img
                  src={getItemIconUrl(it.itemId)}
                  alt=""
                  className="w-4 h-4 pixelated"
                  referrerPolicy="no-referrer"
                />
                <span>×{it.qty}</span>
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
            <span>{bfg.active ? 'OFF' : 'ON'}</span>
          </button>
          <button
            type="button"
            disabled={bfg.storedGems === 0 && totalItems === 0}
            onClick={onWithdraw}
            className="pixel-btn pixel-btn-gold !py-1.5 !text-[10px] gap-1 disabled:opacity-45"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Claim ({totalItems})</span>
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
    <div data-testid="atm-panel" className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#fde047]">
          <Coins className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
          <span>ATM</span>
        </div>
        <span className="px-1.5 py-0.5 bg-[#090e17] border border-[#38e8d8] text-[9px] font-mono-num font-bold text-[#8cf7ee]">
          5–125 G / 30–90m
        </span>
      </div>
      {atm.isReady ? (
        <div className="bg-[#064e3b] border-2 border-[#facc15] p-2 flex items-center justify-between gap-2">
          <span className="font-pixel text-[10px] text-[#fef08a]">
            READY · PUNCH TO CLAIM
          </span>
          <span className="px-2 py-0.5 bg-[#422006] border border-[#eab308] text-xs font-mono-num font-bold text-[#fde047] shrink-0">
            +{atm.storedGems} G
          </span>
        </div>
      ) : (
        <div className="bg-[#090e17] border border-[#1c2b3d] p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#9cb5cc]">Cycle ({Math.round(intervalMs / 60000)}m)</span>
            <span className="font-mono-num font-bold text-[#38e8d8]">
              {remMin}m {String(remS).padStart(2, '0')}s
            </span>
          </div>
          <div className="h-2 bg-[#03060a] border border-[#1c2b3d] overflow-hidden">
            <div className="h-full bg-[#eab308] transition-[width]" style={{ width: `${pct}%` }} />
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
    <div data-testid="vaultbox-panel" className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#fde047]">
          <Package className="w-3.5 h-3.5 text-[#facc15] shrink-0" />
          <span>Vaultbox</span>
        </div>
        <span className="px-1.5 py-0.5 bg-[#090e17] border border-[#2b4763] text-[10px] font-mono-num font-bold text-[#8cf7ee]">
          {usedCount}/{VAULTBOX_SLOT_COUNT} Tiles
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#9cb5cc]">
        <span>Owner: <strong className="text-[#f7f4eb]">{vaultbox.ownerName}</strong></span>
        {isOwner ? (
          <span className="text-[#82e068]">Tap filled tile to withdraw</span>
        ) : (
          <span className="flex items-center gap-1 text-[#fca5a5]">
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
                  ? `${def?.name ?? 'Item'} ×${slot.qty}${isOwner ? ' (Click to withdraw)' : ''}`
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
                    ? 'cursor-pointer hover:!border-[#fde047]'
                    : 'cursor-default'
                  : isSelectedEmpty
                    ? '!border-[#38e8d8] !bg-[#122638] cursor-pointer'
                    : isOwner
                      ? 'opacity-75 cursor-pointer hover:opacity-100'
                      : 'opacity-65 cursor-default'
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
                    <span className="absolute bottom-0.5 right-1 text-[8px] font-mono-num font-bold text-[#fde047] ui-text-shadow leading-none">
                      {slot.qty}
                    </span>
                  )}
                  {hasDur && (
                    <div className="absolute inset-x-1 bottom-0.5 h-1 bg-[#03060a]">
                      <div
                        className="h-full bg-[#4ec46a]"
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
                <span className="text-[8px] font-mono-num text-[#4e6b87]">
                  {isSelectedEmpty ? 'TARGET' : idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Owner Deposit Controls */}
      {isOwner && (
        <div className="border-t border-[#263c52] pt-2 flex flex-col gap-1.5">
          {depositable.length === 0 ? (
            <span className="text-[10px] text-[#6d8ba8]">No items in Backpack available to store.</span>
          ) : (
            <>
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#ffe18c]">Deposit Item</span>
                {selectedTargetTile !== null && (
                  <span className="text-[#38e8d8] font-mono-num">
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
                className="w-full px-1.5 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-[11px] text-white"
              >
                {depositable.map(({ slot, invIndex }) => {
                  const key = slot.rodInstanceId ?? `${slot.itemId}-${invIndex}`;
                  const def = getItemDef(slot.itemId);
                  return (
                    <option key={key} value={key}>
                      {def?.name ?? `#${slot.itemId}`} (×{slot.qty})
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

