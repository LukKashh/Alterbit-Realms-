import { CATALOG, type ItemDefinition } from './catalog.ts';

/**
 * 32-bit downscaled pixel-art engine for:
 * - 40 Progressive Real-World Construction & Luxury Building Blocks (IDs 900..939)
 * - 40 Matching Material & Luxury Progression Seeds (IDs 950..989)
 *
 * Tiers 1 to 8:
 *  Tier 1 (900..904 / 950..954): Earth & Timber Foundations
 *  Tier 2 (905..909 / 955..959): Masonry & Structural Bricks
 *  Tier 3 (910..914 / 960..964): Polished Stone & Fine Ceramics
 *  Tier 4 (915..919 / 965..969): Architectural Metals & Alloys
 *  Tier 5 (920..924 / 970..974): Silicates, Vitrified Glass & Fine Crystals
 *  Tier 6 (925..929 / 975..979): Luxury Hardwoods & Amber Resins
 *  Tier 7 (930..934 / 980..984): Palatial Ornamental Marbles & Semi-Precious Minerals
 *  Tier 8 (935..939 / 985..989): Apex Sovereign Monoliths & Gem-Embedded Bullion
 */

// Native 1x1 pixel on 48x48 canvas
function px1(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

// 2x2 pixel on 24x24 logical grid (scaled to 48x48)
function px2(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x * 2), Math.floor(y * 2), Math.floor(w * 2), Math.floor(h * 2));
}

// 3x3 pixel on 16x16 logical grid (scaled to 48x48)
function px3(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x * 3), Math.floor(y * 3), Math.floor(w * 3), Math.floor(h * 3));
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function bevel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  light: string,
  dark: string,
  depth = 2
): void {
  for (let i = 0; i < depth; i++) {
    rect(ctx, x + i, y + i, w - i * 2, 1, light);
    rect(ctx, x + i, y + i, 1, h - i * 2, light);
    rect(ctx, x + i, y + h - 1 - i, w - i * 2, 1, dark);
    rect(ctx, x + w - 1 - i, y + i, 1, h - i * 2, dark);
  }
}

