import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chosenMenuDensity,
  clearMenuDensity,
  DEFAULT_MENU_DENSITY,
  MENU_DENSITY_KEY,
  MENU_IMAGES_KEY,
  savedMenuDensity,
  savedMenuImages,
  saveMenuDensity,
  saveMenuImages,
} from './menu-density';

describe('menu density of this device', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts at the regular density', () => {
    expect(DEFAULT_MENU_DENSITY).toBe('regular');
    expect(savedMenuDensity()).toBe('regular');
  });

  it('remembers the chosen density', () => {
    saveMenuDensity('dense');
    expect(store.get(MENU_DENSITY_KEY)).toBe('dense');
    expect(savedMenuDensity()).toBe('dense');
    saveMenuDensity('airy');
    expect(savedMenuDensity()).toBe('airy');
  });

  it('ignores a value it does not know', () => {
    store.set(MENU_DENSITY_KEY, 'huge');
    expect(savedMenuDensity()).toBe('regular');
  });

  it('forgets the chosen density so the layout decides again', () => {
    expect(chosenMenuDensity()).toBeNull();
    saveMenuDensity('dense');
    expect(chosenMenuDensity()).toBe('dense');
    clearMenuDensity();
    expect(store.has(MENU_DENSITY_KEY)).toBe(false);
    expect(chosenMenuDensity()).toBeNull();
    expect(savedMenuDensity()).toBe('regular');
  });

  it('keeps the density for the session when storage is blocked', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
        removeItem: () => {
          throw new Error('blocked');
        },
      },
    });
    expect(savedMenuDensity()).toBe('regular');
    expect(() => saveMenuDensity('dense')).not.toThrow();
    expect(savedMenuDensity()).toBe('dense');
    expect(() => saveMenuImages(false)).not.toThrow();
    expect(savedMenuImages(true)).toBe(true);
    // Storage back: a write replaces what was only held for the session.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    });
    clearMenuDensity();
    expect(chosenMenuDensity()).toBeNull();
  });

  it('shows pictures as the layout prefers until the device chooses', () => {
    expect(savedMenuImages(true)).toBe(true);
    expect(savedMenuImages(false)).toBe(false);
    saveMenuImages(false);
    expect(store.get(MENU_IMAGES_KEY)).toBe('off');
    expect(savedMenuImages(true)).toBe(false);
    saveMenuImages(true);
    expect(savedMenuImages(false)).toBe(true);
    store.set(MENU_IMAGES_KEY, 'maybe');
    expect(savedMenuImages(true)).toBe(true);
  });
});
