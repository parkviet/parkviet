import { describe, expect, it } from 'vitest';
import {
  findDecreasableLine,
  isCountDecreasable,
  quantitiesByProduct,
  quantitiesByVariant,
} from './catalog-quantities';
import type { PosLineItem } from './pos-context';

function line(overrides: Partial<PosLineItem> = {}): PosLineItem {
  return {
    id: 'li_1',
    variant_id: 'var_1',
    product_id: 'prod_1',
    name: 'Bò húc',
    sku: 'SP0011',
    quantity: 1,
    price: '10000',
    amount: '10000',
    discounts: [],
    sale_line_id: 'sl_1',
    ...overrides,
  };
}

describe('catalog-quantities', () => {
  it('sums quantities across multiple lines of the same variant or product', () => {
    const lines = [
      line({ id: 'li_1', variant_id: 'var_1', product_id: 'prod_1', quantity: 2 }),
      line({ id: 'li_2', variant_id: 'var_1', product_id: 'prod_1', quantity: 3 }),
      line({ id: 'li_3', variant_id: 'var_2', product_id: 'prod_1', quantity: 1 }),
    ];
    expect(quantitiesByVariant(lines).get('var_1')).toEqual({ quantity: 5, canDecrement: true });
    expect(quantitiesByVariant(lines).get('var_2')).toEqual({ quantity: 1, canDecrement: true });
    expect(quantitiesByProduct(lines).get('prod_1')).toEqual({ quantity: 6, canDecrement: true });
  });

  it('disallows decrementing measured, labelled, serial, timed, or fully kitchen-sent lines', () => {
    expect(isCountDecreasable(line({ kind: 'measured' }))).toBe(false);
    expect(isCountDecreasable(line({ kind: 'timed' }))).toBe(false);
    expect(isCountDecreasable(line({ label_barcode: '2000123' }))).toBe(false);
    expect(
      isCountDecreasable(
        line({
          trace: { mode: 'serial', complete: true, issue: null, preview: [], allocations: [] },
        }),
      ),
    ).toBe(false);
    expect(isCountDecreasable(line({ quantity: 2, kitchen_sent_quantity: '2' }))).toBe(false);
    expect(isCountDecreasable(line({ quantity: 3, kitchen_sent_quantity: '2' }))).toBe(true);
  });

  it('picks the last decreasable line for a variant', () => {
    const sent = line({
      id: 'li_1',
      sale_line_id: 'sl_1',
      quantity: 1,
      kitchen_sent_quantity: '1',
    });
    const unsent = line({ id: 'li_2', sale_line_id: 'sl_2', quantity: 2 });
    expect(findDecreasableLine([sent, unsent], 'var_1')?.id).toBe('li_2');
    expect(findDecreasableLine([sent], 'var_1')).toBeUndefined();
  });
});
