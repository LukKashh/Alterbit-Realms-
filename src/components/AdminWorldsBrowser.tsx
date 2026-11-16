import React, { useState, useEffect, useMemo } from 'react';
import type { WorldSummary, AdminPlayerProfile } from '../game/network.ts';
import { isOpeningFrameTickLocked, openingFrameTick } from '../game/openingFrameTick.ts';
import {
  Globe,
  User,
  ChevronDown,
  ChevronUp,
  Zap,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  Shield,
  Layers,
  Sparkles,
  Trophy,
  Coins,
  ArrowLeft,
  X,
  Compass,
  Calendar,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export interface AdminWorldsBrowserProps {
  worlds?: WorldSummary[];
  onRefreshWorlds?: () => void;
  onWarpWorld?: (worldName: string) => void;
  onBackToMenu?: () => void;
  onSwitchToCatalog?: () => void;
  onClose?: () => void;
}

const EPHEMERAL_TEST_WORLD_RE =
  /^(FARM|LOCK|VOWNER|ATMUSER|XPW|CT|MGEN|CAP|REALM1|DRS|DRP|CRAFT|BFGTEST|WLD|TEST|GEMTEST|ATMWORLD|VAULT|PLAT|CROP|WS)_[A-Z0-9]{4,12}$/;

function isRealDisplayWorld(w: WorldSummary): boolean {
  const name = String(w?.name ?? '').trim().toUpperCase();
  if (!name) return false;
  return !EPHEMERAL_TEST_WORLD_RE.test(name);
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return 'Never';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  const days = Math.floor(diff / 86400_000);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExactDate(ts?: number | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AdminWorldsBrowser: React.FC<AdminWorldsBrowserProps> = ({
  worlds = [],
  onRefreshWorlds,
  onWarpWorld,
  onBackToMenu,
  onSwitchToCatalog,
  onClose,
}) => {
  const [localWorlds, setLocalWorlds] = useState<WorldSummary[]>(worlds);
  const [loadingWorlds, setLoadingWorlds] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'owned' | 'system' | 'personal'>('all');
  const [expandedWorldName, setExpandedWorldName] = useState<string | null>(null);

  // Player View state
  const [inspectingPlayerTarget, setInspectingPlayerTarget] = useState<{
    id?: string | null;
    name?: string | null;
  } | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<AdminPlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    window.setTimeout(() => {
      setActionNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const fetchWorldsFromServer = async () => {
    setLoadingWorlds(true);
    try {
      const res = await fetch('/api/worlds');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.worlds)) {
          setLocalWorlds(data.worlds);
        }
      }
      onRefreshWorlds?.();
    } catch (err) {
      console.error('Failed to fetch worlds list:', err);
    } finally {
      setLoadingWorlds(false);
    }
  };

  useEffect(() => {
    if (worlds.length > 0) {
      setLocalWorlds(worlds);
    } else {
      void fetchWorldsFromServer();
    }
  }, [worlds]);

  // Load detailed owner profile when a player is selected
  const handleInspectOwner = async (targetId?: string | null, targetName?: string | null) => {
    if (isOpeningFrameTickLocked()) return;
    if (!targetId && !targetName) return;
    openingFrameTick();
    setInspectingPlayerTarget({ id: targetId, name: targetName });
    setLoadingProfile(true);
    setProfileError(null);
    setOwnerProfile(null);

    try {
      const token = localStorage.getItem('blockgrove_auth_token') || '';
      const params = new URLSearchParams();
      if (targetId) params.set('id', targetId);
      else if (targetName) params.set('name', targetName);

      const res = await fetch(`/api/admin/player-profile?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch owner profile (${res.status})`);
      }

      const json = await res.json();
      if (json.ok && json.profile) {
        setOwnerProfile(json.profile);
      } else {
        throw new Error('Invalid profile data received');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching player details';
      setProfileError(msg);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAdminEnter = (worldName: string) => {
    if (isOpeningFrameTickLocked()) return;
    openingFrameTick();
    showNotice(`⚡ AdminEnter: Warping into ${worldName} (Approvals & Locks Bypassed)...`);
    window.setTimeout(() => {
      onWarpWorld?.(worldName);
    }, 200);
  };

  const cleanWorlds = useMemo(() => {
    const seen = new Set<string>();
    const out: WorldSummary[] = [];
    for (const w of localWorlds) {
      if (!isRealDisplayWorld(w)) continue;
      const key = w.name.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(w);
    }
    return out;
  }, [localWorlds]);

  // Filtered worlds
  const filteredWorlds = useMemo(() => {
    let list = cleanWorlds;
    if (filterTab === 'owned') {
      list = list.filter((w) => Boolean(w.ownerName));
    } else if (filterTab === 'system') {
      list = list.filter((w) => !w.ownerName && !w.isPersonalRealm);
    } else if (filterTab === 'personal') {
      list = list.filter((w) => Boolean(w.isPersonalRealm));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          (w.ownerName && w.ownerName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [cleanWorlds, filterTab, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: cleanWorlds.length,
      owned: cleanWorlds.filter((w) => Boolean(w.ownerName)).length,
      system: cleanWorlds.filter((w) => !w.ownerName && !w.isPersonalRealm).length,
      personal: cleanWorlds.filter((w) => Boolean(w.isPersonalRealm)).length,
    };
  }, [cleanWorlds]);

  // ==========================================================================
  // VIEW: DETAILED PLAYER INFORMATION PANEL (Owner View)
  // ==========================================================================
  if (inspectingPlayerTarget) {
    return (
      <div className="flex flex-col h-full w-full bg-[#eef7ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]">
        {/* Header Bar */}
        <div className="px-3 py-2 bg-[#c4e0f8]/80 border-b-2 border-[#2c5885] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick();
                setInspectingPlayerTarget(null);
                setOwnerProfile(null);
                setProfileError(null);
              }}
              className="px-2 py-1 rounded-[6px] text-[11px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#3b82f6] hover:bg-white flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
            >
              <ArrowLeft size={13} />
              Worlds List
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a] flex items-center gap-1.5">
              <User size={15} className="text-[#2563eb]" />
              Owner Player View
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {ownerProfile?.ownedWorldName && (
              <button
                type="button"
                onClick={() => handleAdminEnter(ownerProfile.ownedWorldName!)}
                className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-[#fef3c7] text-[#92400e] border border-[#b45309] hover:bg-[#fde68a] flex items-center gap-1 cursor-pointer shadow-xs"
                title="Warp to this player's primary realm"
              >
                <Zap size={11} className="text-[#d97706]" />
                AdminEnter Realm ({ownerProfile.ownedWorldName})
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[#23476d] hover:text-[#091e3a] rounded-[6px] cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="px-3 py-1.5 bg-[#fef08a] border-b border-[#ca8a04] text-[#854d0e] text-[11px] font-medium flex items-center justify-between shrink-0">
            <span>{actionNotice}</span>
            <button type="button" onClick={() => setActionNotice(null)}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {loadingProfile ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-2 text-[#475569]">
              <RefreshCw size={24} className="animate-spin text-[#2563eb]" />
              <p className="text-xs font-semibold">Loading owner profile and statistical data...</p>
            </div>
          ) : profileError ? (
            <div className="p-4 bg-[#fee2e2] border-2 border-[#ef4444] rounded-[8px] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[#b91c1c] text-xs font-bold">
                <AlertCircle size={16} />
                <span>Unable to load player statistics</span>
              </div>
              <p className="text-[11px] text-[#7f1d1d]">{profileError}</p>
              <button
                type="button"
                onClick={() =>
                  handleInspectOwner(inspectingPlayerTarget.id, inspectingPlayerTarget.name)
                }
                className="self-start px-2.5 py-1 text-[11px] font-bold bg-white text-[#b91c1c] border border-[#ef4444] rounded-[6px] hover:bg-[#fef2f2] cursor-pointer"
              >
                Retry Fetch
              </button>
            </div>
          ) : ownerProfile ? (
            <>
              {/* Primary Profile Identity Header Card */}
              <div className="p-3 bg-white border-2 border-[#93c5fd] rounded-[8px] shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-2 border-[#1e3a8a] flex items-center justify-center text-white shadow-sm">
                    <User size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#0f172a] tracking-wide">
                        {ownerProfile.name}
                      </h3>
                      <span
                        className={`px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-wider ${
                          ownerProfile.role === 'admin'
                            ? 'bg-[#fed7aa] text-[#9a3412] border border-[#ea580c]'
                            : 'bg-[#e2e8f0] text-[#334155] border border-[#94a3b8]'
                        }`}
                      >
                        {ownerProfile.role}
                      </span>
                      {ownerProfile.isOnline ? (
                        <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-bold bg-[#dcfce7] text-[#15803d] border border-[#22c55e] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                          Online ({ownerProfile.currentWorldName ?? 'World'})
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-[5px] text-[9px] font-medium bg-[#f1f5f9] text-[#64748b] border border-[#cbd5e1]">
                          Offline
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-[#64748b]">ID: {ownerProfile.id}</p>
                    <p className="text-[10px] text-[#475569]">{ownerProfile.email}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-[10px] text-[#475569]">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-[#64748b]" />
                    Registered: {formatExactDate(ownerProfile.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-[#64748b]" />
                    Last Active: {formatRelativeTime(ownerProfile.lastSeenAt ?? undefined)}
                  </span>
                </div>
              </div>

              {/* Grid Section 1: Currencies & Economy */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 bg-gradient-to-br from-[#fef3c7] to-[#fde68a] border border-[#d97706] rounded-[7px] flex items-center gap-2.5 shadow-2xs">
                  <Coins size={20} className="text-[#b45309]" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#92400e]">
                      Gems
                    </span>
                    <p className="text-sm font-bold font-mono-num text-[#78350f]">
                      {ownerProfile.gems.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-gradient-to-br from-[#cffafe] to-[#a5f3fc] border border-[#0891b2] rounded-[7px] flex items-center gap-2.5 shadow-2xs">
                  <Sparkles size={20} className="text-[#0e7490]" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#155e75]">
                      Digibits / Alterbits
                    </span>
                    <p className="text-sm font-bold font-mono-num text-[#164e63]">
                      {ownerProfile.alterbits.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-gradient-to-br from-[#f3e8ff] to-[#e9d5ff] border border-[#9333ea] rounded-[7px] flex items-center gap-2.5 shadow-2xs">
                  <Lock size={20} className="text-[#7e22ce]" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b21a8]">
                      Unclaimed WL
                    </span>
                    <p className="text-sm font-bold font-mono-num text-[#581c87]">
                      {ownerProfile.unclaimedWl}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid Section 2: Progression & Masteries */}
              <div className="p-3 bg-white border border-[#cbd5e1] rounded-[8px] shadow-xs flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#334155] flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1.5">
                  <Trophy size={14} className="text-[#eab308]" />
                  Level Progression & Masteries
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 bg-[#f8fafc] rounded-[6px] border border-[#e2e8f0]">
                    <span className="text-[9px] font-bold uppercase text-[#64748b]">
                      Player Level
                    </span>
                    <p className="text-xs font-bold text-[#0f172a]">Level {ownerProfile.level}</p>
                    <span className="text-[9px] text-[#475569]">{ownerProfile.xp} Total XP</span>
                  </div>

                  <div className="p-2 bg-[#f8fafc] rounded-[6px] border border-[#e2e8f0]">
                    <span className="text-[9px] font-bold uppercase text-[#15803d]">
                      Crop Mastery
                    </span>
                    <p className="text-xs font-bold text-[#14532d]">
                      Level {ownerProfile.cropMasteryLevel}
                    </p>
                    <span className="text-[9px] text-[#166534]">
                      {ownerProfile.cropMasteryXp} XP
                    </span>
                  </div>

                  <div className="p-2 bg-[#f8fafc] rounded-[6px] border border-[#e2e8f0]">
                    <span className="text-[9px] font-bold uppercase text-[#b45309]">
                      Farmablock Mastery
                    </span>
                    <p className="text-xs font-bold text-[#78350f]">
                      Level {ownerProfile.farmablockMasteryLevel}
                    </p>
                    <span className="text-[9px] text-[#92400e]">
                      {ownerProfile.farmablockMasteryXp} XP
                    </span>
                  </div>

                  <div className="p-2 bg-[#f8fafc] rounded-[6px] border border-[#e2e8f0]">
                    <span className="text-[9px] font-bold uppercase text-[#2563eb]">
                      Achievements
                    </span>
                    <p className="text-xs font-bold text-[#1e40af]">
                      {ownerProfile.claimedAchievementsCount} /{' '}
                      {ownerProfile.totalAchievementsCount}
                    </p>
                    <span className="text-[9px] text-[#3b82f6]">Completed</span>
                  </div>
                </div>
              </div>

              {/* Grid Section 3: Gameplay Statistics */}
              <div className="p-3 bg-white border border-[#cbd5e1] rounded-[8px] shadow-xs flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#334155] flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1.5">
                  <Layers size={14} className="text-[#3b82f6]" />
                  Gameplay Statistics & Activity Metrics
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#64748b] uppercase">Blocks Broken</span>
                    <span className="font-bold font-mono-num text-[#0f172a]">
                      {(ownerProfile.stats?.blocksBroken ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#64748b] uppercase">Blocks Placed</span>
                    <span className="font-bold font-mono-num text-[#0f172a]">
                      {(ownerProfile.stats?.blocksPlaced ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#64748b] uppercase">Fish Caught</span>
                    <span className="font-bold font-mono-num text-[#0f172a]">
                      {(ownerProfile.stats?.fishCaught ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[9px] text-[#64748b] uppercase">Seeds Planted</span>
                    <span className="font-bold font-mono-num text-[#0f172a]">
                      {(ownerProfile.stats?.seedsPlanted ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid Section 4: Realm Ownership & Inventory Storage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-3 bg-white border border-[#cbd5e1] rounded-[8px] shadow-xs flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#334155] flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1">
                    <Compass size={14} className="text-[#059669]" />
                    Realms & Navigation
                  </h4>
                  <div className="text-[11px] flex flex-col gap-1 text-[#334155]">
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Primary Realm:</span>
                      <span className="font-bold font-mono">
                        {ownerProfile.ownedWorldName ?? 'None registered'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Favorite Realms:</span>
                      <span className="font-bold">{ownerProfile.favoriteWorlds?.length ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b]">Recent Realms:</span>
                      <p className="font-mono text-[10px] text-[#475569] truncate">
                        {ownerProfile.recentWorlds?.length
                          ? ownerProfile.recentWorlds.join(', ')
                          : 'None'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white border border-[#cbd5e1] rounded-[8px] shadow-xs flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#334155] flex items-center gap-1.5 border-b border-[#e2e8f0] pb-1">
                    <Briefcase size={14} className="text-[#d97706]" />
                    Backpack Storage
                  </h4>
                  <div className="text-[11px] flex flex-col gap-1 text-[#334155]">
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Backpack Capacity:</span>
                      <span className="font-bold">
                        {ownerProfile.inventoryCount} / {ownerProfile.inventorySlots} slots utilized
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Equipped Head:</span>
                      <span className="font-mono text-[10px]">
                        {ownerProfile.equipped?.head ? `Item #${ownerProfile.equipped.head}` : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#64748b]">Equipped Back:</span>
                      <span className="font-mono text-[10px]">
                        {ownerProfile.equipped?.back ? `Item #${ownerProfile.equipped.back}` : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW: MAIN SERVER WORLDS BROWSER LIST
  // ==========================================================================
  return (
    <div
      data-testid="admin-worlds-browser"
      className="flex flex-col h-full w-full bg-[#eef7ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]"
    >
      {/* Top Header Bar: Switchers + Controls */}
      <div className="px-3 py-2 bg-[#c4e0f8]/80 border-b-2 border-[#2c5885] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {onBackToMenu && (
            <button
              type="button"
              onClick={onBackToMenu}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#3b82f6] hover:bg-white flex items-center gap-1 cursor-pointer transition-colors"
              title="Return to Admin Tools Selection Menu"
            >
              <ArrowLeft size={12} />
              Tools Menu
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <Globe size={16} className="text-[#2563eb]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
              Server Worlds Browser
            </span>
            <span className="text-[10px] font-mono text-[#23476d]">
              ({filteredWorlds.length}/{localWorlds.length})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onSwitchToCatalog && (
            <button
              type="button"
              onClick={onSwitchToCatalog}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#0f766e] border border-[#0d9488] hover:bg-[#ccfbf1] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Switch to Game Item Catalogue"
            >
              <Layers size={11} />
              Item Catalogue
            </button>
          )}

          <button
            type="button"
            onClick={fetchWorldsFromServer}
            disabled={loadingWorlds}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#3b82f6] hover:bg-[#dbeafe] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
            title="Refresh Server Worlds"
          >
            <RefreshCw size={11} className={loadingWorlds ? 'animate-spin' : ''} />
            Refresh
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#23476d] hover:text-[#091e3a] rounded-[6px] cursor-pointer"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Action Notice */}
      {actionNotice && (
        <div className="px-3 py-1.5 bg-[#fef08a] border-b border-[#ca8a04] text-[#854d0e] text-[11px] font-medium flex items-center justify-between shrink-0">
          <span>{actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-2 bg-[#d7eafd]/70 border-b border-[#93c5fd] flex flex-col gap-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search server worlds by name or owner..."
            className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-[#94a3b8] rounded-[6px] focus:outline-none focus:border-[#2563eb] text-[#0f172a]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a]"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-2 py-0.5 rounded-[5px] font-bold uppercase transition-colors cursor-pointer shrink-0 ${
              filterTab === 'all'
                ? 'bg-[#2563eb] text-white'
                : 'bg-white/80 text-[#334155] hover:bg-white'
            }`}
          >
            All ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('owned')}
            className={`px-2 py-0.5 rounded-[5px] font-bold uppercase transition-colors cursor-pointer shrink-0 ${
              filterTab === 'owned'
                ? 'bg-[#2563eb] text-white'
                : 'bg-white/80 text-[#334155] hover:bg-white'
            }`}
          >
            Player Owned ({counts.owned})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('personal')}
            className={`px-2 py-0.5 rounded-[5px] font-bold uppercase transition-colors cursor-pointer shrink-0 ${
              filterTab === 'personal'
                ? 'bg-[#2563eb] text-white'
                : 'bg-white/80 text-[#334155] hover:bg-white'
            }`}
          >
            Personal Realms ({counts.personal})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('system')}
            className={`px-2 py-0.5 rounded-[5px] font-bold uppercase transition-colors cursor-pointer shrink-0 ${
              filterTab === 'system'
                ? 'bg-[#2563eb] text-white'
                : 'bg-white/80 text-[#334155] hover:bg-white'
            }`}
          >
            System Hubs ({counts.system})
          </button>
        </div>
      </div>

      {/* Worlds List Container */}
      <div
        data-testid="admin-worlds-scroll-container"
        className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-2"
      >
        {filteredWorlds.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#64748b]">
            <Globe size={32} className="text-[#94a3b8] mb-2" />
            <p className="text-xs font-semibold">No server worlds match your filter.</p>
            <p className="text-[11px] text-[#94a3b8]">Try searching a different name or clearing query.</p>
          </div>
        ) : (
          filteredWorlds.map((w) => {
            const isExpanded = expandedWorldName === w.name;
            const isSystem = !w.ownerName && !w.isPersonalRealm;

            return (
              <div
                key={w.name}
                data-testid={`admin-world-card-${w.name}`}
                className={`shrink-0 bg-white border-2 rounded-[8px] transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-[#2563eb] shadow-md'
                    : 'border-[#cbd5e1] hover:border-[#93c5fd] shadow-2xs'
                }`}
              >
                {/* Main Card Header (Click to expand downwards) */}
                <button
                  type="button"
                  onClick={() => {
                    if (isOpeningFrameTickLocked()) return;
                    openingFrameTick();
                    setExpandedWorldName(isExpanded ? null : w.name);
                  }}
                  className="w-full text-left p-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-[#f8fafc] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 border ${
                        isSystem
                          ? 'bg-[#e0f2fe] text-[#0284c7] border-[#38bdf8]'
                          : w.isPersonalRealm
                          ? 'bg-[#ecfdf5] text-[#059669] border-[#34d399]'
                          : 'bg-[#fef3c7] text-[#d97706] border-[#fbbf24]'
                      }`}
                    >
                      <Globe size={16} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-[#0f172a] tracking-wide">
                          {w.name}
                        </span>

                        {isSystem ? (
                          <span className="px-1.5 py-0.2 rounded-[4px] text-[9px] font-bold uppercase bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                            System Hub
                          </span>
                        ) : w.isPersonalRealm ? (
                          <span className="px-1.5 py-0.2 rounded-[4px] text-[9px] font-bold uppercase bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]">
                            Personal Realm
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-[4px] text-[9px] font-bold uppercase bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                            Custom World
                          </span>
                        )}

                        {w.publicAccess ? (
                          <span className="px-1 py-0.2 rounded-[4px] text-[9px] font-semibold bg-[#f1f5f9] text-[#475569] flex items-center gap-0.5">
                            <Unlock size={9} className="text-[#10b981]" />
                            Public
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 rounded-[4px] text-[9px] font-semibold bg-[#fee2e2] text-[#991b1b] flex items-center gap-0.5">
                            <Lock size={9} className="text-[#dc2626]" />
                            Locked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-[#64748b] mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[#334155] font-medium">
                          <User size={11} className="text-[#64748b]" />
                          Owner: {w.ownerName || 'None (System)'}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-[#64748b]" />
                          Last Seen: {formatRelativeTime(w.lastSeen)}
                        </span>
                        <span>·</span>
                        <span className="font-mono-num font-semibold text-[#0369a1]">
                          👥 {w.playerCount} online
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-[#64748b]">
                    <span className="text-[10px] font-semibold text-[#2563eb] hidden sm:inline">
                      {isExpanded ? 'Collapse' : 'Inspect'}
                    </span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* ACCORDION EXPANSION FRAME DOWNWARDS */}
                {isExpanded && (
                  <div
                    data-testid={`admin-world-expanded-${w.name}`}
                    className="p-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    {/* World Details Matrix */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] bg-white p-2.5 rounded-[6px] border border-[#e2e8f0]">
                      <div>
                        <span className="text-[#64748b] uppercase block">Dimensions</span>
                        <span className="font-bold text-[#0f172a] font-mono">
                          {w.width ?? 100} × {w.height ?? 60} tiles
                        </span>
                      </div>

                      <div>
                        <span className="text-[#64748b] uppercase block">World Level</span>
                        <span className="font-bold text-[#0f172a]">Level {w.worldLevel ?? 1}</span>
                      </div>

                      <div>
                        <span className="text-[#64748b] uppercase block">Lock Authority</span>
                        <span className="font-bold text-[#0f172a]">
                          {w.ownerName ? `Owned by ${w.ownerName}` : 'Unclaimed / System'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[#64748b] uppercase block">Database Record</span>
                        <span className="font-bold text-[#16a34a] flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          Active Persistent
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Frame: AdminEnter & Player View */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#e2e8f0]">
                      {/* OPTION 1: AdminEnter (Bypasses Owner Approval) */}
                      <button
                        type="button"
                        data-testid={`admin-enter-btn-${w.name}`}
                        onClick={() => handleAdminEnter(w.name)}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-[7px] text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-[#d97706] to-[#b45309] text-white hover:from-[#b45309] hover:to-[#92400e] border border-[#78350f] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                        title="Instantly enter this world. Admin privileges bypass owner approvals and lock restrictions."
                      >
                        <Zap size={13} className="text-[#fef08a]" />
                        <span>AdminEnter (Bypass Lock)</span>
                      </button>

                      {/* OPTION 2: Player View (Detailed Owner Information Panel) */}
                      {w.ownerName ? (
                        <button
                          type="button"
                          data-testid={`admin-player-view-btn-${w.name}`}
                          onClick={() => handleInspectOwner(w.ownerId, w.ownerName)}
                          className="flex-1 sm:flex-initial px-3 py-1.5 rounded-[7px] text-[11px] font-bold uppercase tracking-wider bg-white text-[#1d4ed8] border-2 border-[#3b82f6] hover:bg-[#eff6ff] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                          title="View detailed owner statistical data and values relating to user of the world"
                        >
                          <User size={13} className="text-[#2563eb]" />
                          <span>Player View ({w.ownerName})</span>
                        </button>
                      ) : (
                        <span className="text-[10px] italic text-[#64748b] py-1 px-2">
                          System Hub (No player owner)
                        </span>
                      )}
                    </div>

                    <p className="text-[9px] text-[#64748b]">
                      * AdminEnter instantly warps into the world, bypassing world owner approval,
                      lock permissions, and visitor caps.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AdminWorldsBrowser;
