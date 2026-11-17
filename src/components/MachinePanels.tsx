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
  worldOwnerId?: string | null;
  playerId: string;
  isAdminBypass?: boolean;
  inventory: InventorySlot[];
  onDeposit: (itemId: number, qty: number, slotIndex?: number, invIndex?: number) => void;
  onWithdraw: (slotIndex: number, qty?: number) => void;
}

export const VaultboxPanel: React.FC<VaultboxPanelProps> = ({
  vaultbox,
  worldOwnerId = null,
  playerId,
  isAdminBypass = false,
  inventory,
  onDeposit,
  onWithdraw,
}) => {
  const effectiveOwnerId = worldOwnerId ?? vaultbox.ownerId;
  const isOwner = effectiveOwnerId === playerId || isAdminBypass;
  const occupiedSlots = (vaultbox.slots ?? []).filter(
    (s): s is NonNullable<typeof s> => Boolean(s && s.qty > 0)
  );
  const usedCount = occupiedSlots.length;
  const canAddMore = usedCount < VAULTBOX_SLOT_COUNT;

  const depositable = inventory
    .map((slot, invIndex) => ({ slot, invIndex }))
    .filter(
      ({ slot }) =>
        slot.qty > 0 && slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH
    );

  const [view, setView] = useState<'vault' | 'inventory'>('vault');
  const [selectedWithdrawIdx, setSelectedWithdrawIdx] = useState<number | null>(null);
  const [withdrawCustomQty, setWithdrawCustomQty] = useState<string>('1');
  const [selectedInvKey, setSelectedInvKey] = useState<string | null>(null);
  const [depositCustomQty, setDepositCustomQty] = useState<string>('1');

  const selectedWithdrawSlot =
    selectedWithdrawIdx !== null ? occupiedSlots[selectedWithdrawIdx] ?? null : null;

  const selectedDepositEntry =
    selectedInvKey !== null
      ? depositable.find(
          ({ slot, invIndex }) =>
            (slot.rodInstanceId ?? `${slot.itemId}-${invIndex}`) === selectedInvKey
        ) ?? null
      : null;

  useEffect(() => {
    if (selectedWithdrawIdx !== null && !occupiedSlots[selectedWithdrawIdx]) {
      setSelectedWithdrawIdx(null);
    }
  }, [occupiedSlots, selectedWithdrawIdx]);

  if (view === 'inventory' && isOwner) {
    return (
      <div
        data-testid="vaultbox-inventory-view"
        className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-pixel text-[10px] text-[#0369a1]">
            Store Item From Backpack
          </span>
          <button
            type="button"
            data-testid="vaultbox-inventory-back"
            onClick={() => {
              setSelectedInvKey(null);
              setView('vault');
            }}
            className="pixel-btn !py-0.5 !px-2 !text-[10px]"
          >
            Back
          </button>
        </div>

        {depositable.length === 0 ? (
          <div className="pixel-slot p-3 text-center text-[11px] text-[#23476d]">
            No items available in Backpack to store.
          </div>
        ) : (
          <div
            data-testid="vaultbox-inventory-grid"
            className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-0.5"
          >
            {depositable.map(({ slot, invIndex }) => {
              const key = slot.rodInstanceId ?? `${slot.itemId}-${invIndex}`;
              const def = getItemDef(slot.itemId);
              const hasDur = typeof slot.maxDurability === 'number' && slot.maxDurability > 0;
              const isSelected = selectedInvKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  data-testid={`vaultbox-inv-item-${slot.itemId}`}
                  title={`${def?.name ?? `#${slot.itemId}`} ×${formatHudNumber(slot.qty)}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedInvKey(null);
                    } else {
                      setSelectedInvKey(key);
                      setDepositCustomQty(String(Math.min(slot.qty, 1)));
                    }
                  }}
                  className={`pixel-slot relative h-12 flex flex-col items-center justify-center p-1 cursor-pointer ${
                    isSelected ? '!border-[#0284c7] !bg-[#dbeafe] ring-2 ring-[#38bdf8]/60' : ''
                  }`}
                >
                  <img
                    src={getItemIconUrl(slot.itemId)}
                    alt={def?.name ?? 'Item'}
                    className="w-6 h-6 pixelated"
                    referrerPolicy="no-referrer"
                  />
                  {!hasDur && (
                    <span className="absolute bottom-0.5 right-1 text-[8px] font-mono-num font-bold text-[#091e3a] leading-none">
                      {formatHudNumber(slot.qty)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {selectedDepositEntry && (
          <div
            data-testid="vaultbox-deposit-controls"
            className="hud-subpanel p-2 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-[#091e3a] truncate">
                {getItemDef(selectedDepositEntry.slot.itemId)?.name ?? 'Item'}
              </span>
              <span className="font-mono-num font-bold text-[#0369a1]">
                Owned: ×{formatHudNumber(selectedDepositEntry.slot.qty)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="vaultbox-deposit-all"
                onClick={() => {
                  onDeposit(
                    selectedDepositEntry.slot.itemId,
                    selectedDepositEntry.slot.qty,
                    undefined,
                    selectedDepositEntry.invIndex
                  );
                  setSelectedInvKey(null);
                  setView('vault');
                }}
                className="pixel-btn pixel-btn-emerald !py-1 !px-2.5 !text-[10px] shrink-0"
              >
                All Stack
              </button>
              <input
                type="number"
                data-testid="vaultbox-deposit-qty"
                min={1}
                max={selectedDepositEntry.slot.qty}
                value={depositCustomQty}
                onChange={(e) => setDepositCustomQty(e.target.value)}
                aria-label="Custom Amount to Store"
                className="hud-input w-16 px-1.5 py-1 text-[11px] font-mono-num text-center"
              />
              <button
                type="button"
                data-testid="vaultbox-deposit-confirm"
                onClick={() => {
                  const parsed = Math.max(
                    1,
                    Math.min(
                      selectedDepositEntry.slot.qty,
                      Math.floor(Number(depositCustomQty) || 1)
                    )
                  );
                  onDeposit(
                    selectedDepositEntry.slot.itemId,
                    parsed,
                    undefined,
                    selectedDepositEntry.invIndex
                  );
                  setSelectedInvKey(null);
                  setView('vault');
                }}
                className="pixel-btn pixel-btn-primary flex-1 !py-1 !px-2 !text-[10px]"
              >
                Custom Amount
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
        <span>
          Owner: <strong className="text-[#091e3a]">{vaultbox.ownerName}</strong>
        </span>
        {isOwner ? (
          <span className="text-[#047857] font-semibold">Tap item to take or + to add</span>
        ) : (
          <span className="flex items-center gap-1 text-[#b91c1c] font-semibold">
            <Lock className="w-3 h-3" />
            <span>Owner Only</span>
          </span>
        )}
      </div>

      {/* Compact Storage Tiles: Occupied slots + single trailing + add tile (up to cap 6) */}
      <div data-testid="vaultbox-grid" className="grid grid-cols-3 gap-1.5">
        {occupiedSlots.map((slot, idx) => {
          const def = getItemDef(slot.itemId);
          const hasDur = typeof slot.maxDurability === 'number' && slot.maxDurability > 0;
          const isSelected = selectedWithdrawIdx === idx;
          return (
            <button
              key={`vb-slot-${idx}-${slot.itemId}`}
              type="button"
              data-testid={`vaultbox-tile-${idx}`}
              disabled={!isOwner}
              title={`${def?.name ?? 'Item'} ×${formatHudNumber(slot.qty)}${
                isOwner ? ' (Tap to withdraw)' : ''
              }`}
              onClick={() => {
                if (!isOwner) return;
                if (isSelected) {
                  setSelectedWithdrawIdx(null);
                } else {
                  setSelectedWithdrawIdx(idx);
                  setWithdrawCustomQty(String(Math.min(slot.qty, 1)));
                }
              }}
              className={`pixel-slot relative h-12 flex flex-col items-center justify-center p-1 ${
                isOwner ? 'cursor-pointer hover:!border-[#b45309]' : 'cursor-default'
              } ${isSelected ? '!border-[#b45309] !bg-[#fef3c7] ring-2 ring-[#fbbf24]/60' : ''}`}
            >
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
            </button>
          );
        })}

        {isOwner && canAddMore && (
          <button
            type="button"
            data-testid="vaultbox-add-tile"
            aria-label="Add item to Vaultbox"
            title="Store item from Backpack"
            onClick={() => {
              setSelectedWithdrawIdx(null);
              setSelectedInvKey(null);
              setView('inventory');
            }}
            className="pixel-slot h-12 flex items-center justify-center border-dashed !border-[#0284c7] text-[#0284c7] hover:!bg-[#dbeafe]/80 cursor-pointer"
          >
            <span className="font-pixel text-xl leading-none font-bold">+</span>
          </button>
        )}
      </div>

      {!isOwner && usedCount === 0 && (
        <div className="text-[10px] text-[#23476d] text-center py-1">Vaultbox is empty.</div>
      )}

      {isOwner && selectedWithdrawSlot && selectedWithdrawIdx !== null && (
        <div
          data-testid="vaultbox-withdraw-controls"
          className="hud-subpanel p-2 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-bold text-[#091e3a] truncate">
              {getItemDef(selectedWithdrawSlot.itemId)?.name ?? 'Stored Item'}
            </span>
            <span className="font-mono-num font-bold text-[#92400e]">
              Stored: ×{formatHudNumber(selectedWithdrawSlot.qty)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="vaultbox-withdraw-all"
              onClick={() => {
                onWithdraw(selectedWithdrawIdx, selectedWithdrawSlot.qty);
                setSelectedWithdrawIdx(null);
              }}
              className="pixel-btn pixel-btn-gold !py-1 !px-2.5 !text-[10px] shrink-0"
            >
              All Stack
            </button>
            <input
              type="number"
              data-testid="vaultbox-withdraw-qty"
              min={1}
              max={selectedWithdrawSlot.qty}
              value={withdrawCustomQty}
              onChange={(e) => setWithdrawCustomQty(e.target.value)}
              aria-label="Custom Amount to Take"
              className="hud-input w-16 px-1.5 py-1 text-[11px] font-mono-num text-center"
            />
            <button
              type="button"
              data-testid="vaultbox-withdraw-confirm"
              onClick={() => {
                const parsed = Math.max(
                  1,
                  Math.min(
                    selectedWithdrawSlot.qty,
                    Math.floor(Number(withdrawCustomQty) || 1)
                  )
                );
                onWithdraw(selectedWithdrawIdx, parsed);
                setSelectedWithdrawIdx(null);
              }}
              className="pixel-btn pixel-btn-primary flex-1 !py-1 !px-2 !text-[10px]"
            >
              Custom Amount
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

