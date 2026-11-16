import React, { useMemo, useState } from 'react';
import {
  DEFAULT_DATASET_VALUE_CONFIG,
  resolveDatasetLevelRequirement,
  sanitizeDatasetCurve,
  sanitizeDatasetValueConfig,
  type BuiltinDatasetKey,
  type DatasetProgressionCurve,
  type DatasetValueConfig,
  type GameConfig,
} from '../game/config.ts';
import { CROP_SPECS, getItemDef } from '../game/catalog.ts';
import { isOpeningFrameTickLocked, openingFrameTick } from '../game/openingFrameTick.ts';
import { formatHudNumber } from '../game/format.ts';

export interface AdminDatasetPanelProps {
  config: GameConfig;
  onUpdateDraftDatasets: (nextDatasets: DatasetValueConfig) => void;
  onSaveConfig: (nextConfig: GameConfig) => void;
  onBackToHub: () => void;
  onClose: () => void;
}

const BUILTIN_KEYS: BuiltinDatasetKey[] = [
  'playerMainXp',
  'cropMastery',
  'farmablockMastery',
  'worldCoreXp',
];

const DATASET_THEMES: Record<
  string,
  { badge: string; accentBorder: string; headerBg: string; pillBg: string; pillText: string }
> = {
  playerMainXp: {
    badge: 'PLAYER LEVEL',
    accentBorder: 'border-[#0284c7]',
    headerBg: 'from-[#e0f2fe] to-[#bae6fd]',
    pillBg: 'bg-[#0284c7]',
    pillText: 'text-[#0369a1]',
  },
  cropMastery: {
    badge: 'AGRICULTURE',
    accentBorder: 'border-[#16a34a]',
    headerBg: 'from-[#dcfce7] to-[#bbf7d0]',
    pillBg: 'bg-[#16a34a]',
    pillText: 'text-[#15803d]',
  },
  farmablockMastery: {
    badge: 'FARMABLOCKS',
    accentBorder: 'border-[#d97706]',
    headerBg: 'from-[#fef3c7] to-[#fde68a]',
    pillBg: 'bg-[#d97706]',
    pillText: 'text-[#b45309]',
  },
  worldCoreXp: {
    badge: 'WORLDCORE',
    accentBorder: 'border-[#7c3aed]',
    headerBg: 'from-[#ede9fe] to-[#ddd6fe]',
    pillBg: 'bg-[#7c3aed]',
    pillText: 'text-[#6d28d9]',
  },
};

