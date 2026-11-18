import { describe, expect, it } from 'vitest';
import { defaultProductLabel } from './defaults';
import { productLabelPreset } from './presets';
import { formatLabelPrice, type LabelItem, renderLabels } from './render';
import { sampleLabelItems } from './sample-data';
import type { ProductLabelConfig, ProductLabelPaper } from './types';

const NOW = new Date('2026-11-18T17:30:00Z');
const options = {
  now: NOW,
  timeZone: 'Asia/Ho_Chi_Minh',
  store: { name: 'Park Việt', address: '12 Lê Lợi' },
};

const item = (overrides: Partial<LabelItem> = {}): LabelItem => ({
  ...sampleLabelItems()[0],
  ...overrides,
});

const setField = (config: ProductLabelConfig, key: string, patch: Record<string, unknown>) => {
  const field = config.fields.find((candidate) => candidate.key === key);
  Object.assign(field as object, patch);
  return config;
};

describe('renderLabels pagination', () => {
  it('repeats each item by its quantity', () => {
    const preset = productLabelPreset('roll_50x30');
    const sheet = renderLabels(
      defaultProductLabel('roll_50x30'),
      preset,
      [item({ variant_id: 'a', quantity: 2 }), item({ variant_id: 'b', quantity: 3 })],
      options,
    );
    expect(sheet.labelCount).toBe(5);
    expect(sheet.pages.flatMap((page) => page.cells.map((cell) => cell.label.variantId))).toEqual([
      'a',
      'a',
      'b',
      'b',
      'b',
    ]);
  });

  it('makes a roll page of one row of stickers', () => {
    const preset = productLabelPreset('roll_110x22_3');
    const sheet = renderLabels(
      defaultProductLabel('roll_110x22_3'),
      preset,
      [item({ quantity: 7 })],
      options,
    );
    expect(sheet.pages.map((page) => page.cells.length)).toEqual([3, 3, 1]);
    expect(sheet.pages[0].cells.map((cell) => [cell.column, cell.row])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    const single = renderLabels(
      defaultProductLabel('roll_50x30'),
      productLabelPreset('roll_50x30'),
      [item({ quantity: 3 })],
      options,
    );
    expect(single.pages).toHaveLength(3);
  });

  it('fills a sheet by rows and starts the next sheet at its first cell', () => {
    const preset = productLabelPreset('sheet_a5_40');
    const sheet = renderLabels(
      defaultProductLabel('sheet_a5_40'),
      preset,
      [item({ quantity: 42 })],
      options,
    );
    expect(sheet.pages.map((page) => page.cells.length)).toEqual([40, 2]);
    expect(sheet.pages[0].cells[4]).toMatchObject({ slot: 4, column: 0, row: 1 });
    expect(sheet.pages[1].cells[0]).toMatchObject({ slot: 0, column: 0, row: 0 });
  });

  it('leaves the cells before startCell empty on the first sheet only', () => {
    const preset = productLabelPreset('sheet_a4_65');
    const sheet = renderLabels(
      defaultProductLabel('sheet_a4_65'),
      preset,
      [item({ quantity: 62 })],
      { ...options, startCell: 7 },
    );
    expect(sheet.pages[0].cells[0]).toMatchObject({ slot: 6, column: 1, row: 1 });
    expect(sheet.pages[0].cells).toHaveLength(59);
    expect(sheet.pages[1].cells[0].slot).toBe(0);
    expect(sheet.labelCount).toBe(62);
  });

  it('clamps startCell into the sheet and ignores it on a roll', () => {
    const sheetPreset = productLabelPreset('sheet_a5_40');
    const config = defaultProductLabel('sheet_a5_40');
    expect(
      renderLabels(config, sheetPreset, [item()], { ...options, startCell: 0 }).pages[0].cells[0]
        .slot,
    ).toBe(0);
    expect(
      renderLabels(config, sheetPreset, [item()], { ...options, startCell: 99 }).pages[0].cells[0]
        .slot,
    ).toBe(39);
    expect(
      renderLabels(config, sheetPreset, [item()], { ...options, startCell: Number.NaN }).pages[0]
        .cells[0].slot,
    ).toBe(0);
    const roll = renderLabels(
      defaultProductLabel('roll_50x30'),
      productLabelPreset('roll_50x30'),
      [item()],
      {
        ...options,
        startCell: 5,
      },
    );
    expect(roll.pages[0].cells[0].slot).toBe(0);
  });

  it('has no pages without items', () => {
    const sheet = renderLabels(
      defaultProductLabel(),
      productLabelPreset('roll_50x30'),
      [],
      options,
    );
    expect(sheet.pages).toEqual([]);
    expect(sheet.labelCount).toBe(0);
  });
});

describe('renderLabels rows', () => {
  const rowsOf = (
    config: ProductLabelConfig,
    labelItem: LabelItem,
    paper: ProductLabelPaper = 'roll_50x30',
  ) =>
    renderLabels(config, productLabelPreset(paper), [labelItem], options).pages[0].cells[0].label;

  it('follows the order of the enabled fields with formatted values', () => {
    const config = defaultProductLabel('roll_50x30');
    setField(config, 'original_price', { enabled: true });
    setField(config, 'printed_date', { enabled: true, label: 'In ngày' });
    const label = rowsOf(config, item());
    expect(label.rows.map((row) => row.key)).toEqual([
      'product_name',
      'barcode',
      'unit',
      'price',
      'original_price',
      'printed_date',
    ]);
    const price = label.rows.find((row) => row.key === 'price');
    expect(price?.text).toBe('32.000 ₫');
    expect(label.rows.find((row) => row.key === 'original_price')).toMatchObject({
      text: '36.000 ₫',
      strike: true,
    });
    // 17:30 UTC is already the next day in Vietnam.
    expect(label.rows.find((row) => row.key === 'printed_date')).toMatchObject({
      caption: 'In ngày',
      text: '19/11/2026',
    });
  });

  it('skips rows with no value and an original price that is not set', () => {
    const config = defaultProductLabel('roll_50x30');
    setField(config, 'original_price', { enabled: true });
    setField(config, 'sku', { enabled: true });
    const label = rowsOf(config, item({ original_price: null, sku: null, variant_options: null }));
    expect(label.rows.map((row) => row.key)).not.toContain('original_price');
    expect(label.rows.map((row) => row.key)).not.toContain('sku');
  });

  it('uses the store text typed in the template, else the branch store', () => {
    const config = defaultProductLabel('roll_50x30');
    setField(config, 'store_name', { enabled: true });
    setField(config, 'store_address', { enabled: true, text: 'Kệ số 3' });
    const label = rowsOf(config, item());
    expect(label.rows.find((row) => row.key === 'store_name')?.text).toBe('Park Việt');
    expect(label.rows.find((row) => row.key === 'store_address')?.text).toBe('Kệ số 3');
  });

  it('prints the SKU as the barcode when there is no barcode, and none without both', () => {
    const config = defaultProductLabel('roll_50x30');
    const fromSku = rowsOf(config, item({ barcode: null, sku: 'SP000102' }));
    expect(fromSku.rows.find((row) => row.key === 'barcode')).toMatchObject({
      text: 'SP000102',
      barcode: { kind: 'bars', symbology: 'code128' },
    });
    const none = rowsOf(config, item({ barcode: null, sku: null, warnings: ['no_code'] }));
    expect(none.rows.map((row) => row.key)).not.toContain('barcode');
    expect(none.warnings).toEqual(['no_code']);
  });

  it('warns and prints the code as text when the bars do not fit the sticker', () => {
    const config = defaultProductLabel('sheet_a4_180');
    const label = rowsOf(config, item(), 'sheet_a4_180');
    const barcode = label.rows.find((row) => row.key === 'barcode');
    expect(barcode?.barcode?.kind).toBe('text');
    expect(barcode?.showText).toBe(true);
    expect(label.warnings).toContain('barcode_too_wide');
  });

  it('carries the item warnings and applies the name line limit', () => {
    const config = defaultProductLabel('roll_50x30');
    setField(config, 'product_name', { max_lines: 3 });
    const label = rowsOf(config, item({ warnings: ['no_price'] }));
    expect(label.warnings).toEqual(['no_price']);
    expect(label.rows[0]).toMatchObject({ key: 'product_name', maxLines: 3 });
  });
});

describe('formatLabelPrice', () => {
  it('writes the sign, the code, or the bare number', () => {
    expect(formatLabelPrice('45000.0', 'VND', 'symbol')).toBe('45.000 ₫');
    expect(formatLabelPrice('45000.0', 'VND', 'code')).toBe('45.000 VNĐ');
    expect(formatLabelPrice('45000.0', 'VND', 'none')).toBe('45.000');
    expect(formatLabelPrice('12.5', 'USD', 'code')).toBe('12,5 USD');
    expect(formatLabelPrice(null, 'VND', 'symbol')).toBeNull();
  });
});
