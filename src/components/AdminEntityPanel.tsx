import React, { useEffect, useMemo, useState } from 'react';
import type { WorldEntityDescriptor } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import {
  ArrowLeft,
  Crosshair,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';

export interface WorldEntitiesSnapshot {
  worldName: string;
  worldWidth: number;
  worldHeight: number;
  adminTx: number;
  adminTy: number;
  entities: WorldEntityDescriptor[];
  notice?: string;
}

export interface AdminEntityPanelProps {
  worldName?: string;
  coords?: { tx: number; ty: number };
  entitiesSnapshot?: WorldEntitiesSnapshot | null;
  onRefreshEntities?: () => void;
  onTeleportEntity?: (opts: {
    entityKind: 'player' | 'npc';
    entityId: string;
    targetTx?: number;
    targetTy?: number;
    summon?: boolean;
  }) => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

export const AdminEntityPanel: React.FC<AdminEntityPanelProps> = ({
  worldName,
  coords,
  entitiesSnapshot,
  onRefreshEntities,
  onTeleportEntity,
  onBackToMenu,
  onClose,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | 'player' | 'npc'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [targetX, setTargetX] = useState<string>('0');
  const [targetY, setTargetY] = useState<string>('0');
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    onRefreshEntities?.();
  }, [worldName]);

  useEffect(() => {
    if (entitiesSnapshot?.notice) {
      setStatusToast(entitiesSnapshot.notice);
      const timer = window.setTimeout(() => {
        setStatusToast((prev) => (prev === entitiesSnapshot.notice ? null : prev));
      }, 3600);
      return () => window.clearTimeout(timer);
    }
  }, [entitiesSnapshot?.notice]);

  const activeWorldName = entitiesSnapshot?.worldName || worldName || 'Current World';
  const maxX = Math.max(0, (entitiesSnapshot?.worldWidth ?? 100) - 1);
  const maxY = Math.max(0, (entitiesSnapshot?.worldHeight ?? 60) - 2);
  const adminTx = coords?.tx ?? entitiesSnapshot?.adminTx ?? 0;
  const adminTy = coords?.ty ?? entitiesSnapshot?.adminTy ?? 0;

  const entities = entitiesSnapshot?.entities ?? [];

  const filteredEntities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entities
      .filter((e) => {
        if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.entityId.toLowerCase().includes(q) ||
          `${e.tx},${e.ty}`.includes(q)
        );
      })
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'player' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [entities, kindFilter, searchQuery]);

  const selectedEntity = useMemo(
    () => entities.find((e) => e.entityId === selectedEntityId) ?? null,
    [entities, selectedEntityId]
  );

  const handleSelectEntity = (entity: WorldEntityDescriptor) => {
    setSelectedEntityId(entity.entityId);
    setTargetX(String(entity.tx));
    setTargetY(String(entity.ty));
  };

  const handleTeleportSelected = () => {
    if (!selectedEntity) return;
    const tx = Math.max(0, Math.min(maxX, Math.floor(Number(targetX) || 0)));
    const ty = Math.max(0, Math.min(maxY, Math.floor(Number(targetY) || 0)));
    onTeleportEntity?.({
      entityKind: selectedEntity.kind,
      entityId: selectedEntity.entityId,
      targetTx: tx,
      targetTy: ty,
      summon: false,
    });
  };

  const handleSummonEntity = (entity: WorldEntityDescriptor) => {
    setSelectedEntityId(entity.entityId);
    setTargetX(String(adminTx));
    setTargetY(String(adminTy));
    onTeleportEntity?.({
      entityKind: entity.kind,
      entityId: entity.entityId,
      targetTx: adminTx,
      targetTy: adminTy,
      summon: true,
    });
  };

  const playerCount = entities.filter((e) => e.kind === 'player').length;
  const npcCount = entities.filter((e) => e.kind === 'npc').length;

  return (
    <div
      data-testid="admin-entity-panel"
      className="flex flex-col h-full w-full bg-[#eef7ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]"
    >
      {/* Top Header Bar */}
      <div className="px-3 py-2 bg-[#c4e0f8]/80 border-b-2 border-[#2c5885] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="admin-entities-back-to-menu"
            onClick={onBackToMenu}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#3b82f6] hover:bg-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <ArrowLeft size={11} />
            Tools Menu
          </button>
          <Users size={15} className="text-[#0369a1]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
            Entity Management
          </span>
          <span className="px-1.5 py-0.5 rounded-[5px] text-[10px] font-mono font-bold bg-white/85 text-[#1e3a8a] border border-[#93c5fd]">
            {activeWorldName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            data-testid="admin-entity-self-coords"
            className="px-2 py-1 rounded-[6px] text-[10px] font-mono font-bold bg-[#dcfce7] text-[#166534] border border-[#86efac] inline-flex items-center gap-1"
            title="Your current tile coordinates"
          >
            <Crosshair size={11} />
            You: ({adminTx}, {adminTy})
          </span>
          <button
            type="button"
            data-testid="admin-entity-refresh-btn"
            onClick={() => onRefreshEntities?.()}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/90 text-[#0369a1] border border-[#0284c7] hover:bg-[#e0f2fe] flex items-center gap-1 cursor-pointer"
            title="Refresh active players and NPCs in this world"
          >
            <RefreshCw size={11} />
            Sync
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#23476d] hover:text-[#091e3a] rounded-[6px] cursor-pointer"
            title="Close Entity Management"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusToast && (
        <div
          data-testid="admin-entity-toast"
          className="px-3 py-1.5 bg-[#dcfce7] border-b border-[#16a34a] text-[#14532d] text-[11px] font-medium flex items-center justify-between shrink-0"
        >
          <span>{statusToast}</span>
          <button type="button" onClick={() => setStatusToast(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Search & Filter Row */}
      <div className="p-2.5 bg-[#d4e8fb]/55 border-b border-[#4172a3]/60 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#23476d]" />
            <input
              data-testid="admin-entity-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search players, NPCs, or coordinates..."
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
          <div className="flex items-center gap-1 shrink-0">
            {(
              [
                { id: 'all', label: `All (${entities.length})` },
                { id: 'player', label: `Players (${playerCount})` },
                { id: 'npc', label: `NPCs (${npcCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`admin-entity-filter-${tab.id}`}
                onClick={() => setKindFilter(tab.id)}
                className={`px-2 py-1 rounded-[7px] text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                  kindFilter === tab.id
                    ? 'bg-[#0369a1] text-white border-[#0c4a6e]'
                    : 'bg-white/85 text-[#091e3a] border-[#4172a3] hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Entity Roster List */}
      <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
        {filteredEntities.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-[#475569]">
            <Users size={26} className="text-[#94a3b8] mb-2" />
            <p className="text-xs font-semibold text-[#1e293b]">
              No matching players or NPCs found in {activeWorldName}
            </p>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Click Sync to refresh active entities in this world.
            </p>
          </div>
        ) : (
          filteredEntities.map((entity) => {
            const isSelected = selectedEntityId === entity.entityId;
            const iconUrl = entity.itemId ? getItemIconUrl(entity.itemId) : null;
            return (
              <div
                key={entity.entityId}
                data-testid={`admin-entity-row-${entity.entityId}`}
                onClick={() => handleSelectEntity(entity)}
                className={`p-2.5 rounded-[8px] border-2 transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#dbeafe] border-[#0284c7] shadow-xs'
                    : 'bg-white/90 border-[#cbd5e1] hover:border-[#60a5fa] hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-[7px] flex items-center justify-center shrink-0 border ${
                      entity.kind === 'player'
                        ? 'bg-[#e0e7ff] border-[#818cf8] text-[#3730a3]'
                        : 'bg-[#fef3c7] border-[#f59e0b] text-[#92400e]'
                    }`}
                  >
                    {iconUrl ? (
                      <img src={iconUrl} alt={entity.name} className="w-6 h-6 pixelated" />
                    ) : (
                      <User size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-[#0f172a] truncate">
                        {entity.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase border ${
                          entity.kind === 'player'
                            ? 'bg-[#dbeafe] text-[#1e40af] border-[#93c5fd]'
                            : 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]'
                        }`}
                      >
                        {entity.kind === 'player'
                          ? entity.role === 'admin'
                            ? 'Admin Player'
                            : 'Player'
                          : 'World NPC'}
                      </span>
                      {typeof entity.level === 'number' && (
                        <span className="text-[10px] font-mono text-[#475569]">
                          Lv.{entity.level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-[#334155]">
                      <MapPin size={11} className="text-[#0284c7] shrink-0" />
                      <span>
                        Tile ({entity.tx}, {entity.ty})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    data-testid={`admin-entity-row-summon-${entity.entityId}`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleSummonEntity(entity);
                    }}
                    className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-[#ecfdf5] text-[#047857] border border-[#10b981] hover:bg-[#d1fae5] flex items-center gap-1 cursor-pointer"
                    title={`Summon ${entity.name} to (${adminTx}, ${adminTy})`}
                  >
                    <Sparkles size={11} />
                    Summon
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Entity Teleport Controls Footer */}
      <div className="p-3 bg-[#dbeafe]/80 border-t-2 border-[#2c5885] shrink-0">
        {selectedEntity ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <Navigation size={13} className="text-[#0369a1]" />
                <span>Selected: {selectedEntity.name}</span>
                <span className="text-[10px] font-mono font-normal text-[#334155]">
                  @ ({selectedEntity.tx}, {selectedEntity.ty})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargetX(String(adminTx));
                  setTargetY(String(adminTy));
                }}
                className="text-[10px] font-bold text-[#0369a1] hover:underline cursor-pointer"
              >
                Fill My Coords ({adminTx}, {adminTy})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] font-bold text-[#1e293b]">
                <span>X</span>
                <input
                  data-testid="admin-entity-target-x"
                  type="number"
                  min={0}
                  max={maxX}
                  value={targetX}
                  onChange={(e) => setTargetX(e.target.value)}
                  className="hud-input w-20 px-2 py-1 text-xs font-mono"
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] font-bold text-[#1e293b]">
                <span>Y</span>
                <input
                  data-testid="admin-entity-target-y"
                  type="number"
                  min={0}
                  max={maxY}
                  value={targetY}
                  onChange={(e) => setTargetY(e.target.value)}
                  className="hud-input w-20 px-2 py-1 text-xs font-mono"
                />
              </label>

              <button
                type="button"
                data-testid="admin-entity-teleport-btn"
                onClick={handleTeleportSelected}
                className="px-3 py-1.5 rounded-[7px] text-[11px] font-bold uppercase tracking-wider bg-[#0284c7] hover:bg-[#0369a1] text-white border border-[#075985] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Navigation size={12} />
                Teleport to Coords
              </button>

              <button
                type="button"
                data-testid="admin-entity-summon-btn"
                onClick={() => handleSummonEntity(selectedEntity)}
                className="px-3 py-1.5 rounded-[7px] text-[11px] font-bold uppercase tracking-wider bg-[#059669] hover:bg-[#047857] text-white border border-[#065f46] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Sparkles size={12} />
                Summon to Me
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#334155] flex items-center justify-between gap-2">
            <span>Select any active player or NPC above to teleport them to chosen coordinates or summon them to ({adminTx}, {adminTy}).</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminEntityPanel;
