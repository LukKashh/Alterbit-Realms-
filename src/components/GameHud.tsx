import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Eye,
  Maximize2,
  Menu,
  MessageSquare,
  Paintbrush,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  ZoomIn,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  CROP_SPECS,
  GEM_STORE_LISTINGS,
  getItemDef,
  getMatteragenBranch,
  getEffectiveMatteragenIntervalMs,
  isCropItem,
  ITEM_IDS,
  MATTERAGEN_UPGRADE_COSTS,
  type PlayerStatKey,
  type StoreSection,
} from '../game/catalog.ts';
import { DEFAULT_VIEW_SCALE, MAX_INVENTORY_SLOTS } from '../game/constants.ts';
import { getItemIconUrl, type EquippedWearables } from '../game/pixelArt.ts';
import {
  getCropMasteryRequiredLevel,
  masteryXpForNextLevel,
  worldXpForNextLevel,
  xpForNextLevel,
} from '../game/rules.ts';
import type {
  ActiveBuff,
  ChatMessage,
  ExchangeSnapshot,
  FriendEntry,
  FriendRequestEntry,
  InventorySlot,
  PublicPlayerProfile,
  UserRole,
  WorldSummary,
} from '../game/network.ts';
import type { GameConfig } from '../game/config.ts';
import type { TileInspectInfo } from '../game/engine.ts';
import { NEXUS_DOOR_DESTINATIONS } from '../game/worldGen.ts';
import { formatHudNumber } from '../game/format.ts';
import { AdminPanel, type AdminActionPayload } from './AdminPanel.tsx';
import { ExchangeModal } from './ExchangeModal.tsx';
import { AtmPanel, BfgPanel, FurnacePanel, VaultboxPanel } from './MachinePanels.tsx';
import { RedGemIcon } from './RedGemIcon.tsx';

interface GameHudProps {
  mode: 'playing' | 'paused';
  playerId: string;
  playerName: string;
  role: UserRole;
  gameConfig: GameConfig;
  onUpdateGameConfig: (cfg: GameConfig) => void;
  onAdminAction: (opts: AdminActionPayload) => void;
  adminWorldEdit?: boolean;
  adminBrushItemId?: number | null;
  onToggleAdminWorldEdit?: (enabled: boolean, brushItemId?: number | null) => void;
  worldName: string;
  worldOwner: string | null;
  worldXp?: number;
  worldLevel?: number;
  worldCoreTokens?: number;
  worldHasFurnaceExpansion?: boolean;
  playerCount: number;
  coords: { tx: number; ty: number };
  gems: number;
  alterbits?: number;
  xp: number;
  level: number;
  cropMasteryXp?: number;
  cropMasteryLevel?: number;
  farmablockMasteryXp?: number;
  farmablockMasteryLevel?: number;
  publicProfile?: PublicPlayerProfile | null;
  onDismissPublicProfile?: () => void;
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
  onTapPrimarySlot?: () => void;
  onAssignHotbar: (slotIndex: number, itemId: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  onTouchMove: (dir: 'left' | 'right' | 'down', active: boolean) => void;
  onTouchJump: (active: boolean) => void;
  onTouchPunch: (active: boolean) => void;
  onTouchPunchStick: (active: boolean, dx: number, dy: number) => void;
  onPause: () => void;
  onResume: () => void;
  onReturnToHub: () => void;
  onLeaveWorld: () => void;
  worlds: WorldSummary[];
  onRefreshWorlds: () => void;
  onJoinWorld: (name: string) => void;
  onCreateWorld: (name: string, terraBlast: boolean) => void;
  onToggleFavoriteWorld: (worldName: string) => void;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onSpliceSeeds?: (seedA: number, seedB: number) => void;
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
    opts: {
      addEditorName?: string;
      removeEditorId?: string;
      permissionTargetId?: string;
      permissions?: Partial<import('../game/shareLocks.ts').ShareLockPermissions>;
    }
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
  onReconnectNow?: () => void;
  worldKind?: 'standard' | 'mine_shaft';
  mineExpiresAt?: number | null;
  activeBuffs: ActiveBuff[];
  unclaimedWl: number;
  exchange: ExchangeSnapshot;
  fishingActive: boolean;
  fishingBiting: boolean;
  fishingProgress: number;
  fishingLineTension: number;
  fishingFightPattern: 'darting' | 'surging' | 'deep_run' | 'erratic';
  fishingDepthLevel?: number | null;
  onExitMineShaft: () => void;
  onUseConsumable: (itemId: number) => void;
  onReelFishing: () => void;
  onConfigureFurnace: (
    tx: number,
    ty: number,
    opts: { action: 'craft' | 'collect' | 'repair'; recipeId?: string; toolItemId?: number }
  ) => void;
  onConfigureBfg: (tx: number, ty: number, opts: { action: 'toggle' | 'withdraw' }) => void;
  onExchangeAction: (opts: {
    action: 'list' | 'post' | 'buy' | 'cancel' | 'claim_wl';
    itemId?: number;
    bundleSize?: number;
    bundles?: number;
    priceWl?: number;
    listingId?: string;
  }) => void;
  onUpgradeMatteragen?: (tx: number, ty: number) => void;
  onClaimMatteragen?: (tx: number, ty: number) => void;
  onUnlockWorldCoreFurnace?: () => void;
  onTrashInventoryItem?: (opts: { itemId: number; qty?: number; rodInstanceId?: string }) => void;
  onConfigureVaultbox?: (
    tx: number,
    ty: number,
    opts: {
      action: 'deposit' | 'withdraw';
      itemId?: number;
      qty?: number;
      slotIndex?: number;
      invIndex?: number;
    }
  ) => void;
  hasClaimedStarterLootbox?: boolean;
  onVendorAction?: (opts: {
    action: 'reclaim_hoe' | 'buy_hoe' | 'buy_seed' | 'sell_crop' | 'sell_all_crops';
    itemId?: number;
    qty?: number;
    currency?: 'gems' | 'alterbits' | 'digibits';
  }) => void;
  onConfigureDoor?: (tx: number, ty: number, targetX: number, targetY: number, label?: string) => void;
  onUseDoor?: (tx: number, ty: number) => void;
  onNexusTeleport?: (targetX: number, targetY: number, label?: string) => void;
  viewZoom?: number;
  onChangeViewZoom?: (scale: number) => void;
}

type ActivePanel =
  | 'none'
  | 'backpack'
  | 'worlds'
  | 'chat'
  | 'store'
  | 'friends'
  | 'profile'
  | 'exchange'
  | 'admin';

interface PunchJoystickProps {
  selectedItemId: number;
  onChange: (active: boolean, dx: number, dy: number) => void;
}

const PunchJoystick: React.FC<PunchJoystickProps> = ({ selectedItemId, onChange }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobElRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const setKnobTransform = (x: number, y: number) => {
    if (knobElRef.current) {
      knobElRef.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  };

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxOffset = Math.max(14, Math.round(rect.width * 0.25));
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const rawX = clientX - cx;
    const rawY = clientY - cy;
    const dist = Math.hypot(rawX, rawY);
    const radius = Math.max(18, rect.width * 0.36);
    const clampedDist = Math.min(dist, radius);
    const scale = dist > 0.001 ? clampedDist / dist : 0;
    const normX = (rawX * scale) / radius;
    const normY = (rawY * scale) / radius;
    setKnobTransform(normX * maxOffset, normY * maxOffset);
    onChange(true, normX, normY);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setActive(false);
    setKnobTransform(0, 0);
    onChange(false, 0, 0);
  };

  return (
    <div
      ref={baseRef}
      data-testid="punch-joystick"
      role="slider"
      aria-label="Punch Joystick"
      aria-valuetext={active ? 'Active' : 'Idle'}
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        setActive(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore synthetic pointer capture failure
        }
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        resetStick();
      }}
      onPointerCancel={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        resetStick();
      }}
      className={`relative w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-[12px] border-[2.5px] flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing backdrop-blur-md shadow-[0_3px_0_rgba(15,42,74,0.3)] transition-colors ${
        active
          ? 'bg-[#cfe7fc]/85 border-[#0284c7]'
          : 'bg-[#d8ecfc]/75 border-[#2c5885]'
      }`}
    >
      {/* Directional ring crosshair guides */}
      <div className="pointer-events-none absolute inset-2 rounded-[9px] border border-dashed border-[#2c5885]/45" />
      <span className="pointer-events-none absolute top-1 text-[8px] font-bold text-[#091e3a] leading-none">▲</span>
      <span className="pointer-events-none absolute bottom-1 text-[8px] font-bold text-[#091e3a] leading-none">▼</span>
      <span className="pointer-events-none absolute left-1.5 text-[8px] font-bold text-[#091e3a] leading-none">◀</span>
      <span className="pointer-events-none absolute right-1.5 text-[8px] font-bold text-[#091e3a] leading-none">▶</span>

      {/* Movable thumb knob */}
      <div
        ref={knobElRef}
        className={`pointer-events-none w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 flex flex-col items-center justify-center shadow-[0_2px_0_rgba(15,23,42,0.45)] will-change-transform ${
          active
            ? 'bg-[#b91c1c] border-[#fecaca]'
            : 'bg-[#dc2626] border-[#7f1d1d]'
        }`}
        style={{
          transform: 'translate3d(0px, 0px, 0)',
        }}
      >
        <img
          src={getItemIconUrl(selectedItemId)}
          alt="Action"
          className="w-4 h-4 sm:w-5 sm:h-5 pixelated"
          referrerPolicy="no-referrer"
        />
        <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-[#fff2ec] leading-none mt-0.5">
          {selectedItemId === ITEM_IDS.FIST
            ? 'Punch'
            : selectedItemId === ITEM_IDS.WRENCH
              ? 'Use'
              : getItemDef(selectedItemId)?.toolKind === 'hoe'
                ? 'Plow'
                : getItemDef(selectedItemId)?.toolKind === 'rod'
                  ? 'Fish'
                  : getItemDef(selectedItemId)?.toolKind === 'pickaxe'
                    ? 'Mine'
                    : getItemDef(selectedItemId)?.category === 'consumable'
                      ? 'Use'
                      : 'Place'}
        </span>
      </div>
    </div>
  );
};

