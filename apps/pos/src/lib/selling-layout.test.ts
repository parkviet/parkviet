import { beforeEach, describe, expect, it } from 'vitest';
import {
  densityOfTiles,
  savedSellingLayout,
  saveSellingLayout,
  sellingLayoutKey,
  tilesOfDensity,
} from './selling-layout';

const stored = new Map<string, string>();

beforeEach(() => {
  stored.clear();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
        removeItem: (key: string) => void stored.delete(key),
      },
      dispatchEvent: () => true,
    },
  });
});

describe('device selling layout', () => {
  it('keeps one choice per branch under its own key', () => {
    expect(sellingLayoutKey('b1')).toBe('parkviet-pos:selling-layout:b1');
    const layout = {
      preset: 'quick',
      side: 'right',
      pay: 'below',
      split: 0.4,
      paySplit: 0.5,
    } as const;
    saveSellingLayout('b1', layout);
    expect(savedSellingLayout('b1')).toEqual(layout);
    expect(savedSellingLayout('b2')).toBeNull();
  });

  it('forgets the choice when saved as null', () => {
    saveSellingLayout('b1', {
      preset: 'quick',
      side: 'left',
      pay: 'popup',
      split: 0.5,
      paySplit: 0.5,
    });
    saveSellingLayout('b1', null);
    expect(savedSellingLayout('b1')).toBeNull();
  });

  it('reads a damaged value as no choice and repairs a share out of range', () => {
    stored.set(sellingLayoutKey('b1'), '{not json');
    expect(savedSellingLayout('b1')).toBeNull();
    stored.set(sellingLayoutKey('b1'), JSON.stringify({ preset: 'quick', split: 0.99 }));
    expect(savedSellingLayout('b1')?.split).toBe(2 / 3);
  });

  it('maps the tile size to the menu density and back', () => {
    for (const tiles of ['s', 'm', 'l'] as const) {
      expect(tilesOfDensity(densityOfTiles(tiles))).toBe(tiles);
    }
  });
});
