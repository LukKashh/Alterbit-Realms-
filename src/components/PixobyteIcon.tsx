import React from 'react';

export const PIXOBYTE_COIN_RESOLUTION = 26;

// 26-bit resolution (26x26 pixel grid) cryptographic Pixobyte token coin artwork
// Palette codes:
// '.' = transparent
// 'O' = #060d18 (deep cyber obsidian outline)
// 'D' = #0f172a (dark slate rim shadow)
// 'B' = #0e7490 (deep cryptographic teal)
// 'C' = #06b6d4 (vibrant cyber cyan)
// 'L' = #67e8f9 (luminous cyan highlight)
// 'W' = #ecfeff (specular white-cyan glint)
// 'V' = #6d28d9 (cryptic violet circuit core)
// 'M' = #a855f7 (neon amethyst facet)
// 'E' = #10b981 (matrix emerald node)
const PIXOBYTE_26BIT_ROWS: readonly string[] = [
  '........OOOOOOOOOO........',
  '......OOLLLLLLLLLLOO......',
  '....OOLLWWWWWWWWWWLLOO....',
  '...OLLWWCCCCCCCCCCWWLLO...',
  '..OLWWCCBBBBBBBBBBCCWWLO..',
  '.OLWCCBBDDDDDDDDDDBBCCWLO.',
  '.OLCBBDDOOOOOOOOOODDBBCLO.',
  '.OLCBDDOVVVVVVVVVVODDBCLO.',
  'OLWCBDOMMMMMMMMMMMMODBCLO.',
  'OLCBDOMMVVOOOOOOVVMMODBCLO',
  'OLCBDOMVVOLLLLLLOVVMODBCLO',
  'OLCBDOMVOLWWWWWWLOVMODBCLO',
  'OLCBDOMVOLWOOOOOLWVMODBCLO',
  'OLCBDOMVOLWOOOOOLWVMODBCLO',
  'OLCBDOMVOLWWWWWWLOVMODBCLO',
  'OLCBDOMVOLWCCCCCCOVMODBCLO',
  'OLCBDOMVOLWCOOOOOOVMODBCLO',
  'OLCBDOEVOLWCOOOOOOEVODBCLO',
  '.OLCBDEVOLWCOOOOOOEVDBCLO.',
  '.OLCBBDDOOOOOOOOOODDBBCLO.',
  '.OLWCCBBDDDDDDDDDDBBCCWLO.',
  '..OLWWCCBBBBBBBBBBCCWWLO..',
  '...OLLWWCCCCCCCCCCWWLLO...',
  '....OOLLCCCCCCCCCCLLOO....',
  '......OOBBBBBBBBBBOO......',
  '........OOOOOOOOOO........',
];

const PIXOBYTE_PALETTE: Record<string, string> = {
  O: '#060d18',
  D: '#0f172a',
  B: '#0e7490',
  C: '#06b6d4',
  L: '#67e8f9',
  W: '#ecfeff',
  V: '#4c1d95',
  M: '#9333ea',
  E: '#10b981',
};

export function getPixobyte26BitGrid(): { width: number; height: number; rows: readonly string[]; palette: Record<string, string> } {
  return {
    width: PIXOBYTE_COIN_RESOLUTION,
    height: PIXOBYTE_COIN_RESOLUTION,
    rows: PIXOBYTE_26BIT_ROWS,
    palette: PIXOBYTE_PALETTE,
  };
}

let cachedPixobyteDataUrl: string | null = null;

export function getPixobyteCoinDataUrl(): string {
  if (cachedPixobyteDataUrl) return cachedPixobyteDataUrl;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = PIXOBYTE_COIN_RESOLUTION;
    canvas.height = PIXOBYTE_COIN_RESOLUTION;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < PIXOBYTE_COIN_RESOLUTION; y++) {
        const row = PIXOBYTE_26BIT_ROWS[y] ?? '';
        for (let x = 0; x < PIXOBYTE_COIN_RESOLUTION; x++) {
          const ch = row[x];
          const color = ch ? PIXOBYTE_PALETTE[ch] : undefined;
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      if (typeof canvas.toDataURL === 'function') {
        cachedPixobyteDataUrl = canvas.toDataURL();
        return cachedPixobyteDataUrl;
      }
    }
  }
  return '';
}

interface PixobyteIconProps {
  className?: string;
  size?: number;
  title?: string;
}

/**
 * 26-bit resolution (26x26 pixel grid) Pixobyte cryptographic coin icon.
 */
export const PixobyteIcon: React.FC<PixobyteIconProps> = ({
  className = 'w-4 h-4',
  size,
  title = 'Pixobyte',
}) => {
  return (
    <svg
      viewBox="0 0 26 26"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      className={`inline-block select-none shrink-0 pixelated ${className}`}
    >
      <title>{title}</title>
      {PIXOBYTE_26BIT_ROWS.map((row, y) => {
        const spans: Array<{ x: number; w: number; color: string }> = [];
        let x = 0;
        while (x < 26) {
          const ch = row[x];
          const color = ch ? PIXOBYTE_PALETTE[ch] : undefined;
          if (!color) {
            x += 1;
            continue;
          }
          let w = 1;
          while (x + w < 26 && row[x + w] === ch) {
            w += 1;
          }
          spans.push({ x, w, color });
          x += w;
        }
        return spans.map((s) => (
          <rect key={`${y}-${s.x}`} x={s.x} y={y} width={s.w} height={1} fill={s.color} />
        ));
      })}
    </svg>
  );
};
