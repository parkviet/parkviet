import type {
  PageSettings,
  PaperSize,
  ReceiptDocumentType,
  SignatureParty,
  TemplateBlock,
  TemplateConfig,
} from './types';

// The built-in template of every document type. They lay the documents out
// with the store address and phone when the store has them, plus F&B table
// and e-invoice fields on sales and pre-bills. The server keeps the same
// configs as its defaults; this copy prints when templates cannot be
// loaded. Plain JSON-compatible data only.

export const TEST_PRINT_BANNER = 'IN THỬ — KHÔNG CÓ GIÁ TRỊ';

const PAGE: PageSettings = { margin_mm: 3, font: 'sans', font_size: 'm', line_spacing: 1.35 };

const HEADER: TemplateBlock[] = [
  { type: 'business', fields: ['name', 'address', 'phone', 'branch'], align: 'center' },
  { type: 'text', value: '{register.name}', align: 'center' },
  { type: 'title' },
];

const POSTED_META = {
  fields: ['time', 'cashier', 'order_number', 'return_number', 'customer'],
  labels: {},
} satisfies TemplateConfig['meta'];

export const DEFAULT_TEMPLATES: Readonly<Record<ReceiptDocumentType, TemplateConfig>> = {
  sale: {
    schema: 1,
    page: PAGE,
    // A counter-service sale prints its call number large; the line is
    // left out when the order has none.
    header: [
      ...HEADER,
      {
        type: 'text',
        value: 'Số gọi {order.call_number}',
        align: 'center',
        bold: true,
        size: 'l',
      },
    ],
    meta: {
      fields: [
        'time',
        'table',
        'check_in',
        'check_out',
        'cashier',
        'order_number',
        'return_number',
        'customer',
      ],
      labels: {},
    },
    lines: {
      layout: 'stacked',
      columns: ['name', 'sku', 'unit', 'qty', 'price', 'discount', 'amount'],
      show_trace: true,
      show_conversion: true,
    },
    totals: {
      fields: ['item_total', 'discount', 'shipping', 'tax', 'included_tax', 'total'],
      labels: {},
    },
    payments: {
      fields: [
        'methods',
        'handed',
        'change',
        'reference',
        'paid_total',
        'debt',
        'due_on',
        'pay_qr',
      ],
      labels: {},
    },
    einvoice: {
      fields: ['number', 'lookup_code', 'qr'],
      labels: {},
    },
    footer: [],
  },
  prebill: {
    schema: 1,
    page: PAGE,
    header: HEADER,
    meta: {
      fields: ['time', 'table', 'check_in', 'duration', 'customer'],
      labels: {},
      table_style: 'one_line',
    },
    lines: {
      layout: 'stacked',
      columns: ['name', 'unit', 'qty', 'price', 'amount'],
      show_trace: true,
      show_conversion: false,
    },
    totals: { fields: ['item_total', 'discount', 'shipping', 'total'], labels: {} },
    payments: {
      fields: ['paid_total', 'transfer_qr'],
      labels: {},
      qr_size: 'm',
      qr_caption: 'below',
    },
    footer: [],
  },
  payment_ticket: {
    schema: 1,
    page: PAGE,
    header: HEADER,
    meta: { fields: ['time', 'order_number', 'cashier', 'customer'], labels: {} },
    lines: {
      layout: 'table',
      columns: ['index', 'name', 'unit', 'qty', 'price', 'discount', 'amount'],
      show_trace: false,
      show_conversion: false,
    },
    totals: { fields: ['item_total', 'discount', 'shipping', 'tax', 'total'], labels: {} },
    payments: { fields: ['methods', 'handed', 'change'], labels: {} },
    footer: [
      { type: 'divider', style: 'dashed' },
      { type: 'text', value: 'Cảm ơn quý khách!', align: 'center', size: 's' },
    ],
  },
  return: {
    schema: 1,
    page: PAGE,
    header: HEADER,
    meta: POSTED_META,
    lines: {
      layout: 'stacked',
      columns: ['name', 'amount'],
      show_trace: false,
      show_conversion: false,
    },
    totals: { fields: ['total'], labels: {} },
    footer: [],
  },
  refund: {
    schema: 1,
    page: PAGE,
    header: HEADER,
    meta: POSTED_META,
    payments: { fields: ['methods', 'reference'], labels: {} },
    footer: [],
  },
  shift_closure: {
    schema: 1,
    page: PAGE,
    header: HEADER,
    meta: { fields: ['time', 'cashier'], labels: {} },
    footer: [],
  },
};

const SHEET_SIGNATURE_TYPES: readonly ReceiptDocumentType[] = [
  'sale',
  'return',
  'refund',
  'shift_closure',
];

// Built-in config tailored to `paper`: A4 and A5 sheets lay lines out in a
// numbered ruled table and append signature boxes on posted slips, matching
// `Spree::Pos::ReceiptTemplate.default_config`.
export function defaultTemplate(
  type: ReceiptDocumentType,
  paper: PaperSize = '80mm',
): TemplateConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES[type])) as TemplateConfig;
  if (paper !== 'a4' && paper !== 'a5') return base;

  if (base.lines) {
    const columns = base.lines.columns.includes('index')
      ? base.lines.columns
      : (['index', ...base.lines.columns] as typeof base.lines.columns);
    base.lines = {
      ...base.lines,
      layout: 'table',
      columns,
      ruling: paper === 'a4' ? 'grid' : 'rows',
    };
  }

  if (
    SHEET_SIGNATURE_TYPES.includes(type) &&
    base.footer.length < 8 &&
    !base.footer.some((block) => block.type === 'signatures')
  ) {
    const parties: SignatureParty[] =
      type === 'shift_closure' ? ['cashier', 'seller'] : ['buyer', 'seller'];
    base.footer = [...base.footer, { type: 'signatures', parties }];
  }

  return base;
}
