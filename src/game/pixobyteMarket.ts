export const PIXOBYTE_BASE_RATE = 1325;
export const PIXOBYTE_MAX_DROP_PCT = 0.295; // -29.5% max drop from default
export const PIXOBYTE_MAX_GAIN_PCT = 0.175; // +17.5% max gain from default

// Strictly clamped integer bounds so deviation never exceeds -29.5% or +17.5% from 1,325
export const PIXOBYTE_MIN_RATE = Math.ceil(PIXOBYTE_BASE_RATE * (1 - PIXOBYTE_MAX_DROP_PCT)); // 935
export const PIXOBYTE_MAX_RATE = Math.floor(PIXOBYTE_BASE_RATE * (1 + PIXOBYTE_MAX_GAIN_PCT)); // 1556
export const PIXOSTATIC_TICK_MS = 4000;

export interface PixostaticMarketSnapshot {
  tickIndex: number;
  baseRate: number;
  minRate: number;
  maxRate: number;
  currentRate: number;
  previousRate: number;
  deltaFromPrev: number;
  deltaFromBase: number;
  deviationPct: number;
  sessionHigh: number;
  sessionLow: number;
  history: number[];
  nextTickInMs: number;
}

function hashTick(tick: number): number {
  let h = (tick ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff;
}

/**
 * Computes the deterministic semi-volatile stock exchange cost of 1 Pixobyte in DigiBits
 * at a given market tick index.
 * Always centered around 1,325 DigiBits and strictly clamped within [935, 1556]
 * (-29.5% to +17.5% from the 1,325 midpoint).
 */
export function getPixostaticRateAtTick(tickIndex: number): number {
  const t = Math.max(0, Math.floor(tickIndex));
  // Multi-wave market regime + local tick micro-volatility in [-1, +1]
  const macroWave = Math.sin(t * 0.19) * 0.46 + Math.cos(t * 0.07 + 1.1) * 0.31;
  const mesoWave = Math.sin(t * 0.53 + 2.4) * 0.22;
  const microJitter = (hashTick(t) * 2 - 1) * 0.24 + (hashTick(t - 1) * 2 - 1) * 0.12;

  const combined = Math.max(-1, Math.min(1, macroWave + mesoWave + microJitter));

  const maxDownSpan = PIXOBYTE_BASE_RATE - PIXOBYTE_MIN_RATE; // 390
  const maxUpSpan = PIXOBYTE_MAX_RATE - PIXOBYTE_BASE_RATE; // 231

  const rawOffset = combined < 0 ? combined * maxDownSpan : combined * maxUpSpan;
  const rawRate = Math.round(PIXOBYTE_BASE_RATE + rawOffset);
  return Math.max(PIXOBYTE_MIN_RATE, Math.min(PIXOBYTE_MAX_RATE, rawRate));
}

export function getPixostaticMarketSnapshot(nowMs: number = Date.now()): PixostaticMarketSnapshot {
  const safeNow = Math.max(0, Math.floor(nowMs));
  const tickIndex = Math.floor(safeNow / PIXOSTATIC_TICK_MS);
  const currentRate = getPixostaticRateAtTick(tickIndex);
  const previousRate = getPixostaticRateAtTick(Math.max(0, tickIndex - 1));

  const history: number[] = [];
  for (let i = 23; i >= 0; i--) {
    history.push(getPixostaticRateAtTick(Math.max(0, tickIndex - i)));
  }

  const sessionHigh = Math.max(...history);
  const sessionLow = Math.min(...history);
  const deltaFromPrev = currentRate - previousRate;
  const deltaFromBase = currentRate - PIXOBYTE_BASE_RATE;
  const deviationPct = Number(((deltaFromBase / PIXOBYTE_BASE_RATE) * 100).toFixed(2));
  const nextTickInMs = PIXOSTATIC_TICK_MS - (safeNow % PIXOSTATIC_TICK_MS);

  return {
    tickIndex,
    baseRate: PIXOBYTE_BASE_RATE,
    minRate: PIXOBYTE_MIN_RATE,
    maxRate: PIXOBYTE_MAX_RATE,
    currentRate,
    previousRate,
    deltaFromPrev,
    deltaFromBase,
    deviationPct,
    sessionHigh,
    sessionLow,
    history,
    nextTickInMs,
  };
}
