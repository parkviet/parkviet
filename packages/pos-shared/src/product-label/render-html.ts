import { QUIET_ZONE } from '../receipt-template/code128';
import { escapeHtml } from '../receipt-template/sheet-html';
import type { LabelCell, LabelRow, LabelSheet } from './render';
import type { ProductLabelConfig, ProductLabelPreset } from './types';

// The markup of a laid-out label sheet: one self-contained document (its CSS
// inline) that the editor shows in a frame and the browser prints. Every
// sticker is placed in millimetres from the stock's grid, so at 100% print
// scale it lands on the physical sticker. Text is escaped: names and
// captions are typed in by the store.

const mm = (value: number): string => `${Number(value.toFixed(2))}mm`;
const num = (value: number): string => String(Number(value.toFixed(3)));

// The CSS page size name of a sheet stock: A5 sheets are 148mm wide.
const sheetPageName = (preset: ProductLabelPreset): string =>
  preset.kind === 'sheet' && preset.sheet_mm.width === 148 ? 'A5' : 'A4';

// The page's width and height in mm.
function pageSize(preset: ProductLabelPreset): { width: number; height: number } {
  return preset.kind === 'roll'
    ? { width: preset.roll_width_mm, height: preset.label_mm.height }
    : preset.sheet_mm;
}

// Where a cell's sticker sits on its page, in mm.
function cellOrigin(preset: ProductLabelPreset, cell: LabelCell): { left: number; top: number } {
  const stepX = preset.label_mm.width + preset.gap_mm.x;
  if (preset.kind === 'roll') {
    const used = preset.columns * preset.label_mm.width + (preset.columns - 1) * preset.gap_mm.x;
    return { left: (preset.roll_width_mm - used) / 2 + cell.column * stepX, top: 0 };
  }
  return {
    left: preset.sheet_margin_mm.left + cell.column * stepX,
    top: preset.sheet_margin_mm.top + cell.row * (preset.label_mm.height + preset.gap_mm.y),
  };
}

function barcodeSvg(row: LabelRow, barHeightMm: number): string {
  const code = row.barcode;
  if (!code || code.kind !== 'bars') return '';
  const total = code.modules + QUIET_ZONE * 2;
  const bars = code.bars
    .map((bar) => `<rect x="${QUIET_ZONE + bar.x}" y="0" width="${bar.width}" height="1"/>`)
    .join('');
  return (
    `<svg class="bars" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} 1" ` +
    `preserveAspectRatio="none" width="${mm(total * code.moduleMm)}" height="${mm(barHeightMm)}" ` +
    `style="width:${mm(total * code.moduleMm)};height:${mm(barHeightMm)}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="${escapeHtml(code.value)}">${bars}</svg>`
  );
}

function rowHtml(row: LabelRow, barHeightMm: number): string {
  const caption = row.caption ? `<span class="cap">${escapeHtml(row.caption)} </span>` : '';
  switch (row.key) {
    case 'barcode': {
      const bars = barcodeSvg(row, barHeightMm);
      const text = row.showText ? `<div class="code">${escapeHtml(row.text)}</div>` : '';
      return `<div class="row barcode">${bars}${text}</div>`;
    }
    case 'product_name':
      return `<div class="row name" style="-webkit-line-clamp:${row.maxLines ?? 1};line-clamp:${row.maxLines ?? 1}">${escapeHtml(row.text)}</div>`;
    case 'price':
      return `<div class="row price">${caption}${escapeHtml(row.text)}</div>`;
    case 'original_price':
      return `<div class="row original">${escapeHtml(row.text)}</div>`;
    default:
      return `<div class="row ${row.key.replace('_', '-')}">${caption}${escapeHtml(row.text)}</div>`;
  }
}

function labelHtml(
  config: ProductLabelConfig,
  preset: ProductLabelPreset,
  cell: LabelCell,
  barHeightMm: number,
): string {
  const { left, top } = cellOrigin(preset, cell);
  const { margins } = config.page;
  const style =
    `left:${mm(left)};top:${mm(top)};width:${mm(preset.label_mm.width)};` +
    `height:${mm(preset.label_mm.height)};padding:${mm(margins.top)} ${mm(margins.right)} ${mm(margins.bottom)} ${mm(margins.left)}`;
  const rows = cell.label.rows.map((row) => rowHtml(row, barHeightMm)).join('');
  return `<div class="label" data-variant="${escapeHtml(cell.label.variantId)}" style="${style}">${rows}</div>`;
}

export type LabelHtmlOptions = {
  title?: string;
  // Gray page background and a shadow under each sheet, for the editor's frame.
  preview?: boolean;
};

function styles(config: ProductLabelConfig, preset: ProductLabelPreset, preview: boolean): string {
  const size = pageSize(preset);
  const pageRule =
    preset.kind === 'roll'
      ? `size:${mm(size.width)} ${mm(size.height)};margin:0`
      : `size:${sheetPageName(preset)};margin:0`;
  const fontSize = config.page.font_size;
  const lines = [
    `@page{${pageRule}}`,
    '*{box-sizing:border-box}',
    'html,body{margin:0;padding:0}',
    `body{font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;color:#000;font-size:${num(fontSize)}pt;line-height:1.15;-webkit-print-color-adjust:exact;print-color-adjust:exact}`,
    `.page{position:relative;width:${mm(size.width)};height:${mm(size.height)};overflow:hidden;break-after:page;page-break-after:always}`,
    '.page:last-child{break-after:auto;page-break-after:auto}',
    '.label{position:absolute;overflow:hidden;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}',
    '.row{max-width:100%;overflow:hidden}',
    '.name{font-weight:700;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',
    '.cap{font-weight:400}',
    '.barcode{display:flex;flex-direction:column;align-items:center}',
    '.bars{display:block;fill:#000;max-width:100%}',
    '.code{font-size:.85em;letter-spacing:.04em;white-space:nowrap}',
    '.price{font-weight:700;font-size:1.35em;white-space:nowrap}',
    '.original{text-decoration:line-through;white-space:nowrap}',
    '.variant-options,.store-name,.store-address,.sku,.unit,.printed-date{white-space:nowrap;text-overflow:ellipsis}',
  ];
  if (preview) {
    lines.push(
      '@media screen{body{background:#e5e7eb;padding:8px}.page{margin:0 auto 12px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3)}.label{outline:1px dashed #cbd5e1}}',
    );
  }
  return lines.join('\n');
}

// The document of `sheet`: a page element per roll row or per sheet, each
// holding its stickers placed from the stock's grid.
export function renderLabelsHtml(
  config: ProductLabelConfig,
  sheet: LabelSheet,
  options: LabelHtmlOptions = {},
): string {
  const { preset } = sheet;
  const barHeightMm = Math.round(Math.min(10, Math.max(5, preset.label_mm.height * 0.3)) * 10) / 10;
  const pages = sheet.pages
    .map(
      (page) =>
        `<section class="page">${page.cells.map((cell) => labelHtml(config, preset, cell, barHeightMm)).join('')}</section>`,
    )
    .join('');
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<title>${escapeHtml(options.title ?? 'Labels')}</title>` +
    `<style>${styles(config, preset, options.preview === true)}</style></head>` +
    `<body data-paper="${escapeHtml(preset.code)}">${pages}</body></html>`
  );
}
