import {
  barcodeWidthMm,
  code128Bars,
  MAX_BARCODE_LENGTH,
  MIN_MODULE_MM,
  MODULE_MM,
  QUIET_ZONE,
} from '../receipt-template/code128';
import type { LabelBarcodeSymbology } from './types';

// EAN-13 and the choice between it and Code 128 for a product label.

const LEFT_L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
] as const;
const LEFT_G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
] as const;
const RIGHT = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
] as const;
// Which left-hand set (L or G) each of the six left digits uses, by the first digit.
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
] as const;
const EAN13_MODULES = 95;

export type Bar = { x: number; width: number };

// The check digit of the first twelve digits.
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(twelve[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

// Thirteen digits whose last one is the right check digit.
export function isValidEan13(value: string): boolean {
  return /^\d{13}$/.test(value) && ean13CheckDigit(value) === Number(value[12]);
}

// The 95 modules (1 = bar, 0 = space) of a valid EAN-13, or null.
export function ean13Modules(value: string): string | null {
  if (!isValidEan13(value)) return null;
  const parity = PARITY[Number(value[0])];
  let modules = '101';
  for (let index = 0; index < 6; index += 1) {
    const digit = Number(value[index + 1]);
    modules += parity[index] === 'L' ? LEFT_L[digit] : LEFT_G[digit];
  }
  modules += '01010';
  for (let index = 7; index < 13; index += 1) modules += RIGHT[Number(value[index])];
  return `${modules}101`;
}

function barsOf(modules: string): Bar[] {
  const bars: Bar[] = [];
  for (let x = 0; x < modules.length; x += 1) {
    if (modules[x] !== '1') continue;
    const last = bars[bars.length - 1];
    if (last && last.x + last.width === x) last.width += 1;
    else bars.push({ x, width: 1 });
  }
  return bars;
}

// A barcode ready to draw: bars in module units, with the module width in
// millimetres chosen so the code and its quiet zones fit the sticker.
export type LabelBarcode =
  | {
      kind: 'bars';
      symbology: 'ean13' | 'code128';
      value: string;
      modules: number;
      bars: Bar[];
      moduleMm: number;
      widthMm: number;
    }
  | { kind: 'text'; value: string };

export type BarcodeChoice = {
  barcode: LabelBarcode;
  // `barcode_too_wide` when the code is printed as text because it does not
  // fit; `barcode_unsupported` when no symbology can encode it.
  warning: 'barcode_too_wide' | 'barcode_unsupported' | null;
};

// Whether `value` prints as EAN-13 under `symbology`.
export const usesEan13 = (value: string, symbology: LabelBarcodeSymbology): boolean =>
  symbology !== 'code128' && isValidEan13(value);

// The barcode of `value` for a sticker with `printableMm` of width. `auto`
// and `ean13` print EAN-13 for a valid thirteen-digit code, and Code 128
// otherwise; `code128` always prints Code 128. A code that is too long, or
// whose bars would be narrower than a counter scanner reads, prints as text.
export function chooseBarcode(
  value: string,
  symbology: LabelBarcodeSymbology,
  printableMm: number,
): BarcodeChoice {
  const text: LabelBarcode = { kind: 'text', value };
  if (usesEan13(value, symbology)) {
    const modules = ean13Modules(value) as string;
    const total = modules.length + QUIET_ZONE * 2;
    if (total * MIN_MODULE_MM > printableMm) return { barcode: text, warning: 'barcode_too_wide' };
    const moduleMm = Math.min(MODULE_MM, printableMm / total);
    return {
      barcode: {
        kind: 'bars',
        symbology: 'ean13',
        value,
        modules: EAN13_MODULES,
        bars: barsOf(modules),
        moduleMm,
        widthMm: total * moduleMm,
      },
      warning: null,
    };
  }
  const code = code128Bars(value);
  if (!code) {
    return {
      barcode: text,
      warning: value.length > MAX_BARCODE_LENGTH ? 'barcode_too_wide' : 'barcode_unsupported',
    };
  }
  const width = barcodeWidthMm(value, printableMm);
  if (width === null) return { barcode: text, warning: 'barcode_too_wide' };
  const total = code.modules + QUIET_ZONE * 2;
  return {
    barcode: {
      kind: 'bars',
      symbology: 'code128',
      value,
      modules: code.modules,
      bars: code.bars,
      moduleMm: width / total,
      widthMm: width,
    },
    warning: null,
  };
}
