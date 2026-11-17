import React, { useState, useMemo } from 'react';
import {
  CATALOG,
  isCropBlock,
  isCropItem,
  isCropSeed,
  isStandardBaselineBlock,
  type DropEntry,
  type ItemDefinition,
  type ItemRarity,
} from '../game/catalog.ts';
import {
  cloneGameConfig,
  getEffectiveItemDef,
  type GameConfig,
  type ItemConfigOverride,
} from '../game/config.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import { AdminWorldsBrowser } from './AdminWorldsBrowser.tsx';
import { AdminDatasetPanel } from './AdminDatasetPanel.tsx';
import { AdminEntityPanel, type WorldEntitiesSnapshot } from './AdminEntityPanel.tsx';
import { RedGemIcon } from './RedGemIcon.tsx';
import { isOpeningFrameTickLocked, openingFrameTick } from '../game/openingFrameTick.ts';
import type { WorldSummary } from '../game/network.ts';
import {
  Shield,
  Search,
  Check,
  X,
  Sliders,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Undo2,
  RefreshCw,
  Wand2,
  Globe,
  ArrowLeft,
  Layers,
  ChevronRight,
  Users,
} from 'lucide-react';

export interface AdminActionPayload {
  action:
    | 'grant_item'
    | 'grant_gems'
    | 'clear_inventory'
    | 'delete_inventory_slot'
    | 'grow_all_trees'
    | 'reset_config'
    | 'rebuild_nexus'
    | 'sys_paint_tile'
    | 'sys_clear_tile'
    | 'sys_fill_rect'
    | 'sys_set_spawn'
    | 'sys_reset_world';
  itemId?: number;
  qty?: number;
  gems?: number;
  slotIndex?: number;
  rodInstanceId?: string;
  tx?: number;
  ty?: number;
  tx2?: number;
  ty2?: number;
  layer?: 'fg' | 'bg' | 'both';
}

export interface AdminPanelProps {
  gameConfig: GameConfig;
  onSaveConfig: (cfg: GameConfig) => void;
  onAdminAction?: (opts: AdminActionPayload) => void;
  inWorld?: boolean;
  worldName?: string;
  coords?: { tx: number; ty: number };
  adminWorldEdit?: boolean;
  adminBrushItemId?: number | null;
  onToggleAdminWorldEdit?: (enabled: boolean, brushItemId?: number | null) => void;
  worlds?: WorldSummary[];
  onRefreshWorlds?: () => void;
  onWarpWorld?: (worldName: string) => void;
  entitiesSnapshot?: WorldEntitiesSnapshot | null;
  onRefreshEntities?: () => void;
  onTeleportEntity?: (opts: {
    entityKind: 'player' | 'npc';
    entityId: string;
    targetTx?: number;
    targetTy?: number;
    summon?: boolean;
  }) => void;
  initialView?: 'selection' | 'catalog' | 'worlds' | 'datasets' | 'entities';
  onClose: () => void;
}

type FilterCategory =
  | 'all'
  | 'foreground'
  | 'farmable'
  | 'crop'
  | 'seed'
  | 'misc'
  | 'background'
  | 'interactive'
  | 'wearable'
  | 'audit_non_baseline'
  | 'audit_edited'
  | 'audit_missing_drops';

