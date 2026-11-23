import type { PosFinancialAttempt, PosWorkspace } from '../types/pos-context';
import type { ReceiptEinvoice, ReceiptSnapshot } from '../types/print-adapter';
import {
  type PrintPlace,
  paymentTicketData,
  prebillData,
  snapshotData,
  type TemplateData,
} from './data';
import type { ReceiptDocumentType } from './types';

// Made-up documents for the template editor's preview: one per document
// type, printed where the editor says (real store details from the POS
// context, the chosen branch and register). The figures are fixed sample
// values, never a real order.

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type SamplePlace = PrintPlace & { cashier?: string | null; timeZone?: string | null };

// The titles the server prints on posted documents.
const TITLES = {
  sale: 'PHIẾU BÁN HÀNG',
  return: 'PHIẾU TRẢ HÀNG',
  refund: 'PHIẾU HOÀN TIỀN',
  shift_closure: 'PHIẾU ĐÓNG CA',
} as const;

const DISCLAIMER = 'Phiếu bán hàng POS — không phải hóa đơn điện tử';
const SOURCE_TYPES = ['sale', 'return', 'refund', 'shift_closure'] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

const SAMPLE_NUMBERS: Record<SourceType, string> = {
  sale: 'R100245',
  return: 'TH000031',
  refund: 'HT000012',
  shift_closure: 'DC000087',
};

const SAMPLE_TRANSFER_QR = {
  value:
    '00020101021238570010A00000072701270006970436011300710012345670208QRIBFTTA530370454066000005802VN62110807R1002456304A1B2',
  bank: 'Vietcombank',
  account_number: '0071001234567',
  account_name: 'CONG TY PARKVIET',
  amount: '600000.0',
  currency: 'VND',
  transfer_content: 'R100245',
};

const SAMPLE_EINVOICE: ReceiptEinvoice = {
  status: 'issued',
  invoice_type: 'cash_register',
  seller_tax_code: '0101234567',
  template_code: '1',
  symbol: 'C26TAA',
  number: '00001245',
  cqt_code: 'M1-26-A9B8C-00001245',
  lookup_code: 'PV2611A9B8C',
  lookup_url: 'https://hddt.parkviet.vn/tra-cuu/PV2611A9B8C',
  buyer_url: null,
};

const isSourceType = (type: ReceiptDocumentType): type is SourceType =>
  (SOURCE_TYPES as readonly string[]).includes(type);

