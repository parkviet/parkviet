import { describe, expect, it } from 'vitest';
import {
  categoriesWithProducts,
  isMenuLine,
  menuProductOfVariant,
  productsInCategory,
} from './pos-menu';
import type { PosCategory, PosMenuProduct } from './types/pos-context';

function product(overrides: Partial<PosMenuProduct>): PosMenuProduct {
  return {
    product_id: 'prod_1',
    name: 'Cà phê sữa',
    product_kind: 'prepared',
    kind: 'single',
    category_ids: [],
    kitchen_category: null,
    cup_label: false,
    show_components_on_kds: true,
    qr_orderable: true,
    tax_category_id: null,
    modifier_group_ids: [],
    components: [],
    image_url: null,
    sold_out: false,
    variants: [],
    drink_credit: null,
    drink_credit_categories: [],
    ...overrides,
  };
}

const coffee = product({
  product_id: 'prod_coffee',
  category_ids: ['ctg_drinks'],
  variants: [
    {
      id: 'variant_m',
      name: 'M',
      sku: null,
      barcode: null,
      price: '30000',
      list_price: '30000',
      schedule_id: null,
    },
  ],
});
const water = product({
  product_id: 'prod_water',
  product_kind: 'goods',
  category_ids: ['ctg_drinks', 'ctg_bottled'],
});
const loose = product({ product_id: 'prod_loose', product_kind: null });

const categories: PosCategory[] = [
  { id: 'ctg_drinks', name: 'Đồ uống', position: 0, parent_id: null },
  { id: 'ctg_bottled', name: 'Đóng chai', position: 0, parent_id: 'ctg_drinks' },
  { id: 'ctg_food', name: 'Món ăn', position: 1, parent_id: null },
];

describe('isMenuLine', () => {
  it('is a menu line only for a prepared product where the menu runs', () => {
    expect(isMenuLine({ module_enabled: true }, coffee)).toBe(true);
    expect(isMenuLine({ module_enabled: false }, coffee)).toBe(false);
    expect(isMenuLine({ module_enabled: true }, water)).toBe(false);
    expect(isMenuLine({ module_enabled: true }, loose)).toBe(false);
  });
});

describe('productsInCategory', () => {
  const products = [coffee, water, loose];

  it('lists every product under All, those without a category included', () => {
    expect(productsInCategory(products, null).map((row) => row.product_id)).toEqual([
      'prod_coffee',
      'prod_water',
      'prod_loose',
    ]);
  });

  it('lists the products attached to a category directly, a product in two categories in both', () => {
    expect(productsInCategory(products, 'ctg_drinks').map((row) => row.product_id)).toEqual([
      'prod_coffee',
      'prod_water',
    ]);
    expect(productsInCategory(products, 'ctg_bottled').map((row) => row.product_id)).toEqual([
      'prod_water',
    ]);
    expect(productsInCategory(products, 'ctg_food')).toEqual([]);
  });
});

describe('categoriesWithProducts', () => {
  it('keeps the tabs that hold a product, in menu order', () => {
    expect(categoriesWithProducts(categories, [coffee, water]).map((row) => row.id)).toEqual([
      'ctg_drinks',
      'ctg_bottled',
    ]);
    expect(categoriesWithProducts(categories, [loose])).toEqual([]);
  });
});

describe('menuProductOfVariant', () => {
  it('finds the product a variant is a size of', () => {
    expect(menuProductOfVariant([water, coffee], 'variant_m')?.product_id).toBe('prod_coffee');
    expect(menuProductOfVariant([water, coffee], 'variant_x')).toBeUndefined();
  });
});
