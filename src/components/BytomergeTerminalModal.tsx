import React, { useEffect, useMemo, useState } from 'react';
import { ITEM_IDS } from '../game/catalog.ts';
import type { InventorySlot } from '../game/network.ts';
import {
  getPixostaticMarketSnapshot,
  PIXOBYTE_BASE_RATE,
  PIXOBYTE_MAX_DROP_PCT,
  PIXOBYTE_MAX_GAIN_PCT,
  PIXOBYTE_MAX_RATE,
  PIXOBYTE_MIN_RATE,
} from '../game/pixobyteMarket.ts';
import { isOpeningFrameTickLocked, openingFrameTick } from '../game/openingFrameTick.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import { soundEngine } from '../game/audio.ts';
import { DigiBitsIcon } from './DigiBitsIcon.tsx';
import { PixobyteIcon } from './PixobyteIcon.tsx';
import { RedGemIcon } from './RedGemIcon.tsx';

export interface BytomergeTerminalModalProps {
  gems: number;
  alterbits: number;
  pixobytes: number;
  inventory: InventorySlot[];
  unclaimedWl?: number;
  coreTokens?: number;
  onBuyPixobyte: (qty: number) => void;
  onClose: () => void;
}

export interface OwnedWalletBrick {
  id: string;
  name: string;
  subtitle: string;
  qty: number;
  accentBorder: string;
  badgeColor: string;
  renderIcon: (compact?: boolean) => React.ReactNode;
}

