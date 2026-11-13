import React, { useEffect, useRef, useState } from 'react';
import {
  Backpack,
  Globe,
  Lock,
  Menu,
  MessageSquare,
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
  onTouchPunchStick: (active: boolean, dx: number, dy: number) => void;
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

interface PunchJoystickProps {
  selectedItemId: number;
  onChange: (active: boolean, dx: number, dy: number) => void;
}

const PunchJoystick: React.FC<PunchJoystickProps> = ({ selectedItemId, onChange }) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ active: boolean; x: number; y: number }>({
    active: false,
    x: 0,
    y: 0,
  });

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxOffset = Math.max(24, Math.round(rect.width * 0.27));
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const rawX = clientX - cx;
    const rawY = clientY - cy;
    const dist = Math.hypot(rawX, rawY);
    const radius = Math.max(22, rect.width * 0.36);
    const clampedDist = Math.min(dist, radius);
    const scale = dist > 0.001 ? clampedDist / dist : 0;
    const normX = (rawX * scale) / radius;
    const normY = (rawY * scale) / radius;
    setKnob({
      active: true,
      x: normX * maxOffset,
      y: normY * maxOffset,
    });
    onChange(true, normX, normY);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnob({ active: false, x: 0, y: 0 });
    onChange(false, 0, 0);
  };

  return (
    <div
      ref={baseRef}
      data-testid="punch-joystick"
      role="slider"
      aria-label="Punch Joystick"
      aria-valuetext={knob.active ? 'Active' : 'Idle'}
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
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
      className={`relative w-[100px] h-[100px] sm:w-[128px] sm:h-[128px] rounded-full border-2 flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing shadow-[0_6px_0_rgba(6,12,20,0.85)] transition-colors ${
        knob.active
          ? 'bg-[#2a1512]/90 border-[#ffb89e]'
          : 'bg-[#0f1d2c]/88 border-[#e0896b]/85'
      }`}
    >
      {/* Directional ring crosshair guides */}
      <div className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-[#e0896b]/35" />
      <span className="pointer-events-none absolute top-1.5 text-[9px] font-bold text-[#ffb89e]/70">▲</span>
      <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-bold text-[#ffb89e]/70">▼</span>
      <span className="pointer-events-none absolute left-2 text-[9px] font-bold text-[#ffb89e]/70">◀</span>
      <span className="pointer-events-none absolute right-2 text-[9px] font-bold text-[#ffb89e]/70">▶</span>

      {/* Movable thumb knob */}
      <div
        className={`pointer-events-none w-[46px] h-[46px] sm:w-[58px] sm:h-[58px] rounded-full border-2 flex flex-col items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.7)] ${
          knob.active
            ? 'bg-[#c95738] border-[#ffe3d6]'
            : 'bg-[#94422c] border-[#e89d82]'
        }`}
        style={{
          transform: `translate(${knob.x}px, ${knob.y}px)`,
        }}
      >
        <img
          src={getItemIconUrl(selectedItemId)}
          alt="Action"
          className="w-5 h-5 sm:w-6 sm:h-6 pixelated"
          referrerPolicy="no-referrer"
        />
        <span className="text-[8px] font-bold uppercase tracking-wider text-[#fff2ec] leading-none mt-0.5">
          {selectedItemId === ITEM_IDS.FIST
            ? 'Punch'
            : selectedItemId === ITEM_IDS.WRENCH
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
  const [vmItemId, setVmItemId] = useState<number>(ITEM_IDS.GP_DIRT);
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
      {/* Top Perimeter Bar (Responsive status + single Menu button) */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        {/* Top-left: Identity, Level/XP, Gems, World */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-[#0f1d2c]/92 border-2 border-[#314a66] rounded-md px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-[0_3px_0_rgba(6,12,20,0.8)] max-w-[calc(100vw-6.5rem)] overflow-hidden">
          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[11px] sm:text-xs font-bold text-[#f7f4eb] whitespace-nowrap truncate max-w-[74px] sm:max-w-none">
                {playerName}
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono-num font-bold text-[#89d6ff] whitespace-nowrap">
                LVL {level}
              </span>
            </div>
            <div className="w-14 sm:w-24 h-1.5 bg-[#08101a] rounded-sm overflow-hidden mt-0.5">
              <div
                className="h-full bg-[#4ec46a] transition-[width] duration-150"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="h-6 w-px bg-[#2a4057] shrink-0" />

          {/* Gems Counter */}
          <div aria-label={`Gems ${gems}`} className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1 py-0.5 shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden="true">
              <polygon points="12,2 21,9 12,22 3,9" fill="#38e8d8" stroke="#0b2430" strokeWidth="2" />
              <polygon points="12,4 17,9 12,18 7,9" fill="#a8fff7" />
            </svg>
            <span className="text-[11px] sm:text-xs font-mono-num font-bold text-[#8cf7ee]">{Math.round(gems)}</span>
          </div>

          <div className="h-6 w-px bg-[#2a4057] shrink-0" />

          {/* Active World Status */}
          <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1.5 py-0.5 text-[11px] sm:text-xs font-bold text-[#ffe18c] whitespace-nowrap truncate">
            {worldOwner ? <Lock className="w-3 h-3 text-[#f2b738] shrink-0" /> : <Globe className="w-3 h-3 text-[#78c8f5] shrink-0" />}
            <span className="truncate max-w-[64px] sm:max-w-none">{worldName}</span>
            <span className="hidden sm:inline text-[11px] font-mono-num text-[#b5cde3]">({playerCount}/20)</span>
          </div>

          <span className="hidden md:inline text-[11px] font-mono-num text-[#8aa4bd] whitespace-nowrap">
            {coords.tx},{coords.ty}
          </span>
        </div>

        {/* Top-right: Single Menu Button (all navigation lives in Menu View) */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!connected && (
            <span className="px-2 py-1 rounded bg-[#3b181b] border border-[#80333a] text-[11px] font-bold text-[#ffb0b0] whitespace-nowrap">
              Reconnecting
            </span>
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
            className="relative h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-md bg-[#0f1d2c]/92 hover:bg-[#192f47] border-2 border-[#46678a] text-[#f4f1ea] flex items-center gap-1.5 sm:gap-2 font-bold text-xs shadow-[0_3px_0_rgba(6,12,20,0.8)] cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#ffe18c]" />
            <span>Menu</span>
            {incomingRequests.length + claimableCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#e6482e] text-[9px] font-mono-num font-bold text-white flex items-center justify-center">
                {incomingRequests.length + claimableCount}
              </span>
            )}
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
                        <option value={ITEM_IDS.GP_RED_BRICKS}>Price in: Red Bricks</option>
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

      {/* Bottom Perimeter: Portrait-friendly 2-row stack (<700px) & Single Row (>=700px Landscape) */}
      <div className="flex flex-col min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between gap-2">
        {/* Center Hotbar (top row in portrait, middle in landscape) */}
        <div className="pointer-events-auto order-1 min-[700px]:order-2 flex flex-col items-center gap-1 self-center">
          {selectedDef && (
            <div className="text-[11px] font-semibold text-[#f4f1ea] bg-[#0f1d2c]/85 border border-[#314a66] px-2.5 py-0.5 rounded whitespace-nowrap">
              {selectedDef.name} · {selectedDef.category}
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#0f1d2c]/92 border-2 border-[#314a66] rounded-md p-1 sm:p-1.5 shadow-[0_4px_0_rgba(6,12,20,0.85)]">
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
                  className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded border-2 flex items-center justify-center cursor-pointer transition-transform ${
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
                      className="w-6 h-6 sm:w-7 sm:h-7 pixelated"
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

        {/* Touch Controls Row in Portrait; split left/right of Hotbar in Landscape */}
        <div className="order-2 w-full flex items-end justify-between gap-2 min-[700px]:contents">
          {/* Left Touch Movement Controls */}
          <div className="min-[700px]:order-1 flex-1 flex items-end justify-start">
            {touchEnabled && (
              <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5" data-testid="touch-left-controls">
                <button
                  type="button"
                  aria-label="Move Left"
                  onPointerDown={() => onTouchMove('left', true)}
                  onPointerUp={() => onTouchMove('left', false)}
                  onPointerLeave={() => onTouchMove('left', false)}
                  onPointerCancel={() => onTouchMove('left', false)}
                  className="w-[62px] h-[62px] sm:w-[82px] sm:h-[82px] rounded-xl bg-[#0f1d2c]/88 active:bg-[#2a4a6b] border-2 border-[#46678a] text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-[0_5px_0_rgba(6,12,20,0.85)] touch-none select-none cursor-pointer"
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
                  className="w-[62px] h-[62px] sm:w-[82px] sm:h-[82px] rounded-xl bg-[#0f1d2c]/88 active:bg-[#2a4a6b] border-2 border-[#46678a] text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-[0_5px_0_rgba(6,12,20,0.85)] touch-none select-none cursor-pointer"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Right Touch Punch Joystick & Jump Button */}
          <div className="min-[700px]:order-3 flex-1 flex items-end justify-end">
            {touchEnabled && (
              <div className="pointer-events-auto flex items-end gap-2 sm:gap-3" data-testid="touch-right-controls">
                <PunchJoystick
                  selectedItemId={selectedItemId}
                  onChange={onTouchPunchStick}
                />
                <button
                  type="button"
                  aria-label="Jump"
                  onPointerDown={() => onTouchJump(true)}
                  onPointerUp={() => onTouchJump(false)}
                  onPointerLeave={() => onTouchJump(false)}
                  onPointerCancel={() => onTouchJump(false)}
                  className="w-[62px] h-[62px] sm:w-[82px] sm:h-[82px] rounded-xl bg-[#2d703b]/90 active:bg-[#3f9450] border-2 border-[#7ae086] text-white font-bold flex flex-col items-center justify-center gap-0.5 shadow-[0_5px_0_rgba(6,12,20,0.85)] touch-none select-none cursor-pointer"
                >
                  <span className="text-xl sm:text-2xl leading-none">▲</span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider leading-none">Jump</span>
                </button>
              </div>
            )}
          </div>
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
            {(gameConfig.storeListings ?? GEM_STORE_LISTINGS)
              .filter((l) => l.section === storeCategory)
              .map((listing) => {
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
        <div className="pointer-events-auto fixed right-3 top-14 w-80 max-w-[92vw] max-h-[65vh] bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2">
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
        <div className="pointer-events-auto fixed right-3 top-14 w-80 max-w-[92vw] bg-[#0f1d2c]/96 border-2 border-[#46678a] rounded-md p-3 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col gap-2.5">
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
        <div className="pointer-events-auto fixed left-3 top-14 z-20 w-80 max-w-[92vw] bg-[#0f1d2c]/94 border-2 border-[#46678a] rounded-md p-2.5 shadow-[0_6px_0_rgba(6,12,20,0.85)] flex flex-col gap-2">
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
        <div className="pointer-events-auto fixed inset-x-3 top-14 bottom-3 md:inset-x-auto md:bottom-auto md:right-3 md:w-[680px] md:max-w-[92vw] md:h-[78vh] md:max-h-[580px] z-30 bg-[#0f1d2c]/96 border-2 border-[#f2b738] rounded-md p-3.5 shadow-[0_8px_0_rgba(6,12,20,0.9)] flex flex-col">
          <AdminPanel
            gameConfig={gameConfig}
            inWorld={true}
            onSaveConfig={onUpdateGameConfig}
            onAdminAction={onAdminAction}
            onClose={() => setActivePanel('none')}
          />
        </div>
      )}

      {/* Menu View (houses all navigation & controls previously in top bar) */}
      {mode === 'paused' && (
        <div
          data-testid="game-menu-view"
          className="pointer-events-auto fixed inset-0 z-30 bg-[#070f18]/78 flex items-center justify-center p-3"
        >
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#101e2e] border-2 border-[#46678a] rounded-lg p-4 shadow-[0_10px_0_rgba(5,10,16,0.9)] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#243d57] pb-2">
              <h2 className="font-pixel text-sm text-[#fff8e8]">Game Menu</h2>
              <span className="text-xs font-mono-num text-[#8cf7ee]">
                {worldName} · LVL {level} · {Math.round(gems)} G
              </span>
            </div>

            <button
              type="button"
              onClick={onResume}
              className="w-full py-2 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-bold text-sm cursor-pointer"
            >
              Resume World
            </button>

            {/* Navigation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('backpack');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#eaf2fa] cursor-pointer"
              >
                <Backpack className="w-4 h-4 text-[#89d6ff]" />
                <span>Backpack</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('store');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#8cf7ee] cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Gem Store</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('splice');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#eaf2fa] cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#ffe18c]" />
                <span>Splice Seeds</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('profile');
                }}
                className="relative flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#ffe18c] cursor-pointer"
              >
                <Trophy className="w-4 h-4" />
                <span>Profile</span>
                {claimableCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.2 rounded-full bg-[#4aa64d] text-[10px] font-mono-num text-[#081709]">
                    {claimableCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('friends');
                }}
                className="relative flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#eaf2fa] cursor-pointer"
              >
                <Users className="w-4 h-4 text-[#89d6ff]" />
                <span>Friends</span>
                {incomingRequests.length > 0 && (
                  <span className="ml-auto px-1.5 py-0.2 rounded-full bg-[#e6482e] text-[10px] font-mono-num text-white">
                    {incomingRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  setActivePanel('chat');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#eaf2fa] cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-[#89d6ff]" />
                <span>World Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResume();
                  onRefreshWorlds();
                  setActivePanel('worlds');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[#14263a] hover:bg-[#1e3754] border border-[#314e6b] text-xs font-bold text-[#eaf2fa] cursor-pointer"
              >
                <Globe className="w-4 h-4 text-[#78c8f5]" />
                <span>Switch World</span>
              </button>

              {role === 'admin' && (
                <button
                  type="button"
                  aria-label="Admin Dev Panel"
                  onClick={() => {
                    onResume();
                    setActivePanel('admin');
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-[#332710] hover:bg-[#473717] border border-[#f2b738] text-xs font-bold text-[#ffe18c] cursor-pointer"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>
              )}
            </div>

            {/* Settings Toggles */}
            <div className="grid grid-cols-2 gap-2 border-t border-[#243d57] pt-2.5">
              <button
                type="button"
                onClick={onToggleTouch}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded border text-xs font-bold cursor-pointer ${
                  touchEnabled
                    ? 'bg-[#1c3d5c] border-[#78c8f5] text-white'
                    : 'bg-[#0b1622] border-[#263c52] text-[#9cb5cc]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Touch Pad: {touchEnabled ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded border text-xs font-bold cursor-pointer ${
                  muted
                    ? 'bg-[#331a1d] border-[#80333a] text-[#ffb0b0]'
                    : 'bg-[#1c3d5c] border-[#78c8f5] text-white'
                }`}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>Audio: {muted ? 'MUTED' : 'ON'}</span>
              </button>
            </div>

            {/* Hub & Sign Out */}
            <div className="grid grid-cols-2 gap-2 border-t border-[#243d57] pt-2.5">
              <button
                type="button"
                onClick={onReturnToHub}
                className="py-2 rounded bg-[#214463] hover:bg-[#2d5b82] border border-[#78c8f5] text-white font-bold text-xs cursor-pointer"
              >
                Return to World Hub
              </button>
              <button
                type="button"
                onClick={onLeaveWorld}
                className="py-2 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] text-[#ffd4d4] font-bold text-xs cursor-pointer"
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
