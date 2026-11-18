import { isProductLabelPaper } from '../product-label/presets';
import type { ProductLabelConfig, ProductLabelPaper } from '../product-label/types';
import { validateProductLabelConfig } from '../product-label/validate';
import {
  isWebUrl,
  MAX_BLOCKS,
  MAX_CAPTION_LENGTH,
  MAX_COPIES,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_URL_LENGTH,
  SIGNATURE_PARTIES,
  SOCIAL_FIELDS,
} from './render';
import type {
  BusinessField,
  DocumentType,
  EinvoiceField,
  EinvoiceSection,
  LineColumn,
  LineRuling,
  MetaField,
  MetaSection,
  PageMargins,
  PaperSize,
  PaymentField,
  PaymentsSection,
  QrCaptionPosition,
  QrSize,
  ReceiptDocumentType,
  SignatureParty,
  TableStyle,
  TemplateBlock,
  TemplateConfig,
  TextSize,
  TimedStyle,
  TimeFormat,
  TitleSize,
  TotalField,
} from './types';
import { isTemplateVariable } from './variables';

// The editor's copy of the server's template rules
// (`Spree::Pos::ReceiptTemplateSchema`), so a mistake shows while typing.
// The server stays the authority: its 422 errors carry the same JSON
// pointers and replace these when a save is refused.

export const MAX_NAME_LENGTH = 60;
export const MAX_CONFIG_BYTES = 16 * 1024;
export const MAX_ACTIVE_TEMPLATES = 10;

export type TemplateIssue = { pointer: string; code: string; message?: string };

export type SectionRules = {
  meta?: readonly MetaField[];
  lines?: readonly LineColumn[];
  totals?: readonly TotalField[];
  payments?: readonly PaymentField[];
  einvoice?: readonly EinvoiceField[];
};

const META_ALL: readonly MetaField[] = [
  'time',
  'cashier',
  'register',
  'branch',
  'order_number',
  'return_number',
  'customer',
  'table',
  'check_in',
  'check_out',
  'duration',
  'call_number',
  'order_source',
  'printed_at',
  'print_count',
];
const COLUMNS_ALL: readonly LineColumn[] = [
  'index',
  'name',
  'sku',
  'barcode',
  'unit',
  'qty',
  'original_price',
  'price',
  'discount',
  'amount',
  'note',
];
const TOTALS_ALL: readonly TotalField[] = [
  'item_count',
  'item_total',
  'discount',
  'promotions',
  'shipping',
  'fees',
  'tax',
  'included_tax',
  'total',
];
const PAYMENTS_ALL: readonly PaymentField[] = [
  'methods',
  'handed',
  'change',
  'reference',
  'paid_total',
  'debt',
  'previous_debt',
  'customer_debt',
  'due_on',
  'pay_qr',
  'transfer_qr',
];
const EINVOICE_ALL: readonly EinvoiceField[] = [
  'seller_tax_code',
  'number',
  'lookup_code',
  'cqt_code',
  'qr',
  'lookup_url',
];

// Sections and fields each document type has data for; a section missing
// here does not exist on that document.
export const SECTION_RULES: Readonly<Record<ReceiptDocumentType, SectionRules>> = {
  sale: {
    meta: META_ALL,
    lines: COLUMNS_ALL,
    totals: TOTALS_ALL,
    payments: PAYMENTS_ALL,
    einvoice: EINVOICE_ALL,
  },
  prebill: {
    meta: [
      'time',
      'register',
      'branch',
      'customer',
      'table',
      'check_in',
      'duration',
      'call_number',
      'order_source',
      'printed_at',
      'print_count',
    ],
    lines: [
      'index',
      'name',
      'sku',
      'barcode',
      'unit',
      'qty',
      'original_price',
      'price',
      'amount',
      'note',
    ],
    totals: ['item_count', 'item_total', 'discount', 'promotions', 'shipping', 'fees', 'total'],
    payments: ['paid_total', 'transfer_qr'],
  },
  payment_ticket: {
    meta: [
      'time',
      'cashier',
      'register',
      'branch',
      'order_number',
      'customer',
      'table',
      'check_in',
      'check_out',
      'duration',
      'call_number',
      'order_source',
      'printed_at',
      'print_count',
    ],
    lines: COLUMNS_ALL,
    totals: TOTALS_ALL,
    payments: ['methods', 'handed', 'change', 'transfer_qr'],
  },
  return: {
    meta: [
      'time',
      'cashier',
      'register',
      'branch',
      'order_number',
      'return_number',
      'customer',
      'order_source',
      'printed_at',
      'print_count',
    ],
    lines: ['index', 'name', 'sku', 'amount', 'note'],
    totals: ['total'],
  },
  refund: {
    meta: [
      'time',
      'cashier',
      'register',
      'branch',
      'order_number',
      'return_number',
      'customer',
      'order_source',
      'printed_at',
      'print_count',
    ],
    payments: ['methods', 'reference'],
  },
  shift_closure: { meta: ['time', 'cashier', 'register', 'branch', 'printed_at'] },
};

