import { describe, expect, it } from 'vitest';
import {
  allowedPresets,
  clampSplit,
  defaultPreset,
  inferredPreset,
  layoutIsCustom,
  parseSavedLayout,
  paymentBesideOrder,
  presetLayout,
  presetLockReason,
  resolveSellingLayout,
  type SavedSellingLayout,
  shareLabel,
  splitTracks,
} from './selling-layout';

const tables = { modules: { 'fnb.tables': true } };
const quick = {
  modules: { 'fnb.tables': false, 'fnb.menu': true },
  profile: { key: 'cafe', version: 1, display: { surface: 'menu_grid' as const } },
};
const retail = { modules: { 'fnb.tables': false } };

describe('clampSplit', () => {
  it('holds the share between a third and two thirds', () => {
    expect(clampSplit(0.1)).toBe(1 / 3);
    expect(clampSplit(0.95)).toBe(2 / 3);
    expect(clampSplit(0.4)).toBe(0.4);
  });

  it('pulls a share within 0.02 onto a third, a half and two thirds', () => {
    expect(clampSplit(0.34)).toBe(1 / 3);
    expect(clampSplit(0.49)).toBe(1 / 2);
    expect(clampSplit(0.51)).toBe(1 / 2);
    expect(clampSplit(0.65)).toBe(2 / 3);
    expect(clampSplit(0.46)).toBe(0.46);
  });

  it('reads a value that is not a number as an even split', () => {
    expect(clampSplit(Number.NaN)).toBe(1 / 2);
  });
});

describe('presets', () => {
  it('lets tables first through only with the table module', () => {
    expect(allowedPresets(tables)).toContain('tables_first');
    expect(allowedPresets(quick)).toEqual(['quick', 'one_step', 'big_menu']);
    expect(presetLockReason('tables_first', quick)).toBe('needs_tables');
    expect(presetLockReason('quick', quick)).toBeNull();
  });

  it('starts every sample inside the split limits', () => {
    for (const preset of ['tables_first', 'quick', 'one_step', 'big_menu'] as const) {
      const layout = presetLayout(preset);
      expect(clampSplit(layout.split)).toBe(layout.split);
      expect(clampSplit(layout.paySplit)).toBe(layout.paySplit);
    }
    expect(presetLayout('one_step').pay).toBe('column');
    expect(presetLayout('big_menu')).toMatchObject({ pay: 'slide', tiles: 'l' });
  });

  it('infers the sample from the modules', () => {
    expect(inferredPreset(tables)).toBe('tables_first');
    expect(inferredPreset(quick)).toBe('quick');
    expect(inferredPreset(retail)).toBe('one_step');
  });
});

describe('resolveSellingLayout', () => {
  const saved: SavedSellingLayout = {
    preset: 'big_menu',
    side: 'right',
    pay: 'below',
    split: 0.4,
    paySplit: 0.55,
  };

  it('takes the device choice when it is still allowed', () => {
    expect(resolveSellingLayout(quick, saved)).toMatchObject({
      preset: 'big_menu',
      side: 'right',
      pay: 'below',
      split: 0.4,
      paySplit: 0.55,
      tiles: 'l',
    });
  });

  it('falls back to the branch default when the device sample is not allowed', () => {
    const context = {
      ...quick,
      selection: { branch_id: 'b1' },
      branches: [{ id: 'b1', selling_preset: 'one_step' }],
    };
    const off = { ...saved, preset: 'tables_first' as const };
    expect(resolveSellingLayout(context, off).preset).toBe('one_step');
    expect(resolveSellingLayout(context, null).preset).toBe('one_step');
  });

  it('falls back to the modules when the branch default is not allowed or unset', () => {
    const context = {
      ...quick,
      selection: { branch_id: 'b1' },
      branches: [{ id: 'b1', selling_preset: 'tables_first' }],
    };
    expect(defaultPreset(context)).toBe('quick');
    expect(resolveSellingLayout(quick, null).preset).toBe('quick');
    expect(resolveSellingLayout(tables, undefined).preset).toBe('tables_first');
  });

  it('keeps a stored share inside the limits', () => {
    expect(resolveSellingLayout(quick, { ...saved, split: 0.9 }).split).toBe(2 / 3);
  });
});

describe('parseSavedLayout', () => {
  it('drops what is not a layout and repairs what is off the lists', () => {
    expect(parseSavedLayout(null)).toBeNull();
    expect(parseSavedLayout({ preset: 'kiosk' })).toBeNull();
    expect(
      parseSavedLayout({ preset: 'quick', side: 'bottom', pay: 'column', split: 5, paySplit: 'x' }),
    ).toEqual({ preset: 'quick', side: 'left', pay: 'column', split: 2 / 3, paySplit: 0.5 });
  });
});

describe('layout helpers', () => {
  it('puts the payment beside the order in a column, or below with the catalogue on top', () => {
    expect(paymentBesideOrder({ pay: 'column', side: 'left' })).toBe(true);
    expect(paymentBesideOrder({ pay: 'below', side: 'top' })).toBe(true);
    expect(paymentBesideOrder({ pay: 'below', side: 'left' })).toBe(false);
    expect(paymentBesideOrder({ pay: 'popup', side: 'top' })).toBe(false);
  });

  it('tells a changed layout from its sample', () => {
    const base = presetLayout('quick');
    expect(layoutIsCustom(base)).toBe(false);
    expect(layoutIsCustom({ ...base, side: 'right' })).toBe(true);
    expect(layoutIsCustom({ ...base, tiles: 'l' })).toBe(true);
  });

  it('builds grid tracks and labels', () => {
    expect(splitTracks(0.6, false)).toBe('minmax(0,0.6fr) 12px minmax(0,0.4fr)');
    expect(splitTracks(0.6, true)).toBe('minmax(0,0.4fr) 12px minmax(0,0.6fr)');
    expect(shareLabel(1 / 3)).toBe('⅓');
    expect(shareLabel(0.62)).toBe('62%');
  });
});
