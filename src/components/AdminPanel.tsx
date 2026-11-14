import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Coins,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Sliders,
  Sparkles,
  Sprout,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import {
  CATALOG,
  GEM_STORE_LISTINGS,
  ITEM_IDS,
  type DropEntry,
  type GemStoreListing,
  type ItemDefinition,
  type StoreSection,
} from '../game/catalog.ts';
import {
  applyFarmabilityTier,
  buildFarmabilityOverride,
  calculateFarmabilityProfile,
  cloneGameConfig,
  DEFAULT_GAME_CONFIG,
  FARMABILITY_TIERS,
  getEffectiveItemDef,
  type FarmabilityTier,
  type GameConfig,
  type GameMechanicsConfig,
  type ItemConfigOverride,
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

type AdminSection = 'catalog' | 'drops' | 'store' | 'tools';

type QuickFilterChip =
  | 'all'
  | 'blocks'
  | 'biome'
  | 'backgrounds'
  | 'seeds'
  | 'farmable'
  | 'modified'
  | 'locks'
  | 'wearables';

type CatalogSortKey = 'id' | 'name' | 'yield' | 'rarity' | 'hardness';

const RARITY_BADGE: Record<string, string> = {
  common: 'bg-[#1a2e42] text-[#b8d0e8] border-[#355473]',
  uncommon: 'bg-[#193829] text-[#82e068] border-[#33704d]',
  rare: 'bg-[#18324d] text-[#78c8f5] border-[#32689e]',
  epic: 'bg-[#382a12] text-[#ffe18c] border-[#8c6822]',
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameConfig,
  inWorld,
  onSaveConfig,
  onAdminAction,
  onClose,
}) => {
  const [section, setSection] = useState<AdminSection>('catalog');
  const [draft, setDraft] = useState<GameConfig>(() => cloneGameConfig(gameConfig));
  const [selectedItemId, setSelectedItemId] = useState<number>(ITEM_IDS.GP_DIRT);
  const [grantQty, setGrantQty] = useState<number>(50);
  const [grantGemsAmt] = useState<number>(500);
  const [newDropItemId, setNewDropItemId] = useState<number>(ITEM_IDS.GP_SEED_DIRT);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Minimized Whole-Catalogue Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<QuickFilterChip>('all');
  const [sortBy, setSortBy] = useState<CatalogSortKey>('id');

  // Store editor state
  const [selectedStoreIdx, setSelectedStoreIdx] = useState<number>(0);
  const [newGrantItemId, setNewGrantItemId] = useState<number>(ITEM_IDS.GP_DIRT);
  const [newGrantQty, setNewGrantQty] = useState<number>(25);

  useEffect(() => {
    setDraft(cloneGameConfig(gameConfig));
  }, [gameConfig]);

  const showFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const editableItems = useMemo<ItemDefinition[]>(
    () =>
      Object.values(CATALOG)
        .filter((i) => i.id !== ITEM_IDS.AIR)
        .sort((a, b) => a.id - b.id),
    []
  );

  // Pre-compute farmability analysis for all catalogue items against current draft
  const farmabilityMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof calculateFarmabilityProfile>>();
    for (const item of editableItems) {
      map.set(item.id, calculateFarmabilityProfile(item.id, draft));
    }
    return map;
  }, [editableItems, draft]);

  // Whole-catalogue minimized filter + sort
  const filteredCatalogItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = editableItems.filter((item) => {
      const farm = farmabilityMap.get(item.id);
      const isModified = Boolean(draft.itemOverrides[item.id]);
      const isBiome = item.id >= 700 && item.id <= 748;

      if (
        quickFilter === 'blocks' &&
        item.category !== 'foreground' &&
        item.category !== 'farmable'
      ) {
        return false;
      }
      if (quickFilter === 'biome' && !isBiome) return false;
      if (quickFilter === 'backgrounds' && item.category !== 'background') return false;
      if (quickFilter === 'seeds' && item.category !== 'seed') return false;
      if (
        quickFilter === 'farmable' &&
        item.category !== 'farmable' &&
        !item.farmableTier &&
        (!farm?.isFarmCandidate || !farm?.isPositiveYield)
      ) {
        return false;
      }
      if (quickFilter === 'modified' && !isModified) return false;
      if (
        quickFilter === 'locks' &&
        item.category !== 'lock' &&
        item.category !== 'interactive'
      ) {
        return false;
      }
      if (
        quickFilter === 'wearables' &&
        item.category !== 'wearable' &&
        item.category !== 'tool' &&
        item.category !== 'consumable'
      ) {
        return false;
      }

      if (q) {
        const biomeTag =
          item.id >= 700 && item.id < 720
            ? 'desert biome'
            : item.id >= 720 && item.id < 740
              ? 'arctic tundra snow ice biome'
              : item.id >= 740 && item.id <= 748
                ? 'cave underground biome'
                : '';
        const matchName = item.name.toLowerCase().includes(q);
        const matchKey = item.key.toLowerCase().includes(q);
        const matchId = String(item.id).includes(q) || `#${item.id}` === q;
        const matchCat = item.category.toLowerCase().includes(q);
        const matchRarity = item.rarity.toLowerCase().includes(q);
        const matchBiome = biomeTag.includes(q);
        if (!matchName && !matchKey && !matchId && !matchCat && !matchRarity && !matchBiome) {
          return false;
        }
      }
      return true;
    });

    const rarityRank: Record<string, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
    };

    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'yield') {
        const ya = farmabilityMap.get(a.id)?.expectedBlockYield ?? 0;
        const yb = farmabilityMap.get(b.id)?.expectedBlockYield ?? 0;
        return yb - ya || a.id - b.id;
      }
      if (sortBy === 'rarity') {
        const ra = a.growPixelRarity ?? rarityRank[a.rarity] ?? 1;
        const rb = b.growPixelRarity ?? rarityRank[b.rarity] ?? 1;
        return rb - ra || a.id - b.id;
      }
      if (sortBy === 'hardness') {
        const ha = getEffectiveItemDef(a.id, draft)?.hardness ?? a.hardness;
        const hb = getEffectiveItemDef(b.id, draft)?.hardness ?? b.hardness;
        return hb - ha || a.id - b.id;
      }
      return a.id - b.id;
    });

    return list;
  }, [editableItems, farmabilityMap, draft, searchQuery, quickFilter, sortBy]);

  const modifiedCount = Object.keys(draft.itemOverrides).length;

  const setMech = <K extends keyof GameMechanicsConfig>(
    key: K,
    value: GameMechanicsConfig[K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      mechanics: {
        ...prev.mechanics,
        [key]: value,
      },
    }));
  };

  const baseItem: ItemDefinition | undefined = CATALOG[selectedItemId];
  const effectiveItem = getEffectiveItemDef(selectedItemId, draft) ?? baseItem;
  const selectedFarm = useMemo(
    () => calculateFarmabilityProfile(selectedItemId, draft),
    [selectedItemId, draft]
  );

  const updateItemOverride = (
    itemId: number,
    patch: Partial<ItemConfigOverride>
  ) => {
    const base = CATALOG[itemId];
    if (!base) return;
    const eff = getEffectiveItemDef(itemId, draft) ?? base;
    const linkedPartnerId = base.category === 'seed' ? base.producesTileId : base.seedId;
    setDraft((prev) => {
      const existing = prev.itemOverrides[itemId] ?? {};
      const merged: ItemConfigOverride = {
        hardness: patch.hardness ?? existing.hardness ?? eff.hardness,
        gemValue: patch.gemValue ?? existing.gemValue ?? eff.gemValue,
        xpValue: patch.xpValue ?? existing.xpValue ?? eff.xpValue,
        growthTimeMs: patch.growthTimeMs ?? existing.growthTimeMs ?? eff.growthTimeMs,
        drops: patch.drops ?? existing.drops ?? eff.drops ?? [],
        treeHarvestYield:
          patch.treeHarvestYield ?? existing.treeHarvestYield ?? eff.treeHarvestYield,
        bonusHarvestDrops:
          patch.bonusHarvestDrops ?? existing.bonusHarvestDrops ?? eff.bonusHarvestDrops,
      };
      const nextOverrides: Record<number, ItemConfigOverride> = {
        ...prev.itemOverrides,
        [itemId]: merged,
      };
      // Sync tree growth time & harvest yield onto linked partner (seed <-> block)
      if (linkedPartnerId && CATALOG[linkedPartnerId] && (patch.growthTimeMs !== undefined || patch.treeHarvestYield !== undefined)) {
        const partnerEff = getEffectiveItemDef(linkedPartnerId, prev) ?? CATALOG[linkedPartnerId];
        const partnerExisting = prev.itemOverrides[linkedPartnerId] ?? {};
        nextOverrides[linkedPartnerId] = {
          ...partnerExisting,
          hardness: partnerExisting.hardness ?? partnerEff.hardness,
          gemValue: partnerExisting.gemValue ?? partnerEff.gemValue,
          xpValue: partnerExisting.xpValue ?? partnerEff.xpValue,
          growthTimeMs: patch.growthTimeMs ?? partnerExisting.growthTimeMs ?? partnerEff.growthTimeMs,
          drops: partnerExisting.drops ?? partnerEff.drops ?? [],
          treeHarvestYield:
            patch.treeHarvestYield ?? partnerExisting.treeHarvestYield ?? partnerEff.treeHarvestYield,
        };
      }
      return {
        ...prev,
        itemOverrides: nextOverrides,
      };
    });
  };

  const handleQuickAssignFarmability = (
    itemId: number,
    tier: FarmabilityTier,
    autoSave = false
  ) => {
    const { targetItemId, override } = buildFarmabilityOverride(itemId, tier, draft);
    const targetName = CATALOG[targetItemId]?.name ?? `#${targetItemId}`;
    const nextDraft: GameConfig = {
      ...draft,
      itemOverrides: {
        ...draft.itemOverrides,
        [targetItemId]: override,
      },
    };
    setDraft(nextDraft);
    if (selectedItemId !== targetItemId && section === 'drops') {
      setSelectedItemId(targetItemId);
    }
    const postAnalysis = calculateFarmabilityProfile(targetItemId, nextDraft);
    if (autoSave) {
      onSaveConfig(nextDraft);
      showFeedback(
        `${targetName} saved as ${tier.toUpperCase()} (${postAnalysis.expectedBlockYield.toFixed(2)}× block yield)`
      );
    } else {
      showFeedback(
        `Assigned ${tier.toUpperCase()} to ${targetName} → ${postAnalysis.expectedBlockYield.toFixed(2)}× Expected Yield`
      );
    }
  };

  const handleBatchAssignFiltered = (tier: FarmabilityTier) => {
    const candidateIds = filteredCatalogItems
      .filter(
        (i) =>
          i.breakable &&
          (i.category === 'foreground' ||
            i.category === 'farmable' ||
            i.category === 'background' ||
            i.category === 'interactive')
      )
      .map((i) => i.id);
    if (candidateIds.length === 0) return;
    const nextDraft = applyFarmabilityTier(draft, candidateIds, tier);
    setDraft(nextDraft);
    showFeedback(
      `Applied ${tier.toUpperCase()} rates & values to ${candidateIds.length} filtered blocks`
    );
  };

  const resetItemToDefault = (itemId: number) => {
    setDraft((prev) => {
      const nextOverrides = { ...prev.itemOverrides };
      delete nextOverrides[itemId];
      return { ...prev, itemOverrides: nextOverrides };
    });
    showFeedback(`Reset ${CATALOG[itemId]?.name ?? 'item'} to default values`);
  };

  const updateDropRow = (idx: number, patch: Partial<DropEntry>) => {
    if (!effectiveItem) return;
    const currentDrops = [...(effectiveItem.drops ?? [])];
    if (!currentDrops[idx]) return;
    const updated = { ...currentDrops[idx], ...patch };
    if (updated.maxQty < updated.minQty) updated.maxQty = updated.minQty;
    currentDrops[idx] = updated;
    updateItemOverride(selectedItemId, { drops: currentDrops });
  };

  const removeDropRow = (idx: number) => {
    if (!effectiveItem) return;
    const currentDrops = (effectiveItem.drops ?? []).filter((_, i) => i !== idx);
    updateItemOverride(selectedItemId, { drops: currentDrops });
  };

  const addDropRow = () => {
    if (!effectiveItem) return;
    const currentDrops = [...(effectiveItem.drops ?? [])];
    currentDrops.push({
      itemId: newDropItemId,
      chance: 0.25,
      minQty: 1,
      maxQty: 1,
    });
    updateItemOverride(selectedItemId, { drops: currentDrops });
  };

  // Store bundle helpers
  const storeListings: GemStoreListing[] = draft.storeListings ?? GEM_STORE_LISTINGS;
  const activeListing = storeListings[selectedStoreIdx] ?? storeListings[0];

  const updateStoreListing = (idx: number, patch: Partial<GemStoreListing>) => {
    setDraft((prev) => {
      const list = [...(prev.storeListings ?? GEM_STORE_LISTINGS)];
      if (!list[idx]) return prev;
      list[idx] = { ...list[idx], ...patch };
      return { ...prev, storeListings: list };
    });
  };

  const addStoreListing = () => {
    const newId = `custom_pack_${Date.now().toString(36).slice(-4)}`;
    const newEntry: GemStoreListing = {
      id: newId,
      section: 'blocks',
      name: 'New Admin Pack',
      description: 'Custom admin store bundle.',
      iconItemId: ITEM_IDS.GP_DIRT,
      gemPrice: 25,
      grants: [{ itemId: ITEM_IDS.GP_DIRT, qty: 25 }],
    };
    setDraft((prev) => {
      const list = [...(prev.storeListings ?? GEM_STORE_LISTINGS), newEntry];
      setSelectedStoreIdx(list.length - 1);
      return { ...prev, storeListings: list };
    });
  };

  const deleteStoreListing = (idx: number) => {
    if (storeListings.length <= 1) return;
    setDraft((prev) => {
      const list = (prev.storeListings ?? GEM_STORE_LISTINGS).filter((_, i) => i !== idx);
      setSelectedStoreIdx(Math.max(0, idx - 1));
      return { ...prev, storeListings: list };
    });
  };

  const cycleSelectedItem = (dir: -1 | 1) => {
    const pool = filteredCatalogItems.length > 0 ? filteredCatalogItems : editableItems;
    const curIdx = pool.findIndex((i) => i.id === selectedItemId);
    const nextIdx = curIdx === -1 ? 0 : (curIdx + dir + pool.length) % pool.length;
    setSelectedItemId(pool[nextIdx].id);
  };

  const filterChips: { id: QuickFilterChip; label: string }[] = [
    { id: 'all', label: `All (${editableItems.length})` },
    { id: 'farmable', label: 'Farmables' },
    { id: 'blocks', label: 'Blocks' },
    { id: 'seeds', label: 'Seeds' },
    { id: 'biome', label: 'Biomes' },
    { id: 'backgrounds', label: 'Walls' },
    { id: 'modified', label: `Edited (${modifiedCount})` },
    { id: 'locks', label: 'Locks' },
    { id: 'wearables', label: 'Gear' },
  ];

  return (
    <div
      data-testid="admin-panel"
      className="flex flex-col h-full min-h-0 text-[#f7f4eb] select-none"
    >
      {/* Compact Mobile-First Top Bar */}
      <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-[#28425e] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-[#f2b738] text-[#1a1204] font-pixel text-[9px] shrink-0">
            ADMIN
          </span>
          <h2 className="font-pixel text-[10px] sm:text-xs text-[#ffe18c] truncate">
            Control &amp; Farmability
          </h2>
          {modifiedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-[#213b57] border border-[#f2b738]/60 text-[10px] font-mono-num font-bold text-[#ffe18c] shrink-0">
              {modifiedCount} edited
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onAdminAction({ action: 'grant_gems', gems: 500 })}
            className="px-2 py-1 rounded bg-[#153447] hover:bg-[#1e4963] border border-[#38e8d8] text-[10px] font-mono-num font-bold text-[#8cf7ee] cursor-pointer"
            title="Instant +500 Gems"
          >
            +500G
          </button>
          {inWorld && (
            <button
              type="button"
              onClick={() => onAdminAction({ action: 'grow_all_trees' })}
              className="px-2 py-1 rounded bg-[#1d3b26] hover:bg-[#275234] border border-[#82e068] text-[10px] font-bold text-[#a8f794] cursor-pointer"
              title="Instantly Mature All Planted Trees"
            >
              Grow Trees
            </button>
          )}
          {onClose && (
            <button
              type="button"
              aria-label="Close Admin Panel"
              onClick={onClose}
              className="p-1 rounded bg-[#192b3d] hover:bg-[#243d57] border border-[#3a597a] text-[#c8d9ea] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackBanner && (
        <div className="mt-1.5 px-2.5 py-1 rounded bg-[#183828] border border-[#82e068] text-[11px] font-bold text-[#a8f794] flex items-center justify-between shrink-0">
          <span className="truncate">{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="ml-2 text-[10px] text-[#82e068] hover:text-white cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* 4-Tab Mobile Navigation Grid */}
      <div className="grid grid-cols-4 gap-1 my-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setSection('catalog')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] sm:text-xs font-bold cursor-pointer transition-colors ${
            section === 'catalog'
              ? 'bg-[#362b12] border border-[#f2b738] text-[#ffe18c]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Catalogue</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('drops')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] sm:text-xs font-bold cursor-pointer transition-colors ${
            section === 'drops'
              ? 'bg-[#1a3829] border border-[#82e068] text-[#a8f794]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span>Farm &amp; Rates</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('store')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] sm:text-xs font-bold cursor-pointer transition-colors ${
            section === 'store'
              ? 'bg-[#153447] border border-[#38e8d8] text-[#8cf7ee]'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          <span>Store</span>
        </button>

        <button
          type="button"
          onClick={() => setSection('tools')}
          className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded text-[10px] sm:text-xs font-bold cursor-pointer transition-colors ${
            section === 'tools'
              ? 'bg-[#213b57] border border-[#78c8f5] text-white'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span>Tools</span>
        </button>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-2 min-h-0">
        {/* ===================================================================
            TAB 1: WHOLE-CATALOGUE MINIMIZED SEARCH & QUICK FARMABILITY ASSIGN
           =================================================================== */}
        {section === 'catalog' && (
          <div className="flex flex-col gap-2">
            {/* Minimized Single-Bar Search + Sort + Wrapped Pill Filter Strip */}
            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-[#7897b5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search Whole Catalogue"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search all 120 items (name, #ID, desert, snow, cave)..."
                    className="w-full pl-8 pr-7 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs text-white focus:outline-none focus:border-[#f2b738]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8aa4bd] hover:text-white cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <select
                  aria-label="Sort Catalogue"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as CatalogSortKey)}
                  className="px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-[11px] font-semibold text-[#d2e3f3] shrink-0"
                >
                  <option value="id">Sort: #ID</option>
                  <option value="yield">Sort: Yield ×</option>
                  <option value="name">Sort: A–Z</option>
                  <option value="rarity">Sort: Rarity</option>
                  <option value="hardness">Sort: Hits</option>
                </select>
              </div>

              {/* Wrapped Compact Filter Chips (No Horizontal Clipping on Mobile) */}
              <div className="flex flex-wrap items-center gap-1">
                {filterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setQuickFilter(chip.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                      quickFilter === chip.id
                        ? 'bg-[#214463] border-[#78c8f5] text-white'
                        : 'bg-[#060d14] border-[#1f3347] text-[#8aa4bd] hover:text-white'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Compact Batch Farmability Bar for Filtered Items */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#182a3d] text-[10px]">
                <span className="text-[#8aa4bd] font-mono-num">
                  Showing <strong className="text-white">{filteredCatalogItems.length}</strong> /{' '}
                  {editableItems.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleBatchAssignFiltered('balanced')}
                    className="px-2 py-0.5 rounded bg-[#162d42] hover:bg-[#1f405e] border border-[#4b82b8] text-[#b8dcff] font-bold cursor-pointer"
                  >
                    Set Filtered Balanced (1.06×)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchAssignFiltered('farmable')}
                    className="px-2 py-0.5 rounded bg-[#193829] hover:bg-[#234f3a] border border-[#82e068] text-[#a8f794] font-bold cursor-pointer"
                  >
                    Set Filtered Farmable (+1.38×)
                  </button>
                </div>
              </div>
            </div>

            {/* Portrait-Optimized Single-Column Catalogue Cards with Tree Growth & Drop Values */}
            <div className="grid grid-cols-1 gap-1.5">
              {filteredCatalogItems.map((item) => {
                const eff = getEffectiveItemDef(item.id, draft) ?? item;
                const isModified = Boolean(draft.itemOverrides[item.id]);
                const farm = farmabilityMap.get(item.id);
                const canFarm = Boolean(farm?.isFarmCandidate);
                const linkedSeedDef =
                  item.category === 'seed'
                    ? eff
                    : item.seedId
                      ? getEffectiveItemDef(item.seedId, draft)
                      : undefined;
                const treeGrowthSec = linkedSeedDef?.growthTimeMs
                  ? Math.round(linkedSeedDef.growthTimeMs / 1000)
                  : eff.growthTimeMs
                    ? Math.round(eff.growthTimeMs / 1000)
                    : null;
                const treeYield = eff.treeHarvestYield ?? linkedSeedDef?.treeHarvestYield;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded border transition-colors ${
                      selectedItemId === item.id
                        ? 'bg-[#162a40] border-[#f2b738]'
                        : isModified
                          ? 'bg-[#102233] border-[#38e8d8]/60'
                          : 'bg-[#09131d] border-[#22364a]'
                    }`}
                  >
                    {/* Left: Tap item icon/title to open directly in Rates & Farm editor */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setSection('drops');
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <img
                        src={getItemIconUrl(item.id)}
                        alt={item.name}
                        className="w-8 h-8 pixelated shrink-0 bg-[#060d14] p-0.5 rounded border border-[#243b52]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-xs font-bold text-[#f7f4eb] truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-mono-num text-[#7897b5]">
                            #{item.id}
                          </span>
                          {item.farmableTier && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-bold uppercase bg-[#193829] text-[#fde047] border border-[#82e068]">
                              FARM T{item.farmableTier}
                            </span>
                          )}
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase border ${
                              RARITY_BADGE[item.rarity] ?? RARITY_BADGE.common
                            }`}
                          >
                            {item.growPixelRarity ? `R${item.growPixelRarity}` : item.rarity}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono-num text-[#9cb5cc] flex-wrap">
                          <span>{eff.hardness} Hits</span>
                          <span>·</span>
                          <span className="text-[#8cf7ee]">{eff.gemValue}G</span>
                          {treeGrowthSec !== null && (
                            <>
                              <span>·</span>
                              <span className="text-[#a8f794]">🌳 {treeGrowthSec}s</span>
                            </>
                          )}
                          {treeYield && (
                            <>
                              <span>·</span>
                              <span className="text-[#ffe18c]">
                                Drop {treeYield.minBlocks}–{treeYield.maxBlocks} ({Math.round(treeYield.seedChance * 100)}%🌱)
                              </span>
                            </>
                          )}
                          {canFarm && farm && (
                            <>
                              <span>·</span>
                              <span
                                className={`font-bold ${
                                  farm.isPositiveYield ? 'text-[#82e068]' : 'text-[#f2b738]'
                                }`}
                              >
                                {farm.expectedBlockYield.toFixed(2)}× Yield
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Right: 1-Tap Quick Actions (Farmable Toggle + Instant Grant + Edit) */}
                    <div className="flex items-center gap-1 shrink-0">
                      {canFarm && (
                        <button
                          type="button"
                          title="1-Tap Assign Positive Block Yield (Farmable +1.38×)"
                          onClick={() => handleQuickAssignFarmability(item.id, 'farmable', false)}
                          className={`px-2 py-1.5 rounded text-[10px] font-bold border cursor-pointer ${
                            farm?.isPositiveYield
                              ? 'bg-[#193829] border-[#82e068] text-[#a8f794]'
                              : 'bg-[#132230] hover:bg-[#193829] border-[#355473] text-[#9cb5cc] hover:text-[#a8f794]'
                          }`}
                        >
                          +Farm
                        </button>
                      )}
                      <button
                        type="button"
                        title={`Grant 50 × ${item.name}`}
                        onClick={() => {
                          onAdminAction({ action: 'grant_item', itemId: item.id, qty: 50 });
                          showFeedback(`Granted 50 × ${item.name}`);
                        }}
                        className="px-2 py-1.5 rounded bg-[#1c3650] hover:bg-[#274b6e] border border-[#4b7299] text-[10px] font-mono-num font-bold text-[#e2eef7] cursor-pointer"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSection('drops');
                        }}
                        className="px-2 py-1.5 rounded bg-[#2b2312] hover:bg-[#3d3118] border border-[#f2b738]/70 text-[10px] font-bold text-[#ffe18c] cursor-pointer"
                      >
                        Tune
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: RATES, VALUES & QUICK ASSIGNMENT BY FARMABILITY
           =================================================================== */}
        {section === 'drops' && effectiveItem && (
          <div className="flex flex-col gap-2">
            {/* Compact Mobile Item Switcher Header */}
            <div className="bg-[#09131d] border border-[#28425e] rounded-md p-2 flex items-center justify-between gap-1.5 shrink-0">
              <button
                type="button"
                aria-label="Previous item"
                onClick={() => cycleSelectedItem(-1)}
                className="p-1.5 rounded bg-[#132538] hover:bg-[#1d3752] border border-[#325272] text-[#c8d9ea] cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 min-w-0 flex-1">
                <img
                  src={getItemIconUrl(selectedItemId)}
                  alt={effectiveItem.name}
                  className="w-8 h-8 pixelated shrink-0 bg-[#060d14] p-0.5 rounded border border-[#2b4763]"
                  referrerPolicy="no-referrer"
                />
                <select
                  aria-label="Select Item to Configure"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(Number(e.target.value))}
                  className="w-full min-w-0 px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white truncate"
                >
                  {editableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} {item.name} ({item.category})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                aria-label="Next item"
                onClick={() => cycleSelectedItem(1)}
                className="p-1.5 rounded bg-[#132538] hover:bg-[#1d3752] border border-[#325272] text-[#c8d9ea] cursor-pointer shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onAdminAction({ action: 'grant_item', itemId: selectedItemId, qty: 50 });
                  showFeedback(`Granted 50 × ${effectiveItem.name}`);
                }}
                className="px-2.5 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] font-bold text-[11px] shrink-0 cursor-pointer"
              >
                +50 Bag
              </button>
            </div>

            {/* SYSTEM FUNCTION CARD: CALCULATED FARMABILITY & POSITIVE YIELD QUICK ASSIGNMENT */}
            <div
              data-testid="farmability-calculator-card"
              className="bg-[#091824] border-2 border-[#38e8d8]/70 rounded-md p-2.5 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-[#82e068] shrink-0" />
                  <span className="font-pixel text-[10px] text-[#8cf7ee]">
                    FARMABILITY & POSITIVE YIELD CALCULATOR
                  </span>
                </div>
                <span
                  data-testid="farmability-yield-badge"
                  className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold border ${
                    selectedFarm.isPositiveYield
                      ? 'bg-[#193829] border-[#82e068] text-[#a8f794]'
                      : 'bg-[#382412] border-[#f2b738] text-[#ffe18c]'
                  }`}
                >
                  {selectedFarm.isPositiveYield
                    ? `POSITIVE YIELD (${selectedFarm.expectedBlockYield.toFixed(2)}×)`
                    : `SINK / BELOW 1× (${selectedFarm.expectedBlockYield.toFixed(2)}×)`}
                </span>
              </div>

              {/* Live Calculated Yield Metrics */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#060f18] border border-[#1f374d] rounded p-2 text-center">
                <div>
                  <div className="text-[10px] text-[#8aa4bd]">Expected Block Yield</div>
                  <div className="text-sm font-mono-num font-bold text-[#82e068]">
                    {selectedFarm.expectedBlockYield.toFixed(2)}×
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8aa4bd]">Net Block / Break</div>
                  <div
                    className={`text-sm font-mono-num font-bold ${
                      selectedFarm.netBlockGainPerBreak >= 0
                        ? 'text-[#8cf7ee]'
                        : 'text-[#ff9b8a]'
                    }`}
                  >
                    {selectedFarm.netBlockGainPerBreak >= 0 ? '+' : ''}
                    {selectedFarm.netBlockGainPerBreak.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#8aa4bd]">
                    {selectedFarm.hasSeedCycle ? 'Seeds / Tree Cycle' : 'Direct Block Qty'}
                  </div>
                  <div className="text-sm font-mono-num font-bold text-[#ffe18c]">
                    {selectedFarm.hasSeedCycle
                      ? `${selectedFarm.expectedSeedsPerTreeCycle.toFixed(2)} 🌱`
                      : `${selectedFarm.blockDropQty[0]}–${selectedFarm.blockDropQty[1]} blk`}
                  </div>
                </div>
              </div>

              {/* Calculated Positive Block Yield Value Ranges */}
              <div className="bg-[#07121c] border border-[#233d54] rounded p-2 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-[#ffe18c]">
                    System Farmable Value Ranges (Positive Block Yield &gt; 1.05×):
                  </span>
                  <span className="font-mono-num text-[#8cf7ee]">
                    Target #{selectedFarm.targetBlockId}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono-num mt-0.5">
                  <div className="bg-[#0c1b2a] border border-[#243c54] rounded px-2 py-1">
                    <span className="text-[#8aa4bd] block">Block Drop Rate</span>
                    <strong className="text-[#82e068]">
                      {selectedFarm.positiveYieldRanges.blockRateRangePct[0]}%–
                      {selectedFarm.positiveYieldRanges.blockRateRangePct[1]}%
                    </strong>
                  </div>
                  <div className="bg-[#0c1b2a] border border-[#243c54] rounded px-2 py-1">
                    <span className="text-[#8aa4bd] block">
                      {selectedFarm.hasSeedCycle ? 'Seed Drop Rate' : 'Block Drop Qty'}
                    </span>
                    <strong className="text-[#8cf7ee]">
                      {selectedFarm.hasSeedCycle
                        ? `${selectedFarm.positiveYieldRanges.seedRateRangePct[0]}%–${selectedFarm.positiveYieldRanges.seedRateRangePct[1]}%`
                        : `${selectedFarm.positiveYieldRanges.blockQtyRange[0]}–${selectedFarm.positiveYieldRanges.blockQtyRange[1]} blocks`}
                    </strong>
                  </div>
                  <div className="bg-[#0c1b2a] border border-[#243c54] rounded px-2 py-1">
                    <span className="text-[#8aa4bd] block">Hardness Range</span>
                    <strong className="text-[#ffe18c]">
                      {selectedFarm.positiveYieldRanges.hardnessRange[0]}–
                      {selectedFarm.positiveYieldRanges.hardnessRange[1]} hits
                    </strong>
                  </div>
                  <div className="bg-[#0c1b2a] border border-[#243c54] rounded px-2 py-1">
                    <span className="text-[#8aa4bd] block">Gem / XP Range</span>
                    <strong className="text-[#d4b8ff]">
                      {selectedFarm.positiveYieldRanges.gemValueRange[0]}–
                      {selectedFarm.positiveYieldRanges.gemValueRange[1]}G ·{' '}
                      {selectedFarm.positiveYieldRanges.xpValueRange[0]}–
                      {selectedFarm.positiveYieldRanges.xpValueRange[1]}XP
                    </strong>
                  </div>
                </div>
                <p className="text-[10px] text-[#8aa4bd] mt-0.5">
                  {selectedFarm.positiveYieldRanges.formulaSummary}
                </p>
              </div>

              {/* 1-Tap Quick Assignment by Farmability Tier */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9cb5cc]">
                  Quick Assign Rate &amp; Value Preset by Farmability:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {FARMABILITY_TIERS.map((t) => {
                    const isCurrent = selectedFarm.currentTier === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-testid={`assign-farm-${t.id}`}
                        onClick={() => handleQuickAssignFarmability(selectedItemId, t.id, false)}
                        className={`flex flex-col items-start p-2 rounded border text-left cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-[#193829] border-[#82e068] text-white shadow-[0_0_0_1px_#82e068]'
                            : 'bg-[#0b1724] hover:bg-[#14293f] border-[#2b4763] text-[#d2e3f3]'
                        }`}
                      >
                        <span className="text-[11px] font-bold text-[#ffe18c]">
                          {t.shortLabel}
                        </span>
                        <span className="text-[9px] text-[#9cb5cc] line-clamp-1">
                          {t.targetYieldLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Touch-Friendly Core Block Stats (Hardness, Max Gems, XP Value) */}
            <div className="grid grid-cols-3 gap-1.5 bg-[#09131d] border border-[#263c52] rounded-md p-2.5">
              {/* Hardness Stepper */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#9cb5cc]">Hardness (Hits)</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        hardness: Math.max(1, effectiveItem.hardness - 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    aria-label="Hardness Hits"
                    min={1}
                    max={20}
                    value={effectiveItem.hardness}
                    onChange={(e) =>
                      updateItemOverride(selectedItemId, {
                        hardness: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-full min-w-0 text-center py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        hardness: Math.min(20, effectiveItem.hardness + 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Gem Value Stepper */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#8cf7ee]">Max Gems</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        gemValue: Math.max(0, effectiveItem.gemValue - 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    aria-label="Max Gems"
                    min={0}
                    max={100}
                    value={effectiveItem.gemValue}
                    onChange={(e) =>
                      updateItemOverride(selectedItemId, {
                        gemValue: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full min-w-0 text-center py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-[#8cf7ee]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        gemValue: Math.min(100, effectiveItem.gemValue + 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* XP Value Stepper */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#ffe18c]">XP Reward</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        xpValue: Math.max(0, effectiveItem.xpValue - 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    aria-label="XP Value"
                    min={0}
                    max={200}
                    value={effectiveItem.xpValue}
                    onChange={(e) =>
                      updateItemOverride(selectedItemId, {
                        xpValue: Math.max(0, Math.min(200, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full min-w-0 text-center py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-[#ffe18c]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateItemOverride(selectedItemId, {
                        xpValue: Math.min(200, effectiveItem.xpValue + 1),
                      })
                    }
                    className="w-7 h-7 rounded bg-[#14263a] border border-[#314e6b] font-bold text-xs text-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Portrait Studio Card: Tree Growth Time & Tree Harvest Drop Values */}
            {(selectedFarm.hasSeedCycle ||
              effectiveItem.category === 'seed' ||
              Boolean(effectiveItem.seedId) ||
              Boolean(effectiveItem.treeHarvestYield)) && (() => {
              const linkedSeedDef =
                effectiveItem.category === 'seed'
                  ? effectiveItem
                  : effectiveItem.seedId
                    ? getEffectiveItemDef(effectiveItem.seedId, draft)
                    : undefined;
              const rawGrowthMs =
                effectiveItem.growthTimeMs ?? linkedSeedDef?.growthTimeMs ?? 30000;
              const growthSeconds = Math.max(1, Math.round(rawGrowthMs / 1000));
              const effectiveLiveSec = Math.max(
                1,
                Math.round(growthSeconds / Math.max(0.1, draft.mechanics.growthMultiplier || 1))
              );
              const treeYield = effectiveItem.treeHarvestYield ??
                linkedSeedDef?.treeHarvestYield ?? {
                  minBlocks: 2,
                  maxBlocks: 4,
                  seedChance: 0.25,
                };
              const seedChancePct = Math.round(treeYield.seedChance * 100);

              return (
                <div
                  data-testid="tree-growth-and-yield-card"
                  className="bg-[#0b1b16] border border-[#3d7a4f] rounded-md p-2.5 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#a8f794] flex items-center gap-1.5">
                      <Sprout className="w-3.5 h-3.5 text-[#82e068]" />
                      <span>Tree Growth Time &amp; Harvest Drop Values</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-[#fde047]">
                      Live Grow: {effectiveLiveSec}s ({draft.mechanics.growthMultiplier.toFixed(1)}× speed)
                    </span>
                  </div>

                  {/* Row 1: Tree Growth Time (Seconds) + Quick Presets */}
                  <div className="bg-[#06110d] border border-[#234d33] rounded p-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-[#c7eed4]">
                        Tree Growth Time (Seconds)
                      </span>
                      <div className="flex items-center gap-1">
                        {[5, 15, 30, 60, 90].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() =>
                              updateItemOverride(selectedItemId, {
                                growthTimeMs: sec * 1000,
                              })
                            }
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold cursor-pointer border ${
                              growthSeconds === sec
                                ? 'bg-[#193829] border-[#82e068] text-white'
                                : 'bg-[#091712] border-[#264a34] text-[#9cb5cc]'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={300}
                        step={1}
                        value={Math.min(300, growthSeconds)}
                        onChange={(e) =>
                          updateItemOverride(selectedItemId, {
                            growthTimeMs: Math.max(1, Number(e.target.value) || 1) * 1000,
                          })
                        }
                        className="flex-1 accent-[#82e068]"
                      />
                      <input
                        type="number"
                        aria-label="Tree Growth Seconds"
                        min={1}
                        max={3600}
                        value={growthSeconds}
                        onChange={(e) =>
                          updateItemOverride(selectedItemId, {
                            growthTimeMs:
                              Math.max(1, Math.min(3600, Number(e.target.value) || 1)) * 1000,
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-[#a8f794]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Tree Harvest Drop Values (Min Blocks, Max Blocks, Seed Refund %) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <label className="flex flex-col gap-1 bg-[#06110d] border border-[#234d33] rounded p-1.5 text-[10px] text-[#c7eed4]">
                      <span>Tree Min Blocks</span>
                      <input
                        type="number"
                        aria-label="Tree Min Blocks"
                        min={1}
                        max={50}
                        value={treeYield.minBlocks}
                        onChange={(e) => {
                          const minB = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                          updateItemOverride(selectedItemId, {
                            treeHarvestYield: {
                              ...treeYield,
                              minBlocks: minB,
                              maxBlocks: Math.max(minB, treeYield.maxBlocks),
                            },
                          });
                        }}
                        className="w-full py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                      />
                    </label>

                    <label className="flex flex-col gap-1 bg-[#06110d] border border-[#234d33] rounded p-1.5 text-[10px] text-[#c7eed4]">
                      <span>Tree Max Blocks</span>
                      <input
                        type="number"
                        aria-label="Tree Max Blocks"
                        min={treeYield.minBlocks}
                        max={50}
                        value={treeYield.maxBlocks}
                        onChange={(e) => {
                          const maxB = Math.max(
                            treeYield.minBlocks,
                            Math.min(50, Number(e.target.value) || treeYield.minBlocks)
                          );
                          updateItemOverride(selectedItemId, {
                            treeHarvestYield: {
                              ...treeYield,
                              maxBlocks: maxB,
                            },
                          });
                        }}
                        className="w-full py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                      />
                    </label>

                    <label className="flex flex-col gap-1 bg-[#06110d] border border-[#234d33] rounded p-1.5 text-[10px] text-[#fde047]">
                      <span>Tree Seed %</span>
                      <input
                        type="number"
                        aria-label="Tree Seed Chance Percent"
                        min={0}
                        max={100}
                        value={seedChancePct}
                        onChange={(e) => {
                          const pctVal = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          updateItemOverride(selectedItemId, {
                            treeHarvestYield: {
                              ...treeYield,
                              seedChance: pctVal / 100,
                            },
                          });
                        }}
                        className="w-full py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-[#fde047]"
                      />
                    </label>
                  </div>
                </div>
              );
            })()}

            {/* Mobile-Friendly Drop Entries List */}
            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#ffe18c]">
                  Drop Table ({(effectiveItem.drops ?? []).length} entries)
                </span>
                {draft.itemOverrides[selectedItemId] && (
                  <button
                    type="button"
                    onClick={() => resetItemToDefault(selectedItemId)}
                    className="text-[10px] font-bold text-[#ff9b8a] hover:text-white cursor-pointer"
                  >
                    Reset Item Default
                  </button>
                )}
              </div>

              {(effectiveItem.drops ?? []).length === 0 ? (
                <p className="text-xs text-[#7897b5] py-1">
                  No drops configured. Tap a Farmability preset above or add a drop below.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(effectiveItem.drops ?? []).map((drop, idx) => {
                    const dropDef = CATALOG[drop.itemId];
                    const pct = Math.round(drop.chance * 100);
                    return (
                      <div
                        key={`${drop.itemId}-${idx}`}
                        className="bg-[#0e1c2b] border border-[#28425e] rounded p-2 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <img
                              src={getItemIconUrl(drop.itemId)}
                              alt={dropDef?.name ?? ''}
                              className="w-6 h-6 pixelated shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <select
                              aria-label={`Drop Item ${idx + 1}`}
                              value={drop.itemId}
                              onChange={(e) =>
                                updateDropRow(idx, { itemId: Number(e.target.value) })
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white truncate"
                            >
                              {editableItems.map((it) => (
                                <option key={it.id} value={it.id}>
                                  #{it.id} {it.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove drop ${dropDef?.name ?? idx}`}
                            onClick={() => removeDropRow(idx)}
                            className="p-1.5 rounded bg-[#3b1b1f] hover:bg-[#54242a] text-[#ffb0b0] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Drop Rate Slider + Quick Rate Pills + Min/Max Stepper */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex-1 flex flex-col gap-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[#9cb5cc]">Drop Rate:</span>
                              <span className="font-mono-num font-bold text-[#82e068]">
                                {pct}%
                              </span>
                            </div>
                            <input
                              type="range"
                              aria-label={`Drop Rate Percent ${idx + 1}`}
                              min={0}
                              max={100}
                              step={1}
                              value={pct}
                              onChange={(e) =>
                                updateDropRow(idx, {
                                  chance: Math.max(0, Math.min(100, Number(e.target.value))) / 100,
                                })
                              }
                              className="w-full accent-[#82e068]"
                            />
                            <div className="flex items-center gap-1">
                              {[20, 40, 65, 80, 95, 100].map((presetPct) => (
                                <button
                                  key={presetPct}
                                  type="button"
                                  onClick={() =>
                                    updateDropRow(idx, { chance: presetPct / 100 })
                                  }
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono-num font-bold cursor-pointer ${
                                    pct === presetPct
                                      ? 'bg-[#214463] border border-[#82e068] text-white'
                                      : 'bg-[#060d14] border border-[#22384f] text-[#8aa4bd]'
                                  }`}
                                >
                                  {presetPct}%
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Min / Max Qty Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="flex flex-col text-[10px] text-[#9cb5cc]">
                              <span>Min Qty</span>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={drop.minQty}
                                onChange={(e) =>
                                  updateDropRow(idx, {
                                    minQty: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-14 px-2 py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                              />
                            </label>
                            <label className="flex flex-col text-[10px] text-[#9cb5cc]">
                              <span>Max Qty</span>
                              <input
                                type="number"
                                min={drop.minQty}
                                max={50}
                                value={drop.maxQty}
                                onChange={(e) =>
                                  updateDropRow(idx, {
                                    maxQty: Math.max(drop.minQty, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-14 px-2 py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Drop Entry Bar */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[#1e334a]">
                <select
                  aria-label="New Drop Item"
                  value={newDropItemId}
                  onChange={(e) => setNewDropItemId(Number(e.target.value))}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs text-white truncate"
                >
                  {editableItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      #{it.id} {it.name} ({it.category})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addDropRow}
                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#214463] hover:bg-[#2d5b82] border border-[#78c8f5] text-xs font-bold text-white shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Drop</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: GEM STORE BUNDLE EDITOR (MOBILE STREAMLINED)
           =================================================================== */}
        {section === 'store' && activeListing && (
          <div className="flex flex-col gap-2.5">
            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2.5 flex items-center justify-between gap-2">
              <select
                aria-label="Select Store Bundle"
                value={selectedStoreIdx}
                onChange={(e) => setSelectedStoreIdx(Number(e.target.value))}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white truncate"
              >
                {storeListings.map((l, idx) => (
                  <option key={l.id} value={idx}>
                    [{l.section.toUpperCase()}] {l.name} — {l.gemPrice} Gems
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addStoreListing}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#1d3b26] border border-[#82e068] text-xs font-bold text-[#a8f794] shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
              {storeListings.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteStoreListing(selectedStoreIdx)}
                  className="p-1.5 rounded bg-[#3b1b1f] border border-[#7a343d] text-[#ffb0b0] shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2.5 flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px] text-[#9cb5cc]">
                  <span>Bundle Name</span>
                  <input
                    type="text"
                    value={activeListing.name}
                    onChange={(e) =>
                      updateStoreListing(selectedStoreIdx, { name: e.target.value })
                    }
                    className="px-2.5 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-[11px] text-[#9cb5cc]">
                    <span>Section</span>
                    <select
                      value={activeListing.section}
                      onChange={(e) =>
                        updateStoreListing(selectedStoreIdx, {
                          section: e.target.value as StoreSection,
                        })
                      }
                      className="px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white"
                    >
                      <option value="locks">Locks</option>
                      <option value="tools">Tools</option>
                      <option value="blocks">Blocks</option>
                      <option value="seeds">Seeds</option>
                      <option value="wearables">Wearables</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] text-[#8cf7ee]">
                    <span>Price (Gems)</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={activeListing.gemPrice}
                      onChange={(e) =>
                        updateStoreListing(selectedStoreIdx, {
                          gemPrice: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-[#8cf7ee]"
                    />
                  </label>
                </div>
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-[#9cb5cc]">
                <span>Description</span>
                <input
                  type="text"
                  value={activeListing.description}
                  onChange={(e) =>
                    updateStoreListing(selectedStoreIdx, { description: e.target.value })
                  }
                  className="px-2.5 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs text-white"
                />
              </label>

              {/* Granted Items */}
              <div className="flex flex-col gap-1.5 pt-1 border-t border-[#1e334a]">
                <span className="text-[11px] font-bold text-[#ffe18c]">Granted Items</span>
                {activeListing.grants.map((g, gIdx) => (
                  <div
                    key={`${g.itemId}-${gIdx}`}
                    className="flex items-center justify-between gap-2 bg-[#0e1c2b] border border-[#28425e] rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <img
                        src={getItemIconUrl(g.itemId)}
                        alt=""
                        className="w-5 h-5 pixelated shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-xs font-bold text-white truncate">
                        {CATALOG[g.itemId]?.name ?? `#${g.itemId}`}
                      </span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={250}
                      value={g.qty}
                      onChange={(e) => {
                        const nextGrants = [...activeListing.grants];
                        nextGrants[gIdx] = {
                          ...nextGrants[gIdx],
                          qty: Math.max(1, Number(e.target.value) || 1),
                        };
                        updateStoreListing(selectedStoreIdx, { grants: nextGrants });
                      }}
                      className="w-16 px-2 py-1 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                    />
                    {activeListing.grants.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextGrants = activeListing.grants.filter((_, i) => i !== gIdx);
                          updateStoreListing(selectedStoreIdx, { grants: nextGrants });
                        }}
                        className="p-1 rounded bg-[#3b1b1f] text-[#ffb0b0] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-1.5 pt-1">
                  <select
                    value={newGrantItemId}
                    onChange={(e) => setNewGrantItemId(Number(e.target.value))}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs text-white truncate"
                  >
                    {editableItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        #{it.id} {it.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newGrantQty}
                    onChange={(e) => setNewGrantQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-14 px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num text-center text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateStoreListing(selectedStoreIdx, {
                        grants: [
                          ...activeListing.grants,
                          { itemId: newGrantItemId, qty: newGrantQty },
                        ],
                      });
                    }}
                    className="px-2.5 py-1.5 rounded bg-[#214463] border border-[#78c8f5] text-xs font-bold text-white shrink-0 cursor-pointer"
                  >
                    +Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 4: WORLD & ADMIN TOOLS (UNIFIED QUICK ACTIONS + MECHANICS)
           =================================================================== */}
        {section === 'tools' && (
          <div className="flex flex-col gap-2.5">
            {/* Quick Item & Gem Spawner */}
            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#ffe18c]">
                <Wrench className="w-3.5 h-3.5" />
                <span>Instant Admin Spawner</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-1.5">
                <select
                  aria-label="Spawn Item"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(Number(e.target.value))}
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white truncate"
                >
                  {editableItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      #{it.id} {it.name} ({it.category})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    aria-label="Grant Quantity"
                    min={1}
                    max={200}
                    value={grantQty}
                    onChange={(e) =>
                      setGrantQty(Math.max(1, Math.min(200, Number(e.target.value) || 1)))
                    }
                    className="w-16 px-2 py-1.5 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-center text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onAdminAction({
                        action: 'grant_item',
                        itemId: selectedItemId,
                        qty: grantQty,
                      });
                      showFeedback(
                        `Granted ${grantQty} × ${CATALOG[selectedItemId]?.name ?? 'item'}`
                      );
                    }}
                    className="px-3 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] text-xs font-bold cursor-pointer shrink-0"
                  >
                    Grant Item
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onAdminAction({ action: 'grant_gems', gems: grantGemsAmt })
                  }
                  className="flex items-center justify-center gap-1 py-2 rounded bg-[#153447] hover:bg-[#1e4963] border border-[#38e8d8] text-xs font-mono-num font-bold text-[#8cf7ee] cursor-pointer"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>+{grantGemsAmt} Gems</span>
                </button>

                <button
                  type="button"
                  disabled={!inWorld}
                  onClick={() => onAdminAction({ action: 'grow_all_trees' })}
                  className="flex items-center justify-center gap-1 py-2 rounded bg-[#1d3b26] disabled:opacity-40 border border-[#82e068] text-xs font-bold text-[#a8f794] cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Grow Trees</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDraft(cloneGameConfig(DEFAULT_GAME_CONFIG));
                    onAdminAction({ action: 'reset_config' });
                    showFeedback('Reset all mechanics & item rates to defaults');
                  }}
                  className="flex items-center justify-center gap-1 py-2 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] text-xs font-bold text-[#ffd4d4] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </button>
              </div>
            </div>

            {/* Compact World & Physics Sliders */}
            <div className="bg-[#09131d] border border-[#263c52] rounded-md p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Camera Zoom</span>
                  <span className="font-mono-num font-bold text-[#ffe18c]">
                    {draft.mechanics.viewScale.toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={2.4}
                  step={0.05}
                  value={draft.mechanics.viewScale}
                  onChange={(e) => setMech('viewScale', Number(e.target.value))}
                  className="accent-[#f2b738]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Build/Punch Reach</span>
                  <span className="font-mono-num font-bold text-[#ffe18c]">
                    {draft.mechanics.reachTiles.toFixed(1)} tiles
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={0.5}
                  value={draft.mechanics.reachTiles}
                  onChange={(e) => setMech('reachTiles', Number(e.target.value))}
                  className="accent-[#f2b738]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Punch Speed (Cooldown)</span>
                  <span className="font-mono-num font-bold text-[#8cf7ee]">
                    {draft.mechanics.punchCooldownMs} ms
                  </span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={500}
                  step={10}
                  value={draft.mechanics.punchCooldownMs}
                  onChange={(e) => setMech('punchCooldownMs', Number(e.target.value))}
                  className="accent-[#38e8d8]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Run Speed</span>
                  <span className="font-mono-num font-bold text-[#8cf7ee]">
                    {draft.mechanics.moveSpeed} px/s
                  </span>
                </div>
                <input
                  type="range"
                  min={150}
                  max={520}
                  step={10}
                  value={draft.mechanics.moveSpeed}
                  onChange={(e) => setMech('moveSpeed', Number(e.target.value))}
                  className="accent-[#38e8d8]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Tree Growth Speed</span>
                  <span className="font-mono-num font-bold text-[#82e068]">
                    {draft.mechanics.growthMultiplier.toFixed(1)}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={5}
                  step={0.2}
                  value={draft.mechanics.growthMultiplier}
                  onChange={(e) => setMech('growthMultiplier', Number(e.target.value))}
                  className="accent-[#82e068]"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9cb5cc]">Global Gem Drop Chance</span>
                  <span className="font-mono-num font-bold text-[#8cf7ee]">
                    {Math.round(draft.mechanics.globalGemDropChance * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.mechanics.globalGemDropChance}
                  onChange={(e) => setMech('globalGemDropChance', Number(e.target.value))}
                  className="accent-[#38e8d8]"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Save Bar for 1-Thumb Mobile Reach */}
      <div className="pt-2 mt-2 border-t border-[#28425e] flex items-center justify-between gap-2 shrink-0">
        <div className="text-[10px] text-[#9cb5cc] truncate">
          {modifiedCount > 0
            ? `${modifiedCount} item override(s) staged`
            : 'All items using live config'}
        </div>
        <button
          type="button"
          data-testid="admin-save-config-btn"
          onClick={() => {
            onSaveConfig(draft);
            showFeedback('Saved & broadcast live config to all worlds!');
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-pixel text-[10px] cursor-pointer shrink-0 shadow-md"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save &amp; Apply Live</span>
        </button>
      </div>
    </div>
  );
};