function snapshotDocument(type: SourceType, place: SamplePlace, at: string, t: Translate) {
  const profile = place.storeProfile;
  const checkInAt = new Date(Date.parse(at) - 85 * 60_000).toISOString();
  const base = {
    title: TITLES[type],
    store: {
      name: place.storeName ?? null,
      address: profile?.address ?? null,
      contact_phone: profile?.contact_phone ?? null,
      customer_support_email: profile?.customer_support_email ?? null,
      tax_code: profile?.tax_code ?? '0101234567',
      description: profile?.description ?? t('receiptTemplates.sample.storeDescription'),
      url: profile?.url ?? null,
      facebook: profile?.facebook ?? null,
      instagram: profile?.instagram ?? null,
      logo_url: profile?.logo_url ?? null,
    },
    branch: {
      name: place.branchName ?? null,
      code: place.branchCode ?? null,
      return_window_days: place.returnWindowDays ?? null,
    },
    register: place.registerName ?? null,
    timezone: place.timeZone ?? 'Asia/Ho_Chi_Minh',
    at,
    currency: 'VND',
    cashier: place.cashier ?? t('receiptTemplates.sample.cashier'),
    customer: {
      name: t('receiptTemplates.sample.customer'),
      phone: '090***4567',
      address: t('receiptTemplates.sample.address'),
    },
  };
  switch (type) {
    case 'sale':
      return {
        ...base,
        order_number: SAMPLE_NUMBERS.sale,
        call_number: '18',
        order_source: 'counter',
        check_in_at: checkInAt,
        table: {
          name: t('receiptTemplates.sample.tableName'),
          area: t('receiptTemplates.sample.areaName'),
        },
        item_count: '3',
        promotions: [{ name: t('receiptTemplates.sample.promoMember'), amount: '10000.0' }],
        fees: [
          {
            kind: 'service_charge',
            label: t('receiptTemplates.sample.serviceCharge'),
            amount: '25000.0',
          },
        ],
        delivery: { deliverer: null, fee: '15000.0' },
        customer_debt: { previous: '200000.0', total: '200000.0' },
        transfer_qr: { ...SAMPLE_TRANSFER_QR, amount: null },
        lines: [
          {
            name: t('receiptTemplates.sample.itemCoffee'),
            sku: 'CF-250',
            barcode: '8936012345678',
            quantity: 2,
            sale_quantity: '2',
            sale_unit: t('receiptTemplates.sample.unitPack'),
            original_price: '75000.0',
            unit_price: '65000.0',
            amount: '130000.0',
            discount: '-10000.0',
            net_amount: '120000.0',
            note: t('receiptTemplates.sample.lineNote'),
            trace: [{ lot_code: 'L2611', expiry_on: '2027-05-01' }],
          },
          {
            name: t('receiptTemplates.sample.itemMilk'),
            sku: 'SUA-1L',
            barcode: '8936098765432',
            quantity: 24,
            sale_quantity: '1',
            sale_unit: t('receiptTemplates.sample.unitCase'),
            conversion: t('receiptTemplates.sample.conversion'),
            unit_price: '480000.0',
            amount: '480000.0',
            net_amount: '480000.0',
          },
        ],
        totals: {
          item_total: '610000.0',
          discount_total: '-10000.0',
          fee_total: '40000.0',
          additional_tax_total: '0.0',
          included_tax_total: '44444.0',
          total: '640000.0',
        },
        receipts: [{ method: 'cash', amount: '640000.0', handed: '700000.0', change: '60000.0' }],
        paid_total: '640000.0',
      };
    case 'return':
      return {
        ...base,
        order_number: SAMPLE_NUMBERS.sale,
        return_number: SAMPLE_NUMBERS.return,
        order_source: 'counter',
        lines: [
          {
            name: t('receiptTemplates.sample.itemCoffee'),
            sku: 'CF-250',
            quantity: '1',
            amount: '60000.0',
            condition: 'resellable',
            note: t('receiptTemplates.sample.lineNote'),
          },
        ],
        entitlement_posted: true,
        entitlement_total: '60000.0',
        credit_note_amount: '0.0',
        refund_entitlement: '60000.0',
        reason: t('receiptTemplates.sample.reason'),
      };
    case 'refund':
      return {
        ...base,
        order_number: SAMPLE_NUMBERS.sale,
        return_number: SAMPLE_NUMBERS.return,
        order_source: 'counter',
        method: 'bank',
        amount: '60000.0',
        reference: 'FT26110812345',
      };
    case 'shift_closure':
      return {
        ...base,
        customer: null,
        opened_at: new Date(Date.parse(at) - 8 * 3600 * 1000).toISOString(),
        closer: place.cashier ?? t('receiptTemplates.sample.cashier'),
        opening_float: '1000000.0',
        inflow_total: '5600000.0',
        outflow_total: '200000.0',
        expected: '6400000.0',
        counted: '6400000.0',
        variance: '0.0',
      };
  }
}

