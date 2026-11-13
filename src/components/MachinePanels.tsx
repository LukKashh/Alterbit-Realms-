import React, { useEffect, useState } from 'react';
import { Flame, Hammer, Power, Sparkles, Wrench } from 'lucide-react';
import { FURNACE_RECIPES, getItemDef, ITEM_IDS, type FurnaceCategory } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import type { BfgCollectorRecord, FurnaceRecord } from '../game/worldGen.ts';

interface FurnacePanelProps {
  furnace: FurnaceRecord;
  inventory: InventorySlot[];
  onCraft: (recipeId: string) => void;
  onCollect: () => void;
  onRepair: (toolItemId: number) => void;
}

export const FurnacePanel: React.FC<FurnacePanelProps> = ({
  furnace,
  inventory,
  onCraft,
  onCollect,
  onRepair,
}) => {
  const [cat, setCat] = useState<FurnaceCategory | 'repair'>('smelting');
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

  const damagedTools = inventory.filter(
    (s) =>
      typeof s.maxDurability === 'number' &&
      (s.durability ?? s.maxDurability) < s.maxDurability
  );

  return (
    <div
      data-testid="furnace-panel"
      className="border-t border-[#28425e] pt-2 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#ffad6b]">
          <Flame className="w-3.5 h-3.5" />
          <span>Stone Furnace</span>
        </div>
        <span className="text-[11px] font-mono-num text-[#b5cde3]">Coal Fuel: {coalQty}</span>
      </div>

      {/* Active Batch or Ready Output */}
      {(furnace.readyOutputItemId > 0 || furnace.recipeId) && (
        <div className="bg-[#09131d] border border-[#38536e] rounded p-2 flex items-center justify-between gap-2">
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
                  Ready: {furnace.readyOutputQty}×{' '}
                  {getItemDef(furnace.readyOutputItemId)?.name ?? 'Item'}
                </div>
              </div>
              <button
                type="button"
                onClick={onCollect}
                className="px-3 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] font-bold text-xs shrink-0 cursor-pointer"
              >
                Collect
              </button>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[#ffe18c]">
                  Smelting {activeRecipe?.name ?? 'Batch'}...
                </span>
                <span className="font-mono-num text-[#ffad6b]">
                  {Math.ceil(remainingMs / 1000)}s
                </span>
              </div>
              <div className="h-2 bg-[#060d14] rounded overflow-hidden border border-[#243c54]">
                <div className="h-full bg-[#e67832]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Tabs */}
      <div className="grid grid-cols-4 gap-1">
        {(
          [
            ['smelting', 'Smelt'],
            ['gear', 'Gear'],
            ['culinary', 'Cook'],
            ['repair', `Repair (${damagedTools.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCat(id)}
            className={`py-1 rounded text-[10px] font-bold border cursor-pointer ${
              cat === id
                ? 'bg-[#2a2012] border-[#f2b738] text-[#ffe18c]'
                : 'bg-[#09131d] border-[#263c52] text-[#9cb5cc]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {cat !== 'repair' ? (
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-0.5">
          {FURNACE_RECIPES.filter((r) => r.category === cat).map((recipe) => {
            const hasCoal = coalQty >= recipe.fuelQty;
            const hasInputs = recipe.inputs.every((inp) => getQty(inp.itemId) >= inp.qty);
            const busy = Boolean(furnace.recipeId || furnace.readyOutputItemId > 0);
            const canCraft = !busy && hasCoal && hasInputs;
            return (
              <div
                key={recipe.id}
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
                      {recipe.fuelQty > 0 ? ` + ${recipe.fuelQty} Coal` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canCraft}
                  onClick={() => onCraft(recipe.id)}
                  className="px-2.5 py-1.5 rounded bg-[#e67832] disabled:bg-[#1e2d3b] disabled:text-[#65849c] text-[#1a0c04] font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  {Math.round(recipe.durationMs / 1000)}s
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-0.5">
          {damagedTools.length === 0 ? (
            <p className="text-[11px] text-[#8aa4bd] bg-[#09131d] rounded p-2">
              All Pickaxes &amp; Fishing Rods in your Backpack are at 100% durability.
            </p>
          ) : (
            damagedTools.map((slot, i) => {
              const def = getItemDef(slot.itemId);
              if (!def || !def.repairMaterialId || !def.repairQty) return null;
              const matDef = getItemDef(def.repairMaterialId);
              const canRepair = getQty(def.repairMaterialId) >= def.repairQty;
              return (
                <div
                  key={`${slot.itemId}-${i}`}
                  className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getItemIconUrl(slot.itemId)}
                      alt={def.name}
                      className="w-6 h-6 pixelated shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">
                        {def.name} ({slot.durability}/{slot.maxDurability})
                      </div>
                      <div className="text-[10px] font-mono-num text-[#ffe18c]">
                        Cost: {def.repairQty}× {matDef?.name ?? 'Material'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canRepair}
                    onClick={() => onRepair(slot.itemId)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#4aa64d] disabled:bg-[#1e2d3b] disabled:text-[#65849c] text-[#081709] font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Repair</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
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
          <span>BFG Auto-Collector</span>
        </div>
        <span className="text-[11px] font-mono-num text-[#9cb5cc]">
          {bfg.active ? 'ACTIVE' : 'PAUSED'}
        </span>
      </div>

      <div className="bg-[#09131d] border border-[#263c52] rounded p-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#9cb5cc]">Buffered Gems</span>
          <strong className="font-mono-num text-[#8cf7ee]">{Math.floor(bfg.storedGems)} G</strong>
        </div>
        {bfg.storedItems.length === 0 ? (
          <div className="text-[11px] text-[#6d8ba8]">
            Harvests mature trees (3 tiles) &amp; magnets drops (5 tiles) into buffer.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {bfg.storedItems.map((it) => (
              <div
                key={it.itemId}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#112233] border border-[#2b4763] text-[10px] font-mono-num"
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
            className={`flex items-center justify-center gap-1 py-1.5 rounded font-bold text-xs border cursor-pointer ${
              bfg.active
                ? 'bg-[#193829] border-[#82e068] text-[#a8f794]'
                : 'bg-[#142538] border-[#3a597a] text-[#c7d9eb]'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{bfg.active ? 'Turn OFF' : 'Turn ON'}</span>
          </button>
          <button
            type="button"
            disabled={bfg.storedGems === 0 && totalItems === 0}
            onClick={onWithdraw}
            className="flex items-center justify-center gap-1 py-1.5 rounded bg-[#f2b738] disabled:bg-[#1e2d3b] disabled:text-[#65849c] text-[#1a1204] font-bold text-xs cursor-pointer"
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>Withdraw ({totalItems})</span>
          </button>
        </div>
      )}
    </div>
  );
};
