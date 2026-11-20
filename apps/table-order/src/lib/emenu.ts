import type { GuestCategory, GuestItem, GuestMenu, GuestTheme } from './types';

export const DEFAULT_THEME = {
  brand_color: '#0b6e4f',
  text_color: '#1d1d1f',
  button_color: '#0b6e4f',
} as const;

export const RAIL_PREVIEW_LIMIT = 4;

export type StyleRoot = {
  style: { setProperty: (name: string, value: string) => void };
};

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function channelLuminance(byte: number): number {
  const srgb = byte / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  if (!isHexColor(hex)) return 0;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  );
}

export function contrastInk(hex: string): '#ffffff' | '#1d1d1f' {
  if (!isHexColor(hex)) return '#ffffff';
  const lum = relativeLuminance(hex);
  const darkLum = relativeLuminance('#1d1d1f');
  const whiteContrast = 1.05 / (lum + 0.05);
  const darkContrast = (lum + 0.05) / (darkLum + 0.05);
  return whiteContrast >= darkContrast ? '#ffffff' : '#1d1d1f';
}

export function applyTheme(root: StyleRoot, theme?: Partial<GuestTheme> | null): void {
  const brand = isHexColor(theme?.brand_color) ? theme.brand_color : DEFAULT_THEME.brand_color;
  const ink = isHexColor(theme?.text_color) ? theme.text_color : DEFAULT_THEME.text_color;
  const accent = isHexColor(theme?.button_color) ? theme.button_color : DEFAULT_THEME.button_color;
  root.style.setProperty('--brand', brand);
  root.style.setProperty('--ink', ink);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-ink', contrastInk(accent));
}

// The products of a home section (best sellers, new items) by product id, in
// the configured order, each once.
export function resolveSectionItems(items: GuestItem[], ids: string[] | undefined): GuestItem[] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map<string, GuestItem>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  const seen = new Set<string>();
  const resolved: GuestItem[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    if (item) resolved.push(item);
  }
  return resolved;
}

// The rows of one tab: a category, or every row ("All", null) ordered by its
// first category then its position; rows without a category come last.
export function sortItems(
  items: GuestItem[],
  categories: GuestCategory[],
  categoryId: string | null,
): GuestItem[] {
  const categoryRank = new Map(categories.map((category) => [category.id, category.position]));
  const rank = (item: GuestItem) => {
    const first = item.category_ids[0];
    return first !== undefined && categoryRank.has(first)
      ? (categoryRank.get(first) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;
  };
  return [...items]
    .filter((item) => !categoryId || item.category_ids.includes(categoryId))
    .sort((a, b) => {
      if (categoryId === null) {
        const diff = rank(a) - rank(b);
        if (diff !== 0) return diff;
      }
      return a.position - b.position;
    });
}

export function lowestVariantPrice(item: GuestItem): string | undefined {
  let best: { price: string; numeric: number } | null = null;
  for (const variant of item.variants) {
    const numeric = Number(variant.price);
    if (!Number.isFinite(numeric)) continue;
    if (!best || numeric < best.numeric) best = { price: variant.price, numeric };
  }
  return best?.price ?? item.variants[0]?.price;
}

export function remainingSeconds(waitUntil: number | null | undefined, now: number): number {
  if (waitUntil == null || !Number.isFinite(waitUntil) || !Number.isFinite(now)) return 0;
  const diff = waitUntil - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}

export function isOrderQrActive(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return true;
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return true;
  return deadline > now;
}

export function expirySeconds(expiresAt: string | null | undefined, now: number): number | null {
  if (!expiresAt) return null;
  const deadline = Date.parse(expiresAt);
  if (Number.isNaN(deadline)) return null;
  return remainingSeconds(deadline, now);
}

export function formatDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function isValidPrepayMethod(
  payment: GuestMenu['payment'],
  method: 'vietqr' | 'counter' | null,
): boolean {
  if (payment?.timing !== 'pay_before') return true;
  if (!method || !payment.methods.includes(method)) return false;
  if (method === 'vietqr' && !payment.vietqr_available) return false;
  return true;
}
