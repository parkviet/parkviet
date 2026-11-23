import type { PosBranchProfile, PosModules } from './pos-modules';
import { contextModule, sellingLayoutOf } from './pos-modules';

// The sample selling screens and the options a cashier tunes on top of them.
// A sample is only a starting set of options: the base screen (table service,
// quick counter or counter tabs) still comes from the branch's modules
// (`sellingLayoutOf`), and these options only decide how its panels sit.
export const SELLING_PRESETS = [
  'tables_first',
  'quick',
  'one_step',
  'big_menu',
  'classic',
] as const;
export type SellingPreset = (typeof SELLING_PRESETS)[number];

// The samples a branch can make its default. The classic screen (the counter
// before samples existed) is a device's own choice only.
export const BRANCH_PRESETS = ['tables_first', 'quick', 'one_step', 'big_menu'] as const;
export type BranchPreset = (typeof BRANCH_PRESETS)[number];

export function isBranchPreset(value: unknown): value is BranchPreset {
  return BRANCH_PRESETS.includes(value as BranchPreset);
}

export const SELLING_SIDES = ['left', 'right', 'top'] as const;
export type SellingSide = (typeof SELLING_SIDES)[number];

// Where payment happens: a dialog, in place of the order, under it, or in a
// column of its own that stays open.
export const SELLING_PAYS = ['popup', 'slide', 'below', 'column'] as const;
export type SellingPay = (typeof SELLING_PAYS)[number];

export const SELLING_TILES = ['s', 'm', 'l'] as const;
export type SellingTiles = (typeof SELLING_TILES)[number];

// The foot of the order: the bill laid out in full above the buttons, or one
// compact bar (chips for the order's extras, the total that unfolds, and the
// buttons in a row).
export const SELLING_FOOTS = ['full', 'compact'] as const;
export type SellingFoot = (typeof SELLING_FOOTS)[number];

export type SellingLayout = {
  preset: SellingPreset;
  side: SellingSide;
  pay: SellingPay;
  tiles: SellingTiles;
  foot: SellingFoot;
  // The catalogue's share of the screen, kept in [1/5, 4/5].
  split: number;
  // The order's share beside a payment column, kept in [1/5, 4/5].
  paySplit: number;
};

// What a device keeps: the tile size lives in the device's menu density.
export type SavedSellingLayout = Omit<SellingLayout, 'tiles'>;

export const MIN_SPLIT = 1 / 5;
export const MAX_SPLIT = 4 / 5;
export const SPLIT_SNAPS = [1 / 5, 1 / 3, 1 / 2, 2 / 3, 4 / 5] as const;
// A share this close to a snap point sits on it.
export const SNAP_RANGE = 0.02;

export function isSellingPreset(value: unknown): value is SellingPreset {
  return SELLING_PRESETS.includes(value as SellingPreset);
}

// Held between a fifth and four fifths, and pulled onto 1/5, 1/3, 1/2, 2/3
// and 4/5 when within 0.02 of one. A value that is not a number reads as an even split.
export function clampSplit(value: number): number {
  if (!Number.isFinite(value)) return 1 / 2;
  const held = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, value));
  for (const snap of SPLIT_SNAPS) if (Math.abs(held - snap) < SNAP_RANGE) return snap;
  return held;
}

const PRESET_LAYOUTS: Record<SellingPreset, SellingLayout> = {
  tables_first: {
    preset: 'tables_first',
    side: 'left',
    pay: 'popup',
    tiles: 'm',
    split: 0.62,
    paySplit: 1 / 2,
    foot: 'full',
  },
  quick: {
    preset: 'quick',
    side: 'left',
    pay: 'popup',
    tiles: 'm',
    split: 0.62,
    paySplit: 1 / 2,
    foot: 'compact',
  },
  one_step: {
    preset: 'one_step',
    side: 'left',
    pay: 'column',
    tiles: 's',
    split: 0.45,
    paySplit: 1 / 2,
    foot: 'full',
  },
  big_menu: {
    preset: 'big_menu',
    side: 'left',
    pay: 'slide',
    tiles: 'l',
    split: 2 / 3,
    paySplit: 1 / 2,
    foot: 'compact',
  },
  // The catalogue over the order on the left, the payment in a full-height
  // column on the right.
  classic: {
    preset: 'classic',
    side: 'top',
    pay: 'column',
    tiles: 's',
    split: 1 / 2,
    paySplit: 2 / 3,
    foot: 'full',
  },
};

// The starting options of a sample screen.
export function presetLayout(preset: SellingPreset): SellingLayout {
  return { ...PRESET_LAYOUTS[preset] };
}

export type SellingLayoutContext =
  | {
      modules?: PosModules | null;
      profile?: PosBranchProfile | null;
      selection?: { branch_id: string | null } | null;
      branches?: readonly { id: string; selling_preset?: string | null }[];
    }
  | undefined;

