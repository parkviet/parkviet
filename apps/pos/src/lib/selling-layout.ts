import {
  parseSavedLayout,
  type SavedSellingLayout,
  type SellingTiles,
} from '@parkviet/pos-shared/selling-layout';
import { notifyPreferencesChanged } from './device-preferences';
import type { MenuDensity } from './menu-density';

// The selling layout this device chose for a branch: the sample screen and
// how its panels sit. Tile size is not kept here: it is the device's menu
// density, so there is one source for it.
export const SELLING_LAYOUT_KEY_PREFIX = 'parkviet-pos:selling-layout:';

export function sellingLayoutKey(branchId: string | null): string {
  return `${SELLING_LAYOUT_KEY_PREFIX}${branchId ?? 'none'}`;
}

export function savedSellingLayout(branchId: string | null): SavedSellingLayout | null {
  try {
    const raw = window.localStorage.getItem(sellingLayoutKey(branchId));
    return raw ? parseSavedLayout(JSON.parse(raw)) : null;
  } catch {
    // Storage blocked, or a value that is not JSON: no device choice.
    return null;
  }
}

// `null` forgets the choice, so the branch default applies again.
export function saveSellingLayout(branchId: string | null, layout: SavedSellingLayout | null) {
  try {
    if (layout) {
      window.localStorage.setItem(sellingLayoutKey(branchId), JSON.stringify(layout));
    } else {
      window.localStorage.removeItem(sellingLayoutKey(branchId));
    }
    notifyPreferencesChanged();
  } catch {
    // Not remembered on this device; the choice still applies until reload.
  }
}

const DENSITY_OF_TILES: Record<SellingTiles, MenuDensity> = {
  s: 'dense',
  m: 'regular',
  l: 'airy',
};

export function densityOfTiles(tiles: SellingTiles): MenuDensity {
  return DENSITY_OF_TILES[tiles];
}

export function tilesOfDensity(density: MenuDensity): SellingTiles {
  return density === 'dense' ? 's' : density === 'airy' ? 'l' : 'm';
}
