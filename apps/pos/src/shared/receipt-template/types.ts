// A print template describes how a document is laid out, never what it
// says: amounts, lines and names come from the receipt snapshot or the
// open order as the server reported them. The header and footer are
// ordered blocks; information, lines, totals, payments and e-invoice are
// fixed sections whose fields can only be switched off or relabelled.

export type PaperSize = '58mm' | '80mm' | 'a4' | 'a5' | 'a6';

export const PAPER_SIZES: readonly PaperSize[] = ['58mm', '80mm', 'a4', 'a5', 'a6'];

// The documents a receipt template lays out.
export type ReceiptDocumentType =
  | 'sale'
  | 'prebill'
  | 'payment_ticket'
  | 'return'
  | 'refund'
  | 'shift_closure';

export const RECEIPT_DOCUMENT_TYPES: readonly ReceiptDocumentType[] = [
  'sale',
  'prebill',
  'payment_ticket',
  'return',
  'refund',
  'shift_closure',
];

// Every kind of template the store keeps. A product label shares the
// template store but not the receipt layout: its config and paper stocks
// are in `../product-label`.
export type DocumentType = ReceiptDocumentType | 'product_label';

export const DOCUMENT_TYPES: readonly DocumentType[] = [...RECEIPT_DOCUMENT_TYPES, 'product_label'];

export const isReceiptDocumentType = (value: unknown): value is ReceiptDocumentType =>
  (RECEIPT_DOCUMENT_TYPES as readonly unknown[]).includes(value);

export type Align = 'left' | 'center' | 'right';
export type TextSize = 's' | 'm' | 'l';
export type TitleSize = 'm' | 'l' | 'xl';
export type PageMargins = { top: number; right: number; bottom: number; left: number };
export type TableStyle = 'one_line' | 'two_lines';
export type TimeFormat = 'datetime' | 'date';
export type LineRuling = 'none' | 'rows' | 'grid';
export type TimedStyle = 'duration' | 'range';
export type QrSize = 's' | 'm' | 'l';
export type QrCaptionPosition = 'below' | 'above' | 'left' | 'right';

export type BusinessField =
  | 'name'
  | 'branch'
  | 'address'
  | 'phone'
  | 'email'
  | 'tax_code'
  | 'description'
  | 'url'
  | 'facebook'
  | 'instagram';

// `monochrome` prints the logo in black and white, for thermal paper.
export type LogoBlock = { type: 'logo'; width_pct?: number; align?: Align; monochrome?: boolean };
export type BusinessBlock = { type: 'business'; fields: BusinessField[]; align?: Align };
export type TextBlock = {
  type: 'text';
  value: string;
  align?: Align;
  bold?: boolean;
  size?: TextSize;
};
// The document title and number. Always printed: a template without one
// gets it appended to its header.
export type TitleBlock = { type: 'title'; label?: string; size?: TitleSize };
export type DividerBlock = { type: 'divider'; style?: 'solid' | 'dashed' };
export type SpacerBlock = { type: 'spacer'; mm?: number };

// The store pages a QR code can link to, read from the store when printing.
export type SocialField = 'url' | 'facebook' | 'instagram';
export type QrBlock =
  | { type: 'qr'; source: 'url'; value: string; caption?: string; align?: Align }
  | { type: 'qr'; source: 'store_social'; field: SocialField; caption?: string; align?: Align };
// The document number as a Code 128 barcode, for the scanners at the counter.
export type BarcodeBlock = { type: 'barcode'; align?: Align };
export type SignatureParty = 'buyer' | 'seller' | 'cashier';
// Signature boxes; printed on A4 and A5 sheets only.
export type SignaturesBlock = {
  type: 'signatures';
  parties: SignatureParty[];
  labels?: Partial<Record<SignatureParty, string>>;
};

export type TemplateBlock =
  | LogoBlock
  | BusinessBlock
  | TextBlock
  | TitleBlock
  | DividerBlock
  | SpacerBlock
  | QrBlock
  | BarcodeBlock
  | SignaturesBlock;

export type MetaField =
  | 'time'
  | 'cashier'
  | 'register'
  | 'branch'
  | 'order_number'
  | 'return_number'
  | 'customer'
  | 'table'
  | 'check_in'
  | 'check_out'
  | 'duration'
  | 'call_number'
  | 'order_source'
  | 'printed_at'
  | 'print_count';

export type LineColumn =
  | 'index'
  | 'name'
  | 'sku'
  | 'barcode'
  | 'unit'
  | 'qty'
  | 'original_price'
  | 'price'
  | 'discount'
  | 'amount'
  | 'note';

export type TotalField =
  | 'item_count'
  | 'item_total'
  | 'discount'
  | 'promotions'
  | 'shipping'
  | 'fees'
  | 'tax'
  | 'included_tax'
  | 'total';

export type PaymentField =
  | 'methods'
  | 'handed'
  | 'change'
  | 'reference'
  | 'paid_total'
  | 'debt'
  | 'previous_debt'
  | 'customer_debt'
  | 'due_on'
  // The pay-later VietQR of a debt; its label is the caption under the code.
  | 'pay_qr'
  // The store's bank transfer VietQR; its label is the caption of the code.
  | 'transfer_qr';

