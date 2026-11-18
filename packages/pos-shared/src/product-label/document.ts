import { type LabelItem, type LabelRow, type RenderLabelsOptions, renderLabels } from './render';
import type { ProductLabelConfig, RollLabelPreset } from './types';

// The document a print station prints product labels from (kind
// `product_label`): per item the rows its template shows and the number of
// copies, on a roll stock. `server/app/services/spree/pos/product_labels/
// document.rb` builds the same document; `server-contract.test.ts` holds both
// to the fixtures in `server/spec/fixtures/product_labels`.

export type LabelDocumentRow =
  | { kind: 'text'; text: string; max_lines?: number }
  | {
      kind: 'barcode';
      symbology: 'ean13' | 'code128';
      value: string;
      show_text: boolean;
    }
  | { kind: 'price'; text: string; original?: string };

export type LabelDocument = {
  version: 1;
  kind: 'product_label';
  page: {
    label: {
      width_mm: number;
      height_mm: number;
      columns: number;
      // Between rows along the feed, and between the stickers of a row.
      gap_mm: number;
      column_gap_mm: number;
      roll_width_mm: number;
    };
  };
  font_size: number;
  margins: { top: number; right: number; bottom: number; left: number };
  labels: { rows: LabelDocumentRow[]; copies: number }[];
};

function documentRows(rows: readonly LabelRow[]): LabelDocumentRow[] {
  const result: LabelDocumentRow[] = [];
  let original: string | null = null;
  for (const row of rows) {
    if (row.key === 'original_price') {
      original = row.text;
    } else if (row.key === 'price') {
      result.push({ kind: 'price', text: row.caption ? `${row.caption} ${row.text}` : row.text });
    } else if (row.key === 'barcode' && row.barcode?.kind === 'bars') {
      result.push({
        kind: 'barcode',
        symbology: row.barcode.symbology,
        value: row.barcode.value,
        show_text: row.showText === true,
      });
    } else if (row.key === 'product_name') {
      result.push({ kind: 'text', text: row.text, max_lines: row.maxLines });
    } else {
      result.push({ kind: 'text', text: row.caption ? `${row.caption} ${row.text}` : row.text });
    }
  }
  const price = result.find((row) => row.kind === 'price');
  if (price && original) price.original = original;
  return result;
}

export function buildLabelDocument(
  config: ProductLabelConfig,
  preset: RollLabelPreset,
  items: readonly LabelItem[],
  options: RenderLabelsOptions,
): LabelDocument {
  return {
    version: 1,
    kind: 'product_label',
    page: {
      label: {
        width_mm: preset.label_mm.width,
        height_mm: preset.label_mm.height,
        columns: preset.columns,
        gap_mm: preset.gap_mm.y,
        column_gap_mm: preset.gap_mm.x,
        roll_width_mm: preset.roll_width_mm,
      },
    },
    font_size: config.page.font_size,
    margins: { ...config.page.margins },
    labels: items.map((item) => {
      const sheet = renderLabels(config, preset, [{ ...item, quantity: 1 }], options);
      const label = sheet.pages[0].cells[0].label;
      return { rows: documentRows(label.rows), copies: Math.max(0, Math.floor(item.quantity)) };
    }),
  };
}