// Fields the server accepts but no printed row carries yet: the header
// already names the branch and register, so the editor does not offer them.
export const UNPRINTED_META: readonly MetaField[] = ['register', 'branch'];

// Always printed whatever the template says.
export const LOCKED_TOTALS: readonly TotalField[] = ['total'];
export const LOCKED_COLUMNS: readonly LineColumn[] = ['name'];
// Payment method rows are labelled by their method.
export const FIXED_LABELS: readonly string[] = ['methods'];

export const BLOCK_TYPES = [
  'logo',
  'business',
  'text',
  'title',
  'divider',
  'spacer',
  'qr',
  'barcode',
  'signatures',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export { SIGNATURE_PARTIES, SOCIAL_FIELDS };
// The width each paper prints on, as laid out by the print page rules.
export const PRINTABLE_WIDTH_MM: Readonly<Record<PaperSize, number>> = {
  '58mm': 48,
  '80mm': 72,
  a4: 186,
  a5: 128,
  a6: 93,
};
// Sheets wide enough for a ruled line table and signature boxes.
export const WIDE_PAPERS: readonly PaperSize[] = ['a4', 'a5'];
export const THERMAL_PAPERS: readonly PaperSize[] = ['58mm', '80mm'];
// Document types printed in several copies with one press.
export const COPIES_TYPES: readonly ReceiptDocumentType[] = ['sale'];
export const BUSINESS_FIELDS: readonly BusinessField[] = [
  'name',
  'branch',
  'address',
  'phone',
  'email',
  'tax_code',
  'description',
  'url',
  'facebook',
  'instagram',
];

export const TITLE_SIZES: readonly TitleSize[] = ['m', 'l', 'xl'];
export const TABLE_STYLES: readonly TableStyle[] = ['one_line', 'two_lines'];
export const TIME_FORMATS: readonly TimeFormat[] = ['datetime', 'date'];
export const LINE_RULINGS: readonly LineRuling[] = ['none', 'rows', 'grid'];
export const TIMED_STYLES: readonly TimedStyle[] = ['duration', 'range'];
export const QR_SIZES: readonly QrSize[] = ['s', 'm', 'l'];
export const QR_CAPTIONS: readonly QrCaptionPosition[] = ['below', 'above', 'left', 'right'];
export const MARGIN_SIDES = ['top', 'right', 'bottom', 'left'] as const;

const ALIGNS: readonly string[] = ['left', 'center', 'right'];
const SIZES: readonly string[] = ['s', 'm', 'l'];
const PAPERS: readonly PaperSize[] = ['58mm', '80mm', 'a4', 'a5', 'a6'];
const VARIABLE_PATTERN = /\{([a-z_]+(?:\.[a-z_]+)?)\}/g;

const between = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type Add = (pointer: string, code: string) => void;

function checkKnownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  prefix: string,
  add: Add,
) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) add(`${prefix}/${key}`, 'unknown_key');
  }
}

