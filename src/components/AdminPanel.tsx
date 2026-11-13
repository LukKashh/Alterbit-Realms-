import React, { useEffect, useState } from 'react';
import { CATALOG, ITEM_IDS, type DropEntry } from '../game/catalog.ts';
import {
  cloneGameConfig,
  getEffectiveItemDef,
  type GameConfig,
} from '../game/config.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';

interface AdminPanelProps {
  gameConfig: GameConfig;
  inWorld: boolean;
  onSaveConfig: (cfg: GameConfig) => void;
  onAdminAction: (opts: {
    action: 'grant_item' | 'grant_gems' | 'grow_all_trees' | 'reset_config';
    itemId?: number;
    qty?: number;
    gems?: number;
  }) => void;
  onClose?: () => void;
}

const CONFIGURABLE_ITEMS = Object.values(CATALOG).filter(
  (item) =>
    item.id !== ITEM_IDS.AIR &&
    item.id !== ITEM_IDS.BG_SKY &&
    item.id !== ITEM_IDS.BEDROCK &&
    item.id !== ITEM_IDS.ENTRANCE_PORTAL &&
    item.category !== 'tool' &&
    item.category !== 'wearable'
);

const ALL_DROP_CANDIDATES = Object.values(CATALOG).filter(
  (item) =>
    item.id !== ITEM_IDS.AIR &&
    item.id !== ITEM_IDS.BG_SKY &&
    item.id !== ITEM_IDS.FIST &&
    item.id !== ITEM_IDS.WRENCH &&
    item.id !== ITEM_IDS.BEDROCK &&
    item.id !== ITEM_IDS.ENTRANCE_PORTAL
);