// Deterministic pseudorandom for procedural texture variation
function prng(seed: number): () => number {
  let s = (seed * 2654435761 + 1013904223) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

// ============================================================================
// 40 DEDICATED HIGH-DETAIL BLOCK ART RENDERERS (IDs 900..939)
// ============================================================================

function drawFarmableBlockArtwork48(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDefinition
): boolean {
  switch (itemId) {
    // ------------------------------------------------------------------------
    // TIER 1: Earth & Timber Foundations (900..904)
    // ------------------------------------------------------------------------
    case 900: {
      // Clay Soil: Fine damp terracotta clay soil with layered loam and moisture granules
      rect(ctx, 0, 0, 48, 48, '#874f33');
      const rand = prng(900);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.14) px1(ctx, x, y, '#5d321d');
          else if (r < 0.28) px1(ctx, x, y, '#703e25');
          else if (r < 0.44) px1(ctx, x, y, '#9c5f3f');
          else if (r < 0.52) px1(ctx, x, y, '#b3744e');
          else if (r < 0.56) px1(ctx, x, y, '#cca17f'); // Moisture granule
        }
      }
      // Horizontal compaction stratification bands
      for (const bandY of [11, 23, 35]) {
        rect(ctx, 0, bandY, 48, 2, '#4d2815');
        rect(ctx, 0, bandY + 2, 48, 1, '#b3744e');
      }
      bevel(ctx, 0, 0, 48, 48, '#b3744e', '#3e1e0d', 2);
      return true;
    }

    case 901: {
      // Packed Earth: Tamp-compressed hardpan crust with pebble flecks and micro-fissures
      rect(ctx, 0, 0, 48, 48, '#7a5433');
      const rand = prng(901);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.12) px1(ctx, x, y, '#54361c');
          else if (r < 0.26) px1(ctx, x, y, '#694627');
          else if (r < 0.42) px1(ctx, x, y, '#8f653f');
          else if (r < 0.50) px1(ctx, x, y, '#a87a50');
        }
      }
      // Embedded lithic granules
      const pebbles = [[8, 12], [22, 9], [37, 18], [14, 32], [29, 39], [41, 33]];
      for (const [px, py] of pebbles) {
        rect(ctx, px, py, 3, 2, '#382210');
        rect(ctx, px + 1, py, 2, 1, '#c29b74');
      }
      // Hairline surface drying fissures
      for (let i = 0; i < 18; i++) {
        px1(ctx, 10 + i, 20 + (i % 3 === 0 ? 1 : 0), '#3d2411');
        px1(ctx, 24 + i, 38 + (i % 2 === 0 ? 1 : 0), '#3d2411');
      }
      bevel(ctx, 0, 0, 48, 48, '#a87a50', '#3b220e', 2);
      return true;
    }

    case 902: {
      // Natural Log: Cross-cut timber log section with concentric annual growth rings and outer bark
      rect(ctx, 0, 0, 48, 48, '#3d2514'); // Rugged outer bark
      // Bark ridges
      const rand = prng(902);
      for (let i = 0; i < 48; i++) {
        if (rand() < 0.5) px1(ctx, i, 0, '#271609');
        if (rand() < 0.5) px1(ctx, i, 47, '#271609');
        if (rand() < 0.5) px1(ctx, 0, i, '#271609');
        if (rand() < 0.5) px1(ctx, 47, i, '#271609');
      }
      // Cambium inner bark boundary
      rect(ctx, 3, 3, 42, 42, '#5a381f');
      // Sawn wood end-grain face
      rect(ctx, 5, 5, 38, 38, '#9c6f43');

      // Concentric rings
      const rings = [17, 13, 9, 5, 2];
      const ringColors = ['#754f2c', '#b38252', '#754f2c', '#b38252', '#593a1c'];
      for (let rIdx = 0; rIdx < rings.length; rIdx++) {
        const rad = rings[rIdx];
        const col = ringColors[rIdx];
        for (let a = 0; a < 360; a += 4) {
          const radA = (a * Math.PI) / 180;
          const rx = Math.round(24 + Math.cos(radA) * rad);
          const ry = Math.round(24 + Math.sin(radA) * rad);
          if (rx >= 5 && rx <= 42 && ry >= 5 && ry <= 42) {
            px1(ctx, rx, ry, col);
          }
        }
      }
      // Pith center & radial checks
      rect(ctx, 23, 23, 3, 3, '#422710');
      for (let d = 1; d <= 12; d++) {
        px1(ctx, 24 + d, 24, '#38200d');
        px1(ctx, 24, 24 - d, '#38200d');
      }
      bevel(ctx, 0, 0, 48, 48, '#5a381f', '#1f1006', 2);
      return true;
    }

    case 903: {
      // Wood Plank: Three horizontal sawn lumber planks with tongue-and-groove joints & iron pegs
      rect(ctx, 0, 0, 48, 48, '#96683b');
      // 3 planks: y=0..15, 16..31, 32..47
      for (let p = 0; p < 3; p++) {
        const py = p * 16;
        // Plank surface base & wood grain lines
        rect(ctx, 0, py + 1, 48, 14, p % 2 === 0 ? '#a87747' : '#9c6c3e');
        rect(ctx, 0, py + 1, 48, 1, '#c99663'); // Top highlight of board
        rect(ctx, 0, py + 14, 48, 1, '#664320'); // Bottom shadow of board
        rect(ctx, 0, py + 15, 48, 1, '#2d1b09'); // Recessed groove gap

        // Wood grain streaks
        for (let x = 0; x < 48; x += 4) {
          px1(ctx, x, py + 4, '#875b2f', 3, 1);
          px1(ctx, x + 2, py + 8, '#b88552', 2, 1);
          px1(ctx, x + 1, py + 11, '#875b2f', 3, 1);
        }

        // Carpentry nail pegs
        rect(ctx, 3, py + 7, 2, 2, '#2f3542');
        px1(ctx, 3, py + 7, '#747d8c');
        rect(ctx, 43, py + 7, 2, 2, '#2f3542');
        px1(ctx, 43, py + 7, '#747d8c');
      }
      bevel(ctx, 0, 0, 48, 48, '#c99663', '#2d1b09', 2);
      return true;
    }

    case 904: {
      // Reinforced Timber: Heavy oak balk bound with forged iron corner brackets & hexagonal bolts
      rect(ctx, 0, 0, 48, 48, '#7a512b');
      // Oak wood grain
      for (let y = 4; y < 44; y += 4) {
        rect(ctx, 4, y, 40, 2, '#8f6136');
        rect(ctx, 4, y + 2, 40, 2, '#664221');
      }
      // Forged iron corner plates & perimeter bands
      rect(ctx, 0, 0, 48, 4, '#2f3542');
      rect(ctx, 0, 44, 48, 4, '#2f3542');
      rect(ctx, 0, 0, 4, 48, '#2f3542');
      rect(ctx, 44, 0, 4, 48, '#2f3542');

      // Steel highlights
      rect(ctx, 1, 1, 46, 1, '#747d8c');
      rect(ctx, 1, 1, 1, 46, '#747d8c');
      rect(ctx, 1, 46, 46, 1, '#1e232d');
      rect(ctx, 46, 1, 1, 46, '#1e232d');

      // Hexagonal bolt rivets at 4 corners and center sides
      const bolts = [[2, 2], [42, 2], [2, 42], [42, 42], [22, 2], [22, 42]];
      for (const [bx, by] of bolts) {
        rect(ctx, bx, by, 4, 4, '#1e232d');
        rect(ctx, bx + 1, by + 1, 2, 2, '#a4b0be');
        px1(ctx, bx + 1, by + 1, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#747d8c', '#141820', 1);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 2: Masonry & Structural Bricks (905..909)
    // ------------------------------------------------------------------------
    case 905: {
      // Quarry Stone: Rough-hewn granite block with fractured angular facets and mineral stipples
      rect(ctx, 0, 0, 48, 48, '#6b7280');
      const rand = prng(905);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.15) px1(ctx, x, y, '#4b5563');
          else if (r < 0.30) px1(ctx, x, y, '#57606e');
          else if (r < 0.45) px1(ctx, x, y, '#7d8594');
          else if (r < 0.55) px1(ctx, x, y, '#9ca3af');
          else if (r < 0.60) px1(ctx, x, y, '#e5e7eb'); // Quartz fleck
        }
      }
      // Chiseled fracture cleavage planes
      const facets: Array<[number, number, number, number, string]> = [
        [4, 6, 16, 14, '#7d8594'],
        [22, 8, 20, 12, '#57606e'],
        [8, 24, 18, 16, '#4b5563'],
        [28, 22, 16, 20, '#8891a0'],
      ];
      for (const [fx, fy, fw, fh, col] of facets) {
        rect(ctx, fx, fy, fw, fh, col);
        bevel(ctx, fx, fy, fw, fh, '#9ca3af', '#374151', 1);
      }
      bevel(ctx, 0, 0, 48, 48, '#9ca3af', '#374151', 3);
      return true;
    }

    case 906: {
      // Chiseled Stone: Finely dressed ashlar masonry with 4px drafted margin & bush-hammered center
      rect(ctx, 0, 0, 48, 48, '#7b8391');
      // Drafted flat border margins (4px)
      rect(ctx, 0, 0, 48, 4, '#8f97a6');
      rect(ctx, 0, 0, 4, 48, '#8f97a6');
      rect(ctx, 0, 44, 48, 4, '#565e6b');
      rect(ctx, 44, 0, 4, 48, '#565e6b');

      // Recessed bush-hammered field (40x40)
      rect(ctx, 4, 4, 40, 40, '#666e7c');
      const rand = prng(906);
      for (let y = 4; y < 44; y++) {
        for (let x = 4; x < 44; x++) {
          const r = rand();
          if (r < 0.20) px1(ctx, x, y, '#505763');
          else if (r < 0.40) px1(ctx, x, y, '#78808e');
          else if (r < 0.50) px1(ctx, x, y, '#9ca3af');
        }
      }
      // Drafted bevel border
      bevel(ctx, 4, 4, 40, 40, '#565e6b', '#8f97a6', 1);
      bevel(ctx, 0, 0, 48, 48, '#c4ccd8', '#383e47', 2);
      return true;
    }

    case 907: {
      // Fired Brick: Classic running bond brickwork (4 courses: y=0..11, 12..23, 24..35, 36..47)
      rect(ctx, 0, 0, 48, 48, '#d4c9b8'); // Mortar bed
      const brickColors = ['#b84435', '#a33729', '#cb5242', '#8f2e21', '#bc4a3a'];
      const rand = prng(907);

      for (let row = 0; row < 4; row++) {
        const ry = row * 12;
        const offset = row % 2 === 1 ? 12 : 0;
        for (let bx = -offset; bx < 48; bx += 24) {
          const startX = Math.max(0, bx);
          const endX = Math.min(48, bx + 22);
          const w = endX - startX;
          if (w > 0) {
            const bCol = brickColors[Math.floor(rand() * brickColors.length)];
            rect(ctx, startX, ry + 1, w, 10, bCol);
            // Brick surface pores & kiln scorch
            for (let py = ry + 2; py < ry + 10; py++) {
              for (let px = startX + 1; px < endX - 1; px++) {
                if (rand() < 0.15) px1(ctx, px, py, '#6e1d13');
                else if (rand() < 0.15) px1(ctx, px, py, '#e07665');
              }
            }
            bevel(ctx, startX, ry + 1, w, 10, '#e88978', '#5e170d', 1);
          }
        }
        // Mortar joint lines
        rect(ctx, 0, ry + 11, 48, 1, '#9e9484');
      }
      bevel(ctx, 0, 0, 48, 48, '#e88978', '#5e170d', 2);
      return true;
    }

    case 908: {
      // Patterned Brick: Geometric diagonal herringbone brick motif with crisp mortar lines
      rect(ctx, 0, 0, 48, 48, '#a33f2a');
      const rand = prng(908);
      // Draw interlocking angled brick segments
      for (let y = 0; y < 48; y += 8) {
        for (let x = 0; x < 48; x += 16) {
          const isAlt = ((x / 16) + (y / 8)) % 2 === 0;
          const col = isAlt ? '#ba4c34' : '#8c311e';
          rect(ctx, x + 1, y + 1, 14, 6, col);
          rect(ctx, x + 1, y + 1, 14, 1, '#dc6850');
          rect(ctx, x + 1, y + 6, 14, 1, '#571c10');
          rect(ctx, x + 14, y + 1, 1, 6, '#571c10');
          // Texture stipple
          if (rand() < 0.3) px1(ctx, x + 4, y + 3, '#f28e77');
          if (rand() < 0.3) px1(ctx, x + 9, y + 4, '#471409');
        }
      }
      // Mortar grid lines
      for (let y = 7; y < 48; y += 8) rect(ctx, 0, y, 48, 1, '#3b160e');
      for (let x = 15; x < 48; x += 16) rect(ctx, x, 0, 1, 48, '#3b160e');
      bevel(ctx, 0, 0, 48, 48, '#dc6850', '#3b160e', 2);
      return true;
    }

    case 909: {
      // Stone Paver: Interlocking cobblestone paver octagons with polished crowns & recessed joints
      rect(ctx, 0, 0, 48, 48, '#374151'); // Dark joint fill
      // 4 large square pavers (each 21x21 with 3px joints)
      const paverPositions = [[2, 2], [25, 2], [2, 25], [25, 25]];
      for (const [px, py] of paverPositions) {
        rect(ctx, px, py, 21, 21, '#788291');
        // Rounded corners for cobblestone paver aesthetic
        px1(ctx, px, py, '#374151');
        px1(ctx, px + 20, py, '#374151');
        px1(ctx, px, py + 20, '#374151');
        px1(ctx, px + 20, py + 20, '#374151');

        // Polished top foot-traffic sheen
        rect(ctx, px + 3, py + 3, 15, 15, '#8d98a8');
        rect(ctx, px + 5, py + 5, 11, 11, '#9ea9ba');
        px1(ctx, px + 6, py + 6, '#d1d8e0', 4, 2); // Specular gleam

        bevel(ctx, px + 1, py + 1, 19, 19, '#b0b8c4', '#4b5563', 1);
      }
      bevel(ctx, 0, 0, 48, 48, '#b0b8c4', '#1f2937', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 3: Polished Stone & Fine Ceramics (910..914)
    // ------------------------------------------------------------------------
    case 910: {
      // Smooth Basalt: Dense volcanic basalt slab honed to a silky dark charcoal matte surface
      rect(ctx, 0, 0, 48, 48, '#262d3a');
      const rand = prng(910);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.12) px1(ctx, x, y, '#181d26');
          else if (r < 0.25) px1(ctx, x, y, '#333b4d');
          else if (r < 0.35) px1(ctx, x, y, '#434d63');
        }
      }
      // Columnar basalt hexagonal cooling joints
      for (let y = 6; y < 44; y += 12) {
        rect(ctx, 6, y, 36, 1, '#151922');
        rect(ctx, 6, y + 1, 36, 1, '#434d63');
      }
      for (let x = 12; x < 44; x += 12) {
        rect(ctx, x, 6, 1, 36, '#151922');
        rect(ctx, x + 1, 6, 1, 36, '#434d63');
      }
      bevel(ctx, 0, 0, 48, 48, '#596782', '#10141a', 3);
      return true;
    }

    case 911: {
      // Veined Granite: Architectural white-and-grey granite slab with black biotite & quartz crystal
      rect(ctx, 0, 0, 48, 48, '#cbd5e1');
      const rand = prng(911);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.12) px1(ctx, x, y, '#0f172a'); // Biotite mica
          else if (r < 0.22) px1(ctx, x, y, '#334155');
          else if (r < 0.40) px1(ctx, x, y, '#94a3b8');
          else if (r < 0.55) px1(ctx, x, y, '#f1f5f9');
          else if (r < 0.60) px1(ctx, x, y, '#ffffff'); // Crystalline quartz
        }
      }
      // Meandering grey quartz veins
      for (let i = 0; i < 40; i++) {
        const vy = Math.floor(6 + i * 0.9 + Math.sin(i * 0.3) * 3);
        px1(ctx, 4 + i, vy, '#475569');
        px1(ctx, 4 + i, vy + 1, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#475569', 2);
      return true;
    }

    case 912: {
      // Glazed Ceramic: High-fire vitreous turquoise/sapphire ceramic tiles in 4-tile grid
      rect(ctx, 0, 0, 48, 48, '#e2e8f0'); // Clean white waterproof grout
      const tilePos = [[2, 2], [25, 2], [2, 25], [25, 25]];
      for (const [tx, ty] of tilePos) {
        // High-gloss turquoise tile base
        rect(ctx, tx, ty, 21, 21, '#0284c7');
        rect(ctx, tx + 1, ty + 1, 19, 19, '#0ea5e9');

        // Diagonal reflective glaze sheen across each tile
        for (let d = 3; d <= 17; d++) {
          px1(ctx, tx + d, ty + 20 - d, '#7dd3fc');
          px1(ctx, tx + d + 1, ty + 20 - d, '#ffffff');
        }

        // Inner tile bevel & glaze depth
        bevel(ctx, tx, ty, 21, 21, '#bae6fd', '#0369a1', 2);
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#94a3b8', 2);
      return true;
    }

    case 913: {
      // Ceramic Mosaic: 6x6 grid of Byzantine tesserae tiles with gold, turquoise, and coral tesserae
      rect(ctx, 0, 0, 48, 48, '#334155'); // Grout matrix
      const palette = ['#0284c7', '#0ea5e9', '#06b6d4', '#f59e0b', '#fbbf24', '#f43f5e'];
      const rand = prng(913);
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          const mx = 2 + col * 7;
          const my = 2 + row * 7;
          const colIdx = Math.floor(rand() * palette.length);
          const baseCol = palette[colIdx];
          rect(ctx, mx, my, 6, 6, baseCol);
          rect(ctx, mx, my, 6, 1, '#ffffff');
          rect(ctx, mx, my, 1, 6, '#ffffff');
          rect(ctx, mx + 5, my, 1, 6, '#1e293b');
          rect(ctx, mx, my + 5, 6, 1, '#1e293b');
        }
      }
      bevel(ctx, 0, 0, 48, 48, '#fde68a', '#0f172a', 2);
      return true;
    }

    case 914: {
      // Polished Terrazzo: Venetian terrazzo flooring packed with colorful marble and glass chips
      rect(ctx, 0, 0, 48, 48, '#e2e8f0'); // Cementitious matrix
      // Embedded multicolored cut marble chips
      const chips: Array<[number, number, number, number, string]> = [
        [5, 6, 5, 4, '#ef4444'],   // Red porphyry
        [16, 4, 6, 5, '#10b981'],  // Green serpentine
        [28, 8, 4, 6, '#f59e0b'],  // Amber honey
        [39, 5, 5, 5, '#3b82f6'],  // Cobalt glass
        [8, 18, 6, 5, '#1e293b'],  // Nero marble
        [22, 16, 5, 6, '#ffffff'], // White Carrara
        [34, 19, 7, 4, '#ec4899'], // Rose coral
        [4, 30, 6, 6, '#06b6d4'],  // Turquoise
        [18, 28, 5, 5, '#8b5cf6'], // Amethyst
        [30, 31, 6, 5, '#eab308'], // Topaz
        [41, 28, 4, 6, '#10b981'],
        [12, 40, 5, 4, '#f97316'],
        [26, 39, 6, 5, '#3b82f6'],
        [38, 38, 5, 5, '#1e293b'],
      ];
      for (const [cx, cy, cw, ch, col] of chips) {
        rect(ctx, cx, cy, cw, ch, col);
        px1(ctx, cx, cy, '#ffffff'); // Chip polish reflection
      }
      // Diagonal mirror-buffed room wax specular highlight
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 47 - i, '#ffffff');
        if (i > 0) px1(ctx, i - 1, 47 - i, 'rgba(255,255,255,0.4)');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#94a3b8', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 4: Architectural Metals & Alloys (915..919)
    // ------------------------------------------------------------------------
    case 915: {
      // Raw Iron: Heavy cast pig iron ingot block with cast skin texture & cold steel highlights
      rect(ctx, 0, 0, 48, 48, '#47515e');
      const rand = prng(915);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.16) px1(ctx, x, y, '#2c333d');
          else if (r < 0.32) px1(ctx, x, y, '#3b434f');
          else if (r < 0.48) px1(ctx, x, y, '#596575');
          else if (r < 0.58) px1(ctx, x, y, '#7b899c');
        }
      }
      // Forged central ingot bevel recess
      bevel(ctx, 6, 6, 36, 36, '#2c333d', '#7b899c', 2);
      rect(ctx, 8, 8, 32, 32, '#3b434f');
      rect(ctx, 10, 10, 28, 2, '#7b899c'); // Top highlight of ingot
      rect(ctx, 10, 10, 2, 28, '#7b899c');
      bevel(ctx, 0, 0, 48, 48, '#8c9cb0', '#1e232a', 3);
      return true;
    }

    case 916: {
      // Riveted Iron: Industrial boiler plate steel with recessed seams & domed perimeter rivets
      rect(ctx, 0, 0, 48, 48, '#3d4754');
      // Recessed inner plate
      rect(ctx, 6, 6, 36, 36, '#4f5c6d');
      bevel(ctx, 6, 6, 36, 36, '#252b33', '#7b8c9e', 2);

      // Steel sheet horizontal brush texture
      for (let y = 10; y < 38; y += 3) {
        rect(ctx, 8, y, 32, 1, '#617285');
      }

      // Perimeter domed rivets (with specular crowns)
      const rivetPos = [
        [3, 3], [12, 3], [24, 3], [36, 3], [42, 3],
        [3, 42], [12, 42], [24, 42], [36, 42], [42, 42],
        [3, 15], [3, 27], [42, 15], [42, 27],
      ];
      for (const [rx, ry] of rivetPos) {
        rect(ctx, rx, ry, 4, 4, '#1e242c');
        rect(ctx, rx + 1, ry + 1, 2, 2, '#9ab0c4');
        px1(ctx, rx + 1, ry + 1, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#9ab0c4', '#15191e', 2);
      return true;
    }

    case 917: {
      // Stainless Steel: Brushed marine-grade stainless steel with horizontal directional grain & sweeping sheen
      rect(ctx, 0, 0, 48, 48, '#94a3b8');
      const rand = prng(917);
      // Fine linear horizontal brushing grain across all 48 pixels
      for (let y = 0; y < 48; y++) {
        const grainCol = rand() < 0.5 ? '#cbd5e1' : '#64748b';
        rect(ctx, 0, y, 48, 1, grainCol);
      }
      // Blazing vertical specular glare band sweeping down center
      rect(ctx, 16, 0, 8, 48, '#e2e8f0');
      rect(ctx, 20, 0, 4, 48, '#ffffff');
      rect(ctx, 30, 0, 4, 48, '#cbd5e1');
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#334155', 3);
      return true;
    }

    case 918: {
      // Fluted Brass: Architectural Art Deco fluted brass panel with 6 convex vertical flutes
      rect(ctx, 0, 0, 48, 48, '#8c5d19');
      // 6 vertical flutes (each 8px wide)
      for (let flute = 0; flute < 6; flute++) {
        const fx = flute * 8;
        rect(ctx, fx, 0, 1, 48, '#54360c'); // Deep valley shadow
        rect(ctx, fx + 1, 0, 1, 48, '#8c5d19');
        rect(ctx, fx + 2, 0, 2, 48, '#d99b36');
        rect(ctx, fx + 4, 0, 2, 48, '#f5ba42'); // Flute crown
        rect(ctx, fx + 5, 0, 1, 48, '#fff3a8'); // Brilliant specular highlight
        rect(ctx, fx + 6, 0, 1, 48, '#d99b36');
        rect(ctx, fx + 7, 0, 1, 48, '#8c5d19');
      }
      bevel(ctx, 0, 0, 48, 48, '#fff3a8', '#382205', 2);
      return true;
    }

    case 919: {
      // Engraved Bronze: Cast statuary bronze panel with hand-chased classical acanthus scroll filigree
      rect(ctx, 0, 0, 48, 48, '#4d2b0e'); // Dark antique patina background
      // Raised polished bronze border frame
      rect(ctx, 0, 0, 48, 5, '#b87333');
      rect(ctx, 0, 43, 48, 5, '#b87333');
      rect(ctx, 0, 0, 5, 48, '#b87333');
      rect(ctx, 43, 0, 5, 48, '#b87333');

      // Classical acanthus floral scroll relief in glowing polished bronze
      const scrolls = [
        [10, 10], [14, 12], [18, 16], [20, 20], [24, 24],
        [28, 28], [30, 32], [34, 36], [38, 38],
        [38, 10], [34, 12], [30, 16], [28, 20],
        [10, 38], [14, 36], [18, 32], [20, 28],
      ];
      for (const [sx, sy] of scrolls) {
        rect(ctx, sx - 2, sy - 2, 5, 5, '#d98c43');
        rect(ctx, sx - 1, sy - 1, 3, 3, '#f5ae62');
        px1(ctx, sx, sy, '#ffde99'); // Glint
      }
      // Central rosette medallion
      rect(ctx, 20, 20, 8, 8, '#d98c43');
      rect(ctx, 22, 22, 4, 4, '#ffde99');
      bevel(ctx, 0, 0, 48, 48, '#ffde99', '#241203', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 5: Silicates, Vitrified Glass & Fine Crystals (920..924)
    // ------------------------------------------------------------------------
    case 920: {
      // Clear Glass: Transparent modern architectural glass pane with specular streaks & metallic frame
      rect(ctx, 0, 0, 48, 48, '#0b1e33'); // Transparent glass interior dark field
      rect(ctx, 2, 2, 44, 44, '#1b3a5c');
      rect(ctx, 4, 4, 40, 40, '#2d5a88');

      // Twin sharp diagonal cyan-white specular reflection streaks
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 40 - i, '#7dd3fc');
        px1(ctx, i + 1, 40 - i, '#ffffff');
        px1(ctx, i, 52 - i, '#38bdf8');
        px1(ctx, i + 1, 52 - i, '#ffffff');
      }
      // Aluminum perimeter mounting clips
      rect(ctx, 0, 0, 6, 6, '#94a3b8');
      rect(ctx, 42, 0, 6, 6, '#94a3b8');
      rect(ctx, 0, 42, 6, 6, '#94a3b8');
      rect(ctx, 42, 42, 6, 6, '#94a3b8');
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#0f172a', 2);
      return true;
    }

    case 921: {
      // Frosted Glass: Acid-etched privacy glass with diffused soft lighting gradient & glossy edge bevel
      rect(ctx, 0, 0, 48, 48, '#385268');
      const rand = prng(921);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.20) px1(ctx, x, y, '#648aa8');
          else if (r < 0.45) px1(ctx, x, y, '#9ac2e0');
          else if (r < 0.70) px1(ctx, x, y, '#c4e2f7');
          else px1(ctx, x, y, '#e8f4fc'); // Micro-diffusion grain
        }
      }
      // Soft ambient light diffusion center
      rect(ctx, 14, 14, 20, 20, '#dcf0fa');
      rect(ctx, 18, 18, 12, 12, '#ffffff');
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#22384a', 3);
      return true;
    }

    case 922: {
      // Beveled Crystal: Heavy optical lead crystal block with diamond-point starburst cut facets
      rect(ctx, 0, 0, 48, 48, '#3b256b');
      // Faceted geometry: 8 radiating triangular cut planes
      rect(ctx, 6, 6, 36, 36, '#6b45a8');
      rect(ctx, 12, 12, 24, 24, '#9a6fd9');
      rect(ctx, 18, 18, 12, 12, '#c4a6f2');

      // Diagonal cut facet ridges
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, i, '#ffffff');
        px1(ctx, i, 47 - i, '#ffffff');
        px1(ctx, 24, i, '#e9d5ff');
        px1(ctx, i, 24, '#e9d5ff');
      }
      // Prismatic chromatic edge dispersion
      px1(ctx, 24, 6, '#f43f5e', 2, 2);
      px1(ctx, 24, 40, '#38bdf8', 2, 2);
      px1(ctx, 6, 24, '#facc15', 2, 2);
      px1(ctx, 40, 24, '#10b981', 2, 2);

      // Blinding center star reflection
      rect(ctx, 22, 22, 4, 4, '#ffffff');
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#201242', 2);
      return true;
    }

    case 923: {
      // Stained Glass: Cathedral rose-window quadrant with dark cast-iron lead came framing & jeweled glass
      rect(ctx, 0, 0, 48, 48, '#111827'); // Heavy dark lead came framework
      // 4 quadrant jewel glass fields
      rect(ctx, 3, 3, 20, 20, '#b91c1c'); // Crimson ruby glass
      rect(ctx, 25, 3, 20, 20, '#1d4ed8'); // Royal sapphire glass
      rect(ctx, 3, 25, 20, 20, '#047857'); // Emerald green glass
      rect(ctx, 25, 25, 20, 20, '#d97706'); // Golden amber glass

      // Internal glass texture highlights
      rect(ctx, 6, 6, 14, 14, '#ef4444');
      rect(ctx, 28, 6, 14, 14, '#3b82f6');
      rect(ctx, 6, 28, 14, 14, '#10b981');
      rect(ctx, 28, 28, 14, 14, '#f59e0b');

      // Specular glint in each glass pane
      px1(ctx, 8, 8, '#ffffff', 2, 2);
      px1(ctx, 30, 8, '#ffffff', 2, 2);
      px1(ctx, 8, 30, '#ffffff', 2, 2);
      px1(ctx, 30, 30, '#ffffff', 2, 2);

      // Lead came intersections
      rect(ctx, 0, 23, 48, 2, '#0f172a');
      rect(ctx, 23, 0, 2, 48, '#0f172a');
      bevel(ctx, 0, 0, 48, 48, '#6b7280', '#030712', 2);
      return true;
    }

    case 924: {
      // Prismatic Quartz: Naturally terminated quartz crystal cluster cross-section with violet phantom bands
      rect(ctx, 0, 0, 48, 48, '#3b0764');
      // Hexagonal quartz crystal growth rings
      rect(ctx, 4, 4, 40, 40, '#581c87');
      rect(ctx, 8, 8, 32, 32, '#7e22ce');
      rect(ctx, 12, 12, 24, 24, '#a855f7');
      rect(ctx, 16, 16, 16, 16, '#c084fc');
      rect(ctx, 20, 20, 8, 8, '#e9d5ff');

      // Radiating cleavage facet boundaries
      for (let i = 4; i < 44; i++) {
        px1(ctx, i, i, '#ffffff');
        px1(ctx, i, 47 - i, '#ffffff');
      }
      // Violet & cyan rainbow caustics
      px1(ctx, 12, 8, '#38bdf8', 4, 1);
      px1(ctx, 32, 38, '#f472b6', 4, 1);
      rect(ctx, 22, 22, 4, 4, '#ffffff'); // Crystal core brilliance
      bevel(ctx, 0, 0, 48, 48, '#f5d0fe', '#1e0438', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 6: Fine Luxury Hardwoods & Amber Resins (925..929)
    // ------------------------------------------------------------------------
    case 925: {
      // Polished Pine: Knot-free Scandinavian clear pine with warm satin polyurethane varnish
      rect(ctx, 0, 0, 48, 48, '#b88147');
      const rand = prng(925);
      // Gentle annual grain waves
      for (let y = 0; y < 48; y++) {
        const wave = Math.sin(y * 0.25) * 3;
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if ((x + wave) % 8 < 2) px1(ctx, x, y, '#d49b5d');
          else if (r < 0.25) px1(ctx, x, y, '#a6723c');
        }
      }
      // Satin polyurethane gloss reflection line
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 16 + Math.floor(i * 0.3), '#faedcd');
        px1(ctx, i, 17 + Math.floor(i * 0.3), '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#faedcd', '#5c3917', 2);
      return true;
    }

    case 926: {
      // Striped Teak: Quarter-sawn yacht-deck teak planks with contrasting dark stripes & caulking seams
      rect(ctx, 0, 0, 48, 48, '#171717'); // Jet-black yacht deck caulking
      // 3 wide teak planks (each 14px wide with 2px caulking between)
      for (let p = 0; p < 3; p++) {
        const px = 2 + p * 15;
        rect(ctx, px, 0, 14, 48, '#9c6841');
        // Alternating dark chocolate annual grain stripes
        for (let gx = 0; gx < 14; gx += 3) {
          rect(ctx, px + gx, 0, 1, 48, '#694123');
          rect(ctx, px + gx + 1, 0, 1, 48, '#bd875a');
        }
      }
      bevel(ctx, 0, 0, 48, 48, '#d4a287', '#0a0a0a', 2);
      return true;
    }

    case 927: {
      // Rich Mahogany: Deep wine-red Cuban mahogany with ribbon stripe curl chatoyancy & gold stringing
      rect(ctx, 0, 0, 48, 48, '#52190d');
      // Ribbon stripe curl waves
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const curl = Math.sin((x * 0.2) + (y * 0.15)) * 0.5 + 0.5;
          if (curl > 0.65) px1(ctx, x, y, '#802816');
          else if (curl > 0.35) px1(ctx, x, y, '#691f10');
          else px1(ctx, x, y, '#3d1208');
        }
      }
      // Inlaid satinwood stringing pinstripe border
      rect(ctx, 4, 4, 40, 1, '#fde047');
      rect(ctx, 4, 43, 40, 1, '#fde047');
      rect(ctx, 4, 4, 1, 40, '#fde047');
      rect(ctx, 43, 4, 1, 40, '#fde047');

      // French polish mirror sheen
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 47 - i, 'rgba(255,255,255,0.4)');
      }
      bevel(ctx, 0, 0, 48, 48, '#b83a24', '#260904', 2);
      return true;
    }

    case 928: {
      // Ebony Timber: Dense jet-black Gabon ebony with piano-lacquer mirror finish & sterling silver inlays
      rect(ctx, 0, 0, 48, 48, '#141416');
      // Subtle charcoal pore lines
      for (let y = 0; y < 48; y += 4) {
        rect(ctx, 0, y, 48, 1, '#242429');
      }
      // Sterling silver inlaid geometric framing
      rect(ctx, 5, 5, 38, 1, '#e2e8f0');
      rect(ctx, 5, 42, 38, 1, '#e2e8f0');
      rect(ctx, 5, 5, 1, 38, '#e2e8f0');
      rect(ctx, 42, 5, 1, 38, '#e2e8f0');
      // Silver corner rosettes
      rect(ctx, 4, 4, 3, 3, '#ffffff');
      rect(ctx, 41, 4, 3, 3, '#ffffff');
      rect(ctx, 4, 41, 3, 3, '#ffffff');
      rect(ctx, 41, 41, 3, 3, '#ffffff');

      // High piano gloss glare
      rect(ctx, 10, 10, 28, 2, '#ffffff');
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#050506', 2);
      return true;
    }

    case 929: {
      // Amber Wood: Petrified kauri wood enveloped in ancient glowing golden amber resin with fossil flecks
      rect(ctx, 0, 0, 48, 48, '#78350f');
      // Deep 3D golden honey translucent resin layers
      rect(ctx, 4, 4, 40, 40, '#b45309');
      rect(ctx, 8, 8, 32, 32, '#d97706');
      rect(ctx, 14, 14, 20, 20, '#f59e0b');
      rect(ctx, 18, 18, 12, 12, '#fbbf24');

      // Embedded microscopic golden fossil spangles
      const spangles = [[10, 12], [34, 10], [16, 32], [32, 30], [22, 24]];
      for (const [sx, sy] of spangles) {
        rect(ctx, sx, sy, 3, 3, '#fef08a');
        px1(ctx, sx + 1, sy + 1, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#fef08a', '#451a03', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 7: Palatial Ornamental Marbles & Semi-Precious Minerals (930..934)
    // ------------------------------------------------------------------------
    case 930: {
      // Carrara Marble: Pristine Tuscan white Carrara marble with sweeping soft grey feather veining
      rect(ctx, 0, 0, 48, 48, '#f8fafc');
      const rand = prng(930);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          if (rand() < 0.12) px1(ctx, x, y, '#e2e8f0');
          else if (rand() < 0.05) px1(ctx, x, y, '#cbd5e1');
        }
      }
      // Meandering feather calcite veins
      for (let i = 0; i < 44; i++) {
        const vy = Math.floor(4 + i * 0.9 + Math.sin(i * 0.25) * 4);
        px1(ctx, 2 + i, vy, '#94a3b8');
        px1(ctx, 2 + i, vy + 1, '#cbd5e1');
        if (i % 6 === 0) {
          px1(ctx, 2 + i, vy - 2, '#64748b'); // Branching feathery tendril
        }
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#94a3b8', 2);
      return true;
    }

    case 931: {
      // Nero Marquina: Deepest jet-black Spanish marble slashed with bold white calcite veins
      rect(ctx, 0, 0, 48, 48, '#09090b');
      // Dramatic diagonal lightning calcite veins
      for (let i = 0; i < 44; i++) {
        const vy = Math.floor(2 + i * 1.0 + (i % 5 === 0 ? 2 : 0));
        px1(ctx, 45 - i, vy, '#ffffff');
        px1(ctx, 46 - i, vy, '#d4d4d8');
        px1(ctx, 44 - i, vy, '#71717a');
      }
      // Secondary branching calcite capillary
      for (let i = 0; i < 20; i++) {
        px1(ctx, 10 + i, 14 + Math.floor(i * 0.6), '#e4e4e7');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#000000', 2);
      return true;
    }

    case 932: {
      // Malachite Slab: Russian Winter Palace malachite with concentric emerald bullseye banding & gilt frame
      rect(ctx, 0, 0, 48, 48, '#064e3b');
      // Concentric malachite rings
      const bands: Array<[number, number, number, string]> = [
        [24, 24, 18, '#047857'],
        [24, 24, 14, '#10b981'],
        [24, 24, 10, '#065f46'],
        [24, 24, 6, '#34d399'],
        [24, 24, 3, '#064e3b'],
      ];
      for (const [bx, by, rad, col] of bands) {
        for (let a = 0; a < 360; a += 4) {
          const ra = (a * Math.PI) / 180;
          const rx = Math.round(bx + Math.cos(ra) * rad);
          const ry = Math.round(by + Math.sin(ra) * rad);
          if (rx >= 4 && rx <= 43 && ry >= 4 && ry <= 43) {
            px1(ctx, rx, ry, col, 2, 2);
          }
        }
      }
      // Ormolu (gilded bronze) outer palatial frame
      rect(ctx, 0, 0, 48, 4, '#d97706');
      rect(ctx, 0, 44, 48, 4, '#d97706');
      rect(ctx, 0, 0, 4, 48, '#d97706');
      rect(ctx, 44, 0, 4, 48, '#d97706');
      bevel(ctx, 0, 0, 48, 48, '#fde68a', '#78350f', 2);
      return true;
    }

    case 933: {
      // Lapis Lazuli: Saturated deep ultramarine royal blue slab dense with sparkling golden pyrite flecks
      rect(ctx, 0, 0, 48, 48, '#1e3a8a');
      const rand = prng(933);
      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const r = rand();
          if (r < 0.15) px1(ctx, x, y, '#172554');
          else if (r < 0.35) px1(ctx, x, y, '#1d4ed8');
          else if (r < 0.42) px1(ctx, x, y, '#3b82f6');
          else if (r < 0.46) px1(ctx, x, y, '#e0e7ff'); // Calcite cloud
          else if (r < 0.52) px1(ctx, x, y, '#fbbf24'); // Pyrite gold fleck!
        }
      }
      // Gilded imperial corner molding
      rect(ctx, 2, 2, 8, 2, '#fbbf24');
      rect(ctx, 2, 2, 2, 8, '#fbbf24');
      rect(ctx, 38, 2, 8, 2, '#fbbf24');
      rect(ctx, 44, 2, 2, 8, '#fbbf24');
      rect(ctx, 2, 44, 8, 2, '#fbbf24');
      rect(ctx, 2, 38, 2, 8, '#fbbf24');
      rect(ctx, 38, 44, 8, 2, '#fbbf24');
      rect(ctx, 44, 38, 2, 8, '#fbbf24');
      bevel(ctx, 0, 0, 48, 48, '#fde047', '#0f172a', 2);
      return true;
    }

    case 934: {
      // Imperial Jade: Translucent nephrite jade block carved with archaic cloud relief & gold inlays
      rect(ctx, 0, 0, 48, 48, '#047857');
      rect(ctx, 4, 4, 40, 40, '#059669');
      rect(ctx, 8, 8, 32, 32, '#10b981');
      rect(ctx, 14, 14, 20, 20, '#34d399');

      // Archaic cloud scroll relief carvings
      const clouds = [[12, 12], [32, 12], [12, 32], [32, 32], [22, 22]];
      for (const [cx, cy] of clouds) {
        rect(ctx, cx, cy, 6, 4, '#6ee7b7');
        rect(ctx, cx + 1, cy + 1, 4, 2, '#a7f3d0');
      }

      // Pure 24K gold corner inlays
      rect(ctx, 0, 0, 6, 2, '#fbbf24');
      rect(ctx, 0, 0, 2, 6, '#fbbf24');
      rect(ctx, 42, 0, 6, 2, '#fbbf24');
      rect(ctx, 46, 0, 2, 6, '#fbbf24');
      rect(ctx, 0, 46, 6, 2, '#fbbf24');
      rect(ctx, 0, 42, 2, 6, '#fbbf24');
      rect(ctx, 42, 46, 6, 2, '#fbbf24');
      rect(ctx, 46, 42, 2, 6, '#fbbf24');
      bevel(ctx, 0, 0, 48, 48, '#a7f3d0', '#022c22', 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 8: Apex Sovereign Monoliths & Gem-Embedded Bullion (935..939)
    // ------------------------------------------------------------------------
    case 935: {
      // 14K Gold Block: Minted solid 14-karat gold bullion block with stamped mint hallmark
      rect(ctx, 0, 0, 48, 48, '#b45309');
      // Ingot face
      rect(ctx, 4, 4, 40, 40, '#d97706');
      rect(ctx, 6, 6, 36, 36, '#f59e0b');
      rect(ctx, 8, 8, 32, 32, '#fbbf24');

      // Stamped mint hallmark cartouche
      rect(ctx, 14, 16, 20, 16, '#d97706');
      rect(ctx, 16, 18, 16, 12, '#b45309');
      // Crown mint hallmark stamp inside
      rect(ctx, 20, 22, 8, 4, '#fbbf24');
      px1(ctx, 20, 20, '#fef08a');
      px1(ctx, 23, 20, '#fef08a');
      px1(ctx, 27, 20, '#fef08a');

      // Diagonal golden specular gleams
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 47 - i, '#fef08a');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#78350f', 3);
      return true;
    }

    case 936: {
      // 24K Gold Monolith: Pure 99.99% gold monolith with Greek-key border & sovereign sunburst seal
      rect(ctx, 0, 0, 48, 48, '#78350f');
      rect(ctx, 2, 2, 44, 44, '#d97706');
      rect(ctx, 4, 4, 40, 40, '#f59e0b');
      rect(ctx, 6, 6, 36, 36, '#fbbf24');

      // Greek-key relief meander border along all margins
      for (let x = 8; x < 40; x += 4) {
        rect(ctx, x, 8, 2, 2, '#78350f');
        rect(ctx, x, 38, 2, 2, '#78350f');
      }
      for (let y = 8; y < 40; y += 4) {
        rect(ctx, 8, y, 2, 2, '#78350f');
        rect(ctx, 38, y, 2, 2, '#78350f');
      }

      // Sovereign sunburst emblem center
      rect(ctx, 20, 20, 8, 8, '#ffffff');
      for (let d = 1; d <= 7; d++) {
        px1(ctx, 24 + d, 24, '#ffffff');
        px1(ctx, 24 - d, 24, '#ffffff');
        px1(ctx, 24, 24 + d, '#ffffff');
        px1(ctx, 24, 24 - d, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#451a03', 3);
      return true;
    }

    case 937: {
      // Platinum Lattice: Sovereign platinum matrix weaving polished platinum bars over glittering diamonds
      rect(ctx, 0, 0, 48, 48, '#0f172a'); // Background pavé setting
      // Pavé-set brilliant diamond background
      for (let y = 2; y < 46; y += 6) {
        for (let x = 2; x < 46; x += 6) {
          rect(ctx, x, y, 4, 4, '#38bdf8');
          rect(ctx, x + 1, y + 1, 2, 2, '#ffffff');
        }
      }

      // Polished platinum structural grid bars (vertical & horizontal)
      for (const gx of [10, 22, 34]) {
        rect(ctx, gx, 0, 4, 48, '#94a3b8');
        rect(ctx, gx + 1, 0, 2, 48, '#e2e8f0');
        rect(ctx, gx + 1, 0, 1, 48, '#ffffff');
      }
      for (const gy of [10, 22, 34]) {
        rect(ctx, 0, gy, 48, 4, '#94a3b8');
        rect(ctx, 0, gy + 1, 48, 2, '#e2e8f0');
        rect(ctx, 0, gy + 1, 48, 1, '#ffffff');
      }
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#334155', 2);
      return true;
    }

    case 938: {
      // Diamond Obsidian: Pitch-black mirror obsidian matrix embedded with multi-carat cut diamonds
      rect(ctx, 0, 0, 48, 48, '#05070d');
      // Obsidian reflective surface
      rect(ctx, 2, 2, 44, 44, '#0f172a');
      for (let i = 0; i < 48; i++) {
        px1(ctx, i, 47 - i, '#1e293b');
      }

      // 5 multi-carat brilliant cut diamonds (4 corners + center)
      const diamonds = [[10, 10], [34, 10], [10, 34], [34, 34], [22, 22]];
      for (const [dx, dy] of diamonds) {
        rect(ctx, dx - 3, dy - 3, 7, 7, '#0284c7');
        rect(ctx, dx - 2, dy - 2, 5, 5, '#38bdf8');
        rect(ctx, dx - 1, dy - 1, 3, 3, '#7dd3fc');
        px1(ctx, dx, dy, '#ffffff');

        // Starburst cyan refraction spikes
        for (let s = 1; s <= 5; s++) {
          px1(ctx, dx + s, dy, '#ffffff');
          px1(ctx, dx - s, dy, '#ffffff');
          px1(ctx, dx, dy + s, '#ffffff');
          px1(ctx, dx, dy - s, '#ffffff');
        }
      }
      bevel(ctx, 0, 0, 48, 48, '#7dd3fc', '#020617', 2);
      return true;
    }

    case 939: {
      // Imperial Monolith: Apex Sovereign Masterpiece — 24K gold filigree, royal crimson field & crowning heart diamond
      rect(ctx, 0, 0, 48, 48, '#d97706'); // Solid 24K gold frame
      rect(ctx, 2, 2, 44, 44, '#fbbf24');
      rect(ctx, 4, 4, 40, 40, '#4c0519'); // Deep royal imperial velvet crimson
      rect(ctx, 6, 6, 36, 36, '#881337');
      rect(ctx, 8, 8, 32, 32, '#9f1239');

      // 24K Gold royal filigree acanthus corners
      rect(ctx, 8, 8, 8, 2, '#fbbf24');
      rect(ctx, 8, 8, 2, 8, '#fbbf24');
      rect(ctx, 32, 8, 8, 2, '#fbbf24');
      rect(ctx, 38, 8, 2, 8, '#fbbf24');
      rect(ctx, 8, 38, 8, 2, '#fbbf24');
      rect(ctx, 8, 32, 2, 8, '#fbbf24');
      rect(ctx, 32, 38, 8, 2, '#fbbf24');
      rect(ctx, 38, 32, 2, 8, '#fbbf24');

      // Giant center multifaceted sovereign diamond
      rect(ctx, 18, 18, 12, 12, '#fbbf24'); // Gold cartouche
      rect(ctx, 20, 20, 8, 8, '#38bdf8');
      rect(ctx, 21, 21, 6, 6, '#7dd3fc');
      rect(ctx, 22, 22, 4, 4, '#ffffff');

      // Crown halo jewels (Emerald, Sapphire, Ruby, Topaz)
      rect(ctx, 22, 11, 4, 4, '#10b981'); // Emerald
      rect(ctx, 33, 22, 4, 4, '#3b82f6'); // Sapphire
      rect(ctx, 22, 33, 4, 4, '#ef4444'); // Ruby
      rect(ctx, 11, 22, 4, 4, '#f59e0b'); // Topaz

      // Blazing sovereign sparkles
      px1(ctx, 24, 24, '#ffffff', 2, 2);
      bevel(ctx, 0, 0, 48, 48, '#ffffff', '#451a03', 3);
      return true;
    }

    default:
      return false;
  }
}

export const FARMABLE_TIER_FRAME_COLORS: Record<number, { border: string; highlight: string; shadow: string }> = {
  1: { border: '#a17347', highlight: '#cfa276', shadow: '#4d331c' }, // T1 Earth Bronze
  2: { border: '#8fa1b5', highlight: '#c3d2e3', shadow: '#3a4654' }, // T2 Quarry Slate
  3: { border: '#2dd4bf', highlight: '#99f6e4', shadow: '#0f5c54' }, // T3 Ceramic Teal
  4: { border: '#60a5fa', highlight: '#bfdbfe', shadow: '#1e3a6e' }, // T4 Alloy Cobalt
  5: { border: '#c084fc', highlight: '#e9d5ff', shadow: '#4c1d7a' }, // T5 Crystal Amethyst
  6: { border: '#f59e0b', highlight: '#fde68a', shadow: '#78350f' }, // T6 Amber Gold
  7: { border: '#34d399', highlight: '#a7f3d0', shadow: '#064e3b' }, // T7 Imperial Emerald
  8: { border: '#fde047', highlight: '#fef9c3', shadow: '#713f12' }, // T8 Sovereign Radiant Gold
};

export function drawFarmableTierFrame48(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def?: ItemDefinition
): void {
  if (itemId < 900 || itemId > 939) return;
  const tier = def?.farmableTier ?? Math.floor((itemId - 900) / 5) + 1;
  const pal = FARMABLE_TIER_FRAME_COLORS[tier] ?? FARMABLE_TIER_FRAME_COLORS[1];
  const prevAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1;
  ctx.save?.();

  // Subtle dark outer hairline to separate the tinted frame cleanly
  ctx.globalAlpha = prevAlpha * 0.34;
  ctx.fillStyle = pal.shadow;
  ctx.fillRect(0, 0, 48, 1);
  ctx.fillRect(0, 47, 48, 1);
  ctx.fillRect(0, 1, 1, 46);
  ctx.fillRect(47, 1, 1, 46);

  // Subtle, readable 2px tier-colored perimeter band
  ctx.globalAlpha = prevAlpha * 0.46;
  ctx.fillStyle = pal.border;
  ctx.fillRect(1, 1, 46, 2);
  ctx.fillRect(1, 45, 46, 2);
  ctx.fillRect(1, 3, 2, 42);
  ctx.fillRect(45, 3, 2, 42);

  // Crisp subtle corner jewel accents + top-left inner glint
  ctx.globalAlpha = prevAlpha * 0.62;
  ctx.fillStyle = pal.highlight;
  ctx.fillRect(1, 1, 4, 2);
  ctx.fillRect(1, 1, 2, 4);
  ctx.fillRect(43, 1, 4, 2);
  ctx.fillRect(45, 1, 2, 4);
  ctx.fillRect(1, 45, 4, 2);
  ctx.fillRect(1, 43, 2, 4);
  ctx.fillRect(43, 45, 4, 2);
  ctx.fillRect(45, 43, 2, 4);

  ctx.restore?.();
  ctx.globalAlpha = prevAlpha;
}

export function drawFarmableBlockRaw48(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDefinition
): boolean {
  const ok = drawFarmableBlockArtwork48(ctx, itemId, def);
  if (ok) {
    drawFarmableTierFrame48(ctx, itemId, def);
  }
  return ok;
}

// ============================================================================
// 40 DEDICATED HIGH-DETAIL SEED ART RENDERERS (IDs 950..989)
// ============================================================================

export function drawFarmableSeedRaw48(
  ctx: CanvasRenderingContext2D,
  seedId: number,
  def: ItemDefinition
): boolean {
  // Clear transparent background
  ctx.clearRect(0, 0, 48, 48);

  switch (seedId) {
    // ------------------------------------------------------------------------
    // TIER 1 SEEDS (950..954)
    // ------------------------------------------------------------------------
    case 950: {
      // Clay Soil Seed: Terracotta clay geode pod with damp clay sheen & tiny green shoot
      rect(ctx, 14, 16, 20, 22, '#5d321d');
      rect(ctx, 16, 14, 16, 24, '#5d321d');
      rect(ctx, 16, 16, 16, 20, '#874f33');
      rect(ctx, 18, 18, 12, 14, '#b3744e');
      px1(ctx, 20, 20, '#cca17f', 4, 4); // Granule highlight
      // Botanical green sprout emerging from top
      rect(ctx, 22, 8, 4, 8, '#15803d');
      rect(ctx, 24, 6, 6, 4, '#22c55e');
      px1(ctx, 26, 6, '#86efac', 2, 2);
      return true;
    }

    case 951: {
      // Packed Earth Seed: Compressed loam lithic seed nodule with striations
      rect(ctx, 14, 16, 20, 20, '#3d2411');
      rect(ctx, 16, 14, 16, 22, '#3d2411');
      rect(ctx, 16, 16, 16, 18, '#7a5433');
      rect(ctx, 18, 18, 12, 12, '#a87a50');
      rect(ctx, 20, 22, 8, 2, '#c29b74');
      // Tiny seedling nib
      rect(ctx, 26, 8, 3, 7, '#16a34a');
      rect(ctx, 27, 6, 5, 4, '#4ade80');
      return true;
    }

    case 952: {
      // Natural Log Seed: Forest timber acorn with textured wood grain cap
      // Acorn nut body
      rect(ctx, 16, 20, 16, 18, '#3d2514');
      rect(ctx, 18, 22, 12, 14, '#9c6f43');
      rect(ctx, 20, 24, 8, 8, '#b38252');
      // Textured acorn cap
      rect(ctx, 14, 12, 20, 10, '#271609');
      rect(ctx, 16, 14, 16, 6, '#5a381f');
      // Cap scales
      for (let cx = 16; cx < 30; cx += 4) px1(ctx, cx, 14, '#8c5f35', 2, 2);
      // Oak stem
      rect(ctx, 22, 6, 4, 7, '#271609');
      return true;
    }

    case 953: {
      // Wood Plank Seed: Sawn structural peg seed with crisp grain edges
      rect(ctx, 16, 12, 16, 26, '#2d1b09');
      rect(ctx, 18, 14, 12, 22, '#96683b');
      rect(ctx, 20, 14, 4, 22, '#c99663');
      // Transverse nail head
      rect(ctx, 22, 18, 4, 4, '#2f3542');
      px1(ctx, 22, 18, '#a4b0be');
      return true;
    }

    case 954: {
      // Reinforced Timber Seed: Timber seed capsule bound with dark iron bands
      rect(ctx, 14, 14, 20, 22, '#141820');
      rect(ctx, 16, 16, 16, 18, '#7a512b');
      // Steel strap across center
      rect(ctx, 12, 22, 24, 6, '#2f3542');
      rect(ctx, 12, 23, 24, 2, '#747d8c');
      // Hexagonal bolt
      rect(ctx, 22, 23, 4, 4, '#a4b0be');
      px1(ctx, 23, 23, '#ffffff');
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 2 SEEDS (955..959)
    // ------------------------------------------------------------------------
    case 955: {
      // Quarry Stone Seed: Rough-hewn angular quarry pebble with rocky facets
      rect(ctx, 14, 14, 20, 20, '#374151');
      rect(ctx, 16, 16, 16, 16, '#6b7280');
      rect(ctx, 18, 16, 8, 8, '#9ca3af');
      rect(ctx, 22, 20, 8, 8, '#4b5563');
      px1(ctx, 18, 18, '#ffffff', 2, 2);
      return true;
    }

    case 956: {
      // Chiseled Stone Seed: Cube-carved ashlar stone seed with drafted margin
      rect(ctx, 14, 14, 20, 20, '#383e47');
      rect(ctx, 16, 16, 16, 16, '#7b8391');
      rect(ctx, 18, 18, 12, 12, '#666e7c');
      rect(ctx, 16, 16, 16, 2, '#c4ccd8');
      rect(ctx, 16, 16, 2, 16, '#c4ccd8');
      return true;
    }

    case 957: {
      // Fired Brick Seed: Kiln-baked miniature red clay brick nugget with pale mortar dust
      rect(ctx, 12, 16, 24, 16, '#5e170d');
      rect(ctx, 14, 18, 20, 12, '#b84435');
      rect(ctx, 16, 18, 16, 4, '#e88978');
      px1(ctx, 14, 18, '#d4c9b8', 3, 2); // Mortar specks
      px1(ctx, 28, 26, '#d4c9b8', 3, 2);
      return true;
    }

    case 958: {
      // Patterned Brick Seed: Relief geometric brick token with chevron motif
      rect(ctx, 14, 14, 20, 20, '#3b160e');
      rect(ctx, 16, 16, 16, 16, '#ba4c34');
      // Chevron cross
      for (let i = 0; i < 8; i++) {
        px1(ctx, 16 + i, 16 + i, '#dc6850', 2, 2);
        px1(ctx, 30 - i, 16 + i, '#dc6850', 2, 2);
      }
      return true;
    }

    case 959: {
      // Stone Paver Seed: Rounded river stone paver seed with polished top crown
      rect(ctx, 14, 14, 20, 20, '#1f2937');
      rect(ctx, 16, 16, 16, 16, '#788291');
      rect(ctx, 18, 18, 12, 12, '#9ea9ba');
      px1(ctx, 20, 20, '#ffffff', 4, 2); // Crown gleam
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 3 SEEDS (960..964)
    // ------------------------------------------------------------------------
    case 960: {
      // Smooth Basalt Seed: Silky dark charcoal volcanic basalt ellipsoid
      rect(ctx, 14, 14, 20, 22, '#10141a');
      rect(ctx, 16, 16, 16, 18, '#262d3a');
      rect(ctx, 18, 18, 12, 12, '#434d63');
      px1(ctx, 20, 18, '#596782', 6, 2);
      return true;
    }

    case 961: {
      // Veined Granite Seed: Speckled architectural granite seed with biotite & quartz sparks
      rect(ctx, 14, 14, 20, 20, '#475569');
      rect(ctx, 16, 16, 16, 16, '#cbd5e1');
      // Biotite flecks & quartz
      px1(ctx, 18, 18, '#0f172a', 2, 2);
      px1(ctx, 26, 20, '#0f172a', 2, 2);
      px1(ctx, 20, 26, '#0f172a', 2, 2);
      px1(ctx, 22, 18, '#ffffff', 3, 2);
      return true;
    }

    case 962: {
      // Glazed Ceramic Seed: High-gloss vitreous turquoise enamel droplet
      rect(ctx, 16, 12, 16, 24, '#0369a1');
      rect(ctx, 18, 14, 12, 20, '#0284c7');
      rect(ctx, 20, 16, 8, 14, '#0ea5e9');
      // Glaze reflection
      for (let i = 0; i < 8; i++) {
        px1(ctx, 20 + i, 24 - i, '#ffffff', 2, 1);
      }
      return true;
    }

    case 963: {
      // Ceramic Mosaic Seed: Byzantine mosaic tessera seed set with turquoise & gold foil
      rect(ctx, 14, 14, 20, 20, '#0f172a');
      rect(ctx, 16, 16, 8, 8, '#0284c7');
      rect(ctx, 24, 16, 8, 8, '#f59e0b');
      rect(ctx, 16, 24, 8, 8, '#f43f5e');
      rect(ctx, 24, 24, 8, 8, '#06b6d4');
      px1(ctx, 26, 18, '#fde68a', 2, 2); // Gold foil spark
      return true;
    }

    case 964: {
      // Polished Terrazzo Seed: Venetian cabochon seed packed with colored marble chips
      rect(ctx, 14, 14, 20, 20, '#94a3b8');
      rect(ctx, 16, 16, 16, 16, '#e2e8f0');
      // Tiny chips
      px1(ctx, 18, 18, '#ef4444', 2, 2);
      px1(ctx, 26, 18, '#10b981', 2, 2);
      px1(ctx, 22, 24, '#f59e0b', 3, 2);
      px1(ctx, 18, 26, '#3b82f6', 2, 2);
      px1(ctx, 20, 18, '#ffffff', 2, 2);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 4 SEEDS (965..969)
    // ------------------------------------------------------------------------
    case 965: {
      // Raw Iron Seed: Heavy cast iron ingot seed with metallic sheen
      rect(ctx, 14, 14, 20, 20, '#1e232a');
      rect(ctx, 16, 16, 16, 16, '#47515e');
      rect(ctx, 18, 18, 12, 12, '#596575');
      rect(ctx, 18, 18, 12, 2, '#8c9cb0');
      rect(ctx, 18, 18, 2, 12, '#8c9cb0');
      return true;
    }

    case 966: {
      // Riveted Iron Seed: Industrial boiler-plate steel seed capsule with perimeter rivets
      rect(ctx, 14, 14, 20, 20, '#15191e');
      rect(ctx, 16, 16, 16, 16, '#4f5c6d');
      // Rivets at 4 corners
      px1(ctx, 16, 16, '#ffffff');
      px1(ctx, 30, 16, '#ffffff');
      px1(ctx, 16, 30, '#ffffff');
      px1(ctx, 30, 30, '#ffffff');
      rect(ctx, 20, 20, 8, 8, '#7b8c9e');
      return true;
    }

    case 967: {
      // Stainless Steel Seed: Machined brushed stainless steel bullet seed with bright glare
      rect(ctx, 16, 12, 16, 24, '#334155');
      rect(ctx, 18, 14, 12, 20, '#94a3b8');
      rect(ctx, 20, 14, 4, 20, '#ffffff'); // Vertical brush glare
      return true;
    }

    case 968: {
      // Fluted Brass Seed: Architectural fluted brass acorn with golden ridge lines
      rect(ctx, 14, 14, 20, 22, '#382205');
      rect(ctx, 16, 16, 16, 18, '#d99b36');
      for (let fx = 18; fx <= 28; fx += 3) {
        rect(ctx, fx, 16, 1, 18, '#fff3a8');
      }
      return true;
    }

    case 969: {
      // Engraved Bronze Seed: Statuary bronze medallion seed engraved with floral filigree
      rect(ctx, 14, 14, 20, 20, '#241203');
      rect(ctx, 16, 16, 16, 16, '#b87333');
      rect(ctx, 18, 18, 12, 12, '#d98c43');
      rect(ctx, 22, 22, 4, 4, '#ffde99');
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 5 SEEDS (970..974)
    // ------------------------------------------------------------------------
    case 970: {
      // Clear Glass Seed: Blown glass tear bead with specular cyan-white transparency glints
      rect(ctx, 16, 12, 16, 24, '#0f172a');
      rect(ctx, 18, 14, 12, 20, '#2d5a88');
      rect(ctx, 20, 16, 8, 16, '#7dd3fc');
      px1(ctx, 22, 16, '#ffffff', 4, 4);
      return true;
    }

    case 971: {
      // Frosted Glass Seed: Translucent acid-frosted sea-glass orb with diffused glow
      rect(ctx, 14, 14, 20, 20, '#22384a');
      rect(ctx, 16, 16, 16, 16, '#9ac2e0');
      rect(ctx, 20, 20, 8, 8, '#ffffff');
      return true;
    }

    case 972: {
      // Beveled Crystal Seed: Faceted diamond-cut optical crystal prism seed
      rect(ctx, 14, 14, 20, 20, '#201242');
      rect(ctx, 16, 16, 16, 16, '#9a6fd9');
      rect(ctx, 20, 20, 8, 8, '#ffffff');
      px1(ctx, 16, 16, '#f43f5e', 2, 2);
      px1(ctx, 30, 30, '#38bdf8', 2, 2);
      return true;
    }

    case 973: {
      // Stained Glass Seed: Lead-framed gothic rosette seed with ruby, sapphire, and amber panes
      rect(ctx, 14, 14, 20, 20, '#030712');
      rect(ctx, 16, 16, 7, 7, '#ef4444');
      rect(ctx, 25, 16, 7, 7, '#3b82f6');
      rect(ctx, 16, 25, 7, 7, '#10b981');
      rect(ctx, 25, 25, 7, 7, '#f59e0b');
      px1(ctx, 22, 22, '#ffffff', 4, 4);
      return true;
    }

    case 974: {
      // Prismatic Quartz Seed: Terminated amethyst quartz spire seed with rainbow caustics
      rect(ctx, 16, 10, 16, 28, '#1e0438');
      rect(ctx, 18, 12, 12, 24, '#7e22ce');
      rect(ctx, 20, 14, 8, 20, '#c084fc');
      rect(ctx, 22, 16, 4, 16, '#ffffff');
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 6 SEEDS (975..979)
    // ------------------------------------------------------------------------
    case 975: {
      // Polished Pine Seed: Scandinavian pine cone seed with polished scales
      rect(ctx, 16, 14, 16, 22, '#5c3917');
      rect(ctx, 18, 16, 12, 18, '#b88147');
      rect(ctx, 20, 18, 8, 12, '#faedcd');
      return true;
    }

    case 976: {
      // Striped Teak Seed: Striped yacht teak pod seed with dark annual stripes
      rect(ctx, 16, 12, 16, 24, '#0a0a0a');
      rect(ctx, 18, 14, 12, 20, '#9c6841');
      rect(ctx, 20, 14, 2, 20, '#694123');
      rect(ctx, 24, 14, 2, 20, '#d4a287');
      return true;
    }

    case 977: {
      // Rich Mahogany Seed: French-polished mahogany burl seed with deep wine-red chatoyancy
      rect(ctx, 14, 14, 20, 20, '#260904');
      rect(ctx, 16, 16, 16, 16, '#691f10');
      rect(ctx, 18, 18, 12, 12, '#b83a24');
      rect(ctx, 20, 20, 8, 8, '#fde047');
      return true;
    }

    case 978: {
      // Ebony Timber Seed: Piano-lacquer jet ebony seed bead with sterling silver inlay
      rect(ctx, 14, 14, 20, 20, '#050506');
      rect(ctx, 16, 16, 16, 16, '#1c1917');
      rect(ctx, 20, 20, 8, 8, '#ffffff'); // Sterling silver star
      return true;
    }

    case 979: {
      // Amber Wood Seed: Fossil amber droplet seed with golden spangles inside
      rect(ctx, 16, 12, 16, 24, '#451a03');
      rect(ctx, 18, 14, 12, 20, '#d97706');
      rect(ctx, 20, 16, 8, 14, '#fbbf24');
      px1(ctx, 22, 18, '#ffffff', 4, 4);
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 7 SEEDS (980..984)
    // ------------------------------------------------------------------------
    case 980: {
      // Carrara Marble Seed: Tuscan white Carrara marble teardrop with soft grey veining
      rect(ctx, 16, 12, 16, 24, '#94a3b8');
      rect(ctx, 18, 14, 12, 20, '#f8fafc');
      px1(ctx, 20, 18, '#64748b', 6, 2); // Calcite vein
      px1(ctx, 22, 24, '#94a3b8', 6, 2);
      return true;
    }

    case 981: {
      // Nero Marquina Seed: Jet-black limestone seed slashed with white lightning calcite veins
      rect(ctx, 14, 14, 20, 20, '#000000');
      rect(ctx, 16, 16, 16, 16, '#18181b');
      // Slashing white vein
      for (let i = 0; i < 14; i++) {
        px1(ctx, 30 - i, 17 + i, '#ffffff', 2, 1);
      }
      return true;
    }

    case 982: {
      // Malachite Slab Seed: Royal malachite orb seed with concentric emerald bullseye rings & gold trim
      rect(ctx, 14, 14, 20, 20, '#78350f'); // Gold trim
      rect(ctx, 16, 16, 16, 16, '#064e3b');
      rect(ctx, 18, 18, 12, 12, '#10b981');
      rect(ctx, 20, 20, 8, 8, '#065f46');
      rect(ctx, 22, 22, 4, 4, '#34d399');
      return true;
    }

    case 983: {
      // Lapis Lazuli Seed: Ultramarine lapis lazuli seed nugget dense with golden pyrite flecks
      rect(ctx, 14, 14, 20, 20, '#0f172a');
      rect(ctx, 16, 16, 16, 16, '#1d4ed8');
      rect(ctx, 18, 18, 12, 12, '#2563eb');
      // Pyrite gold sparks
      px1(ctx, 20, 20, '#fbbf24', 2, 2);
      px1(ctx, 26, 22, '#fbbf24', 2, 2);
      px1(ctx, 22, 26, '#fbbf24', 2, 2);
      return true;
    }

    case 984: {
      // Imperial Jade Seed: Translucent Burmese emerald jade talisman seed with archaic carvings
      rect(ctx, 14, 14, 20, 20, '#022c22');
      rect(ctx, 16, 16, 16, 16, '#059669');
      rect(ctx, 18, 18, 12, 12, '#34d399');
      rect(ctx, 22, 22, 4, 4, '#fbbf24'); // Gold core
      return true;
    }

    // ------------------------------------------------------------------------
    // TIER 8 SEEDS (985..989)
    // ------------------------------------------------------------------------
    case 985: {
      // 14K Gold Seed: Minted 14K gold mini bullion ingot seed with assay stamp
      rect(ctx, 14, 14, 20, 20, '#78350f');
      rect(ctx, 16, 16, 16, 16, '#d97706');
      rect(ctx, 18, 18, 12, 12, '#fbbf24');
      rect(ctx, 20, 20, 8, 8, '#fef08a');
      return true;
    }

    case 986: {
      // 24K Gold Monolith Seed: Crowned 24K royal bullion seed with Greek-key relief & sunburst
      rect(ctx, 14, 14, 20, 20, '#451a03');
      rect(ctx, 16, 16, 16, 16, '#f59e0b');
      rect(ctx, 18, 18, 12, 12, '#fbbf24');
      rect(ctx, 20, 20, 8, 8, '#ffffff'); // Blinding sunburst
      return true;
    }

    case 987: {
      // Platinum Lattice Seed: Sovereign platinum filigree cage seed enclosing a brilliant diamond
      rect(ctx, 14, 14, 20, 20, '#334155');
      rect(ctx, 16, 16, 16, 16, '#94a3b8');
      rect(ctx, 18, 18, 12, 12, '#38bdf8');
      rect(ctx, 20, 20, 8, 8, '#ffffff'); // Diamond center
      return true;
    }

    case 988: {
      // Diamond Obsidian Seed: Pitch-black obsidian seed nodule encrusted with sparkling diamonds
      rect(ctx, 14, 14, 20, 20, '#020617');
      rect(ctx, 16, 16, 16, 16, '#0f172a');
      // Encrusted diamond points
      px1(ctx, 18, 18, '#ffffff', 3, 3);
      px1(ctx, 26, 18, '#38bdf8', 3, 3);
      px1(ctx, 18, 26, '#38bdf8', 3, 3);
      px1(ctx, 26, 26, '#ffffff', 3, 3);
      return true;
    }

    case 989: {
      // Imperial Monolith Seed: Sovereign Imperial Crown Seed with royal crimson core, 24K gold & halo diamond
      rect(ctx, 12, 12, 24, 24, '#fbbf24'); // 24K Gold royal crown setting
      rect(ctx, 14, 14, 20, 20, '#881337'); // Imperial velvet crimson
      rect(ctx, 16, 16, 16, 16, '#e11d48');
      rect(ctx, 20, 20, 8, 8, '#ffffff'); // Crowning diamond brilliance
      // 4 Halo jewels
      px1(ctx, 14, 14, '#10b981', 3, 3); // Emerald
      px1(ctx, 31, 14, '#3b82f6', 3, 3); // Sapphire
      px1(ctx, 14, 31, '#f59e0b', 3, 3); // Topaz
      px1(ctx, 31, 31, '#ffffff', 3, 3); // Diamond glint
      return true;
    }

    default:
      return false;
  }
}

// ============================================================================
// 32-BIT DOWNSCALED PIXEL-ART RESOLUTION PIPELINE & CACHE
// ============================================================================

const farmable32TextureCache = new Map<number, HTMLCanvasElement>();

/**
 * Downscales the high-detail material artwork into a native 32x32 (32-bit pixel art) canvas.
 * Preserves the rich material colors, gradients, and luxury embellishments while locking
 * them to a sharp 32-bit pixel art resolution grid.
 */
export function getFarmableTexture32(
  itemId: number,
  def?: ItemDefinition
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cached = farmable32TextureCache.get(itemId);
  if (cached) return cached;

  const isBlock = itemId >= 900 && itemId <= 939;
  const isSeed = itemId >= 950 && itemId <= 989;
  if (!isBlock && !isSeed) return null;

  // 1. Create a 48x48 buffer canvas for the detailed artwork
  const c48 = document.createElement('canvas');
  c48.width = 48;
  c48.height = 48;
  const ctx48 = c48.getContext('2d');
  if (!ctx48) return null;
  ctx48.imageSmoothingEnabled = false;

  const itemDef = def ?? (CATALOG[itemId] as ItemDefinition);
  if (!itemDef) return null;

  const success = isBlock
    ? drawFarmableBlockRaw48(ctx48, itemId, itemDef)
    : drawFarmableSeedRaw48(ctx48, itemId, itemDef);

  if (!success) return null;

  // 2. Downscale into a native 32x32 (32-bit pixel art) canvas
  const c32 = document.createElement('canvas');
  c32.width = 32;
  c32.height = 32;
  const ctx32 = c32.getContext('2d');
  if (!ctx32) return null;

  // High-quality downsampling to preserve all fine material features into the 32x32 pixel grid
  ctx32.imageSmoothingEnabled = true;
  ctx32.imageSmoothingQuality = 'high';
  ctx32.drawImage(c48, 0, 0, 48, 48, 0, 0, 32, 32);

  farmable32TextureCache.set(itemId, c32);
  return c32;
}

/**
 * Draws a 32-bit downscaled block texture onto any destination canvas context.
 * Uses nearest-neighbor scaling (imageSmoothingEnabled = false) to ensure crisp 32-bit pixel edges.
 */
export function drawFarmableBlock32(
  ctx: CanvasRenderingContext2D,
  itemId: number,
  def: ItemDefinition,
  targetWidth?: number,
  targetHeight?: number
): boolean {
  const w = targetWidth ?? (ctx.canvas ? ctx.canvas.width : 48);
  const h = targetHeight ?? (ctx.canvas ? ctx.canvas.height : 48);
  if (typeof document !== 'undefined') {
    const tex32 = getFarmableTexture32(itemId, def);
    if (tex32) {
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tex32, 0, 0, 32, 32, 0, 0, w, h);
      ctx.imageSmoothingEnabled = prevSmoothing;
      return true;
    }
  }
  return drawFarmableBlockRaw48(ctx, itemId, def);
}

/**
 * Draws a 32-bit downscaled seed texture onto any destination canvas context.
 * Uses nearest-neighbor scaling (imageSmoothingEnabled = false) to ensure crisp 32-bit pixel edges.
 */
export function drawFarmableSeed32(
  ctx: CanvasRenderingContext2D,
  seedId: number,
  def: ItemDefinition,
  targetWidth?: number,
  targetHeight?: number
): boolean {
  const w = targetWidth ?? (ctx.canvas ? ctx.canvas.width : 48);
  const h = targetHeight ?? (ctx.canvas ? ctx.canvas.height : 48);
  if (typeof document !== 'undefined') {
    const tex32 = getFarmableTexture32(seedId, def);
    if (tex32) {
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tex32, 0, 0, 32, 32, 0, 0, w, h);
      ctx.imageSmoothingEnabled = prevSmoothing;
      return true;
    }
  }
  return drawFarmableSeedRaw48(ctx, seedId, def);
}

// Backward-compatible wrappers for existing callers
export const drawFarmableBlock48 = drawFarmableBlock32;
export const drawFarmableSeed48 = drawFarmableSeed32;

