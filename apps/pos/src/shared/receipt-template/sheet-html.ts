import { encode } from 'uqr';
import { barcodeWidthMm, code128Bars, QUIET_ZONE } from './code128';
import type {
  Align,
  PageMargins,
  PaperSize,
  PrintBlock,
  PrintDocument,
  PrintEinvoice,
  PrintLines,
  PrintQr,
  PrintRow,
  SignatureParty,
  TextSize,
} from './types';
import { charsPerLine, PRINTABLE_WIDTH_MM, WIDE_PAPERS } from './validate';

// The one renderer of a printed sheet: the POS prints this markup and the
// administration preview shows it in a frame, so both are the same by
// construction. Pure string output (no DOM); every text and attribute value
// is escaped, since templates carry text the store typed in.

export const DEFAULT_LINE_SPACING = 1.35;

// How the sheet is laid out: the paper decides sheet-only blocks and the
// line table; `markOverflow` (editor preview only) underlines the part of a
// header or footer text line past the estimated roll width. Prints never do.
export type SheetLayout = { paper: PaperSize; markOverflow?: boolean };

// The attributes of the sheet element itself.
export type SheetElement = SheetLayout & { testId: string; printId?: string | null };

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

// Safe in text content and in double-quoted attribute values alike.
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

type Attribute = string | number | null | undefined | false;

// ` name="value"` for every set attribute, in the order given.
function attrs(list: [string, Attribute][]): string {
  return list
    .filter((entry): entry is [string, string | number] => {
      const value = entry[1];
      return value !== null && value !== undefined && value !== false;
    })
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');
}

const el = (tag: string, list: [string, Attribute][], inner: string) =>
  `<${tag}${attrs(list)}>${inner}</${tag}>`;

const classes = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ') || null;

const alignClass = (align: string) => (align === 'center' ? null : `receipt-align-${align}`);

// The dark modules of a QR code as one SVG path, a row run at a time.
export function qrPath(value: string): { size: number; path: string } | null {
  try {
    const { size, data } = encode(value, { ecc: 'M', border: 4 });
    const parts: string[] = [];
    data.forEach((row, y) => {
      let x = 0;
      while (x < size) {
        if (!row[x]) {
          x += 1;
          continue;
        }
        const start = x;
        while (x < size && row[x]) x += 1;
        parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
      }
    });
    return { size, path: parts.join('') };
  } catch {
    // Too long to encode: the block is left off rather than break the print.
    return null;
  }
}

// A printed QR code, generated here: nothing is sent to a QR service.
function qrHtml(value: string, caption: string | null, align: Align): string {
  const code = qrPath(value);
  if (!code) return '';
  const svg = el(
    'svg',
    [
      ['viewBox', `0 0 ${code.size} ${code.size}`],
      ['shape-rendering', 'crispEdges'],
      ['role', 'img'],
      ['aria-label', caption ?? value],
    ],
    `<path${attrs([
      ['d', code.path],
      ['fill', '#000'],
    ])}></path>`,
  );
  return el(
    'figure',
    [
      ['class', `receipt-qr receipt-code-${align}`],
      ['data-qr-value', value],
    ],
    svg + (caption ? el('figcaption', [], escapeHtml(caption)) : ''),
  );
}

// The document number as a Code 128 barcode with the number printed under
// it. Left off when the paper is too narrow for bars a scanner can read.
function barcodeHtml(value: string, align: Align, paper: PaperSize): string {
  const code = code128Bars(value);
  const widthMm = barcodeWidthMm(value, PRINTABLE_WIDTH_MM[paper]);
  if (!code || widthMm === null) return '';
  const width = code.modules + QUIET_ZONE * 2;
  const bars = code.bars
    .map(
      (bar) =>
        `<rect${attrs([
          ['x', bar.x + QUIET_ZONE],
          ['y', 0],
          ['width', bar.width],
          ['height', 30],
          ['fill', '#000'],
        ])}></rect>`,
    )
    .join('');
  const svg = el(
    'svg',
    [
      ['viewBox', `0 0 ${width} 30`],
      ['preserveAspectRatio', 'none'],
      ['shape-rendering', 'crispEdges'],
      ['style', `width:${widthMm.toFixed(1)}mm`],
      ['role', 'img'],
      ['aria-label', value],
    ],
    bars,
  );
  return el(
    'figure',
    [
      ['class', `receipt-barcode receipt-code-${align}`],
      ['data-barcode-value', value],
    ],
    svg + el('figcaption', [], escapeHtml(value)),
  );
}

