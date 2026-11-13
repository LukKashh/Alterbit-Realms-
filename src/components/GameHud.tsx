import React, { useEffect, useState } from 'react';
import {
  Backpack,
  Globe,
  Lock,
  MessageSquare,
  Pause,
  RotateCw,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  GEM_STORE_LISTINGS,
  getItemDef,
  ITEM_IDS,
  type PlayerStatKey,
  type StoreSection,
} from '../game/catalog.ts';
import { getItemIconUrl, type EquippedWearables } from '../game/pixelArt.ts';
import { xpForNextLevel } from '../game/rules.ts';
import type {
  ChatMessage,
  FriendEntry,
  FriendRequestEntry,
  InventorySlot,
  UserRole,
  WorldSummary,
} from '../game/network.ts';
import type { GameConfig } from '../game/config.ts';
import type { TileInspectInfo } from '../game/engine.ts';
import { AdminPanel } from './AdminPanel.tsx';

interface GameHudProps {
  mode: 'playing' | 'paused';
  playerId: string;
  playerName: string;
  role: UserRole;
  gameConfig: GameConfig;
  onUpdateGameConfig: (cfg: GameConfig) => void;
  onAdminAction: (opts: {
    action: 'grant_item' | 'grant_gems' | 'grow_all_trees' | 'reset_config';
    itemId?: number;
    qty?: number;
    gems?: number;
  }) => void;
  worldName: string;
  worldOwner: string | null;
  playerCount: number;
  coords: { tx: number; ty: number };
  gems: number;
  xp: number;
  level: number;
  inventory: InventorySlot[];
  equipped: EquippedWearables;
  stats: Record<PlayerStatKey, number>;
  claimedAchievements: string[];
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  favoriteWorlds: string[];
  recentWorlds: string[];
  hotbarItemIds: number[];
  selectedItemId: number;
  onSelectItem: (itemId: number) => void;
  onAssignHotbar: (slotIndex: number, itemId: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  onTouchMove: (dir: 'left' | 'right' | 'down', active: boolean) => void;
  onTouchJump: (active: boolean) => void;
  onTouchPunch: (active: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onReturnToHub: () => void;
  onLeaveWorld: () => void;
  worlds: WorldSummary[];
  onRefreshWorlds: () => void;
  onJoinWorld: (name: string) => void;
  onToggleFavoriteWorld: (worldName: string) => void;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onSpliceSeeds: (seedA: number, seedB: number) => void;
  onBuyGemStore: (listingId: string) => void;
  onEquipWearable: (itemId: number) => void;
  onClaimAchievement: (achievementId: string) => void;
  onFriendAction: (
    action: 'send_request' | 'accept' | 'decline' | 'remove',
    targetNameOrId: string
  ) => void;
  onConfigureLock: (
    tx: number,
    ty: number,
    opts: { publicAccess?: boolean; addEditorName?: string; removeEditorId?: string }
  ) => void;
  onConfigureVending: (
    tx: number,
    ty: number,
    opts: {
      action: 'stock' | 'withdraw';
      stockItemId?: number;
      stockQty?: number;
      priceItemId?: number;
      priceQty?: number;
    }
  ) => void;
  onBuyVending: (tx: number, ty: number, units: number) => void;
  onConfigureSign: (tx: number, ty: number, text: string) => void;
  inspectInfo: TileInspectInfo | null;
  onDismissInspect: () => void;
  toastMessage: string | null;
  connected: boolean;
}

type ActivePanel =
  | 'none'
  | 'backpack'
  | 'worlds'
  | 'chat'
  | 'splice'
  | 'store'
  | 'friends'
  | 'profile'
  | 'admin';

export const GameHud: React.FC<GameHudProps> = ({
  mode,
  playerId,
  playerName,
  role,
  gameConfig,
  onUpdateGameConfig,
  onAdminAction,
  worldName,
  worldOwner,
  playerCount,
  coords,
  gems,
  xp,
  level,
  inventory,
  equipped,
  stats,
  claimedAchievements,
  friends,
  incomingRequests,
  favoriteWorlds,
  recentWorlds,
  hotbarItemIds,
  selectedItemId,
  onSelectItem,
  onAssignHotbar,
  muted,
  onToggleMute,
  touchEnabled,
  onToggleTouch,
  onTouchMove,
  onTouchJump,
  onTouchPunch,
  onPause,
  onResume,
  onReturnToHub,
  onLeaveWorld,
  worlds,
  onRefreshWorlds,
  onJoinWorld,
  onToggleFavoriteWorld,
  chatMessages,
  onSendChat,
  onSpliceSeeds,
  onBuyGemStore,
  onEquipWearable,
  onClaimAchievement,
  onFriendAction,
  onConfigureLock,
  onConfigureVending,
  onBuyVending,
  onConfigureSign,
  inspectInfo,
  onDismissInspect,
  toastMessage,
  connected,
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [worldInput, setWorldInput] = useState('');
  const [worldTab, setWorldTab] = useState<'public' | 'favorites' | 'recent'>('public');
  const [chatInput, setChatInput] = useState('');
  const [spliceA, setSpliceA] = useState<number | null>(null);
  const [spliceB, setSpliceB] = useState<number | null>(null);
  const [assignSlot, setAssignSlot] = useState<number>(2);
  const [storeCategory, setStoreCategory] = useState<StoreSection>('locks');
  const [profileTab, setProfileTab] = useState<'achievements' | 'wardrobe'>('achievements');
  const [friendInput, setFriendInput] = useState('');

  // Inspector local form state
  const [editorInput, setEditorInput] = useState('');
  const [signDraft, setSignDraft] = useState('');
  const [vmItemId, setVmItemId] = useState<number>(ITEM_IDS.RICH_SOIL);
  const [vmStockQty, setVmStockQty] = useState<number>(5);
  const [vmPriceItemId, setVmPriceItemId] = useState<number>(ITEM_IDS.SMALL_LOCK);
  const [vmPriceQty, setVmPriceQty] = useState<number>(1);

  useEffect(() => {
    if (inspectInfo?.signText !== undefined && inspectInfo?.signText !== null) {
      setSignDraft(inspectInfo.signText);
    }
    if (inspectInfo?.vendingMachine) {
      const vm = inspectInfo.vendingMachine;
      if (vm.stockItemId > 0) setVmItemId(vm.stockItemId);
      if (vm.priceItemId > 0) setVmPriceItemId(vm.priceItemId);
      if (vm.priceQty > 0) setVmPriceQty(vm.priceQty);
    }
  }, [inspectInfo]);

  const nextXp = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round((xp / nextXp) * 100));
  const selectedDef = getItemDef(selectedItemId);
  const seedsInBag = inventory.filter((s) => getItemDef(s.itemId)?.category === 'seed' && s.qty > 0);
  const wearablesInBag = inventory.filter(
    (s) => getItemDef(s.itemId)?.category === 'wearable' && s.qty > 0
  );
  const tradeablesInBag = inventory.filter((s) => {
    const d = getItemDef(s.itemId);
    return d && d.tradeable && s.qty > 0 && s.itemId !== ITEM_IDS.FIST && s.itemId !== ITEM_IDS.WRENCH;
  });

  const claimableCount = ACHIEVEMENTS.filter(
    (a) => (stats[a.statKey] ?? 0) >= a.target && !claimedAchievements.includes(a.id)
  ).length;

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((cur) => {
      const next = cur === panel ? 'none' : panel;
      if (next === 'worlds') onRefreshWorlds();
      return next;
    });
  };

  const getQty = (itemId: number) => inventory.find((s) => s.itemId === itemId)?.qty ?? 0;
  const isCurrentWorldFav = favoriteWorlds.includes(worldName);

  const activeLock = inspectInfo?.worldLock ?? inspectInfo?.areaLock ?? null;
  const isLockOwner = activeLock?.ownerId === playerId;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5">
      {/* Top Perimeter Bar */}
      <div className="flex items-start justify-between gap-2">
        {/* Top-left: Identity, Level/XP, Gems, World */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#0f1d2c]/92 border-2 border-[#314a66] rounded-md px-2.5 py-1.5 shadow-[0_3px_0_rgba(6,12,20,0.8)]">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('profile');
            }}
            className="flex flex-col text-left cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#f7f4eb] whitespace-nowrap">{playerName}</span>
              <span className="text-[11px] font-mono-num font-bold text-[#89d6ff] whitespace-nowrap">
                LVL {level}
              </span>
            </div>
            <div className="w-24 h-1.5 bg-[#08101a] rounded-sm overflow-hidden mt-0.5">
              <div
                className="h-full bg-[#4ec46a] transition-[width] duration-150"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </button>

