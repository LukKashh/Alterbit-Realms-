import React, { useState } from 'react';
import { Globe, Lock, LogOut, ShoppingBag, Shield, Star, User } from 'lucide-react';
import {
  ACHIEVEMENTS,
  GEM_STORE_LISTINGS,
  getItemDef,
  type PlayerStatKey,
  type StoreSection,
} from '../game/catalog.ts';
import type { GameConfig } from '../game/config.ts';
import type {
  FriendEntry,
  InventorySlot,
  UserRole,
  WorldSummary,
} from '../game/network.ts';
import { getItemIconUrl, type EquippedWearables } from '../game/pixelArt.ts';
import { xpForNextLevel } from '../game/rules.ts';
import { AdminPanel } from './AdminPanel.tsx';

interface WorldHubProps {
  playerName: string;
  email: string;
  role: UserRole;
  gems: number;
  xp: number;
  level: number;
  inventory: InventorySlot[];
  equipped: EquippedWearables;
  stats: Record<PlayerStatKey, number>;
  claimedAchievements: string[];
  friends: FriendEntry[];
  favoriteWorlds: string[];
  recentWorlds: string[];
  worlds: WorldSummary[];
  gameConfig: GameConfig;
  toastMessage: string | null;
  onRefreshWorlds: () => void;
  onEnterWorld: (worldName: string) => void;
  onBuyGemStore: (listingId: string) => void;
  onEquipWearable: (itemId: number) => void;
  onClaimAchievement: (achievementId: string) => void;
  onSaveGameConfig: (cfg: GameConfig) => void;
  onAdminAction: (opts: {
    action: 'grant_item' | 'grant_gems' | 'grow_all_trees' | 'reset_config';
    itemId?: number;
    qty?: number;
    gems?: number;
  }) => void;
  onSignOut: () => void;
}

type HubTab = 'worlds' | 'profile' | 'store' | 'admin';

