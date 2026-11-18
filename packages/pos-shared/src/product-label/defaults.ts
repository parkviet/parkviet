import { DEFAULT_PRODUCT_LABEL_PAPER, productLabelPreset } from './presets';
import type { ProductLabelConfig, ProductLabelPaper } from './types';

// The built-in product label template. A copy of
// `server/config/pos/receipt_templates/product_label.json`; the contract
// test keeps the two identical.
export const DEFAULT_PRODUCT_LABEL: Readonly<ProductLabelConfig> = {
  schema: 1,
  page: { font_size: 9, margins: { top: 1, right: 1, bottom: 1, left: 1 } },
  fields: [
    { key: 'store_name', enabled: false, text: null },
    { key: 'store_address', enabled: false, text: null },
    { key: 'product_name', enabled: true, max_lines: 2 },
    { key: 'variant_options', enabled: true },
    { key: 'barcode', enabled: true, symbology: 'auto', show_text: true },
    { key: 'sku', enabled: false, label: null },
    { key: 'unit', enabled: true, label: null },
    { key: 'price', enabled: true, label: null, currency: 'symbol' },
    { key: 'original_price', enabled: false },
    { key: 'printed_date', enabled: false, label: null },
  ],
};

// The built-in template for one label stock. Narrow stickers drop the
// variant options and keep the name on one line, as the server does.
export function defaultProductLabel(
  paper: ProductLabelPaper = DEFAULT_PRODUCT_LABEL_PAPER,
): ProductLabelConfig {
  const config = JSON.parse(JSON.stringify(DEFAULT_PRODUCT_LABEL)) as ProductLabelConfig;
  if (!productLabelPreset(paper).compact) return config;
  for (const field of config.fields) {
    if (field.key === 'variant_options') field.enabled = false;
    if (field.key === 'product_name') field.max_lines = 1;
  }
  return config;
}
