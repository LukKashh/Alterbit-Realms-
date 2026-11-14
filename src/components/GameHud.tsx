import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  BookOpen,
  ChevronLeft,
  Globe,
  Lock,
  Maximize2,
  Menu,
  MessageSquare,
  Paintbrush,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Timer,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  FARMABLE_SPECS,
  GEM_STORE_LISTINGS,
  getItemDef,
  getMatteragenBranch,
  getMatteragenIntervalMs,
  ITEM_IDS,
  MATTERAGEN_UPGRADE_COSTS,
  type FarmableBranch,
  type PlayerStatKey,
  type StoreSection,
} from '../game/catalog.ts';
import { getItemIconUrl, type EquippedWearables } from '../game/pixelArt.ts';
import { xpForNextLevel } from '../game/rules.ts';
import type {
  ActiveBuff,
  ChatMessage,
  ExchangeSnapshot,
  FriendEntry,
  FriendRequestEntry,
  InventorySlot,
  UserRole,
  WorldSummary,
} from '../game/network.ts';
import type { GameConfig } from '../game/config.ts';
import type { TileInspectInfo } from '../game/engine.ts';
import { AdminPanel, type AdminActionPayload } from './AdminPanel.tsx';
import { ExchangeModal } from './ExchangeModal.tsx';
import { AtmPanel, BfgPanel, FurnacePanel, VaultboxPanel } from './MachinePanels.tsx';

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
      className={`relative w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-2xl border-2 flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing shadow-[0_4px_0_rgba(6,12,20,0.85)] transition-colors ${
        active
          ? 'bg-[#2a1512]/90 border-[#ffb89e]'
          : 'bg-[#0f1d2c]/88 border-[#e0896b]/85'
      }`}
    >
      {/* Directional ring crosshair guides */}
      <div className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-[#e0896b]/35" />
      <span className="pointer-events-none absolute top-1 text-[8px] font-bold text-[#ffb89e]/70 leading-none">▲</span>
      <span className="pointer-events-none absolute bottom-1 text-[8px] font-bold text-[#ffb89e]/70 leading-none">▼</span>
      <span className="pointer-events-none absolute left-1.5 text-[8px] font-bold text-[#ffb89e]/70 leading-none">◀</span>
      <span className="pointer-events-none absolute right-1.5 text-[8px] font-bold text-[#ffb89e]/70 leading-none">▶</span>

      {/* Movable thumb knob */}
      <div
        ref={knobElRef}
        className={`pointer-events-none w-8 h-8 sm:w-10 sm:h-10 rounded-xl border-2 flex flex-col items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.7)] will-change-transform ${
          active
            ? 'bg-[#c95738] border-[#ffe3d6]'
            : 'bg-[#94422c] border-[#e89d82]'
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
  onConfigureVaultbox,
}) => {
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [worldInput, setWorldInput] = useState('');
  const [newWorldName, setNewWorldName] = useState('');
  const [useTerraBlast, setUseTerraBlast] = useState(false);
  const [worldTab, setWorldTab] = useState<'public' | 'favorites' | 'recent'>('public');
  const [chatInput, setChatInput] = useState('');
  const [bagFilter, setBagFilter] = useState<'all' | 'farmable' | 'seed' | 'block'>('all');
  const [assignSlot, setAssignSlot] = useState<number>(2);
  const [storeCategory, setStoreCategory] = useState<StoreSection>('seeds');
  const [profileTab, setProfileTab] = useState<'achievements' | 'wardrobe'>('achievements');
  const [menuTab, setMenuTab] = useState<'menu' | 'seediary'>('menu');
  const [seediaryQuery, setSeediaryQuery] = useState('');
  const [seediaryBranch, setSeediaryBranch] = useState<'all' | FarmableBranch>('all');
  void _onSpliceSeeds;
  const [friendInput, setFriendInput] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (mode !== 'paused') {
      setMenuTab('menu');
    }
  }, [mode]);

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
  }, [inspectInfo]);

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
  const filteredFarmables = useMemo(() => {
    const q = seediaryQuery.trim().toLowerCase();
    return FARMABLE_SPECS.filter((spec) => {
      if (seediaryBranch !== 'all' && spec.branch !== seediaryBranch) return false;
      if (!q) return true;
      const seedName = getItemDef(spec.seedId)?.name.toLowerCase() ?? '';
      return (
        spec.name.toLowerCase().includes(q) ||
        seedName.includes(q) ||
        spec.branch.includes(q) ||
        spec.description.toLowerCase().includes(q) ||
        `t${spec.tier}`.includes(q) ||
        `tier ${spec.tier}`.includes(q)
      );
    });
  }, [seediaryBranch, seediaryQuery]);
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

  const activeLock = inspectInfo?.shareLock ?? null;
  const isLockOwner = activeLock?.ownerId === playerId;
  const myRealms = worlds.filter((world) => world.ownerId === playerId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-1.5 sm:p-2.5">
      {/* Top Perimeter Bar (Responsive status + World Chat below top-left + Menu button) */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        {/* Top-left Column: Panel View (Profile, Gem Store, World) + World Chat / Admin SysEdit */}
        <div className="flex flex-col items-start gap-1.5 min-w-0 max-w-[calc(100vw-5.75rem)] sm:max-w-[calc(100vw-7.5rem)]">
          <div className="pointer-events-auto pixel-box flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 sm:px-2 sm:py-1 max-w-full overflow-hidden">
            {/* Profile Trigger (Identity, Level & XP) */}
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
              className={`relative flex flex-col text-left min-w-0 px-1.5 py-0.5 border transition-colors cursor-pointer ${
                activePanel === 'profile'
                  ? 'bg-[#1c354f] border-[#f2b738]'
                  : 'border-transparent hover:bg-[#1e324a]'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-[#f7f4eb] ui-text-shadow whitespace-nowrap truncate max-w-[74px] sm:max-w-none">
                  {playerName}
                </span>
                <span className="text-[10px] sm:text-[11px] font-mono-num font-bold text-[#89d6ff] whitespace-nowrap">
                  LVL {level}
                </span>
                {claimableCount > 0 && (
                  <span
                    aria-label={`${claimableCount} claimable achievements`}
                    className="w-3.5 h-3.5 bg-[#10b981] border border-[#064e3b] text-[9px] font-mono-num font-bold text-[#ecfdf5] flex items-center justify-center shrink-0"
                  >
                    {claimableCount}
                  </span>
                )}
              </div>
              <div className="w-14 sm:w-24 h-1.5 bg-[#03060a] border border-[#1c2b3d] overflow-hidden mt-0.5">
                <div
                  className="h-full bg-[#4ec46a] transition-[width] duration-150"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </button>

            <div className="h-6 w-0.5 bg-[#090e17] shrink-0" />

            {/* Gem Store Trigger */}
            <button
              type="button"
              tabIndex={-1}
              data-testid="hud-gemstore-button"
              aria-label={`Gem Store (${Math.round(gems)} Gems)`}
              aria-expanded={activePanel === 'store'}
              onClick={(e) => {
                e.currentTarget.blur();
                togglePanel('store');
              }}
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 border transition-colors shrink-0 cursor-pointer ${
                activePanel === 'store'
                  ? 'bg-[#143647] border-[#38e8d8]'
                  : 'border-transparent hover:bg-[#1e324a]'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true">
                <polygon points="12,2 21,9 12,22 3,9" fill="#38e8d8" stroke="#0b2430" strokeWidth="2" />
                <polygon points="12,4 17,9 12,18 7,9" fill="#a8fff7" />
              </svg>
              <span className="text-[11px] sm:text-xs font-mono-num font-bold text-[#8cf7ee] ui-text-shadow">{Math.round(gems)}</span>
            </button>

            <div className="h-6 w-0.5 bg-[#090e17] shrink-0" />

            {/* Active World Status */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1.5 py-0.5 text-[11px] sm:text-xs font-bold text-[#ffe18c] ui-text-shadow whitespace-nowrap truncate">
              {worldOwner ? <Lock className="w-3 h-3 text-[#f2b738] shrink-0" /> : <Globe className="w-3 h-3 text-[#78c8f5] shrink-0" />}
              <span className="truncate max-w-[64px] sm:max-w-none">{worldName}</span>
              <span className="hidden sm:inline text-[11px] font-mono-num text-[#b5cde3]">({playerCount}/{worldOwner ? 10 : 20})</span>
            </div>

            <span className="hidden md:inline text-[11px] font-mono-num text-[#8aa4bd] whitespace-nowrap pr-1">
              {coords.tx},{coords.ty}
            </span>
          </div>

          {/* World Chat + Admin SysEdit Controls positioned cleanly below Top-Left Panel */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
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
              className={`pixel-btn !h-7 sm:!h-8 !px-2.5 gap-1.5 !text-[10px] sm:!text-[11px] ${
                activePanel === 'chat'
                  ? 'pixel-btn-primary'
                  : 'bg-[#111c2b] border-[#090e17] text-[#c7d9eb] shadow-[inset_1px_1px_0_#334e68,0_2px_0_#060a10] hover:brightness-110'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#89d6ff] shrink-0" />
              <span>Chat</span>
            </button>

            {role === 'admin' && (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-sysedit-button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onToggleAdminWorldEdit?.(
                      !adminWorldEdit,
                      !adminWorldEdit ? (adminBrushItemId ?? ITEM_IDS.GP_DIRT) : null
                    );
                  }}
                  className={`pixel-btn !h-7 sm:!h-8 !px-2 gap-1 !text-[10px] ${
                    adminWorldEdit
                      ? 'pixel-btn-emerald'
                      : 'pixel-btn-wood'
                  }`}
                >
                  <Paintbrush className="w-3 h-3 shrink-0" />
                  <span>SysEdit: {adminWorldEdit ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="hud-admin-panel-button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    togglePanel('admin');
                  }}
                  className={`pixel-btn !h-7 sm:!h-8 !px-2 gap-1 !text-[10px] ${
                    activePanel === 'admin'
                      ? 'pixel-btn-gold'
                      : 'pixel-btn-wood'
                  }`}
                >
                  <Shield className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Top-right: Mine Shaft Exit / Status + Single Menu Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {worldKind === 'mine_shaft' && (
            <button
              type="button"
              data-testid="leave-mine-button"
              onClick={onExitMineShaft}
              className="h-9 sm:h-10 px-2.5 rounded-md bg-[#332210]/95 hover:bg-[#4a3117] border-2 border-[#f2b738] text-[#ffe18c] flex items-center gap-1.5 font-mono-num font-bold text-xs shadow-[0_3px_0_rgba(6,12,20,0.8)] cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5 shrink-0" />
              <span>{mineTimerText ?? 'Mine'}</span>
              <span className="text-[10px] uppercase text-[#fff3cf]">Exit</span>
            </button>
          )}
          {!connected && (
            <button
              type="button"
              onClick={onReconnectNow}
              className="px-2.5 py-1 rounded bg-[#3b181b] hover:bg-[#542227] border border-[#80333a] text-[11px] font-bold text-[#ffb0b0] cursor-pointer whitespace-nowrap"
            >
              Reconnecting · Retry
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            data-testid="hud-menu-button"
            aria-label="Menu"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="pixel-btn pixel-btn-wood relative !h-9 sm:!h-10 !px-2.5 sm:!px-3.5 gap-1.5 sm:gap-2 !text-xs"
          >
            <Menu className="w-4 h-4 text-[#ffe18c]" />
            <span>Menu</span>
            {incomingRequests.length > 0 && (
              <span className="w-4 h-4 bg-[#ef4444] border border-[#7f1d1d] text-[9px] font-mono-num font-bold text-white flex items-center justify-center">
                {incomingRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active Timed Culinary Buffs + Fishing Reel CTA + Toast + Inspector */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {liveBuffs.length > 0 && (
          <div className="pixel-box flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1 text-[10px] font-mono-num text-[#8cf7ee]">
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
            {fishingBiting && <span className="block h-1.5 w-full mt-1 bg-[#09131d] overflow-hidden"><span className="block h-full bg-[#4ec46a] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, fishingProgress))}%` }} /></span>}
            {fishingBiting && <span className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono-num"><span className="uppercase tracking-wide">{fishingFightPattern.replace('_', ' ')} fight</span><span className={fishingLineTension > 0.82 ? 'text-[#ff6255]' : fishingLineTension < 0.38 ? 'text-[#77e7ff]' : 'text-[#ffe18c]'}>LINE TENSION {Math.round(fishingLineTension * 100)}%</span></span>}
          </button>
        )}

        {toastMessage && (
          <div className="pixel-wood-box text-[#fef3c7] ui-text-shadow text-xs font-bold px-3.5 py-1.5 border-[#eab308]">
            {toastMessage}
          </div>
        )}
        {inspectInfo && (
          <div className="pointer-events-auto pixel-box p-3 w-80 max-w-[92vw] max-h-[calc(100dvh-12rem)] overflow-y-auto text-xs flex flex-col gap-2">
            <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between gap-4">
              <span className="ui-pixel-heading text-[11px] text-[#89d6ff] truncate">
                {inspectInfo.fgName} ({inspectInfo.tx}, {inspectInfo.ty})
              </span>
              <button
                type="button"
                onClick={onDismissInspect}
                className="text-[11px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
              >
                [X]
              </button>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] text-[#c7d9eb]">
              <span>Background: {inspectInfo.bgName}</span>
              {inspectInfo.plantInfo && <span>Tree: {inspectInfo.plantInfo}</span>}
              {inspectInfo.lockInfo && <span className="text-[#ffe18c] font-semibold">{inspectInfo.lockInfo}</span>}
            </div>

            {/* Share Lock Permissions Panel */}
            {activeLock && (
              <div className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#8cf7ee]">
                    {getItemDef(activeLock.itemId)?.name ?? 'Share Lock'} · {activeLock.width}×{activeLock.height}
                  </span>
                  <span className="text-[10px] text-[#89d6ff]">Owner: {activeLock.ownerName}</span>
                </div>
                <p className="text-[10px] text-[#9cb5cc]">Access is limited to this claimed rectangle. Permissions can be changed independently.</p>
                <div className="flex flex-col gap-1">
                  {Object.entries(activeLock.access ?? {}).length === 0 ? (
                    <span className="text-[11px] text-[#6d8ba8]">No players have been granted access.</span>
                  ) : Object.entries(activeLock.access ?? {}).map(([targetId, grant]) => (
                    <div key={targetId} className="pixel-slot p-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#eaf2fa]">{grant.playerName}</span>
                        {isLockOwner && <button type="button" onClick={() => onConfigureLock(inspectInfo.tx, inspectInfo.ty, { removeEditorId: targetId })} className="text-[#ff9b9b] font-bold cursor-pointer">Revoke</button>}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['build', 'break', 'interact'] as const).map((permission) => (
                          <button key={permission} type="button" disabled={!isLockOwner}
                            onClick={() => onConfigureLock(inspectInfo.tx, inspectInfo.ty, { permissionTargetId: targetId, permissions: { [permission]: !grant.permissions[permission] } })}
                            className={`px-1 py-1 border-2 text-[10px] font-bold capitalize ${grant.permissions[permission] ? 'bg-[#174a37] border-[#4ec46a] text-[#b7ffd7]' : 'bg-[#3b1b1f] border-[#80333a] text-[#ffb0b0]'} ${isLockOwner ? 'cursor-pointer' : 'cursor-default'}`}>
                            {permission}: {grant.permissions[permission] ? 'On' : 'Off'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {isLockOwner && (
                  <form onSubmit={(e) => { e.preventDefault(); if (editorInput.trim()) { onConfigureLock(inspectInfo.tx, inspectInfo.ty, { addEditorName: editorInput.trim() }); setEditorInput(''); } }} className="flex gap-1.5">
                    <input type="text" value={editorInput} onChange={(e) => setEditorInput(e.target.value)} placeholder="Grant access by username..." className="flex-1 min-w-0 px-2 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-xs text-white focus:outline-none focus:border-[#38e8d8]" />
                    <button type="submit" className="pixel-btn pixel-btn-emerald !px-2.5 !py-1 !text-[10px]">Grant</button>
                  </form>
                )}
              </div>
            )}

            {/* Nexus Landlord: personal realm management */}
            {inspectInfo.isLandlord && worldName === 'NEXUS' && (
              <div className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
                <div>
                  <h3 className="font-pixel text-[11px] text-[#ffe18c]">LANDLORD · REALM STEWARD</h3>
                  <p className="text-[11px] text-[#9cb5cc]">Each player can conjure one personal 30×50 sanctuary realm locked to their account.</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#8cf7ee]">My Realm ({myRealms.length}/1)</span>
                  <button type="button" onClick={onRefreshWorlds} className="text-[10px] text-[#89d6ff] font-bold cursor-pointer">Refresh</button>
                </div>
                {myRealms.length === 0 ? (
                  <span className="text-[11px] text-[#6d8ba8]">You have not created your personal realm yet.</span>
                ) : myRealms.map((realm) => (
                  <button key={realm.name} type="button" onClick={() => onJoinWorld(realm.name)}
                    className="pixel-slot flex items-center justify-between p-2 text-left cursor-pointer hover:border-[#38e8d8]">
                    <span className="font-bold text-[#f7f4eb]">{realm.name}</span>
                    <span className="text-[10px] text-[#8cf7ee] font-mono-num">{realm.playerCount}/10 · Enter</span>
                  </button>
                ))}
                {myRealms.length === 0 && (
                  <form onSubmit={(e) => { e.preventDefault(); if (newWorldName.trim()) { onCreateWorld(newWorldName.trim(), useTerraBlast); setNewWorldName(''); setUseTerraBlast(false); } }}
                    className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#ffe18c]">Conjure Personal Realm (30×50)</label>
                    <input value={newWorldName} onChange={(e) => setNewWorldName(e.target.value.toUpperCase())}
                      maxLength={20} placeholder="Choose a unique realm name"
                      className="w-full px-2 py-1.5 bg-[#05080f] border-2 border-[#1c2b3d] text-xs text-white uppercase focus:outline-none focus:border-[#38e8d8]" />
                    {getQty(ITEM_IDS.WORLD_BLAST) > 0 && (
                      <label className="flex items-center gap-2 text-[11px] text-[#d8c3ff]">
                        <input type="checkbox" checked={useTerraBlast} onChange={(e) => setUseTerraBlast(e.target.checked)} />
                        Use World Blast · {getQty(ITEM_IDS.WORLD_BLAST)} available
                      </label>
                    )}
                    <button type="submit" disabled={!newWorldName.trim() || (useTerraBlast && getQty(ITEM_IDS.WORLD_BLAST) < 1)}
                      className="pixel-btn pixel-btn-emerald w-full disabled:opacity-40 !text-[10px]">
                      Create Private Realm
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* WorldCore: owner-only realm manager */}
            {inspectInfo.isWorldCore && inspectInfo.worldLock && (
              <div className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
                {inspectInfo.worldLock.ownerId === playerId ? (
                  <>
                    <h3 className="font-pixel text-[11px] text-[#ffe18c]">WORLD MANAGER PANEL</h3>
                    <p className="text-[11px] text-[#9cb5cc]">You own {worldName}. WorldCore hard-locks this entire realm to your account.</p>
                    <div className="pixel-slot p-2 text-[11px] text-[#d5e4f2]">
                      <div>Owner: {inspectInfo.worldLock.ownerName}</div>
                      <div>Players: {playerCount}/10</div>
                      <div>Access: Hard-Locked · Share Locks grant area access</div>
                    </div>
                    <span className="text-[10px] text-[#6d8ba8]">Share Lock permissions are managed by inspecting each Share Lock.</span>
                  </>
                ) : (
                  <span className="text-[11px] text-[#ffcf8b]">Only this realm's owner can access its Manager Panel.</span>
                )}
              </div>
            )}

            {/* Personal Vending Machine Panel */}
            {inspectInfo.vendingMachine && (
              <div className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#38e8d8]">Vending Shop</span>
                  <span className="text-[11px] text-[#9cb5cc]">
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
                      className="pixel-btn pixel-btn-emerald !px-2.5 !py-1 !text-[10px]"
                    >
                      Buy 1
                    </button>
                  </div>
                ) : (
                  <div className="pixel-slot text-[11px] text-[#8aa4bd] p-2">
                    This Vending Machine is currently out of stock.
                  </div>
                )}

                {inspectInfo.vendingMachine.ownerId === playerId && (
                  <div className="flex flex-col gap-1.5 border-t-2 border-[#1c2b3d] pt-2">
                    <span className="text-[11px] font-bold text-[#ffe18c]">Owner Management</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={vmItemId}
                        onChange={(e) => setVmItemId(Number(e.target.value))}
                        className="px-1.5 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-[11px] text-white"
                      >
                        {tradeablesInBag.map((s, idx) => (
                          <option key={s.rodInstanceId ?? `${s.itemId}-${idx}`} value={s.itemId}>
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
                        className="px-2 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-[11px] text-white font-mono-num"
                      />
                      <select
                        value={vmPriceItemId}
                        onChange={(e) => setVmPriceItemId(Number(e.target.value))}
                        className="px-1.5 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-[11px] text-white"
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
                        className="px-2 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-[11px] text-white font-mono-num"
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
                className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-1.5"
              >
                <span className="text-[11px] font-bold text-[#ffe18c]">Signboard Message</span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={80}
                    value={signDraft}
                    onChange={(e) => setSignDraft(e.target.value)}
                    placeholder="Write message on sign..."
                    className="flex-1 px-2 py-1 bg-[#05080f] border-2 border-[#1c2b3d] text-xs text-white focus:outline-none focus:border-[#38e8d8]"
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
                onRepair={(toolItemId) =>
                  onConfigureFurnace(inspectInfo.tx, inspectInfo.ty, {
                    action: 'repair',
                    toolItemId,
                  })
                }
              />
            )}

            {/* BFG Auto-Collector Panel */}
            {inspectInfo.bfgCollector && (
              <BfgPanel
                bfg={inspectInfo.bfgCollector}
                canManage={
                  inspectInfo.bfgCollector.ownerId === playerId ||
                  inspectInfo.worldLock?.ownerId === playerId
                }
                onToggle={() =>
                  onConfigureBfg(inspectInfo.tx, inspectInfo.ty, { action: 'toggle' })
                }
                onWithdraw={() =>
                  onConfigureBfg(inspectInfo.tx, inspectInfo.ty, { action: 'withdraw' })
                }
              />
            )}

            {/* Matteragen Engine Panel */}
            {inspectInfo.matteragenEngine && (() => {
              const eng = inspectInfo.matteragenEngine;
              const engDef = getItemDef(eng.typeId);
              const branch = getMatteragenBranch(eng.typeId);
              const intervalMs = getMatteragenIntervalMs(eng.typeId);
              const elapsedMs = Math.max(0, nowMs - (eng.lastHarvestMs || eng.placedAtMs || nowMs));
              const remSec = Math.max(0, Math.ceil((intervalMs - elapsedMs) / 1000));
              const remMin = Math.floor(remSec / 60);
              const remS = remSec % 60;
              const pct = Math.min(100, Math.round((elapsedMs / Math.max(1, intervalMs)) * 100));
              const nextCost = MATTERAGEN_UPGRADE_COSTS[eng.level];
              return (
                <div
                  data-testid="matteragen-panel"
                  className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[10px] text-[#38e8d8]">
                      {engDef?.name ?? 'Matteragen Engine'}
                    </span>
                    <span className="px-1.5 py-0.5 bg-[#090e17] border border-[#facc15] text-[10px] font-mono-num font-bold text-[#fde047]">
                      LV. {eng.level} / 5
                    </span>
                  </div>
                  <div className="text-[10px] text-[#9cb5cc]">
                    Branch: <span className="uppercase font-bold text-[#e0f2fe]">{branch}</span> · Generates random {branch} farmables
                  </div>
                  {eng.isReady ? (
                    <div className="bg-[#064e3b] border-2 border-[#10b981] p-2 flex flex-col gap-1">
                      <span className="font-pixel text-[10px] text-[#a7f3d0]">
                        READY! PUNCH ENGINE TO COLLECT!
                      </span>
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-mono-num text-white">
                        {(eng.storedDrops ?? []).map((d, idx) => (
                          <span key={idx} className="bg-[#022c22] px-1.5 py-0.5 border border-[#059669]">
                            {d.count}× {getItemDef(d.itemId)?.name ?? `#${d.itemId}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#090e17] border border-[#1c2b3d] p-2 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#9cb5cc]">Synthesis Progress</span>
                        <span className="font-mono-num font-bold text-[#38bdf8]">
                          {remMin}m {String(remS).padStart(2, '0')}s
                        </span>
                      </div>
                      <div className="h-2 bg-[#03060a] border border-[#1c2b3d] overflow-hidden">
                        <div className="h-full bg-[#38bdf8] transition-[width]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {eng.level < 5 && nextCost && (
                    <button
                      type="button"
                      disabled={gems < nextCost}
                      onClick={() => onUpgradeMatteragen?.(inspectInfo.tx, inspectInfo.ty)}
                      className="pixel-btn pixel-btn-gold w-full disabled:opacity-45 !text-[10px]"
                    >
                      Upgrade to LV. {eng.level + 1} ({nextCost} Gems)
                    </button>
                  )}
                  {eng.level >= 5 && (
                    <span className="text-center font-pixel text-[9px] text-[#fde047]">
                      MAX LEVEL 5 ACHIEVED
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
              <div className="border-t-2 border-[#1c2b3d] pt-2 flex flex-col gap-1.5">
                <span className="text-[11px] text-[#9cb5cc]">
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
        {/* Center Hotbar (top row in portrait, middle in landscape) */}
        <div className="pointer-events-auto order-1 min-[740px]:order-2 flex flex-col items-center gap-1 self-center max-w-full">
          {(selectedDef || (role === 'admin' && adminWorldEdit)) && (
            <div className="pixel-box text-[10px] sm:text-[11px] font-bold text-[#fef3c7] ui-text-shadow px-2.5 py-0.5 whitespace-nowrap max-w-[92vw] truncate">
              {selectedDef ? `${selectedDef.name} · ${selectedDef.category}` : 'System Edit Mode'}
              {role === 'admin' && adminWorldEdit && (
                <span className="text-[#8cf7ee] font-bold">
                  {' '}
                  · SysEdit ({adminBrushItemId ? (getItemDef(adminBrushItemId)?.name ?? 'Brush') : 'Erase'})
                </span>
              )}
            </div>
          )}
          <div
            data-testid="hud-hotbar"
            className="pixel-wood-box flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 max-w-full overflow-x-auto"
          >
            {hotbarItemIds.map((itemId, idx) => {
              const def = getItemDef(itemId);
              const invSlot = inventory.find((s) => s.itemId === itemId);
              const isExemptTool = itemId === ITEM_IDS.FIST || itemId === ITEM_IDS.WRENCH;
              const qty = isExemptTool ? null : getQty(itemId);
              const showItemLabel = itemId !== ITEM_IDS.AIR && !isExemptTool && Boolean(def?.name);
              const active = selectedItemId === itemId;
              const hasDurability = typeof invSlot?.maxDurability === 'number' && invSlot.maxDurability > 0;
              const durRatio = hasDurability
                ? Math.max(0, Math.min(1, (invSlot!.durability ?? invSlot!.maxDurability!) / invSlot!.maxDurability!))
                : 1;
              return (
                <button
                  key={`${idx}-${itemId}`}
                  type="button"
                  tabIndex={-1}
                  data-testid={`hotbar-slot-${idx + 1}`}
                  aria-label={`Slot ${idx + 1}: ${def?.name ?? 'Empty'}`}
                  title={def ? `${def.name}${qty !== null ? ` (${qty})` : ''}` : `Slot ${idx + 1}: Empty`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setAssignSlot(idx);
                    if (itemId !== ITEM_IDS.AIR) onSelectItem(itemId);
                  }}
                  className={`pixel-slot relative w-[46px] h-[54px] min-[480px]:w-14 min-[480px]:h-14 sm:w-[62px] sm:h-[60px] shrink-0 flex flex-col items-center justify-center touch-none select-none cursor-pointer transition-transform ${
                    active
                      ? '!bg-[#2a2210] !border-[#facc15] -translate-y-0.5 shadow-[0_0_12px_rgba(250,204,21,0.45)]'
                      : ''
                  }`}
                >
                  <span className="absolute top-0.5 left-1 text-[8px] sm:text-[9px] font-mono-num font-bold text-[#9cb5cc] leading-none">
                    {idx + 1}
                  </span>
                  {qty !== null && !hasDurability && (
                    <span className="absolute top-0.5 right-1 text-[8px] sm:text-[9px] font-mono-num font-bold text-[#fde047] ui-text-shadow leading-none">
                      {qty}
                    </span>
                  )}
                  {itemId !== ITEM_IDS.AIR && (
                    <img
                      src={getItemIconUrl(itemId)}
                      alt={def?.name ?? 'Item'}
                      className={`pixelated shrink-0 ${
                        showItemLabel ? 'w-5 h-5 sm:w-6 sm:h-6 mb-2.5' : 'w-6 h-6 sm:w-7 sm:h-7'
                      }`}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {showItemLabel && def && (
                    <span
                      data-testid={`hotbar-item-name-${idx + 1}`}
                      className={`absolute inset-x-0.5 ${
                        hasDurability ? 'bottom-1.5' : 'bottom-0.5'
                      } text-[7px] sm:text-[8px] font-bold text-[#fef3c7] truncate text-center leading-none`}
                    >
                      {def.name}
                    </span>
                  )}
                  {hasDurability && (
                    <div className="absolute inset-x-1 bottom-0.5 h-1 bg-[#03060a] overflow-hidden">
                      <div
                        className={`h-full ${
                          durRatio > 0.4 ? 'bg-[#4ec46a]' : durRatio > 0.15 ? 'bg-[#f2b738]' : 'bg-[#e6482e]'
                        }`}
                        style={{ width: `${Math.round(durRatio * 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
            <div className="h-8 sm:h-9 w-0.5 bg-[#140b06] mx-0.5 shrink-0" />
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
              className={`pixel-slot relative w-[46px] h-[54px] min-[480px]:w-14 min-[480px]:h-14 sm:w-[62px] sm:h-[60px] shrink-0 flex flex-col items-center justify-center gap-0.5 touch-none select-none cursor-pointer transition-transform ${
                activePanel === 'backpack'
                  ? '!bg-[#2a2210] !border-[#facc15] text-[#fde047] -translate-y-0.5'
                  : 'text-[#fef3c7]'
              }`}
            >
              <Backpack className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              <span className="text-[8px] font-pixel uppercase leading-none">Bag</span>
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
                  className="pixel-slot w-14 h-14 sm:w-[68px] sm:h-[68px] active:!bg-[#1b2e45] active:!border-[#38e8d8] text-white font-bold text-lg sm:text-xl flex items-center justify-center touch-none select-none cursor-pointer"
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
                  className="pixel-slot w-14 h-14 sm:w-[68px] sm:h-[68px] active:!bg-[#1b2e45] active:!border-[#38e8d8] text-white font-bold text-lg sm:text-xl flex items-center justify-center touch-none select-none cursor-pointer"
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
                  className="pixel-btn pixel-btn-emerald w-14 h-14 sm:w-[68px] sm:h-[68px] flex flex-col items-center justify-center gap-0.5 touch-none select-none"
                >
                  <span className="text-lg sm:text-xl leading-none">▲</span>
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-wider leading-none">Jump</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gem Store Drawer (anchored below Top-Left Panel View) */}
      {activePanel === 'store' && (
        <div className="pointer-events-auto fixed left-2 top-[54px] sm:top-[60px] z-20 w-[min(22rem,calc(100vw-1rem))] max-h-[calc(100dvh-10.5rem)] min-[740px]:max-h-[calc(100dvh-8.25rem)] pixel-box p-3 flex flex-col gap-2.5">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="ui-pixel-heading text-xs text-[#8cf7ee]">Gem Store</h2>
              <span className="text-xs font-mono-num font-bold text-[#fde047]">{Math.round(gems)} Gems</span>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
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
                className={`py-1.5 border-2 text-[10px] font-pixel uppercase cursor-pointer ${
                  storeCategory === cat
                    ? 'bg-[#153447] border-[#38e8d8] text-[#8cf7ee]'
                    : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc] hover:border-[#334e68]'
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
                      <div className="text-xs font-bold text-[#f7f4eb]">{listing.name}</div>
                      <div className="text-[10px] text-[#9cb5cc]">{listing.description}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyGemStore(listing.id)}
                    className="pixel-btn pixel-btn-primary disabled:opacity-40 !py-1.5 !px-2.5 !text-[10px] font-mono-num shrink-0"
                  >
                    {listing.gemPrice} G
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backpack Drawer (Inventory View Only — anchored cleanly above bottom Toolbar) */}
      {activePanel === 'backpack' && (
        <div
          data-testid="backpack-drawer"
          className="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-[142px] min-[740px]:bottom-[96px] z-20 w-[min(24rem,calc(100vw-1rem))] max-h-[calc(100dvh-12rem)] min-[740px]:max-h-[calc(100dvh-8.5rem)] pixel-wood-box p-3 flex flex-col gap-2"
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
                  className={`px-2 py-0.5 text-[10px] font-bold cursor-pointer border-2 ${
                    bagFilter === tab.id
                      ? 'bg-[#eab308] border-[#713f12] text-[#422006]'
                      : 'bg-[#1c1009] border-[#3e2414] text-[#fde68a] hover:border-[#945832]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#fde68a] hover:text-white cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[#fde68a] bg-[#140b06] border border-[#59351e] px-2 py-1">
            <span>Tap item to equip slot {assignSlot < 2 ? 3 : assignSlot + 1}.</span>
            <span className="flex items-center gap-1 text-[#86efac] font-semibold">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Seeds plant inside Seed Pots!</span>
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
                return (
                  <button
                    key={slot.rodInstanceId ?? `${slot.itemId}-${idx}`}
                    type="button"
                    title={`${def.name} (${slot.qty})${isFarmable ? ` · Tier ${def.farmableTier ?? 1} Farmable` : ''}`}
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
                    className={`relative h-16 rounded border-2 flex flex-col items-center justify-between p-1 cursor-pointer ${
                      isEquippedWearable
                        ? 'bg-[#2b4d34] border-[#82e068]'
                        : isSelected
                          ? 'bg-[#254463] border-[#f2b738]'
                          : isFarmable
                            ? 'bg-[#12261a] border-[#3d7a4f] hover:border-[#82e068]'
                            : 'bg-[#09131d] border-[#263c52] hover:border-[#4b7299]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full px-0.5">
                      {isFarmable ? (
                        <span className="text-[8px] font-mono-num font-bold text-[#fde047]">
                          T{def.farmableTier ?? 1}
                        </span>
                      ) : <span />}
                      {slot.itemId !== ITEM_IDS.FIST && slot.itemId !== ITEM_IDS.WRENCH && !hasDur && (
                        <span className="text-[9px] font-mono-num font-bold text-white">
                          {slot.qty}
                        </span>
                      )}
                    </div>
                    <img
                      src={getItemIconUrl(slot.itemId)}
                      alt={def.name}
                      className="w-6 h-6 pixelated my-0.5"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[8px] font-bold text-[#e2f0d9] truncate w-full text-center px-0.5 leading-tight">
                      {def.name}
                    </span>
                    {hasDur && (
                      <div className="absolute inset-x-1 bottom-1 h-1 bg-[#060d14] rounded-xs overflow-hidden">
                        <div
                          className={`h-full ${
                            durRatio > 0.4 ? 'bg-[#4ec46a]' : durRatio > 0.15 ? 'bg-[#f2b738]' : 'bg-[#e6482e]'
                          }`}
                          style={{ width: `${Math.round(durRatio * 100)}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Friends & Social Drawer */}
      {activePanel === 'friends' && (
        <div className="pointer-events-auto fixed right-2 top-[54px] sm:top-[60px] z-20 w-[min(21rem,calc(100vw-1rem))] max-h-[calc(100dvh-10.5rem)] min-[740px]:max-h-[calc(100dvh-8.25rem)] pixel-box p-3 flex flex-col gap-2.5 overflow-y-auto">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <h2 className="ui-pixel-heading text-xs text-[#89d6ff]">Friends &amp; Social</h2>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
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
              className="flex-1 px-2.5 py-1.5 bg-[#05080e] border border-[#2d4863] text-xs text-white"
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
              <span className="text-[11px] font-bold text-[#ffe18c]">
                Friend Requests ({incomingRequests.length})
              </span>
              {incomingRequests.map((req) => (
                <div
                  key={req.fromId}
                  className="flex items-center justify-between bg-[#142538] border border-[#3a597a] px-2.5 py-1.5 text-xs"
                >
                  <span className="font-bold text-white">{req.fromName}</span>
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
            <span className="text-[11px] font-bold text-[#9cb5cc]">Friends ({friends.length})</span>
            {friends.length === 0 ? (
              <p className="text-xs text-[#6d8ba8]">
                No friends added yet. Meet players in worlds and send them a request!
              </p>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs"
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
                        className="pixel-btn pixel-btn-primary !py-1 !px-2 !text-[10px]"
                      >
                        Visit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onFriendAction('remove', f.id)}
                      className="px-1.5 py-1 bg-[#1b2c3d] text-[#9cb5cc] hover:text-[#ff9b9b] text-[11px] cursor-pointer"
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

      {/* Profile, Wardrobe & Achievements Drawer (anchored below Top-Left Panel View) */}
      {activePanel === 'profile' && (
        <div className="pointer-events-auto fixed left-2 top-[54px] sm:top-[60px] z-20 w-[min(22rem,calc(100vw-1rem))] max-h-[calc(100dvh-10.5rem)] min-[740px]:max-h-[calc(100dvh-8.25rem)] pixel-box p-3 flex flex-col gap-2.5">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <div>
              <h2 className="ui-pixel-heading text-xs text-[#ffe18c]">
                {playerName} · LVL {level}
              </h2>
              <p className="text-[11px] font-mono-num text-[#89d6ff]">
                XP: {xp} / {nextXp} · Achievements: {claimedAchievements.length}/{ACHIEVEMENTS.length}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setProfileTab('achievements')}
              className={`py-1 border-2 text-xs font-bold cursor-pointer ${
                profileTab === 'achievements'
                  ? 'bg-[#254463] border-[#facc15] text-[#fef08a]'
                  : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc]'
              }`}
            >
              Achievements
            </button>
            <button
              type="button"
              onClick={() => setProfileTab('wardrobe')}
              className={`py-1 border-2 text-xs font-bold cursor-pointer ${
                profileTab === 'wardrobe'
                  ? 'bg-[#254463] border-[#facc15] text-[#fef08a]'
                  : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc]'
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
                    className="pixel-slot flex items-center justify-between gap-2 p-2"
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
                      <span className="px-2 py-1 bg-[#182c42] text-[10px] font-bold text-[#82e068]">
                        Claimed
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onClaimAchievement(ach.id)}
                        className="pixel-btn pixel-btn-emerald disabled:opacity-40 !py-1.5 !px-2.5 !text-[10px]"
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
                          <div className="text-xs font-bold text-[#f7f4eb]">{def.name}</div>
                          <div className="text-[10px] text-[#89d6ff] uppercase">
                            Slot: {def.wearableSlot ?? 'head'}
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
      )}

      {/* World Navigator Drawer */}
      {activePanel === 'worlds' && (
        <div className="pointer-events-auto fixed left-2 top-[54px] sm:top-[60px] z-20 w-[min(21rem,calc(100vw-1rem))] max-h-[calc(100dvh-10.5rem)] min-[740px]:max-h-[calc(100dvh-8.25rem)] overflow-y-auto pixel-box p-3 flex flex-col gap-2.5">
          <div className="pixel-box-header -mx-3 -mt-3 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="ui-pixel-heading text-xs text-[#ffe18c]">World Navigator</h2>
              <button
                type="button"
                title={isCurrentWorldFav ? 'Unfavorite current world' : 'Favorite current world'}
                onClick={() => onToggleFavoriteWorld(worldName)}
                className={`p-1 border cursor-pointer ${
                  isCurrentWorldFav
                    ? 'bg-[#362b12] border-[#f2b738] text-[#ffe18c]'
                    : 'bg-[#090e17] border-[#263c52] text-[#8aa4bd]'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[11px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
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
              className="flex-1 px-2.5 py-1.5 bg-[#05080e] border border-[#2d4863] text-xs font-bold uppercase text-white focus:outline-none focus:border-[#f2b738]"
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
                className={`py-1 border-2 text-[11px] font-bold uppercase cursor-pointer ${
                  worldTab === t
                    ? 'bg-[#214463] border-[#78c8f5] text-white'
                    : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc]'
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
                  <span className="font-bold text-[#f7f4eb]">
                    {w.name} {w.publicAccess === false ? '🔒' : ''}
                  </span>
                  <span className="font-mono-num text-[#89d6ff]">
                    {w.ownerName ? `${w.ownerName} · ` : ''}
                    {w.playerCount}/{w.ownerId ? 10 : 20}
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
                    className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer"
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
                  className="pixel-slot flex items-center justify-between px-2.5 py-1.5 text-xs cursor-pointer"
                >
                  <span className="font-bold text-[#f7f4eb]">{name}</span>
                  <span className="text-[11px] text-[#89d6ff]">Revisit</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* World Chat Drawer (anchored below Top-Left World Chat button) */}
      {activePanel === 'chat' && (
        <div className="pointer-events-auto fixed left-2 top-[90px] sm:top-[98px] z-20 w-[min(20rem,calc(100vw-1rem))] max-h-[calc(100dvh-12.5rem)] min-[740px]:max-h-[calc(100dvh-10.5rem)] pixel-box p-2.5 flex flex-col gap-2">
          <div className="pixel-box-header -mx-2.5 -mt-2.5 px-2.5 py-1.5 flex items-center justify-between">
            <span className="ui-pixel-heading text-[10px] text-[#89d6ff]">World Chat · {worldName}</span>
            <button
              type="button"
              onClick={() => setActivePanel('none')}
              className="text-[10px] font-pixel text-[#9cb5cc] hover:text-white cursor-pointer"
            >
              [X]
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
              className="flex-1 px-2 py-1 bg-[#05080e] border border-[#2d4863] text-xs text-white focus:outline-none focus:border-[#78c8f5]"
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

      {/* Menu View (houses navigation, controls, and Seediary seed recipe tutorials) */}
      {mode === 'paused' && (
        <div
          data-testid="game-menu-view"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#070f18]/80 flex items-center justify-center p-2.5 sm:p-4"
        >
          {menuTab === 'menu' ? (
            <div className="w-full max-w-md max-h-[calc(100dvh-1.5rem)] overflow-y-auto pixel-wood-box p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="pixel-wood-header -mx-3.5 sm:-mx-4 -mt-3.5 sm:-mt-4 px-3.5 sm:px-4 py-2.5 flex items-center justify-between">
                <h2 className="ui-pixel-heading text-sm text-[#fef3c7]">Game Menu</h2>
                <span className="text-xs font-mono-num text-[#8cf7ee]">
                  {worldName} · LVL {level} · {Math.round(gems)} G
                </span>
              </div>

              <button
                type="button"
                onClick={onResume}
                className="pixel-btn pixel-btn-emerald w-full !py-2 !text-xs"
              >
                Resume World
              </button>

              {/* Navigation Grid (Friends, Seediary & Admin) */}
              <div className={`grid ${role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                <button
                  type="button"
                  onClick={() => {
                    onResume();
                    setActivePanel('friends');
                  }}
                  className="pixel-btn relative flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
                >
                  <Users className="w-4 h-4 text-[#89d6ff] shrink-0" />
                  <span>Friends</span>
                  {incomingRequests.length > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 bg-[#e6482e] border border-white text-[10px] font-mono-num text-white">
                      {incomingRequests.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="menu-seediary-button"
                  onClick={() => setMenuTab('seediary')}
                  className="pixel-btn pixel-btn-emerald flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Seediary</span>
                </button>

                {role === 'admin' && (
                  <button
                    type="button"
                    aria-label="Admin Dev Panel"
                    onClick={() => {
                      onResume();
                      setActivePanel('admin');
                    }}
                    className="pixel-btn pixel-btn-gold flex items-center justify-center gap-1.5 !px-2.5 !py-2 !text-[11px]"
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Admin</span>
                  </button>
                )}
              </div>

              {/* Settings Toggles */}
              <div className="grid grid-cols-2 gap-2 border-t-2 border-[#3e2212] pt-2.5">
                <button
                  type="button"
                  onClick={onToggleTouch}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 border-2 text-xs font-bold cursor-pointer ${
                    touchEnabled
                      ? 'bg-[#153447] border-[#38e8d8] text-[#8cf7ee]'
                      : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc]'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Touch Pad: {touchEnabled ? 'ON' : 'OFF'}</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`flex items-center justify-center gap-2 py-2 px-2.5 border-2 text-xs font-bold cursor-pointer ${
                    muted
                      ? 'bg-[#3b151a] border-[#dc2626] text-[#fca5a5]'
                      : 'bg-[#153447] border-[#38e8d8] text-[#8cf7ee]'
                  }`}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>Audio: {muted ? 'MUTED' : 'ON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className={`col-span-2 flex items-center justify-center gap-2 py-2 px-2.5 border-2 text-xs font-bold cursor-pointer ${
                    isFullscreen
                      ? 'bg-[#153447] border-[#38e8d8] text-[#8cf7ee]'
                      : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc]'
                  }`}
                  aria-label="Toggle fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Fullscreen: {isFullscreen ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              {/* Hub & Sign Out */}
              <div className="grid grid-cols-2 gap-2 border-t-2 border-[#3e2212] pt-2.5">
                <button
                  type="button"
                  onClick={onReturnToHub}
                  className="pixel-btn !py-2 !text-[10px]"
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
          ) : (
            /* SEEDIARY: 40 FARMABLE CROPS ALMANAC VIEW */
            <div
              data-testid="menu-seediary-view"
              className="w-full max-w-lg h-[min(88dvh,640px)] pixel-box p-3.5 sm:p-4 flex flex-col gap-2.5 overflow-hidden"
            >
              <div className="pixel-box-header -mx-3.5 sm:-mx-4 -mt-3.5 sm:-mt-4 px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMenuTab('menu')}
                    className="pixel-btn flex items-center gap-1 !px-2 !py-1 !text-[10px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Menu</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Sprout className="w-4 h-4 text-[#34d399]" />
                    <h2 className="ui-pixel-heading text-xs sm:text-sm text-[#a8f794]">Seediary Almanac</h2>
                  </div>
                </div>
                <span className="text-[11px] font-mono-num font-bold text-[#8cf7ee]">
                  {filteredFarmables.length}/40 Crops
                </span>
              </div>

              {/* Crop Planting & Matteragen Guide */}
              <div className="pixel-slot p-2.5 shrink-0 flex flex-col gap-1.5">
                <div className="text-[11px] font-bold text-[#fde047]">
                  Crop Planting &amp; Matteragen Guide
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px] text-[#cfe4d8]">
                  <div className="bg-[#05080f] border border-[#1c2b3d] px-2 py-1.5">
                    <span className="font-bold text-[#34d399]">1. Place Seed Pot:</span> Buy Seed Pots (500G) in the Gem Store and place them on solid ground.
                  </div>
                  <div className="bg-[#05080f] border border-[#1c2b3d] px-2 py-1.5">
                    <span className="font-bold text-[#38bdf8]">2. Plant Seed:</span> Plant any Farmable Seed into an empty Seed Pot (1 seed per Pot at a time).
                  </div>
                  <div className="bg-[#05080f] border border-[#1c2b3d] px-2 py-1.5">
                    <span className="font-bold text-[#fde047]">3. Harvest &amp; Engines:</span> Punch mature trees or ready Matteragen Engines (max 20/world) for Crops, Gems &amp; XP!
                  </div>
                </div>
              </div>

              {/* Search & Farmable Branch Filters */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#7897b5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    aria-label="Search Seediary Crops"
                    value={seediaryQuery}
                    onChange={(e) => setSeediaryQuery(e.target.value)}
                    placeholder="Search crop, seed, tier (T1-T8) or branch..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#05080f] border-2 border-[#1c2b3d] text-xs text-white focus:outline-none focus:border-[#34d399]"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'botanical', 'geomineral', 'luminescent', 'arcane', 'cosmic'] as const).map((branch) => (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => setSeediaryBranch(branch)}
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase cursor-pointer border-2 ${
                        seediaryBranch === branch
                          ? 'bg-[#064e3b] border-[#10b981] text-[#a7f3d0]'
                          : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc] hover:text-white'
                      }`}
                    >
                      {branch}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Farmable Crop Cards */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0">
                {filteredFarmables.length === 0 ? (
                  <p className="text-xs text-[#6d8ba8] py-4 text-center">
                    No farmable crops match your filter.
                  </p>
                ) : (
                  filteredFarmables.map((spec) => {
                    const seedDef = getItemDef(spec.seedId);
                    const growText =
                      spec.growthTimeSec >= 60
                        ? `${Math.floor(spec.growthTimeSec / 60)}m${spec.growthTimeSec % 60 ? ` ${spec.growthTimeSec % 60}s` : ''}`
                        : `${spec.growthTimeSec}s`;
                    return (
                      <div
                        key={spec.id}
                        className="pixel-slot p-2 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1 py-0.5 bg-[#05080f] border border-[#facc15] font-mono-num font-bold text-[#fde047] shrink-0">
                              T{spec.tier}
                            </span>
                            <span className="font-bold text-[#a7f3d0] truncate">
                              {spec.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 font-mono-num text-[#9cb5cc]">
                            <span>{growText}</span>
                            <span className="px-1.5 py-0.5 bg-[#05080f] border border-[#1c2b3d] text-[9px] uppercase text-[#38bdf8]">
                              {spec.branch}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <div className="flex items-center gap-1.5 bg-[#05080f] border border-[#1c2b3d] px-1.5 py-1 shrink-0">
                            <img
                              src={getItemIconUrl(spec.seedId)}
                              alt={seedDef?.name ?? spec.name}
                              className="w-5 h-5 pixelated shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <span className="text-[#82e068] font-bold">→</span>
                            <img
                              src={getItemIconUrl(spec.id)}
                              alt={spec.name}
                              className="w-5 h-5 pixelated shrink-0"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0 grid grid-cols-3 gap-1 font-mono-num text-[10px]">
                            <div className="bg-[#05080f] border border-[#1c2b3d] px-1.5 py-0.5 text-[#e0f2fe]">
                              Yield: <span className="text-[#34d399] font-bold">{spec.minBlocks}-{spec.maxBlocks}</span>
                            </div>
                            <div className="bg-[#05080f] border border-[#1c2b3d] px-1.5 py-0.5 text-[#fde047]">
                              {spec.gemValue}G · {spec.xpValue}XP
                            </div>
                            <div className="bg-[#05080f] border border-[#1c2b3d] px-1.5 py-0.5 text-[#c7d9eb]">
                              S:{Math.round(spec.seedDropRate * 100)}% B:{Math.round(spec.blockDropRate * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
