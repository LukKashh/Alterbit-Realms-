import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG } from '../src/game/catalog.ts';
import {
  CATALOG_TEX30_SIZE,
  drawCatalogItem30,
  drawCatalogItemRaw30,
  drawCatalogItemRaw48,
} from '../src/game/catalogArt30.ts';

interface FillOp {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

function createMockCtx30(): { ctx: CanvasRenderingContext2D; ops: FillOp[] } {
  const ops: FillOp[] = [];
  let currentFill = '#000000';
  const ctx = {
    imageSmoothingEnabled: false,
    set fillStyle(val: string) {
      currentFill = String(val);
    },
    get fillStyle() {
      return currentFill;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push({ x, y, w, h, color: currentFill });
    },
    clearRect() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, ops };
}

test('All non-farmable CATALOG items render 30-bit (30x30) textures within bounds with rich multi-tone palettes', () => {
  const allIds = Object.keys(CATALOG)
    .map(Number)
    .sort((a, b) => a - b);

  const nonFarmableIds = allIds.filter(
    (id) => id !== 0 && !(id >= 900 && id <= 939) && !(id >= 950 && id <= 989)
  );

  assert.ok(
    nonFarmableIds.length >= 180,
    `Expected at least 180 non-farmable items in CATALOG, found ${nonFarmableIds.length}`
  );

  for (const id of nonFarmableIds) {
    const def = CATALOG[id];
    const { ctx, ops } = createMockCtx30();
    const handled = drawCatalogItemRaw30(ctx, id, def);
    assert.equal(
      handled,
      true,
      `Expected non-farmable item ${id} (${def.name}) to be handled by drawCatalogItemRaw30`
    );
    assert.ok(
      ops.length >= 10,
      `Expected item ${id} (${def.name}) to emit at least 10 30-bit draw operations, got ${ops.length}`
    );

    const uniqueColors = new Set<string>();
    for (const op of ops) {
      uniqueColors.add(op.color);
      assert.ok(
        op.x >= 0 && op.y >= 0 && op.x + op.w <= CATALOG_TEX30_SIZE && op.y + op.h <= CATALOG_TEX30_SIZE,
        `Item ${id} (${def.name}) drew outside 30x30 bounds: (${op.x},${op.y},${op.w},${op.h})`
      );
    }
    assert.ok(
      uniqueColors.size >= 3,
      `Expected item ${id} (${def.name}) to use at least 3 distinct shading colors in 30-bit art, got ${uniqueColors.size}`
    );

    // Also verify drawCatalogItem30 and drawCatalogItemRaw48 wrappers succeed
    const { ctx: ctxWrap, ops: wrapOps } = createMockCtx30();
    assert.equal(drawCatalogItem30(ctxWrap, id, def, 60, 60), true);
    assert.ok(wrapOps.length >= 10);

    const { ctx: ctx48, ops: ops48 } = createMockCtx30();
    assert.equal(drawCatalogItemRaw48(ctx48, id, def), true);
    assert.ok(ops48.length >= 10);
  }
});

test('Farmable blocks (900..939), farmable seeds (950..989), and Empty Air (0) are excluded from catalogArt30', () => {
  const { ctx } = createMockCtx30();
  assert.equal(drawCatalogItemRaw30(ctx, 0, CATALOG[0]), false);
  for (let id = 900; id <= 939; id++) {
    assert.equal(
      drawCatalogItemRaw30(ctx, id, CATALOG[id]),
      false,
      `Expected farmable block ${id} to be excluded from catalogArt30`
    );
    assert.equal(drawCatalogItem30(ctx, id, CATALOG[id]), false);
  }
  for (let id = 950; id <= 989; id++) {
    assert.equal(
      drawCatalogItemRaw30(ctx, id, CATALOG[id]),
      false,
      `Expected farmable seed ${id} to be excluded from catalogArt30`
    );
    assert.equal(drawCatalogItem30(ctx, id, CATALOG[id]), false);
  }
});