interface UndoSnapshotEntry {
  itemId: number;
  hadOverride: boolean;
  previousOverride?: ItemConfigOverride;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameConfig,
  onSaveConfig,
  onAdminAction,
  worldName,
  coords,
  adminWorldEdit = false,
  adminBrushItemId = null,
  onToggleAdminWorldEdit,
  worlds = [],
  onRefreshWorlds,
  onWarpWorld,
  entitiesSnapshot = null,
  onRefreshEntities,
  onTeleportEntity,
  initialView = 'selection',
  onClose,
}) => {
  const [adminView, setAdminView] = useState<'selection' | 'catalog' | 'worlds' | 'datasets' | 'entities'>(
    initialView
  );
  const switchAdminView = (nextView: 'selection' | 'catalog' | 'worlds' | 'datasets' | 'entities') => {
    if (isOpeningFrameTickLocked()) return;
    openingFrameTick();
    setAdminView(nextView);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');

  // Persistent Multi-Select state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchConfirmPending, setBatchConfirmPending] = useState(false);

  // Batch Editor fields + Per-field Apply checkboxes
  const [applyHardness, setApplyHardness] = useState(false);
  const [batchHardness, setBatchHardness] = useState<number>(3);

  const [applyRarity, setApplyRarity] = useState(false);
  const [batchRarity, setBatchRarity] = useState<ItemRarity>('common');

  const [applyXp, setApplyXp] = useState(false);
  const [batchXp, setBatchXp] = useState<number>(1);

  const [applyGems, setApplyGems] = useState(false);
  const [batchGems, setBatchGems] = useState<number>(0);

  const [applyDrops, setApplyDrops] = useState(false);
  const [batchSelfDropMode, setBatchSelfDropMode] = useState(true);
  const [batchSelfDropChance, setBatchSelfDropChance] = useState<number>(0.125);
  const [batchSelfDropQty, setBatchSelfDropQty] = useState<number>(1);
  const [batchExtraDrops, setBatchExtraDrops] = useState<DropEntry[]>([]);
  const [batchDropSearch, setBatchDropSearch] = useState('');

  // 1-Step Per-Item Snapshot Undo
  const [lastBatchSnapshot, setLastBatchSnapshot] = useState<UndoSnapshotEntry[] | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Single-item inspector state
  const [inspectedItemId, setInspectedItemId] = useState<number | null>(null);
  const [editHardness, setEditHardness] = useState<number>(3);
  const [editRarity, setEditRarity] = useState<ItemRarity>('common');
  const [editXp, setEditXp] = useState<number>(1);
  const [editGems, setEditGems] = useState<number>(0);
  const [editGrowthTimeSec, setEditGrowthTimeSec] = useState<number>(30);
  const [editDrops, setEditDrops] = useState<DropEntry[]>([]);
  const [extraDropSearch, setExtraDropSearch] = useState('');

  const showToast = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const allItems = useMemo(() => {
    return Object.values(CATALOG)
      .filter((item) => item.id > 0)
      .map((item) => getEffectiveItemDef(item.id, gameConfig) ?? item)
      .sort((a, b) => a.id - b.id);
  }, [gameConfig]);

  const isNonBaselineBlock = (item: ItemDefinition): boolean => {
    if (!isStandardBaselineBlock(item)) return false;
    const drops = item.drops ?? [];
    const hasExactSelfDrop =
      drops.length === 1 &&
      drops[0].itemId === item.id &&
      Math.abs(drops[0].chance - 0.125) < 0.0001 &&
      drops[0].minQty === 1 &&
      drops[0].maxQty === 1;
    const hasZeroGems = (item.gemValue ?? 0) === 0;
    const hasOneXp = (item.xpValue ?? 1) === 1;
    return !(hasExactSelfDrop && hasZeroGems && hasOneXp);
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q) && !String(item.id).includes(q)) {
        return false;
      }
      switch (categoryFilter) {
        case 'foreground':
          return item.category === 'foreground' && !item.farmableTier && !isCropBlock(item.id);
        case 'farmable':
          return item.category === 'farmable';
        case 'crop':
          return isCropBlock(item.id) || isCropItem(item.id) || isCropSeed(item.id);
        case 'seed':
          return item.category === 'seed';
        case 'misc':
          return item.category === 'misc';
        case 'background':
          return item.category === 'background';
        case 'interactive':
          return item.category === 'interactive';
        case 'wearable':
          return (
            item.category === 'wearable' ||
            item.category === 'tool' ||
            item.category === 'consumable'
          );
        case 'audit_non_baseline':
          return isNonBaselineBlock(item);
        case 'audit_edited':
          return Boolean(gameConfig.itemOverrides?.[item.id]);
        case 'audit_missing_drops':
          return (
            item.breakable &&
            (item.category === 'foreground' ||
              item.category === 'background' ||
              item.category === 'interactive') &&
            (!item.drops || item.drops.length === 0)
          );
        default:
          return true;
      }
    });
  }, [allItems, searchQuery, categoryFilter, gameConfig.itemOverrides]);

  const inspectedItem = useMemo(() => {
    if (inspectedItemId === null) return null;
    return getEffectiveItemDef(inspectedItemId, gameConfig) ?? CATALOG[inspectedItemId] ?? null;
  }, [inspectedItemId, gameConfig]);

  const openInspector = (item: ItemDefinition) => {
    setInspectedItemId(item.id);
    setEditHardness(item.hardness ?? 3);
    setEditRarity(item.rarity ?? 'common');
    setEditXp(item.xpValue ?? 1);
    setEditGems(item.gemValue ?? 0);
    setEditGrowthTimeSec(Math.max(5, Math.round((item.growthTimeMs ?? 30000) / 1000)));
    setEditDrops(item.drops ? item.drops.map((d) => ({ ...d })) : []);
    setExtraDropSearch('');
  };

  const handleTileTap = (item: ItemDefinition) => {
    if (multiSelectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
    } else {
      openInspector(item);
    }
  };

  const handleSaveSingleItem = () => {
    if (!inspectedItem) return;
    const nextCfg = cloneGameConfig(gameConfig);
    const prevOverride = nextCfg.itemOverrides[inspectedItem.id];
    setLastBatchSnapshot([
      {
        itemId: inspectedItem.id,
        hadOverride: Boolean(prevOverride),
        previousOverride: prevOverride ? JSON.parse(JSON.stringify(prevOverride)) : undefined,
      },
    ]);

    const override: ItemConfigOverride = {
      ...(prevOverride ?? {}),
      hardness: Math.max(1, Math.round(Number(editHardness) || 1)),
      rarity: editRarity,
      xpValue: Math.max(0, Math.round(Number(editXp) || 0)),
      gemValue: Math.max(0, Math.round(Number(editGems) || 0)),
      drops: editDrops.map((d) => ({
        itemId: d.itemId,
        chance: Math.max(0, Math.min(1, Number(d.chance) || 0)),
        minQty: Math.max(1, Math.round(Number(d.minQty) || 1)),
        maxQty: Math.max(1, Math.round(Number(d.maxQty) || 1)),
      })),
    };
    if (inspectedItem.category === 'seed') {
      override.growthTimeMs = Math.max(5, Math.round(Number(editGrowthTimeSec) || 5)) * 1000;
    }

    nextCfg.itemOverrides[inspectedItem.id] = override;
    onSaveConfig(nextCfg);
    showToast(`Saved ${inspectedItem.name}`);
    setInspectedItemId(null);
  };

  const handleResetSingleItem = () => {
    if (!inspectedItem) return;
    const nextCfg = cloneGameConfig(gameConfig);
    delete nextCfg.itemOverrides[inspectedItem.id];
    onSaveConfig(nextCfg);
    showToast(`Reset ${inspectedItem.name} to default`);
    setInspectedItemId(null);
  };

  const applyStandardBaselinePreset = () => {
    setApplyHardness(false);
    setApplyRarity(false);
    setApplyXp(true);
    setBatchXp(1);
    setApplyGems(true);
    setBatchGems(0);
    setApplyDrops(true);
    setBatchSelfDropMode(true);
    setBatchSelfDropChance(0.125);
    setBatchSelfDropQty(1);
    setBatchExtraDrops([]);
    setBatchConfirmPending(false);
  };

  const openMultiSetModal = () => {
    if (selectedIds.size === 0) return;
    setBatchConfirmPending(false);
    setShowBatchModal(true);
  };

  const executeBatchUpdate = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const nextCfg = cloneGameConfig(gameConfig);
    const snapshots: UndoSnapshotEntry[] = [];

    for (const id of ids) {
      const baseDef = CATALOG[id];
      if (!baseDef) continue;
      const prevOverride = nextCfg.itemOverrides[id];
      snapshots.push({
        itemId: id,
        hadOverride: Boolean(prevOverride),
        previousOverride: prevOverride ? JSON.parse(JSON.stringify(prevOverride)) : undefined,
      });

      const updated: ItemConfigOverride = { ...(prevOverride ?? {}) };
      if (applyHardness) updated.hardness = Math.max(1, Math.round(Number(batchHardness) || 1));
      if (applyRarity) updated.rarity = batchRarity;
      if (applyXp) updated.xpValue = Math.max(0, Math.round(Number(batchXp) || 0));
      if (applyGems) updated.gemValue = Math.max(0, Math.round(Number(batchGems) || 0));
      if (applyDrops) {
        const nextDrops: DropEntry[] = [];
        if (batchSelfDropMode && batchSelfDropChance > 0) {
          const qty = Math.max(1, Math.round(Number(batchSelfDropQty) || 1));
          nextDrops.push({
            itemId: id,
            chance: Math.max(0, Math.min(1, Number(batchSelfDropChance) || 0)),
            minQty: qty,
            maxQty: qty,
          });
        }
        for (const extra of batchExtraDrops) {
          nextDrops.push({ ...extra });
        }
        updated.drops = nextDrops;
      }

      nextCfg.itemOverrides[id] = updated;
    }

    onSaveConfig(nextCfg);
    setLastBatchSnapshot(snapshots);
    setShowBatchModal(false);
    setBatchConfirmPending(false);
    setSelectedIds(new Set());
    setMultiSelectMode(false);
    showToast(`Applied batch update to ${ids.length} items`);
  };

  const handleUndoLastBatch = () => {
    if (!lastBatchSnapshot || lastBatchSnapshot.length === 0) return;
    const nextCfg = cloneGameConfig(gameConfig);
    for (const snap of lastBatchSnapshot) {
      if (!snap.hadOverride || !snap.previousOverride) {
        delete nextCfg.itemOverrides[snap.itemId];
      } else {
        nextCfg.itemOverrides[snap.itemId] = JSON.parse(JSON.stringify(snap.previousOverride));
      }
    }
    const count = lastBatchSnapshot.length;
    onSaveConfig(nextCfg);
    setLastBatchSnapshot(null);
    showToast(`Restored ${count} item(s) to previous state`);
  };

  // Filtered catalog list for adding Extra Drop Items by Name
  const extraDropMatches = useMemo(() => {
    const q = extraDropSearch.trim().toLowerCase();
    return allItems
      .filter((it) => !q || it.name.toLowerCase().includes(q) || String(it.id).includes(q))
      .slice(0, 24);
  }, [allItems, extraDropSearch]);

  const batchDropMatches = useMemo(() => {
    const q = batchDropSearch.trim().toLowerCase();
    return allItems
      .filter((it) => !q || it.name.toLowerCase().includes(q) || String(it.id).includes(q))
      .slice(0, 20);
  }, [allItems, batchDropSearch]);

  const anyBatchFieldChecked =
    applyHardness || applyRarity || applyXp || applyGems || applyDrops;

  // View 1: Server Worlds Browser Window
  if (adminView === 'worlds') {
    return (
      <AdminWorldsBrowser
        worlds={worlds}
        onRefreshWorlds={onRefreshWorlds}
        onWarpWorld={onWarpWorld}
        onBackToMenu={() => switchAdminView('selection')}
        onSwitchToCatalog={() => switchAdminView('catalog')}
        onClose={onClose}
      />
    );
  }

  // View 1B: DataSet Value Panel Window
  if (adminView === 'datasets') {
    return (
      <AdminDatasetPanel
        config={gameConfig}
        onUpdateDraftDatasets={(nextDatasets) => {
          const next = cloneGameConfig(gameConfig);
          next.datasets = nextDatasets;
          onSaveConfig(next);
        }}
        onSaveConfig={onSaveConfig}
        onBackToHub={() => switchAdminView('selection')}
        onClose={onClose}
      />
    );
  }

  // View 1C: Entity Management Window
  if (adminView === 'entities') {
    return (
      <AdminEntityPanel
        worldName={worldName}
        coords={coords}
        entitiesSnapshot={entitiesSnapshot}
        onRefreshEntities={onRefreshEntities}
        onTeleportEntity={onTeleportEntity}
        onBackToMenu={() => switchAdminView('selection')}
        onClose={onClose}
      />
    );
  }

  // View 2: Admin Tools Selection Menu (Hub)
  if (adminView === 'selection') {
    return (
      <div
        data-testid="admin-tools-selection-menu"
        className="flex flex-col h-full w-full bg-[#eef7ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]"
      >
        {/* Top Header Bar */}
        <div className="px-3 py-2 bg-[#c4e0f8]/80 border-b-2 border-[#2c5885] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-[#c2410c]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
              Admin Tools Hub
            </span>
            <span className="text-[10px] font-mono text-[#23476d]">
              (Administrator Controls)
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* SysEdit Admin World Restriction Bypass Toggle */}
            <button
              type="button"
              data-testid="admin-sysedit-toggle-hub"
              onClick={() => onToggleAdminWorldEdit?.(!adminWorldEdit, adminBrushItemId)}
              title="Bypass world ownership & lock restrictions to edit any world freely"
              className={`px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 cursor-pointer ${
                adminWorldEdit
                  ? 'bg-[#fed7aa] text-[#9a3412] border-[#c2410c]'
                  : 'bg-white/80 text-[#091e3a] border-[#4172a3] hover:bg-white'
              }`}
            >
              <Wand2 size={11} />
              {adminWorldEdit ? 'SysEdit ON' : 'SysEdit'}
            </button>

            {/* Quick +500 Gems */}
            <button
              type="button"
              onClick={() => {
                onAdminAction?.({ action: 'grant_gems', gems: 500 });
                showToast('Granted +500 Gems');
              }}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/80 text-[#92400e] border border-[#b45309] hover:bg-[#fef3c7] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>+500</span>
              <RedGemIcon className="w-3 h-3 shrink-0" />
            </button>

            {/* Quick Insta-Grow */}
            <button
              type="button"
              onClick={() => {
                onAdminAction?.({ action: 'grow_all_trees' });
                showToast(`Matured all plants in ${worldName ?? 'world'}`);
              }}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/80 text-[#047857] border border-[#16a34a] hover:bg-[#dcfce7] cursor-pointer"
            >
              Grow
            </button>

            {/* Rebuild NEXUS */}
            <button
              type="button"
              onClick={() => {
                onAdminAction?.({ action: 'rebuild_nexus' });
                showToast('Rebuilt NEXUS layout');
              }}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/80 text-[#0369a1] border border-[#0284c7] hover:bg-[#dbeafe] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} />
              NEXUS
            </button>

            {/* Clear Inventory */}
            <button
              type="button"
              onClick={() => {
                onAdminAction?.({ action: 'clear_inventory' });
                showToast('Cleared inventory');
              }}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/80 text-[#b91c1c] border border-[#dc2626] hover:bg-[#fee2e2] flex items-center gap-1 cursor-pointer"
            >
              <Trash2 size={10} />
              Clear Inv
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#23476d] hover:text-[#091e3a] rounded-[6px] cursor-pointer"
              title="Close Admin Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusToast && (
          <div className="px-3 py-1.5 bg-[#dcfce7] border-b border-[#16a34a] text-[#14532d] text-[11px] font-medium flex items-center justify-between shrink-0">
            <span>{statusToast}</span>
            <button type="button" onClick={() => setStatusToast(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Selection Menu Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="text-center mb-1">
            <h2 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
              Admin Tool Windows
            </h2>
            <p className="text-[11px] text-[#475569]">
              Select a specialized administrator tool to manage game data or server worlds
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* TOOL 1: Item Catalogue */}
            <button
              type="button"
              data-testid="admin-select-catalogue-btn"
              onClick={() => switchAdminView('catalog')}
              className="w-full text-left p-3.5 bg-white hover:bg-[#f0fdf4] border-2 border-[#16a34a] hover:border-[#15803d] rounded-[10px] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[9px] bg-gradient-to-br from-[#22c55e] to-[#15803d] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Layers size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0f172a] group-hover:text-[#15803d] transition-colors">
                      Game Item Catalogue
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase bg-[#dcfce7] text-[#166534] border border-[#86efac]">
                      263 Items · Overrides
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
                    Browse all placeable blocks, materials, farmables, seeds, tools, and gear. Search,
                    inspect properties, adjust drop tables, modify hardness, batch rebalance, and spawn items directly.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#16a34a] font-semibold">
                    <span>• 40 Farmablocks & 40 Seeds</span>
                    <span>• Drop Table Editor</span>
                    <span>• Multi-Select Batching</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#16a34a] shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* TOOL 2: DataSet Value Panel */}
            <button
              type="button"
              data-testid="admin-select-datasets-btn"
              onClick={() => switchAdminView('datasets')}
              className="w-full text-left p-3.5 bg-white hover:bg-[#faf5ff] border-2 border-[#7c3aed] hover:border-[#6d28d9] rounded-[10px] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[9px] bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Sliders size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-[#0f172a] group-hover:text-[#6d28d9] transition-colors">
                      DataSet Value Panel
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase bg-[#ede9fe] text-[#5b21b6] border border-[#c4b5fd]">
                      Progression Ranges · Level-to-Level Editor
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
                    Modify user-stored progression accumulation ranges and level advancement requirements.
                    Navigate dedicated variation menus for Player Main XP, Crop Mastery, Farmablock Mastery, WorldCore XP, and custom progression datasets.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#7c3aed] font-semibold flex-wrap">
                    <span>• Player Main XP</span>
                    <span>• Crop & Farmablock Mastery</span>
                    <span>• WorldCore XP</span>
                    <span>• Custom Datasets</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#7c3aed] shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* TOOL 3: Server Worlds Browser */}
            <button
              type="button"
              data-testid="admin-select-worlds-btn"
              onClick={() => switchAdminView('worlds')}
              className="w-full text-left p-3.5 bg-white hover:bg-[#eff6ff] border-2 border-[#2563eb] hover:border-[#1d4ed8] rounded-[10px] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[9px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Globe size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#0f172a] group-hover:text-[#1d4ed8] transition-colors">
                      Server Worlds Browser
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase bg-[#dbeafe] text-[#1e40af] border border-[#93c5fd]">
                      Database Worlds · AdminEnter · Player View
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
                    Inspect all server-stored persistent worlds created and active in the database.
                    View world names, owner usernames, last seen timestamps, and click for downwards-expanding inspection frames with instant AdminEnter and detailed Owner Player Views.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#2563eb] font-semibold">
                    <span>• Instant Lock-Bypass AdminEnter</span>
                    <span>• Detailed Owner Statistics</span>
                    <span>• Real-Time Activity Tracking</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#2563eb] shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* TOOL 4: Entity Management */}
            <button
              type="button"
              data-testid="admin-select-entities-btn"
              onClick={() => switchAdminView('entities')}
              className="w-full text-left p-3.5 bg-white hover:bg-[#ecfeff] border-2 border-[#0891b2] hover:border-[#0e7490] rounded-[10px] shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[9px] bg-gradient-to-br from-[#06b6d4] to-[#0e7490] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Users size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-[#0f172a] group-hover:text-[#0e7490] transition-colors">
                      Entity Management
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase bg-[#cffafe] text-[#155e75] border border-[#67e8f9]">
                      Players & NPCs · Teleport · Summon
                    </span>
                  </div>
                  <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
                    Select any active player or NPC in the current world, inspect their live tile coordinates,
                    teleport them to chosen coordinates, or summon them directly to your location.
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-[#0891b2] font-semibold flex-wrap">
                    <span>• Active Players & World NPCs</span>
                    <span>• Coordinate Teleportation</span>
                    <span>• Summon to Admin</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={20} className="text-[#0891b2] shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // View 3: Item Catalogue UI (the whole UI originally displayed)
  return (
    <div
      data-testid="admin-catalog-panel"
      className="flex flex-col h-full w-full bg-transparent text-[#091e3a] select-none overflow-hidden rounded-[8px]"
    >
      {/* Top Header Bar: Title + SysEdit Bypass + Quick Admin Actions */}
      <div className="px-3 py-2 bg-[#c4e0f8]/60 border-b-2 border-[#2c5885] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="admin-catalog-back-to-menu"
            onClick={() => switchAdminView('selection')}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#3b82f6] hover:bg-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Return to Admin Tools Selection Menu"
          >
            <ArrowLeft size={11} />
            Tools Menu
          </button>
          <Shield size={15} className="text-[#c2410c]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
            Game Item Catalogue
          </span>
          <span className="text-[10px] font-mono text-[#23476d]">
            ({filteredItems.length}/{allItems.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Switch to DataSet Value Panel */}
          <button
            type="button"
            data-testid="admin-switch-to-datasets-btn"
            onClick={() => switchAdminView('datasets')}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#6d28d9] border border-[#8b5cf6] hover:bg-[#ede9fe] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Switch to DataSet Value Panel"
          >
            <Sliders size={11} />
            DataSets
          </button>
          {/* Switch to Worlds Browser */}
          <button
            type="button"
            data-testid="admin-switch-to-worlds-btn"
            onClick={() => switchAdminView('worlds')}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1d4ed8] border border-[#3b82f6] hover:bg-[#dbeafe] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Switch to Server Worlds Browser"
          >
            <Globe size={11} />
            Server Worlds
          </button>
          {/* Switch to Entity Management */}
          <button
            type="button"
            data-testid="admin-switch-to-entities-btn"
            onClick={() => switchAdminView('entities')}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#0e7490] border border-[#06b6d4] hover:bg-[#cffafe] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Switch to Entity Management"
          >
            <Users size={11} />
            Entities
          </button>
          {/* SysEdit Admin World Restriction Bypass Toggle */}
          <button
            type="button"
            data-testid="admin-sysedit-toggle"
            onClick={() => onToggleAdminWorldEdit?.(!adminWorldEdit, adminBrushItemId)}
            title="Bypass world ownership & lock restrictions to edit any world freely"
            className={`px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 cursor-pointer ${
              adminWorldEdit
                ? 'bg-[#fed7aa] text-[#9a3412] border-[#c2410c]'
                : 'bg-white/80 text-[#091e3a] border-[#4172a3] hover:bg-white'
            }`}
          >
            <Wand2 size={11} />
            {adminWorldEdit ? 'SysEdit ON' : 'SysEdit'}
          </button>

          {/* Undo Last Batch Button */}
          {lastBatchSnapshot && (
            <button
              type="button"
              data-testid="admin-undo-batch-btn"
              onClick={handleUndoLastBatch}
              className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-[#fef3c7]/90 text-[#92400e] border border-[#b45309] hover:bg-[#fde68a] flex items-center gap-1 cursor-pointer"
              title="Undo last item or batch property update"
            >
              <Undo2 size={11} />
              Undo ({lastBatchSnapshot.length})
            </button>
          )}

          {/* Quick +500 Gems */}
          <button
            type="button"
            onClick={() => {
              onAdminAction?.({ action: 'grant_gems', gems: 500 });
              showToast('Granted +500 Gems');
            }}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-white/80 text-[#92400e] border border-[#b45309] hover:bg-[#fef3c7] inline-flex items-center gap-1 cursor-pointer"
          >
            <span>+500</span>
            <RedGemIcon className="w-3 h-3 shrink-0" />
          </button>

          {/* Quick Insta-Grow */}
          <button
            type="button"
            onClick={() => {
              onAdminAction?.({ action: 'grow_all_trees' });
              showToast(`Matured all plants in ${worldName ?? 'world'}`);
            }}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-white/80 text-[#047857] border border-[#16a34a] hover:bg-[#dcfce7] cursor-pointer"
          >
            Grow
          </button>

          {/* Rebuild NEXUS Action */}
          <button
            type="button"
            data-testid="admin-rebuild-nexus-btn"
            onClick={() => {
              onAdminAction?.({ action: 'rebuild_nexus' });
              showToast('Rebuilt NEXUS hub to latest Sci-Fi deck layout');
            }}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-white/80 text-[#0369a1] border border-[#0284c7] hover:bg-[#dbeafe] flex items-center gap-1 cursor-pointer"
            title="Re-stamp NEXUS Sci-Fi Floating Platform layout without wiping player worlds"
          >
            <RefreshCw size={10} />
            NEXUS
          </button>

          {/* Clear Inventory Action */}
          <button
            type="button"
            data-testid="admin-clear-inventory-btn"
            onClick={() => {
              onAdminAction?.({ action: 'clear_inventory' });
              showToast('Cleared inventory (retained Fist & Wrench)');
            }}
            className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider bg-white/80 text-[#b91c1c] border border-[#dc2626] hover:bg-[#fee2e2] flex items-center gap-1 cursor-pointer"
            title="Clear all items from your Backpack (retains Fist and Tinker Wrench)"
          >
            <Trash2 size={10} />
            Clear Inv
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#23476d] hover:text-[#091e3a] rounded-[6px] cursor-pointer"
            title="Close Catalogue"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Status Toast */}
      {statusToast && (
        <div className="px-3 py-1.5 bg-[#dcfce7] border-b border-[#16a34a] text-[#14532d] text-[11px] font-medium flex items-center justify-between shrink-0">
          <span>{statusToast}</span>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-[#14532d]/70 hover:text-[#0f172a]"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search Bar & Multi-Select Toggle */}
      <div className="p-2.5 bg-[#d4e8fb]/45 border-b border-[#4172a3]/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#23476d]" />
            <input
              data-testid="admin-catalog-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name or ID..."
              className="hud-input w-full pl-8 pr-7 py-1.5 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#23476d] hover:text-[#091e3a]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="admin-multiselect-toggle"
            onClick={() => {
              if (multiSelectMode) {
                setMultiSelectMode(false);
                setSelectedIds(new Set());
              } else {
                setMultiSelectMode(true);
                setInspectedItemId(null);
              }
            }}
            className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              multiSelectMode
                ? 'bg-[#c2410c] text-white border-[#9a3412]'
                : 'bg-white/80 text-[#091e3a] border-[#4172a3] hover:border-[#0284c7]'
            }`}
          >
            <Check size={12} />
            {multiSelectMode ? `Selecting (${selectedIds.size})` : 'Multi-Select'}
          </button>
        </div>

        {/* Category & Audit Filter Chips */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'foreground', label: 'Blocks' },
              { id: 'farmable', label: 'Farmables' },
              { id: 'crop', label: 'Crops' },
              { id: 'seed', label: 'Seeds' },
              { id: 'misc', label: 'Misc' },
              { id: 'background', label: 'Walls' },
              { id: 'interactive', label: 'Interactive' },
              { id: 'wearable', label: 'Gear' },
              { id: 'audit_non_baseline', label: 'Non-Baseline' },
              { id: 'audit_edited', label: 'Edited' },
              { id: 'audit_missing_drops', label: 'No Drops' },
            ] as { id: FilterCategory; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-testid={`admin-filter-${tab.id}`}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-2 py-0.5 rounded-[6px] text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap border transition-colors cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-[#0284c7] text-white border-[#164e7a]'
                  : 'bg-white/75 text-[#23476d] border-[#4172a3] hover:text-[#091e3a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persistent Multi-Select Action Bar */}
      {multiSelectMode && (
        <div
          data-testid="admin-multiselect-bar"
          className="px-3 py-2 bg-[#fef3c7]/90 border-b border-[#b45309] flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#92400e]">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  filteredItems.forEach((i) => next.add(i.id));
                  return next;
                });
              }}
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[6px] bg-white/90 border border-[#4172a3] text-[#091e3a] hover:bg-white cursor-pointer"
            >
              +Filtered ({filteredItems.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[6px] bg-white/90 border border-[#4172a3] text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="admin-multiset-btn"
              disabled={selectedIds.size === 0}
              onClick={openMultiSetModal}
              className={`px-3 py-1 rounded-[7px] text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                selectedIds.size > 0
                  ? 'bg-[#16a34a] text-white hover:bg-[#15803d]'
                  : 'bg-[#b8d4ee] text-[#23476d] cursor-not-allowed'
              }`}
            >
              Multi Set ({selectedIds.size})
            </button>
            <button
              type="button"
              data-testid="admin-multiselect-cancel"
              onClick={() => {
                setSelectedIds(new Set());
                setMultiSelectMode(false);
              }}
              className="px-2.5 py-1 rounded-[7px] text-[11px] font-bold uppercase tracking-wider bg-white/85 border border-[#4172a3] text-[#23476d] hover:text-[#091e3a] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main 5+ Items Per Row Texture-First Grid */}
      <div className="flex-1 overflow-y-auto p-2.5 min-h-0">
        <div
          data-testid="admin-catalog-grid"
          className="grid grid-cols-5 sm:grid-cols-6 gap-1.5"
        >
          {filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isEdited = Boolean(gameConfig.itemOverrides?.[item.id]);
            const isBrush = adminWorldEdit && adminBrushItemId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`admin-catalog-tile-${item.id}`}
                onClick={() => handleTileTap(item)}
                title={`${item.name} (#${item.id}) — Hits: ${item.hardness}, XP: ${item.xpValue ?? 1}, Gems: ${item.gemValue ?? 0}`}
                className={`relative group flex flex-col items-center justify-center p-1.5 rounded-[8px] border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#fef3c7]/90 border-[#b45309] ring-1 ring-[#b45309]'
                    : isBrush
                    ? 'bg-[#dbeafe]/90 border-[#0284c7]'
                    : 'bg-white/75 border-[#4172a3] hover:border-[#0284c7] hover:bg-white/95'
                }`}
              >
                {/* Selection Checkmark Badge */}
                {multiSelectMode && (
                  <div
                    className={`absolute top-1 right-1 w-3.5 h-3.5 rounded-[4px] flex items-center justify-center border ${
                      isSelected
                        ? 'bg-[#b45309] border-[#92400e] text-white'
                        : 'bg-white/80 border-[#4172a3]'
                    }`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </div>
                )}

                {/* Admin Edited Dot */}
                {isEdited && !multiSelectMode && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#b45309]"
                    title="Modified override active"
                  />
                )}

                {/* Crisp Pixel-Art Texture Icon */}
                <div className="w-9 h-9 flex items-center justify-center">
                  <img
                    src={getItemIconUrl(item.id)}
                    alt={item.name}
                    className="w-8 h-8 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Minimized 1-line truncated name */}
                <span className="w-full text-[9px] leading-tight text-[#091e3a] truncate text-center mt-1 font-semibold">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="py-12 text-center text-xs text-[#23476d]">
            No items match your current filter.
          </div>
        )}
      </div>

      {/* Single-Item Inspector Drawer */}
      {inspectedItem && !multiSelectMode && (
        <div
          data-testid="admin-single-inspector"
          className="border-t-2 border-[#2c5885] bg-[#dcecfb]/92 backdrop-blur-md p-3 flex flex-col gap-2.5 max-h-[65%] overflow-y-auto shadow-xl shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-[8px] bg-white/85 border border-[#4172a3] flex items-center justify-center shrink-0">
                <img
                  src={getItemIconUrl(inspectedItem.id)}
                  alt={inspectedItem.name}
                  className="w-8 h-8 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#091e3a] truncate">
                    {inspectedItem.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#23476d]">
                    #{inspectedItem.id}
                  </span>
                </div>
                <div className="text-[10px] text-[#23476d] uppercase tracking-wider">
                  {inspectedItem.category}
                  {inspectedItem.farmableTier ? ` · Farmable T${inspectedItem.farmableTier}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="inspector-grant-btn"
                onClick={() => {
                  onAdminAction?.({
                    action: 'grant_item',
                    itemId: inspectedItem.id,
                    qty: 50,
                  });
                  showToast(`Granted 50× ${inspectedItem.name}`);
                }}
                className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-[#dcfce7] text-[#14532d] border border-[#16a34a] hover:bg-[#bbf7d0] cursor-pointer"
              >
                +50
              </button>
              <button
                type="button"
                data-testid="inspector-delete-slot-btn"
                onClick={() => {
                  onAdminAction?.({
                    action: 'delete_inventory_slot',
                    itemId: inspectedItem.id,
                  });
                  showToast(`Deleted ${inspectedItem.name} slot from Backpack`);
                }}
                title="Delete this item's slot from your Backpack"
                className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-[#fee2e2] text-[#991b1b] border border-[#dc2626] hover:bg-[#fecaca] cursor-pointer"
              >
                Del Slot
              </button>
              <button
                type="button"
                data-testid="inspector-brush-btn"
                onClick={() => {
                  onToggleAdminWorldEdit?.(true, inspectedItem.id);
                  showToast(`SysEdit brush set to ${inspectedItem.name}`);
                }}
                className="px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-[#dbeafe] text-[#0369a1] border border-[#0284c7] hover:bg-[#bfdbfe] cursor-pointer"
              >
                Brush
              </button>
              <button
                type="button"
                onClick={() => setInspectedItemId(null)}
                className="p-1 text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Core Numeric Properties */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[9px] uppercase text-[#23476d] font-semibold mb-0.5">
                Hardness (Hits)
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={editHardness}
                onChange={(e) => setEditHardness(Number(e.target.value))}
                className="hud-input w-full px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-[#23476d] font-semibold mb-0.5">
                Rarity
              </label>
              <select
                value={editRarity}
                onChange={(e) => setEditRarity(e.target.value as ItemRarity)}
                className="hud-input w-full px-1.5 py-1 text-xs"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] uppercase text-[#23476d] font-semibold mb-0.5">
                XP Value
              </label>
              <input
                type="number"
                min={0}
                max={200}
                value={editXp}
                onChange={(e) => setEditXp(Number(e.target.value))}
                className="hud-input w-full px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase text-[#23476d] font-semibold mb-0.5">
                Gem Drop
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={editGems}
                onChange={(e) => setEditGems(Number(e.target.value))}
                className="hud-input w-full px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          {inspectedItem.category === 'seed' && (
            <div>
              <label className="block text-[9px] uppercase text-[#23476d] font-semibold mb-0.5">
                Growth Time (Seconds)
              </label>
              <input
                type="number"
                min={5}
                max={3600}
                value={editGrowthTimeSec}
                onChange={(e) => setEditGrowthTimeSec(Number(e.target.value))}
                className="hud-input w-32 px-2 py-1 text-xs font-mono"
              />
            </div>
          )}

          {/* Drop Table & Search-by-Name Extra Item Adder */}
          <div className="border-t border-[#4172a3]/35 pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#23476d]">
                Drop Table ({editDrops.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditXp(1);
                  setEditGems(0);
                  setEditDrops([
                    { itemId: inspectedItem.id, chance: 0.125, minQty: 1, maxQty: 1 },
                  ]);
                }}
                className="text-[10px] font-semibold text-[#92400e] hover:underline cursor-pointer"
              >
                Set 12.5% Baseline
              </button>
            </div>

            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {editDrops.map((drop, idx) => {
                const dropItem = CATALOG[drop.itemId];
                return (
                  <div
                    key={`${drop.itemId}-${idx}`}
                    className="flex items-center gap-1.5 bg-white/85 px-2 py-1 rounded-[7px] border border-[#4172a3] text-[11px]"
                  >
                    {dropItem && (
                      <img
                        src={getItemIconUrl(drop.itemId)}
                        alt={dropItem.name}
                        className="w-4 h-4 object-contain"
                        style={{ imageRendering: 'pixelated' }}
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <span className="flex-1 truncate text-[#091e3a]">
                      {dropItem ? dropItem.name : `ID #${drop.itemId}`}
                    </span>
                    <label className="text-[9px] text-[#23476d]">Chance</label>
                    <input
                      type="number"
                      step="0.005"
                      min={0}
                      max={1}
                      value={drop.chance}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setEditDrops((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, chance: val } : d))
                        );
                      }}
                      className="hud-input w-14 px-1 py-0.5 text-[10px] font-mono text-right"
                    />
                    <label className="text-[9px] text-[#23476d]">Max</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={drop.maxQty}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setEditDrops((prev) =>
                          prev.map((d, i) =>
                            i === idx ? { ...d, minQty: 1, maxQty: val } : d
                          )
                        );
                      }}
                      className="hud-input w-10 px-1 py-0.5 text-[10px] font-mono text-right"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditDrops((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[#dc2626] hover:text-[#991b1b] p-0.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Search by Name to Add Extra Item Drop */}
            <div className="mt-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-[#23476d]"
                />
                <input
                  data-testid="inspector-extra-drop-search"
                  type="text"
                  value={extraDropSearch}
                  onChange={(e) => setExtraDropSearch(e.target.value)}
                  placeholder="Add extra drop item: Search by name..."
                  className="hud-input w-full pl-7 pr-6 py-1 text-[11px]"
                />
                {extraDropSearch && (
                  <button
                    type="button"
                    onClick={() => setExtraDropSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#23476d]"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {extraDropSearch.trim().length > 0 && (
                <div className="mt-1 grid grid-cols-3 gap-1 max-h-24 overflow-y-auto p-1 bg-white/90 border border-[#4172a3] rounded-[8px]">
                  {extraDropMatches.map((match) => (
                    <button
                      key={match.id}
                      type="button"
                      data-testid={`inspector-add-drop-${match.id}`}
                      onClick={() => {
                        setEditDrops((prev) => [
                          ...prev,
                          { itemId: match.id, chance: 0.125, minQty: 1, maxQty: 1 },
                        ]);
                        setExtraDropSearch('');
                      }}
                      className="flex items-center gap-1.5 p-1 rounded-[6px] hover:bg-[#dbeafe] text-left text-[10px] text-[#091e3a] truncate cursor-pointer"
                    >
                      <img
                        src={getItemIconUrl(match.id)}
                        alt={match.name}
                        className="w-4 h-4 object-contain shrink-0"
                        style={{ imageRendering: 'pixelated' }}
                        referrerPolicy="no-referrer"
                      />
                      <span className="truncate">{match.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Save / Reset Actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#4172a3]/35">
            <button
              type="button"
              onClick={handleResetSingleItem}
              className="px-2.5 py-1 rounded-[7px] text-[10px] font-bold uppercase bg-white/80 text-[#23476d] hover:text-[#091e3a] border border-[#4172a3] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={11} />
              Reset Default
            </button>
            <button
              type="button"
              data-testid="inspector-save-btn"
              onClick={handleSaveSingleItem}
              className="px-4 py-1 rounded-[7px] text-[11px] font-bold uppercase bg-[#0284c7] text-white hover:bg-[#0369a1] cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Multi Set Batch Property Editor Modal */}
      {showBatchModal && (
        <div
          data-testid="admin-batch-modal"
          className="fixed inset-0 z-50 bg-[#091e3a]/40 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md pixel-box !rounded-[12px] overflow-hidden flex flex-col max-h-[90vh] text-[#091e3a]">
            <div className="pixel-box-header px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#c2410c]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
                  Multi Set Batch Editor ({selectedIds.size} Items)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchConfirmPending(false);
                }}
                className="text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto text-xs">
              {/* 1-Click Standard Baseline Preset */}
              <div className="p-2.5 rounded-[8px] bg-[#fef3c7]/90 border border-[#b45309] flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[#92400e] text-[11px]">
                    Standard Block Baseline Preset
                  </div>
                  <div className="text-[10px] text-[#78350f]">
                    Sets 12.5% Self-Drop (1× own ID), 0 Gems, 1 XP
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="batch-preset-baseline-btn"
                  onClick={applyStandardBaselinePreset}
                  className="px-2.5 py-1.5 rounded-[7px] bg-[#b45309] text-white font-bold text-[10px] uppercase tracking-wider shrink-0 hover:bg-[#92400e] cursor-pointer"
                >
                  Apply Baseline
                </button>
              </div>

              {/* Per-Field Checkboxes */}
              <div className="space-y-2">
                {/* Hardness */}
                <div className="hud-subpanel flex items-center justify-between gap-2 p-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#091e3a]">
                    <input
                      type="checkbox"
                      checked={applyHardness}
                      onChange={(e) => setApplyHardness(e.target.checked)}
                      className="accent-[#0284c7]"
                    />
                    <span className="font-semibold">Hardness (Hits to Break)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    disabled={!applyHardness}
                    value={batchHardness}
                    onChange={(e) => setBatchHardness(Number(e.target.value))}
                    className="hud-input w-20 px-2 py-1 font-mono text-right disabled:opacity-45"
                  />
                </div>

                {/* Rarity */}
                <div className="hud-subpanel flex items-center justify-between gap-2 p-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#091e3a]">
                    <input
                      type="checkbox"
                      checked={applyRarity}
                      onChange={(e) => setApplyRarity(e.target.checked)}
                      className="accent-[#0284c7]"
                    />
                    <span className="font-semibold">Rarity Tier</span>
                  </label>
                  <select
                    disabled={!applyRarity}
                    value={batchRarity}
                    onChange={(e) => setBatchRarity(e.target.value as ItemRarity)}
                    className="hud-input w-24 px-1.5 py-1 text-xs disabled:opacity-45"
                  >
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                  </select>
                </div>

                {/* XP Value */}
                <div className="hud-subpanel flex items-center justify-between gap-2 p-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#091e3a]">
                    <input
                      data-testid="batch-apply-xp"
                      type="checkbox"
                      checked={applyXp}
                      onChange={(e) => setApplyXp(e.target.checked)}
                      className="accent-[#0284c7]"
                    />
                    <span className="font-semibold">XP Value</span>
                  </label>
                  <input
                    data-testid="batch-input-xp"
                    type="number"
                    min={0}
                    max={200}
                    disabled={!applyXp}
                    value={batchXp}
                    onChange={(e) => setBatchXp(Number(e.target.value))}
                    className="hud-input w-20 px-2 py-1 font-mono text-right disabled:opacity-45"
                  />
                </div>

                {/* Gem Value */}
                <div className="hud-subpanel flex items-center justify-between gap-2 p-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#091e3a]">
                    <input
                      data-testid="batch-apply-gems"
                      type="checkbox"
                      checked={applyGems}
                      onChange={(e) => setApplyGems(e.target.checked)}
                      className="accent-[#0284c7]"
                    />
                    <span className="font-semibold">Gem Drop Value</span>
                  </label>
                  <input
                    data-testid="batch-input-gems"
                    type="number"
                    min={0}
                    max={100}
                    disabled={!applyGems}
                    value={batchGems}
                    onChange={(e) => setBatchGems(Number(e.target.value))}
                    className="hud-input w-20 px-2 py-1 font-mono text-right disabled:opacity-45"
                  />
                </div>

                {/* Drop Table (Per-Item Self-Drop + Optional Extra Drops) */}
                <div className="hud-subpanel p-2.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#091e3a]">
                    <input
                      data-testid="batch-apply-drops"
                      type="checkbox"
                      checked={applyDrops}
                      onChange={(e) => setApplyDrops(e.target.checked)}
                      className="accent-[#0284c7]"
                    />
                    <span className="font-semibold">Overwrite Drop Table</span>
                  </label>

                  {applyDrops && (
                    <div className="pl-5 space-y-2 pt-1 border-t border-[#4172a3]/35">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-[#091e3a]">
                          <input
                            type="checkbox"
                            checked={batchSelfDropMode}
                            onChange={(e) => setBatchSelfDropMode(e.target.checked)}
                            className="accent-[#16a34a]"
                          />
                          Per-Item Self-Drop (Own ID)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.005"
                            min={0}
                            max={1}
                            disabled={!batchSelfDropMode}
                            value={batchSelfDropChance}
                            onChange={(e) => setBatchSelfDropChance(Number(e.target.value))}
                            className="hud-input w-16 px-1.5 py-0.5 text-[11px] font-mono text-right"
                          />
                          <span className="text-[10px] text-[#23476d]">chance</span>
                        </div>
                      </div>

                      {/* Shared Extra Drops */}
                      {batchExtraDrops.length > 0 && (
                        <div className="space-y-1">
                          {batchExtraDrops.map((d, i) => {
                            const it = CATALOG[d.itemId];
                            return (
                              <div
                                key={`${d.itemId}-${i}`}
                                className="flex items-center justify-between bg-white/85 border border-[#4172a3] px-2 py-1 rounded-[7px] text-[10px]"
                              >
                                <span className="truncate text-[#091e3a]">{it?.name || `#${d.itemId}`}</span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.05"
                                    min={0}
                                    max={1}
                                    value={d.chance}
                                    onChange={(e) => {
                                      const v = Number(e.target.value);
                                      setBatchExtraDrops((prev) =>
                                        prev.map((x, idx) =>
                                          idx === i ? { ...x, chance: v } : x
                                        )
                                      );
                                    }}
                                    className="hud-input w-12 px-1 font-mono text-right"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBatchExtraDrops((prev) =>
                                        prev.filter((_, idx) => idx !== i)
                                      )
                                    }
                                    className="text-[#dc2626]"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Search by Name for Batch Extra Drop */}
                      <div className="relative">
                        <input
                          type="text"
                          value={batchDropSearch}
                          onChange={(e) => setBatchDropSearch(e.target.value)}
                          placeholder="Add shared extra drop by name..."
                          className="hud-input w-full px-2 py-1 text-[10px]"
                        />
                        {batchDropSearch.trim().length > 0 && (
                          <div className="mt-1 grid grid-cols-2 gap-1 max-h-24 overflow-y-auto p-1 bg-white/90 border border-[#4172a3] rounded-[8px]">
                            {batchDropMatches.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setBatchExtraDrops((prev) => [
                                    ...prev,
                                    { itemId: m.id, chance: 0.125, minQty: 1, maxQty: 1 },
                                  ]);
                                  setBatchDropSearch('');
                                }}
                                className="flex items-center gap-1 p-1 rounded-[6px] hover:bg-[#dbeafe] text-left text-[10px] text-[#091e3a] truncate cursor-pointer"
                              >
                                <img
                                  src={getItemIconUrl(m.id)}
                                  alt={m.name}
                                  className="w-3.5 h-3.5 object-contain"
                                  style={{ imageRendering: 'pixelated' }}
                                  referrerPolicy="no-referrer"
                                />
                                <span className="truncate">{m.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Confirmation Summary Banner */}
              {batchConfirmPending && (
                <div className="p-2.5 rounded-[8px] bg-[#fef3c7]/90 border border-[#b45309] text-[11px] space-y-1">
                  <div className="font-bold text-[#92400e] flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    Confirm Batch Update to {selectedIds.size} Selected Items?
                  </div>
                  <div className="text-[#78350f] text-[10px]">
                    {[
                      applyHardness ? `Hardness = ${batchHardness}` : null,
                      applyRarity ? `Rarity = ${batchRarity}` : null,
                      applyXp ? `XP = ${batchXp}` : null,
                      applyGems ? `Gems = ${batchGems}` : null,
                      applyDrops
                        ? `Drops = ${
                            batchSelfDropMode
                              ? `${(batchSelfDropChance * 100).toFixed(1)}% Self-Drop`
                              : 'Custom'
                          }`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-[#c4e0f8]/55 border-t border-[#2c5885] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchConfirmPending(false);
                }}
                className="px-3 py-1.5 rounded-[8px] text-xs font-bold uppercase bg-white/85 border border-[#4172a3] text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                Cancel
              </button>

              {!batchConfirmPending ? (
                <button
                  type="button"
                  data-testid="batch-review-confirm-btn"
                  disabled={!anyBatchFieldChecked}
                  onClick={() => setBatchConfirmPending(true)}
                  className={`px-4 py-1.5 rounded-[8px] text-xs font-bold uppercase cursor-pointer ${
                    anyBatchFieldChecked
                      ? 'bg-[#0284c7] text-white hover:bg-[#0369a1]'
                      : 'bg-[#b8d4ee] text-[#23476d] cursor-not-allowed'
                  }`}
                >
                  Apply to {selectedIds.size} Items
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="batch-execute-confirm-btn"
                  onClick={executeBatchUpdate}
                  className="px-4 py-1.5 rounded-[8px] text-xs font-bold uppercase bg-[#16a34a] text-white hover:bg-[#15803d] cursor-pointer"
                >
                  Confirm & Save ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPanel;
