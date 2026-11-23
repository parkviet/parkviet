import { describe, expect, it } from 'vitest';
import { isValidEan13 } from './ean13';
import { sampleLabelItems } from './sample-data';

describe('sampleLabelItems', () => {
  it('covers an original price, EAN-13, a SKU-only item and a long name', () => {
    const items = sampleLabelItems();
    expect(items.some((item) => item.original_price !== null)).toBe(true);
    expect(items.some((item) => item.barcode !== null && isValidEan13(item.barcode))).toBe(true);
    expect(items.some((item) => item.barcode === null && item.sku !== null)).toBe(true);
    expect(items.some((item) => item.product_name.length > 50)).toBe(true);
  });

  it('gives each item its own id and one label', () => {
    const items = sampleLabelItems();
    expect(new Set(items.map((item) => item.variant_id)).size).toBe(items.length);
    expect(items.every((item) => item.quantity === 1)).toBe(true);
  });
});