export function buildOwnedWalletBricks(opts: {
  gems: number;
  alterbits: number;
  pixobytes: number;
  inventory: InventorySlot[];
  unclaimedWl?: number;
  coreTokens?: number;
}): OwnedWalletBrick[] {
  const wlInBag =
    opts.inventory.find((s) => s.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;
  const wlOwned = wlInBag + Math.max(0, Math.floor(opts.unclaimedWl ?? 0));
  const wlIconUrl = getItemIconUrl(ITEM_IDS.WORLD_LOCK);
  const coreTokenIconUrl = getItemIconUrl(ITEM_IDS.WORLD_CORE);

  const catalog: OwnedWalletBrick[] = [
    {
      id: 'gems',
      name: 'Gems',
      subtitle: 'Crystal Shards · Store & Upgrades',
      qty: Math.max(0, Math.floor(opts.gems || 0)),
      accentBorder: 'border-rose-400/60',
      badgeColor: 'text-rose-300',
      renderIcon: (compact) => (
        <RedGemIcon className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-5 h-5 shrink-0'} />
      ),
    },
    {
      id: 'digibits',
      name: 'DigiBits',
      subtitle: 'Crop & Bytomerge Exchange Tender',
      qty: Math.max(0, Math.floor(opts.alterbits || 0)),
      accentBorder: 'border-teal-400/65',
      badgeColor: 'text-teal-200',
      renderIcon: (compact) => (
        <DigiBitsIcon className={compact ? 'w-3.5 h-3.5 shrink-0' : 'w-5 h-5 shrink-0'} />
      ),
    },
    {
      id: 'pixobyte',
      name: 'Pixobyte',
      subtitle: 'Cryptic Bytomerge Token · Non-Reversible',
      qty: Math.max(0, Math.floor(opts.pixobytes || 0)),
      accentBorder: 'border-fuchsia-400/70',
      badgeColor: 'text-fuchsia-200',
      renderIcon: (compact) => (
        <PixobyteIcon size={compact ? 15 : 22} className="shrink-0" />
      ),
    },
    {
      id: 'world_locks',
      name: 'World Locks',
      subtitle: 'Global Exchange Trade Standard',
      qty: Math.max(0, Math.floor(wlOwned || 0)),
      accentBorder: 'border-amber-400/65',
      badgeColor: 'text-amber-200',
      renderIcon: (compact) => (
        <img
          src={wlIconUrl}
          alt="World Lock"
          className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} pixelated object-contain shrink-0`}
        />
      ),
    },
    {
      id: 'core_tokens',
      name: 'Core Tokens',
      subtitle: 'WorldCore Synthesis Currency',
      qty: Math.max(0, Math.floor(opts.coreTokens || 0)),
      accentBorder: 'border-cyan-400/65',
      badgeColor: 'text-cyan-200',
      renderIcon: (compact) => (
        <img
          src={coreTokenIconUrl}
          alt="Core Token"
          className={`${compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} pixelated object-contain shrink-0`}
        />
      ),
    },
  ];

  // Strictly return only currencies/tokens currently in the user's possession (qty > 0).
  // Any newly acquired currency variant (e.g. Pixobyte) automatically appears once owned.
  return catalog.filter((brick) => brick.qty > 0);
}

export const BytomergeTerminalModal: React.FC<BytomergeTerminalModalProps> = ({
  gems,
  alterbits,
  pixobytes,
  inventory,
  unclaimedWl = 0,
  coreTokens = 0,
  onBuyPixobyte,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'hub' | 'rates'>('hub');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [buyQtyInput, setBuyQtyInput] = useState<string>('1');

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const market = useMemo(() => getPixostaticMarketSnapshot(nowMs), [nowMs]);
  const ownedBricks = useMemo(
    () =>
      buildOwnedWalletBricks({
        gems,
        alterbits,
        pixobytes,
        inventory,
        unclaimedWl,
        coreTokens,
      }),
    [gems, alterbits, pixobytes, inventory, unclaimedWl, coreTokens]
  );

  const parsedQty = Math.max(1, Math.min(999, Math.floor(Number(buyQtyInput) || 1)));
  const totalCostDb = parsedQty * market.currentRate;
  const canAfford = alterbits >= totalCostDb;
  const maxAffordable = Math.max(1, Math.floor(alterbits / Math.max(1, market.currentRate)));

  const nextTickSec = Math.max(1, Math.ceil(market.nextTickInMs / 1000));
  const isBelowBase = market.currentRate <= PIXOBYTE_BASE_RATE;
  const deltaSign = market.deviationPct > 0 ? '+' : '';
  const minDeltaPctLabel = -(PIXOBYTE_MAX_DROP_PCT * 100).toFixed(1);
  const maxDeltaPctLabel = (PIXOBYTE_MAX_GAIN_PCT * 100).toFixed(1);

  return (
    <div
      data-testid="bytomerge-terminal-modal"
      className="bytomerge-terminal-box hud-window-enter w-[min(94vw,470px)] p-3.5 pointer-events-auto shadow-2xl"
    >
      {/* Cryptic Digital Terminal Header */}
      <div className="bytomerge-terminal-header flex items-center justify-between px-3 py-2 -mx-3.5 -mt-3.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#09182c] border border-teal-400/70 flex items-center justify-center shrink-0 shadow-inner">
            <PixobyteIcon size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono-num uppercase tracking-widest px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-400/50 text-teal-200 font-bold">
                PIXOBYTE DIGICHANGE // 1×2 NODE
              </span>
            </div>
            <h3 className="text-sm font-pixel tracking-wider text-teal-100 truncate mt-0.5">
              Centralised Bytomerge Terminal
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {viewMode === 'rates' && (
            <button
              type="button"
              data-testid="bytomerge-back-hub-btn"
              onClick={() => {
                if (isOpeningFrameTickLocked()) return;
                openingFrameTick(4);
                soundEngine.uiClick();
                setViewMode('hub');
              }}
              className="px-2.5 py-1 rounded-md text-[10px] font-pixel uppercase tracking-wider bg-slate-800/90 hover:bg-slate-700 text-teal-200 border border-teal-400/50 cursor-pointer"
            >
              ← Terminal Hub
            </button>
          )}
          <button
            type="button"
            data-testid="bytomerge-close-btn"
            onClick={() => {
              if (isOpeningFrameTickLocked()) return;
              openingFrameTick(4);
              soundEngine.uiClick();
              onClose();
            }}
            className="px-2.5 py-1 rounded-md text-[10px] font-pixel uppercase tracking-wider bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-400/50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Persistent Cryptic User Currency Wallet Header Strip (Brick Pill by Brick Pill) */}
      <div className="mb-3 rounded-lg bg-[#081324]/90 border border-teal-500/40 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-pixel uppercase tracking-wider text-teal-300/90">
            User Currency Wallet · Owned Bricks Only
          </span>
          <span className="text-[9px] font-mono-num text-purple-300/85">
            {ownedBricks.length} Active Variant{ownedBricks.length === 1 ? '' : 's'}
          </span>
        </div>

        {ownedBricks.length === 0 ? (
          <div
            data-testid="bytomerge-wallet-empty"
            className="bytomerge-brick-pill px-3 py-2 text-[10px] text-teal-200/75 font-mono-num text-center"
          >
            No owned currencies detected yet — harvest blocks or sell crops for DigiBits to populate wallet bricks.
          </div>
        ) : (
          <div
            data-testid="bytomerge-wallet-bricks"
            className="flex flex-col gap-1.5"
          >
            {ownedBricks.map((brick) => (
              <div
                key={brick.id}
                data-testid={`bytomerge-wallet-brick-${brick.id}`}
                className={`bytomerge-brick-pill px-2.5 py-1.5 flex items-center justify-between gap-2 border ${brick.accentBorder}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-[#060f1e] border border-teal-400/35 flex items-center justify-center shrink-0">
                    {brick.renderIcon(false)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-pixel text-teal-50 tracking-wide leading-tight truncate">
                      {brick.name}
                    </div>
                    <div className="text-[9px] text-teal-300/70 leading-tight truncate">
                      {brick.subtitle}
                    </div>
                  </div>
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-[#050c18]/90 border border-teal-300/40 flex items-center gap-1.5 shrink-0">
                  {brick.renderIcon(true)}
                  <span className={`text-xs font-mono-num font-bold ${brick.badgeColor}`}>
                    {brick.qty.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'hub' ? (
        <div key="bytomerge-hub" className="hud-subview-enter space-y-2.5">
          {/* Cryptic Status Banner */}
          <div className="rounded-lg bg-gradient-to-r from-[#0d2238]/90 via-[#151c3b]/90 to-[#1e153a]/90 border border-purple-400/45 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-mono-num uppercase tracking-widest text-purple-300">
                  BYTOMERGE CRYPTO-SYNTHESIS PROTOCOL
                </div>
                <div className="text-xs font-pixel text-teal-100 mt-0.5">
                  Synthesize DigiBits into High-Density Pixobyte Coins
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase text-teal-300/75 font-mono-num">
                  Live Spot Rate
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06101e] border border-teal-400/50 text-xs font-mono-num font-bold text-teal-200">
                  <DigiBitsIcon className="w-3.5 h-3.5 shrink-0" />
                  {market.currentRate.toLocaleString()}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-teal-200/80 leading-snug mt-1.5">
              Pixobyte coins are stored directly inside your Currency Wallet once acquired. Any newly minted currency variant automatically appends its own Brick Pill to your wallet.
            </p>
          </div>

          {/* Outstanding Action Button -> Current Pixostatic Rates */}
          <button
            type="button"
            data-testid="open-pixostatic-rates-btn"
            onClick={() => {
              if (isOpeningFrameTickLocked()) return;
              openingFrameTick(4);
              soundEngine.uiClick();
              setViewMode('rates');
            }}
            className="w-full rounded-xl p-3 text-left cursor-pointer transition-all bg-gradient-to-r from-teal-600/35 via-cyan-600/30 to-purple-600/35 hover:from-teal-500/45 hover:to-purple-500/45 border-2 border-teal-300/80 shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#071324] border border-teal-300/70 flex items-center justify-center shrink-0">
                <PixobyteIcon size={28} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-pixel uppercase tracking-wider text-teal-100">
                    Current Pixostatic Rates
                  </span>
                  <span
                    className={`text-[9px] font-mono-num font-bold px-1.5 py-0.5 rounded-full border ${
                      isBelowBase
                        ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-300'
                        : 'bg-amber-950/80 border-amber-400/60 text-amber-300'
                    }`}
                  >
                    {deltaSign}
                    {market.deviationPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-teal-200/85 truncate mt-0.5">
                  Open live DigiBit → Pixobyte stock ticker & synthesis desk
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-400/20 border border-teal-300/60 text-[10px] font-pixel text-teal-100 shrink-0">
              OPEN →
            </span>
          </button>
        </div>
      ) : (
        <div
          key="bytomerge-rates"
          data-testid="pixostatic-rates-view"
          className="hud-subview-enter space-y-2.5"
        >
          {/* Pixostatic Live Ticker Card */}
          <div className="rounded-lg bg-[#071120]/95 border border-teal-400/55 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PixobyteIcon size={24} />
                <div>
                  <div className="text-xs font-pixel text-teal-100 uppercase tracking-wide">
                    Current Pixostatic Rates · PXB/DGB
                  </div>
                  <div className="text-[9px] font-mono-num text-teal-300/75">
                    Base Midpoint: {PIXOBYTE_BASE_RATE.toLocaleString()} DB · Band [{minDeltaPctLabel}% .. +{maxDeltaPctLabel}%]
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0c1e36] border border-teal-300/65 text-xs font-mono-num font-bold text-teal-100">
                  <DigiBitsIcon className="w-3.5 h-3.5 shrink-0" />
                  <span data-testid="pixostatic-current-rate">
                    {market.currentRate.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-teal-300 font-normal">DB / 1 PXB</span>
                </div>
                <div className="text-[9px] font-mono-num text-purple-300 mt-0.5">
                  Next pulse in {nextTickSec}s ({deltaSign}
                  {market.deviationPct.toFixed(1)}% vs base)
                </div>
              </div>
            </div>

            {/* 24-Tick Stock Waveform Bar Graph */}
            <div className="rounded-md bg-[#040a14] border border-teal-500/35 px-2 py-2">
              <div className="flex items-end justify-between gap-1 h-14">
                {market.history.map((rateVal, idx) => {
                  const norm =
                    (rateVal - PIXOBYTE_MIN_RATE) /
                    Math.max(1, PIXOBYTE_MAX_RATE - PIXOBYTE_MIN_RATE);
                  const heightPct = Math.max(14, Math.min(100, Math.round(14 + norm * 86)));
                  const isLatest = idx === market.history.length - 1;
                  const favorable = rateVal <= PIXOBYTE_BASE_RATE;
                  const ptDeltaPct = Number(
                    (((rateVal - PIXOBYTE_BASE_RATE) / PIXOBYTE_BASE_RATE) * 100).toFixed(1)
                  );
                  return (
                    <div
                      key={`${market.tickIndex}-${idx}`}
                      title={`${rateVal.toLocaleString()} DigiBits (${ptDeltaPct > 0 ? '+' : ''}${ptDeltaPct}%)`}
                      className="flex-1 flex flex-col items-center justify-end h-full"
                    >
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t transition-all ${
                          isLatest
                            ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]'
                            : favorable
                              ? 'bg-teal-400/75'
                              : 'bg-purple-400/70'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono-num text-teal-300/75 mt-1 pt-1 border-t border-teal-500/20">
                <span>Floor: {PIXOBYTE_MIN_RATE.toLocaleString()} DB (-29.5%)</span>
                <span>Mid: {PIXOBYTE_BASE_RATE.toLocaleString()} DB</span>
                <span>Cap: {PIXOBYTE_MAX_RATE.toLocaleString()} DB (+17.5%)</span>
              </div>
            </div>

            {/* One-Way Exchange Bar */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-teal-200/90">
                <span>Acquire Pixobyte (One-Way DigiBit Synthesis):</span>
                <button
                  type="button"
                  onClick={() => setBuyQtyInput(String(maxAffordable))}
                  className="text-[9px] font-mono-num px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-200 hover:bg-teal-500/30 cursor-pointer"
                >
                  Max ({maxAffordable})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Custom Amount Pillbox */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#09182c] border border-teal-400/65 shrink-0">
                  <PixobyteIcon size={16} />
                  <span className="text-[10px] font-pixel text-teal-200 uppercase">Qty</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    data-testid="bytomerge-qty-input"
                    value={buyQtyInput}
                    onChange={(e) => setBuyQtyInput(e.target.value)}
                    className="w-12 bg-transparent text-xs font-mono-num font-bold text-teal-100 text-center focus:outline-none"
                  />
                </div>

                {/* Buy For Button with Low-Opacity Framed Total Cost Pill */}
                <button
                  type="button"
                  data-testid="bytomerge-buy-pixobyte-btn"
                  disabled={!canAfford}
                  onClick={() => {
                    if (isOpeningFrameTickLocked()) return;
                    openingFrameTick(4);
                    soundEngine.uiClick();
                    onBuyPixobyte(parsedQty);
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-full font-pixel text-xs flex items-center justify-between gap-2 border cursor-pointer transition-all ${
                    canAfford
                      ? 'bg-gradient-to-r from-teal-600 to-purple-600 hover:brightness-110 text-white border-teal-300 shadow-md'
                      : 'bg-slate-800/70 text-slate-400 border-slate-600/60 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <span className="uppercase tracking-wider">Buy For</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/30 font-mono-num font-bold text-teal-50">
                    <DigiBitsIcon className="w-3.5 h-3.5 shrink-0" />
                    {totalCostDb.toLocaleString()}
                  </span>
                </button>
              </div>

              <div className="text-[9px] text-amber-200/85 font-mono-num flex items-center justify-between pt-0.5">
                <span>⚠ Non-reversible protocol: Pixobytes cannot be converted back into DigiBits.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
