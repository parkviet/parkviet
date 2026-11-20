// The till menu (GET /pos/menu) read by product. The server decides prices,
// availability and line kinds; these helpers only mirror its rules so the
// till can show the right picker before it asks.

import type { PosCategory, PosMenu, PosMenuProduct } from './types/pos-context';

// A product sells as a menu line (add-ons, note, kitchen, cup labels) only
// at a branch running fnb.menu and only when it is a prepared product
// ("Sản phẩm chế biến"). Every other product is an ordinary line.
export function isMenuLine(
  menu: Pick<PosMenu, 'module_enabled'>,
  product: Pick<PosMenuProduct, 'product_kind'>,
): boolean {
  return menu.module_enabled && product.product_kind === 'prepared';
}

// The products of one category tab, in menu order; null is the "All" tab,
// which also holds the products without a category.
export function productsInCategory(
  products: readonly PosMenuProduct[],
  categoryId: string | null,
): PosMenuProduct[] {
  if (categoryId === null) return [...products];
  return products.filter((product) => product.category_ids.includes(categoryId));
}

// The category tabs that hold at least one of the products, in menu order.
export function categoriesWithProducts(
  categories: readonly PosCategory[],
  products: readonly PosMenuProduct[],
): PosCategory[] {
  const used = new Set(products.flatMap((product) => product.category_ids));
  return categories.filter((category) => used.has(category.id));
}

// The menu product a variant is a size of, or undefined.
export function menuProductOfVariant(
  products: readonly PosMenuProduct[],
  variantId: string,
): PosMenuProduct | undefined {
  return products.find((product) => product.variants.some((variant) => variant.id === variantId));
}
