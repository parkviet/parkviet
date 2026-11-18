import type { TemplateIssue } from '../receipt-template/validate';

// The editor's copy of the server's label rules
// (`Spree::Pos::ProductLabelSchema`). It reports the same JSON pointers and
// codes, and `server/spec/fixtures/product_label_schema_cases.json` holds the
// cases both sides must answer alike. The config is checked as unknown data:
// the server receives whatever a client sends, and so can the editor.

export const MAX_LABEL_CONFIG_BYTES = 16 * 1024;
export const MAX_LABEL_TEXT_LENGTH = 60;
export const MAX_LABEL_CAPTION_LENGTH = 24;
export const LABEL_FONT_SIZE_RANGE = [6, 14] as const;
export const LABEL_MARGIN_RANGE = [0, 5] as const;
export const LABEL_MAX_LINES_RANGE = [1, 3] as const;
export const LABEL_MARGIN_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const LABEL_SYMBOLOGIES = ['auto', 'code128', 'ean13'] as const;
export const LABEL_CURRENCIES = ['symbol', 'code', 'none'] as const;

const TOP_KEYS = ['schema', 'page', 'fields'] as const;
const PAGE_KEYS = ['font_size', 'margins'] as const;
// Per field: the keys beyond `key` and `enabled` it accepts.
const FIELD_KEYS: Readonly<Record<string, readonly string[]>> = {
  store_name: ['text'],
  store_address: ['text'],
  product_name: ['max_lines'],
  variant_options: [],
  barcode: ['symbology', 'show_text'],
  sku: ['label'],
  unit: ['label'],
  price: ['label', 'currency'],
  original_price: [],
  printed_date: ['label'],
};
export const PRODUCT_LABEL_FIELD_KEYS: readonly string[] = Object.keys(FIELD_KEYS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inRange = (value: unknown, [min, max]: readonly [number, number]): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

// Problems of a product label config as server-style pointers.
export function validateProductLabelConfig(config: unknown, root = '/config'): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const add = (pointer: string, code: string) => {
    issues.push({ pointer, code });
  };
  const at = (...parts: (string | number)[]) =>
    [root, ...parts.map((part) => String(part).replaceAll('~', '~0').replaceAll('/', '~1'))].join(
      '/',
    );
  const knownKeys = (
    record: Record<string, unknown>,
    allowed: readonly string[],
    ...path: (string | number)[]
  ) => {
    for (const key of Object.keys(record)) {
      if (!allowed.includes(key)) add(at(...path, key), 'unknown_key');
    }
  };

  if (!isRecord(config)) {
    add(at(), 'invalid_type');
    return issues;
  }
  if (new TextEncoder().encode(JSON.stringify(config)).length > MAX_LABEL_CONFIG_BYTES) {
    add(at(), 'too_large');
    return issues;
  }

  knownKeys(config, TOP_KEYS);
  for (const key of TOP_KEYS) if (!(key in config)) add(at(key), 'missing');
  if ('schema' in config && config.schema !== 1) add(at('schema'), 'unsupported');

  if ('page' in config) {
    const { page } = config;
    if (!isRecord(page)) add(at('page'), 'invalid_type');
    else {
      knownKeys(page, PAGE_KEYS, 'page');
      for (const key of PAGE_KEYS) if (!(key in page)) add(at('page', key), 'missing');
      if ('font_size' in page && !inRange(page.font_size, LABEL_FONT_SIZE_RANGE))
        add(at('page', 'font_size'), 'invalid_value');
      if ('margins' in page) {
        const { margins } = page;
        if (!isRecord(margins)) add(at('page', 'margins'), 'invalid_type');
        else {
          knownKeys(margins, LABEL_MARGIN_SIDES, 'page', 'margins');
          for (const side of LABEL_MARGIN_SIDES) {
            if (!(side in margins)) add(at('page', 'margins', side), 'missing');
            else if (!inRange(margins[side], LABEL_MARGIN_RANGE))
              add(at('page', 'margins', side), 'invalid_value');
          }
        }
      }
    }
  }

  if ('fields' in config) {
    const { fields } = config;
    if (!Array.isArray(fields)) add(at('fields'), 'invalid_type');
    else {
      const seen: string[] = [];
      fields.forEach((field: unknown, index: number) => {
        if (!isRecord(field)) {
          add(at('fields', index), 'invalid_type');
          return;
        }
        const key = field.key;
        if (typeof key !== 'string' || !PRODUCT_LABEL_FIELD_KEYS.includes(key)) {
          add(at('fields', index, 'key'), 'field_unavailable');
          return;
        }
        if (seen.includes(key)) {
          add(at('fields', index, 'key'), 'duplicate');
          return;
        }
        seen.push(key);
        checkField(field, key, index);
      });
      for (const key of PRODUCT_LABEL_FIELD_KEYS)
        if (!seen.includes(key)) add(at('fields'), 'missing');
    }
  }
  return issues;

  function checkField(field: Record<string, unknown>, key: string, index: number) {
    const path = ['fields', index] as const;
    knownKeys(field, ['key', 'enabled', ...(FIELD_KEYS[key] ?? [])], ...path);
    if (!('enabled' in field)) add(at(...path, 'enabled'), 'missing');
    else if (typeof field.enabled !== 'boolean') add(at(...path, 'enabled'), 'invalid_type');
    if ('text' in field) checkText(field.text, 'text', MAX_LABEL_TEXT_LENGTH, path);
    if ('label' in field) checkText(field.label, 'label', MAX_LABEL_CAPTION_LENGTH, path);
    if ('max_lines' in field) {
      const lines = field.max_lines;
      if (!Number.isInteger(lines) || !inRange(lines, LABEL_MAX_LINES_RANGE))
        add(at(...path, 'max_lines'), 'invalid_value');
    }
    if (
      'symbology' in field &&
      !(LABEL_SYMBOLOGIES as readonly unknown[]).includes(field.symbology)
    )
      add(at(...path, 'symbology'), 'invalid_value');
    if ('show_text' in field && typeof field.show_text !== 'boolean')
      add(at(...path, 'show_text'), 'invalid_type');
    if ('currency' in field && !(LABEL_CURRENCIES as readonly unknown[]).includes(field.currency))
      add(at(...path, 'currency'), 'invalid_value');
  }

  function checkText(
    value: unknown,
    name: string,
    max: number,
    path: readonly (string | number)[],
  ) {
    if (value === null || value === undefined) return;
    if (typeof value !== 'string') add(at(...path, name), 'invalid_type');
    else if (value.length > max) add(at(...path, name), 'too_long');
  }
}
