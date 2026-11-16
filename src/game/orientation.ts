import { useEffect, useState } from 'react';
import { DEFAULT_VIEW_SCALE, MAX_PLAYER_ZOOM, MIN_PLAYER_ZOOM } from './constants.ts';

export type DeviceOrientation = 'portrait' | 'landscape';

/**
 * Resolves viewport orientation purely from viewport dimensions.
 * Height strictly greater than width is portrait; equal or wider is landscape.
 */
export function resolveViewportOrientation(width: number, height: number): DeviceOrientation {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'landscape';
  }
  return height > width ? 'portrait' : 'landscape';
}

/**
 * Resolves a single unified camera FOV zoom scale across both Portrait and Landscape.
 * Viewport orientation and aspect ratio never alter or clamp the player's chosen zoom.
 */
export function resolveUnifiedViewScale(
  playerZoomScale: number | null | undefined,
  configViewScale: number = DEFAULT_VIEW_SCALE
): number {
  const raw =
    typeof playerZoomScale === 'number' && Number.isFinite(playerZoomScale) && playerZoomScale > 0
      ? playerZoomScale
      : configViewScale || DEFAULT_VIEW_SCALE;
  const clamped = Math.max(MIN_PLAYER_ZOOM, Math.min(MAX_PLAYER_ZOOM, raw));
  return Math.round(clamped * 100) / 100;
}

export function readCurrentOrientation(): DeviceOrientation {
  if (typeof window === 'undefined') return 'landscape';
  const vv = window.visualViewport;
  const w = vv?.width && vv.width > 0 ? vv.width : window.innerWidth;
  const h = vv?.height && vv.height > 0 ? vv.height : window.innerHeight;
  if (w > 0 && h > 0) {
    return resolveViewportOrientation(w, h);
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  }
  return 'landscape';
}

/**
 * Constant background orientation tracker listening to device orientation,
 * matchMedia, resize, visualViewport, and a lightweight periodic fallback check.
 */
export function useViewportOrientation(): DeviceOrientation {
  const [orientation, setOrientation] = useState<DeviceOrientation>(() => readCurrentOrientation());

  useEffect(() => {
    const sync = () => {
      const next = readCurrentOrientation();
      setOrientation((prev) => (prev === next ? prev : next));
    };

    sync();

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(orientation: portrait)')
        : null;
    const screenOri = window.screen?.orientation;
    const vv = window.visualViewport;

    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    document.addEventListener('visibilitychange', sync);
    vv?.addEventListener('resize', sync);

    if (mql) {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', sync);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(sync);
      }
    }
    if (screenOri && typeof screenOri.addEventListener === 'function') {
      screenOri.addEventListener('change', sync);
    }

    const bgIntervalId = window.setInterval(sync, 250);

    return () => {
      window.clearInterval(bgIntervalId);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      document.removeEventListener('visibilitychange', sync);
      vv?.removeEventListener('resize', sync);
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', sync);
        } else if (typeof mql.removeListener === 'function') {
          mql.removeListener(sync);
        }
      }
      if (screenOri && typeof screenOri.removeEventListener === 'function') {
        screenOri.removeEventListener('change', sync);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.dataset.orientation = orientation;
    }
  }, [orientation]);

  return orientation;
}
