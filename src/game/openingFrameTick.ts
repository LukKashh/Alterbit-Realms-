/**
 * OpeningFrameTick — Progressive UI Click-Through & Double-Tap Guard
 *
 * When a player taps an interactive element that transitions to a progressive UI screen
 * (e.g. NPC Dialogue -> Buy/Sell Menu, Seed Row -> Purchase Confirm, Admin Hub -> Subpanel),
 * a new button often mounts at the exact same screen coordinates. Without a frame-tick guard,
 * a double-tap, touch-to-click synthesis, or rapid click bolts through both actions in a blink.
 *
 * `openingFrameTick(ticks)` temporarily locks progressive UI transitions for a few animation
 * frames (~3 ticks / ~140ms) so the newly revealed interactive element cannot be accidentally
 * triggered until the opening frame ticks have elapsed.
 */

export const DEFAULT_OPENING_FRAME_TICKS = 3;
export const OPENING_TICK_DURATION_MS = 45; // ~3 frames at 60Hz ≈ 135ms

let remainingFrameTicks = 0;
let lockedUntilTimestampMs = 0;
let rafHandle: number | null = null;

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function scheduleNextFrameTick(): void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return;
  }
  if (rafHandle !== null) {
    return;
  }
  rafHandle = window.requestAnimationFrame(() => {
    rafHandle = null;
    if (remainingFrameTicks > 0) {
      remainingFrameTicks = Math.max(0, remainingFrameTicks - 1);
    }
    if (remainingFrameTicks > 0) {
      scheduleNextFrameTick();
    }
  });
}

/**
 * Engages the OpeningFrameTick guard for `ticks` animation frames (default 3 ticks).
 * While active, guarded progressive UI actions are ignored until the ticks clear.
 */
export function openingFrameTick(ticks: number = DEFAULT_OPENING_FRAME_TICKS): void {
  const safeTicks = Math.max(1, Math.min(12, Math.round(ticks)));
  remainingFrameTicks = Math.max(remainingFrameTicks, safeTicks);
  lockedUntilTimestampMs = Math.max(
    lockedUntilTimestampMs,
    nowMs() + safeTicks * OPENING_TICK_DURATION_MS
  );
  scheduleNextFrameTick();
}

export const triggerOpeningFrameTick = openingFrameTick;

/**
 * Manually advances the opening frame tick counter by 1 tick.
 * Called automatically via `requestAnimationFrame` in the browser, and exposed
 * for deterministic stepping in unit tests or engine ticks.
 */
export function stepOpeningFrameTick(steps = 1): void {
  const count = Math.max(1, Math.round(steps));
  remainingFrameTicks = Math.max(0, remainingFrameTicks - count);
  if (remainingFrameTicks === 0) {
    lockedUntilTimestampMs = 0;
  }
}

/**
 * Returns true if the UI is currently inside an OpeningFrameTick cooldown window.
 */
export function isOpeningFrameTickLocked(): boolean {
  if (remainingFrameTicks <= 0) {
    return false;
  }
  // If RAF was throttled or running in a non-RAF environment, allow time expiry to clear
  if (nowMs() >= lockedUntilTimestampMs) {
    remainingFrameTicks = 0;
    lockedUntilTimestampMs = 0;
    return false;
  }
  return true;
}

export function getRemainingOpeningFrameTicks(): number {
  if (!isOpeningFrameTickLocked()) {
    return 0;
  }
  return remainingFrameTicks;
}

/**
 * Resets the OpeningFrameTick lock state immediately (useful when closing all menus or in tests).
 */
export function resetOpeningFrameTick(): void {
  remainingFrameTicks = 0;
  lockedUntilTimestampMs = 0;
  if (
    rafHandle !== null &&
    typeof window !== 'undefined' &&
    typeof window.cancelAnimationFrame === 'function'
  ) {
    window.cancelAnimationFrame(rafHandle);
  }
  rafHandle = null;
}

/**
 * Wraps an interactive UI callback so that:
 * 1. If an OpeningFrameTick is currently active from a prior progressive UI transition, the click is ignored.
 * 2. When executed, it triggers `openingFrameTick(ticks)` (unless `lockAfter: false`) so the next
 *    progressive UI layer that appears at the same cursor position won't immediately fire.
 */
export function guardOpeningFrameTick<T extends (...args: any[]) => any>(
  callback: T,
  options?: { ticks?: number; lockAfter?: boolean }
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (isOpeningFrameTickLocked()) {
      return undefined;
    }
    const result = callback(...args);
    if (options?.lockAfter !== false) {
      openingFrameTick(options?.ticks ?? DEFAULT_OPENING_FRAME_TICKS);
    }
    return result;
  };
}
