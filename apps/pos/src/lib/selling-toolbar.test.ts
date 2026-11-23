import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  savedToolbarCollapsed,
  saveToolbarCollapsed,
  TOOLBAR_COLLAPSED_KEY,
} from './selling-toolbar';

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('selling toolbar preference', () => {
  it('is open until this device folds it', () => {
    vi.stubGlobal('window', { localStorage: fakeStorage() });
    expect(savedToolbarCollapsed()).toBe(false);
    saveToolbarCollapsed(true);
    expect(savedToolbarCollapsed()).toBe(true);
    saveToolbarCollapsed(false);
    expect(savedToolbarCollapsed()).toBe(false);
  });

  it('stores nothing for the default so the key stays absent', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage });
    saveToolbarCollapsed(true);
    saveToolbarCollapsed(false);
    expect(storage.getItem(TOOLBAR_COLLAPSED_KEY)).toBeNull();
  });

  it('stays open when storage is blocked', () => {
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
    expect(savedToolbarCollapsed()).toBe(false);
    expect(() => saveToolbarCollapsed(true)).not.toThrow();
  });
  it('starts folded on a phone-width screen until this device opens it', () => {
    const storage = fakeStorage();
    vi.stubGlobal('window', { localStorage: storage, matchMedia: () => ({ matches: true }) });
    expect(savedToolbarCollapsed()).toBe(true);
    saveToolbarCollapsed(false);
    expect(storage.getItem(TOOLBAR_COLLAPSED_KEY)).toBe('off');
    expect(savedToolbarCollapsed()).toBe(false);
    saveToolbarCollapsed(true);
    expect(savedToolbarCollapsed()).toBe(true);
  });
});
