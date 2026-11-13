import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Copy,
  Edit2,
  Package,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShoppingBag,
  Sliders,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  CATALOG,
  GEM_STORE_LISTINGS,
  ITEM_IDS,
  type DropEntry,
  type GemStoreListing,
  type ItemCategory,
  type ItemDefinition,
  type ItemRarity,
  type StoreSection,
} from '../game/catalog.ts';
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

type AdminSubTab = 'catalogue' | 'drops' | 'store' | 'mechanics' | 'tools';

const ALL_CATALOG_ITEMS: ItemDefinition[] = Object.values(CATALOG).filter(
  (item) => item.id !== ITEM_IDS.AIR && item.id !== ITEM_IDS.BG_SKY
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

const RARITY_ORDER: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
};

const CATEGORY_NAMES: Record<ItemCategory, string> = {
  foreground: 'Block',
  background: 'Background',
  seed: 'Seed',
  lock: 'Lock',
  interactive: 'Interactive',
  wearable: 'Wearable',
  tool: 'Tool',
};

const RARITY_STYLES: Record<
  ItemRarity,
  { border: string; bg: string; text: string; badgeBg: string }
> = {
  common: {
    border: 'border-[#3b526b]',
    bg: 'bg-[#0a1520]',
    text: 'text-[#a9c2db]',
    badgeBg: 'bg-[#1b2b3d]',
  },
  uncommon: {
    border: 'border-[#4aa64d]',
    bg: 'bg-[#0b1f11]',
    text: 'text-[#82e068]',
    badgeBg: 'bg-[#15381c]',
  },
  rare: {
    border: 'border-[#38a3d8]',
    bg: 'bg-[#0a1e2f]',
    text: 'text-[#89d6ff]',
    badgeBg: 'bg-[#13324d]',
  },
  epic: {
    border: 'border-[#d06ae6]',
    bg: 'bg-[#220d2b]',
    text: 'text-[#f5afff]',
    badgeBg: 'bg-[#3d184d]',
  },
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  gameConfig,
  inWorld,
  onSaveConfig,
  onAdminAction,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('catalogue');
  const [draft, setDraft] = useState<GameConfig>(() => cloneGameConfig(gameConfig));
  const [selectedTileId, setSelectedTileId] = useState<number>(ITEM_IDS.GP_GRASS);

  // Catalogue Filters
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [catalogueType, setCatalogueType] = useState<ItemCategory | 'all'>('all');
  const [catalogueRarity, setCatalogueRarity] = useState<ItemRarity | 'all'>('all');
  const [catalogueSort, setCatalogueSort] = useState<
    'id_asc' | 'id_desc' | 'name' | 'rarity' | 'hardness' | 'gems'
  >('id_asc');

  // Store Editor State
  const [storeSectionFilter, setStoreSectionFilter] = useState<StoreSection | 'all'>('all');
  const [editingListing, setEditingListing] = useState<GemStoreListing | null>(null);

  // Quick Tools state
  const [grantItemId, setGrantItemId] = useState<number>(ITEM_IDS.GP_DIRT);
  const [grantQty, setGrantQty] = useState<number>(25);
  const [grantGemsAmt, setGrantGemsAmt] = useState<number>(500);

  useEffect(() => {
    setDraft(cloneGameConfig(gameConfig));
  }, [gameConfig]);

  const effectiveDef = getEffectiveItemDef(selectedTileId, draft);
  const currentOverride = draft.itemOverrides[selectedTileId] ?? {};
  const activeDrops: DropEntry[] = currentOverride.drops ?? effectiveDef?.drops ?? [];

  // Item modification helpers
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

  // Store Listings Helpers
  const activeStoreListings: GemStoreListing[] = useMemo(() => {
    return draft.storeListings ?? [...GEM_STORE_LISTINGS];
  }, [draft.storeListings]);

  const updateStoreListings = (nextListings: GemStoreListing[]) => {
    setDraft((prev) => ({
      ...prev,
      storeListings: nextListings,
    }));
  };

  const handleDuplicateListing = (listing: GemStoreListing) => {
    const suffix = Math.random().toString(36).slice(2, 6);
    const copy: GemStoreListing = {
      ...listing,
      id: `${listing.id}_${suffix}`,
      name: `${listing.name} (Copy)`,
      grants: listing.grants.map((g) => ({ ...g })),
    };
    updateStoreListings([...activeStoreListings, copy]);
  };

  const handleDeleteListing = (id: string) => {
    updateStoreListings(activeStoreListings.filter((l) => l.id !== id));
  };

  const handleMoveListing = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeStoreListings.length) return;
    const next = [...activeStoreListings];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    updateStoreListings(next);
  };

  const handleCreateNewListing = () => {
    const newId = `store_custom_${Date.now().toString(36).slice(-5)}`;
    setEditingListing({
      id: newId,
      section: 'blocks',
      name: 'Special Builder Bundle',
      description: 'Handpicked items for world builders and architects.',
      iconItemId: ITEM_IDS.GP_BRICKS,
      gemPrice: 50,
      grants: [{ itemId: ITEM_IDS.GP_BRICKS, qty: 25 }],
    });
  };

  const handleSaveListingModal = (savedListing: GemStoreListing) => {
    const list = [...activeStoreListings];
    const existingIdx = list.findIndex((l) => l.id === savedListing.id);
    if (existingIdx >= 0) {
      list[existingIdx] = savedListing;
    } else {
      list.push(savedListing);
    }
    updateStoreListings(list);
    setEditingListing(null);
  };

  // Filtered Catalogue items
  const filteredCatalogueItems = useMemo(() => {
    return ALL_CATALOG_ITEMS.filter((item) => {
      if (catalogueType !== 'all' && item.category !== catalogueType) return false;
      if (catalogueRarity !== 'all' && item.rarity !== catalogueRarity) return false;
      if (catalogueSearch.trim()) {
        const q = catalogueSearch.trim().toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesKey = item.key.toLowerCase().includes(q);
        const matchesId = String(item.id).includes(q);
        if (!matchesName && !matchesKey && !matchesId) return false;
      }
      return true;
    }).sort((a, b) => {
      const defA = getEffectiveItemDef(a.id, draft) ?? a;
      const defB = getEffectiveItemDef(b.id, draft) ?? b;
      switch (catalogueSort) {
        case 'id_desc':
          return b.id - a.id;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'rarity':
          return RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        case 'hardness':
          return (defB.hardness ?? 0) - (defA.hardness ?? 0);
        case 'gems':
          return (defB.gemValue ?? 0) - (defA.gemValue ?? 0);
        case 'id_asc':
        default:
          return a.id - b.id;
      }
    });
  }, [catalogueSearch, catalogueType, catalogueRarity, catalogueSort, draft]);

  return (
    <div
      data-testid="admin-dev-panel"
      className="flex flex-col gap-2.5 text-xs text-[#eaf2fa] h-full overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#2b4561] pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#f2b738] text-[#1a1204] font-pixel text-[10px]">
            ADMIN DEV
          </span>
          <h3 className="font-pixel text-xs text-[#ffe18c] truncate">
            Item Catalogue, Values &amp; Store Editor
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer px-1.5 py-0.5"
          >
            Close
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <nav className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 border-b border-[#20364d] shrink-0">
        <button
          type="button"
          onClick={() => setSubTab('catalogue')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
            subTab === 'catalogue'
              ? 'bg-[#214463] border border-[#78c8f5] text-white shadow-sm'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Item Catalogue</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('drops')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
            subTab === 'drops'
              ? 'bg-[#214463] border border-[#f2b738] text-[#ffe18c] shadow-sm'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Values &amp; Drops</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('store')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
            subTab === 'store'
              ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee] shadow-sm'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Store Editor</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('mechanics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
            subTab === 'mechanics'
              ? 'bg-[#214463] border border-[#a8fff7] text-[#a8fff7] shadow-sm'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Mechanics &amp; Scale</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('tools')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${
            subTab === 'tools'
              ? 'bg-[#214463] border border-[#82e068] text-[#82e068] shadow-sm'
              : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Admin Quick Tools</span>
        </button>
      </nav>

      {/* SUBTAB 1: ITEM CATALOGUE WITH SIMPLIFIED FILTER SETTINGS */}
      {subTab === 'catalogue' && (
        <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-hidden">
          {/* Simplified Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5 shrink-0">
            {/* Search */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#7e9cb8] pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, key, ID..."
                value={catalogueSearch}
                onChange={(e) => setCatalogueSearch(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white focus:outline-none focus:border-[#78c8f5]"
              />
            </div>

            {/* Type Filter */}
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#8aa4bd] whitespace-nowrap">Type:</span>
              <select
                value={catalogueType}
                onChange={(e) => setCatalogueType(e.target.value as ItemCategory | 'all')}
                className="w-full px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                <option value="all">All Types</option>
                <option value="foreground">Blocks &amp; Terrain</option>
                <option value="background">Background Walls</option>
                <option value="seed">Seeds &amp; Saplings</option>
                <option value="lock">Locks &amp; Security</option>
                <option value="interactive">Interactive &amp; Vending</option>
                <option value="wearable">Wearables &amp; Gear</option>
                <option value="tool">Tools</option>
              </select>
            </label>

            {/* Rarity Filter */}
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#8aa4bd] whitespace-nowrap">Rarity:</span>
              <select
                value={catalogueRarity}
                onChange={(e) => setCatalogueRarity(e.target.value as ItemRarity | 'all')}
                className="w-full px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
              </select>
            </label>

            {/* Sort */}
            <label className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#8aa4bd] whitespace-nowrap">Sort:</span>
              <select
                value={catalogueSort}
                onChange={(e) => setCatalogueSort(e.target.value as typeof catalogueSort)}
                className="w-full px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                <option value="id_asc">ID (Low → High)</option>
                <option value="id_desc">ID (High → Low)</option>
                <option value="name">Name (A → Z)</option>
                <option value="rarity">Rarity (Epic First)</option>
                <option value="hardness">Hardness</option>
                <option value="gems">Max Gems</option>
              </select>
            </label>
          </div>

          {/* Filter Status Bar */}
          <div className="flex items-center justify-between text-[11px] px-1 text-[#8aa4bd] shrink-0">
            <span>
              Showing <strong className="text-white font-mono-num">{filteredCatalogueItems.length}</strong> items in Game Catalogue
            </span>
            <span className="text-[10px] text-[#8cf7ee]">
              Click any item to modify its Hardness, Drops, and Values
            </span>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {filteredCatalogueItems.map((item) => {
              const eff = getEffectiveItemDef(item.id, draft) ?? item;
              const hasOverride = !!draft.itemOverrides[item.id];
              const rStyle = RARITY_STYLES[item.rarity];
              const drops = draft.itemOverrides[item.id]?.drops ?? eff.drops ?? [];

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedTileId(item.id);
                    setSubTab('drops');
                  }}
                  className={`group relative flex flex-col justify-between p-2.5 rounded border-2 ${rStyle.border} ${rStyle.bg} hover:border-[#f2b738] hover:bg-[#16273b] transition-all cursor-pointer shadow-sm`}
                >
                  <div className="flex items-start gap-2.5">
                    <img
                      src={getItemIconUrl(item.id)}
                      alt={item.name}
                      className="w-9 h-9 pixelated shrink-0 bg-[#071018] p-1 rounded border border-[#2b4157]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[#f7f4eb] truncate text-xs group-hover:text-[#ffe18c]">
                          {item.name}
                        </span>
                        <span className="font-mono-num text-[10px] text-[#7ea0bf] bg-[#0c1824] px-1.5 py-0.5 rounded">
                          #{item.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-[#16283d] text-[#8ec8f5] font-semibold">
                          {CATEGORY_NAMES[item.category] || item.category}
                        </span>
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.2 rounded ${rStyle.badgeBg} ${rStyle.text} font-bold`}
                        >
                          {item.rarity}
                        </span>
                        {hasOverride && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#543b0e] text-[#ffd67a] font-bold">
                            MODIFIED
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-[#8ea4ba] mt-2 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1e344a] text-[10px] font-mono-num text-[#9db7ce]">
                    <div className="flex items-center gap-2">
                      <span>Hard: <b className="text-white">{eff.hardness}</b></span>
                      <span>Gems: <b className="text-[#8cf7ee]">{eff.gemValue}</b></span>
                      <span>XP: <b className="text-[#ffe18c]">{eff.xpValue}</b></span>
                    </div>
                    <span className="text-[#78c8f5] group-hover:translate-x-0.5 transition-transform font-bold">
                      Edit →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: BLOCK & BG DROPS / ITEM VALUE MODIFICATION */}
      {subTab === 'drops' && (
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
          {/* Header with back button */}
          <div className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded p-2">
            <button
              type="button"
              onClick={() => setSubTab('catalogue')}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#182c42] hover:bg-[#223d5c] text-white font-bold text-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Catalogue</span>
            </button>
            <div className="flex items-center gap-2">
              <img
                src={getItemIconUrl(selectedTileId)}
                alt={effectiveDef?.name ?? 'Selected'}
                className="w-6 h-6 pixelated"
                referrerPolicy="no-referrer"
              />
              <span className="font-bold text-[#ffe18c] text-xs">
                Editing: {effectiveDef?.name} (#{selectedTileId})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-[#9cb5cc]">
                Select Item to Modify
              </span>
              <select
                aria-label="Configurable Tile"
                value={selectedTileId}
                onChange={(e) => setSelectedTileId(Number(e.target.value))}
                className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
              >
                {ALL_CATALOG_ITEMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{CATEGORY_NAMES[item.category] || item.category.toUpperCase()}] {item.name} (#{item.id})
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

      {/* SUBTAB 3: STORE EDITOR TOOL */}
      {subTab === 'store' && (
        <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-hidden">
          {/* Store Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5 shrink-0">
            {/* Filter by section */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {(['all', 'locks', 'blocks', 'seeds', 'wearables'] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setStoreSectionFilter(sec)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase cursor-pointer ${
                    storeSectionFilter === sec
                      ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee]'
                      : 'bg-[#0a1520] border border-[#23384c] text-[#9cb5cc] hover:text-white'
                  }`}
                >
                  {sec}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => updateStoreListings([...GEM_STORE_LISTINGS])}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#203247] hover:bg-[#2b425d] text-[#a5c5e0] text-xs font-semibold cursor-pointer"
                title="Reset Gem Store to factory defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleCreateNewListing}
                className="flex items-center gap-1 px-3 py-1 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] font-bold text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Store Item</span>
              </button>
            </div>
          </div>

          {/* Store Listings List */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
            {activeStoreListings
              .filter((l) => storeSectionFilter === 'all' || l.section === storeSectionFilter)
              .map((listing, index) => {
                return (
                  <div
                    key={listing.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5 hover:border-[#38e8d8] transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <img
                        src={getItemIconUrl(listing.iconItemId)}
                        alt={listing.name}
                        className="w-8 h-8 pixelated shrink-0 bg-[#071018] p-1 rounded border border-[#283f54]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#f7f4eb] text-xs">{listing.name}</span>
                          <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-[#172b3e] text-[#89d6ff] font-semibold">
                            {listing.section}
                          </span>
                          <span className="text-[11px] font-mono-num font-bold text-[#8cf7ee] bg-[#0c262e] border border-[#1b5059] px-2 py-0.5 rounded">
                            {listing.gemPrice} Gems
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9cb5cc] mt-0.5">{listing.description}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#ffe18c] flex-wrap">
                          <span className="text-[#8aa4bd]">Grants:</span>
                          {listing.grants.map((g, gi) => (
                            <span key={gi} className="bg-[#122233] px-1.5 py-0.5 rounded font-mono-num">
                              {g.qty}x {CATALOG[g.itemId]?.name ?? `#${g.itemId}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        aria-label="Move Up"
                        disabled={index === 0}
                        onClick={() => handleMoveListing(index, 'up')}
                        className="p-1 rounded bg-[#132233] disabled:opacity-30 text-[#8aa4bd] hover:text-white cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move Down"
                        disabled={index === activeStoreListings.length - 1}
                        onClick={() => handleMoveListing(index, 'down')}
                        className="p-1 rounded bg-[#132233] disabled:opacity-30 text-[#8aa4bd] hover:text-white cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingListing({ ...listing, grants: listing.grants.map((g) => ({ ...g })) })}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#214463] hover:bg-[#2c5880] text-white text-xs font-bold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateListing(listing)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#182f45] hover:bg-[#23405c] text-[#89d6ff] text-xs font-semibold cursor-pointer"
                        title="Duplicate Listing"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteListing(listing.id)}
                        className="p-1 rounded bg-[#3b1b1f] hover:bg-[#57262c] text-[#ffb0b0] cursor-pointer"
                        title="Delete Listing"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Edit Listing Modal Drawer */}
          {editingListing && (
            <div className="fixed inset-0 z-50 bg-[#07101a]/85 flex items-center justify-center p-3">
              <div className="w-full max-w-lg bg-[#0e1d2c] border-2 border-[#38e8d8] rounded-lg shadow-2xl p-4 flex flex-col gap-3 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-[#25425c] pb-2">
                  <h4 className="font-pixel text-xs text-[#8cf7ee]">Edit Gem Store Listing</h4>
                  <button
                    type="button"
                    onClick={() => setEditingListing(null)}
                    className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#8aa4bd]">Listing Name</span>
                    <input
                      type="text"
                      maxLength={48}
                      value={editingListing.name}
                      onChange={(e) =>
                        setEditingListing({ ...editingListing, name: e.target.value })
                      }
                      className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#8aa4bd]">Listing ID</span>
                    <input
                      type="text"
                      maxLength={48}
                      value={editingListing.id}
                      onChange={(e) =>
                        setEditingListing({ ...editingListing, id: e.target.value.trim() })
                      }
                      className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white font-mono"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#8aa4bd]">Section</span>
                    <select
                      value={editingListing.section}
                      onChange={(e) =>
                        setEditingListing({
                          ...editingListing,
                          section: e.target.value as StoreSection,
                        })
                      }
                      className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                    >
                      <option value="locks">Locks &amp; Shops</option>
                      <option value="blocks">Building Blocks</option>
                      <option value="seeds">Seeds &amp; Splice</option>
                      <option value="wearables">Wearables</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#8aa4bd]">Gem Price</span>
                    <input
                      type="number"
                      min={1}
                      max={50000}
                      value={editingListing.gemPrice}
                      onChange={(e) =>
                        setEditingListing({
                          ...editingListing,
                          gemPrice: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#8aa4bd]">Icon Item</span>
                    <select
                      value={editingListing.iconItemId}
                      onChange={(e) =>
                        setEditingListing({
                          ...editingListing,
                          iconItemId: Number(e.target.value),
                        })
                      }
                      className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                    >
                      {ALL_DROP_CANDIDATES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#8aa4bd]">Description</span>
                  <textarea
                    rows={2}
                    maxLength={160}
                    value={editingListing.description}
                    onChange={(e) =>
                      setEditingListing({ ...editingListing, description: e.target.value })
                    }
                    className="px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white resize-none"
                  />
                </label>

                {/* Grants items editor */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#ffe18c]">
                      Granted Items upon Purchase
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingListing({
                          ...editingListing,
                          grants: [
                            ...editingListing.grants,
                            { itemId: ITEM_IDS.GP_GRASS, qty: 10 },
                          ],
                        })
                      }
                      className="text-[11px] text-[#89d6ff] font-bold hover:underline cursor-pointer"
                    >
                      + Add Item Grant
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {editingListing.grants.map((grant, gi) => (
                      <div
                        key={gi}
                        className="flex items-center gap-2 bg-[#09131d] border border-[#243c52] rounded p-1.5"
                      >
                        <select
                          value={grant.itemId}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const next = editingListing.grants.map((g, i) =>
                              i === gi ? { ...g, itemId: val } : g
                            );
                            setEditingListing({ ...editingListing, grants: next });
                          }}
                          className="flex-1 px-1.5 py-1 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                        >
                          {ALL_DROP_CANDIDATES.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1">
                          <span className="text-[10px] text-[#8aa4bd]">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={grant.qty}
                            onChange={(e) => {
                              const q = Math.max(1, Math.min(200, Number(e.target.value)));
                              const next = editingListing.grants.map((g, i) =>
                                i === gi ? { ...g, qty: q } : g
                              );
                              setEditingListing({ ...editingListing, grants: next });
                            }}
                            className="w-16 px-1.5 py-1 rounded bg-[#08101a] border border-[#2d4863] text-xs font-mono-num text-white"
                          />
                        </label>
                        {editingListing.grants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = editingListing.grants.filter((_, i) => i !== gi);
                              setEditingListing({ ...editingListing, grants: next });
                            }}
                            className="px-2 py-1 rounded bg-[#3b1b1f] hover:bg-[#52242a] text-[#ffd4d4] font-bold text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#25425c] pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingListing(null)}
                    className="px-3 py-1.5 rounded bg-[#1b2b3d] text-[#9cb5cc] font-semibold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveListingModal(editingListing)}
                    className="px-4 py-1.5 rounded bg-[#38e8d8] text-[#062024] font-bold text-xs cursor-pointer"
                  >
                    Apply to Store
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: LIVE WORLD MECHANICS & DISPLAY SCALE */}
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
              min={150}
              max={720}
              step={10}
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
              min={-1125}
              max={-375}
              step={15}
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
              min={750}
              max={3600}
              step={30}
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

      {/* SUBTAB 5: ADMIN QUICK DEVELOPMENT TOOLS */}
      {subTab === 'tools' && (
        <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
          <div className="bg-[#09131d] border border-[#263c52] rounded p-2.5 flex flex-col gap-2">
            <span className="font-bold text-[#8cf7ee]">Grant Item to Backpack</span>
            <div className="flex gap-1.5 flex-wrap">
              <select
                aria-label="Grant Item Select"
                value={grantItemId}
                onChange={(e) => setGrantItemId(Number(e.target.value))}
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
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
        <div className="flex items-center justify-between gap-2 border-t border-[#2b4561] pt-2 shrink-0">
          <span className="text-[11px] text-[#9cb5cc] truncate">
            Live server config syncs immediately to all active worlds &amp; players.
          </span>
          <button
            type="button"
            onClick={() => onSaveConfig(draft)}
            className="px-4 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-bold text-xs cursor-pointer shrink-0"
          >
            Save &amp; Apply Live
          </button>
        </div>
      )}
    </div>
  );
};