function checkBlock(block: TemplateBlock, at: string, add: Add) {
  if ('align' in block && block.align !== undefined && !ALIGNS.includes(block.align))
    add(`${at}/align`, 'invalid_value');
  switch (block.type) {
    case 'logo':
      if (block.width_pct !== undefined && !between(block.width_pct, 20, 100))
        add(`${at}/width_pct`, 'invalid_value');
      if (block.monochrome !== undefined && typeof block.monochrome !== 'boolean')
        add(`${at}/monochrome`, 'invalid_type');
      break;
    case 'qr':
      if ((block.caption ?? '').length > MAX_CAPTION_LENGTH) add(`${at}/caption`, 'too_long');
      if (block.source === 'url') {
        if (block.value.length > MAX_URL_LENGTH) add(`${at}/value`, 'too_long');
        else if (!isWebUrl(block.value)) add(`${at}/value`, 'invalid_url');
      } else if (block.source === 'store_social') {
        if (!SOCIAL_FIELDS.includes(block.field)) add(`${at}/field`, 'invalid_value');
      } else add(`${at}/source`, 'invalid_value');
      break;
    case 'barcode':
      break;
    case 'signatures':
      if (block.parties.length === 0) add(`${at}/parties`, 'blank');
      else {
        block.parties.forEach((party, index) => {
          if (!SIGNATURE_PARTIES.includes(party))
            add(`${at}/parties/${index}`, 'field_unavailable');
          else if (block.parties.indexOf(party) !== index)
            add(`${at}/parties/${index}`, 'duplicate');
        });
      }
      for (const [party, label] of Object.entries(block.labels ?? {})) {
        if (!SIGNATURE_PARTIES.includes(party as SignatureParty))
          add(`${at}/labels/${party}`, 'unknown_key');
        else if ((label ?? '').length > MAX_LABEL_LENGTH) add(`${at}/labels/${party}`, 'too_long');
      }
      break;
    case 'business':
      if (block.fields.length === 0) add(`${at}/fields`, 'blank');
      else {
        block.fields.forEach((field, index) => {
          if (!BUSINESS_FIELDS.includes(field)) add(`${at}/fields/${index}`, 'field_unavailable');
          else if (block.fields.indexOf(field) !== index) add(`${at}/fields/${index}`, 'duplicate');
        });
      }
      break;
    case 'text':
      if (block.size !== undefined && !SIZES.includes(block.size))
        add(`${at}/size`, 'invalid_value');
      if (block.value.length > MAX_TEXT_LENGTH) add(`${at}/value`, 'too_long');
      else if (block.value.trim() === '') add(`${at}/value`, 'blank');
      else if (unknownVariables(block.value).length > 0) add(`${at}/value`, 'unknown_variable');
      break;
    case 'title':
      if ((block.label ?? '').length > MAX_TITLE_LENGTH) add(`${at}/label`, 'too_long');
      if (block.size !== undefined && !(TITLE_SIZES as readonly string[]).includes(block.size))
        add(`${at}/size`, 'invalid_value');
      break;
    case 'spacer':
      if (block.mm !== undefined && !between(block.mm, 1, 10)) add(`${at}/mm`, 'invalid_value');
      break;
    case 'divider':
      if (block.style !== undefined && block.style !== 'solid' && block.style !== 'dashed')
        add(`${at}/style`, 'invalid_value');
      break;
    default:
      add(`${at}/type`, 'unknown_block');
  }
}

function checkBlocks(blocks: TemplateBlock[], place: 'header' | 'footer', add: Add) {
  if (blocks.length > MAX_BLOCKS) add(`/config/${place}`, 'too_many');
  let titles = 0;
  blocks.forEach((block, index) => {
    const at = `/config/${place}/${index}`;
    if (block.type === 'title') titles += 1;
    if (block.type === 'title' && place === 'footer') add(at, 'misplaced');
    else if (block.type === 'title' && titles > 1) add(at, 'duplicate');
    else checkBlock(block, at, add);
  });
}

function checkFields(
  section: { fields: string[]; labels?: Partial<Record<string, string>> } | undefined,
  name: string,
  allowed: readonly string[],
  add: Add,
) {
  if (!section) return;
  section.fields.forEach((field, index) => {
    if (!allowed.includes(field)) add(`/config/${name}/fields/${index}`, 'field_unavailable');
    else if (section.fields.indexOf(field) !== index)
      add(`/config/${name}/fields/${index}`, 'duplicate');
  });
  for (const [field, label] of Object.entries(section.labels ?? {})) {
    if (label === undefined) continue;
    if (!allowed.includes(field) || FIXED_LABELS.includes(field))
      add(`/config/${name}/labels/${field}`, 'field_unavailable');
    else if (label.length > MAX_LABEL_LENGTH) add(`/config/${name}/labels/${field}`, 'too_long');
  }
}