// Signature boxes side by side, each with room to sign under its label.
function signaturesHtml(parties: { party: SignatureParty; label: string }[]): string {
  return el(
    'div',
    [
      ['class', 'receipt-signatures'],
      ['style', `grid-template-columns:repeat(${parties.length}, minmax(0, 1fr))`],
    ],
    parties
      .map(({ label }) =>
        el('div', [['class', 'receipt-signature']], el('strong', [], escapeHtml(label))),
      )
      .join(''),
  );
}

// A text line with the part past the line width underlined.
function textLineHtml(line: string, limit: number | null): string {
  if (limit === null || line.length <= limit) return escapeHtml(line);
  return (
    escapeHtml(line.slice(0, limit)) +
    el(
      'span',
      [
        ['class', 'receipt-overflow'],
        ['data-testid', 'receipt-overflow'],
      ],
      escapeHtml(line.slice(limit)),
    )
  );
}

function blockHtml(
  block: PrintBlock,
  layout: SheetLayout,
  fontSize: TextSize,
  margins?: PageMargins | null,
): string {
  switch (block.kind) {
    case 'text': {
      const className = classes(
        alignClass(block.align),
        block.bold && 'receipt-bold',
        block.size !== 'm' && `receipt-size-${block.size}`,
      );
      const limit = layout.markOverflow
        ? charsPerLine(layout.paper, fontSize, block.size, margins)
        : null;
      return block.lines
        .map((line) => el('p', [['class', className]], textLineHtml(line, limit)))
        .join('');
    }
    case 'image':
      return el(
        'p',
        [
          [
            'class',
            classes(
              'receipt-logo',
              alignClass(block.align),
              block.monochrome && 'receipt-logo-mono',
            ),
          ],
        ],
        `<img${attrs([
          ['src', block.src],
          ['alt', block.alt],
          ['style', `width:${block.widthPct}%`],
        ])}/>`,
      );
    case 'title':
      return (
        el(
          'h2',
          [['class', block.size && block.size !== 'l' ? `receipt-title-${block.size}` : null]],
          escapeHtml(block.title),
        ) + (block.number ? el('p', [['class', 'receipt-number']], escapeHtml(block.number)) : '')
      );
    case 'divider':
      return el('div', [['class', `receipt-divider receipt-divider-${block.style}`]], '');
    case 'spacer':
      return el(
        'div',
        [
          ['class', 'receipt-spacer'],
          ['style', `height:${block.mm}mm`],
        ],
        '',
      );
    case 'qr':
      return qrHtml(block.value, block.caption, block.align);
    case 'barcode':
      return barcodeHtml(block.value, block.align, layout.paper);
    case 'signatures':
      return WIDE_PAPERS.includes(layout.paper) ? signaturesHtml(block.parties) : '';
  }
}

function rowsHtml(rows: PrintRow[], className: string): string {
  if (rows.length === 0) return '';
  return el(
    'dl',
    [['class', className]],
    rows
      .map((row) =>
        el(
          'div',
          [['class', row.strong ? 'receipt-strong' : null]],
          el('dt', [], escapeHtml(row.label)) + el('dd', [], escapeHtml(row.value)),
        ),
      )
      .join(''),
  );
}

const numbered = (index: number | null, name: string) =>
  index === null ? name : `${index}. ${name}`;

const th = (label: string, className: string | null = null) =>
  el(
    'th',
    [
      ['scope', 'col'],
      ['class', className],
    ],
    escapeHtml(label),
  );

const cellsHtml = (cells: string[], priceIndex = -1, originalPrice?: string | null) =>
  cells
    .map((cell, idx) =>
      el(
        'td',
        [],
        (idx === priceIndex && originalPrice
          ? el('del', [['class', 'receipt-original-price']], escapeHtml(originalPrice))
          : '') + escapeHtml(cell),
      ),
    )
    .join('');