export const AdminDatasetPanel: React.FC<AdminDatasetPanelProps> = ({
  config,
  onUpdateDraftDatasets,
  onSaveConfig,
  onBackToHub,
  onClose,
}) => {
  const datasets = useMemo(
    () => sanitizeDatasetValueConfig(config.datasets ?? DEFAULT_DATASET_VALUE_CONFIG),
    [config.datasets]
  );

  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Range modifier state inside a selected dataset menu
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(10);
  const [rangeDelta, setRangeDelta] = useState<number>(25);
  const [levelSearch, setLevelSearch] = useState<string>('');

  // New custom dataset form state in navigational hub
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomUnit, setNewCustomUnit] = useState('XP');
  const [newCustomDesc, setNewCustomDesc] = useState('');
  const [newCustomBase, setNewCustomBase] = useState(50);
  const [newCustomStep, setNewCustomStep] = useState(25);
  const [newCustomMaxLevel, setNewCustomMaxLevel] = useState(50);

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const allCurves = useMemo(() => {
    return [
      datasets.playerMainXp,
      datasets.cropMastery,
      datasets.farmablockMastery,
      datasets.worldCoreXp,
      ...datasets.customDatasets,
    ];
  }, [datasets]);

  const activeCurve = useMemo(() => {
    if (!selectedDatasetId) return null;
    return allCurves.find((c) => c.id === selectedDatasetId) ?? null;
  }, [allCurves, selectedDatasetId]);

  const commitDatasets = (next: DatasetValueConfig, autoSave = false, bannerMsg?: string) => {
    const clean = sanitizeDatasetValueConfig(next);
    onUpdateDraftDatasets(clean);
    if (autoSave) {
      onSaveConfig({
        ...config,
        datasets: clean,
      });
    }
    if (bannerMsg) {
      flashBanner(bannerMsg);
    }
  };

  const updateCurve = (
    datasetId: string,
    updater: (prev: DatasetProgressionCurve) => DatasetProgressionCurve,
    autoSave = false,
    bannerMsg?: string
  ) => {
    if (
      datasetId === 'playerMainXp' ||
      datasetId === 'cropMastery' ||
      datasetId === 'farmablockMastery' ||
      datasetId === 'worldCoreXp'
    ) {
      const updated = sanitizeDatasetCurve(
        updater(datasets[datasetId]),
        DEFAULT_DATASET_VALUE_CONFIG[datasetId]
      );
      commitDatasets(
        {
          ...datasets,
          [datasetId]: updated,
        },
        autoSave,
        bannerMsg
      );
      return;
    }

    const nextCustom = datasets.customDatasets.map((c) =>
      c.id === datasetId ? sanitizeDatasetCurve(updater(c), c) : c
    );
    commitDatasets(
      {
        ...datasets,
        customDatasets: nextCustom,
      },
      autoSave,
      bannerMsg
    );
  };

  const handleResetSingleDataset = (datasetId: string) => {
    if (isOpeningFrameTickLocked()) return;
    openingFrameTick();
    if (
      datasetId === 'playerMainXp' ||
      datasetId === 'cropMastery' ||
      datasetId === 'farmablockMastery' ||
      datasetId === 'worldCoreXp'
    ) {
      const fallback = JSON.parse(
        JSON.stringify(DEFAULT_DATASET_VALUE_CONFIG[datasetId])
      ) as DatasetProgressionCurve;
      commitDatasets(
        {
          ...datasets,
          [datasetId]: fallback,
        },
        true,
        `Reset ${fallback.label} to default progression values.`
      );
    } else {
      updateCurve(
        datasetId,
        (prev) => ({
          ...prev,
          baseAmount: 50,
          levelStepAmount: 25,
          growthFactor: 1,
          levelOverrides: {},
        }),
        true,
        'Reset custom dataset progression curve.'
      );
    }
  };

  const handleCreateCustomDataset = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOpeningFrameTickLocked()) return;
    const trimmed = newCustomLabel.trim();
    if (!trimmed) return;
    openingFrameTick();
    const slug =
      'custom_' +
      trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 28) +
      '_' +
      (datasets.customDatasets.length + 1);

    const created: DatasetProgressionCurve = sanitizeDatasetCurve(
      {
        id: slug,
        label: trimmed,
        unitLabel: newCustomUnit.trim() || 'XP',
        description:
          newCustomDesc.trim() ||
          `Custom progression dataset for ${trimmed} level advancement requirements.`,
        baseAmount: newCustomBase,
        levelStepAmount: newCustomStep,
        growthFactor: 1,
        maxLevel: newCustomMaxLevel,
        levelOverrides: {},
      },
      {
        id: slug,
        label: trimmed,
        unitLabel: 'XP',
        description: 'Custom progression dataset.',
        baseAmount: 50,
        levelStepAmount: 25,
        growthFactor: 1,
        maxLevel: 50,
        levelOverrides: {},
      }
    );

    const next: DatasetValueConfig = {
      ...datasets,
      customDatasets: [...datasets.customDatasets, created],
    };
    commitDatasets(next, true, `Added dataset "${created.label}"!`);
    setNewCustomLabel('');
    setNewCustomDesc('');
    setShowAddCustom(false);
    setSelectedDatasetId(created.id);
  };

  const handleDeleteCustomDataset = (datasetId: string) => {
    if (isOpeningFrameTickLocked()) return;
    openingFrameTick();
    const next: DatasetValueConfig = {
      ...datasets,
      customDatasets: datasets.customDatasets.filter((c) => c.id !== datasetId),
    };
    commitDatasets(next, true, 'Removed custom dataset.');
    if (selectedDatasetId === datasetId) {
      setSelectedDatasetId(null);
    }
  };

  // ============================================================================
  // VIEW 1: NAVIGATIONAL DATASET SELECTION MENU (HUB)
  // ============================================================================
  if (!activeCurve) {
    return (
      <div
        data-testid="admin-dataset-hub"
        className="flex flex-col h-full w-full bg-[#e6f3ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]"
      >
        {/* Top Bar */}
        <div className="px-3 py-2 bg-[#c4e0f8]/90 border-b-2 border-[#2c5885] flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="dataset-back-to-admin-hub"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick();
                onBackToHub();
              }}
              className="px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-wider bg-white/85 text-[#1e40af] border border-[#2c5885] hover:bg-white cursor-pointer"
            >
              ← Tools Hub
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
              DataSet Value Panel · Progression Navigator
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="dataset-save-all-btn"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick();
                onSaveConfig({
                  ...config,
                  datasets,
                });
                flashBanner('Saved all DataSet progression curves to live server!');
              }}
              className="px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-[#16a34a] text-white border border-[#14532d] hover:bg-[#15803d] cursor-pointer shadow-2xs"
            >
              Save All Datasets
            </button>
            <button
              type="button"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick();
                const fresh = JSON.parse(
                  JSON.stringify(DEFAULT_DATASET_VALUE_CONFIG)
                ) as DatasetValueConfig;
                commitDatasets(fresh, true, 'Reset all progression datasets to factory defaults.');
              }}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/80 text-[#991b1b] border border-[#dc2626]/60 hover:bg-[#fee2e2] cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/80 text-[#1e3a5f] border border-[#6495c2] hover:bg-white cursor-pointer"
            >
              [X]
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="px-3 py-1.5 bg-[#dcfce7] border-b border-[#16a34a] text-[#14532d] text-[11px] font-bold flex items-center justify-between shrink-0">
            <span>✓ {statusBanner}</span>
          </div>
        )}

        {/* Scrollable Dataset Variation Cards */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
          <div className="bg-white/85 border-2 border-[#6495c2] rounded-[8px] p-2.5 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
                Select User-Stored Progression Dataset
              </h3>
              <p className="text-[11px] text-[#335880]">
                Choose a progression dataset below to inspect and modify level-to-level advancement
                requirements, base values, step increments, or milestone unlocks.
              </p>
            </div>
            <button
              type="button"
              data-testid="dataset-toggle-add-custom"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick();
                setShowAddCustom((prev) => !prev);
              }}
              className="px-2.5 py-1.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-[#0284c7] text-white border border-[#0369a1] hover:bg-[#0369a1] cursor-pointer shrink-0"
            >
              {showAddCustom ? 'Cancel New Dataset' : '+ Add Progression Dataset'}
            </button>
          </div>

          {showAddCustom && (
            <form
              onSubmit={handleCreateCustomDataset}
              data-testid="dataset-add-custom-form"
              className="bg-white border-2 border-[#0284c7] rounded-[8px] p-3 flex flex-col gap-2.5 shadow-sm shrink-0"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369a1]">
                Create New Stored Progression Dataset
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Dataset Name</span>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    placeholder="e.g. Fishing Mastery XP"
                    value={newCustomLabel}
                    onChange={(e) => setNewCustomLabel(e.target.value)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs text-[#091e3a]"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Unit Label</span>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="e.g. Fish XP"
                    value={newCustomUnit}
                    onChange={(e) => setNewCustomUnit(e.target.value)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs text-[#091e3a]"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Max Level Cap</span>
                  <input
                    type="number"
                    min={5}
                    max={500}
                    value={newCustomMaxLevel}
                    onChange={(e) => setNewCustomMaxLevel(Number(e.target.value) || 50)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num text-[#091e3a]"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Lv.1 → Lv.2 Base Amount</span>
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={newCustomBase}
                    onChange={(e) => setNewCustomBase(Number(e.target.value) || 50)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num text-[#091e3a]"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Level-to-Level Step (+Amt)</span>
                  <input
                    type="number"
                    min={0}
                    max={500000}
                    value={newCustomStep}
                    onChange={(e) => setNewCustomStep(Number(e.target.value) || 0)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num text-[#091e3a]"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
                  <span>Description</span>
                  <input
                    type="text"
                    maxLength={140}
                    placeholder="Progression description..."
                    value={newCustomDesc}
                    onChange={(e) => setNewCustomDesc(e.target.value)}
                    className="px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs text-[#091e3a]"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  data-testid="dataset-create-custom-submit"
                  className="px-3 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-[#16a34a] text-white border border-[#14532d] hover:bg-[#15803d] cursor-pointer"
                >
                  Create & Open Dataset Menu
                </button>
              </div>
            </form>
          )}

          {/* Dataset Variation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
            {allCurves.map((curve) => {
              const theme = DATASET_THEMES[curve.id] ?? {
                badge: 'CUSTOM DATASET',
                accentBorder: 'border-[#0d9488]',
                headerBg: 'from-[#ccfbf1] to-[#99f6e4]',
                pillBg: 'bg-[#0d9488]',
                pillText: 'text-[#0f766e]',
              };
              const overrideCount = Object.keys(curve.levelOverrides ?? {}).length;
              const lv1Req = resolveDatasetLevelRequirement(curve, 1);
              const lv5Req = resolveDatasetLevelRequirement(curve, 5);
              const lv10Req = resolveDatasetLevelRequirement(curve, 10);
              const isBuiltin = BUILTIN_KEYS.includes(curve.id as BuiltinDatasetKey);

              return (
                <div
                  key={curve.id}
                  data-testid={`dataset-card-${curve.id}`}
                  className={`shrink-0 rounded-[10px] border-2 ${theme.accentBorder} bg-white/95 p-3.5 shadow-sm flex flex-col justify-between gap-2.5 hover:shadow-md transition-all`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-[4px] ${theme.pillBg} text-white text-[9px] font-bold uppercase tracking-wider`}
                      >
                        {theme.badge}
                      </span>
                      <span className="text-[10px] font-mono-num font-bold text-[#475569]">
                        Max Lv.{curve.maxLevel} · {overrideCount} Custom Overrides
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#091e3a]">{curve.label}</h4>
                    <p className="text-[11px] text-[#335880] leading-snug">{curve.description}</p>
                  </div>

                  {/* Formula & Level Progression Summary Box */}
                  <div
                    className={`rounded-[7px] bg-gradient-to-r ${theme.headerBg} p-2.5 border border-[#6495c2]/50 flex flex-col gap-1.5`}
                  >
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="bg-white/85 rounded-[5px] px-2 py-1 border border-[#93c5fd]/60">
                        <span className="block text-[9px] text-[#475569] uppercase">Base (Lv.1)</span>
                        <span className="font-mono-num font-bold text-[#091e3a]">
                          {formatHudNumber(curve.baseAmount)} {curve.unitLabel}
                        </span>
                      </div>
                      <div className="bg-white/85 rounded-[5px] px-2 py-1 border border-[#93c5fd]/60">
                        <span className="block text-[9px] text-[#475569] uppercase">Per-Level Step</span>
                        <span className="font-mono-num font-bold text-[#091e3a]">
                          +{formatHudNumber(curve.levelStepAmount)} {curve.unitLabel}
                        </span>
                      </div>
                      <div className="bg-white/85 rounded-[5px] px-2 py-1 border border-[#93c5fd]/60">
                        <span className="block text-[9px] text-[#475569] uppercase">Curve Scale</span>
                        <span className="font-mono-num font-bold text-[#091e3a]">
                          {curve.growthFactor.toFixed(2)}×
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono-num text-[#0f172a] px-1 pt-0.5">
                      <span>L1→2: {formatHudNumber(lv1Req)}</span>
                      <span>·</span>
                      <span>L5→6: {formatHudNumber(lv5Req)}</span>
                      <span>·</span>
                      <span>L10→11: {formatHudNumber(lv10Req)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      data-testid={`open-dataset-menu-${curve.id}`}
                      onClick={() => {
                        if (isOpeningFrameTickLocked()) return;
                        openingFrameTick();
                        setSelectedDatasetId(curve.id);
                        setRangeStart(1);
                        setRangeEnd(Math.min(10, curve.maxLevel));
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-[6px] ${theme.pillBg} hover:opacity-95 text-white font-bold text-[11px] uppercase tracking-wider cursor-pointer transition-opacity`}
                    >
                      Open {curve.label} Menu →
                    </button>
                    {!isBuiltin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomDataset(curve.id)}
                        className="px-2.5 py-1.5 rounded-[6px] bg-[#fee2e2] text-[#991b1b] border border-[#dc2626] text-[10px] font-bold uppercase cursor-pointer hover:bg-[#fecaca]"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: INDIVIDUAL INTERACTIVE DATASET LEVEL ADVANCEMENT EDITOR
  // ============================================================================
  const theme = DATASET_THEMES[activeCurve.id] ?? {
    badge: 'CUSTOM DATASET',
    accentBorder: 'border-[#0d9488]',
    headerBg: 'from-[#ccfbf1] to-[#99f6e4]',
    pillBg: 'bg-[#0d9488]',
    pillText: 'text-[#0f766e]',
  };

  // Build level-by-level table rows with cumulative total
  const levelRows = (() => {
    const rows: Array<{
      level: number;
      requiredAmount: number;
      formulaAmount: number;
      isOverridden: boolean;
      cumulativeBefore: number;
      cumulativeAfter: number;
    }> = [];
    let cumulative = 0;
    for (let lvl = 1; lvl <= activeCurve.maxLevel; lvl++) {
      const formulaAmount = Math.max(
        1,
        Math.round(
          (activeCurve.baseAmount + (lvl - 1) * activeCurve.levelStepAmount) *
            activeCurve.growthFactor
        )
      );
      const overrideVal = activeCurve.levelOverrides?.[lvl];
      const isOverridden =
        typeof overrideVal === 'number' && Number.isFinite(overrideVal) && overrideVal >= 1;
      const requiredAmount = isOverridden ? Math.round(overrideVal) : formulaAmount;
      const cumulativeBefore = cumulative;
      cumulative += requiredAmount;
      rows.push({
        level: lvl,
        requiredAmount,
        formulaAmount,
        isOverridden,
        cumulativeBefore,
        cumulativeAfter: cumulative,
      });
    }
    if (!levelSearch.trim()) return rows;
    const q = Number(levelSearch.trim());
    if (Number.isFinite(q) && q >= 1) {
      return rows.filter((r) => r.level === q || String(r.level).includes(levelSearch.trim()));
    }
    return rows;
  })();

  const applyBulkRangeDelta = (mode: 'add' | 'set' | 'clear') => {
    if (isOpeningFrameTickLocked()) return;
    openingFrameTick();
    const lo = Math.max(1, Math.min(activeCurve.maxLevel, Math.min(rangeStart, rangeEnd)));
    const hi = Math.max(lo, Math.min(activeCurve.maxLevel, Math.max(rangeStart, rangeEnd)));
    updateCurve(
      activeCurve.id,
      (prev) => {
        const nextOverrides = { ...(prev.levelOverrides ?? {}) };
        for (let lvl = lo; lvl <= hi; lvl++) {
          if (mode === 'clear') {
            delete nextOverrides[lvl];
          } else if (mode === 'set') {
            nextOverrides[lvl] = Math.max(1, Math.round(rangeDelta));
          } else {
            const currentReq = resolveDatasetLevelRequirement(prev, lvl);
            nextOverrides[lvl] = Math.max(1, Math.round(currentReq + rangeDelta));
          }
        }
        return {
          ...prev,
          levelOverrides: nextOverrides,
        };
      },
      false,
      mode === 'clear'
        ? `Cleared custom overrides for Lv.${lo}–Lv.${hi}.`
        : mode === 'set'
          ? `Set Lv.${lo}–Lv.${hi} requirement to ${formatHudNumber(Math.max(1, Math.round(rangeDelta)))} ${activeCurve.unitLabel}.`
          : `Adjusted Lv.${lo}–Lv.${hi} requirements by ${rangeDelta >= 0 ? '+' : ''}${formatHudNumber(rangeDelta)} ${activeCurve.unitLabel}.`
    );
  };

  return (
    <div
      data-testid={`dataset-editor-${activeCurve.id}`}
      className="flex flex-col h-full w-full bg-[#e6f3ff] text-[#091e3a] select-none overflow-hidden rounded-[8px]"
    >
      {/* Top Bar */}
      <div className="px-3 py-2 bg-[#c4e0f8]/90 border-b-2 border-[#2c5885] flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="dataset-back-to-selector"
            onClick={() => {
              if (isOpeningFrameTickLocked()) return;
              openingFrameTick();
              setSelectedDatasetId(null);
            }}
            className="px-2 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-wider bg-white/90 text-[#1e40af] border border-[#2c5885] hover:bg-white cursor-pointer"
          >
            ← Dataset Menu
          </button>
          <span
            className={`px-2 py-0.5 rounded-[4px] ${theme.pillBg} text-white text-[9px] font-bold uppercase`}
          >
            {theme.badge}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
            {activeCurve.label} Advancement Editor
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="dataset-editor-save-btn"
            onClick={() => {
              if (isOpeningFrameTickLocked()) return;
              openingFrameTick();
              onSaveConfig({
                ...config,
                datasets,
              });
              flashBanner(`Saved ${activeCurve.label} progression requirements!`);
            }}
            className="px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider bg-[#16a34a] text-white border border-[#14532d] hover:bg-[#15803d] cursor-pointer shadow-2xs"
          >
            Save & Apply Live
          </button>
          <button
            type="button"
            data-testid="dataset-editor-reset-btn"
            onClick={() => handleResetSingleDataset(activeCurve.id)}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/85 text-[#991b1b] border border-[#dc2626]/60 hover:bg-[#fee2e2] cursor-pointer"
          >
            Reset Curve
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase bg-white/85 text-[#1e3a5f] border border-[#6495c2] hover:bg-white cursor-pointer"
          >
            [X]
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="px-3 py-1.5 bg-[#dcfce7] border-b border-[#16a34a] text-[#14532d] text-[11px] font-bold flex items-center justify-between shrink-0">
          <span>✓ {statusBanner}</span>
        </div>
      )}

      {/* Main Editor Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Section 1: Core Progression Formula & Level-to-Level Step Controls */}
        <div className="bg-white/95 border-2 border-[#6495c2] rounded-[8px] p-3 flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
                1. Progression Curve & Level-to-Level Formula
              </h3>
              <p className="text-[11px] text-[#335880]">
                Formula: <span className="font-mono-num font-bold text-[#091e3a]">Required(Lv) = (Base + (Lv - 1) × Step) × Scale</span> (unless overridden for a specific level below).
              </p>
            </div>
            <span className="text-[10px] font-mono-num font-bold text-[#0369a1] bg-[#e0f2fe] px-2 py-0.5 rounded-[5px] border border-[#7dd3fc]">
              Unit: {activeCurve.unitLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {/* Base Level 1 Amount */}
            <div className="bg-[#f0f7ff] border border-[#93c5fd] rounded-[6px] p-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#1e3a5f] uppercase">
                Lv.1 → Lv.2 Base Amount
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      baseAmount: Math.max(1, prev.baseAmount - 10),
                    }))
                  }
                  className="px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-[10px] font-bold cursor-pointer hover:bg-[#e0f2fe]"
                >
                  -10
                </button>
                <input
                  type="number"
                  data-testid="dataset-base-amount-input"
                  min={1}
                  max={1000000}
                  value={activeCurve.baseAmount}
                  onChange={(e) =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      baseAmount: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-xs font-mono-num font-bold text-center text-[#091e3a]"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      baseAmount: Math.min(1000000, prev.baseAmount + 10),
                    }))
                  }
                  className="px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-[10px] font-bold cursor-pointer hover:bg-[#e0f2fe]"
                >
                  +10
                </button>
              </div>
            </div>

            {/* Level-to-Level Increment */}
            <div className="bg-[#f0f7ff] border border-[#93c5fd] rounded-[6px] p-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#1e3a5f] uppercase">
                Level-to-Level Step (+Amt)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      levelStepAmount: Math.max(0, prev.levelStepAmount - 5),
                    }))
                  }
                  className="px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-[10px] font-bold cursor-pointer hover:bg-[#e0f2fe]"
                >
                  -5
                </button>
                <input
                  type="number"
                  data-testid="dataset-step-amount-input"
                  min={0}
                  max={500000}
                  value={activeCurve.levelStepAmount}
                  onChange={(e) =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      levelStepAmount: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-full px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-xs font-mono-num font-bold text-center text-[#091e3a]"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      levelStepAmount: Math.min(500000, prev.levelStepAmount + 5),
                    }))
                  }
                  className="px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-[10px] font-bold cursor-pointer hover:bg-[#e0f2fe]"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Growth Factor Multiplier */}
            <div className="bg-[#f0f7ff] border border-[#93c5fd] rounded-[6px] p-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#1e3a5f] uppercase">
                Range Scale Multiplier
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  data-testid="dataset-growth-factor-input"
                  step={0.05}
                  min={0.1}
                  max={10}
                  value={activeCurve.growthFactor}
                  onChange={(e) =>
                    updateCurve(activeCurve.id, (prev) => ({
                      ...prev,
                      growthFactor: Math.max(0.1, Math.min(10, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-xs font-mono-num font-bold text-center text-[#091e3a]"
                />
              </div>
            </div>

            {/* Max Level Cap */}
            <div className="bg-[#f0f7ff] border border-[#93c5fd] rounded-[6px] p-2 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-[#1e3a5f] uppercase">
                Max Progression Level
              </span>
              <input
                type="number"
                data-testid="dataset-max-level-input"
                min={5}
                max={500}
                value={activeCurve.maxLevel}
                onChange={(e) =>
                  updateCurve(activeCurve.id, (prev) => ({
                    ...prev,
                    maxLevel: Math.max(5, Math.min(500, Number(e.target.value) || 50)),
                  }))
                }
                className="w-full px-2 py-1 rounded-[4px] bg-white border border-[#6495c2] text-xs font-mono-num font-bold text-center text-[#091e3a]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Bulk Range Modification Tool */}
        <div className="bg-white/95 border-2 border-[#6495c2] rounded-[8px] p-3 flex flex-col gap-2 shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
            2. Bulk Progression Range Editor (Apply Across Level Span)
          </span>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
              <span>From Level</span>
              <input
                type="number"
                min={1}
                max={activeCurve.maxLevel}
                value={rangeStart}
                onChange={(e) => setRangeStart(Number(e.target.value) || 1)}
                className="w-20 px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num font-bold"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
              <span>To Level</span>
              <input
                type="number"
                min={1}
                max={activeCurve.maxLevel}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(Number(e.target.value) || activeCurve.maxLevel)}
                className="w-20 px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num font-bold"
              />
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] font-bold text-[#1e3a5f]">
              <span>Amount / Delta ({activeCurve.unitLabel})</span>
              <input
                type="number"
                data-testid="dataset-range-delta-input"
                value={rangeDelta}
                onChange={(e) => setRangeDelta(Number(e.target.value) || 0)}
                className="w-28 px-2 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs font-mono-num font-bold"
              />
            </label>
            <button
              type="button"
              data-testid="dataset-range-add-btn"
              onClick={() => applyBulkRangeDelta('add')}
              className="px-2.5 py-1.5 rounded-[5px] bg-[#0284c7] text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-[#0369a1]"
            >
              Add Delta to Range
            </button>
            <button
              type="button"
              data-testid="dataset-range-set-btn"
              onClick={() => applyBulkRangeDelta('set')}
              className="px-2.5 py-1.5 rounded-[5px] bg-[#0d9488] text-white text-[10px] font-bold uppercase cursor-pointer hover:bg-[#0f766e]"
            >
              Set Fixed Value on Range
            </button>
            <button
              type="button"
              data-testid="dataset-range-clear-btn"
              onClick={() => applyBulkRangeDelta('clear')}
              className="px-2.5 py-1.5 rounded-[5px] bg-white text-[#475569] border border-[#6495c2] text-[10px] font-bold uppercase cursor-pointer hover:bg-[#f1f5f9]"
            >
              Restore Formula on Range
            </button>
          </div>
        </div>

        {/* Section 2B: Unlock Milestone Thresholds (for Crop Mastery & Farmablock Mastery) */}
        {activeCurve.id === 'cropMastery' && (
          <div className="bg-white/95 border-2 border-[#16a34a] rounded-[8px] p-3 flex flex-col gap-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#15803d]">
              Crop Tier Mastery Level Unlock Requirements
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {CROP_SPECS.map((crop) => {
                const seedDef = getItemDef(crop.seedId);
                const reqLvl = activeCurve.unlockLevelOverrides?.[crop.seedId] ?? 1;
                return (
                  <label
                    key={crop.seedId}
                    className="bg-[#f0fdf4] border border-[#86efac] rounded-[6px] p-2 flex flex-col gap-1 text-[10px]"
                  >
                    <span className="font-bold text-[#14532d] truncate">
                      {seedDef?.name ?? `Crop #${crop.seedId}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[#15803d] font-semibold">Req Lv.</span>
                      <input
                        type="number"
                        min={1}
                        max={activeCurve.maxLevel}
                        value={reqLvl}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          updateCurve('cropMastery', (prev) => ({
                            ...prev,
                            unlockLevelOverrides: {
                              ...(prev.unlockLevelOverrides ?? {}),
                              [crop.seedId]: val,
                            },
                          }));
                        }}
                        className="w-full px-1.5 py-0.5 rounded-[4px] bg-white border border-[#16a34a] font-mono-num font-bold text-xs text-[#091e3a]"
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {activeCurve.id === 'farmablockMastery' && (
          <div className="bg-white/95 border-2 border-[#d97706] rounded-[8px] p-3 flex flex-col gap-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#b45309]">
              Farmablock Tier 1–8 Mastery Level Unlock Requirements
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((tier) => {
                const reqLvl = activeCurve.unlockLevelOverrides?.[tier] ?? 1;
                return (
                  <label
                    key={tier}
                    className="bg-[#fffbeb] border border-[#fcd34d] rounded-[6px] p-2 flex flex-col gap-1 text-[10px]"
                  >
                    <span className="font-bold text-[#92400e]">Tier {tier} Blocks</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[#b45309] font-semibold">Lv.</span>
                      <input
                        type="number"
                        min={1}
                        max={activeCurve.maxLevel}
                        value={reqLvl}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 1);
                          updateCurve('farmablockMastery', (prev) => ({
                            ...prev,
                            unlockLevelOverrides: {
                              ...(prev.unlockLevelOverrides ?? {}),
                              [tier]: val,
                            },
                          }));
                        }}
                        className="w-full px-1.5 py-0.5 rounded-[4px] bg-white border border-[#d97706] font-mono-num font-bold text-xs text-[#091e3a]"
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3: Interactive Level-to-Level Advancement Table */}
        <div className="bg-white/95 border-2 border-[#6495c2] rounded-[8px] p-3 flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#091e3a]">
                3. Level-to-Level Advancement Requirement Table (Lv.1 → Lv.{activeCurve.maxLevel})
              </h3>
              <p className="text-[11px] text-[#335880]">
                Edit any individual level transition directly to set custom advancement requirements.
              </p>
            </div>
            <input
              type="text"
              placeholder="Filter level #..."
              value={levelSearch}
              onChange={(e) => setLevelSearch(e.target.value)}
              className="w-36 px-2.5 py-1 rounded-[5px] bg-[#f0f7ff] border border-[#6495c2] text-xs"
            />
          </div>

          <div className="max-h-72 overflow-y-auto border border-[#cbd5e1] rounded-[6px] divide-y divide-[#e2e8f0]">
            {levelRows.map((row) => (
              <div
                key={row.level}
                data-testid={`dataset-level-row-${row.level}`}
                className={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs ${
                  row.isOverridden ? 'bg-[#fef9c3]/55' : 'bg-white hover:bg-[#f8fafc]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#e0f2fe] border border-[#7dd3fc] font-mono-num font-bold text-[10px] text-[#0369a1] shrink-0">
                    Lv.{row.level} → Lv.{row.level + 1}
                  </span>
                  {row.isOverridden ? (
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-[#fde047] text-[#854d0e] font-bold text-[9px] uppercase">
                      Custom Override (Formula: {formatHudNumber(row.formulaAmount)})
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#64748b] font-mono-num">
                      Formula Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-[#475569] font-mono-num hidden sm:inline mr-2">
                    Cumulative: {formatHudNumber(row.cumulativeAfter)} {activeCurve.unitLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateCurve(activeCurve.id, (prev) => ({
                        ...prev,
                        levelOverrides: {
                          ...(prev.levelOverrides ?? {}),
                          [row.level]: Math.max(1, row.requiredAmount - 10),
                        },
                      }))
                    }
                    className="px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] border border-[#94a3b8] text-[10px] font-bold cursor-pointer hover:bg-[#e2e8f0]"
                  >
                    -10
                  </button>
                  <input
                    type="number"
                    data-testid={`dataset-level-input-${row.level}`}
                    min={1}
                    max={10000000}
                    value={row.requiredAmount}
                    onChange={(e) => {
                      const val = Math.max(1, Math.round(Number(e.target.value) || 1));
                      updateCurve(activeCurve.id, (prev) => ({
                        ...prev,
                        levelOverrides: {
                          ...(prev.levelOverrides ?? {}),
                          [row.level]: val,
                        },
                      }));
                    }}
                    className="w-24 px-2 py-0.5 rounded-[4px] bg-white border border-[#6495c2] font-mono-num font-bold text-xs text-center text-[#091e3a]"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateCurve(activeCurve.id, (prev) => ({
                        ...prev,
                        levelOverrides: {
                          ...(prev.levelOverrides ?? {}),
                          [row.level]: Math.min(10000000, row.requiredAmount + 10),
                        },
                      }))
                    }
                    className="px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] border border-[#94a3b8] text-[10px] font-bold cursor-pointer hover:bg-[#e2e8f0]"
                  >
                    +10
                  </button>
                  {row.isOverridden && (
                    <button
                      type="button"
                      onClick={() =>
                        updateCurve(activeCurve.id, (prev) => {
                          const nextOv = { ...(prev.levelOverrides ?? {}) };
                          delete nextOv[row.level];
                          return {
                            ...prev,
                            levelOverrides: nextOv,
                          };
                        })
                      }
                      className="px-1.5 py-0.5 rounded-[4px] bg-[#fee2e2] text-[#991b1b] border border-[#f87171] text-[9px] font-bold uppercase cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDatasetPanel;