// Tables first needs the branch's table module; the other three suit any branch.
export function allowedPresets(context: SellingLayoutContext): SellingPreset[] {
  return SELLING_PRESETS.filter(
    (preset) => preset !== 'tables_first' || contextModule(context, 'fnb.tables'),
  );
}

// Why a sample is out of reach at this branch, for the choice to say so.
export function presetLockReason(
  preset: SellingPreset,
  context: SellingLayoutContext,
): 'needs_tables' | null {
  return allowedPresets(context).includes(preset) ? null : 'needs_tables';
}

// The sample a branch's modules point at when nobody chose one: table service
// opens with its tables, a quick counter with its quick screen, and the
// counter (retail, pay later, timed) keeps its checkout beside the order.
export function inferredPreset(context: SellingLayoutContext): SellingPreset {
  const base = sellingLayoutOf(context);
  return base === 'table_service'
    ? 'tables_first'
    : base === 'quick_counter'
      ? 'quick'
      : 'one_step';
}

// The branch's own default when the administrator set one that still fits the
// modules, else what the modules point at.
export function defaultPreset(context: SellingLayoutContext): SellingPreset {
  const branchId = context?.selection?.branch_id;
  const chosen = context?.branches?.find((branch) => branch.id === branchId)?.selling_preset;
  return isBranchPreset(chosen) && allowedPresets(context).includes(chosen)
    ? chosen
    : inferredPreset(context);
}

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return list.includes(value as T);
}

// A device's stored choice, read back: anything off the list is repaired.
export function parseSavedLayout(value: unknown): SavedSellingLayout | null {
  if (typeof value !== 'object' || value === null) return null;
  const source = value as Record<string, unknown>;
  if (!isSellingPreset(source.preset)) return null;
  const base = PRESET_LAYOUTS[source.preset];
  const share = (raw: unknown, fallback: number) =>
    typeof raw === 'number' && Number.isFinite(raw) ? clampSplit(raw) : fallback;
  return {
    preset: source.preset,
    side: isOneOf(SELLING_SIDES, source.side) ? source.side : base.side,
    pay: isOneOf(SELLING_PAYS, source.pay) ? source.pay : base.pay,
    split: share(source.split, base.split),
    paySplit: share(source.paySplit, base.paySplit),
    foot: isOneOf(SELLING_FOOTS, source.foot) ? source.foot : base.foot,
  };
}

// The device's choice when its sample is still allowed here, else the branch's
// default, else what the modules point at. Tiles come from the sample; the
// app overrides them with the device's menu density.
export function resolveSellingLayout(
  context: SellingLayoutContext,
  saved: SavedSellingLayout | null | undefined,
): SellingLayout {
  if (saved && allowedPresets(context).includes(saved.preset)) {
    return {
      ...presetLayout(saved.preset),
      side: saved.side,
      pay: saved.pay,
      split: clampSplit(saved.split),
      paySplit: clampSplit(saved.paySplit),
      foot: isOneOf(SELLING_FOOTS, saved.foot) ? saved.foot : presetLayout(saved.preset).foot,
    };
  }
  return presetLayout(defaultPreset(context));
}

// The order and the payment sit side by side: a payment column, or a payment
// "below" the order while the catalogue is on top (the width is free then).
export function paymentBesideOrder(layout: Pick<SellingLayout, 'pay' | 'side'>): boolean {
  return layout.pay === 'column' || (layout.pay === 'below' && layout.side === 'top');
}

// Whether the options differ from the sample they started from. Tiles are
// compared when given (the app reads them from the device's density).
export function layoutIsCustom(
  layout: Omit<SellingLayout, 'tiles'> & { tiles?: SellingTiles },
): boolean {
  const base = PRESET_LAYOUTS[layout.preset];
  return (
    layout.side !== base.side ||
    layout.pay !== base.pay ||
    (layout.tiles !== undefined && layout.tiles !== base.tiles) ||
    layout.split !== base.split ||
    layout.paySplit !== base.paySplit ||
    layout.foot !== base.foot
  );
}

// The CSS grid tracks of a split: the first part gets `share`, then the
// divider, then the rest; mirrored when the parts are.
export function splitTracks(share: number, mirrored: boolean, dividerPx = 12): string {
  const tracks = [`minmax(0,${share}fr)`, `${dividerPx}px`, `minmax(0,${1 - share}fr)`];
  return (mirrored ? tracks.reverse() : tracks).join(' ');
}

// The share as the screens write it: a fifth, a third, a half, two thirds, four fifths, else a percent.
// The rest of a share (1 - 2/3) is a hair off 1/3 in floating point, so the
// thirds are matched within a small range.
export function shareLabel(share: number): string {
  const near = (value: number) => Math.abs(share - value) < 1e-9;
  if (near(1 / 5)) return '⅕';
  if (near(1 / 3)) return '⅓';
  if (near(1 / 2)) return '½';
  if (near(2 / 3)) return '⅔';
  if (near(4 / 5)) return '⅘';
  return `${Math.round(share * 100)}%`;
}
