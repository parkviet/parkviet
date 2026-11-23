import { kitchenSent } from './kitchen';
import type { PosLineItem } from './pos-context';

export type SelectedQuantity = {
  quantity: number;
  canDecrement: boolean;
};

// A line whose count can step down from the catalog without violating a scale
// label, serial tracking, timed clock, or units already sent to the kitchen.
export function isCountDecreasable(line: PosLineItem): boolean {
  if (line.kind === 'measured' || line.kind === 'timed') return false;
  if (line.label_barcode) return false;
  if (line.trace?.mode === 'serial') return false;
  return line.quantity > kitchenSent(line);
}

// Last decreasable line for a variant, used when the cashier clicks `-` on a
// catalog card or menu tile.
export function findDecreasableLine(
  lines: readonly PosLineItem[] | undefined,
  variantId: string,
): PosLineItem | undefined {
  if (!lines) return undefined;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line && line.variant_id === variantId && isCountDecreasable(line)) return line;
  }
  return undefined;
}

// Selected quantity and decrement eligibility per variant_id in the active order.
export function quantitiesByVariant(
  lines: readonly PosLineItem[] | undefined,
): Map<string, SelectedQuantity> {
  const map = new Map<string, SelectedQuantity>();
  if (!lines) return map;
  for (const line of lines) {
    const current = map.get(line.variant_id);
    const decreasable = isCountDecreasable(line);
    if (current) {
      current.quantity += line.quantity;
      if (decreasable) current.canDecrement = true;
    } else {
      map.set(line.variant_id, { quantity: line.quantity, canDecrement: decreasable });
    }
  }
  return map;
}

// Selected quantity and decrement eligibility per product_id in the active order.
export function quantitiesByProduct(
  lines: readonly PosLineItem[] | undefined,
): Map<string, SelectedQuantity> {
  const map = new Map<string, SelectedQuantity>();
  if (!lines) return map;
  for (const line of lines) {
    const current = map.get(line.product_id);
    const decreasable = isCountDecreasable(line);
    if (current) {
      current.quantity += line.quantity;
      if (decreasable) current.canDecrement = true;
    } else {
      map.set(line.product_id, { quantity: line.quantity, canDecrement: decreasable });
    }
  }
  return map;
}
