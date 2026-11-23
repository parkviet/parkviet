// A product label template: which fields print on the sticker and how, never
// what they say. Names, barcodes and prices come from the label data the
// server builds per variant. The label stock (paper) decides the sticker
// size and grid; the config only decides the content. It is stored in the
// receipt template store as the document type `product_label`.

export type ProductLabelPaper =
  | 'roll_50x30'
  | 'roll_40x30'
  | 'roll_75x25_2'
  | 'roll_72x22_2'
  | 'roll_110x22_3'
  | 'sheet_a4_100'
  | 'sheet_a4_65'
  | 'sheet_a4_180'
  | 'sheet_a5_40';

export type LabelBarcodeSymbology = 'auto' | 'code128' | 'ean13';
// `symbol` prints the dong sign, `code` prints VNĐ, `none` prints the number only.
export type LabelCurrency = 'symbol' | 'code' | 'none';

// A custom text or label is a string, or null for the built-in wording.
export type ProductLabelField =
  | { key: 'store_name'; enabled: boolean; text: string | null }
  | { key: 'store_address'; enabled: boolean; text: string | null }
  | { key: 'product_name'; enabled: boolean; max_lines: number }
  | { key: 'variant_options'; enabled: boolean }
  | {
      key: 'barcode';
      enabled: boolean;
      symbology: LabelBarcodeSymbology;
      show_text: boolean;
    }
  | { key: 'sku'; enabled: boolean; label: string | null }
  | { key: 'unit'; enabled: boolean; label: string | null }
  | { key: 'price'; enabled: boolean; label: string | null; currency: LabelCurrency }
  | { key: 'original_price'; enabled: boolean }
  | { key: 'printed_date'; enabled: boolean; label: string | null };

export type ProductLabelFieldKey = ProductLabelField['key'];

export type ProductLabelMargins = { top: number; right: number; bottom: number; left: number };

export type ProductLabelConfig = {
  schema: 1;
  // Font size in points; margins in millimetres, inside each sticker.
  page: { font_size: number; margins: ProductLabelMargins };
  // Print order, top to bottom; every key appears exactly once.
  fields: ProductLabelField[];
};

// The size and grid of one label stock, shared with the server
// (`server/config/pos/product_label_presets.json`).
type PresetBase = {
  code: ProductLabelPaper;
  // The paper name shown beside a template's name, such as "A4 · 100 tem".
  suffix: string;
  label_mm: { width: number; height: number };
  columns: number;
  gap_mm: { x: number; y: number };
  // Narrow stickers: the built-in template drops the variant options and
  // keeps the name on one line.
  compact: boolean;
};

export type RollLabelPreset = PresetBase & {
  kind: 'roll';
  roll_width_mm: number;
};

export type SheetLabelPreset = PresetBase & {
  kind: 'sheet';
  rows: number;
  sheet_mm: { width: number; height: number };
  sheet_margin_mm: { top: number; left: number };
};

export type ProductLabelPreset = RollLabelPreset | SheetLabelPreset;