const RoleBadgeIcon: React.FC<{ kind: 'admin' | 'owner' | 'guest' }> = ({ kind }) => {
  if (kind === 'admin') {
    return (
      <svg
        viewBox="0 0 20 20"
        className="w-4 h-4 shrink-0"
        aria-label="Administrator"
      >
        <circle cx="10" cy="10" r="8.5" fill="#2a0f18" stroke="#ff9f1c" strokeWidth="2" />
        <rect x="5" y="11" width="10" height="2.2" fill="#fde047" />
        <rect x="5" y="7" width="2.2" height="4.5" fill="#fde047" />
        <rect x="8.9" y="5.8" width="2.2" height="5.6" fill="#fde047" />
        <rect x="12.8" y="7" width="2.2" height="4.5" fill="#fde047" />
        <rect x="6.8" y="9" width="6.4" height="2.2" fill="#fde047" />
        <rect x="9.1" y="9.1" width="1.8" height="1.8" fill="#38e8d8" />
      </svg>
    );
  }
  if (kind === 'owner') {
    return (
      <svg viewBox="0 0 18 18" className="w-4 h-4 shrink-0" aria-label="World Owner">
        <circle cx="9" cy="9" r="7.5" fill="#132336" stroke="#facc15" strokeWidth="1.8" />
        <rect x="5" y="9.5" width="8" height="2.2" fill="#fde047" />
        <rect x="5" y="6.8" width="2" height="2.8" fill="#fde047" />
        <rect x="8" y="6.2" width="2" height="3.4" fill="#fde047" />
        <rect x="11" y="6.8" width="2" height="2.8" fill="#fde047" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 18 18" className="w-4 h-4 shrink-0" aria-label="Explorer">
      <circle cx="9" cy="9" r="7.5" fill="#132336" stroke="#94a3b8" strokeWidth="1.8" />
      <polygon points="9,5.3 12.7,9 9,12.7 5.3,9" fill="#cbd5e1" />
    </svg>
  );
};

export const GameHud: React.FC<GameHudProps> = ({
  mode,
  playerId,
  playerName,
  role,
  gameConfig,
  onUpdateGameConfig,
  onAdminAction,
  adminWorldEdit = false,
  adminBrushItemId = null,
  onToggleAdminWorldEdit,
  worldName,
  worldOwner,
  worldXp = 0,
  worldLevel = 1,
  worldCoreTokens = 0,
  worldHasFurnaceExpansion = false,
  playerCount,
  coords,
  gems,
  alterbits = 0,
  xp,
  level,
  cropMasteryXp = 0,
  cropMasteryLevel = 1,
  farmablockMasteryXp = 0,
  farmablockMasteryLevel = 1,
  publicProfile = null,
  onDismissPublicProfile,
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
  onTapPrimarySlot,
  onAssignHotbar,
  muted,
  onToggleMute,
  touchEnabled,
  onToggleTouch,
  onTouchMove,
  onTouchJump,
  onTouchPunch: _onTouchPunch,
  onTouchPunchStick,
  onPause,
  onResume,
  onReturnToHub,
  onLeaveWorld,
  worlds,
  onRefreshWorlds,
  onJoinWorld,
  onCreateWorld,
  onToggleFavoriteWorld,
  chatMessages,
  onSendChat,
  onSpliceSeeds: _onSpliceSeeds,
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
  onReconnectNow,
  worldKind = 'standard',
  mineExpiresAt = null,
  activeBuffs,
  unclaimedWl,
  exchange,
  fishingActive,
  fishingBiting,
  fishingProgress,
  fishingLineTension,
  fishingFightPattern,
  fishingDepthLevel,
  onExitMineShaft,
  onUseConsumable,
  onReelFishing,
  onConfigureFurnace,
  onConfigureBfg,
  onExchangeAction,
  onUpgradeMatteragen,
  onClaimMatteragen,
  onUnlockWorldCoreFurnace,
  onTrashInventoryItem,
  onConfigureVaultbox,
  hasClaimedStarterLootbox: _hasClaimedStarterLootbox = false,
  onVendorAction,
  onConfigureDoor,
  onUseDoor,
  onNexusTeleport,
  viewZoom = DEFAULT_VIEW_SCALE,
  onChangeViewZoom,
}) => {
  void _hasClaimedStarterLootbox;
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [showPanelView, setShowPanelView] = useState<boolean>(true);
  const [zoomOpen, setZoomOpen] = useState<boolean>(false);
  const zoomContainerRef = useRef<HTMLDivElement | null>(null);
  const [worldInput, setWorldInput] = useState('');
  const [newWorldName, setNewWorldName] = useState('');
  const [useTerraBlast, setUseTerraBlast] = useState(false);
  const [worldTab, setWorldTab] = useState<'public' | 'favorites' | 'recent'>('public');
  const [chatInput, setChatInput] = useState('');
  const [bagFilter, setBagFilter] = useState<'all' | 'farmable' | 'seed' | 'block'>('all');
  const [assignSlot, setAssignSlot] = useState<number>(1);
  const [storeCategory, setStoreCategory] = useState<StoreSection>('seeds');
  const [profileTab, setProfileTab] = useState<'wallet' | 'achievements' | 'wardrobe'>('wallet');
  void _onSpliceSeeds;
  const [friendInput, setFriendInput] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!zoomOpen) return;
    const handleOutside = (e: Event) => {
      if (zoomContainerRef.current && !zoomContainerRef.current.contains(e.target as Node)) {
        setZoomOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside, true);
    document.addEventListener('mousedown', handleOutside, true);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handleOutside, true);
      document.removeEventListener('mousedown', handleOutside, true);
      window.removeEventListener('keydown', handleKey);
    };
  }, [zoomOpen]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // The browser/device may deny fullscreen; reflect the actual state.
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  };

  // Inspector local form state
  const [editorInput, setEditorInput] = useState('');
  const [signDraft, setSignDraft] = useState('');
  const [vmItemId, setVmItemId] = useState<number>(ITEM_IDS.GP_DIRT);
  const [vmStockQty, setVmStockQty] = useState<number>(5);
  const [vmPriceItemId, setVmPriceItemId] = useState<number>(ITEM_IDS.GP_RED_BRICKS);
  const [vmPriceQty, setVmPriceQty] = useState<number>(1);
  const [doorTargetX, setDoorTargetX] = useState<number>(25);
  const [doorTargetY, setDoorTargetY] = useState<number>(27);
  const [doorLabel, setDoorLabel] = useState<string>('');

  useEffect(() => {
    if (
      worldKind !== 'mine_shaft' &&
      activeBuffs.length === 0 &&
      !inspectInfo?.matteragenEngine &&
      !inspectInfo?.atmMachine
    ) {
      return;
    }
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [worldKind, activeBuffs.length, inspectInfo?.matteragenEngine, inspectInfo?.atmMachine]);

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
    if (inspectInfo?.doorLink) {
      setDoorTargetX(inspectInfo.doorLink.targetX);
      setDoorTargetY(inspectInfo.doorLink.targetY);
      setDoorLabel(inspectInfo.doorLink.label ?? '');
    } else if (inspectInfo?.isDoor) {
      setDoorTargetX(coords.tx);
      setDoorTargetY(coords.ty);
      setDoorLabel('');
    }
  }, [inspectInfo, coords.tx, coords.ty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'playing') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyB' || e.code === 'KeyI') {
        e.preventDefault();
        setActivePanel((cur) => (cur === 'backpack' ? 'none' : 'backpack'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  const liveBuffs = activeBuffs.filter((b) => b.expiresAt > nowMs);
  const mineRemainingSec =
    worldKind === 'mine_shaft' && mineExpiresAt
      ? Math.max(0, Math.ceil((mineExpiresAt - nowMs) / 1000))
      : null;
  const mineTimerText =
    mineRemainingSec !== null
      ? `${Math.floor(mineRemainingSec / 60)}:${String(mineRemainingSec % 60).padStart(2, '0')}`
      : null;

  const nextXp = xpForNextLevel(level);
  const xpPct = Math.min(100, Math.round((xp / nextXp) * 100));
  const selectedDef = getItemDef(selectedItemId);
  const wearablesInBag = inventory.filter(
    (s) => getItemDef(s.itemId)?.category === 'wearable' && s.qty > 0
  );
  const tradeablesInBag = inventory.filter((s) => {
    const d = getItemDef(s.itemId);
    return d && d.tradeable && s.qty > 0 && s.itemId !== ITEM_IDS.FIST && s.itemId !== ITEM_IDS.WRENCH;
  });
  const bagSlotsUsed = inventory.filter(
    (s) => s.qty > 0 && s.itemId !== ITEM_IDS.FIST && s.itemId !== ITEM_IDS.WRENCH
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

  const activeLock = inspectInfo?.shareLock ?? null;
  const isAdminBypass = role === 'admin' && adminWorldEdit;
  const isLockOwner = activeLock?.ownerId === playerId || isAdminBypass;
  const myRealms = worlds.filter((world) => world.ownerId === playerId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-1.5 sm:p-2.5">
      {/* Top Perimeter Bar (Responsive status + World Chat below top-left + Menu button) */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        {/* Top-left Column: Recompartmentalized Profile Box + Separated Tight-Fit Gem Box + Chat & Friends */}
        <div className="flex flex-col items-start gap-1.5 min-w-0 max-w-[calc(100vw-8.5rem)] sm:max-w-[calc(100vw-11rem)]">
          {showPanelView && (
            <div
              data-testid="hud-panel-view"
              className="pointer-events-auto flex items-center gap-1.5 max-w-full"
            >
              {/* Player Profile Box (+1/3 height, retains 1/2 freed Gem width, Name + Role Icon row above Progression Bar + Level) */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-profile-button"
                aria-label="Profile"
                aria-expanded={activePanel === 'profile'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  togglePanel('profile');
                }}
                className={`pixel-box relative flex flex-col justify-between text-left min-w-[168px] sm:min-w-[196px] min-h-[54px] sm:min-h-[56px] px-2.5 py-1.5 transition-all cursor-pointer ${
                  activePanel === 'profile'
                    ? '!border-[#0284c7] ring-2 ring-[#38bdf8]/45'
                    : 'hover:brightness-[1.03]'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <RoleBadgeIcon
                    kind={role === 'admin' ? 'admin' : worldOwner === playerId ? 'owner' : 'guest'}
                  />
                  <span className="font-pixel text-[11px] sm:text-xs font-bold text-[#091e3a] whitespace-nowrap truncate max-w-[125px] sm:max-w-[155px] leading-none">
                    {playerName}
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full mt-1">
                  <div className="flex-1 h-2 rounded-[6px] bg-white/75 border border-[#4172a3] overflow-hidden">
                    <div
                      className="h-full rounded-[4px] bg-[#0284c7] transition-[width] duration-150"
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono-num font-bold text-[#091e3a] whitespace-nowrap leading-none">
                    Lv.{formatHudNumber(level)}
                  </span>
                </div>
              </button>

              {/* Separated Tight-Fit Gem Balance Box (drastically compact, grows rightward for larger balances) */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-gemstore-button"
                aria-label={`Gem Store (${formatHudNumber(gems)} Gems)`}
                aria-expanded={activePanel === 'store'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  togglePanel('store');
                }}
                className={`pixel-box !rounded-[10px] w-fit shrink-0 px-2 py-1 flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                  activePanel === 'store'
                    ? '!border-[#0284c7] ring-2 ring-[#38bdf8]/45'
                    : 'hover:brightness-[1.03]'
                }`}
              >
                <RedGemIcon className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-mono-num font-bold text-[#091e3a] leading-none">
                  {formatHudNumber(gems)}
                </span>
              </button>
            </div>
          )}

          {/* World Chat + Icon-Only Friends Button */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-chat-button"
              aria-label="World Chat"
              aria-expanded={activePanel === 'chat'}
              onClick={(e) => {
                e.currentTarget.blur();
                togglePanel('chat');
              }}
              className={`pixel-btn !h-7 !px-2.5 gap-1 !text-[10px] !rounded-[8px] ${
                activePanel === 'chat' ? 'pixel-btn-primary' : ''
              }`}
            >
              <MessageSquare
                className={`w-3.5 h-3.5 shrink-0 ${
                  activePanel === 'chat' ? 'text-white' : 'text-[#091e3a]'
                }`}
              />
              <span>Chat</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-friends-button"
              aria-label="Friends"
              title="Friends"
              aria-expanded={activePanel === 'friends'}
              onClick={(e) => {
                e.currentTarget.blur();
                togglePanel('friends');
              }}
              className={`pixel-btn relative !w-7 !h-7 !p-0 !rounded-[8px] flex items-center justify-center ${
                activePanel === 'friends' ? 'pixel-btn-primary' : ''
              }`}
            >
              <Users
                className={`w-3.5 h-3.5 ${
                  activePanel === 'friends' ? 'text-white' : 'text-[#091e3a]'
                }`}
              />
              {incomingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-[5px] bg-[#dc2626] border border-[#7f1d1d] text-[8px] font-mono-num font-bold text-white flex items-center justify-center">
                  {incomingRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Top-right: Mine Exit / Status + Collapsible View Zoom Box + Menu Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          {worldKind === 'mine_shaft' && (
            <button
              type="button"
              data-testid="leave-mine-button"
              onClick={onExitMineShaft}
              className="h-8 sm:h-9 px-2.5 rounded-[9px] bg-[#fef3c7]/90 hover:bg-[#fde68a] backdrop-blur-md border-2 border-[#b45309] text-[#451a03] flex items-center gap-1 font-mono-num font-bold text-xs shadow-[0_2px_0_rgba(15,42,74,0.25)] cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5 shrink-0" />
              <span>{mineTimerText ?? 'Mine'}</span>
              <span className="text-[10px] uppercase">Exit</span>
            </button>
          )}
          {!connected && (
            <button
              type="button"
              onClick={onReconnectNow}
              className="px-2.5 py-1 rounded-[8px] bg-[#fee2e2]/90 hover:bg-[#fecaca] backdrop-blur-md border-2 border-[#dc2626] text-[10px] font-bold text-[#7f1d1d] cursor-pointer whitespace-nowrap"
            >
              Retry
            </button>
          )}

          {/* Upper-Right Expandable View Zoom Box */}
          <div
            ref={zoomContainerRef}
            className="relative flex items-center justify-end shrink-0"
          >
            {!zoomOpen ? (
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-zoom-toggle"
                aria-label="View Zoom"
                aria-expanded={false}
                title={`View Zoom (${viewZoom.toFixed(2).replace(/0$/, '')}×)`}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setZoomOpen(true);
                }}
                className="pixel-box !rounded-[9px] w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-[#091e3a] hover:brightness-[1.04] cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            ) : (
              <div
                data-testid="hud-zoom-popover"
                className="pixel-box !rounded-[10px] h-8 sm:h-9 px-2.5 flex items-center gap-1.5 shrink-0"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Collapse View Zoom"
                  onClick={() => setZoomOpen(false)}
                  className="text-[#091e3a] hover:text-[#0369a1] cursor-pointer shrink-0"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <div className="relative flex items-center w-20 sm:w-28">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-0.5 h-3 rounded-full bg-[#2c5885]/70"
                  />
                  <input
                    type="range"
                    data-testid="hud-zoom-slider"
                    aria-label="View Zoom"
                    min={0.75}
                    max={2.25}
                    step={0.05}
                    value={viewZoom}
                    onChange={(e) => onChangeViewZoom?.(Number(e.target.value))}
                    className="hud-zoom-range relative z-10 w-full cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  title="Reset zoom to default (1.5×)"
                  onClick={() => onChangeViewZoom?.(DEFAULT_VIEW_SCALE)}
                  className="text-[10px] font-mono-num font-bold text-[#091e3a] hover:text-[#0369a1] w-8 text-right shrink-0 cursor-pointer"
                >
                  {viewZoom.toFixed(2).replace(/0$/, '')}×
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-menu-button"
            aria-label="Menu"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="pixel-btn pixel-btn-wood relative !h-8 sm:!h-9 !px-2.5 sm:!px-3 gap-1.5 !text-xs !rounded-[9px]"
          >
            <Menu className="w-3.5 h-3.5 text-[#091e3a]" />
            <span>Menu</span>
            {incomingRequests.length > 0 && (
              <span className="w-4 h-4 rounded-[5px] bg-[#dc2626] border border-[#7f1d1d] text-[9px] font-mono-num font-bold text-white flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Timed Culinary Buffs + First-Login NEXUS Nudge + Fishing Reel CTA + Toast + Inspector */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {worldName === 'NEXUS' && myRealms.length === 0 && (
          <div
            data-testid="nexus-first-login-nudge"
            className="pixel-box px-3.5 py-1.5 text-[11px] font-bold text-[#091e3a] text-center max-w-[92vw]"
          >
            Welcome to NEXUS! Head East (→) to the Realm Steward Deck to conjure your 50×40 personal world and open your Starter Supply Lootbox!
          </div>
        )}
        {liveBuffs.length > 0 && (
          <div className="pixel-box flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1 text-[10px] font-mono-num text-[#0f766e]">
            {liveBuffs.map((b) => {
              const remSec = Math.max(0, Math.ceil((b.expiresAt - nowMs) / 1000));
              const m = Math.floor(remSec / 60);
              const s = String(remSec % 60).padStart(2, '0');
              return (
                <span key={b.buffType} className="font-bold">
                  {b.label} +{b.bonusPct}% ({m}:{s})
                </span>
              );
            })}
          </div>
        )}

        {fishingActive && (
          <button
            type="button"
            data-testid="fishing-reel-button"
            onClick={onReelFishing}
            className={`pointer-events-auto pixel-btn !px-4 !py-2 !text-xs ${
              fishingBiting
                ? 'pixel-btn-gold animate-bounce'
                : 'pixel-btn-primary'
            }`}
          >
            {fishingBiting ? `! BITE ! Depth ${fishingDepthLevel ?? '?'} / 6 · Reel ${Math.round(fishingProgress)}%` : `Fishing · Depth ${fishingDepthLevel ?? '?'} / 6 · Tap to Reel`}
            {fishingBiting && <span className="block h-1.5 w-full mt-1 rounded-full bg-white/75 border border-[#4172a3]/60 overflow-hidden"><span className="block h-full rounded-full bg-[#16a34a] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, fishingProgress))}%` }} /></span>}
            {fishingBiting && <span className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono-num"><span className="uppercase tracking-wide">{fishingFightPattern.replace('_', ' ')} fight</span><span className={fishingLineTension > 0.82 ? 'text-[#dc2626]' : fishingLineTension < 0.38 ? 'text-[#0284c7]' : 'text-[#92400e]'}>LINE TENSION {Math.round(fishingLineTension * 100)}%</span></span>}
          </button>
        )}

        {toastMessage && (
          <div className="pixel-wood-box text-[#091e3a] text-xs font-bold px-3.5 py-1.5 border-[#b45309]">
            {toastMessage}
          </div>
        )}
        {inspectInfo && (
          <div className="pointer-events-auto pixel-box p-3 w-80 max-w-[92vw] max-h-[calc(100dvh-12rem)] overflow-y-auto text-xs flex flex-col gap-2">
            <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between gap-4">
              <span className="ui-pixel-heading text-[11px] text-[#091e3a] truncate">
                {inspectInfo.fgName} ({inspectInfo.tx}, {inspectInfo.ty})
              </span>
              <button
                type="button"
                onClick={onDismissInspect}
                className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                [X]
              </button>
            </div>

            {/* NEXUS Single Multi-Way Navigational Door Window */}
            {inspectInfo.isNexusDoor && (
              <div
                data-testid="nexus-multiway-door-window"
                className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-pixel text-[11px] text-[#0369a1]">
                    NEXUS GATEWAY
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-[6px] bg-[#e0f2fe]/85 border border-[#2c5885] text-[9px] font-mono-num font-bold text-[#091e3a]">
                    TELEPORT
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {NEXUS_DOOR_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      data-testid={`nexus-door-dest-${dest.id}`}
                      onClick={() => {
                        onNexusTeleport?.(dest.tx, dest.ty, dest.label);
                        onDismissInspect();
                      }}
                      className="pixel-slot p-2 text-left flex items-center justify-between gap-2 cursor-pointer hover:border-[#0284c7] transition-colors"
                    >
                      <span className="font-pixel text-[10px] text-[#091e3a]">
                        {dest.label}
                      </span>
                      <span className="text-[9px] font-mono-num text-[#0369a1] font-bold">
                        ({dest.tx}, {dest.ty})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Player-World Background Door Data Editor (Wrench & authorized builders only) */}
            {inspectInfo.isDoor && !inspectInfo.isNexusDoor && inspectInfo.canEditDoor && (
              <div
                data-testid="gateway-door-panel"
                className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] text-[#0369a1]">
                    DOOR DATA
                  </span>
                  <span className="text-[10px] font-mono-num text-[#92400e] font-bold">
                    {inspectInfo.doorLink
                      ? `(${inspectInfo.doorLink.targetX}, ${inspectInfo.doorLink.targetY})`
                      : 'Unlinked'}
                  </span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onConfigureDoor?.(
                      inspectInfo.tx,
                      inspectInfo.ty,
                      doorTargetX,
                      doorTargetY,
                      doorLabel.trim() || undefined
                    );
                  }}
                  className="hud-subpanel p-2 flex flex-col gap-1.5"
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex flex-col gap-0.5 text-[10px] text-[#23476d] font-semibold">
                      <span>Target X</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={doorTargetX}
                        onChange={(e) => setDoorTargetX(Number(e.target.value))}
                        className="hud-input px-2 py-1 text-xs font-mono-num"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] text-[#23476d] font-semibold">
                      <span>Target Y</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={doorTargetY}
                        onChange={(e) => setDoorTargetY(Number(e.target.value))}
                        className="hud-input px-2 py-1 text-xs font-mono-num"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    maxLength={32}
                    value={doorLabel}
                    onChange={(e) => setDoorLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="hud-input px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    data-testid="save-gateway-door-btn"
                    className="pixel-btn pixel-btn-primary w-full !py-1 !text-[10px]"
                  >
                    Save Link
                  </button>
                </form>
              </div>
            )}

            {/* Share Lock Permissions Panel */}
            {activeLock && (
              <div className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#0e7490]">
                    {getItemDef(activeLock.itemId)?.name ?? 'Share Lock'} · {activeLock.width}×{activeLock.height}
                  </span>
                  <span className="text-[10px] text-[#0369a1] font-bold">{activeLock.ownerName}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {Object.entries(activeLock.access ?? {}).length === 0 ? (
                    <span className="text-[11px] text-[#23476d]">No shared editors.</span>
                  ) : Object.entries(activeLock.access ?? {}).map(([targetId, grant]) => (
                    <div key={targetId} className="pixel-slot p-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#091e3a]">{grant.playerName}</span>
                        {isLockOwner && <button type="button" onClick={() => onConfigureLock(inspectInfo.tx, inspectInfo.ty, { removeEditorId: targetId })} className="text-[#b91c1c] font-bold cursor-pointer">Revoke</button>}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['build', 'break', 'interact'] as const).map((permission) => (
                          <button key={permission} type="button" disabled={!isLockOwner}
                            onClick={() => onConfigureLock(inspectInfo.tx, inspectInfo.ty, { permissionTargetId: targetId, permissions: { [permission]: !grant.permissions[permission] } })}
                            className={`px-1 py-1 rounded-[7px] border-2 text-[10px] font-bold capitalize ${grant.permissions[permission] ? 'bg-[#dcfce7]/90 border-[#16a34a] text-[#14532d]' : 'bg-[#fee2e2]/90 border-[#dc2626] text-[#991b1b]'} ${isLockOwner ? 'cursor-pointer' : 'cursor-default'}`}>
                            {permission}: {grant.permissions[permission] ? 'On' : 'Off'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {isLockOwner && (
                  <form onSubmit={(e) => { e.preventDefault(); if (editorInput.trim()) { onConfigureLock(inspectInfo.tx, inspectInfo.ty, { addEditorName: editorInput.trim() }); setEditorInput(''); } }} className="flex gap-1.5">
                    <input type="text" value={editorInput} onChange={(e) => setEditorInput(e.target.value)} placeholder="Username..." className="hud-input flex-1 min-w-0 px-2 py-1 text-xs" />
                    <button type="submit" className="pixel-btn pixel-btn-emerald !px-2.5 !py-1 !text-[10px]">Grant</button>
                  </form>
                )}
              </div>
            )}

            {/* Nexus Landlord: personal realm management */}
            {inspectInfo.isLandlord && worldName === 'NEXUS' && (
              <div className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-pixel text-[11px] text-[#92400e]">REALM STEWARD</h3>
                  <button type="button" onClick={onRefreshWorlds} className="text-[10px] text-[#0369a1] font-bold cursor-pointer">Refresh</button>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-[#0e7490]">My Realm ({myRealms.length}/1)</span>
                  <span className="text-[10px] text-[#23476d]">50×40 Personal World</span>
                </div>
                {myRealms.map((realm) => (
                  <button key={realm.name} type="button" onClick={() => onJoinWorld(realm.name)}
                    className="pixel-slot flex items-center justify-between p-2 text-left cursor-pointer hover:border-[#0284c7]">
                    <span className="font-bold text-[#091e3a]">{realm.name}</span>
                    <span className="text-[10px] text-[#0369a1] font-mono-num font-bold">{realm.playerCount}/10 · Enter</span>
                  </button>
                ))}
                {myRealms.length === 0 && (
                  <form onSubmit={(e) => { e.preventDefault(); if (newWorldName.trim()) { onCreateWorld(newWorldName.trim(), useTerraBlast); setNewWorldName(''); setUseTerraBlast(false); } }}
                    className="border-t border-[#4172a3]/30 pt-2 flex flex-col gap-1.5">
                    <input value={newWorldName} onChange={(e) => setNewWorldName(e.target.value.toUpperCase())}
                      maxLength={20} placeholder="Realm name..."
                      className="hud-input w-full px-2 py-1.5 text-xs uppercase" />
                    {getQty(ITEM_IDS.WORLD_BLAST) > 0 && (
                      <label className="flex items-center gap-2 text-[11px] text-[#6d28d9] font-semibold">
                        <input type="checkbox" checked={useTerraBlast} onChange={(e) => setUseTerraBlast(e.target.checked)} />
                        World Blast ({getQty(ITEM_IDS.WORLD_BLAST)})
                      </label>
                    )}
                    <button type="submit" disabled={!newWorldName.trim() || (useTerraBlast && getQty(ITEM_IDS.WORLD_BLAST) < 1)}
                      className="pixel-btn pixel-btn-emerald w-full disabled:opacity-40 !text-[10px]">
                      Create Realm
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* WorldCore: Streamlined View + Lv.5 Furnace Expansion */}
            {inspectInfo.isWorldCore && inspectInfo.worldLock && (() => {
              const nextWorldXp = worldXpForNextLevel(worldLevel);
              const worldXpPct = Math.min(100, Math.round((worldXp / Math.max(1, nextWorldXp)) * 100));
              const isOwner = inspectInfo.worldLock.ownerId === playerId;
              const canUnlockFurnace = isOwner && alterbits >= 2500 && worldCoreTokens >= 3;
              return (
                <div
                  data-testid="world-view-panel"
                  className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-pixel text-[11px] text-[#92400e]">WORLDCORE</h3>
                    <span
                      data-testid="world-level-badge"
                      className="px-1.5 py-0.5 rounded-[6px] bg-[#fef3c7]/90 border border-[#b45309] text-[10px] font-mono-num font-bold text-[#92400e]"
                    >
                      WORLD LVL {formatHudNumber(worldLevel)}
                    </span>
                  </div>

                  {/* World XP Bar */}
                  <div className="hud-subpanel p-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0e7490]">World XP</span>
                      <span
                        data-testid="world-xp-readout"
                        className="font-mono-num font-bold text-[#92400e]"
                      >
                        {formatHudNumber(worldXp)} / {formatHudNumber(nextWorldXp)}
                      </span>
                    </div>
                    <div className="h-2 rounded-[6px] bg-white/80 border border-[#4172a3] overflow-hidden">
                      <div
                        className="h-full rounded-[4px] bg-[#d97706] transition-[width] duration-200"
                        style={{ width: `${worldXpPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Core Tokens Counter */}
                  <div
                    data-testid="world-core-tokens-card"
                    className="rounded-[8px] bg-[#dff1ff]/80 border-2 border-[#2c5885] px-2 py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="font-pixel text-[10px] text-[#091e3a]">Core Tokens</span>
                    <span
                      data-testid="world-core-tokens"
                      className="px-2 py-0.5 rounded-[6px] bg-white/85 border border-[#4172a3] font-mono-num text-xs font-bold text-[#091e3a]"
                    >
                      {formatHudNumber(worldCoreTokens)}
                    </span>
                  </div>

                  <div className="pixel-slot px-2 py-1.5 text-[11px] text-[#23476d] flex items-center justify-between">
                    <span>Owner: <strong className="text-[#091e3a]">{inspectInfo.worldLock.ownerName}</strong></span>
                    <span className="font-mono-num text-[#0369a1] font-bold">{playerCount}/10</span>
                  </div>

                  {/* WorldCore Expansion: revealed strictly at World Level 5+, zero teaser prior */}
                  {worldLevel >= 5 && !worldHasFurnaceExpansion && (
                    <button
                      type="button"
                      data-testid="worldcore-expansion-btn"
                      disabled={!canUnlockFurnace}
                      onClick={() => onUnlockWorldCoreFurnace?.()}
                      className="pixel-btn pixel-btn-gold w-full disabled:opacity-45 !py-1.5 !text-[10px]"
                    >
                      WorldCore Expansion: Furnace (2,500 DB · 3 Core Tokens)
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Nexus Fresh Greens Vendor: Compact Crops & Mastery-Unlocked Seeds (No Hoe) */}
            {inspectInfo.isGreensVendor && (() => {
              const harvestedCropsInBag = inventory.filter(
                (s) => isCropItem(s.itemId) && s.qty > 0
              );
              const totalSellableDb = harvestedCropsInBag.reduce((acc, s) => {
                const def = getItemDef(s.itemId);
                return acc + s.qty * (def?.cropSellAlterbits ?? 2);
              }, 0);
              return (
                <div
                  data-testid="greens-vendor-panel"
                  className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-pixel text-[11px] text-[#047857]">FRESH GREENS</h3>
                    <span className="px-2 py-0.5 rounded-[6px] bg-[#dcfce7]/90 border border-[#16a34a] text-xs font-mono-num font-bold text-[#14532d]">
                      {formatHudNumber(alterbits)} DB
                    </span>
                  </div>

                  {/* Sell Crops */}
                  <div className="rounded-[8px] bg-[#e2f5ec]/75 border border-[#16a34a] p-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#14532d] text-[11px]">Sell Crops</span>
                      {harvestedCropsInBag.length > 0 && (
                        <button
                          type="button"
                          data-testid="vendor-sell-all-crops"
                          onClick={() => onVendorAction?.({ action: 'sell_all_crops' })}
                          className="pixel-btn pixel-btn-gold !px-2 !py-0.5 !text-[9px]"
                        >
                          Sell All (+{formatHudNumber(totalSellableDb)} DB)
                        </button>
                      )}
                    </div>
                    {harvestedCropsInBag.length === 0 ? (
                      <span className="text-[10px] text-[#23476d]">No crops in bag.</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {harvestedCropsInBag.map((slot) => {
                          const def = getItemDef(slot.itemId);
                          const unitDb = def?.cropSellAlterbits ?? 2;
                          return (
                            <div
                              key={slot.itemId}
                              className="pixel-slot px-2 py-1 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <img
                                  src={getItemIconUrl(slot.itemId)}
                                  alt={def?.name ?? 'Crop'}
                                  className="w-5 h-5 pixelated shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="truncate text-[11px]">
                                  <span className="font-bold text-[#091e3a]">{def?.name}</span>{' '}
                                  <span className="font-mono-num font-bold text-[#92400e]">
                                    ×{formatHudNumber(slot.qty)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onVendorAction?.({ action: 'sell_crop', itemId: slot.itemId, qty: 1 })
                                  }
                                  className="pixel-btn !px-1.5 !py-0.5 !text-[9px]"
                                >
                                  1 (+{formatHudNumber(unitDb)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onVendorAction?.({ action: 'sell_crop', itemId: slot.itemId, qty: slot.qty })
                                  }
                                  className="pixel-btn pixel-btn-emerald !px-1.5 !py-0.5 !text-[9px]"
                                >
                                  All (+{formatHudNumber(slot.qty * unitDb)})
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Crop Seeds (Mastery Gated) */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#92400e] text-[11px]">Crop Seeds</span>
                      <span className="text-[10px] font-mono-num font-bold text-[#047857]">
                        Crop Mastery Lv.{cropMasteryLevel}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5">
                      {CROP_SPECS.map((crop) => {
                        const seedDef = getItemDef(crop.seedId);
                        const ownedSeeds = getQty(crop.seedId);
                        const reqLv = getCropMasteryRequiredLevel(crop.seedId);
                        const unlocked = cropMasteryLevel >= reqLv;
                        return (
                          <div
                            key={crop.seedId}
                            data-testid={`vendor-seed-${crop.keyBase}`}
                            className={`pixel-slot p-1.5 flex items-center justify-between gap-2 ${
                              !unlocked ? 'opacity-65' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={getItemIconUrl(crop.seedId)}
                                alt={seedDef?.name ?? crop.name}
                                className="w-6 h-6 pixelated shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-[#091e3a] text-[11px] truncate">
                                  {crop.name}{' '}
                                  {ownedSeeds > 0 && (
                                    <span className="text-[10px] font-mono-num text-[#0e7490]">
                                      ×{formatHudNumber(ownedSeeds)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono-num text-[#23476d]">
                                  {crop.growthTimeSec}s · {formatHudNumber(crop.sellAlterbits)} DB
                                  {!unlocked && (
                                    <span className="text-[#b91c1c] font-bold ml-1">· Crop Lv.{reqLv}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {unlocked ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onVendorAction?.({
                                      action: 'buy_seed',
                                      itemId: crop.seedId,
                                      qty: 1,
                                      currency: 'digibits',
                                    })
                                  }
                                  className="pixel-btn pixel-btn-emerald !px-1.5 !py-1 !text-[9px]"
                                >
                                  1 ({formatHudNumber(crop.seedAlterbitPrice)})
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onVendorAction?.({
                                      action: 'buy_seed',
                                      itemId: crop.seedId,
                                      qty: 5,
                                      currency: 'digibits',
                                    })
                                  }
                                  className="pixel-btn !px-1.5 !py-1 !text-[9px]"
                                >
                                  5 ({formatHudNumber(crop.seedAlterbitPrice * 5)})
                                </button>
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-[6px] bg-[#fee2e2]/90 border border-[#dc2626] text-[9px] font-mono-num font-bold text-[#991b1b] shrink-0">
                                Lv.{reqLv}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Personal Vending Machine Panel */}
            {inspectInfo.vendingMachine && (
              <div className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0e7490]">Vending Shop</span>
                  <span className="text-[11px] text-[#23476d]">
                    By {inspectInfo.vendingMachine.ownerName}
                  </span>
                </div>

                {inspectInfo.vendingMachine.stockItemId > 0 && inspectInfo.vendingMachine.stockQty > 0 ? (
                  <div className="pixel-slot flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={getItemIconUrl(inspectInfo.vendingMachine.stockItemId)}
                        alt="Stock"
                        className="w-7 h-7 pixelated"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-bold text-[#091e3a]">
                          {getItemDef(inspectInfo.vendingMachine.stockItemId)?.name} (×
                          {formatHudNumber(inspectInfo.vendingMachine.stockQty)} left)
                        </div>
                        <div className="text-[11px] text-[#92400e] font-semibold">
                          Price: {formatHudNumber(inspectInfo.vendingMachine.priceQty)}×{' '}
                          {getItemDef(inspectInfo.vendingMachine.priceItemId)?.name}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBuyVending(inspectInfo.tx, inspectInfo.ty, 1)}
                      className="pixel-btn pixel-btn-emerald !px-2.5 !py-1 !text-[10px]"
                    >
                      Buy 1
                    </button>
                  </div>
                ) : (
                  <div className="pixel-slot text-[11px] text-[#23476d] p-2">
                    This Vending Machine is currently out of stock.
                  </div>
                )}

                {(inspectInfo.vendingMachine.ownerId === playerId || isAdminBypass) && (
                  <div className="flex flex-col gap-1.5 border-t-2 border-[#4172a3]/35 pt-2">
                    <span className="text-[11px] font-bold text-[#92400e]">Owner Management</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={vmItemId}
                        onChange={(e) => setVmItemId(Number(e.target.value))}
                        className="hud-input px-1.5 py-1 text-[11px]"
                      >
                        {tradeablesInBag.map((s, idx) => (
                          <option key={s.rodInstanceId ?? `${s.itemId}-${idx}`} value={s.itemId}>
                            {getItemDef(s.itemId)?.name} ({formatHudNumber(s.qty)})
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
                        className="hud-input px-2 py-1 text-[11px] font-mono-num"
                      />
                      <select
                        value={vmPriceItemId}
                        onChange={(e) => setVmPriceItemId(Number(e.target.value))}
                        className="hud-input px-1.5 py-1 text-[11px]"
                      >
                        <option value={ITEM_IDS.GP_RED_BRICKS}>Price in: Red Bricks</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={vmPriceQty}
                        onChange={(e) => setVmPriceQty(Math.max(1, Number(e.target.value)))}
                        placeholder="Price per 1"
                        className="hud-input px-2 py-1 text-[11px] font-mono-num"
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
                        className="pixel-btn flex-1 !py-1 !text-[10px]"
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
                          className="pixel-btn pixel-btn-gold flex-1 !py-1 !text-[10px]"
                        >
                          Withdraw ({formatHudNumber(inspectInfo.vendingMachine.earningsQty)} earned)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Signboard Editor (authorized users only) */}
            {inspectInfo.signText !== undefined && inspectInfo.signText !== null && inspectInfo.canEditSign !== false && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onConfigureSign(inspectInfo.tx, inspectInfo.ty, signDraft);
                }}
                className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-1.5"
              >
                <span className="text-[11px] font-bold text-[#92400e]">Signboard Message</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={signDraft}
                    onChange={(e) => setSignDraft(e.target.value)}
                    placeholder="Write message on sign..."
                    className="hud-input flex-1 px-2 py-1 text-xs"
                  />
                  <button
                    type="submit"
                    className="pixel-btn pixel-btn-emerald !px-2.5 !py-1 !text-[10px]"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            {/* Stone Furnace Panel */}
            {inspectInfo.furnace && (
              <FurnacePanel
                furnace={inspectInfo.furnace}
                inventory={inventory}
                onCraft={(recipeId) =>
                  onConfigureFurnace(inspectInfo.tx, inspectInfo.ty, { action: 'craft', recipeId })
                }
                onCollect={() =>
                  onConfigureFurnace(inspectInfo.tx, inspectInfo.ty, { action: 'collect' })
                }
              />
            )}

            {/* BFG Auto-Collector Panel */}
            {inspectInfo.bfgCollector && (
              <BfgPanel
                bfg={inspectInfo.bfgCollector}
                canManage={
                  inspectInfo.bfgCollector.ownerId === playerId ||
                  inspectInfo.worldLock?.ownerId === playerId ||
                  isAdminBypass
                }
                onToggle={() =>
                  onConfigureBfg(inspectInfo.tx, inspectInfo.ty, { action: 'toggle' })
                }
                onWithdraw={() =>
                  onConfigureBfg(inspectInfo.tx, inspectInfo.ty, { action: 'withdraw' })
                }
              />
            )}

            {/* Matteragen Engine Panel (Claim via Interact UI + -5% time/upgrade) */}
            {inspectInfo.matteragenEngine && (() => {
              const eng = inspectInfo.matteragenEngine;
              const engDef = getItemDef(eng.typeId);
              const branch = getMatteragenBranch(eng.typeId);
              const intervalMs = getEffectiveMatteragenIntervalMs(eng.typeId, eng.level);
              const elapsedMs = Math.max(0, nowMs - (eng.lastHarvestMs || eng.placedAtMs || nowMs));
              const remSec = Math.max(0, Math.ceil((intervalMs - elapsedMs) / 1000));
              const remMin = Math.floor(remSec / 60);
              const remS = remSec % 60;
              const pct = Math.min(100, Math.round((elapsedMs / Math.max(1, intervalMs)) * 100));
              const nextCost = MATTERAGEN_UPGRADE_COSTS[eng.level];
              return (
                <div
                  data-testid="matteragen-panel"
                  className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[10px] text-[#0369a1]">
                      {engDef?.name ?? 'Matteragen Engine'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[6px] bg-[#fef3c7]/90 border border-[#b45309] text-[10px] font-mono-num font-bold text-[#92400e]">
                      LV. {eng.level}/5
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#23476d]">
                    <span className="uppercase font-bold text-[#091e3a]">{branch}</span>
                    {eng.level > 1 && (
                      <span className="font-mono-num font-bold text-[#047857]">
                        -{(eng.level - 1) * 5}% time
                      </span>
                    )}
                  </div>
                  {eng.isReady ? (
                    <div className="rounded-[8px] bg-[#dcfce7]/90 border-2 border-[#16a34a] p-2 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono-num text-[#14532d]">
                        {(eng.storedDrops ?? []).map((d, idx) => (
                          <span
                            key={idx}
                            className="flex items-center gap-1 rounded-[6px] bg-white/90 px-1.5 py-0.5 border border-[#16a34a]"
                          >
                            <img
                              src={getItemIconUrl(d.itemId)}
                              alt={getItemDef(d.itemId)?.name ?? 'Block'}
                              className="w-4 h-4 pixelated"
                              referrerPolicy="no-referrer"
                            />
                            <span>
                              {d.count}× {getItemDef(d.itemId)?.name ?? `#${d.itemId}`}
                            </span>
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        data-testid="claim-matteragen-btn"
                        onClick={() => onClaimMatteragen?.(inspectInfo.tx, inspectInfo.ty)}
                        className="pixel-btn pixel-btn-gold w-full !py-1.5 !text-[10px]"
                      >
                        Claim Yield
                      </button>
                    </div>
                  ) : (
                    <div className="hud-subpanel p-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#23476d]">Generating</span>
                        <span className="font-mono-num font-bold text-[#0369a1]">
                          {remMin}m {String(remS).padStart(2, '0')}s
                        </span>
                      </div>
                      <div className="h-2 rounded-[6px] bg-white/80 border border-[#4172a3] overflow-hidden">
                        <div className="h-full rounded-[4px] bg-[#0284c7] transition-[width]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] rounded-[8px] bg-[#dff1ff]/80 border border-[#2c5885] px-2 py-1">
                    <span className="text-[#091e3a] font-semibold">Core Tokens</span>
                    <span className="font-mono-num font-bold text-[#091e3a]">
                      {formatHudNumber(worldCoreTokens)}
                    </span>
                  </div>
                  {eng.level < 5 && nextCost ? (
                    <button
                      type="button"
                      data-testid="upgrade-matteragen-btn"
                      disabled={worldCoreTokens < nextCost}
                      onClick={() => onUpgradeMatteragen?.(inspectInfo.tx, inspectInfo.ty)}
                      className="pixel-btn pixel-btn-gold w-full disabled:opacity-45 !text-[10px]"
                    >
                      Upgrade LV. {eng.level + 1} ({formatHudNumber(nextCost)} Tokens)
                    </button>
                  ) : (
                    <span className="text-center font-pixel text-[9px] text-[#92400e]">
                      MAX LV. 5
                    </span>
                  )}
                </div>
              );
            })()}

            {/* ATM Machine Panel */}
            {inspectInfo.atmMachine && (
              <AtmPanel atm={inspectInfo.atmMachine} nowMs={nowMs} />
            )}

            {/* Vaultbox Player Storage Panel (10 Tiles) */}
            {inspectInfo.vaultbox && (
              <VaultboxPanel
                vaultbox={inspectInfo.vaultbox}
                playerId={playerId}
                isAdminBypass={isAdminBypass}
                inventory={inventory}
                onDeposit={(itemId, qty, slotIndex, invIndex) =>
                  onConfigureVaultbox?.(inspectInfo.tx, inspectInfo.ty, {
                    action: 'deposit',
                    itemId,
                    qty,
                    slotIndex,
                    invIndex,
                  })
                }
                onWithdraw={(slotIndex, qty) =>
                  onConfigureVaultbox?.(inspectInfo.tx, inspectInfo.ty, {
                    action: 'withdraw',
                    slotIndex,
                    qty,
                  })
                }
              />
            )}

            {/* Global Exchange Terminal Quick Launch */}
            {inspectInfo.isExchangeTerminal && (
              <div className="border-t-2 border-[#4172a3]/35 pt-2 flex flex-col gap-1.5">
                <span className="text-[11px] text-[#23476d]">
                  Trade World Lock bundles cross-world via the Global Exchange.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDismissInspect();
                    onExchangeAction({ action: 'list' });
                    setActivePanel('exchange');
                  }}
                  className="pixel-btn pixel-btn-gold !text-[11px]"
                >
                  Open Global Exchange
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Perimeter: Portrait-friendly 2-row stack (<740px) & Single Row (>=740px Landscape) */}
      <div className="flex flex-col min-[740px]:flex-row min-[740px]:items-end min-[740px]:justify-between gap-1.5 sm:gap-2">
        {/* Center Hotbar (top row in portrait, middle in landscape; 4 quick slots + Fist/Wrench + Bag, 20% slimmer) */}
        <div className="pointer-events-auto order-1 min-[740px]:order-2 flex flex-col items-center gap-0.5 self-center max-w-full">
          {(selectedDef || (role === 'admin' && adminWorldEdit)) && (
            <div className="pixel-box !rounded-[8px] text-[9px] sm:text-[10px] font-bold text-[#091e3a] px-2 py-[2px] whitespace-nowrap max-w-[92vw] truncate">
              {selectedDef ? selectedDef.name : 'System Edit Mode'}
              {role === 'admin' && adminWorldEdit && (
                <span className="text-[#0369a1] font-bold">
                  {' '}
                  · SysEdit Active
                </span>
              )}
            </div>
          )}
          <div
            data-testid="hud-hotbar"
            className="pixel-wood-box !rounded-[9px] flex items-center gap-[3px] sm:gap-1 p-[3px] sm:p-1 max-w-full overflow-x-auto"
          >
            {hotbarItemIds.map((itemId, idx) => {
              const isPrimarySlot = idx === 0;
              const effectiveId = isPrimarySlot
                ? selectedItemId === ITEM_IDS.WRENCH
                  ? ITEM_IDS.WRENCH
                  : ITEM_IDS.FIST
                : itemId;
              const def = getItemDef(effectiveId);
              const invSlot = inventory.find((s) => s.itemId === effectiveId);
              const isExemptTool = effectiveId === ITEM_IDS.FIST || effectiveId === ITEM_IDS.WRENCH;
              const qty = isExemptTool ? null : getQty(effectiveId);
              const active = isPrimarySlot
                ? selectedItemId === ITEM_IDS.FIST || selectedItemId === ITEM_IDS.WRENCH
                : selectedItemId === effectiveId;
              const hasDurability = typeof invSlot?.maxDurability === 'number' && invSlot.maxDurability > 0;
              const durRatio = hasDurability
                ? Math.max(0, Math.min(1, (invSlot!.durability ?? invSlot!.maxDurability!) / invSlot!.maxDurability!))
                : 1;
              return (
                <button
                  key={`${idx}-${effectiveId}`}
                  type="button"
                  tabIndex={-1}
                  data-testid={`hotbar-slot-${idx + 1}`}
                  aria-label={
                    isPrimarySlot
                      ? `Slot 1: ${selectedItemId === ITEM_IDS.WRENCH ? 'Wrench (Inspect)' : 'Fist (Tap again for Wrench)'}`
                      : `Slot ${idx + 1}: ${def?.name ?? 'Empty'}`
                  }
                  title={
                    isPrimarySlot
                      ? `${def?.name ?? 'Fist'} · Tap while selected to toggle Fist/Wrench`
                      : def
                        ? `${def.name}${qty !== null ? ` (${formatHudNumber(qty)})` : ''}`
                        : `Slot ${idx + 1}: Empty`
                  }
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (isPrimarySlot) {
                      if (onTapPrimarySlot) onTapPrimarySlot();
                      else onSelectItem(selectedItemId === ITEM_IDS.FIST ? ITEM_IDS.WRENCH : ITEM_IDS.FIST);
                      return;
                    }
                    setAssignSlot(idx);
                    if (effectiveId !== ITEM_IDS.AIR) onSelectItem(effectiveId);
                  }}
                  className={`pixel-slot relative w-[40px] h-[45px] min-[480px]:w-[45px] min-[480px]:h-[45px] sm:w-[51px] sm:h-[51px] shrink-0 flex flex-col items-center justify-center touch-none select-none cursor-pointer transition-transform ${
                    active
                      ? effectiveId === ITEM_IDS.WRENCH
                        ? '!bg-[#cffafe] !border-[#0284c7] -translate-y-0.5 shadow-[0_0_8px_rgba(2,132,199,0.28)]'
                        : '!bg-[#fef3c7] !border-[#b45309] -translate-y-0.5 shadow-[0_0_8px_rgba(180,83,9,0.28)]'
                      : ''
                  }`}
                >
                  {effectiveId !== ITEM_IDS.AIR && (
                    <img
                      src={getItemIconUrl(effectiveId)}
                      alt={def?.name ?? 'Item'}
                      className="pixelated shrink-0 w-[26px] h-[26px] sm:w-[29px] sm:h-[29px]"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {qty !== null && !hasDurability && (
                    <span
                      data-testid={`hotbar-item-qty-${idx + 1}`}
                      className="absolute bottom-[2px] right-[2px] rounded-full bg-[#eaf5ff]/95 border border-[#2c5885] px-[4px] py-[1px] text-[7px] sm:text-[8px] font-mono-num font-bold text-[#091e3a] leading-none shadow-[0_1px_0_rgba(15,42,74,0.2)]"
                    >
                      {formatHudNumber(qty)}x
                    </span>
                  )}
                  {hasDurability && (
                    <div className="absolute inset-x-1 bottom-0.5 h-1 rounded-full bg-white/80 overflow-hidden">
                      <div
                        className={`h-full ${
                          durRatio > 0.4 ? 'bg-[#16a34a]' : durRatio > 0.15 ? 'bg-[#d97706]' : 'bg-[#dc2626]'
                        }`}
                        style={{ width: `${Math.round(durRatio * 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
            <div className="h-6 sm:h-7 w-[1.5px] rounded-full bg-[#4172a3]/60 mx-0.5 shrink-0" />
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-backpack-button"
              aria-label="Backpack Inventory Toggle"
              aria-expanded={activePanel === 'backpack'}
              onClick={(e) => {
                e.currentTarget.blur();
                setActivePanel((cur) => (cur === 'backpack' ? 'none' : 'backpack'));
              }}
              className={`pixel-slot relative w-[40px] h-[45px] min-[480px]:w-[45px] min-[480px]:h-[45px] sm:w-[51px] sm:h-[51px] shrink-0 flex flex-col items-center justify-center gap-0.5 touch-none select-none cursor-pointer transition-transform ${
                activePanel === 'backpack'
                  ? '!bg-[#fef3c7]/90 !border-[#b45309] text-[#92400e] -translate-y-0.5'
                  : 'text-[#091e3a]'
              }`}
            >
              <Backpack className="w-4 h-4" />
              <span className="text-[7px] font-pixel uppercase leading-none">Bag</span>
            </button>
          </div>
        </div>

        {/* Touch Controls Row in Portrait; split left/right of Hotbar in Landscape */}
        <div className="order-2 w-full flex items-end justify-between gap-2 min-[740px]:contents">
          {/* Left Touch Movement Controls */}
          <div className="min-[740px]:order-1 flex-1 flex items-end justify-start">
            {touchEnabled && (
              <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2" data-testid="touch-left-controls">
                <button
                  type="button"
                  aria-label="Move Left"
                  onPointerDown={(e) => {
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore synthetic pointer capture failure
                    }
                    onTouchMove('left', true);
                  }}
                  onPointerUp={() => onTouchMove('left', false)}
                  onPointerCancel={() => onTouchMove('left', false)}
                  className="pixel-slot w-14 h-14 sm:w-[68px] sm:h-[68px] active:!bg-[#dbeafe] active:!border-[#0284c7] text-[#091e3a] font-bold text-lg sm:text-xl flex items-center justify-center touch-none select-none cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Move Right"
                  onPointerDown={(e) => {
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore synthetic pointer capture failure
                    }
                    onTouchMove('right', true);
                  }}
                  onPointerUp={() => onTouchMove('right', false)}
                  onPointerCancel={() => onTouchMove('right', false)}
                  className="pixel-slot w-14 h-14 sm:w-[68px] sm:h-[68px] active:!bg-[#dbeafe] active:!border-[#0284c7] text-[#091e3a] font-bold text-lg sm:text-xl flex items-center justify-center touch-none select-none cursor-pointer"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Right Touch Punch Joystick & Jump Button */}
          <div className="min-[740px]:order-3 flex-1 flex items-end justify-end">
            {touchEnabled && (
              <div className="pointer-events-auto flex items-end gap-1.5 sm:gap-2" data-testid="touch-right-controls">
                <PunchJoystick
                  selectedItemId={selectedItemId}
                  onChange={onTouchPunchStick}
                />
                <button
                  type="button"
                  aria-label="Jump"
                  onPointerDown={(e) => {
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore synthetic pointer capture failure
                    }
                    onTouchJump(true);
                  }}
                  onPointerUp={() => onTouchJump(false)}
                  onPointerCancel={() => onTouchJump(false)}
                  className="pixel-btn pixel-btn-emerald w-14 h-14 sm:w-[68px] sm:h-[68px] !rounded-[11px] flex flex-col items-center justify-center gap-0.5 touch-none select-none"
                >
                  <span className="text-lg sm:text-xl leading-none">▲</span>
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider leading-none">Jump</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gem Store Drawer (anchored below Top-Left Panel View + Chat row) */}
      {activePanel === 'store' && (
        <div className="pointer-events-auto fixed left-2 top-[98px] sm:top-[106px] z-20 w-[min(22rem,calc(100vw-1rem))] max-h-[calc(100dvh-12.5rem)] min-[740px]:max-h-[calc(100dvh-10.5rem)] pixel-box p-3 flex flex-col gap-2.5">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="ui-pixel-heading text-xs text-[#091e3a]">Gem Store</h2>
              <span className="inline-flex items-center gap-1 text-xs font-mono-num font-bold text-[#091e3a]">
                <RedGemIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{formatHudNumber(gems)}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['seeds', 'blocks', 'wearables'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setStoreCategory(cat)}
                className={`py-1.5 rounded-[8px] border-2 text-[10px] font-pixel uppercase cursor-pointer ${
                  storeCategory === cat
                    ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d] hover:bg-white/60'
                }`}
              >
                {cat === 'seeds' ? 'Farming' : cat === 'blocks' ? 'Blocks & Tech' : 'Gear'}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
            {(gameConfig.storeListings ?? GEM_STORE_LISTINGS)
              .filter((l) => l.section === storeCategory)
              .map((listing) => {
                const canAfford = gems >= listing.gemPrice;
              return (
                <div
                  key={listing.id}
                  className="pixel-slot flex items-center justify-between gap-2 p-2"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={getItemIconUrl(listing.iconItemId)}
                      alt={listing.name}
                      className="w-7 h-7 pixelated shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#091e3a]">{listing.name}</div>
                      <div className="text-[10px] text-[#23476d]">{listing.description}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyGemStore(listing.id)}
                    className="pixel-btn pixel-btn-primary disabled:opacity-40 !py-1.5 !px-2.5 !text-[10px] font-mono-num shrink-0"
                  >
                    {formatHudNumber(listing.gemPrice)} G
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backpack Drawer (20-slot capacity, 500 max stack, large icons) */}
      {activePanel === 'backpack' && (
        <div
          data-testid="backpack-drawer"
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-[124px] min-[740px]:bottom-[84px] z-20 w-[min(24rem,calc(100vw-1rem))] max-h-[calc(100dvh-12rem)] min-[740px]:max-h-[calc(100dvh-8.5rem)] pixel-wood-box p-3 flex flex-col gap-2"
        >
          <div className="pixel-wood-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'farmable', label: 'Crops' },
                  { id: 'seed', label: 'Seeds' },
                  { id: 'block', label: 'Blocks' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBagFilter(tab.id)}
                  className={`px-2 py-0.5 rounded-[7px] text-[10px] font-bold cursor-pointer border-2 ${
                    bagFilter === tab.id
                      ? 'bg-[#0284c7] border-[#164e7a] text-white'
                      : 'bg-[#e3f1fd]/80 border-[#4172a3] text-[#091e3a] hover:bg-white/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {role === 'admin' && (
                <button
                  type="button"
                  data-testid="backpack-admin-clear-btn"
                  onClick={() => onAdminAction({ action: 'clear_inventory' })}
                  title="Admin: Clear all non-default inventory slots"
                  className="px-2 py-0.5 rounded-[7px] text-[10px] font-bold cursor-pointer border-2 bg-[#fee2e2]/90 border-[#dc2626] text-[#991b1b] hover:bg-[#fecaca]"
                >
                  Clear Inv
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                data-testid="backpack-slot-counter"
                className={`text-[10px] font-mono-num font-bold ${
                  bagSlotsUsed >= MAX_INVENTORY_SLOTS ? 'text-[#b91c1c]' : 'text-[#047857]'
                }`}
              >
                {bagSlotsUsed}/{MAX_INVENTORY_SLOTS}
              </span>
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                [X]
              </button>
            </div>
          </div>
          <div className="hud-subpanel flex items-center justify-between gap-2 text-[10px] text-[#091e3a] px-2 py-1">
            <span>
              Tap to equip Slot{' '}
              {assignSlot < 1 || assignSlot >= hotbarItemIds.length ? 2 : assignSlot + 1}
            </span>
            <span className="flex items-center gap-1 text-[#047857] font-semibold">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Max 500/slot</span>
            </span>
          </div>
          {selectedDef?.category === 'consumable' && (
            <button
              type="button"
              data-testid="use-consumable-btn"
              onClick={() => {
                onUseConsumable(selectedDef.id);
                setActivePanel('none');
              }}
              className="pixel-btn pixel-btn-emerald !py-1.5 !px-3 !text-xs"
            >
              Use {selectedDef.name}
            </button>
          )}
          <div className="grid grid-cols-5 gap-1.5 overflow-y-auto pr-1">
            {inventory
              .filter((slot) => {
                const def = getItemDef(slot.itemId);
                if (!def) return false;
                if (bagFilter === 'farmable') {
                  return def.category === 'farmable' || Boolean(def.farmableTier);
                }
                if (bagFilter === 'seed') {
                  return def.category === 'seed';
                }
                if (bagFilter === 'block') {
                  return (
                    def.category === 'foreground' ||
                    def.category === 'farmable' ||
                    def.category === 'background'
                  );
                }
                return true;
              })
              .map((slot, idx) => {
                const def = getItemDef(slot.itemId);
                if (!def) return null;
                const isSelected = selectedItemId === slot.itemId;
                const isEquippedWearable =
                  equipped.head === slot.itemId ||
                  equipped.face === slot.itemId ||
                  equipped.back === slot.itemId;
                const hasDur = typeof slot.maxDurability === 'number' && slot.maxDurability > 0;
                const durRatio = hasDur
                  ? Math.max(0, Math.min(1, (slot.durability ?? slot.maxDurability!) / slot.maxDurability!))
                  : 1;
                const isFarmable = def.category === 'farmable' || Boolean(def.farmableTier);
                const isProtectedTool =
                  slot.itemId === ITEM_IDS.FIST || slot.itemId === ITEM_IDS.WRENCH;
                const canTrash =
                  !isProtectedTool &&
                  (role === 'admin' || slot.itemId !== ITEM_IDS.FARMING_HOE);
                return (
                  <button
                    key={slot.rodInstanceId ?? `${slot.itemId}-${idx}`}
                    type="button"
                    title={`${def.name} (${formatHudNumber(slot.qty)})${isFarmable ? ` · T${def.farmableTier ?? 1}` : ''}`}
                    onClick={() => {
                      if (def.category === 'wearable') {
                        onEquipWearable(slot.itemId);
                        return;
                      }
                      onSelectItem(slot.itemId);
                      if (slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH) {
                        const targetIdx =
                          assignSlot >= 1 && assignSlot < hotbarItemIds.length ? assignSlot : 1;
                        onAssignHotbar(targetIdx, slot.itemId);
                      }
                    }}
                    className={`relative h-[74px] rounded-[8px] border-2 flex flex-col items-center justify-between p-1 cursor-pointer ${
                      isEquippedWearable
                        ? 'bg-[#dcfce7]/90 border-[#16a34a]'
                        : isSelected
                          ? 'bg-[#dbeafe]/90 border-[#0284c7]'
                          : isFarmable
                            ? 'bg-[#ecfdf5]/85 border-[#059669] hover:border-[#047857]'
                            : 'bg-white/75 border-[#4172a3] hover:border-[#0284c7]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full px-0.5">
                      {isFarmable ? (
                        <span className="text-[8px] font-mono-num font-bold text-[#92400e]">
                          T{def.farmableTier ?? 1}
                        </span>
                      ) : <span />}
                      {!isProtectedTool && !hasDur && (
                        <span className="text-[9px] font-mono-num font-bold text-[#091e3a]">
                          {formatHudNumber(slot.qty)}
                        </span>
                      )}
                    </div>
                    <img
                      src={getItemIconUrl(slot.itemId)}
                      alt={def.name}
                      className="w-9 h-9 sm:w-10 sm:h-10 pixelated"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[8px] font-bold text-[#091e3a] truncate w-full text-center px-0.5 leading-tight">
                      {def.name}
                    </span>
                    {hasDur && (
                      <div className="absolute inset-x-1 bottom-1 h-1 bg-[#d8ecfc] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            durRatio > 0.4 ? 'bg-[#16a34a]' : durRatio > 0.15 ? 'bg-[#d97706]' : 'bg-[#dc2626]'
                          }`}
                          style={{ width: `${Math.round(durRatio * 100)}%` }}
                        />
                      </div>
                    )}
                    {canTrash && (
                      <span
                        role="button"
                        tabIndex={-1}
                        data-testid={`backpack-delete-slot-${slot.itemId}`}
                        title={
                          role === 'admin'
                            ? `Admin: Delete ${def.name} slot`
                            : `Discard ${def.name} from bag`
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (role === 'admin') {
                            onAdminAction({
                              action: 'delete_inventory_slot',
                              itemId: slot.itemId,
                              rodInstanceId: slot.rodInstanceId,
                            });
                          } else {
                            onTrashInventoryItem?.({
                              itemId: slot.itemId,
                              rodInstanceId: slot.rodInstanceId,
                            });
                          }
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-[5px] bg-[#b91c1c] hover:bg-[#dc2626] border border-[#fecaca] text-white flex items-center justify-center leading-none z-10"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Friends & Social Drawer */}
      {activePanel === 'friends' && (
        <div className="pointer-events-auto fixed right-2 top-[56px] sm:top-[64px] z-20 w-[min(21rem,calc(100vw-1rem))] max-h-[calc(100dvh-10.5rem)] min-[740px]:max-h-[calc(100dvh-8.25rem)] pixel-box p-3 flex flex-col gap-2.5 overflow-y-auto">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <h2 className="ui-pixel-heading text-xs text-[#091e3a]">Friends &amp; Social</h2>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
            >
              [X]
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
              className="hud-input flex-1 px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="pixel-btn pixel-btn-emerald !py-1.5 !px-3 !text-[10px]"
            >
              Add
            </button>
          </form>

          {incomingRequests.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-[#92400e]">
                Friend Requests ({incomingRequests.length})
              </span>
              {incomingRequests.map((req) => (
                <div
                  key={req.fromId}
                  className="hud-subpanel flex items-center justify-between px-2.5 py-1.5 text-xs"
                >
                  <span className="font-bold text-[#091e3a]">{req.fromName}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFriendAction('accept', req.fromId)}
                      className="pixel-btn pixel-btn-emerald !py-0.5 !px-2 !text-[10px]"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => onFriendAction('decline', req.fromId)}
                      className="pixel-btn pixel-btn-ruby !py-0.5 !px-2 !text-[10px]"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 overflow-y-auto max-h-48">
            <span className="text-[11px] font-bold text-[#23476d]">Friends ({friends.length})</span>
            {friends.length === 0 ? (
              <p className="text-xs text-[#23476d]">
                No friends added yet. Meet players in worlds and send them a request!
              </p>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs"
                >
                  <div>
                    <div className="font-bold text-[#091e3a]">{f.name}</div>
                    <div className="text-[10px] text-[#0369a1]">
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
                        className="pixel-btn pixel-btn-primary !py-1 !px-2 !text-[10px]"
                      >
                        Visit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onFriendAction('remove', f.id)}
                      className="px-1.5 py-1 rounded-[7px] bg-[#d8ecfc]/80 border border-[#4172a3] text-[#23476d] hover:text-[#b91c1c] text-[11px] font-bold cursor-pointer"
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

      {/* Profile, My Wallet, Masteries, Achievements & Wardrobe Drawer */}
      {activePanel === 'profile' && (() => {
        const nextCropXp = masteryXpForNextLevel(cropMasteryLevel);
        const cropPct = Math.min(100, Math.round((cropMasteryXp / Math.max(1, nextCropXp)) * 100));
        const nextFarmXp = masteryXpForNextLevel(farmablockMasteryLevel);
        const farmPct = Math.min(100, Math.round((farmablockMasteryXp / Math.max(1, nextFarmXp)) * 100));
        return (
          <div className="pointer-events-auto fixed left-2 top-[98px] sm:top-[106px] z-20 w-[min(22rem,calc(100vw-1rem))] max-h-[calc(100dvh-12.5rem)] min-[740px]:max-h-[calc(100dvh-10.5rem)] pixel-box p-3 flex flex-col gap-2.5">
            <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
              <div>
                <h2 className="ui-pixel-heading text-xs text-[#091e3a] flex items-center gap-1.5">
                  <RoleBadgeIcon
                    kind={role === 'admin' ? 'admin' : worldOwner === playerId ? 'owner' : 'guest'}
                  />
                  <span>{playerName}</span>
                  <span>· Lv.{formatHudNumber(level)}</span>
                </h2>
                <p className="text-[11px] font-mono-num text-[#23476d]">
                  XP {formatHudNumber(xp)}/{formatHudNumber(nextXp)} · {claimedAchievements.length}/{ACHIEVEMENTS.length} Ach
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                [X]
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                data-testid="profile-tab-wallet"
                onClick={() => setProfileTab('wallet')}
                className={`py-1 rounded-[8px] border-2 text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1 ${
                  profileTab === 'wallet'
                    ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
              >
                <Wallet className="w-3 h-3" />
                <span>My Wallet</span>
              </button>
              <button
                type="button"
                data-testid="profile-tab-achievements"
                onClick={() => setProfileTab('achievements')}
                className={`py-1 rounded-[8px] border-2 text-[11px] font-bold cursor-pointer ${
                  profileTab === 'achievements'
                    ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
              >
                Achievements
              </button>
              <button
                type="button"
                data-testid="profile-tab-wardrobe"
                onClick={() => setProfileTab('wardrobe')}
                className={`py-1 rounded-[8px] border-2 text-[11px] font-bold cursor-pointer ${
                  profileTab === 'wardrobe'
                    ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
              >
                Gear ({wearablesInBag.length})
              </button>
            </div>

            {profileTab === 'wallet' && (
              <div data-testid="profile-wallet-panel" className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {/* Currency Balances */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="pixel-slot p-2 flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-[#991b1b]">
                      <RedGemIcon className="w-3 h-3 shrink-0" />
                      <span>Gems</span>
                    </span>
                    <span className="text-sm font-mono-num font-bold text-[#091e3a]">
                      {formatHudNumber(gems)}
                    </span>
                  </div>
                  <div className="pixel-slot p-2 flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-[#047857]">Digibits (DB)</span>
                    <span className="text-sm font-mono-num font-bold text-[#92400e]">
                      {formatHudNumber(alterbits)} DB
                    </span>
                  </div>
                </div>

                {/* Sub-Category Mastery Tracks */}
                <div className="hud-subpanel p-2 flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#047857]">Crop Mastery</span>
                      <span className="font-mono-num font-bold text-[#091e3a]">
                        LVL {formatHudNumber(cropMasteryLevel)} · {formatHudNumber(cropMasteryXp)}/{formatHudNumber(nextCropXp)} XP
                      </span>
                    </div>
                    <div className="h-2 rounded-[6px] bg-white/80 border border-[#4172a3] overflow-hidden">
                      <div className="h-full rounded-[4px] bg-[#16a34a]" style={{ width: `${cropPct}%` }} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0369a1]">Farmablock Mastery</span>
                      <span className="font-mono-num font-bold text-[#091e3a]">
                        LVL {formatHudNumber(farmablockMasteryLevel)} · {formatHudNumber(farmablockMasteryXp)}/{formatHudNumber(nextFarmXp)} XP
                      </span>
                    </div>
                    <div className="h-2 rounded-[6px] bg-white/80 border border-[#4172a3] overflow-hidden">
                      <div className="h-full rounded-[4px] bg-[#0284c7]" style={{ width: `${farmPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'achievements' && (
              <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                {ACHIEVEMENTS.map((ach) => {
                  const progress = Math.min(ach.target, stats[ach.statKey] ?? 0);
                  const claimed = claimedAchievements.includes(ach.id);
                  const ready = progress >= ach.target && !claimed;
                  return (
                    <div
                      key={ach.id}
                      className="pixel-slot flex items-center justify-between gap-2 px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-[#091e3a] truncate">{ach.name}</div>
                        <div className="text-[10px] font-mono-num text-[#92400e]">
                          {formatHudNumber(progress)}/{formatHudNumber(ach.target)} · +{formatHudNumber(ach.gemReward)}G · +{formatHudNumber(ach.xpReward)}XP
                        </div>
                      </div>
                      {claimed ? (
                        <span className="px-2 py-0.5 rounded-[6px] bg-[#dcfce7]/90 border border-[#16a34a] text-[10px] font-bold text-[#14532d] shrink-0">
                          Claimed
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => onClaimAchievement(ach.id)}
                          className="pixel-btn pixel-btn-emerald disabled:opacity-40 !py-1 !px-2 !text-[10px] shrink-0"
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {profileTab === 'wardrobe' && (
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {wearablesInBag.length === 0 ? (
                  <p className="text-xs text-[#23476d]">
                    No wearables owned yet.
                  </p>
                ) : (
                  wearablesInBag.map((slot, idx) => {
                    const def = getItemDef(slot.itemId);
                    if (!def) return null;
                    const isEq =
                      equipped.head === slot.itemId ||
                      equipped.face === slot.itemId ||
                      equipped.back === slot.itemId;
                    return (
                      <div
                        key={slot.rodInstanceId ?? `${slot.itemId}-${idx}`}
                        className="pixel-slot flex items-center justify-between p-2"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={getItemIconUrl(slot.itemId)}
                            alt={def.name}
                            className="w-7 h-7 pixelated"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="text-xs font-bold text-[#091e3a]">{def.name}</div>
                            <div className="text-[10px] text-[#0369a1] uppercase">
                              {def.wearableSlot ?? 'head'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEquipWearable(slot.itemId)}
                          className={`pixel-btn !py-1 !px-2.5 !text-[10px] ${
                            isEq ? 'pixel-btn-gold' : 'pixel-btn-primary'
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
        );
      })()}

      {/* Public Player Profile Modal (opened via Wrench click on nearby player) */}
      {publicProfile && (
        <div
          data-testid="public-profile-modal"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#091e3a]/45 backdrop-blur-[2px] flex items-center justify-center p-3"
        >
          <div className="w-full max-w-xs pixel-box p-3 flex flex-col gap-2.5">
            <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <RoleBadgeIcon kind={publicProfile.role === 'admin' ? 'admin' : 'guest'} />
                <h2 className="font-pixel text-xs text-[#091e3a] truncate">
                  {publicProfile.playerName}
                </h2>
                <span className="px-1.5 py-0.5 rounded-[6px] bg-white/80 border border-[#4172a3] text-[9px] font-bold text-[#091e3a] shrink-0">
                  {publicProfile.role === 'admin' ? 'ADMIN' : 'EXPLORER'}
                </span>
              </div>
              <button
                type="button"
                onClick={onDismissPublicProfile}
                className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
              >
                [X]
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="pixel-slot p-2">
                <div className="text-[9px] text-[#0369a1] uppercase font-bold">Player Level</div>
                <div className="font-mono-num font-bold text-[#091e3a]">
                  LVL {formatHudNumber(publicProfile.level)}
                </div>
              </div>
              <div className="pixel-slot p-2">
                <div className="text-[9px] text-[#0369a1] uppercase font-bold">Achievements</div>
                <div className="font-mono-num font-bold text-[#92400e]">
                  {publicProfile.claimedAchievementsCount}/{publicProfile.totalAchievementsCount}
                </div>
              </div>
              <div className="pixel-slot p-2">
                <div className="text-[9px] text-[#047857] uppercase font-bold">Crop Mastery</div>
                <div className="font-mono-num font-bold text-[#047857]">
                  LVL {formatHudNumber(publicProfile.cropMasteryLevel)}
                </div>
              </div>
              <div className="pixel-slot p-2">
                <div className="text-[9px] text-[#0369a1] uppercase font-bold">Farmablock Mastery</div>
                <div className="font-mono-num font-bold text-[#0369a1]">
                  LVL {formatHudNumber(publicProfile.farmablockMasteryLevel)}
                </div>
              </div>
            </div>

            {publicProfile.ownedWorldName && (
              <div className="pixel-slot p-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="text-[9px] text-[#23476d] uppercase">Personal World</div>
                  <div className="font-bold text-[#92400e] truncate">
                    {publicProfile.ownedWorldName}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onJoinWorld(publicProfile.ownedWorldName!);
                    onDismissPublicProfile?.();
                  }}
                  className="pixel-btn pixel-btn-primary !py-1 !px-2.5 !text-[10px] shrink-0"
                >
                  Visit
                </button>
              </div>
            )}

            {publicProfile.playerId !== playerId &&
              !friends.some((f) => f.id === publicProfile.playerId) && (
                <button
                  type="button"
                  onClick={() => {
                    onFriendAction('send_request', publicProfile.playerName);
                  }}
                  className="pixel-btn pixel-btn-emerald w-full !py-1.5 !text-[10px]"
                >
                  Add Friend
                </button>
              )}
          </div>
        </div>
      )}

      {/* World Navigator Drawer */}
      {activePanel === 'worlds' && (
        <div className="pointer-events-auto fixed left-2 top-[98px] sm:top-[106px] z-20 w-[min(21rem,calc(100vw-1rem))] max-h-[calc(100dvh-12.5rem)] min-[740px]:max-h-[calc(100dvh-10.5rem)] overflow-y-auto pixel-box p-3 flex flex-col gap-2.5">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="ui-pixel-heading text-xs text-[#091e3a]">World Navigator</h2>
              <button
                type="button"
                title={isCurrentWorldFav ? 'Unfavorite current world' : 'Favorite current world'}
                onClick={() => onToggleFavoriteWorld(worldName)}
                className={`p-1 rounded-[7px] border cursor-pointer ${
                  isCurrentWorldFav
                    ? 'bg-[#fef3c7]/90 border-[#b45309] text-[#b45309]'
                    : 'bg-[#e3f1fd]/75 border-[#4172a3] text-[#23476d]'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
            >
              [X]
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
              className="hud-input flex-1 px-2.5 py-1.5 text-xs font-bold uppercase"
            />
            <button
              type="submit"
              className="pixel-btn pixel-btn-emerald !py-1.5 !px-3 !text-[10px]"
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
                className={`py-1 rounded-[8px] border-2 text-[11px] font-bold uppercase cursor-pointer ${
                  worldTab === t
                    ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
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
                  className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer"
                >
                  <span className="font-bold text-[#091e3a]">
                    {w.name} {w.publicAccess === false ? '🔒' : ''}
                  </span>
                  <span className="font-mono-num text-[#0369a1] font-bold">
                    {w.ownerName ? `${w.ownerName} · ` : ''}
                    {w.playerCount}/{w.ownerId ? 10 : 20}
                  </span>
                </button>
              ))}
            {worldTab === 'favorites' &&
              (favoriteWorlds.length === 0 ? (
                <span className="text-xs text-[#23476d] py-2">No favorite worlds saved yet.</span>
              ) : (
                favoriteWorlds.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onJoinWorld(name);
                      setActivePanel('none');
                    }}
                    className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer"
                  >
                    <span className="font-bold text-[#92400e]">★ {name}</span>
                    <span className="text-[11px] text-[#0369a1] font-bold">Visit</span>
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
                  className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer"
                >
                  <span className="font-bold text-[#091e3a]">{name}</span>
                  <span className="text-[11px] text-[#0369a1] font-bold">Revisit</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* World Chat Drawer (anchored below Top-Left World Chat button) */}
      {activePanel === 'chat' && (
        <div className="pointer-events-auto fixed left-2 top-[98px] sm:top-[106px] z-20 w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100dvh-12.5rem)] min-[740px]:max-h-[calc(100dvh-10.5rem)] pixel-box p-2.5 flex flex-col gap-2">
          <div className="pixel-box-header -mx-2.5 -mt-2.5 px-2.5 py-1.5 flex items-center justify-between">
            <span className="ui-pixel-heading text-[10px] text-[#091e3a]">World Chat · {worldName}</span>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[10px] font-pixel text-[#23476d] hover:text-[#091e3a] cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="h-32 overflow-y-auto flex flex-col gap-1 text-xs pr-1">
            {chatMessages.map((m) => (
              <div key={m.id} className={m.system ? 'text-[#92400e] font-semibold' : 'text-[#091e3a]'}>
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
              className="hud-input flex-1 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="pixel-btn pixel-btn-primary !py-1 !px-2.5 !text-[10px]"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Global World Lock Exchange Drawer */}
      {activePanel === 'exchange' && (
        <div className="pointer-events-auto fixed inset-x-2 top-2 bottom-2 md:inset-x-auto md:top-10 md:bottom-auto md:right-3 md:w-[min(680px,94vw)] md:h-[min(84dvh,620px)] z-30 pixel-box p-3 flex flex-col overflow-hidden">
          <ExchangeModal
            playerId={playerId}
            gems={gems}
            inventory={inventory}
            unclaimedWl={unclaimedWl}
            exchange={exchange}
            onRefresh={() => onExchangeAction({ action: 'list' })}
            onPostListing={(opts) => onExchangeAction({ action: 'post', ...opts })}
            onBuyListing={(listingId) => onExchangeAction({ action: 'buy', listingId })}
            onCancelListing={(listingId) => onExchangeAction({ action: 'cancel', listingId })}
            onClaimWl={() => onExchangeAction({ action: 'claim_wl' })}
            onClose={() => setActivePanel('none')}
          />
        </div>
      )}

      {/* In-World Administrator Dev Config & System World Modifier Panel */}
      {activePanel === 'admin' && role === 'admin' && (
        <div className="pointer-events-auto fixed inset-x-1.5 top-2 bottom-2 md:inset-x-auto md:top-10 md:bottom-auto md:right-3 md:w-[min(480px,94vw)] md:h-[min(88dvh,780px)] z-30 pixel-box p-2.5 sm:p-3 flex flex-col overflow-hidden">
          <AdminPanel
            gameConfig={gameConfig}
            inWorld={true}
            worldName={worldName}
            coords={coords}
            adminWorldEdit={adminWorldEdit}
            adminBrushItemId={adminBrushItemId}
            onToggleAdminWorldEdit={onToggleAdminWorldEdit}
            onSaveConfig={onUpdateGameConfig}
            onAdminAction={onAdminAction}
            onClose={() => setActivePanel('none')}
          />
        </div>
      )}

      {/* Game Menu Modal (houses Panel View, Admin/SysEdit, Friends, Realms, Settings) */}
      {mode === 'paused' && (
        <div
          data-testid="game-menu-view"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#091e3a]/45 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4"
        >
          <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto pixel-wood-box p-3.5 sm:p-4 flex flex-col gap-3">
            <div className="pixel-wood-header -mx-3.5 sm:-mx-4 -mt-3.5 sm:-mt-4 px-3.5 sm:px-4 py-2.5 flex items-center justify-between">
              <h2 className="ui-pixel-heading text-sm text-[#091e3a]">Game Menu</h2>
              <span className="inline-flex items-center gap-1 text-xs font-mono-num font-bold text-[#091e3a]">
                <span>LVL {formatHudNumber(level)} ·</span>
                <RedGemIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{formatHudNumber(gems)}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={onResume}
              className="pixel-btn pixel-btn-emerald w-full !py-2 !text-xs"
            >
              Resume World
            </button>

            {/* Quick Access Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="menu-profile-button"
                onClick={() => {
                  onResume();
                  setActivePanel('profile');
                }}
                className="pixel-btn pixel-btn-wood flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
              >
                <Wallet className="w-4 h-4 text-[#091e3a] shrink-0" />
                <span>Profile &amp; Wallet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('friends');
                }}
                className="pixel-btn pixel-btn-wood relative flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
              >
                <Users className="w-4 h-4 text-[#0369a1] shrink-0" />
                <span>Friends</span>
                {incomingRequests.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-[5px] bg-[#dc2626] border border-white text-[10px] font-mono-num text-white">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Admin Controls (moved inside Menu) */}
            {role === 'admin' && (
              <div className="grid grid-cols-2 gap-2 border-t-2 border-[#4172a3]/35 pt-2.5">
                <button
                  type="button"
                  data-testid="menu-admin-panel-button"
                  aria-label="Admin Dev Panel"
                  onClick={() => {
                    onResume();
                    setActivePanel('admin');
                  }}
                  className="pixel-btn pixel-btn-gold flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
                >
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Admin Panel</span>
                </button>
                <button
                  type="button"
                  data-testid="menu-sysedit-button"
                  onClick={() => {
                    onToggleAdminWorldEdit?.(!adminWorldEdit);
                    onResume();
                  }}
                  className={`pixel-btn flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px] ${
                    adminWorldEdit ? 'pixel-btn-emerald' : 'pixel-btn-wood'
                  }`}
                >
                  <Paintbrush className="w-4 h-4 shrink-0" />
                  <span>SysEdit: {adminWorldEdit ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )}

            {/* Settings & Panel View Toggles */}
            <div className="grid grid-cols-2 gap-2 border-t-2 border-[#4172a3]/35 pt-2.5">
              <button
                type="button"
                data-testid="menu-panel-view-button"
                onClick={() => setShowPanelView((v) => !v)}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-[8px] border-2 text-xs font-bold cursor-pointer ${
                  showPanelView
                    ? 'bg-white/85 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Panel View: {showPanelView ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleTouch}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-[8px] border-2 text-xs font-bold cursor-pointer ${
                  touchEnabled
                    ? 'bg-white/85 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Touch Pad: {touchEnabled ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-[8px] border-2 text-xs font-bold cursor-pointer ${
                  muted
                    ? 'bg-[#fee2e2]/90 border-[#dc2626] text-[#991b1b]'
                    : 'bg-white/85 border-[#0284c7] text-[#091e3a]'
                }`}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>Audio: {muted ? 'MUTED' : 'ON'}</span>
              </button>
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-[8px] border-2 text-xs font-bold cursor-pointer ${
                  isFullscreen
                    ? 'bg-white/85 border-[#0284c7] text-[#091e3a]'
                    : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d]'
                }`}
                aria-label="Toggle fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Fullscreen: {isFullscreen ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Hub & Sign Out */}
            <div className="grid grid-cols-2 gap-2 border-t-2 border-[#4172a3]/35 pt-2.5">
              <button
                type="button"
                onClick={onReturnToHub}
                className="pixel-btn pixel-btn-wood !py-2 !text-[10px]"
              >
                Return to World Hub
              </button>
              <button
                type="button"
                onClick={onLeaveWorld}
                className="pixel-btn pixel-btn-danger !py-2 !text-[10px]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