// The lines of a table template on an A4 or A5 sheet: one ruled row per
// line, the line number and every column in its own cell.
function sheetTableHtml(lines: Extract<PrintLines, { layout: 'table' }>): string {
  const { headings } = lines;
  const hasIndex = headings.index !== null;
  const priceIndex = lines.columns.findIndex((column) => column.key === 'price');
  const head = el(
    'tr',
    [],
    (headings.index !== null ? th(headings.index, 'receipt-grid-index') : '') +
      th(headings.name, 'receipt-grid-name') +
      lines.columns.map((column) => th(column.label)).join(''),
  );
  const body = lines.rows
    .map((row) =>
      el(
        'tr',
        [],
        (hasIndex ? el('td', [['class', 'receipt-grid-index']], escapeHtml(row.index ?? '')) : '') +
          el(
            'td',
            [['class', 'receipt-grid-name']],
            escapeHtml(row.name) +
              (priceIndex < 0 && row.originalPrice
                ? el(
                    'small',
                    [],
                    el('del', [['class', 'receipt-original-price']], escapeHtml(row.originalPrice)),
                  )
                : '') +
              row.details.map((detail) => el('small', [], escapeHtml(detail))).join(''),
          ) +
          cellsHtml(row.cells, priceIndex, row.originalPrice),
      ),
    )
    .join('');
  return el(
    'table',
    [['class', classes('receipt-grid', lines.ruling && `receipt-ruling-${lines.ruling}`)]],
    el('thead', [], head) + el('tbody', [], body),
  );
}

function linesHtml(lines: PrintLines, paper: PaperSize): string {
  const rulingClass = lines.ruling ? `receipt-ruling-${lines.ruling}` : null;
  if (lines.layout === 'table') {
    if (lines.rows.length === 0) return '';
    if (WIDE_PAPERS.includes(paper)) return sheetTableHtml(lines);
    const span = Math.max(lines.columns.length, 1);
    const hasColumns = lines.columns.length > 0;
    const priceIndex = lines.columns.findIndex((column) => column.key === 'price');
    const head = hasColumns
      ? el('thead', [], el('tr', [], lines.columns.map((column) => th(column.label)).join('')))
      : '';
    const fullRow = (className: string, text: string) =>
      el('tr', [['class', className]], el('td', [['colspan', span]], escapeHtml(text)));
    const bodies = lines.rows
      .map((row) =>
        el(
          'tbody',
          [],
          fullRow('ticket-name', numbered(row.index, row.name)) +
            (priceIndex < 0 && row.originalPrice
              ? el(
                  'tr',
                  [['class', 'ticket-detail']],
                  el(
                    'td',
                    [['colspan', span]],
                    el('del', [['class', 'receipt-original-price']], escapeHtml(row.originalPrice)),
                  ),
                )
              : '') +
            row.details.map((detail) => fullRow('ticket-detail', detail)).join('') +
            (hasColumns
              ? el(
                  'tr',
                  [['class', 'ticket-figures']],
                  cellsHtml(row.cells, priceIndex, row.originalPrice),
                )
              : ''),
        ),
      )
      .join('');
    return el('table', [['class', classes('ticket-table', rulingClass)]], head + bodies);
  }
  if (lines.items.length === 0) return '';
  return el(
    'ol',
    [['class', classes('receipt-lines', rulingClass)]],
    lines.items
      .map((line) =>
        el(
          'li',
          [],
          el(
            'div',
            [['class', 'receipt-line-head']],
            el('span', [], escapeHtml(numbered(line.index, line.name))) +
              (line.amount !== null
                ? el('span', [['class', 'receipt-money']], escapeHtml(line.amount))
                : ''),
          ) +
            (line.originalPrice
              ? el(
                  'p',
                  [['class', 'receipt-line-detail receipt-original-line']],
                  el('del', [['class', 'receipt-original-price']], escapeHtml(line.originalPrice)),
                )
              : '') +
            line.details
              .map((detail) => el('p', [['class', 'receipt-line-detail']], escapeHtml(detail)))
              .join(''),
        ),
      )
      .join(''),
  );
}

function styledQrHtml(qr: PrintQr, paper: PaperSize, baseClass: string, testId: string): string {
  const rawPos = qr.captionPosition;
  const pos = paper === '58mm' && (rawPos === 'left' || rawPos === 'right') ? 'below' : rawPos;
  if (baseClass === 'receipt-pay-qr' && qr.size === undefined && pos === undefined) {
    return el(
      'section',
      [
        ['class', 'receipt-pay-qr'],
        ['data-testid', testId],
      ],
      qrHtml(qr.value, qr.caption, 'center') +
        qr.lines.map((line) => el('p', [], escapeHtml(line))).join(''),
    );
  }
  const code = qrPath(qr.value);
  if (!code) return '';
  const svg = el(
    'svg',
    [
      ['viewBox', `0 0 ${code.size} ${code.size}`],
      ['shape-rendering', 'crispEdges'],
      ['role', 'img'],
      ['aria-label', qr.caption || qr.value],
    ],
    `<path${attrs([
      ['d', code.path],
      ['fill', '#000'],
    ])}></path>`,
  );
  const textContent =
    (qr.caption ? el('p', [['class', 'receipt-qr-caption']], escapeHtml(qr.caption)) : '') +
    qr.lines.map((line) => el('p', [], escapeHtml(line))).join('');
  return el(
    'section',
    [
      [
        'class',
        classes(
          baseClass,
          'receipt-qr-box',
          qr.size && qr.size !== 'm' && `receipt-qr-size-${qr.size}`,
          `receipt-qr-caption-${pos ?? 'below'}`,
        ),
      ],
      ['data-testid', testId],
      ['data-qr-value', qr.value],
    ],
    svg + (textContent ? el('div', [['class', 'receipt-qr-text']], textContent) : ''),
  );
}