function checkQrSectionOptions(
  section: { qr_size?: unknown; qr_caption?: unknown } | undefined,
  name: 'payments' | 'einvoice',
  add: Add,
) {
  if (!section) return;
  if (section.qr_size !== undefined && !(QR_SIZES as readonly unknown[]).includes(section.qr_size))
    add(`/config/${name}/qr_size`, 'invalid_value');
  if (
    section.qr_caption !== undefined &&
    !(QR_CAPTIONS as readonly unknown[]).includes(section.qr_caption)
  )
    add(`/config/${name}/qr_caption`, 'invalid_value');
}

function checkMargins(margins: unknown, add: Add) {
  if (!isRecord(margins)) {
    add('/config/page/margins', 'invalid_type');
    return;
  }
  checkKnownKeys(margins, MARGIN_SIDES, '/config/page/margins', add);
  for (const side of MARGIN_SIDES) {
    if (!(side in margins) || margins[side] === undefined)
      add(`/config/page/margins/${side}`, 'missing');
    else if (!between(margins[side], 0, 15)) add(`/config/page/margins/${side}`, 'invalid_value');
  }
}

// Variables named in a text that the POS does not know.
export function unknownVariables(text: string): string[] {
  const names = [...text.matchAll(VARIABLE_PATTERN)].map(([, name]) => name ?? '');
  return [...new Set(names.filter((name) => !isTemplateVariable(name)))];
}

// Problems of a template as the editor holds it, as server-style pointers.
//
// A product label is checked against its own rules and label stocks
// (`product-label/validate.ts`); every other type is a receipt layout.
export function validateTemplate(
  draft: {
    name: string;
    paper: PaperSize | ProductLabelPaper;
    config: TemplateConfig | ProductLabelConfig;
  },
  documentType: DocumentType,
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const add: Add = (pointer, code) => {
    issues.push({ pointer, code });
  };
  const name = draft.name.trim();
  if (name === '') add('/name', 'blank');
  else if (name.length > MAX_NAME_LENGTH) add('/name', 'too_long');
  if (documentType === 'product_label') {
    if (!isProductLabelPaper(draft.paper)) add('/paper', 'invalid_value');
    return [...issues, ...validateProductLabelConfig(draft.config)];
  }
  if (!(PAPERS as readonly string[]).includes(draft.paper)) add('/paper', 'invalid_value');

  // A receipt type has a receipt config; a label config is handled above.
  const config = draft.config as TemplateConfig;
  if (!between(config.page.margin_mm, 0, 20)) add('/config/page/margin_mm', 'invalid_value');
  if (config.page.margins !== undefined) checkMargins(config.page.margins, add);
  if (config.page.cut_feed_mm !== undefined && !between(config.page.cut_feed_mm, 0, 30))
    add('/config/page/cut_feed_mm', 'invalid_value');
  if (!between(config.page.line_spacing, 1, 1.6)) add('/config/page/line_spacing', 'invalid_value');
  const { copies } = config.page;
  if (copies !== undefined) {
    if (!COPIES_TYPES.includes(documentType)) add('/config/page/copies', 'field_unavailable');
    else if (!Number.isInteger(copies) || !between(copies, 1, MAX_COPIES))
      add('/config/page/copies', 'invalid_value');
  }
  checkBlocks(config.header, 'header', add);
  checkBlocks(config.footer, 'footer', add);

  const rules = SECTION_RULES[documentType];
  for (const section of ['meta', 'lines', 'totals', 'payments', 'einvoice'] as const) {
    if (config[section] && !rules[section]) add(`/config/${section}`, 'section_unavailable');
  }
  if (rules.meta && config.meta) {
    checkFields(config.meta, 'meta', rules.meta, add);
    if (
      config.meta.table_style !== undefined &&
      !(TABLE_STYLES as readonly unknown[]).includes(config.meta.table_style)
    )
      add('/config/meta/table_style', 'invalid_value');
    if (
      config.meta.time_format !== undefined &&
      !(TIME_FORMATS as readonly unknown[]).includes(config.meta.time_format)
    )
      add('/config/meta/time_format', 'invalid_value');
  }
  if (rules.totals) checkFields(config.totals, 'totals', rules.totals, add);
  if (rules.payments && config.payments) {
    checkFields(config.payments, 'payments', rules.payments, add);
    checkQrSectionOptions(config.payments, 'payments', add);
  }
  if (rules.einvoice && config.einvoice) {
    checkFields(config.einvoice, 'einvoice', rules.einvoice, add);
    checkQrSectionOptions(config.einvoice, 'einvoice', add);
  }
  if (rules.lines && config.lines) {
    const allowed = rules.lines;
    config.lines.columns.forEach((column, index) => {
      if (!allowed.includes(column)) add(`/config/lines/columns/${index}`, 'field_unavailable');
      else if (config.lines?.columns.indexOf(column) !== index)
        add(`/config/lines/columns/${index}`, 'duplicate');
    });
    if (
      config.lines.ruling !== undefined &&
      !(LINE_RULINGS as readonly unknown[]).includes(config.lines.ruling)
    )
      add('/config/lines/ruling', 'invalid_value');
    if (
      config.lines.timed_style !== undefined &&
      !(TIMED_STYLES as readonly unknown[]).includes(config.lines.timed_style)
    )
      add('/config/lines/timed_style', 'invalid_value');
  }
  if (new TextEncoder().encode(JSON.stringify(config)).length > MAX_CONFIG_BYTES)
    add('/config', 'too_large');
  return issues;
}