export const WorldHub: React.FC<WorldHubProps> = ({
  playerName,
  email,
  role,
  gems,
  xp,
  level,
  inventory,
  equipped,
  stats,
  claimedAchievements,
  friends,
  favoriteWorlds,
  recentWorlds,
  worlds,
  gameConfig,
  toastMessage,
  onRefreshWorlds,
  onEnterWorld,
  onBuyGemStore,
  onEquipWearable,
  onClaimAchievement,
  onSaveGameConfig,
  onAdminAction,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>('worlds');
  const [worldInput, setWorldInput] = useState('START');
  const [storeCategory, setStoreCategory] = useState<StoreSection>('locks');
  const [profileSubTab, setProfileSubTab] = useState<'stats' | 'achievements' | 'wardrobe'>('stats');

  const nextXp = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round((xp / nextXp) * 100));
  const wearablesInBag = inventory.filter(
    (s) => getItemDef(s.itemId)?.category === 'wearable' && s.qty > 0
  );

  return (
    <div
      data-testid="world-hub"
      className="fixed inset-0 z-20 flex items-center justify-center p-2 sm:p-4 bg-[#07101a]/70 overflow-hidden"
    >
      <div className="w-full max-w-4xl h-[94vh] sm:h-[88vh] sm:max-h-[660px] bg-[#0f1d2c]/96 border-2 border-[#3b5978] rounded-lg shadow-[0_10px_0_rgba(6,12,20,0.9)] flex flex-col overflow-hidden">
        {/* Top Hub Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-[#09131d] border-b border-[#28425e]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-pixel text-xs sm:text-sm text-[#fff8e8] whitespace-nowrap">BLOCKGROVE HUB</h1>
            <div className="hidden sm:block h-5 w-px bg-[#2a4057]" />
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-[#ffe18c] whitespace-nowrap">{playerName}</span>
              {role === 'admin' && (
                <span className="px-1.5 py-0.5 rounded bg-[#f2b738] text-[#1a1204] font-pixel text-[9px] whitespace-nowrap">
                  ADMIN
                </span>
              )}
              <span className="text-[11px] font-mono-num font-bold text-[#89d6ff] whitespace-nowrap">LVL {level}</span>
              <span className="text-[#4a6988]">·</span>
              <span className="text-[11px] font-mono-num font-bold text-[#8cf7ee] whitespace-nowrap">
                {Math.round(gems)} Gems
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="text-xs font-bold text-[#fff3cf] bg-[#213b57] border border-[#f2b738] rounded px-2.5 py-1">
                {toastMessage}
              </span>
            )}
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] text-xs font-bold text-[#ffd4d4] cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 bg-[#0c1824] border-b border-[#243c54] overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveTab('worlds');
              onRefreshWorlds();
            }}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
              activeTab === 'worlds'
                ? 'bg-[#214463] border border-[#78c8f5] text-white'
                : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>World Hub</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#214463] border border-[#f2b738] text-[#ffe18c]'
                : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
              activeTab === 'store'
                ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee]'
                : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc] hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Gem Store</span>
          </button>
          {role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs font-bold cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#362b12] border border-[#f2b738] text-[#ffe18c]'
                  : 'bg-[#09131d] border border-[#263c52] text-[#f2b738] hover:bg-[#192838]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </button>
          )}
        </nav>

        {/* Active Tab Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* WORLD HUB TAB */}
          {activeTab === 'worlds' && (
            <div className="flex flex-col gap-4 h-full">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = worldInput.trim().toUpperCase();
                  if (clean) onEnterWorld(clean);
                }}
                className="flex flex-col sm:flex-row sm:items-end gap-2.5 bg-[#09131d] border border-[#28425e] rounded-md p-3"
              >
                <label className="flex-1 min-w-0 flex flex-col gap-1 text-xs font-semibold text-[#b9d2e8]">
                  <span>Enter or Create Named World (100×60)</span>
                  <input
                    type="text"
                    maxLength={20}
                    value={worldInput}
                    onChange={(e) => setWorldInput(e.target.value.toUpperCase())}
                    placeholder="START, TRADE, FARM, or new world name..."
                    className="w-full min-w-0 px-3 py-2 rounded bg-[#08101a] border border-[#2d4863] text-sm font-bold uppercase tracking-wide text-white focus:outline-none focus:border-[#f2b738]"
                  />
                </label>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-pixel text-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  Enter World
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
                {/* Active / Public Worlds */}
                <div className="md:col-span-2 bg-[#09131d] border border-[#263c52] rounded-md p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-pixel text-xs text-[#ffe18c]">Persistent Worlds</h2>
                    <button
                      type="button"
                      onClick={onRefreshWorlds}
                      className="text-[11px] font-bold text-[#89d6ff] hover:text-white cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1">
                    {worlds.map((w) => (
                      <button
                        key={w.name}
                        type="button"
                        onClick={() => onEnterWorld(w.name)}
                        className="flex items-center justify-between p-2.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#2d4863] text-left cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#f7f4eb]">
                            {w.ownerName ? (
                              <Lock className="w-3 h-3 text-[#f2b738]" />
                            ) : (
                              <Globe className="w-3 h-3 text-[#78c8f5]" />
                            )}
                            <span>{w.name}</span>
                          </div>
                          <div className="text-[10px] text-[#9cb5cc] mt-0.5">
                            {w.ownerName ? `Owner: ${w.ownerName}` : 'Unlocked World'}
                          </div>
                        </div>
                        <span className="text-xs font-mono-num font-bold text-[#8cf7ee]">
                          {w.playerCount}/20
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Favorites & Recent */}
                <div className="bg-[#09131d] border border-[#263c52] rounded-md p-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-bold text-[#ffe18c] flex items-center gap-1">
                      <Star className="w-3.5 h-3.5" /> Favorite Worlds
                    </h3>
                    <div className="flex flex-col gap-1">
                      {favoriteWorlds.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onEnterWorld(name)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#28425e] text-xs font-bold text-[#ffe18c] cursor-pointer"
                        >
                          <span>★ {name}</span>
                          <span className="text-[10px] text-[#89d6ff]">Join</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-bold text-[#89d6ff]">Recent Worlds</h3>
                    <div className="flex flex-col gap-1">
                      {recentWorlds.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onEnterWorld(name)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#28425e] text-xs font-semibold text-[#f7f4eb] cursor-pointer"
                        >
                          <span>{name}</span>
                          <span className="text-[10px] text-[#89d6ff]">Revisit</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-[#09131d] border border-[#28425e] rounded-md p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-sm text-[#ffe18c]">{playerName}</span>
                    <span className="text-xs font-mono-num text-[#89d6ff]">Level {level}</span>
                    {role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded bg-[#f2b738] text-[#1a1204] font-pixel text-[9px]">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#9cb5cc] mt-0.5">
                    {email || 'Registered Account'} · Friends: {friends.length} · Backpack Items:{' '}
                    {inventory.length}
                  </div>
                </div>
                <div className="w-48">
                  <div className="flex justify-between text-[11px] font-mono-num text-[#89d6ff] mb-1">
                    <span>XP Progress</span>
                    <span>
                      {xp}/{nextXp}
                    </span>
                  </div>
                  <div className="h-2 bg-[#08101a] rounded overflow-hidden border border-[#263c52]">
                    <div className="h-full bg-[#4ec46a]" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['stats', 'achievements', 'wardrobe'] as const).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setProfileSubTab(sub)}
                    className={`py-1.5 rounded text-xs font-bold uppercase cursor-pointer ${
                      profileSubTab === sub
                        ? 'bg-[#214463] border border-[#f2b738] text-[#ffe18c]'
                        : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {profileSubTab === 'stats' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ['Blocks Broken', stats.blocksBroken],
                    ['Blocks Placed', stats.blocksPlaced],
                    ['Trees Harvested', stats.treesHarvested],
                    ['Seeds Spliced', stats.seedsSpliced],
                    ['Store Purchases', stats.storePurchases],
                    ['Vending Trades', stats.vendingTrades],
                    ['Locks Placed', stats.locksPlaced],
                    ['Friends Added', stats.friendsAdded],
                  ].map(([label, val]) => (
                    <div
                      key={String(label)}
                      className="bg-[#09131d] border border-[#263c52] rounded p-2.5 flex flex-col gap-0.5"
                    >
                      <span className="text-[11px] text-[#9cb5cc]">{label}</span>
                      <span className="text-base font-mono-num font-bold text-[#fff8e8]">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {profileSubTab === 'achievements' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACHIEVEMENTS.map((ach) => {
                    const progress = Math.min(ach.target, stats[ach.statKey] ?? 0);
                    const claimed = claimedAchievements.includes(ach.id);
                    const ready = progress >= ach.target && !claimed;
                    return (
                      <div
                        key={ach.id}
                        className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#f7f4eb]">{ach.name}</div>
                          <div className="text-[10px] text-[#9cb5cc]">{ach.description}</div>
                          <div className="text-[10px] font-mono-num text-[#ffe18c] mt-0.5">
                            {progress}/{ach.target} · +{ach.gemReward} Gems, +{ach.xpReward} XP
                          </div>
                        </div>
                        {claimed ? (
                          <span className="px-2 py-1 rounded bg-[#182c42] text-[10px] font-bold text-[#82e068]">
                            Claimed
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!ready}
                            onClick={() => onClaimAchievement(ach.id)}
                            className="px-2.5 py-1.5 rounded bg-[#4aa64d] disabled:bg-[#192836] disabled:text-[#5d7a94] text-[#081709] font-bold text-xs cursor-pointer"
                          >
                            Claim
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {profileSubTab === 'wardrobe' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {wearablesInBag.length === 0 ? (
                    <p className="col-span-2 text-xs text-[#9cb5cc] bg-[#09131d] border border-[#263c52] rounded p-3">
                      No wearables owned yet. Visit the Gem Store tab to unlock cosmetic gear!
                    </p>
                  ) : (
                    wearablesInBag.map((slot) => {
                      const def = getItemDef(slot.itemId);
                      if (!def) return null;
                      const isEq =
                        equipped.head === slot.itemId ||
                        equipped.face === slot.itemId ||
                        equipped.back === slot.itemId;
                      return (
                        <div
                          key={slot.itemId}
                          className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={getItemIconUrl(slot.itemId)}
                              alt={def.name}
                              className="w-7 h-7 pixelated"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="text-xs font-bold text-[#f7f4eb]">{def.name}</div>
                              <div className="text-[10px] text-[#89d6ff] uppercase">
                                Slot: {def.wearableSlot ?? 'head'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEquipWearable(slot.itemId)}
                            className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                              isEq
                                ? 'bg-[#f2b738] text-[#1a1204]'
                                : 'bg-[#214463] hover:bg-[#2d5b82] text-white'
                            }`}
                          >
                            {isEq ? 'Unequip' : 'Equip'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* GEM STORE TAB */}
          {activeTab === 'store' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-[#09131d] border border-[#28425e] rounded-md p-3">
                <div>
                  <h2 className="font-pixel text-xs text-[#8cf7ee]">Central Gem Store</h2>
                  <p className="text-[11px] text-[#9cb5cc]">
                    Spend earned Gems on Locks, Vending Machines, Building Packs, Seeds, and Wearables.
                  </p>
                </div>
                <span className="text-sm font-mono-num font-bold text-[#8cf7ee]">
                  Balance: {Math.round(gems)} Gems
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(['locks', 'blocks', 'seeds', 'wearables'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setStoreCategory(cat)}
                    className={`py-1.5 rounded text-xs font-bold uppercase cursor-pointer ${
                      storeCategory === cat
                        ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee]'
                        : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(gameConfig.storeListings ?? GEM_STORE_LISTINGS)
                  .filter((l) => l.section === storeCategory)
                  .map((listing) => {
                    const canAfford = gems >= listing.gemPrice;
                  return (
                    <div
                      key={listing.id}
                      className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getItemIconUrl(listing.iconItemId)}
                          alt={listing.name}
                          className="w-8 h-8 pixelated shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="text-xs font-bold text-[#f7f4eb]">{listing.name}</div>
                          <div className="text-[10px] text-[#9cb5cc]">{listing.description}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyGemStore(listing.id)}
                        className="px-3 py-1.5 rounded bg-[#38e8d8] disabled:bg-[#1d3342] disabled:text-[#65849c] text-[#062024] font-mono-num font-bold text-xs shrink-0 cursor-pointer"
                      >
                        {listing.gemPrice} G
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN PANEL TAB (Only visible for admin role) */}
          {activeTab === 'admin' && role === 'admin' && (
            <AdminPanel
              gameConfig={gameConfig}
              inWorld={false}
              onSaveConfig={onSaveGameConfig}
              onAdminAction={onAdminAction}
            />
          )}
        </div>
      </div>
    </div>
  );
};