export type EinvoiceField =
  | 'seller_tax_code'
  | 'number'
  | 'lookup_code'
  | 'cqt_code'
  | 'qr'
  | 'lookup_url';

export type FieldSection<F extends string> = {
  fields: F[];
  labels?: Partial<Record<F, string>>;
};

export type MetaSection = FieldSection<MetaField> & {
  table_style?: TableStyle;
  time_format?: TimeFormat;
};

export type LinesSection = {
  layout: 'stacked' | 'table';
  columns: LineColumn[];
  show_trace: boolean;
  show_conversion: boolean;
  ruling?: LineRuling;
  timed_style?: TimedStyle;
};

export type PaymentsSection = FieldSection<PaymentField> & {
  qr_size?: QrSize;
  qr_caption?: QrCaptionPosition;
};

export type EinvoiceSection = FieldSection<EinvoiceField> & {
  qr_size?: QrSize;
  qr_caption?: QrCaptionPosition;
};

export type PageSettings = {
  // Legacy single margin kept so older saved templates stay valid; unused when printing.
  margin_mm: number;
  // Four-side page margins in millimetres (0–15). Only applied when set.
  margins?: PageMargins;
  // Extra paper fed before the cutter on thermal rolls (0–30 mm).
  cut_feed_mm?: number;
  font: 'sans' | 'mono';
  font_size: TextSize;
  line_spacing: number;
  // Sale receipts only: the original and up to two copies with one press.
  copies?: number;
  // Label stock of a server-built label (cup labels); templates never set it.
  label?: { width_mm: number; height_mm: number };
};

// Schema 1. A section a document type has no data for (lines of a shift
// closure) is left out; a missing section prints everything it has.
export type TemplateConfig = {
  schema: 1;
  page: PageSettings;
  header: TemplateBlock[];
  meta?: MetaSection;
  lines?: LinesSection;
  totals?: FieldSection<TotalField>;
  payments?: PaymentsSection;
  einvoice?: EinvoiceSection;
  footer: TemplateBlock[];
};

// ---- The resolved document: text, images and layout only. ----

export type PrintRow = { label: string; value: string; strong?: boolean };

export type PrintBlock =
  // `invert`: white on black, set by the server on kitchen ticket notes.
  | { kind: 'text'; lines: string[]; align: Align; bold: boolean; size: TextSize; invert?: boolean }
  | {
      kind: 'image';
      src: string;
      alt: string;
      widthPct: number;
      align: Align;
      monochrome: boolean;
    }
  | { kind: 'qr'; value: string; caption: string | null; align: Align }
  | { kind: 'barcode'; value: string; align: Align }
  | { kind: 'signatures'; parties: { party: SignatureParty; label: string }[] }
  | { kind: 'title'; title: string; number: string | null; size?: TitleSize }
  | { kind: 'divider'; style: 'solid' | 'dashed' }
  | { kind: 'spacer'; mm: number };

export type PrintStackedLine = {
  index: number | null;
  name: string;
  amount: string | null;
  originalPrice?: string | null;
  details: string[];
};

export type PrintTableColumn = { key: 'qty' | 'price' | 'discount' | 'amount'; label: string };
// Headings of the ruled table a sheet prints the lines in.
export type PrintTableHeadings = { index: string | null; name: string };
export type PrintTableRow = {
  index: number | null;
  name: string;
  cells: string[];
  originalPrice?: string | null;
  details: string[];
};

export type PrintLines =
  | { layout: 'stacked'; ruling?: LineRuling; items: PrintStackedLine[] }
  | {
      layout: 'table';
      ruling?: LineRuling;
      headings: PrintTableHeadings;
      columns: PrintTableColumn[];
      rows: PrintTableRow[];
    };

export type PrintQr = {
  value: string;
  caption: string;
  lines: string[];
  size?: QrSize;
  captionPosition?: QrCaptionPosition;
};

export type PrintPayQr = PrintQr;

export type PrintEinvoice = {
  rows: PrintRow[];
  qr: PrintQr | null;
};

export type PrintDocument = {
  documentType: ReceiptDocumentType;
  page: PageSettings;
  // "BẢN SAO", "TẠM TÍNH – CHƯA THANH TOÁN", test print: never removable.
  banners: string[];
  header: PrintBlock[];
  meta: PrintRow[];
  lines: PrintLines;
  totals: PrintRow[];
  payments: PrintRow[];
  // The bank QR for what is still owed, printed under the payments.
  payQr: PrintPayQr | null;
  // Optional transfer VietQR on sales, pre-bills and payment tickets.
  transferQr?: PrintQr | null;
  // Structured e-invoice block on sales when the template enables it.
  einvoice?: PrintEinvoice | null;
  notes: string[];
  footer: PrintBlock[];
  disclaimer: string | null;
};

export type PrintJobKind =
  | 'receipt'
  | 'prebill'
  | 'kitchen_ticket'
  | 'void_ticket'
  | 'ready_ticket'
  | 'cup_label'
  | 'checklist'
  | 'table_qr'
  | 'test';

// A document as the server queues it. A test page has no document type.
export type PrintJobDocument = Omit<PrintDocument, 'documentType'> & {
  version: 1;
  kind: PrintJobKind;
  documentType: ReceiptDocumentType | null;
};
