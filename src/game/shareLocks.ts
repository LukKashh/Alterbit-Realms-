export type ShareLockPermissionKey = 'build' | 'break' | 'interact';

export interface ShareLockPermissions {
  build: boolean;
  break: boolean;
  interact: boolean;
}

export interface ShareLockSpec {
  itemId: number;
  key: 'micro' | 'small' | 'cover';
  name: string;
  width: number;
  height: number;
  gemPrice: number;
}

export const SHARE_LOCK_SPECS: readonly ShareLockSpec[] = [
  { itemId: 150, key: 'micro', name: 'Micro-Share Lock', width: 3, height: 2, gemPrice: 500 },
  { itemId: 151, key: 'small', name: 'Small-Share Lock', width: 5, height: 5, gemPrice: 1500 },
  { itemId: 152, key: 'cover', name: 'Cover-Share Lock', width: 7, height: 10, gemPrice: 3500 },
] as const;

export const DEFAULT_SHARE_LOCK_PERMISSIONS: ShareLockPermissions = {
  build: true,
  break: true,
  interact: true,
};

export function getShareLockSpec(itemId: number): ShareLockSpec | undefined {
  return SHARE_LOCK_SPECS.find((spec) => spec.itemId === itemId);
}

export function isShareLockItem(itemId: number): boolean {
  return getShareLockSpec(itemId) !== undefined;
}

export function rectanglesOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
