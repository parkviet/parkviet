import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  contrastInk,
  DEFAULT_THEME,
  expirySeconds,
  formatDuration,
  isHexColor,
  isOrderQrActive,
  isValidPrepayMethod,
  lowestVariantPrice,
  remainingSeconds,
  resolveSectionItems,
  sortItems,
} from './emenu';
import type { GuestCategory, GuestItem } from './types';

const makeItem = (overrides: Partial<GuestItem> & { id: string; name: string }): GuestItem => ({
  kind: 'single',
  category_ids: [],
  position: 0,
  image_url: null,
  sold_out: false,
  modifier_group_ids: [],
  components: [],
  variants: [{ id: `v_${overrides.id}`, name: null, price: '25000.0', price_label: null }],
  ...overrides,
});

describe('e-menu theme helpers', () => {
  it('validates #RRGGBB hex colors and computes accessible button text ink', () => {
    expect(isHexColor('#0b6e4f')).toBe(true);
    expect(isHexColor('#AABBCC')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('rgb(0,0,0)')).toBe(false);
    expect(isHexColor(null)).toBe(false);

    expect(contrastInk('#0b6e4f')).toBe('#ffffff');
    expect(contrastInk('#1d1d1f')).toBe('#ffffff');
    expect(contrastInk('#ffd60a')).toBe('#1d1d1f');
    expect(contrastInk('#ffffff')).toBe('#1d1d1f');
  });

  it('applies valid theme CSS custom properties and falls back safely on invalid values', () => {
    const vars = new Map<string, string>();
    const root = {
      style: {
        setProperty: (name: string, value: string) => {
          vars.set(name, value);
        },
      },
    };

    applyTheme(root, {
      brand_color: '#c2410c',
      text_color: '#111827',
      button_color: '#facc15',
      logo_url: null,
      store_name: 'Quán Trà',
    });
    expect(Object.fromEntries(vars)).toEqual({
      '--brand': '#c2410c',
      '--ink': '#111827',
      '--accent': '#facc15',
      '--accent-ink': '#1d1d1f',
    });

    applyTheme(root, {
      brand_color: 'invalid',
      text_color: '#xyz123',
      button_color: '',
    });
    expect(Object.fromEntries(vars)).toEqual({
      '--brand': DEFAULT_THEME.brand_color,
      '--ink': DEFAULT_THEME.text_color,
      '--accent': DEFAULT_THEME.button_color,
      '--accent-ink': '#ffffff',
    });
  });
});