// The problems of a refused (422) template save, in the same shape.
export function serverIssues(error: unknown): TemplateIssue[] {
  if (typeof error !== 'object' || error === null || !('details' in error)) return [];
  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null || !('errors' in details)) return [];
  const list = (details as { errors?: unknown }).errors;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { pointer, code, message } = entry as Record<string, unknown>;
    if (typeof pointer !== 'string') return [];
    return [
      {
        pointer,
        code: typeof code === 'string' ? code : 'invalid_value',
        ...(typeof message === 'string' ? { message } : {}),
      },
    ];
  });
}

export type IssueArea =
  | 'name'
  | 'paper'
  | 'page'
  | 'header'
  | 'meta'
  | 'lines'
  | 'totals'
  | 'payments'
  | 'einvoice'
  | 'footer'
  | 'config';

// Where in the editor a pointer lands: a field, a section or one block.
export function issueTarget(pointer: string): { area: IssueArea; index: number | null } {
  const [root, area, index] = pointer.split('/').slice(1);
  if (root === 'name' || root === 'paper') return { area: root, index: null };
  if (root !== 'config' || !area) return { area: 'config', index: null };
  if (area === 'header' || area === 'footer') {
    const position = index !== undefined && /^\d+$/.test(index) ? Number(index) : null;
    return { area, index: position };
  }
  if (
    area === 'page' ||
    area === 'meta' ||
    area === 'lines' ||
    area === 'totals' ||
    area === 'payments' ||
    area === 'einvoice'
  )
    return { area, index: null };
  return { area: 'config', index: null };
}

// Roughly how many characters fit on one line of a thermal roll, so the
// editor can warn before a line wraps. Sheets are wide enough not to care.
// Custom left/right margins shrink the printable width proportionally.
export function charsPerLine(
  paper: PaperSize,
  pageSize: TextSize,
  textSize: TextSize = 'm',
  margins?: PageMargins | null,
): number | null {
  const rawBase = paper === '58mm' ? 32 : paper === '80mm' ? 48 : null;
  if (rawBase === null) return null;
  const fullMm = PRINTABLE_WIDTH_MM[paper];
  const horizontalMargin = margins ? Math.max(0, margins.left) + Math.max(0, margins.right) : 0;
  const usableMm = Math.max(12, fullMm - horizontalMargin);
  const base = horizontalMargin > 0 ? (rawBase * usableMm) / fullMm : rawBase;
  // Smaller type fits more characters.
  const scale = { s: 1.2, m: 1, l: 0.8 } as const;
  return Math.max(6, Math.floor(base * scale[pageSize] * scale[textSize]));
}