function einvoiceHtml(einvoice: PrintEinvoice | null | undefined, paper: PaperSize): string {
  if (!einvoice) return '';
  const rows = rowsHtml(einvoice.rows, 'receipt-einvoice-rows');
  const qr = einvoice.qr
    ? styledQrHtml(einvoice.qr, paper, 'receipt-einvoice-qr', 'receipt-einvoice-qr')
    : '';
  if (!rows && !qr) return '';
  return el(
    'section',
    [
      ['class', 'receipt-einvoice'],
      ['data-testid', 'receipt-einvoice'],
    ],
    rows + qr,
  );
}

// The class list of the sheet element: paper, document kind, font and scale.
export function sheetClassName(document: PrintDocument, paper: PaperSize): string {
  const { page } = document;
  return [
    'receipt-sheet',
    document.documentType === 'payment_ticket' && 'invoice-ticket',
    `receipt-${paper}`,
    page.margins && 'receipt-custom-margins',
    page.font === 'mono' && 'receipt-font-mono',
    page.font_size !== 'm' && `receipt-scale-${page.font_size}`,
  ]
    .filter(Boolean)
    .join(' ');
}

// The line height the sheet sets inline; null keeps the stylesheet's own.
export function sheetLineHeight(document: PrintDocument): number | null {
  const spacing = document.page.line_spacing;
  return spacing === DEFAULT_LINE_SPACING ? null : spacing;
}

function sheetStyle(document: PrintDocument): string | null {
  const parts: string[] = [];
  const lineHeight = sheetLineHeight(document);
  if (lineHeight !== null) parts.push(`line-height:${lineHeight}`);
  const m = document.page.margins;
  if (m) parts.push(`padding:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`);
  return parts.length > 0 ? parts.join(';') : null;
}

// The inside of the sheet element: banners, header, rows, lines, pay QR,
// transfer QR, e-invoice, notes, footer and disclaimer.
export function renderSheetContentHtml(document: PrintDocument, layout: SheetLayout): string {
  const fontSize = document.page.font_size;
  const margins = document.page.margins;
  const blocks = (list: PrintBlock[]) =>
    list.map((block) => blockHtml(block, layout, fontSize, margins)).join('');
  const { payQr, transferQr, einvoice } = document;
  return [
    document.banners.map((banner) => el('p', [['class', 'receipt-banner']], escapeHtml(banner))),
    el('header', [['class', 'receipt-header']], blocks(document.header)),
    rowsHtml(document.meta, 'receipt-meta'),
    linesHtml(document.lines, layout.paper),
    rowsHtml(document.totals, 'receipt-totals'),
    rowsHtml(document.payments, 'receipt-payments'),
    payQr ? styledQrHtml(payQr, layout.paper, 'receipt-pay-qr', 'receipt-pay-qr') : '',
    transferQr
      ? styledQrHtml(transferQr, layout.paper, 'receipt-transfer-qr', 'receipt-transfer-qr')
      : '',
    einvoiceHtml(einvoice, layout.paper),
    document.notes.map((note) => el('p', [['class', 'receipt-note']], escapeHtml(note))),
    document.footer.length > 0
      ? el('footer', [['class', 'receipt-footer']], blocks(document.footer))
      : '',
    document.disclaimer
      ? el('p', [['class', 'receipt-disclaimer']], escapeHtml(document.disclaimer))
      : '',
  ]
    .flat()
    .join('');
}

// The whole sheet element, ready to place in a print root or a frame.
export function renderSheetHtml(document: PrintDocument, sheet: SheetElement): string {
  return el(
    'article',
    [
      ['class', sheetClassName(document, sheet.paper)],
      ['style', sheetStyle(document)],
      ['data-testid', sheet.testId],
      ['data-paper', sheet.paper],
      ['data-print-id', sheet.printId],
    ],
    renderSheetContentHtml(document, sheet),
  );
}