          <div className="h-6 w-px bg-[#2a4057]" />

          {/* Gems Counter (clicks open Gem Store) */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Gems ${gems}`}
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('store');
            }}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[#182c42] cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <polygon points="12,2 21,9 12,22 3,9" fill="#38e8d8" stroke="#0b2430" strokeWidth="2" />
              <polygon points="12,4 17,9 12,18 7,9" fill="#a8fff7" />
            </svg>
            <span className="text-xs font-mono-num font-bold text-[#8cf7ee]">{Math.round(gems)}</span>
          </button>

          <div className="h-6 w-px bg-[#2a4057]" />

          {/* Active World Button */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('worlds');
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#182c42] hover:bg-[#213b57] border border-[#3a597a] text-xs font-bold text-[#ffe18c] cursor-pointer whitespace-nowrap"
          >
            {worldOwner ? <Lock className="w-3 h-3 text-[#f2b738]" /> : <Globe className="w-3 h-3 text-[#78c8f5]" />}
            <span>{worldName}</span>
            <span className="text-[11px] font-mono-num text-[#b5cde3]">({playerCount}/20)</span>
          </button>

          <span className="hidden md:inline text-[11px] font-mono-num text-[#8aa4bd] whitespace-nowrap">
            {coords.tx},{coords.ty}
          </span>
        </div>

        {/* Top-right: Utility Icon Buttons */}
        <div className="pointer-events-auto flex items-center gap-1">
          {!connected && (
            <span className="px-2 py-1 rounded bg-[#3b181b] border border-[#80333a] text-[11px] font-bold text-[#ffb0b0] whitespace-nowrap">
              Reconnecting
            </span>
          )}
          {role === 'admin' && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Admin Dev Panel"
              onClick={(e) => {
                e.currentTarget.blur();
                togglePanel('admin');
              }}
              className={`h-9 px-2.5 rounded-md border-2 flex items-center gap-1 text-xs font-bold cursor-pointer ${
                activePanel === 'admin'
                  ? 'bg-[#362b12] border-[#f2b738] text-[#ffe18c]'
                  : 'bg-[#0f1d2c]/90 border-[#f2b738]/70 text-[#ffe18c] hover:bg-[#192f47]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Gem Store"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('store');
            }}
            className={`w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'store'
                ? 'bg-[#2a4a6b] border-[#38e8d8] text-[#8cf7ee]'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#8cf7ee] hover:bg-[#192f47]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Backpack"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('backpack');
            }}
            className={`w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'backpack'
                ? 'bg-[#2a4a6b] border-[#82c6f7] text-white'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#d0e2f2] hover:bg-[#192f47]'
            }`}
          >
            <Backpack className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Splice Seeds"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('splice');
            }}
            className={`w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'splice'
                ? 'bg-[#2a4a6b] border-[#82c6f7] text-white'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#d0e2f2] hover:bg-[#192f47]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Friends"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('friends');
            }}
            className={`relative w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'friends'
                ? 'bg-[#2a4a6b] border-[#82c6f7] text-white'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#d0e2f2] hover:bg-[#192f47]'
            }`}
          >
            <Users className="w-4 h-4" />
            {incomingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#e6482e] text-[9px] font-mono-num font-bold text-white flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Achievements & Profile"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('profile');
            }}
            className={`relative w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'profile'
                ? 'bg-[#2a4a6b] border-[#f2b738] text-[#ffe18c]'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#ffe18c] hover:bg-[#192f47]'
            }`}
          >
            <Trophy className="w-4 h-4" />
            {claimableCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4aa64d] text-[9px] font-mono-num font-bold text-[#081709] flex items-center justify-center">
                {claimableCount}
              </span>
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="World Chat"
            onClick={(e) => {
              e.currentTarget.blur();
              togglePanel('chat');
            }}
            className={`w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              activePanel === 'chat'
                ? 'bg-[#2a4a6b] border-[#82c6f7] text-white'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#d0e2f2] hover:bg-[#192f47]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle Touch Controls"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouch();
            }}
            className={`w-9 h-9 rounded-md border-2 flex items-center justify-center cursor-pointer ${
              touchEnabled
                ? 'bg-[#2a4a6b] border-[#82c6f7] text-white'
                : 'bg-[#0f1d2c]/90 border-[#314a66] text-[#d0e2f2] hover:bg-[#192f47]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-9 h-9 rounded-md bg-[#0f1d2c]/90 hover:bg-[#192f47] border-2 border-[#314a66] text-[#d0e2f2] flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-[#ff9b9b]" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Game"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="w-9 h-9 rounded-md bg-[#0f1d2c]/90 hover:bg-[#192f47] border-2 border-[#314a66] text-[#d0e2f2] flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transient Toast or Wrench Inspector / Vending / Lock / Sign Modal */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {toastMessage && (
          <div className="bg-[#101f2e]/95 border-2 border-[#f2b738] text-[#fff3cf] text-xs font-bold px-3 py-1.5 rounded shadow-[0_3px_0_rgba(0,0,0,0.6)]">
            {toastMessage}
          </div>
        )}
        {inspectInfo && (
          <div className="pointer-events-auto bg-[#0f1d2c]/96 border-2 border-[#78c8f5] rounded-md p-3 w-80 max-w-[92vw] text-xs shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <span className="font-bold text-[#89d6ff]">
                {inspectInfo.fgName} ({inspectInfo.tx}, {inspectInfo.ty})
              </span>
              <button
                type="button"
                onClick={onDismissInspect}
                className="text-[#9cb5cc] hover:text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] text-[#c7d9eb]">
              <span>Background: {inspectInfo.bgName}</span>
              {inspectInfo.plantInfo && <span>Tree: {inspectInfo.plantInfo}</span>}
              {inspectInfo.lockInfo && <span className="text-[#ffe18c] font-semibold">{inspectInfo.lockInfo}</span>}
            </div>

            {/* Lock Permissions Panel */}
            {activeLock && (
              <div className="border-t border-[#28425e] pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#ffe18c]">
                    {inspectInfo.worldLock ? 'World Lock Settings' : 'Area Lock (7×7) Settings'}
                  </span>
                  <span className="text-[11px] text-[#89d6ff]">Owner: {activeLock.ownerName}</span>
                </div>

                {inspectInfo.worldLock && (
                  <div className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded px-2 py-1.5">
                    <span className="text-[11px] text-[#d5e4f2]">
                      Entry: {inspectInfo.worldLock.publicAccess !== false ? 'Public Visits' : 'Builders Only'}
                    </span>
                    {isLockOwner && (
                      <button
                        type="button"
                        onClick={() =>
                          onConfigureLock(inspectInfo.tx, inspectInfo.ty, {
                            publicAccess: inspectInfo.worldLock?.publicAccess === false,
                          })
                        }
                        className="px-2 py-0.5 rounded bg-[#213b57] hover:bg-[#2c4f75] text-[11px] font-bold text-[#ffe18c] cursor-pointer"
                      >
                        Toggle
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#9cb5cc]">
                    Authorized Builders ({activeLock.editors.length}):
                  </span>
                  {activeLock.editors.length === 0 ? (
                    <span className="text-[11px] text-[#6d8ba8]">Only {activeLock.ownerName} can build here.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {activeLock.editors.map((edId) => (
                        <div
                          key={edId}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#142538] border border-[#2d4863] text-[11px]"
                        >
                          <span>{activeLock.editorNames?.[edId] ?? edId}</span>
                          {isLockOwner && (
                            <button
                              type="button"
                              onClick={() =>
                                onConfigureLock(inspectInfo.tx, inspectInfo.ty, { removeEditorId: edId })
                              }
                              className="text-[#ff9b9b] hover:text-white font-bold ml-1 cursor-pointer"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isLockOwner && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editorInput.trim()) {
                        onConfigureLock(inspectInfo.tx, inspectInfo.ty, {
                          addEditorName: editorInput.trim(),
                        });
                        setEditorInput('');
                      }
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={editorInput}
                      onChange={(e) => setEditorInput(e.target.value)}
                      placeholder="Add builder by name..."
                      className="flex-1 px-2 py-1 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-[#4aa64d] text-[#081709] font-bold text-xs cursor-pointer"
                    >
                      Grant
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Personal Vending Machine Panel */}
            {inspectInfo.vendingMachine && (
              <div className="border-t border-[#28425e] pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#38e8d8]">Vending Shop</span>
                  <span className="text-[11px] text-[#9cb5cc]">
                    By {inspectInfo.vendingMachine.ownerName}
                  </span>
                </div>

                {inspectInfo.vendingMachine.stockItemId > 0 && inspectInfo.vendingMachine.stockQty > 0 ? (
                  <div className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded p-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={getItemIconUrl(inspectInfo.vendingMachine.stockItemId)}
                        alt="Stock"
                        className="w-7 h-7 pixelated"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-bold text-[#f7f4eb]">
                          {getItemDef(inspectInfo.vendingMachine.stockItemId)?.name} (×
                          {inspectInfo.vendingMachine.stockQty} left)
                        </div>
                        <div className="text-[11px] text-[#ffe18c]">
                          Price: {inspectInfo.vendingMachine.priceQty}×{' '}
                          {getItemDef(inspectInfo.vendingMachine.priceItemId)?.name}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBuyVending(inspectInfo.tx, inspectInfo.ty, 1)}
                      className="px-2.5 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] font-bold text-xs cursor-pointer"
                    >
                      Buy 1
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#8aa4bd] bg-[#09131d] rounded p-2">
                    This Vending Machine is currently out of stock.
                  </div>
                )}

                {inspectInfo.vendingMachine.ownerId === playerId && (
                  <div className="flex flex-col gap-1.5 border-t border-[#20364d] pt-2">
                    <span className="text-[11px] font-bold text-[#ffe18c]">Owner Management</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={vmItemId}
                        onChange={(e) => setVmItemId(Number(e.target.value))}
                        className="px-1.5 py-1 rounded bg-[#08101a] border border-[#2d4863] text-[11px] text-white"
                      >
                        {tradeablesInBag.map((s) => (
                          <option key={s.itemId} value={s.itemId}>
                            {getItemDef(s.itemId)?.name} ({s.qty})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={vmStockQty}
                        onChange={(e) => setVmStockQty(Math.max(1, Number(e.target.value)))}
                        placeholder="Qty to stock"
                        className="px-2 py-1 rounded bg-[#08101a] border border-[#2d4863] text-[11px] text-white font-mono-num"
                      />
                      <select
                        value={vmPriceItemId}
                        onChange={(e) => setVmPriceItemId(Number(e.target.value))}
                        className="px-1.5 py-1 rounded bg-[#08101a] border border-[#2d4863] text-[11px] text-white"
                      >
                        <option value={ITEM_IDS.SMALL_LOCK}>Price in: Area Lock</option>
                        <option value={ITEM_IDS.WORLD_LOCK}>Price in: World Lock</option>
                        <option value={ITEM_IDS.CRYSTAL_VEIN}>Price in: Crystal Vein</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={vmPriceQty}
                        onChange={(e) => setVmPriceQty(Math.max(1, Number(e.target.value)))}
                        placeholder="Price per 1"
                        className="px-2 py-1 rounded bg-[#08101a] border border-[#2d4863] text-[11px] text-white font-mono-num"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onConfigureVending(inspectInfo.tx, inspectInfo.ty, {
                            action: 'stock',
                            stockItemId: vmItemId,
                            stockQty: vmStockQty,
                            priceItemId: vmPriceItemId,
                            priceQty: vmPriceQty,
                          })
                        }
                        className="flex-1 py-1 rounded bg-[#2a5b8c] hover:bg-[#3672ad] text-white font-bold text-[11px] cursor-pointer"
                      >
                        Stock Machine
                      </button>
                      {(inspectInfo.vendingMachine.stockQty > 0 ||
                        inspectInfo.vendingMachine.earningsQty > 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            onConfigureVending(inspectInfo.tx, inspectInfo.ty, { action: 'withdraw' })
                          }
                          className="flex-1 py-1 rounded bg-[#f2b738] text-[#1a1204] font-bold text-[11px] cursor-pointer"
                        >
                          Withdraw ({inspectInfo.vendingMachine.earningsQty} earned)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signboard Editor */}
            {inspectInfo.signText !== undefined && inspectInfo.signText !== null && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onConfigureSign(inspectInfo.tx, inspectInfo.ty, signDraft);
                }}
                className="border-t border-[#28425e] pt-2 flex flex-col gap-1.5"
              >
                <span className="text-[11px] font-bold text-[#ffe18c]">Signboard Message</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={signDraft}
                    onChange={(e) => setSignDraft(e.target.value)}
                    placeholder="Write message on sign..."
                    className="flex-1 px-2 py-1 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-[#4aa64d] text-[#081709] font-bold text-xs cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Bottom Perimeter: Touch Pads + 6-Slot Hotbar */}
      <div className="flex items-end justify-between gap-2">
        {/* Left Touch D-Pad */}
        <div className="w-32 flex items-end gap-2">
          {touchEnabled && (
            <div className="pointer-events-auto flex items-center gap-2" data-testid="touch-left-controls">
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={() => onTouchMove('left', true)}
                onPointerUp={() => onTouchMove('left', false)}
                onPointerLeave={() => onTouchMove('left', false)}
                onPointerCancel={() => onTouchMove('left', false)}
                className="w-12 h-12 rounded-md bg-[#0f1d2c]/85 active:bg-[#2a4a6b] border-2 border-[#46678a] text-white font-bold text-base flex items-center justify-center"
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={() => onTouchMove('right', true)}
                onPointerUp={() => onTouchMove('right', false)}
                onPointerLeave={() => onTouchMove('right', false)}
                onPointerCancel={() => onTouchMove('right', false)}
                className="w-12 h-12 rounded-md bg-[#0f1d2c]/85 active:bg-[#2a4a6b] border-2 border-[#46678a] text-white font-bold text-base flex items-center justify-center"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {/* Center Hotbar */}
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          {selectedDef && (
            <div className="text-[11px] font-semibold text-[#f4f1ea] bg-[#0f1d2c]/85 border border-[#314a66] px-2.5 py-0.5 rounded whitespace-nowrap">
              {selectedDef.name} · {selectedDef.category}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-[#0f1d2c]/92 border-2 border-[#314a66] rounded-md p-1.5 shadow-[0_4px_0_rgba(6,12,20,0.85)]">
            {hotbarItemIds.map((itemId, idx) => {
              const def = getItemDef(itemId);
              const qty = itemId === ITEM_IDS.FIST || itemId === ITEM_IDS.WRENCH ? null : getQty(itemId);
              const active = selectedItemId === itemId;
              return (
                <button
                  key={`${idx}-${itemId}`}
                  type="button"
                  tabIndex={-1}
                  aria-label={`Slot ${idx + 1}: ${def?.name ?? 'Empty'}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setAssignSlot(idx);
                    if (itemId !== ITEM_IDS.AIR) onSelectItem(itemId);
                  }}
                  className={`relative w-11 h-11 rounded border-2 flex items-center justify-center cursor-pointer transition-transform ${
                    active
                      ? 'bg-[#254463] border-[#f2b738] -translate-y-0.5'
                      : 'bg-[#09131d] border-[#263c52] hover:border-[#4b7299]'
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[9px] font-mono-num font-bold text-[#7c9ab5]">
                    {idx + 1}
                  </span>
                  {itemId !== ITEM_IDS.AIR && (
                    <img
                      src={getItemIconUrl(itemId)}
                      alt={def?.name ?? 'Item'}
                      className="w-7 h-7 pixelated"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {qty !== null && (
                    <span className="absolute bottom-0 right-1 text-[10px] font-mono-num font-bold text-white drop-shadow-[0_1px_1px_#000]">
                      {qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Touch Jump & Action */}
        <div className="w-32 flex items-end justify-end gap-2">
          {touchEnabled && (
            <div className="pointer-events-auto flex items-center gap-2" data-testid="touch-right-controls">
              <button
                type="button"
                aria-label="Punch or Use"
                onPointerDown={() => onTouchPunch(true)}
                onPointerUp={() => onTouchPunch(false)}
                onPointerLeave={() => onTouchPunch(false)}
                onPointerCancel={() => onTouchPunch(false)}
                className="w-12 h-12 rounded-md bg-[#94422c]/90 active:bg-[#b8563b] border-2 border-[#e0896b] text-white font-bold text-xs flex items-center justify-center"
              >
                Use
              </button>
              <button
                type="button"
                aria-label="Jump"
                onPointerDown={() => onTouchJump(true)}
                onPointerUp={() => onTouchJump(false)}
                onPointerLeave={() => onTouchJump(false)}
                onPointerCancel={() => onTouchJump(false)}
                className="w-12 h-12 rounded-md bg-[#2d703b]/90 active:bg-[#3f9450] border-2 border-[#7ae086] text-white font-bold text-base flex items-center justify-center"
              >
                ▲
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Gem Store Drawer */}
      {activePanel === 'store' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-88 max-w-[92vw] max-h-[72vh] bg-[#0f1d2c]/96 border-2 border-[#38e8d8] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-pixel text-xs text-[#8cf7ee]">Gem Store</h2>
              <span className="text-xs font-mono-num font-bold text-[#ffe18c]">{Math.round(gems)} Gems</span>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(['locks', 'blocks', 'seeds', 'wearables'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStoreCategory(cat)}
                className={`py-1 rounded text-[11px] font-bold uppercase cursor-pointer ${
                  storeCategory === cat
                    ? 'bg-[#214463] border border-[#38e8d8] text-[#8cf7ee]'
                    : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
            {GEM_STORE_LISTINGS.filter((l) => l.section === storeCategory).map((listing) => {
              const canAfford = gems >= listing.gemPrice;
              return (
                <div
                  key={listing.id}
                  className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={getItemIconUrl(listing.iconItemId)}
                      alt={listing.name}
                      className="w-7 h-7 pixelated shrink-0"
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
                    className="px-2.5 py-1.5 rounded bg-[#38e8d8] disabled:bg-[#1d3342] disabled:text-[#65849c] text-[#062024] font-mono-num font-bold text-xs shrink-0 cursor-pointer"
                  >
                    {listing.gemPrice} G
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backpack Drawer */}
      {activePanel === 'backpack' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-80 max-h-[65vh] bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-xs text-[#ffe18c]">Backpack</h2>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-[#9cb5cc]">
            Click an item to equip it and assign to hotbar slot {assignSlot < 2 ? 3 : assignSlot + 1}.
          </p>
          <div className="grid grid-cols-5 gap-1.5 overflow-y-auto pr-1">
            {inventory.map((slot) => {
              const def = getItemDef(slot.itemId);
              if (!def) return null;
              const isSelected = selectedItemId === slot.itemId;
              const isEquippedWearable =
                equipped.head === slot.itemId ||
                equipped.face === slot.itemId ||
                equipped.back === slot.itemId;
              return (
                <button
                  key={slot.itemId}
                  type="button"
                  title={`${def.name} (${slot.qty})`}
                  onClick={() => {
                    if (def.category === 'wearable') {
                      onEquipWearable(slot.itemId);
                      return;
                    }
                    onSelectItem(slot.itemId);
                    if (slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH) {
                      const targetIdx = assignSlot >= 2 ? assignSlot : 2;
                      onAssignHotbar(targetIdx, slot.itemId);
                    }
                  }}
                  className={`relative h-12 rounded border-2 flex items-center justify-center cursor-pointer ${
                    isEquippedWearable
                      ? 'bg-[#2b4d34] border-[#82e068]'
                      : isSelected
                        ? 'bg-[#254463] border-[#f2b738]'
                        : 'bg-[#09131d] border-[#263c52] hover:border-[#4b7299]'
                  }`}
                >
                  <img
                    src={getItemIconUrl(slot.itemId)}
                    alt={def.name}
                    className="w-7 h-7 pixelated"
                    referrerPolicy="no-referrer"
                  />
                  {slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH && (
                    <span className="absolute bottom-0 right-1 text-[10px] font-mono-num font-bold text-white">
                      {slot.qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Seed Splicer Drawer */}
      {activePanel === 'splice' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-80 bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-xs text-[#82e068]">Seed Splicer</h2>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-[#b5cde3]">
            Combine two seeds to discover hybrid trees (e.g. Granite + Soil, Granite + Turf, Timber + Soil).
          </p>
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="w-12 h-12 rounded border-2 border-[#3a597a] bg-[#08101a] flex items-center justify-center">
              {spliceA ? (
                <img src={getItemIconUrl(spliceA)} alt="Seed A" className="w-7 h-7 pixelated" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[10px] text-[#6d8ba8]">Seed 1</span>
              )}
            </div>
            <span className="font-bold text-[#ffe18c]">+</span>
            <div className="w-12 h-12 rounded border-2 border-[#3a597a] bg-[#08101a] flex items-center justify-center">
              {spliceB ? (
                <img src={getItemIconUrl(spliceB)} alt="Seed B" className="w-7 h-7 pixelated" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-[10px] text-[#6d8ba8]">Seed 2</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {seedsInBag.length === 0 && (
              <p className="col-span-5 text-xs text-[#8aa4bd]">Mine blocks to collect seeds first.</p>
            )}
            {seedsInBag.map((s) => (
              <button
                key={s.itemId}
                type="button"
                onClick={() => {
                  if (!spliceA) setSpliceA(s.itemId);
                  else if (!spliceB) setSpliceB(s.itemId);
                  else {
                    setSpliceA(s.itemId);
                    setSpliceB(null);
                  }
                }}
                className="relative h-11 rounded bg-[#09131d] border-2 border-[#263c52] hover:border-[#82e068] flex items-center justify-center cursor-pointer"
              >
                <img
                  src={getItemIconUrl(s.itemId)}
                  alt={getItemDef(s.itemId)?.name ?? 'Seed'}
                  className="w-6 h-6 pixelated"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 right-1 text-[10px] font-mono-num text-white">{s.qty}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!spliceA || !spliceB}
              onClick={() => {
                if (spliceA && spliceB) {
                  onSpliceSeeds(spliceA, spliceB);
                  setSpliceA(null);
                  setSpliceB(null);
                }
              }}
              className="flex-1 py-1.5 rounded bg-[#4aa64d] disabled:bg-[#233829] disabled:text-[#688770] text-[#081709] font-bold text-xs cursor-pointer"
            >
              Splice Seeds
            </button>
            <button
              type="button"
              onClick={() => {
                setSpliceA(null);
                setSpliceB(null);
              }}
              className="px-3 py-1.5 rounded bg-[#182c42] text-xs font-semibold text-[#c9dced] cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Friends & Social Drawer */}
      {activePanel === 'friends' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-84 max-w-[92vw] max-h-[70vh] bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-xs text-[#89d6ff]">Friends & Social</h2>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (friendInput.trim()) {
                onFriendAction('send_request', friendInput.trim());
                setFriendInput('');
              }
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              placeholder="Add friend by player name..."
              className="flex-1 px-2.5 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#4aa64d] text-[#081709] text-xs font-bold cursor-pointer"
            >
              Add
            </button>
          </form>

          {incomingRequests.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-[#ffe18c]">
                Friend Requests ({incomingRequests.length})
              </span>
              {incomingRequests.map((req) => (
                <div
                  key={req.fromId}
                  className="flex items-center justify-between bg-[#142538] border border-[#3a597a] rounded px-2.5 py-1.5 text-xs"
                >
                  <span className="font-bold text-white">{req.fromName}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFriendAction('accept', req.fromId)}
                      className="px-2 py-0.5 rounded bg-[#4aa64d] text-[#081709] font-bold text-[11px] cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => onFriendAction('decline', req.fromId)}
                      className="px-2 py-0.5 rounded bg-[#3b1b1f] text-[#ffb0b0] font-bold text-[11px] cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 overflow-y-auto max-h-48">
            <span className="text-[11px] font-bold text-[#9cb5cc]">Friends ({friends.length})</span>
            {friends.length === 0 ? (
              <p className="text-xs text-[#6d8ba8]">
                No friends added yet. Meet players in worlds and send them a request!
              </p>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded px-2.5 py-1.5 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#f7f4eb]">{f.name}</div>
                    <div className="text-[10px] text-[#89d6ff]">
                      {f.online ? `Online · ${f.worldName ?? 'Lobby'}` : 'Offline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {f.online && f.worldName && (
                      <button
                        type="button"
                        onClick={() => {
                          onJoinWorld(f.worldName!);
                          setActivePanel('none');
                        }}
                        className="px-2 py-1 rounded bg-[#214463] hover:bg-[#2d5b82] text-[#8cf7ee] font-bold text-[11px] cursor-pointer"
                      >
                        Visit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onFriendAction('remove', f.id)}
                      className="px-1.5 py-1 rounded bg-[#1b2c3d] text-[#9cb5cc] hover:text-[#ff9b9b] text-[11px] cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Profile, Wardrobe & Achievements Drawer */}
      {activePanel === 'profile' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-88 max-w-[92vw] max-h-[72vh] bg-[#0f1d2c]/96 border-2 border-[#f2b738] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-pixel text-xs text-[#ffe18c]">
                {playerName} · LVL {level}
              </h2>
              <p className="text-[11px] font-mono-num text-[#89d6ff]">
                XP: {xp} / {nextXp} · Achievements: {claimedAchievements.length}/{ACHIEVEMENTS.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setProfileTab('achievements')}
              className={`py-1 rounded text-xs font-bold cursor-pointer ${
                profileTab === 'achievements'
                  ? 'bg-[#254463] border border-[#f2b738] text-[#ffe18c]'
                  : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
              }`}
            >
              Achievements
            </button>
            <button
              type="button"
              onClick={() => setProfileTab('wardrobe')}
              className={`py-1 rounded text-xs font-bold cursor-pointer ${
                profileTab === 'wardrobe'
                  ? 'bg-[#254463] border border-[#f2b738] text-[#ffe18c]'
                  : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
              }`}
            >
              Wardrobe ({wearablesInBag.length})
            </button>
          </div>

          {profileTab === 'achievements' ? (
            <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
              {ACHIEVEMENTS.map((ach) => {
                const progress = Math.min(ach.target, stats[ach.statKey] ?? 0);
                const claimed = claimedAchievements.includes(ach.id);
                const ready = progress >= ach.target && !claimed;
                return (
                  <div
                    key={ach.id}
                    className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#f7f4eb]">{ach.name}</span>
                        <span className="text-[10px] text-[#89d6ff]">({ach.category})</span>
                      </div>
                      <div className="text-[10px] text-[#9cb5cc]">{ach.description}</div>
                      <div className="text-[10px] font-mono-num text-[#ffe18c] mt-0.5">
                        Progress: {progress}/{ach.target} · Reward: +{ach.gemReward} Gems, +{ach.xpReward} XP
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
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto pr-1">
              {wearablesInBag.length === 0 ? (
                <p className="text-xs text-[#9cb5cc]">
                  No cosmetic wearables owned yet. Visit the Gem Store to unlock Crowns, Hats, Visors, and Wings!
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
                      className="flex items-center justify-between bg-[#09131d] border border-[#263c52] rounded p-2"
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

      {/* World Navigator Drawer */}
      {activePanel === 'worlds' && (
        <div className="pointer-events-auto fixed left-3 top-14 w-84 max-w-[92vw] bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-pixel text-xs text-[#ffe18c]">World Navigator</h2>
              <button
                type="button"
                title={isCurrentWorldFav ? 'Unfavorite current world' : 'Favorite current world'}
                onClick={() => onToggleFavoriteWorld(worldName)}
                className={`p-1 rounded border cursor-pointer ${
                  isCurrentWorldFav
                    ? 'bg-[#362b12] border-[#f2b738] text-[#ffe18c]'
                    : 'bg-[#09131d] border-[#263c52] text-[#8aa4bd]'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs font-bold text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (worldInput.trim()) {
                onJoinWorld(worldInput.trim().toUpperCase());
                setWorldInput('');
                setActivePanel('none');
              }
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={worldInput}
              maxLength={20}
              onChange={(e) => setWorldInput(e.target.value.toUpperCase())}
              placeholder="Enter or create world..."
              className="flex-1 px-2.5 py-1.5 rounded bg-[#08101a] border border-[#2d4863] text-xs font-bold uppercase text-white focus:outline-none focus:border-[#f2b738]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-[#4aa64d] hover:bg-[#57ba5a] text-[#081709] text-xs font-bold cursor-pointer"
            >
              Travel
            </button>
          </form>

          <div className="grid grid-cols-3 gap-1">
            {(['public', 'favorites', 'recent'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setWorldTab(t)}
                className={`py-1 rounded text-[11px] font-bold uppercase cursor-pointer ${
                  worldTab === t
                    ? 'bg-[#214463] border border-[#78c8f5] text-white'
                    : 'bg-[#09131d] border border-[#263c52] text-[#9cb5cc]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
            {worldTab === 'public' &&
              worlds.map((w) => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => {
                    onJoinWorld(w.name);
                    setActivePanel('none');
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#28425e] text-xs cursor-pointer"
                >
                  <span className="font-bold text-[#f7f4eb]">
                    {w.name} {w.publicAccess === false ? '🔒' : ''}
                  </span>
                  <span className="font-mono-num text-[#89d6ff]">
                    {w.ownerName ? `${w.ownerName} · ` : ''}
                    {w.playerCount}/20
                  </span>
                </button>
              ))}
            {worldTab === 'favorites' &&
              (favoriteWorlds.length === 0 ? (
                <span className="text-xs text-[#6d8ba8] py-2">No favorite worlds saved yet.</span>
              ) : (
                favoriteWorlds.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onJoinWorld(name);
                      setActivePanel('none');
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#28425e] text-xs cursor-pointer"
                  >
                    <span className="font-bold text-[#ffe18c]">★ {name}</span>
                    <span className="text-[11px] text-[#89d6ff]">Visit</span>
                  </button>
                ))
              ))}
            {worldTab === 'recent' &&
              recentWorlds.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onJoinWorld(name);
                    setActivePanel('none');
                  }}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#142538] hover:bg-[#1e3752] border border-[#28425e] text-xs cursor-pointer"
                >
                  <span className="font-bold text-[#f7f4eb]">{name}</span>
                  <span className="text-[11px] text-[#89d6ff]">Revisit</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* World Chat Drawer */}
      {activePanel === 'chat' && (
        <div className="pointer-events-auto fixed left-3 bottom-20 w-80 bg-[#0f1d2c]/94 border-2 border-[#46678a] rounded-md p-2.5 shadow-[0_6px_0_rgba(6,12,20,0.85)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#89d6ff]">World Chat · {worldName}</span>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-xs text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="h-32 overflow-y-auto flex flex-col gap-1 text-xs pr-1">
            {chatMessages.map((m) => (
              <div key={m.id} className={m.system ? 'text-[#ffe18c]' : 'text-[#eaf2fa]'}>
                <span className="font-bold">{m.senderName}: </span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim()) {
                onSendChat(chatInput.trim());
                setChatInput('');
              }
            }}
            className="flex gap-1.5"
          >
            <input
              type="text"
              value={chatInput}
              maxLength={140}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Say something..."
              className="flex-1 px-2 py-1 rounded bg-[#08101a] border border-[#2d4863] text-xs text-white focus:outline-none focus:border-[#78c8f5]"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-[#2a5b8c] hover:bg-[#3672ad] text-xs font-bold text-white cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* In-World Administrator Dev Config Panel */}
      {activePanel === 'admin' && role === 'admin' && (
        <div className="pointer-events-auto fixed right-3 top-14 w-[520px] max-w-[94vw] h-[74vh] max-h-[540px] bg-[#0f1d2c]/96 border-2 border-[#f2b738] rounded-md p-3.5 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col">
          <AdminPanel
            gameConfig={gameConfig}
            inWorld={true}
            onSaveConfig={onUpdateGameConfig}
            onAdminAction={onAdminAction}
            onClose={() => setActivePanel('none')}
          />
        </div>
      )}

      {/* Pause Modal */}
      {mode === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 z-30 bg-[#070f18]/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#101e2e] border-2 border-[#46678a] rounded-lg p-5 shadow-[0_10px_0_rgba(5,10,16,0.9)] flex flex-col gap-3">
            <h2 className="font-pixel text-base text-[#fff8e8] text-center">Paused</h2>
            <div className="grid grid-cols-2 gap-2 text-center bg-[#09131d] border border-[#263c52] rounded p-2.5 text-xs">
              <div>
                <div className="text-[#8aa4bd]">World</div>
                <div className="font-bold text-[#ffe18c]">{worldName}</div>
              </div>
              <div>
                <div className="text-[#8aa4bd]">Level / Gems</div>
                <div className="font-mono-num font-bold text-[#8cf7ee]">
                  {level} · {Math.round(gems)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onResume}
              className="w-full py-2 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-bold text-sm cursor-pointer"
            >
              Resume World
            </button>
            <button
              type="button"
              onClick={() => {
                onResume();
                togglePanel('worlds');
              }}
              className="w-full py-2 rounded bg-[#1b334d] hover:bg-[#244466] border border-[#3d6085] text-[#e6f1fc] font-bold text-sm cursor-pointer"
            >
              Switch World
            </button>
            <button
              type="button"
              onClick={onReturnToHub}
              className="w-full py-2 rounded bg-[#214463] hover:bg-[#2d5b82] border border-[#78c8f5] text-white font-bold text-sm cursor-pointer"
            >
              Return to World Hub
            </button>
            <button
              type="button"
              onClick={onLeaveWorld}
              className="w-full py-2 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] text-[#ffd4d4] font-bold text-sm cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const PortraitBlocker: React.FC<{ onTryLock: () => void }> = ({ onTryLock }) => (
  <div
    data-orientation="portrait"
    className="fixed inset-0 z-50 bg-[#0b1622] text-[#f4f1ea] flex flex-col items-center justify-center p-6 text-center gap-4"
  >
    <RotateCw className="w-12 h-12 text-[#f2b738]" />
    <h1 className="font-pixel text-lg text-[#fff8e8]">Landscape Required</h1>
    <p className="text-sm text-[#b5cde3] max-w-xs">
      Blockgrove is designed exclusively for landscape play. Rotate your device horizontally to continue.
    </p>
    <button
      type="button"
      onClick={onTryLock}
      className="px-4 py-2 rounded bg-[#4aa64d] border-2 border-[#82e068] text-[#081709] font-bold text-sm cursor-pointer"
    >
      Request Landscape Mode
    </button>
  </div>
);