// The resolved lines longer than the roll fits.
export function overlongLines(lines: string[], limit: number | null): string[] {
  return limit === null ? [] : lines.filter((line) => line.length > limit);
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// A config in the full shape the editor works on: every section the
// document has is present (a missing one printed everything, except
// `einvoice` whose absence keeps legacy buyer-QR-only mode), sections the
// document lacks are dropped, and the always-printed fields are listed.
export function editableConfig(
  config: TemplateConfig,
  documentType: ReceiptDocumentType,
): TemplateConfig {
  const source = clone(config);
  const rules = SECTION_RULES[documentType];
  const blocks = (list: unknown): TemplateBlock[] =>
    Array.isArray(list)
      ? list.filter(
          (block): block is TemplateBlock =>
            typeof block === 'object' &&
            block !== null &&
            (BLOCK_TYPES as readonly string[]).includes((block as { type?: string }).type ?? ''),
        )
      : [];
  const fields = <F extends string>(
    section: { fields?: F[]; labels?: Partial<Record<F, string>> } | undefined,
    allowed: readonly F[],
    locked: readonly F[] = [],
  ) => {
    const listed = Array.isArray(section?.fields) ? section.fields : [...allowed];
    const missing = locked.filter((field) => allowed.includes(field) && !listed.includes(field));
    return { fields: [...listed, ...missing], labels: { ...(section?.labels ?? {}) } };
  };
  const result: TemplateConfig = {
    schema: 1,
    page: {
      margin_mm: source.page?.margin_mm ?? 3,
      ...(source.page?.margins !== undefined ? { margins: source.page.margins } : {}),
      ...(source.page?.cut_feed_mm !== undefined ? { cut_feed_mm: source.page.cut_feed_mm } : {}),
      font: source.page?.font ?? 'sans',
      font_size: source.page?.font_size ?? 'm',
      line_spacing: source.page?.line_spacing ?? 1.35,
      ...(COPIES_TYPES.includes(documentType) && source.page?.copies !== undefined
        ? { copies: source.page.copies }
        : {}),
    },
    header: blocks(source.header),
    footer: blocks(source.footer),
  };
  if (rules.meta) {
    const metaBase: MetaSection = fields(source.meta, rules.meta);
    if (source.meta?.table_style !== undefined) metaBase.table_style = source.meta.table_style;
    if (source.meta?.time_format !== undefined) metaBase.time_format = source.meta.time_format;
    result.meta = metaBase;
  }
  if (rules.lines) {
    const lines = source.lines;
    const columns = Array.isArray(lines?.columns) ? lines.columns : [...rules.lines];
    result.lines = {
      layout: lines?.layout === 'table' ? 'table' : 'stacked',
      columns: columns.includes('name') ? columns : [...columns, 'name'],
      show_trace: lines?.show_trace ?? true,
      show_conversion: lines?.show_conversion ?? true,
      ...(lines?.ruling !== undefined ? { ruling: lines.ruling } : {}),
      ...(lines?.timed_style !== undefined ? { timed_style: lines.timed_style } : {}),
    };
  }
  if (rules.totals) result.totals = fields(source.totals, rules.totals, LOCKED_TOTALS);
  if (rules.payments) {
    const paymentsBase: PaymentsSection = fields(source.payments, rules.payments);
    if (source.payments?.qr_size !== undefined) paymentsBase.qr_size = source.payments.qr_size;
    if (source.payments?.qr_caption !== undefined)
      paymentsBase.qr_caption = source.payments.qr_caption;
    result.payments = paymentsBase;
  }
  if (rules.einvoice) {
    const einvoiceBase: EinvoiceSection = {
      fields: Array.isArray(source.einvoice?.fields) ? [...source.einvoice.fields] : [],
      labels: { ...(source.einvoice?.labels ?? {}) },
    };
    if (source.einvoice?.qr_size !== undefined) einvoiceBase.qr_size = source.einvoice.qr_size;
    if (source.einvoice?.qr_caption !== undefined)
      einvoiceBase.qr_caption = source.einvoice.qr_caption;
    result.einvoice = einvoiceBase;
  }
  return result;
}