// Only the fields the pre-bill and payment ticket read; the rest of an open
// order does not reach a print.
function sampleWorkspace(t: Translate, now: Date): PosWorkspace {
  const openedAt = new Date(now.getTime() - 85 * 60_000).toISOString();
  return {
    id: 'sample',
    order_id: SAMPLE_NUMBERS.sale,
    order_number: 18,
    order_source: 'counter',
    opened_at: openedAt,
    table: {
      name: t('receiptTemplates.sample.tableName'),
      area: t('receiptTemplates.sample.areaName'),
    },
    item_count: '3',
    promotions: [{ name: t('receiptTemplates.sample.promoMember'), amount: '10000.0' }],
    delivery: {
      id: 'sample_del',
      status: 'pending',
      deliverer: null,
      fee: '15000.0',
      delivered_at: null,
      delivered_by: null,
    },
    transfer_qr: SAMPLE_TRANSFER_QR,
    prebill: { sequence: 1 },
    customer: {
      name: t('receiptTemplates.sample.customer'),
      address: t('receiptTemplates.sample.address'),
    },
    line_items: [
      {
        name: t('receiptTemplates.sample.itemCoffee'),
        sku: 'CF-250',
        barcode: '8936012345678',
        quantity: 2,
        sale_quantity: '2',
        sale_unit: t('receiptTemplates.sample.unitPack'),
        original_price: '75000.0',
        price: '65000.0',
        unit_price: '65000.0',
        amount: '130000.0',
        item_discount: { amount: '-10000.0' },
        item_net_amount: '120000.0',
        note: t('receiptTemplates.sample.lineNote'),
      },
      {
        name: t('receiptTemplates.sample.itemMilk'),
        sku: 'SUA-1L',
        barcode: '8936098765432',
        quantity: 1,
        sale_quantity: '1',
        sale_unit: t('receiptTemplates.sample.unitCase'),
        price: '480000.0',
        unit_price: '480000.0',
        amount: '480000.0',
        item_net_amount: '480000.0',
      },
    ],
    totals: {
      currency: 'VND',
      item_total: '610000.0',
      discount_total: '-10000.0',
      fee_total: '40000.0',
      fees: [
        {
          kind: 'service_charge',
          label: t('receiptTemplates.sample.serviceCharge'),
          amount: '25000.0',
        },
      ],
      additional_tax_total: '0.0',
      included_tax_total: '44444.0',
      total: '640000.0',
    },
    financial: { allocated: '0.0', remaining: '640000.0' },
  } as unknown as PosWorkspace;
}

const SAMPLE_ATTEMPTS = [
  { kind: 'cash', amount: '640000.0', currency: 'VND' },
] as unknown as PosFinancialAttempt[];

// The sample document of a type, printed at `place` at `now`.
export function sampleData(
  type: ReceiptDocumentType,
  place: SamplePlace,
  t: Translate,
  now: Date = new Date(),
): TemplateData {
  const zone = place.timeZone || 'Asia/Ho_Chi_Minh';
  const enrichedPlace: SamplePlace = {
    ...place,
    storeProfile: {
      address: place.storeProfile?.address ?? null,
      contact_phone: place.storeProfile?.contact_phone ?? null,
      customer_support_email: place.storeProfile?.customer_support_email ?? null,
      tax_code: place.storeProfile?.tax_code ?? '0101234567',
      description: place.storeProfile?.description ?? t('receiptTemplates.sample.storeDescription'),
      url: place.storeProfile?.url ?? null,
      facebook: place.storeProfile?.facebook ?? null,
      instagram: place.storeProfile?.instagram ?? null,
      logo_url: place.storeProfile?.logo_url ?? null,
    },
  };
  if (type === 'prebill') return prebillData(sampleWorkspace(t, now), enrichedPlace, t, now, zone);
  if (type === 'payment_ticket')
    return paymentTicketData(
      {
        workspace: sampleWorkspace(t, now),
        attempts: SAMPLE_ATTEMPTS,
        handed: '700000.0',
        change: '60000.0',
        names: {
          ...enrichedPlace,
          cashier: enrichedPlace.cashier ?? t('receiptTemplates.sample.cashier'),
        },
      },
      t,
      now,
      zone,
    );
  const source: SourceType = isSourceType(type) ? type : 'sale';
  const atIso = now.toISOString();
  const receipt: ReceiptSnapshot = {
    id: 'sample',
    source_type: source,
    number: SAMPLE_NUMBERS[source],
    branch_id: 'sample',
    issued_at: atIso,
    issued_late: false,
    disclaimer: DISCLAIMER,
    printed: false,
    copy_count: 0,
    document: snapshotDocument(source, enrichedPlace, atIso, t),
    ...(source === 'sale' ? { einvoice: SAMPLE_EINVOICE } : {}),
  };
  return withLogo(snapshotData(receipt, t, { copy_number: 0, printed_at: atIso }), enrichedPlace);
}

// A posted receipt as the preview shows it. Older snapshots without a stored
// logo fall back to the store's current one.
export function withLogo(data: TemplateData, place: SamplePlace): TemplateData {
  if (data.store.logoUrl) return data;
  const logoUrl = place.storeProfile?.logo_url || null;
  return logoUrl ? { ...data, store: { ...data.store, logoUrl } } : data;
}
