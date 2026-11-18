import type { PaperSize } from './receipt-template/types';

// Every size a posted receipt can print on: thermal rolls first, then sheets.
export const ROLL_PAPER_SIZES: readonly PaperSize[] = ['58mm', '80mm'];
export const SHEET_PAPER_SIZES: readonly PaperSize[] = ['a4', 'a5', 'a6'];
export const PAPER_SIZES: readonly PaperSize[] = [...ROLL_PAPER_SIZES, ...SHEET_PAPER_SIZES];

export const isPaperSize = (value: unknown): value is PaperSize =>
  typeof value === 'string' && (PAPER_SIZES as readonly string[]).includes(value);

export const isRollPaper = (value: unknown): value is '58mm' | '80mm' =>
  value === '58mm' || value === '80mm';

export const isSheetPaper = (value: unknown): value is 'a4' | 'a5' | 'a6' =>
  value === 'a4' || value === 'a5' || value === 'a6';