describe('e-menu home sections and category ordering', () => {
  const categories: GuestCategory[] = [
    { id: 'cat_tea', name: 'Trà', position: 2, color: '#0b6e4f' },
    { id: 'cat_coffee', name: 'Cà phê', position: 1, color: '#7c2d12' },
  ];

  const items: GuestItem[] = [
    makeItem({ id: 'prod_tea_1', name: 'Trà đào', category_ids: ['cat_tea'], position: 0 }),
    makeItem({ id: 'prod_cf_1', name: 'Bạc xỉu', category_ids: ['cat_coffee'], position: 0 }),
    makeItem({ id: 'prod_tea_2', name: 'Trà vải', category_ids: ['cat_tea'], position: 1 }),
    makeItem({ id: 'prod_cf_2', name: 'Cà phê sữa', category_ids: ['cat_coffee'], position: 1 }),
    // Same dish placed in a second e-Menu category
    makeItem({ id: 'prod_cf_1', name: 'Bạc xỉu', category_ids: ['cat_tea'], position: 2 }),
  ];

  it('resolves best_sellers and new_items in configured order without duplicates', () => {
    const resolved = resolveSectionItems(items, [
      'prod_tea_2',
      'missing',
      'prod_cf_1',
      'prod_tea_2',
    ]);
    expect(resolved.map((row) => row.id)).toEqual(['prod_tea_2', 'prod_cf_1']);
    expect(resolveSectionItems(items, undefined)).toEqual([]);
  });

  it('groups items by category position then item position when viewing all categories', () => {
    const all = sortItems(items, categories, null);
    expect(all.map((row) => `${row.category_ids[0]}:${row.id}`)).toEqual([
      'cat_coffee:prod_cf_1',
      'cat_coffee:prod_cf_2',
      'cat_tea:prod_tea_1',
      'cat_tea:prod_tea_2',
      'cat_tea:prod_cf_1',
    ]);

    const teaOnly = sortItems(items, categories, 'cat_tea');
    expect(teaOnly.map((row) => row.id)).toEqual(['prod_tea_1', 'prod_tea_2', 'prod_cf_1']);
  });

  it('lists a counter product under each of its categories once, one without a category under All only', () => {
    const counter: GuestItem[] = [
      makeItem({ id: 'prod_soda', name: 'Soda', category_ids: [], position: 0 }),
      makeItem({
        id: 'prod_latte',
        name: 'Latte',
        category_ids: ['cat_coffee', 'cat_tea'],
        position: 1,
      }),
      makeItem({ id: 'prod_peach', name: 'Trà đào', category_ids: ['cat_tea'], position: 2 }),
    ];
    expect(sortItems(counter, categories, null).map((row) => row.id)).toEqual([
      'prod_latte',
      'prod_peach',
      'prod_soda',
    ]);
    expect(sortItems(counter, categories, 'cat_tea').map((row) => row.id)).toEqual([
      'prod_latte',
      'prod_peach',
    ]);
    expect(sortItems(counter, categories, 'cat_coffee').map((row) => row.id)).toEqual([
      'prod_latte',
    ]);
  });

  it('picks the lowest variant price', () => {
    const item = makeItem({
      id: 'prod_multi',
      name: 'Trà sữa',
      variants: [
        { id: 'v_l', name: 'L', price: '45000.0', price_label: null },
        { id: 'v_m', name: 'M', price: '35000.0', price_label: null },
      ],
    });
    expect(lowestVariantPrice(item)).toBe('35000.0');
  });
});

describe('e-menu countdown and prepay validation helpers', () => {
  it('computes remaining seconds cleanly without spikes and returns 0 once expired', () => {
    const start = 1_700_000_000_000;
    const waitUntil = start + 60_000;
    expect(remainingSeconds(waitUntil, start)).toBe(60);
    expect(remainingSeconds(waitUntil, start + 1_100)).toBe(59);
    expect(remainingSeconds(waitUntil, waitUntil)).toBe(0);
    expect(remainingSeconds(waitUntil, waitUntil + 5_000)).toBe(0);
    expect(remainingSeconds(null, start)).toBe(0);
  });

  it('tracks payment QR expiry and formats mm:ss countdowns', () => {
    const now = Date.parse('2026-11-18T10:00:00Z');
    const future = '2026-11-18T10:09:05Z';
    const past = '2026-11-18T10:00:00Z';

    expect(isOrderQrActive(future, now)).toBe(true);
    expect(expirySeconds(future, now)).toBe(545);
    expect(formatDuration(545)).toBe('9:05');

    expect(isOrderQrActive(past, now)).toBe(false);
    expect(expirySeconds(past, now)).toBe(0);
    expect(isOrderQrActive(null, now)).toBe(true);
  });

  it('validates prepay methods against vietqr availability', () => {
    expect(
      isValidPrepayMethod(
        { timing: 'pay_before', methods: ['vietqr'], vietqr_available: false },
        'vietqr',
      ),
    ).toBe(false);
    expect(
      isValidPrepayMethod(
        { timing: 'pay_before', methods: ['vietqr', 'counter'], vietqr_available: true },
        'vietqr',
      ),
    ).toBe(true);
    expect(
      isValidPrepayMethod(
        { timing: 'pay_after', methods: ['counter'], vietqr_available: false },
        null,
      ),
    ).toBe(true);
  });
});
