import { describe, expect, it } from 'vitest';
import i18n from '../test-support/i18n';
import type { PosWorkspace } from '../types/pos-context';
import type { ReceiptSnapshot } from '../types/print-adapter';
import { formatDurationBetween, prebillData, snapshotData } from './data';
import { sampleData } from './sample-data';
import { RECEIPT_DOCUMENT_TYPES } from './types';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options ?? {}) as string;

describe('TemplateData new and legacy fields', () => {
  it('formats service duration in hours and minutes', () => {
    expect(formatDurationBetween('2026-11-18T02:00:00Z', '2026-11-18T02:25:00Z', t)).toBe(
      '25 phút',
    );
    expect(formatDurationBetween('2026-11-18T02:00:00Z', '2026-11-18T04:00:00Z', t)).toBe('2 giờ');
    expect(formatDurationBetween('2026-11-18T02:00:00Z', '2026-11-18T03:25:00Z', t)).toBe(
      '1 giờ 25 phút',
    );
  });

  it('keeps an old sale snapshot free of empty rows for new fields', () => {
    const legacy: ReceiptSnapshot = {
      id: 'rcpt_old',
      source_type: 'sale',
      number: 'R100',
      branch_id: 'br_1',
      issued_at: '2026-11-10T02:00:00Z',
      issued_late: false,
      disclaimer: 'POS slip',
      printed: true,
      copy_count: 0,
      document: {
        title: 'PHIẾU BÁN HÀNG',
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        at: '2026-11-10T02:00:00Z',
        cashier: 'Thu Ngân',
        store: { name: 'Quán Cũ' },
        lines: [{ name: 'Cà phê', quantity: 1, unit_price: '25000.0', amount: '25000.0' }],
        totals: { item_total: '25000.0', discount_total: '0.0', total: '25000.0' },
        receipts: [{ method: 'cash', amount: '25000.0', handed: '25000.0', change: '0.0' }],
        paid_total: '25000.0',
      },
    };
    const data = snapshotData(legacy, t);
    expect(data.meta.map((row) => row.field)).toEqual(['time', 'cashier']);
    expect(data.totals.map((row) => row.field)).toEqual(['item_total', 'total']);
    expect(data.payments.map((row) => row.field)).toEqual(['methods', 'handed', 'paid_total']);
    expect(data.transferQr).toBeNull();
    expect(data.lines[0]?.originalPrice).toBeNull();
    expect(data.lines[0]?.barcodeText).toBeNull();
    expect(data.lines[0]?.lineNote).toBeNull();
  });

  it('populates table, check-in, order source (translated), item count, promotions, debt, transfer QR, print info and e-invoice', () => {
    const rich: ReceiptSnapshot = {
      id: 'rcpt_new',
      source_type: 'sale',
      number: 'R200',
      branch_id: 'br_1',
      issued_at: '2026-11-18T04:25:00Z',
      issued_late: false,
      disclaimer: 'POS slip',
      printed: true,
      copy_count: 1,
      einvoice: {
        status: 'issued',
        invoice_type: 'cash_register',
        seller_tax_code: '0101234567',
        template_code: '1',
        symbol: 'C26TAA',
        number: '00000123',
        cqt_code: 'M1-26-ABC',
        lookup_code: 'LK123',
        lookup_url: 'https://tracuu.example.test/LK123',
        buyer_url: null,
      },
      document: {
        title: 'PHIẾU BÁN HÀNG',
        currency: 'VND',
        timezone: 'Asia/Ho_Chi_Minh',
        check_in_at: '2026-11-18T03:00:00Z',
        at: '2026-11-18T04:25:00Z',
        order_source: 'grabfood',
        call_number: '42',
        table: { name: 'Bàn 3', area: 'Sân thượng' },
        store: {
          name: 'ParkViet',
          tax_code: '0101234567',
          description: 'Trà & Cà phê',
          logo_url: '/rails/active_storage/blobs/logo.png',
        },
        item_count: '2',
        promotions: [{ name: 'Happy Hour', amount: '10000.0' }],
        customer_debt: { previous: '50000.0', total: '150000.0' },
        transfer_qr: {
          value: '000201010212',
          bank: 'VCB',
          account_number: '007100',
          account_name: 'SHOP',
          amount: '100000.0',
          transfer_content: 'R200',
        },
        lines: [
          {
            name: 'Trà đào',
            barcode: '8930001',
            quantity: 2,
            original_price: '35000.0',
            unit_price: '30000.0',
            amount: '60000.0',
            note: 'Ít đá',
          },
        ],
        totals: { item_total: '60000.0', discount_total: '10000.0', total: '50000.0' },
        receipts: [],
        paid_total: '0.0',
      },
    };
    const data = snapshotData(rich, t, {
      copy_number: 1,
      printed_at: '2026-11-18T05:00:00Z',
    });
    expect(data.store.taxCode).toBe('MST: 0101234567');
    expect(data.store.description).toBe('Trà & Cà phê');
    expect(data.store.logoUrl).toBe('/rails/active_storage/blobs/logo.png');
    expect(data.meta.find((r) => r.field === 'table')?.value).toBe('Sân thượng - Bàn 3');
    expect(data.meta.find((r) => r.field === 'duration')?.value).toBe('1 giờ 25 phút');
    expect(data.meta.find((r) => r.field === 'order_source')?.value).toBe('GrabFood');
    expect(data.meta.find((r) => r.field === 'print_count')?.value).toBe('2');
    expect(data.meta.find((r) => r.field === 'printed_at')?.dateValue).toBe('18/11/2026');
    expect(data.lines[0]).toMatchObject({
      barcodeText: 'Mã vạch: 8930001',
      originalPrice: '35.000 ₫',
      originalPriceCell: '35.000',
      lineNote: '* Ít đá',
    });
    expect(data.totals.find((r) => r.field === 'item_count')?.value).toBe('2');
    expect(data.totals.find((r) => r.field === 'promotions')).toMatchObject({
      label: 'Happy Hour',
      value: '10.000 ₫',
    });
    expect(data.payments.find((r) => r.field === 'previous_debt')?.value).toBe('50.000 ₫');
    expect(data.payments.find((r) => r.field === 'customer_debt')?.value).toBe('150.000 ₫');
    expect(data.transferQr?.value).toBe('000201010212');
    expect(data.einvoice?.rows?.map((r) => [r.field, r.value])).toEqual([
      ['seller_tax_code', '0101234567'],
      ['number', '1C26TAA - 00000123'],
      ['lookup_code', 'LK123'],
      ['cqt_code', 'M1-26-ABC'],
      ['lookup_url', 'https://tracuu.example.test/LK123'],
    ]);
    expect(data.einvoice?.qr?.value).toBe('https://tracuu.example.test/LK123');
  });

  it('builds prebill data and sampleData for every document type', () => {
    const ws = {
      id: 'ws_1',
      opened_at: '2026-11-18T02:00:00Z',
      order_source: 'facebook',
      table: { name: 'Bàn 1', area: 'Tầng trệt' },
      prebill: { sequence: 3 },
      line_items: [{ name: 'Nước cam', quantity: 2, price: '25000.0', amount: '50000.0' }],
      totals: { currency: 'VND', item_total: '50000.0', discount_total: '0.0', total: '50000.0' },
      financial: { allocated: '0.0', remaining: '50000.0' },
    } as unknown as PosWorkspace;
    const prebill = prebillData(ws, { storeName: 'Quán' }, t, new Date('2026-11-18T03:10:00Z'));
    expect(prebill.meta.find((r) => r.field === 'table')?.value).toBe('Tầng trệt - Bàn 1');
    expect(prebill.meta.find((r) => r.field === 'duration')?.value).toBe('1 giờ 10 phút');
    expect(prebill.meta.find((r) => r.field === 'order_source')?.value).toBe('Facebook');
    expect(prebill.meta.find((r) => r.field === 'print_count')?.value).toBe('3');

    for (const type of RECEIPT_DOCUMENT_TYPES) {
      const sample = sampleData(
        type,
        { storeName: 'ParkViet' },
        t,
        new Date('2026-11-18T04:00:00Z'),
      );
      expect(sample.documentType).toBe(type);
    }
  });
});
