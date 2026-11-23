import { notifyPreferencesChanged } from './device-preferences';

// How tightly the menu tiles of the table-service order screen are packed:
// a choice of this device, like the floor surface.
export const MENU_DENSITIES = ['airy', 'regular', 'dense'] as const;

export type MenuDensity = (typeof MENU_DENSITIES)[number];

export const DEFAULT_MENU_DENSITY: MenuDensity = 'regular';

export const MENU_DENSITY_KEY = 'parkviet-pos:menu-density';

export function isMenuDensity(value: unknown): value is MenuDensity {
  return MENU_DENSITIES.includes(value as MenuDensity);
}

// Where storage refuses a write, the choice is held here until reload.
// `null` is a remembered "no choice".
let unsavedDensity: MenuDensity | null | undefined;

export function savedMenuDensity(): MenuDensity {
  return chosenMenuDensity() ?? DEFAULT_MENU_DENSITY;
}

// The density this device chose, or null while it has chosen none (the
// selling layout sample then decides the tile size).
export function chosenMenuDensity(): MenuDensity | null {
  if (unsavedDensity !== undefined) return unsavedDensity;
  try {
    const saved = window.localStorage.getItem(MENU_DENSITY_KEY);
    return isMenuDensity(saved) ? saved : null;
  } catch {
    // Storage blocked (private mode, policy): no choice, the default works.
    return null;
  }
}

function writeMenuDensity(density: MenuDensity | null) {
  try {
    if (density) window.localStorage.setItem(MENU_DENSITY_KEY, density);
    else window.localStorage.removeItem(MENU_DENSITY_KEY);
    unsavedDensity = undefined;
  } catch {
    // Not remembered on this device; it applies until reload.
    unsavedDensity = density;
  }
  notifyPreferencesChanged();
}

export function saveMenuDensity(density: MenuDensity) {
  writeMenuDensity(density);
}

// Forgets the device density: the selling layout sample decides again.
export function clearMenuDensity() {
  writeMenuDensity(null);
}

// Whether the menu tiles show the dishes' pictures: a choice of this device,
// beside the density. Unset, the layout decides (the quick counter shows
// them, the table order screen does not).
export const MENU_IMAGES_KEY = 'parkviet-pos:menu-images';

export function savedMenuImages(fallback: boolean): boolean {
  try {
    const saved = window.localStorage.getItem(MENU_IMAGES_KEY);
    return saved === 'on' ? true : saved === 'off' ? false : fallback;
  } catch {
    return fallback;
  }
}

export function saveMenuImages(shown: boolean) {
  try {
    window.localStorage.setItem(MENU_IMAGES_KEY, shown ? 'on' : 'off');
    notifyPreferencesChanged();
  } catch {
    // Not remembered on this device; the choice still applies until reload.
  }
}
