import type { ProductLabelPaper, ProductLabelPreset } from './types';

// Label stocks. A copy of `server/config/pos/product_label_presets.json`;
// `server-contract.test.ts` keeps the two identical.
//
// Roll stocks list the sticker, the stickers per row and the gap between
// them. Sheet stocks list the grid and the sheet margins; the A4 and A5
// sizes are taken from the usual decal sheet layouts and need a test print
// on the paper in use before they are relied on.
export const PRODUCT_LABEL_PRESETS: readonly ProductLabelPreset[] = [
  {
    code: 'roll_50x30',
    kind: 'roll',
    suffix: '50×30mm',
    label_mm: { width: 50, height: 30 },
    columns: 1,
    gap_mm: { x: 0, y: 2 },
    roll_width_mm: 50,
    compact: false,
  },
  {
    code: 'roll_40x30',
    kind: 'roll',
    suffix: '40×30mm',
    label_mm: { width: 40, height: 30 },
    columns: 1,
    gap_mm: { x: 0, y: 2 },
    roll_width_mm: 40,
    compact: false,
  },
  {
    code: 'roll_75x25_2',
    kind: 'roll',
    suffix: '75×25mm · 2 tem',
    label_mm: { width: 35, height: 25 },
    columns: 2,
    gap_mm: { x: 3, y: 2 },
    roll_width_mm: 75,
    compact: false,
  },
  {
    code: 'roll_72x22_2',
    kind: 'roll',
    suffix: '72×22mm · 2 tem',
    label_mm: { width: 33, height: 22 },
    columns: 2,
    gap_mm: { x: 3, y: 2 },
    roll_width_mm: 72,
    compact: true,
  },
  {
    code: 'roll_110x22_3',
    kind: 'roll',
    suffix: '110×22mm · 3 tem',
    label_mm: { width: 33, height: 22 },
    columns: 3,
    gap_mm: { x: 2, y: 2 },
    roll_width_mm: 110,
    compact: true,
  },
  {
    code: 'sheet_a4_100',
    kind: 'sheet',
    suffix: 'A4 · 100 tem',
    label_mm: { width: 38, height: 13.5 },
    columns: 5,
    rows: 20,
    gap_mm: { x: 2.5, y: 0.8 },
    sheet_mm: { width: 210, height: 297 },
    sheet_margin_mm: { top: 6, left: 5 },
    compact: false,
  },
  {
    code: 'sheet_a4_65',
    kind: 'sheet',
    suffix: 'A4 · 65 tem',
    label_mm: { width: 38.1, height: 21.2 },
    columns: 5,
    rows: 13,
    gap_mm: { x: 2.5, y: 0 },
    sheet_mm: { width: 210, height: 297 },
    sheet_margin_mm: { top: 10.7, left: 4.7 },
    compact: false,
  },
  {
    code: 'sheet_a4_180',
    kind: 'sheet',
    suffix: 'A4 · 180 tem',
    label_mm: { width: 20.5, height: 13.5 },
    columns: 9,
    rows: 20,
    gap_mm: { x: 1.5, y: 0.8 },
    sheet_mm: { width: 210, height: 297 },
    sheet_margin_mm: { top: 6, left: 6.7 },
    compact: true,
  },
  {
    code: 'sheet_a5_40',
    kind: 'sheet',
    suffix: 'A5 · 40 tem',
    label_mm: { width: 33.5, height: 19 },
    columns: 4,
    rows: 10,
    gap_mm: { x: 2, y: 0.8 },
    sheet_mm: { width: 148, height: 210 },
    sheet_margin_mm: { top: 6.5, left: 4 },
    compact: false,
  },
];

export const PRODUCT_LABEL_PAPERS: readonly ProductLabelPaper[] = PRODUCT_LABEL_PRESETS.map(
  (preset) => preset.code,
);

export const DEFAULT_PRODUCT_LABEL_PAPER: ProductLabelPaper = 'roll_50x30';

export const isProductLabelPaper = (value: unknown): value is ProductLabelPaper =>
  (PRODUCT_LABEL_PAPERS as readonly unknown[]).includes(value);

export function productLabelPreset(paper: ProductLabelPaper): ProductLabelPreset {
  const preset = PRODUCT_LABEL_PRESETS.find((candidate) => candidate.code === paper);
  if (!preset) throw new Error(`Unknown label stock ${paper}`);
  return preset;
}

// Stickers on one sheet, or on one row of a roll.
export const labelsPerPage = (preset: ProductLabelPreset): number =>
  preset.kind === 'sheet' ? preset.columns * preset.rows : preset.columns;
