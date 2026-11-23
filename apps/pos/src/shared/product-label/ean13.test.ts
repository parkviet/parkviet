import { describe, expect, it } from 'vitest';
import { chooseBarcode, ean13CheckDigit, ean13Modules, isValidEan13 } from './ean13';

describe('EAN-13 check digit', () => {
  it('accepts real codes and rejects a wrong check digit', () => {
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('5901234123457')).toBe(true);
    expect(isValidEan13('8934563138165')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(isValidEan13('400638133393')).toBe(false);
    expect(isValidEan13('40063813339310')).toBe(false);
    expect(isValidEan13('40063813339A1')).toBe(false);
    expect(ean13CheckDigit('400638133393')).toBe(1);
  });
});

describe('ean13Modules', () => {
  it('encodes 95 modules between guard bars', () => {
    const modules = ean13Modules('5901234123457') as string;
    expect(modules).toHaveLength(95);
    expect(modules.slice(0, 3)).toBe('101');
    expect(modules.slice(45, 50)).toBe('01010');
    expect(modules.slice(92)).toBe('101');
    // 5 selects the L G G L L G pattern for the left half; the first digit
    // after the number system is 9, written with the L set.
    expect(modules.slice(3, 10)).toBe('0001011');
    // Right half: digits 1 2 3 4 5 7 in the R set.
    expect(modules.slice(50, 57)).toBe('1100110');
    expect(modules.slice(85, 92)).toBe('1000100');
  });

  it('refuses an invalid code', () => {
    expect(ean13Modules('5901234123458')).toBeNull();
    expect(ean13Modules('ABC')).toBeNull();
  });
});

describe('chooseBarcode', () => {
  it('prints a valid thirteen-digit code as EAN-13 under auto and ean13', () => {
    for (const symbology of ['auto', 'ean13'] as const) {
      const choice = chooseBarcode('8934563138165', symbology, 48);
      expect(choice.warning).toBeNull();
      expect(choice.barcode).toMatchObject({ kind: 'bars', symbology: 'ean13', modules: 95 });
    }
  });

  it('prints Code 128 when the digits are not a valid EAN-13, or when asked', () => {
    expect(chooseBarcode('8934563138166', 'auto', 60).barcode).toMatchObject({
      kind: 'bars',
      symbology: 'code128',
    });
    expect(chooseBarcode('SP000101', 'auto', 48).barcode).toMatchObject({ symbology: 'code128' });
    expect(chooseBarcode('8934563138165', 'code128', 60).barcode).toMatchObject({
      symbology: 'code128',
    });
  });

  it('never makes the bars wider than the printable width', () => {
    const choice = chooseBarcode('8934563138165', 'auto', 31);
    expect(choice.barcode.kind === 'bars' && choice.barcode.widthMm).toBeLessThanOrEqual(31);
  });

  it('falls back to text with a warning when the code is too long or too wide', () => {
    expect(chooseBarcode('A'.repeat(30), 'auto', 48)).toEqual({
      barcode: { kind: 'text', value: 'A'.repeat(30) },
      warning: 'barcode_too_wide',
    });
    expect(chooseBarcode('8934563138165', 'auto', 18).warning).toBe('barcode_too_wide');
    expect(chooseBarcode('SP000101', 'auto', 10).warning).toBe('barcode_too_wide');
  });

  it('reports a code no symbology can encode', () => {
    expect(chooseBarcode('Sữa', 'auto', 48)).toEqual({
      barcode: { kind: 'text', value: 'Sữa' },
      warning: 'barcode_unsupported',
    });
  });
});