export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameConfig,
  inWorld,
  onSaveConfig,
  onAdminAction,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<'drops' | 'mechanics' | 'tools'>('drops');
  const [draft, setDraft] = useState<GameConfig>(() => cloneGameConfig(gameConfig));
  const [selectedTileId, setSelectedTileId] = useState<number>(ITEM_IDS.MEADOW_TURF);

  const [grantItemId, setGrantItemId] = useState<number>(ITEM_IDS.RICH_SOIL);
  const [grantQty, setGrantQty] = useState<number>(25);
  const [grantGemsAmt, setGrantGemsAmt] = useState<number>(500);

  useEffect(() => {
    setDraft(cloneGameConfig(gameConfig));
  }, [gameConfig]);

  const effectiveDef = getEffectiveItemDef(selectedTileId, draft);
  const currentOverride = draft.itemOverrides[selectedTileId] ?? {};
  const activeDrops: DropEntry[] = currentOverride.drops ?? effectiveDef?.drops ?? [];

  const updateItemField = (field: 'hardness' | 'gemValue' | 'xpValue', value: number) => {
    setDraft((prev) => {
      const next = cloneGameConfig(prev);
      next.itemOverrides[selectedTileId] = {
        ...(next.itemOverrides[selectedTileId] ?? {}),
        [field]: value,
      };
      return next;
    });
  };

  const updateDropsList = (nextDrops: DropEntry[]) => {
    setDraft((prev) => {
      const next = cloneGameConfig(prev);
      next.itemOverrides[selectedTileId] = {
        ...(next.itemOverrides[selectedTileId] ?? {}),
        drops: nextDrops,
      };
      return next;
    });
  };

  const addDropEntry = () => {
    const nextDrops: DropEntry[] = [
      ...activeDrops,
      { itemId: selectedTileId, chance: 0.5, minQty: 1, maxQty: 1 },
    ];
    updateDropsList(nextDrops);
  };

  const updateMechanic = <K extends keyof GameConfig['mechanics']>(
    key: K,
    val: number
  ) => {
    setDraft((prev) => ({
      ...prev,
      mechanics: {
        ...prev.mechanics,
        [key]: val,
      },
    }));
  };

  return (
    <div
      data-testid="admin-dev-panel"
      className="flex flex-col gap-3 text-xs text-[#eaf2fa] h-full"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#2b4561] pb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#f2b738] text-[#1a1204] font-pixel text-[10px]">
            ADMIN DEV
          </span>
          <h3 className="font-pixel text-xs text-[#ffe18c]">
            Drop Rates, Variety &amp; Mechanics Config
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
          >
            Close
          </button>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab('drops')}
          className={`py-1.5 rounded font-bold cursor-pointer ${
            subTab === 'drops'
              ? 'bg-[#214463] border border-[#f2b738] text-[#ffe18c]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          Block &amp; BG Drops
        </button>
        <button
          type="button"
          onClick={() => setSubTab('mechanics')}
          className={`py-1.5 rounded font-bold cursor-pointer ${
            subTab === 'mechanics'
              ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          Mechanics &amp; Scale
        </button>
        <button
          type="button"
          onClick={() => setSubTab('tools')}
          className={`py-1.5 rounded font-bold cursor-pointer ${
            subTab === 'tools'
              ? 'bg-[#214463] border border-[#82e068] text-[#82e068]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          Admin Quick Tools
        </button>
      </div>

      {/* Tab 1: Block, Background, Seed Drop Rates & Variety */}
      {subTab === 'drops' && (
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-[#9cb5cc]">
                Select Block / Background / Seed
              </span>
              <select
                aria-label="Configurable Tile"
                value={selectedTileId}
                onChange={(e) => setSelectedTileId(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                {CONFIGURABLE_ITEMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.category.toUpperCase()}] {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-3 gap-1.5">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-[#9cb5cc]">Hardness</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={effectiveDef?.hardness ?? 3}
                  onChange={(e) =>
                    updateItemField('hardness', Math.max(1, Math.min(20, Number(e.target.value))))
                  }
                  className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-[#9cb5cc]">Max Gems</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={effectiveDef?.gemValue ?? 0}
                  onChange={(e) =>
                    updateItemField('gemValue', Math.max(0, Math.min(100, Number(e.target.value))))
                  }
                  className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-[#9cb5cc]">XP Value</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={effectiveDef?.xpValue ?? 1}
                  onChange={(e) =>
                    updateItemField('xpValue', Math.max(0, Math.min(200, Number(e.target.value))))
                  }
                  className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <img
                src={getItemIconUrl(selectedTileId)}
                alt={effectiveDef?.name ?? 'Tile'}
                className="w-6 h-6 pixelated"
                referrerPolicy="no-referrer"
              />
              <span className="font-bold text-[#ffe18c]">
                {effectiveDef?.name} Drop Table ({activeDrops.length} entries)
              </span>
            </div>
            <button
              type="button"
              onClick={addDropEntry}
              className="px-2.5 py-1 rounded bg-[#214463] hover:bg-[#2d5b82] border border-[#78c8f5] text-[11px] font-bold text-white cursor-pointer"
            >
              + Add Drop Item
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {activeDrops.length === 0 ? (
              <p className="text-[11px] text-[#8aa4bd] bg-[#09131d] border border-[#263c52] rounded p-2">
                No custom item drops configured for this tile. Click &quot;+ Add Drop Item&quot; to assign drops.
              </p>
            ) : (
              activeDrops.map((entry, idx) => (
                <div
                  key={`${idx}-${entry.itemId}`}
                  className="grid grid-cols-12 items-center gap-1.5 bg-[#09131d] border border-[#263c52] rounded p-1.5"
                >
                  <select
                    aria-label={`Drop ${idx + 1} Item`}
                    value={entry.itemId}
                    onChange={(e) => {
                      const next = activeDrops.map((d, i) =>
                        i === idx ? { ...d, itemId: Number(e.target.value) } : d
                      );
                      updateDropsList(next);
                    }}
                    className="col-span-5 px-1.5 py-1 rounded bg-[#08101a] border border-[#2d4863] text-[11px] text-white"
                  >
                    {ALL_DROP_CANDIDATES.map((cand) => (
                      <option key={cand.id} value={cand.id}>
                        {cand.name}
                      </option>
                    ))}
                  </select>
                  <label className="col-span-2 flex flex-col">
                    <span className="text-[9px] text-[#8aa4bd]">Rate %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(entry.chance * 100)}
                      onChange={(e) => {
                        const pct = Math.max(0, Math.min(100, Number(e.target.value)));
                        const next = activeDrops.map((d, i) =>
                          i === idx ? { ...d, chance: pct / 100 } : d
                        );
                        updateDropsList(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#08101a] border border-[#2d4863] text-[11px] font-mono-num text-white"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col">
                    <span className="text-[9px] text-[#8aa4bd]">Min</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={entry.minQty}
                      onChange={(e) => {
                        const minQ = Math.max(1, Math.min(50, Number(e.target.value)));
                        const next = activeDrops.map((d, i) =>
                          i === idx ? { ...d, minQty: minQ, maxQty: Math.max(minQ, d.maxQty) } : d
                        );
                        updateDropsList(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#08101a] border border-[#2d4863] text-[11px] font-mono-num text-white"
                    />
                  </label>
                  <label className="col-span-2 flex flex-col">
                    <span className="text-[9px] text-[#8aa4bd]">Max</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={entry.maxQty}
                      onChange={(e) => {
                        const maxQ = Math.max(entry.minQty, Math.min(50, Number(e.target.value)));
                        const next = activeDrops.map((d, i) =>
                          i === idx ? { ...d, maxQty: maxQ } : d
                        );
                        updateDropsList(next);
                      }}
                      className="px-1.5 py-0.5 rounded bg-[#08101a] border border-[#2d4863] text-[11px] font-mono-num text-white"
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove Drop ${idx + 1}`}
                    onClick={() => updateDropsList(activeDrops.filter((_, i) => i !== idx))}
                    className="col-span-1 py-1 rounded bg-[#3b1b1f] hover:bg-[#57262c] text-[#ffb0b0] font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Live World Mechanics & Display Scale */}
      {subTab === 'mechanics' && (
        <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 flex-1">
          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">World View Scale</span>
              <span className="font-mono-num text-[#8cf7ee]">{draft.mechanics.viewScale.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={2.25}
              step={0.05}
              value={draft.mechanics.viewScale}
              onChange={(e) => updateMechanic('viewScale', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Interaction Reach (Tiles)</span>
              <span className="font-mono-num text-[#8cf7ee]">{draft.mechanics.reachTiles.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={6}
              step={0.1}
              value={draft.mechanics.reachTiles}
              onChange={(e) => updateMechanic('reachTiles', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Punch Cooldown (ms)</span>
              <span className="font-mono-num text-[#8cf7ee]">{Math.round(draft.mechanics.punchCooldownMs)}</span>
            </div>
            <input
              type="range"
              min={70}
              max={400}
              step={5}
              value={draft.mechanics.punchCooldownMs}
              onChange={(e) => updateMechanic('punchCooldownMs', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Global Gem Chance</span>
              <span className="font-mono-num text-[#8cf7ee]">
                {Math.round(draft.mechanics.globalGemDropChance * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={draft.mechanics.globalGemDropChance}
              onChange={(e) => updateMechanic('globalGemDropChance', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Move Speed (px/s)</span>
              <span className="font-mono-num text-[#8cf7ee]">{Math.round(draft.mechanics.moveSpeed)}</span>
            </div>
            <input
              type="range"
              min={120}
              max={420}
              step={5}
              value={draft.mechanics.moveSpeed}
              onChange={(e) => updateMechanic('moveSpeed', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Jump Velocity</span>
              <span className="font-mono-num text-[#8cf7ee]">{Math.round(draft.mechanics.jumpVelocity)}</span>
            </div>
            <input
              type="range"
              min={-680}
              max={-300}
              step={5}
              value={draft.mechanics.jumpVelocity}
              onChange={(e) => updateMechanic('jumpVelocity', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Gravity</span>
              <span className="font-mono-num text-[#8cf7ee]">{Math.round(draft.mechanics.gravity)}</span>
            </div>
            <input
              type="range"
              min={600}
              max={2000}
              step={20}
              value={draft.mechanics.gravity}
              onChange={(e) => updateMechanic('gravity', Number(e.target.value))}
            />
          </label>

          <label className="flex flex-col gap-1 bg-[#09131d] border border-[#263c52] rounded p-2">
            <div className="flex justify-between">
              <span className="font-bold text-[#ffe18c]">Tree Growth Speed</span>
              <span className="font-mono-num text-[#8cf7ee]">{draft.mechanics.growthMultiplier.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={draft.mechanics.growthMultiplier}
              onChange={(e) => updateMechanic('growthMultiplier', Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {/* Tab 3: Admin Quick Development Tools */}
      {subTab === 'tools' && (
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
          <div className="bg-[#09131d] border border-[#263c52] rounded p-2.5 flex flex-col gap-2">
            <span className="font-bold text-[#ffe18c]">Grant Item to Backpack</span>
            <div className="flex gap-1.5">
              <select
                aria-label="Grant Item Select"
                value={grantItemId}
                onChange={(e) => setGrantItemId(Number(e.target.value))}
                className="flex-1 px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                {ALL_DROP_CANDIDATES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={200}
                value={grantQty}
                onChange={(e) => setGrantQty(Math.max(1, Math.min(200, Number(e.target.value))))}
                className="w-16 px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
              />
              <button
                type="button"
                onClick={() =>
                  onAdminAction({ action: 'grant_item', itemId: grantItemId, qty: grantQty })
                }
                className="px-3 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] font-bold cursor-pointer"
              >
                Grant
              </button>
            </div>
          </div>

          <div className="bg-[#09131d] border border-[#263c52] rounded p-2.5 flex flex-col gap-2">
            <span className="font-bold text-[#8cf7ee]">Grant Gems</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                min={1}
                max={100000}
                value={grantGemsAmt}
                onChange={(e) => setGrantGemsAmt(Math.max(1, Number(e.target.value)))}
                className="flex-1 px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
              />
              <button
                type="button"
                onClick={() => onAdminAction({ action: 'grant_gems', gems: grantGemsAmt })}
                className="px-3 py-1.5 rounded bg-[#38e8d8] text-[#062024] font-bold cursor-pointer"
              >
                + Gems
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!inWorld}
              onClick={() => onAdminAction({ action: 'grow_all_trees' })}
              className="py-2 px-3 rounded bg-[#214463] hover:bg-[#2d5b82] disabled:bg-[#142230] disabled:text-[#637e96] border border-[#78c8f5] font-bold text-white cursor-pointer"
            >
              Mature All World Trees
            </button>
            <button
              type="button"
              onClick={() => onAdminAction({ action: 'reset_config' })}
              className="py-2 px-3 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] font-bold text-[#ffd4d4] cursor-pointer"
            >
              Reset All Defaults
            </button>
          </div>
        </div>
      )}

      {/* Save Configuration Footer */}
      {subTab !== 'tools' && (
        <div className="flex items-center justify-between gap-2 border-t border-[#2b4561] pt-2">
          <span className="text-[11px] text-[#9cb5cc]">
            Live server config syncs immediately to all active players.
          </span>
          <button
            type="button"
            onClick={() => onSaveConfig(draft)}
            className="px-4 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-bold text-xs cursor-pointer"
          >
            Save &amp; Apply Live
          </button>
        </div>
      )}
    </div>
  );
};
