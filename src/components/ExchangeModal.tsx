import React, { useMemo, useState } from 'react';
import { Coins, Plus, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { getItemDef, ITEM_IDS } from '../game/catalog.ts';
import type { ExchangeSnapshot, InventorySlot } from '../game/network.ts';
import { getItemIconUrl } from '../game/pixelArt.ts';

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
      className="flex flex-col h-full min-h-0 gap-2.5 text-[#f7f4eb]"
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
            <h2 className="ui-pixel-heading text-xs text-[#ffe18c] truncate">Global WL Exchange</h2>
            <p className="text-[11px] font-mono-num text-[#9cb5cc]">
              Wallet: <strong className="text-[#ffe18c]">{wlInBag} WL</strong> ·{' '}
              <strong className="text-[#8cf7ee]">{Math.round(gems)} G</strong> · Burned:{' '}
              <strong className="text-[#ffad85]">{exchange.totalWlBurned} WL</strong> /{' '}
              {exchange.totalGemsCleared} G
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
              Claim {unclaimedWl} WL
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
            className={`py-2 px-2 text-[11px] font-pixel uppercase cursor-pointer border-2 ${
              tab === id
                ? 'bg-[#2a2210] border-[#facc15] text-[#fde047]'
                : 'bg-[#090e17] border-[#1c2b3d] text-[#9cb5cc] hover:text-white'
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
              <Search className="w-3.5 h-3.5 text-[#7897b5] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item, seller, or #ID..."
                className="w-full pl-8 pr-3 py-2 rounded bg-[#060d14] border border-[#2d4863] text-xs text-white focus:outline-none focus:border-[#f2b738]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(['all', 'materials', 'blocks', 'seeds', 'consumables'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-bold capitalize border cursor-pointer ${
                    category === cat
                      ? 'bg-[#1c3d5c] border-[#78c8f5] text-white'
                      : 'bg-[#09131d] border-[#263c52] text-[#9cb5cc]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
            {filteredListings.length === 0 ? (
              <div className="pixel-slot p-4 text-center text-xs text-[#8aa4bd]">
                No World Lock bundles match this filter. Switch to Post Bundle to list items!
              </div>
            ) : (
              filteredListings.map((l) => {
                const def = getItemDef(l.itemId);
                const stat = exchange.priceStats[l.itemId];
                const isOwn = l.sellerId === playerId;
                const canAfford = wlInBag >= l.priceWl;
                const unitWl = (l.priceWl / l.bundleSize).toFixed(2);
                return (
                  <div
                    key={l.id}
                    className="pixel-slot flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <img
                        src={getItemIconUrl(l.itemId)}
                        alt={def?.name ?? 'Item'}
                        className="w-8 h-8 pixelated shrink-0 bg-[#05080e] p-0.5 border border-[#243b52]"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#f7f4eb] truncate">
                          {l.bundleSize}× {def?.name ?? `#${l.itemId}`}
                        </div>
                        <div className="text-[11px] font-mono-num text-[#9cb5cc]">
                          Seller: {l.sellerName} · Stock: {l.bundlesAvailable} bundle(s) · {unitWl} WL/ea
                        </div>
                        {stat && (
                          <div className="text-[10px] font-mono-num text-[#8cf7ee]">
                            Avg {stat.avgUnitWl.toFixed(2)} WL/unit · Vol {stat.volumeSold}
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
                          Cancel ({l.priceWl} WL)
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyListing(l.id)}
                          className="pixel-btn pixel-btn-gold !py-1.5 !px-3.5 !text-xs font-mono-num disabled:opacity-40"
                        >
                          Buy · {l.priceWl} WL
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
        <div className="bg-[#09131d] border border-[#263c52] rounded-md p-3 flex flex-col gap-3 overflow-y-auto">
          {listableItems.length === 0 ? (
            <p className="text-xs text-[#9cb5cc]">
              You have no stackable tradeable items in your Backpack yet. Gather blocks, seeds, ores, or fish first!
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs text-[#9cb5cc]">
                  <span>Item to Escrow</span>
                  <select
                    value={activeSellItemId}
                    onChange={(e) => setSellItemId(Number(e.target.value))}
                    className="px-2.5 py-2 rounded bg-[#060d14] border border-[#2d4863] text-xs font-bold text-white"
                  >
                    {listableItems.map((s, idx) => (
                      <option key={s.rodInstanceId ?? `${s.itemId}-${idx}`} value={s.itemId}>
                        {getItemDef(s.itemId)?.name} ({s.qty} owned)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#9cb5cc]">
                  <span>Items per Bundle</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={bundleSize}
                    onChange={(e) => setBundleSize(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                    className="px-2.5 py-2 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-white"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#9cb5cc]">
                  <span>Number of Bundles</span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={bundles}
                    onChange={(e) => setBundles(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                    className="px-2.5 py-2 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-white"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#ffe18c]">
                  <span>Price per Bundle (WL)</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={priceWl}
                    onChange={(e) => setPriceWl(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                    className="px-2.5 py-2 rounded bg-[#060d14] border border-[#2d4863] text-xs font-mono-num font-bold text-[#ffe18c]"
                  />
                </label>
              </div>

              <div className="bg-[#060f18] border border-[#223952] rounded p-2.5 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-bold text-[#8cf7ee]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Market Sink &amp; Escrow Summary</span>
                </div>
                <p className="text-[11px] font-mono-num text-[#b5cde3]">
                  Escrow Total: {bundleSize * bundles}× {getItemDef(activeSellItemId)?.name ?? 'Item'}
                </p>
                {priceWl === 1 ? (
                  <p className="text-[11px] font-mono-num text-[#ffad85]">
                    1-WL Clearing Fee (upfront): {previewClearingGems} Gems ({bundles} bundle × 10 G) · 0 WL tax on sale
                  </p>
                ) : (
                  <p className="text-[11px] font-mono-num text-[#ffe18c]">
                    5% WL Sink on Sale: {previewTaxWl} WL burned · You claim {priceWl - previewTaxWl} WL per bundle
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
                className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded bg-[#4aa64d] hover:bg-[#57ba5a] border-2 border-[#82e068] text-[#081709] font-bold text-xs cursor-pointer"
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
          <div className="flex items-center justify-between bg-[#09131d] border border-[#28425e] rounded p-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Coins className="w-4 h-4 text-[#ffe18c]" />
              <span>
                Claim Vault: <strong className="font-mono-num text-[#ffe18c]">{unclaimedWl} WL</strong>
              </span>
            </div>
            <button
              type="button"
              disabled={unclaimedWl <= 0}
              onClick={onClaimWl}
              className="px-3 py-1.5 rounded bg-[#4aa64d] disabled:bg-[#192836] disabled:text-[#65849c] text-[#081709] font-bold text-xs cursor-pointer"
            >
              Claim All
            </button>
          </div>

          {myOrders.length === 0 ? (
            <div className="bg-[#09131d] border border-[#263c52] rounded p-4 text-center text-xs text-[#8aa4bd]">
              You have no active listings on the Global Exchange.
            </div>
          ) : (
            myOrders.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 bg-[#09131d] border border-[#263c52] rounded p-2.5"
              >
                <div className="flex items-center gap-2">
                  <img
                    src={getItemIconUrl(l.itemId)}
                    alt={getItemDef(l.itemId)?.name ?? ''}
                    className="w-7 h-7 pixelated"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">
                      {l.bundleSize}× {getItemDef(l.itemId)?.name} ({l.bundlesAvailable} left)
                    </div>
                    <div className="text-[11px] font-mono-num text-[#ffe18c]">
                      {l.priceWl} WL / bundle
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onCancelListing(l.id)}
                  className="px-3 py-1.5 rounded bg-[#3b1b1f] hover:bg-[#52242a] border border-[#7a343d] text-[#ffd4d4] font-bold text-xs cursor-pointer"
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
