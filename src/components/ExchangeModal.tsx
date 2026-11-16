import React, { useMemo, useState } from 'react';
import { Coins, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { getItemDef, ITEM_IDS } from '../game/catalog.ts';
import type { ExchangeSnapshot, InventorySlot } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';
import { formatHudFixed, formatHudNumber } from '../game/format.ts';
import { RedGemIcon } from './RedGemIcon.tsx';

interface ExchangeModalProps {
  playerId: string;
  gems: number;
  inventory: InventorySlot[];
  unclaimedWl: number;
  exchange: ExchangeSnapshot;
  onRefresh: () => void;
  onPostListing: (opts: {
    itemId: number;
    bundleSize: number;
    bundles: number;
    priceWl: number;
  }) => void;
  onBuyListing: (listingId: string) => void;
  onCancelListing: (listingId: string) => void;
  onClaimWl: () => void;
  onClose?: () => void;
}

type MarketCategory = 'all' | 'materials' | 'blocks' | 'seeds' | 'consumables';

export const ExchangeModal: React.FC<ExchangeModalProps> = ({
  playerId,
  gems,
  inventory,
  unclaimedWl,
  exchange,
  onRefresh,
  onPostListing,
  onBuyListing,
  onCancelListing,
  onClaimWl,
  onClose,
}) => {
  const [tab, setTab] = useState<'market' | 'sell' | 'orders'>('market');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<MarketCategory>('all');

  const listableItems = useMemo(
    () =>
      inventory.filter((s) => {
        const d = getItemDef(s.itemId);
        return (
          d &&
          d.tradeable &&
          !d.maxDurability &&
          s.itemId !== ITEM_IDS.WORLD_LOCK &&
          s.qty > 0
        );
      }),
    [inventory]
  );

  const [sellItemId, setSellItemId] = useState<number>(() => listableItems[0]?.itemId ?? 0);
  const [bundleSize, setBundleSize] = useState<number>(10);
  const [bundles, setBundles] = useState<number>(1);
  const [priceWl, setPriceWl] = useState<number>(2);

  const activeSellItemId = listableItems.some((s) => s.itemId === sellItemId)
    ? sellItemId
    : (listableItems[0]?.itemId ?? 0);

  const wlInBag = inventory.find((s) => s.itemId === ITEM_IDS.WORLD_LOCK)?.qty ?? 0;

  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exchange.listings.filter((l) => {
      const def = getItemDef(l.itemId);
      if (!def) return false;
      if (category === 'materials' && def.category !== 'material') return false;
      if (
        category === 'blocks' &&
        def.category !== 'foreground' &&
        def.category !== 'farmable' &&
        def.category !== 'background' &&
        def.category !== 'fluid' &&
        def.category !== 'interactive'
      ) {
        return false;
      }
      if (category === 'seeds' && def.category !== 'seed') return false;
      if (category === 'consumables' && def.category !== 'consumable') return false;
      if (q) {
        return (
          def.name.toLowerCase().includes(q) ||
          l.sellerName.toLowerCase().includes(q) ||
          String(l.itemId) === q
        );
      }
      return true;
    });
  }, [exchange.listings, search, category]);

  const myOrders = useMemo(
    () => exchange.listings.filter((l) => l.sellerId === playerId),
    [exchange.listings, playerId]
  );

  const previewTaxWl = priceWl >= 2 ? Math.max(1, Math.floor(priceWl * 0.05)) : 0;
  const previewClearingGems = priceWl === 1 ? 10 * bundles : 0;

  return (
    <div
      data-testid="global-exchange-panel"
      className="flex flex-col h-full min-h-0 gap-2.5 text-[#091e3a]"
    >
      {/* Header Summary Strip */}
      <div className="pixel-box-header -mx-3 -mt-3 flex flex-wrap items-center justify-between gap-2 px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={getItemIconUrl(ITEM_IDS.WORLD_LOCK)}
            alt="World Lock"
            className="w-6 h-6 pixelated shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0">
            <h2 className="ui-pixel-heading text-xs text-[#091e3a] truncate">Global WL Exchange</h2>
            <p className="text-[11px] font-mono-num text-[#23476d]">
              Wallet: <strong className="text-[#92400e]">{formatHudNumber(wlInBag)} WL</strong> ·{' '}
              <strong className="inline-flex items-center gap-0.5 text-[#991b1b]">
                <RedGemIcon className="w-3 h-3 shrink-0" />
                <span>{formatHudNumber(gems)}</span>
              </strong>{' '}
              · Burned: <strong className="text-[#b91c1c]">{formatHudNumber(exchange.totalWlBurned)} WL</strong> /{' '}
              <span className="inline-flex items-center gap-0.5">
                <span>{formatHudNumber(exchange.totalGemsCleared)}</span>
                <RedGemIcon className="w-2.5 h-2.5 shrink-0" />
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {unclaimedWl > 0 && (
            <button
              type="button"
              data-testid="exchange-claim-wl-btn"
              onClick={onClaimWl}
              className="pixel-btn pixel-btn-emerald !py-1.5 !px-3 !text-xs font-mono-num"
            >
              Claim {formatHudNumber(unclaimedWl)} WL
            </button>
          )}
          <button
            type="button"
            aria-label="Refresh Exchange"
            onClick={onRefresh}
            className="pixel-btn pixel-btn-primary !p-2"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="Close Global Exchange"
              onClick={onClose}
              className="pixel-btn pixel-btn-wood !p-2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        {(
          [
            ['market', `Browse (${exchange.listings.length})`],
            ['sell', 'Post Bundle'],
            ['orders', `My Orders (${myOrders.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`py-2 px-2 rounded-[8px] text-[11px] font-pixel uppercase cursor-pointer border-2 transition-colors ${
              tab === id
                ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                : 'bg-[#d8ecfc]/70 border-[#4172a3] text-[#23476d] hover:text-[#091e3a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MARKET BROWSER TAB */}
      {tab === 'market' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#23476d] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item, seller, or #ID..."
                className="hud-input w-full pl-8 pr-3 py-2 text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'materials', 'blocks', 'seeds', 'consumables'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1.5 rounded-[8px] text-[11px] font-bold capitalize border cursor-pointer transition-colors ${
                    category === cat
                      ? 'bg-[#0284c7] border-[#164e7a] text-white'
                      : 'bg-[#d8ecfc]/75 border-[#4172a3] text-[#23476d] hover:text-[#091e3a]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
            {filteredListings.length === 0 ? (
              <div className="pixel-slot p-4 text-center text-xs text-[#23476d]">
                No World Lock bundles match this filter. Switch to Post Bundle to list items!
              </div>
            ) : (
              filteredListings.map((l) => {
                const def = getItemDef(l.itemId);
                const stat = exchange.priceStats[l.itemId];
                const isOwn = l.sellerId === playerId;
                const canAfford = wlInBag >= l.priceWl;
                const unitWl = formatHudFixed(l.priceWl / l.bundleSize, 2);
                return (
                  <div
                    key={l.id}
                    className="pixel-slot flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={getItemIconUrl(l.itemId)}
                        alt={def?.name ?? 'Item'}
                        className="w-8 h-8 rounded-[6px] pixelated shrink-0 bg-white/80 p-0.5 border border-[#4172a3]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#091e3a] truncate">
                          {formatHudNumber(l.bundleSize)}× {def?.name ?? `#${l.itemId}`}
                        </div>
                        <div className="text-[11px] font-mono-num text-[#23476d]">
                          Seller: {l.sellerName} · Stock: {formatHudNumber(l.bundlesAvailable)} bundle(s) · {unitWl} WL/ea
                        </div>
                        {stat && (
                          <div className="text-[10px] font-mono-num text-[#0e7490] font-semibold">
                            Avg {formatHudFixed(stat.avgUnitWl, 2)} WL/unit · Vol {formatHudNumber(stat.volumeSold)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      {isOwn ? (
                        <button
                          type="button"
                          onClick={() => onCancelListing(l.id)}
                          className="pixel-btn pixel-btn-ruby !py-1.5 !px-3 !text-xs"
                        >
                          Cancel ({formatHudNumber(l.priceWl)} WL)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyListing(l.id)}
                          className="pixel-btn pixel-btn-gold !py-1.5 !px-3.5 !text-xs font-mono-num disabled:opacity-40"
                        >
                          Buy · {formatHudNumber(l.priceWl)} WL
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* POST LISTING TAB */}
      {tab === 'sell' && (
        <div className="hud-subpanel !rounded-[10px] p-3 flex flex-col gap-3 overflow-y-auto">
          {listableItems.length === 0 ? (
            <p className="text-xs text-[#23476d]">
              You have no stackable tradeable items in your Backpack yet. Gather blocks, seeds, ores, or fish first!
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs text-[#091e3a] font-semibold">
                  <span>Item to Escrow</span>
                  <select
                    value={activeSellItemId}
                    onChange={(e) => setSellItemId(Number(e.target.value))}
                    className="hud-input px-2.5 py-2 text-xs font-bold"
                  >
                    {listableItems.map((s, idx) => (
                      <option key={s.rodInstanceId ?? `${s.itemId}-${idx}`} value={s.itemId}>
                        {getItemDef(s.itemId)?.name} ({formatHudNumber(s.qty)} owned)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#091e3a] font-semibold">
                  <span>Items per Bundle</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={bundleSize}
                    onChange={(e) => setBundleSize(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="hud-input px-2.5 py-2 text-xs font-mono-num font-bold"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#091e3a] font-semibold">
                  <span>Number of Bundles</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={bundles}
                    onChange={(e) => setBundles(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                    className="hud-input px-2.5 py-2 text-xs font-mono-num font-bold"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#92400e] font-semibold">
                  <span>Price per Bundle (WL)</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={priceWl}
                    onChange={(e) => setPriceWl(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                    className="hud-input px-2.5 py-2 text-xs font-mono-num font-bold text-[#92400e]"
                  />
                </label>
              </div>

              <div className="bg-[#dff1ff]/80 border border-[#2c5885] rounded-[8px] p-2.5 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-bold text-[#0369a1]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Market Sink &amp; Escrow Summary</span>
                </div>
                <p className="text-[11px] font-mono-num text-[#091e3a]">
                  Escrow Total: {formatHudNumber(bundleSize * bundles)}× {getItemDef(activeSellItemId)?.name ?? 'Item'}
                </p>
                {priceWl === 1 ? (
                  <p className="text-[11px] font-mono-num text-[#b91c1c] font-semibold flex items-center gap-1 flex-wrap">
                    <span>1-WL Clearing Fee (upfront):</span>
                    <span className="inline-flex items-center gap-0.5">
                      <span>{formatHudNumber(previewClearingGems)}</span>
                      <RedGemIcon className="w-3 h-3 shrink-0" />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span>({bundles} bundle × 10</span>
                      <RedGemIcon className="w-2.5 h-2.5 shrink-0" />
                      <span>)</span>
                    </span>
                    <span>· 0 WL tax on sale</span>
                  </p>
                ) : (
                  <p className="text-[11px] font-mono-num text-[#92400e] font-semibold">
                    5% WL Sink on Sale: {formatHudNumber(previewTaxWl)} WL burned · You claim {formatHudNumber(priceWl - previewTaxWl)} WL per bundle
                  </p>
                )}
              </div>

              <button
                type="button"
                data-testid="exchange-post-btn"
                onClick={() =>
                  onPostListing({
                    itemId: activeSellItemId,
                    bundleSize,
                    bundles,
                    priceWl,
                  })
                }
                className="pixel-btn pixel-btn-emerald flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Post Escrow Listing</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* MY ACTIVE ORDERS TAB */}
      {tab === 'orders' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
          <div className="hud-subpanel flex items-center justify-between p-2.5">
            <div className="flex items-center gap-2 text-xs text-[#091e3a]">
              <Coins className="w-4 h-4 text-[#b45309]" />
              <span>
                Claim Vault: <strong className="font-mono-num text-[#92400e]">{formatHudNumber(unclaimedWl)} WL</strong>
              </span>
            </div>
            <button
              type="button"
              disabled={unclaimedWl <= 0}
              onClick={onClaimWl}
              className="pixel-btn pixel-btn-emerald !py-1.5 !px-3 !text-xs disabled:opacity-45"
            >
              Claim All
            </button>
          </div>

          {myOrders.length === 0 ? (
            <div className="pixel-slot p-4 text-center text-xs text-[#23476d]">
              You have no active listings on the Global Exchange.
            </div>
          ) : (
            myOrders.map((l) => (
              <div
                key={l.id}
                className="pixel-slot flex items-center justify-between gap-2 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={getItemIconUrl(l.itemId)}
                    alt={getItemDef(l.itemId)?.name ?? ''}
                    className="w-7 h-7 pixelated"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="text-xs font-bold text-[#091e3a]">
                      {formatHudNumber(l.bundleSize)}× {getItemDef(l.itemId)?.name} ({formatHudNumber(l.bundlesAvailable)} left)
                    </div>
                    <div className="text-[11px] font-mono-num font-bold text-[#92400e]">
                      {formatHudNumber(l.priceWl)} WL / bundle
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCancelListing(l.id)}
                  className="pixel-btn pixel-btn-ruby !py-1.5 !px-3 !text-xs"
                >
                  Cancel &amp; Refund
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
