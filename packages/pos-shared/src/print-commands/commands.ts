import type {
  Align,
  PageSettings,
  PrintBlock,
  PrintDocument,
  PrintLines,
  PrintQr,
  PrintRow,
} from '../receipt-template/types';
import type { PrinterTarget } from '../types/print-adapter';

// A resolved document flattened to what a receipt printer does: lines of
// text, feeds, codes and a cut. Each printer language renders these and is
// responsible for escaping the text. Images are skipped: a logo needs a
// raster pipeline, and a receipt is complete without one.

export type PrintCommand =
  | { type: 'text'; text: string; align: Align; bold: boolean; large: boolean }
  | { type: 'feed'; lines: number }
  | { type: 'qr'; value: string; align: Align }
  | { type: 'barcode'; value: string; align: Align }
  | { type: 'cut' };

export type PrintableDocument = Omit<PrintDocument, 'documentType' | 'page'> & {
  page?: Partial<PageSettings>;
};

const COLUMNS: Record<PrinterTarget['paper'], number> = { '58mm': 32, '80mm': 48 };
const MM_PER_FEED = 4;
const MM_PER_COLUMN = 1.5;
const MIN_COLUMNS = 16;

export function printerColumns(printer: Pick<PrinterTarget, 'paper' | 'settings'>): number {
  const configured = printer.settings.char_width;
  return typeof configured === 'number' ? configured : COLUMNS[printer.paper];
}

// Control characters would break a line or reach the printer as commands.
// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
const clean = (value: string) => value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ');
const length = (value: string) => [...value].length;

export function wrapText(input: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of clean(input).split(' ').filter(Boolean)) {
    let rest = [...word];
    if (line && length(line) + 1 + rest.length <= width) {
      line = `${line} ${word}`;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    while (rest.length > width) {
      lines.push(rest.slice(0, width).join(''));
      rest = rest.slice(width);
    }
    line = rest.join('');
  }
  if (line) lines.push(line);
  return lines;
}

function pairLines(left: string, right: string, width: number): string[] {
  const label = clean(left).trim();
  const value = clean(right).trim();
  const gap = width - length(label) - length(value);
  if (gap >= 1) return [`${label}${' '.repeat(gap)}${value}`];
  const labelLines = wrapText(label, width);
  const valueLines = wrapText(value, width);
  return [...labelLines, ...valueLines.map((line) => `${' '.repeat(width - length(line))}${line}`)];
}

