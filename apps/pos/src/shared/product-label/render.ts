import { formatMoney } from '../money';
import { formatDocumentDateOnly } from '../receipt-template/data';
import { chooseBarcode, type LabelBarcode } from './ean13';
import { labelsPerPage } from './presets';
import type {
  LabelCurrency,
  ProductLabelConfig,
  ProductLabelField,
  ProductLabelFieldKey,
  ProductLabelPreset,
} from './types';

// Lays product labels out on their stock: every item repeated `quantity`
// times, the values each field prints, and the pages they fall on. A roll
// page is one row of stickers; a sheet page is one sheet of columns × rows.
// Pure data: `render-html.ts` turns it into the markup that is printed.

// One line of the label data the server returns (`ProductLabels::Data`).
export type LabelItem = {
  variant_id: string;
  product_name: string;
  variant_options: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  price: string | null;
  original_price: string | null;
  currency: string;
  quantity: number;
  warnings?: string[];
};

export type LabelStoreInfo = { name: string | null; address: string | null };

export type LabelRow = {
  key: ProductLabelFieldKey;
  // Text before the value, when the template gives one.
  caption: string | null;
  text: string;
  // Lines the product name may take.
  maxLines?: number;
  // The original price is struck through.
  strike?: boolean;
  barcode?: LabelBarcode;
  // Print the code in text under the bars.
  showText?: boolean;
};

export type Label = {
  variantId: string;
  rows: LabelRow[];
  // The item's warnings plus any the layout found (`barcode_too_wide`).
  warnings: string[];
};

export type LabelCell = {
  // 0-based place on the page; `column` and `row` are the same place as a grid position.
  slot: number;
  column: number;
  row: number;
  label: Label;
};

export type LabelPage = { cells: LabelCell[] };

export type LabelSheet = {
  preset: ProductLabelPreset;
  pages: LabelPage[];
  labelCount: number;
};

export type RenderLabelsOptions = {
  now: Date;
  timeZone: string;
  store?: LabelStoreInfo | null;
  // Sheets only: the 1-based cell the first label takes, leaving earlier
  // cells of the first sheet empty (already peeled).
  startCell?: number;
};

// The sticker's printable width: the barcode has to fit inside it.
export function printableWidthMm(config: ProductLabelConfig, preset: ProductLabelPreset): number {
  const { left, right } = config.page.margins;
  return Math.max(0, preset.label_mm.width - left - right);
}

// An amount as the template's currency setting asks: the sign, the code, or the bare number.
export function formatLabelPrice(
  amount: string | null | undefined,
  currency: string,
  style: LabelCurrency,
): string | null {
  if (amount == null) return null;
  const text = formatMoney(amount, currency);
  if (text === '—') return null;
  if (style === 'symbol') return text;
  const bare = text.replace(/\s(₫|[A-Z]{3})$/, '');
  if (style === 'none') return bare;
  return `${bare} ${currency === 'VND' ? 'VNĐ' : currency}`;
}

const present = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text ? text : null;
};

type Context = {
  config: ProductLabelConfig;
  preset: ProductLabelPreset;
  options: RenderLabelsOptions;
  priceStyle: LabelCurrency;
  printedDate: string;
};

function fieldRow(
  field: ProductLabelField,
  item: LabelItem,
  context: Context,
  warnings: string[],
): LabelRow | null {
  switch (field.key) {
    case 'store_name':
    case 'store_address': {
      const own = present(field.text);
      const fallback =
        field.key === 'store_name' ? context.options.store?.name : context.options.store?.address;
      const text = own ?? present(fallback);
      return text ? { key: field.key, caption: null, text } : null;
    }
    case 'product_name': {
      const text = present(item.product_name);
      return text ? { key: field.key, caption: null, text, maxLines: field.max_lines } : null;
    }
    case 'variant_options': {
      const text = present(item.variant_options);
      return text ? { key: field.key, caption: null, text } : null;
    }
    case 'barcode': {
      const code = present(item.barcode) ?? present(item.sku);
      if (!code) return null;
      const choice = chooseBarcode(
        code,
        field.symbology,
        printableWidthMm(context.config, context.preset),
      );
      if (choice.warning) warnings.push(choice.warning);
      return {
        key: field.key,
        caption: null,
        text: code,
        barcode: choice.barcode,
        showText: field.show_text || choice.barcode.kind === 'text',
      };
    }
    case 'sku': {
      const text = present(item.sku);
      return text ? { key: field.key, caption: present(field.label), text } : null;
    }
    case 'unit': {
      const text = present(item.unit);
      return text ? { key: field.key, caption: present(field.label), text } : null;
    }
    case 'price': {
      const text = formatLabelPrice(item.price, item.currency, field.currency);
      return text ? { key: field.key, caption: present(field.label), text } : null;
    }
    case 'original_price': {
      const text = formatLabelPrice(item.original_price, item.currency, context.priceStyle);
      return text ? { key: field.key, caption: null, text, strike: true } : null;
    }
    case 'printed_date':
      return { key: field.key, caption: present(field.label), text: context.printedDate };
  }
}

function buildLabel(item: LabelItem, context: Context): Label {
  const warnings = [...(item.warnings ?? [])];
  const rows: LabelRow[] = [];
  for (const field of context.config.fields) {
    if (!field.enabled) continue;
    const row = fieldRow(field, item, context, warnings);
    if (row) rows.push(row);
  }
  return { variantId: item.variant_id, rows, warnings };
}

// The pages of `items` on `preset`, each item repeated `quantity` times. Roll
// pages are full rows except the last; a sheet starts at `startCell` and
// every later sheet at its first cell.
export function renderLabels(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  items: readonly LabelItem[],
  options: RenderLabelsOptions,
): LabelSheet {
  const price = config.fields.find((field) => field.key === 'price');
  const context: Context = {
    config,
    preset,
    options,
    priceStyle: price?.key === 'price' ? price.currency : 'symbol',
    printedDate: formatDocumentDateOnly(options.now.toISOString(), options.timeZone),
  };

  const perPage = labelsPerPage(preset);
  const columns = preset.columns;
  const requested = preset.kind === 'sheet' ? Math.floor(options.startCell ?? 1) : 1;
  const firstSlot = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), perPage) - 1 : 0;

  const pages: LabelPage[] = [];
  let labelCount = 0;
  let slot = firstSlot;
  let page: LabelPage | null = null;
  for (const item of items) {
    const label = buildLabel(item, context);
    const quantity = Math.max(0, Math.floor(item.quantity));
    for (let copy = 0; copy < quantity; copy += 1) {
      if (!page || slot >= perPage) {
        page = { cells: [] };
        pages.push(page);
        if (pages.length > 1) slot = 0;
      }
      page.cells.push({ slot, column: slot % columns, row: Math.floor(slot / columns), label });
      slot += 1;
      labelCount += 1;
    }
  }
  return { preset, pages, labelCount };
}