export function documentCommands(
  document: PrintableDocument,
  printer: Pick<PrinterTarget, 'paper' | 'settings'>,
): PrintCommand[] {
  const rawWidth = printerColumns(printer);
  const margins = document.page?.margins;
  const maxIndent = Math.max(0, rawWidth - MIN_COLUMNS);
  const rawLeft = margins ? Math.max(0, Math.round(margins.left / MM_PER_COLUMN)) : 0;
  const rawRight = margins ? Math.max(0, Math.round(margins.right / MM_PER_COLUMN)) : 0;
  const leftCols = Math.min(rawLeft, maxIndent);
  const rightCols = Math.min(rawRight, Math.max(0, maxIndent - leftCols));
  const width = Math.max(MIN_COLUMNS, rawWidth - leftCols - rightCols);
  const commands: PrintCommand[] = [];

  const padLine = (line: string, align: Align, large: boolean) => {
    if (leftCols === 0 && rightCols === 0) return line;
    const leftPad = large ? Math.floor(leftCols / 2) : leftCols;
    const rightPad = large ? Math.floor(rightCols / 2) : rightCols;
    if (align === 'left' && leftPad > 0) return `${' '.repeat(leftPad)}${line}`;
    if (align === 'right' && rightPad > 0) return `${line}${' '.repeat(rightPad)}`;
    return line;
  };

  const text = (line: string, align: Align = 'left', bold = false, large = false) =>
    commands.push({ type: 'text', text: padLine(line, align, large), align, bold, large });
  const wrapped = (value: string, align: Align = 'left', bold = false, large = false) => {
    for (const line of wrapText(value, large ? Math.floor(width / 2) : width))
      text(line, align, bold, large);
  };
  const row = ({ label, value, strong }: PrintRow) => {
    for (const line of pairLines(label, value, width)) text(line, 'left', strong === true);
  };
  const rule = (mark = '-') => text(mark.repeat(width));

  const printQr = (qr: PrintQr) => {
    if (qr.captionPosition === 'above') {
      if (qr.caption) wrapped(qr.caption, 'center');
      for (const line of qr.lines) wrapped(line, 'center');
      commands.push({ type: 'qr', value: qr.value, align: 'center' });
      return;
    }
    commands.push({ type: 'qr', value: qr.value, align: 'center' });
    if (qr.caption) wrapped(qr.caption, 'center');
    for (const line of qr.lines) wrapped(line, 'center');
  };

  const block = (item: PrintBlock) => {
    switch (item.kind) {
      case 'text':
        for (const line of item.lines) wrapped(line, item.align, item.bold, item.size === 'l');
        break;
      case 'title':
        wrapped(item.title, 'center', true, item.size !== 'm');
        if (item.number) wrapped(item.number, 'center', true);
        break;
      case 'qr':
        commands.push({ type: 'qr', value: item.value, align: item.align });
        if (item.caption) wrapped(item.caption, item.align);
        break;
      case 'barcode':
        commands.push({ type: 'barcode', value: item.value, align: item.align });
        break;
      case 'divider':
        rule(item.style === 'solid' ? '=' : '-');
        break;
      case 'spacer':
        commands.push({ type: 'feed', lines: Math.max(1, Math.round(item.mm / MM_PER_FEED)) });
        break;
      case 'signatures':
        for (const party of item.parties) {
          wrapped(party.label);
          commands.push({ type: 'feed', lines: 3 });
        }
        break;
      case 'image':
        break;
    }
  };

  const lines = (section: PrintLines) => {
    const ruled = section.ruling === 'rows' || section.ruling === 'grid';
    if (section.layout === 'stacked') {
      section.items.forEach((item, idx) => {
        if (ruled && idx > 0) rule('-');
        const name = item.index === null ? item.name : `${item.index}. ${item.name}`;
        if (item.amount === null) wrapped(name);
        else for (const line of pairLines(name, item.amount, width)) text(line);
        if (item.originalPrice) wrapped(`  Giá gốc ${item.originalPrice}`);
        for (const detail of item.details) wrapped(`  ${detail}`);
      });
      return;
    }
    if (section.columns.length > 0)
      wrapped(section.columns.map((column) => column.label).join(' | '), 'right', true);
    section.rows.forEach((item, idx) => {
      if (ruled && idx > 0) rule('-');
      wrapped(item.index === null ? item.name : `${item.index}. ${item.name}`);
      if (item.cells.length > 0) wrapped(item.cells.join(' | '), 'right');
      if (item.originalPrice) wrapped(`  Giá gốc ${item.originalPrice}`);
      for (const detail of item.details) wrapped(`  ${detail}`);
    });
  };

  const topFeed = margins && margins.top > 0 ? Math.round(margins.top / MM_PER_FEED) : 0;
  if (topFeed > 0) commands.push({ type: 'feed', lines: topFeed });

  for (const banner of document.banners) wrapped(banner, 'center', true);
  document.header.forEach(block);
  document.meta.forEach(row);
  rule();
  lines(document.lines);
  rule();
  document.totals.forEach(row);
  document.payments.forEach(row);
  if (document.payQr) printQr(document.payQr);
  if (document.transferQr) printQr(document.transferQr);
  if (document.einvoice) {
    rule();
    document.einvoice.rows.forEach(row);
    if (document.einvoice.qr) printQr(document.einvoice.qr);
  }
  for (const note of document.notes) wrapped(note);
  document.footer.forEach(block);
  if (document.disclaimer) wrapped(document.disclaimer, 'center');
  const bottomMm = (margins?.bottom ?? 0) + (document.page?.cut_feed_mm ?? 0);
  const extraFeed = bottomMm > 0 ? Math.round(bottomMm / MM_PER_FEED) : 0;
  commands.push({ type: 'feed', lines: 3 + extraFeed });
  if (printer.settings.cut !== false) commands.push({ type: 'cut' });
  return commands;
}
