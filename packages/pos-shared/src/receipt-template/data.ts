import { formatMoney } from '../money';
import { type PayLaterQr, payLaterDetails, payLaterQr } from '../pay-later';
import {
  ORDER_SOURCES,
  type OrderSource,
  type PosFinancialAttempt,
  type PosLineItem,
  type PosStoreProfile,
  type PosWorkspace,
} from '../types/pos-context';
import type { ReceiptPrint, ReceiptSnapshot } from '../types/print-adapter';
import type {
  EinvoiceField,
  MetaField,
  PaymentField,
  PrintPayQr,
  PrintQr,
  ReceiptDocumentType,
  SignatureParty,
  TotalField,
} from './types';

// Every printable document reduced to one shape, from a posted receipt
// snapshot, an open order (pre-bill) or an order being paid (payment
// ticket). Only server figures are used: rows are picked, labelled and
// formatted here, never computed. A zero discount, tax or change is left
// out the way the slips always did.

type Translate = (key: string, options?: Record<string, unknown>) => string;

export type DataRow<F extends string> = {
  // The template field that may switch the row off; null rows always print.
  field: F | null;
  label: string;
  value: string;
  // Date-only text (`dd/MM/yyyy`) when `meta.time_format === 'date'`.
  dateValue?: string;
  strong?: boolean;
  // Printed after the label, kept when a template relabels the row.
  labelSuffix?: string;
};

export type LineData = {
  name: string;
  sku: string | null;
  barcodeText: string | null;
  quantity: string | null;
  unit: string | null;
  // Original list price when different from `price`, formatted with currency
  // (`originalPrice`) and bare (`originalPriceCell`) for narrow table cells.
  originalPrice: string | null;
  originalPriceCell: string | null;
  // `price` and `amount` carry the currency; `*Cell` are the bare figures
  // of a narrow table column.
  price: string | null;
  priceCell: string;
  discountNote: string | null;
  discountCell: string;
  amount: string;
  amountCell: string;
  conversion: string | null;
  trace: string[];
  // Line-level note, printed when `lines.columns` includes `'note'`.
  lineNote: string | null;
  // Play-time header line in both styles (`range` vs `duration`).
  timedSummary?: { range: string; duration: string } | null;
  // Details that always print (modifiers, combo items, timed bands, returned qty/condition).
  notes: string[];
};

export type StoreData = {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxCode?: string | null;
  description?: string | null;
  url: string | null;
  facebook: string | null;
  instagram: string | null;
  logoUrl: string | null;
};

export type TableData = {
  name: string;
  area: string | null;
  areaLabel: string;
};

export type TemplateData = {
  documentType: ReceiptDocumentType;
  title: string;
  number: string | null;
  // A banner the document type always carries (pre-bill).
  banner: string | null;
  store: StoreData;
  branch: { name: string | null; code: string | null; returnWindowDays: number | null };
  register: string | null;
  cashier: string | null;
  time: string;
  businessDate: string;
  table?: TableData | null;
  // Counter service: the number the order is called by, and the name.
  callNumber?: string | null;
  guestName?: string | null;
  taxesText: string;
  customerName: string | null;
  customerPhone?: string | null;
  // Where to deliver, one printable line.
  customerAddress?: string | null;
  meta: DataRow<MetaField>[];
  lines: LineData[];
  lineLabels: {
    index: string;
    name: string;
    qty: string;
    price: string;
    discount: string;
    amount: string;
    originalPrice?: (amount: string) => string;
  };
  signatureLabels: Record<SignatureParty, string>;
  totals: DataRow<TotalField>[];
  payments: DataRow<PaymentField>[];
  // A credit sale's pay-later VietQR, as its receipt snapshot carries it,
  // with the default caption.
  payQr?: PrintPayQr | null;
  // Optional transfer VietQR for sales, pre-bills and payment tickets.
  transferQr?: PrintQr | null;
  notes: string[];
  disclaimer: string | null;
  // The sale's e-invoice as the receipt reads it now (server ReceiptInfo):
  // lookup details once issued, the buyer link while it is open.
  einvoice?: {
    lookupCode: string | null;
    lookupUrl: string | null;
    buyerUrl: string | null;
    buyerCaption: string | null;
    rows?: DataRow<EinvoiceField>[];
    qr?: PrintQr | null;
  } | null;
};

type Doc = Record<string, unknown>;
const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;
const rows = (value: unknown): Doc[] =>
  Array.isArray(value)
    ? value.filter((item): item is Doc => typeof item === 'object' && item !== null)
    : [];
const obj = (value: unknown): Doc | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Doc) : null;
const int = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

// Vietnamese document formats: dd/MM/yyyy HH:mm in the branch timezone,
// dd/MM/yyyy for dates, a comma as the decimal separator for quantities.
export function formatDocumentTime(value: string | null | undefined, timeZone: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}

export function formatDocumentDateOnly(value: string | null | undefined, timeZone: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDocumentDate(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
}

export function formatDocumentDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value ?? '');
}

export function formatDurationMinutes(
  minutes: number | null | undefined,
  t: Translate,
): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0)
    return null;
  const whole = Math.floor(minutes);
  const hours = Math.floor(whole / 60);
  const rem = whole % 60;
  if (hours === 0) return t('receiptDurationMinutes', { minutes: whole });
  if (rem === 0) return t('receiptDurationHours', { hours });
  return t('receiptDurationHoursMinutes', { hours, minutes: rem });
}

export function formatDurationBetween(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  t: Translate,
): string | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return formatDurationMinutes(Math.floor((end - start) / 60_000), t);
}

export function formatQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^-?\d+(\.\d+)?$/.test(text) ? text.replace(/\.0+$/, '').replace('.', ',') : text;
}

const isZero = (amount: string | null | undefined) =>
  amount == null || /^-?0+(\.0+)?$/.test(amount);
const nonZero = (amount: string | null | undefined) => !isZero(amount);

// Table cells drop the currency sign: columns are narrow on a 58mm roll.
function bare(amount: string | null | undefined, currency: string) {
  return formatMoney(amount ?? null, currency).replace(/\s(₫|[A-Z]{3})$/, '');
}

function timeRow<F extends string>(
  field: F,
  label: string,
  isoValue: string | null | undefined,
  timeZone: string,
): DataRow<F> {
  return {
    field,
    label,
    value: formatDocumentTime(isoValue, timeZone),
    dateValue: formatDocumentDateOnly(isoValue, timeZone),
  };
}

function orderSourceLabel(source: unknown, t: Translate): string | null {
  const code = str(source);
  if (!code || !(ORDER_SOURCES as readonly string[]).includes(code)) return null;
  return t(`orderSource_${code as OrderSource}`);
}

// The unit price the basket shows: a price override replaces the list price.
export function lineUnitPrice(line: PosLineItem): string {
  return line.line_discount?.value_type === 'unit_price'
    ? line.line_discount.value
    : (line.unit_price ?? line.price);
}

export function lineDiscount(line: PosLineItem): string | null {
  const amount = line.item_discount?.amount;
  return isZero(amount) ? null : (amount ?? null);
}

function lineLabels(t: Translate): TemplateData['lineLabels'] {
  return {
    index: t('receiptTemplates.print.index'),
    name: t('receiptTemplates.print.name'),
    qty: t('ticketQty'),
    price: t('ticketPrice'),
    discount: t('ticketDiscount'),
    amount: t('ticketTotal'),
    originalPrice: (amount: string) => t('receiptOriginalPrice', { amount }),
  };
}

function signatureLabels(t: Translate): TemplateData['signatureLabels'] {
  return {
    buyer: t('receiptTemplates.print.buyer'),
    seller: t('receiptTemplates.print.seller'),
    cashier: t('receiptTemplates.print.cashier'),
  };
}

const methodLabel = (kind: string | null, t: Translate) =>
  kind === 'cash'
    ? t('receiptCash')
    : kind === 'vietqr'
      ? t('receiptVietqr')
      : kind === 'platform_receivable'
        ? t('receiptPlatform')
        : t('receiptBank');

function emptyLine(name: string): LineData {
  return {
    name,
    sku: null,
    barcodeText: null,
    quantity: null,
    unit: null,
    originalPrice: null,
    originalPriceCell: null,
    price: null,
    priceCell: '',
    discountNote: null,
    discountCell: '',
    amount: '',
    amountCell: '',
    conversion: null,
    trace: [],
    lineNote: null,
    timedSummary: null,
    notes: [],
  };
}

function originalPricePair(
  rawOriginal: unknown,
  rawPrice: string | null | undefined,
  currency: string,
): [string | null, string | null] {
  const orig = str(rawOriginal);
  if (!orig || !nonZero(orig) || orig === str(rawPrice ?? '')) return [null, null];
  const origNum = Number(orig);
  const priceNum = Number(rawPrice ?? '');
  if (Number.isFinite(origNum) && Number.isFinite(priceNum) && origNum === priceNum)
    return [null, null];
  return [formatMoney(orig, currency), bare(orig, currency)];
}

function traceText(trace: Doc, t: Translate): string {
  const parts: string[] = [];
  const serial = str(trace.serial);
  const lot = str(trace.lot_code);
  const expiry = str(trace.expiry_on);
  if (serial) parts.push(t('receiptSerial', { serial }));
  if (lot) parts.push(t('receiptLot', { lot }));
  if (expiry) parts.push(t('receiptExpiry', { date: formatDocumentDate(expiry) }));
  return parts.join(' · ');
}

// The store as printed: a snapshot copies its details at issue time (older
// snapshots carry only the name); open orders use the live POS context.
function storeFromSnapshot(store: Doc | null, t: Translate): StoreData {
  const taxCode = str(store?.tax_code);
  return {
    name: str(store?.name),
    address: str(store?.address),
    phone: str(store?.contact_phone),
    email: str(store?.customer_support_email),
    taxCode: taxCode ? t('receiptStoreTaxCode', { code: taxCode }) : null,
    description: str(store?.description),
    url: str(store?.url),
    facebook: str(store?.facebook),
    instagram: str(store?.instagram),
    logoUrl: str(store?.logo_url),
  };
}

function storeFromProfile(
  name: string | null | undefined,
  profile: PosStoreProfile | null | undefined,
  t: Translate,
): StoreData {
  const taxCode = profile?.tax_code?.trim() || null;
  return {
    name: name || null,
    address: profile?.address || null,
    phone: profile?.contact_phone || null,
    email: profile?.customer_support_email || null,
    taxCode: taxCode ? t('receiptStoreTaxCode', { code: taxCode }) : null,
    description: profile?.description?.trim() || null,
    url: profile?.url || null,
    facebook: profile?.facebook || null,
    instagram: profile?.instagram || null,
    logoUrl: profile?.logo_url || null,
  };
}

// What the POS context knows about where an open order is printed.
export type PrintPlace = {
  storeName?: string | null;
  branchName?: string | null;
  registerName?: string | null;
  storeProfile?: PosStoreProfile | null;
  branchCode?: string | null;
  returnWindowDays?: number | null;
};

function menuDetail(mark: string, name: string | null, quantity: unknown): string | null {
  if (!name) return null;
  return typeof quantity === 'number' && Number.isInteger(quantity) && quantity > 1
    ? `${mark} ${name} ×${quantity}`
    : `${mark} ${name}`;
}

// A menu line's options ("+ Trân châu ×2") and combo contents ("- Khoai tây").
export function menuNotes(line: Doc): string[] {
  return [
    ...rows(line.modifiers).map((row) => menuDetail('+', str(row.name), row.quantity)),
    ...rows(line.components).map((row) => menuDetail('-', str(row.name), row.quantity)),
  ].filter((note): note is string => note !== null);
}

function timedParts(
  timed: Doc | null,
  currency: string,
  zone: string,
  t: Translate,
): [{ range: string; duration: string } | null, string[]] {
  if (!timed) return [null, []];
  const clock = (value: unknown) => {
    const iso = str(value);
    return iso ? formatDocumentTime(iso, zone).slice(-5) : '—';
  };
  const resource = str(timed.resource) ?? '';
  const range = `${resource} · ${clock(timed.started_at)}–${clock(timed.stopped_at)}`;
  const mins = int(timed.billed_minutes) ?? int(timed.played_minutes);
  const dur = mins !== null ? formatDurationMinutes(mins, t) : null;
  const summary = { range, duration: dur ? `${resource} · ${dur}` : range };
  const bands = rows(timed.bands).map((band) => {
    const label = str(band.label);
    const span = `${clock(band.starts_at)}–${clock(band.ends_at)}`;
    const kind = str(band.kind);
    const parts =
      kind === 'package'
        ? [
            span,
            t('receiptTimedPackage'),
            label,
            `${band.minutes} phút`,
            formatMoney(str(band.amount), currency),
          ]
        : kind === 'card'
          ? [
              span,
              t('receiptTimedCard'),
              `${band.minutes} phút`,
              formatMoney(str(band.amount), currency),
            ]
          : kind === 'bonus'
            ? [span, t('receiptTimedBonus'), `${band.minutes} phút`]
            : [
                span,
                label,
                `${band.minutes} phút × ${formatMoney(str(band.price_per_hour), currency)}/giờ`,
              ];
    return parts.filter(Boolean).join(' · ');
  });
  return [summary, bands];
}

function saleLine(line: Doc, currency: string, zone: string, t: Translate): LineData {
  const discount = str(line.discount);
  const amount = str(line.net_amount) ?? str(line.amount);
  const price = str(line.unit_price);
  const [originalPrice, originalPriceCell] = originalPricePair(
    line.original_price,
    price,
    currency,
  );
  const barcode = str(line.barcode);
  const note = str(line.note);
  const [timedSummary, timedBands] = timedParts(obj(line.timed), currency, zone, t);
  return {
    ...emptyLine(str(line.name) ?? ''),
    sku: str(line.sku),
    barcodeText: barcode ? t('receiptBarcode', { barcode }) : null,
    quantity: formatQuantity(str(line.sale_quantity) ?? String(line.quantity ?? '')),
    unit: str(line.sale_unit),
    originalPrice,
    originalPriceCell,
    price: formatMoney(price, currency),
    priceCell: bare(price, currency),
    discountNote: nonZero(discount)
      ? t('receiptLineDiscount', { amount: formatMoney(discount, currency) })
      : null,
    discountCell: nonZero(discount) ? bare(discount, currency) : '',
    amount: formatMoney(amount, currency),
    amountCell: bare(amount, currency),
    conversion: str(line.conversion),
    trace: rows(line.trace)
      .map((trace) => traceText(trace, t))
      .filter(Boolean),
    lineNote: note ? `* ${note}` : null,
    timedSummary,
    notes: [...menuNotes(line), ...timedBands],
  };
}

export function rateLabel(rate: string): string {
  const value = Number(rate);
  if (!Number.isFinite(value)) return rate;
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  const rounded = Math.round(percent * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)}%`;
}

export function formatBusinessDate(value: string | null): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function taxTableRows(taxes: unknown, currency: string, t: Translate): DataRow<TotalField>[] {
  return rows(taxes).flatMap((row) => {
    const amount = str(row.amount);
    if (!amount || !nonZero(amount)) return [];
    const label = str(row.label) ?? t('receiptTax');
    const rate = str(row.rate);
    return [
      {
        field: null,
        label: rate ? `${label} (${rateLabel(rate)})` : label,
        value: formatMoney(amount, currency),
      },
    ];
  });
}

export function taxesSummary(taxes: unknown, currency: string, t: Translate): string {
  return taxTableRows(taxes, currency, t)
    .map((row) => `${row.label}: ${row.value}`)
    .join('; ');
}

function promotionRows(promotions: unknown, currency: string, t: Translate): DataRow<TotalField>[] {
  return rows(promotions).flatMap((promo) => {
    const amount = str(promo.amount);
    if (!amount || !nonZero(amount)) return [];
    return [
      {
        field: 'promotions',
        label: str(promo.name) ?? t('receiptPromotion'),
        value: formatMoney(amount, currency),
      },
    ];
  });
}

function feeRows(
  fees: unknown,
  currency: string,
  t: Translate,
  skipMinimumSpend = false,
): DataRow<TotalField>[] {
  return rows(fees).flatMap((fee) => {
    if (skipMinimumSpend && str(fee.kind) === 'minimum_spend') return [];
    const amount = str(fee.amount);
    if (!amount || !nonZero(amount)) return [];
    return [
      {
        field: 'fees',
        label: str(fee.label) ?? str(fee.name) ?? t('receiptFee'),
        value: formatMoney(amount, currency),
      },
    ];
  });
}

function saleTotals(document: Doc, currency: string, t: Translate): DataRow<TotalField>[] {
  const totals = obj(document.totals) ?? {};
  const money = (value: unknown) => formatMoney(str(value), currency);
  const result: DataRow<TotalField>[] = [];
  const itemCount = str(document.item_count);
  if (itemCount && nonZero(itemCount))
    result.push({
      field: 'item_count',
      label: t('receiptItemCount'),
      value: formatQuantity(itemCount),
    });
  result.push({
    field: 'item_total',
    label: t('receiptItemTotal'),
    value: money(totals.item_total),
  });
  if (nonZero(str(totals.discount_total)))
    result.push({
      field: 'discount',
      label: t('receiptDiscount'),
      value: money(totals.discount_total),
    });
  result.push(...promotionRows(document.promotions, currency, t));
  result.push(...feeRows(document.fees ?? totals.fees, currency, t));
  const breakdown = taxTableRows(document.taxes, currency, t);
  if (breakdown.length > 0) result.push(...breakdown);
  else {
    if (nonZero(str(totals.additional_tax_total)))
      result.push({
        field: 'tax',
        label: t('receiptTax'),
        value: money(totals.additional_tax_total),
      });
    if (nonZero(str(totals.included_tax_total)))
      result.push({
        field: 'included_tax',
        label: t('receiptIncludedTax'),
        value: money(totals.included_tax_total),
      });
  }
  result.push({
    field: 'total',
    label: t('receiptTotal'),
    value: money(totals.total),
    strong: true,
  });
  return result;
}

function salePayments(document: Doc, currency: string, t: Translate): DataRow<PaymentField>[] {
  const money = (value: unknown) => formatMoney(str(value), currency);
  const result: DataRow<PaymentField>[] = [];
  for (const receipt of rows(document.receipts)) {
    const kind = str(receipt.method);
    result.push({ field: 'methods', label: methodLabel(kind, t), value: money(receipt.amount) });
    if (kind === 'cash') {
      result.push({ field: 'handed', label: t('receiptHanded'), value: money(receipt.handed) });
      if (nonZero(str(receipt.change)))
        result.push({ field: 'change', label: t('receiptChange'), value: money(receipt.change) });
    } else if (str(receipt.reference)) {
      result.push({
        field: 'reference',
        label: t('receiptReference'),
        value: str(receipt.reference) ?? '',
      });
    }
  }
  result.push({
    field: 'paid_total',
    label: t('receiptPaidTotal'),
    value: money(document.paid_total),
    strong: true,
  });
  const credit = obj(document.credit);
  if (credit) {
    result.push({
      field: 'debt',
      label: t('receiptDebt'),
      value: money(credit.debt),
      strong: true,
    });
    if (str(credit.due_on))
      result.push({
        field: 'due_on',
        label: t('receiptDueOn'),
        value: formatDocumentDate(str(credit.due_on)),
      });
  }
  const customerDebt = obj(document.customer_debt);
  if (customerDebt) {
    if (str(customerDebt.previous))
      result.push({
        field: 'previous_debt',
        label: t('receiptPreviousDebt'),
        value: money(customerDebt.previous),
      });
    if (str(customerDebt.total))
      result.push({
        field: 'customer_debt',
        label: t('receiptCustomerDebt'),
        value: money(customerDebt.total),
        strong: true,
      });
  }
  return result;
}

function payQrPrint(qr: PayLaterQr | null, t: Translate): PrintPayQr | null {
  if (!qr) return null;
  return { value: qr.payload, caption: t('receiptPayQrCaption'), lines: payLaterDetails(qr, t) };
}

function presentText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function transferQrPrint(raw: unknown, t: Translate): PrintQr | null {
  const qr = obj(raw);
  if (!qr) return null;
  const payload = presentText(qr.value) ?? presentText(qr.payload);
  const account = presentText(qr.account_number);
  if (!payload || !account) return null;
  const amount = presentText(qr.amount);
  const note = presentText(qr.transfer_content);
  const currency = presentText(qr.currency) ?? 'VND';
  const lines: string[] = [];
  if (amount && nonZero(amount))
    lines.push(t('payLaterAmount', { amount: formatMoney(amount, currency) }));
  lines.push(
    [presentText(qr.bank) ?? presentText(qr.bank_name), account, presentText(qr.account_name)]
      .filter(Boolean)
      .join(' · '),
  );
  if (note) lines.push(t('payLaterNote', { note }));
  return { value: payload, caption: t('receiptTransferQrCaption'), lines };
}

function tableData(raw: unknown, t: Translate): TableData | null {
  const table = obj(raw);
  const name = str(table?.name);
  if (!name) return null;
  return { name, area: str(table?.area), areaLabel: t('receiptArea') };
}

function workspaceTableData(workspace: PosWorkspace, t: Translate): TableData | null {
  const fromKey = tableData(workspace.table, t);
  if (fromKey) return fromKey;
  const res = workspace.resource;
  if (!res?.name) return null;
  return { name: res.name, area: res.area_name || null, areaLabel: t('receiptArea') };
}

export type CustomerPrint = {
  name: string | null;
  phone: string | null;
  address: string | null;
};

// The customer as an order is printed with it. The customer field also
// carries where to deliver, so a template that prints the customer prints
// the delivery address with it.
function customerRows(
  customer: CustomerPrint | null,
  t: Translate,
  walkIn?: string,
): DataRow<MetaField>[] {
  const value = customer ? [customer.name, customer.phone].filter(Boolean).join(' · ') : '';
  const result: DataRow<MetaField>[] = [];
  if (value || walkIn)
    result.push({ field: 'customer', label: t('receiptCustomer'), value: value || walkIn || '' });
  if (customer?.address)
    result.push({
      field: 'customer',
      label: t('receiptDeliveryAddress'),
      value: customer.address,
      strong: true,
    });
  return result;
}

export type DeliveryPrint = { deliverer: string | null; fee: string | null };

// A sale to deliver always says who takes it in meta; the delivery fee row
// in totals can be relabelled or switched off through `shipping`.
export function deliveryMetaRows(
  delivery: DeliveryPrint | null,
  t: Translate,
): DataRow<MetaField>[] {
  if (!delivery) return [];
  return [
    {
      field: null,
      label: t('receiptDelivery'),
      value: delivery.deliverer || t('receiptDeliveryYes'),
      strong: true,
    },
  ];
}

// Placed just before the grand total.
function withDeliveryFee(
  totals: DataRow<TotalField>[],
  delivery: DeliveryPrint | null,
  currency: string,
  t: Translate,
): DataRow<TotalField>[] {
  if (!delivery || !nonZero(delivery.fee)) return totals;
  const row: DataRow<TotalField> = {
    field: 'shipping',
    label: t('receiptDeliveryFee'),
    value: formatMoney(delivery.fee, currency),
  };
  const at = totals.findIndex((item) => item.field === 'total');
  return at < 0 ? [...totals, row] : [...totals.slice(0, at), row, ...totals.slice(at)];
}

function workspaceDelivery(workspace: PosWorkspace): DeliveryPrint | null {
  const delivery = workspace.delivery;
  return delivery ? { deliverer: delivery.deliverer || null, fee: delivery.fee } : null;
}

function workspaceCustomer(workspace: PosWorkspace): CustomerPrint | null {
  const customer = workspace.customer;
  if (!customer) return null;
  return {
    name: customer.name || null,
    phone: customer.phone || null,
    address: customer.address || null,
  };
}

function workspaceItemCount(workspace: PosWorkspace): string | null {
  const explicit = str(workspace.item_count);
  if (explicit && nonZero(explicit)) return explicit;
  let total = 0;
  let counted = false;
  for (const line of workspace.line_items ?? []) {
    if (line.kind === 'timed') continue;
    const raw = line.sale_quantity ?? line.quantity;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    total += qty;
    counted = true;
  }
  if (!counted) return null;
  const rounded = Math.round(total * 10_000) / 10_000;
  return String(rounded).replace(/\.0+$/, '');
}

const SNAPSHOT_TYPES: Record<string, ReceiptDocumentType> = {
  sale: 'sale',
  return: 'return',
  return_supplement: 'return',
  refund: 'refund',
  shift_closure: 'shift_closure',
};

// The template a posted receipt prints with: a return supplement uses the
// return template.
export function snapshotDocumentType(
  receipt: Pick<ReceiptSnapshot, 'source_type'>,
): ReceiptDocumentType {
  return SNAPSHOT_TYPES[receipt.source_type] ?? 'sale';
}

export type SnapshotPrintInfo = Pick<ReceiptPrint, 'copy_number'> & {
  printed_at?: string | null;
};

// A posted document from its server snapshot.
export function snapshotData(
  receipt: ReceiptSnapshot,
  t: Translate,
  print?: SnapshotPrintInfo | null,
): TemplateData {
  const document = receipt.document;
  const currency = str(document.currency) ?? 'VND';
  const zone = str(document.timezone) ?? 'Asia/Ho_Chi_Minh';
  const money = (value: unknown) => formatMoney(str(value), currency);
  const atIso = str(document.at) ?? receipt.issued_at;
  const time = formatDocumentTime(atIso, zone);
  const businessDate = formatBusinessDate(str(document.business_date));
  const taxesText = taxesSummary(document.taxes, currency, t);
  const cashier = str(document.cashier);
  const table = tableData(document.table, t);
  const meta: DataRow<MetaField>[] = [timeRow('time', t('receiptTime'), atIso, zone)];
  if (businessDate)
    meta.push({ field: null, label: t('receiptBusinessDate'), value: businessDate });
  if (table) {
    const oneLine = table.area ? `${table.area} - ${table.name}` : table.name;
    meta.push({ field: 'table', label: t('receiptTable'), value: oneLine });
  }
  const checkInIso = str(document.check_in_at);
  if (checkInIso) {
    meta.push(timeRow('check_in', t('receiptCheckIn'), checkInIso, zone));
    if (atIso) meta.push(timeRow('check_out', t('receiptCheckOut'), atIso, zone));
    const dur = formatDurationBetween(checkInIso, atIso, t);
    if (dur) meta.push({ field: 'duration', label: t('receiptDuration'), value: dur });
  }
  if (str(document.call_number))
    meta.push({
      field: 'call_number',
      label: t('receiptCallNumber'),
      value: str(document.call_number) ?? '',
    });
  const sourceLabel = orderSourceLabel(document.order_source, t);
  if (sourceLabel)
    meta.push({ field: 'order_source', label: t('receiptOrderSource'), value: sourceLabel });
  if (cashier) meta.push({ field: 'cashier', label: t('receiptCashier'), value: cashier });
  if (str(document.order_number))
    meta.push({
      field: 'order_number',
      label: t('receiptOrderNumber'),
      value: str(document.order_number) ?? '',
    });
  if (str(document.return_number))
    meta.push({
      field: 'return_number',
      label: t('receiptReturnNumber'),
      value: str(document.return_number) ?? '',
    });
  const customer = obj(document.customer);
  meta.push(
    ...customerRows(
      customer && {
        name: str(customer.name),
        phone: str(customer.phone),
        address: str(customer.address),
      },
      t,
    ),
  );
  if (print) {
    const printedIso = str(print.printed_at);
    if (printedIso) meta.push(timeRow('printed_at', t('receiptPrintedAt'), printedIso, zone));
    if (typeof print.copy_number === 'number' && Number.isInteger(print.copy_number))
      meta.push({
        field: 'print_count',
        label: t('receiptPrintCount'),
        value: String(print.copy_number + 1),
      });
  }

  const insertBeforePrintMeta = (extra: DataRow<MetaField>[]) => {
    if (extra.length === 0) return;
    const at = meta.findIndex(
      (entry) => entry.field === 'printed_at' || entry.field === 'print_count',
    );
    if (at < 0) meta.push(...extra);
    else meta.splice(at, 0, ...extra);
  };

  let lines: LineData[] = [];
  let totals: DataRow<TotalField>[] = [];
  let payments: DataRow<PaymentField>[] = [];
  let payQr: PrintPayQr | null = null;
  let transferQr: PrintQr | null = null;
  const notes: string[] = [];
  switch (receipt.source_type) {
    case 'sale': {
      const deliveryDoc = obj(document.delivery);
      const delivery = deliveryDoc && {
        deliverer: str(deliveryDoc.deliverer),
        fee: str(deliveryDoc.fee),
      };
      insertBeforePrintMeta(deliveryMetaRows(delivery, t));
      lines = rows(document.lines).map((line) => saleLine(line, currency, zone, t));
      totals = withDeliveryFee(saleTotals(document, currency, t), delivery, currency, t);
      payments = salePayments(document, currency, t);
      payQr = payQrPrint(payLaterQr(obj(document.credit)?.pay_qr), t);
      transferQr = transferQrPrint(document.transfer_qr, t);
      if (str(document.note)) notes.push(str(document.note) ?? '');
      break;
    }
    case 'return':
      lines = rows(document.lines).map((line) => {
        const note = str(line.note);
        return {
          ...emptyLine(str(line.name) ?? ''),
          sku: str(line.sku),
          amount: money(line.amount),
          amountCell: bare(str(line.amount), currency),
          lineNote: note ? `* ${note}` : null,
          notes: [
            t('receiptReturnedQuantity', {
              quantity: formatQuantity(line.quantity as string | number),
            }),
            t(
              line.condition === 'damaged'
                ? 'receiptConditionDamaged'
                : 'receiptConditionResellable',
            ),
          ],
        };
      });
      totals = [
        {
          field: 'total',
          label: t('receiptReturnValue'),
          value: money(document.entitlement_total),
          strong: true,
        },
      ];
      if (document.entitlement_posted) {
        if (nonZero(str(document.credit_note_amount)))
          totals.push({
            field: null,
            label: t('receiptCreditNote'),
            value: money(document.credit_note_amount),
          });
        totals.push({
          field: null,
          label: t('receiptRefundEntitlement'),
          value: money(document.refund_entitlement),
        });
      } else {
        notes.push(t('receiptReturnPending'));
      }
      if (str(document.reason)) notes.push(t('receiptReason', { reason: str(document.reason) }));
      break;
    case 'refund':
      payments = [
        {
          // The refunded amount is the slip's total and always prints.
          field: null,
          label: str(document.method) === 'cash' ? t('receiptRefundCash') : t('receiptRefundBank'),
          value: money(document.amount),
          strong: true,
        },
      ];
      if (str(document.reference))
        payments.push({
          field: 'reference',
          label: t('receiptReference'),
          value: str(document.reference) ?? '',
        });
      break;
    case 'shift_closure': {
      const closureMeta: DataRow<MetaField>[] = [
        {
          field: null,
          label: t('receiptShiftOpened'),
          value: formatDocumentTime(str(document.opened_at), zone),
        },
      ];
      if (str(document.closer))
        closureMeta.push({
          field: null,
          label: t('receiptCloser'),
          value: str(document.closer) ?? '',
        });
      if (str(document.approver))
        closureMeta.push({
          field: null,
          label: t('receiptApprover'),
          value: str(document.approver) ?? '',
        });
      insertBeforePrintMeta(closureMeta);
      totals = [
        { field: null, label: t('receiptOpeningFloat'), value: money(document.opening_float) },
        { field: null, label: t('receiptInflow'), value: money(document.inflow_total) },
        { field: null, label: t('receiptOutflow'), value: money(document.outflow_total) },
        {
          field: null,
          label: t('receiptExpected'),
          value: money(document.expected),
          strong: true,
        },
        { field: null, label: t('receiptCounted'), value: money(document.counted), strong: true },
        {
          field: null,
          label: t('receiptVariance'),
          value: money(document.variance),
          strong: true,
        },
      ];
      if (str(document.reason)) notes.push(t('receiptReason', { reason: str(document.reason) }));
      break;
    }
  }
  if (receipt.issued_late) notes.push(t('receiptIssuedLate'));
  const branch = obj(document.branch);
  return {
    documentType: snapshotDocumentType(receipt),
    title: str(document.title) ?? receipt.number,
    number: receipt.number,
    banner: null,
    store: storeFromSnapshot(obj(document.store), t),
    branch: {
      name: str(branch?.name),
      code: str(branch?.code),
      returnWindowDays: int(branch?.return_window_days),
    },
    register: str(document.register),
    cashier,
    time,
    businessDate,
    table,
    callNumber: str(document.call_number),
    guestName: str(document.guest_name),
    taxesText,
    customerName: str(customer?.name),
    customerPhone: str(customer?.phone),
    customerAddress: str(customer?.address),
    meta,
    lines,
    lineLabels: lineLabels(t),
    signatureLabels: signatureLabels(t),
    totals,
    payments,
    payQr,
    transferQr,
    notes,
    disclaimer: receipt.disclaimer,
    einvoice: einvoiceData(receipt, t),
  };
}

function einvoiceNumberText(einvoice: Doc | null): string | null {
  const number = str(einvoice?.number);
  if (!number) return null;
  const prefix = [str(einvoice?.template_code), str(einvoice?.symbol)].filter(Boolean).join('');
  return prefix ? `${prefix} - ${number}` : number;
}

function einvoiceData(receipt: ReceiptSnapshot, t: Translate): TemplateData['einvoice'] {
  const einvoice = obj(receipt.einvoice);
  if (!einvoice)
    return {
      lookupCode: null,
      lookupUrl: null,
      buyerUrl: null,
      buyerCaption: null,
    };
  const buyerUrl = str(einvoice.buyer_url);
  const lookupUrl = str(einvoice.lookup_url);
  const lookupCode = str(einvoice.lookup_code);
  const sellerTax = str(einvoice.seller_tax_code);
  const cqtCode = str(einvoice.cqt_code);
  const numberText = einvoiceNumberText(einvoice);

  const sectionRows: DataRow<EinvoiceField>[] = [];
  if (sellerTax)
    sectionRows.push({
      field: 'seller_tax_code',
      label: t('receiptEinvoiceSellerTaxCode'),
      value: sellerTax,
    });
  if (numberText)
    sectionRows.push({
      field: 'number',
      label: t('receiptEinvoiceNumber'),
      value: numberText,
    });
  if (lookupCode)
    sectionRows.push({
      field: 'lookup_code',
      label: t('receiptEinvoiceLookupCode'),
      value: lookupCode,
    });
  if (cqtCode)
    sectionRows.push({
      field: 'cqt_code',
      label: t('receiptEinvoiceCqtCode'),
      value: cqtCode,
    });
  if (lookupUrl)
    sectionRows.push({
      field: 'lookup_url',
      label: t('receiptEinvoiceLookupUrl'),
      value: lookupUrl,
    });

  const qr: PrintQr | null = buyerUrl
    ? { value: buyerUrl, caption: t('receiptEinvoiceBuyerCaption'), lines: [] }
    : lookupUrl
      ? { value: lookupUrl, caption: t('receiptEinvoiceQrCaption'), lines: [] }
      : null;

  return {
    lookupCode,
    lookupUrl,
    buyerUrl,
    buyerCaption: buyerUrl ? t('receiptEinvoiceBuyerCaption') : null,
    rows: sectionRows,
    qr,
  };
}

function placeData(place: PrintPlace, t: Translate) {
  return {
    store: storeFromProfile(place.storeName, place.storeProfile, t),
    branch: {
      name: place.branchName || null,
      code: place.branchCode || null,
      returnWindowDays: place.returnWindowDays ?? null,
    },
    register: place.registerName || null,
  };
}

// A clock still running is not on the order yet: its line shows the
// server's quote and the time it was read ("Tạm tính đến 22:40: …").
function timedEstimate(
  line: PosLineItem,
  money: (value: string | null | undefined) => string,
  t: Translate,
  timeZone: string,
): string[] {
  const quote = line.timed_session?.quote;
  if (line.kind !== 'timed' || !quote || quote.final === true || !str(quote.as_of)) return [];
  const time = formatDocumentTime(quote.as_of, timeZone).slice(-5);
  return [t('receiptTimedEstimate', { time, amount: money(str(quote.amount)) })];
}

// A provisional bill of an open order: server figures as they stand, always
// labelled as not paid and never numbered as a receipt.
export function prebillData(
  workspace: PosWorkspace,
  place: PrintPlace,
  t: Translate,
  now: Date = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): TemplateData {
  const currency = workspace.totals?.currency ?? 'VND';
  const money = (value: string | null | undefined) => formatMoney(value ?? null, currency);
  const totals = workspace.totals;
  const nowIso = now.toISOString();
  const time = formatDocumentTime(nowIso, timeZone);
  const table = workspaceTableData(workspace, t);
  const lines = (workspace.line_items ?? []).map((line): LineData => {
    const price = line.unit_price ?? line.price;
    const amount = line.item_net_amount ?? line.net_amount ?? line.amount;
    const [originalPrice, originalPriceCell] = originalPricePair(
      line.original_price,
      price,
      currency,
    );
    const barcode = line.barcode?.trim() || null;
    const note = line.note?.trim() || null;
    const trace = (line.serial_codes ?? []).map((serial) => t('receiptSerial', { serial }));
    if (line.lot_code) trace.push(t('receiptLot', { lot: line.lot_code }));
    return {
      ...emptyLine(line.name),
      sku: line.sku || null,
      barcodeText: barcode ? t('receiptBarcode', { barcode }) : null,
      quantity: formatQuantity(line.sale_quantity ?? line.quantity),
      unit: line.sale_unit || null,
      originalPrice,
      originalPriceCell,
      price: money(price),
      priceCell: bare(price, currency),
      amount: money(amount),
      amountCell: bare(amount, currency),
      trace,
      lineNote: note ? `* ${note}` : null,
      notes: [...menuNotes(line as unknown as Doc), ...timedEstimate(line, money, t, timeZone)],
    };
  });
  const totalRows: DataRow<TotalField>[] = [];
  if (totals) {
    const itemCount = workspaceItemCount(workspace);
    if (itemCount)
      totalRows.push({
        field: 'item_count',
        label: t('receiptItemCount'),
        value: formatQuantity(itemCount),
      });
    totalRows.push({
      field: 'item_total',
      label: t('receiptItemTotal'),
      value: money(totals.item_total),
    });
    if (nonZero(totals.discount_total))
      totalRows.push({
        field: 'discount',
        label: t('receiptDiscount'),
        value: money(totals.discount_total),
      });
    totalRows.push(...promotionRows(workspace.promotions, currency, t));
    // A VIP table's minimum spend shows as its own row.
    for (const fee of totals.fees ?? []) {
      if (fee.kind === 'minimum_spend' && nonZero(fee.amount))
        totalRows.push({ field: null, label: t('receiptMinimumSpend'), value: money(fee.amount) });
    }
    totalRows.push(...feeRows(totals.fees, currency, t, true));
    totalRows.push(...taxTableRows(totals.taxes, currency, t));
    totalRows.push({
      field: 'total',
      label: t('receiptTotal'),
      value: money(totals.total),
      strong: true,
    });
    // The drink credit of door tickets left unused.
    if (workspace.drink_credit)
      totalRows.push({
        field: null,
        label: t('receiptDrinkCreditLeft'),
        value: money(workspace.drink_credit.remaining),
      });
  }
  const payments: DataRow<PaymentField>[] = workspace.financial
    ? [
        {
          field: 'paid_total',
          label: t('receiptPaidTotal'),
          value: money(workspace.financial.allocated),
        },
        {
          field: null,
          label: t('receiptRemaining'),
          value: money(workspace.financial.remaining),
          strong: true,
        },
      ]
    : [];

  const meta: DataRow<MetaField>[] = [timeRow('time', t('receiptTime'), nowIso, timeZone)];
  if (table) {
    const oneLine = table.area ? `${table.area} - ${table.name}` : table.name;
    meta.push({ field: 'table', label: t('receiptTable'), value: oneLine });
  }
  const openedIso = str(workspace.opened_at);
  if (openedIso) {
    meta.push(timeRow('check_in', t('receiptCheckIn'), openedIso, timeZone));
    const dur = formatDurationBetween(openedIso, nowIso, t);
    if (dur) meta.push({ field: 'duration', label: t('receiptDuration'), value: dur });
  }
  const callNo = workspace.order_number == null ? null : String(workspace.order_number);
  if (callNo) meta.push({ field: 'call_number', label: t('receiptCallNumber'), value: callNo });
  const sourceLabel = orderSourceLabel(workspace.order_source, t);
  if (sourceLabel)
    meta.push({ field: 'order_source', label: t('receiptOrderSource'), value: sourceLabel });
  meta.push(...customerRows(workspaceCustomer(workspace), t));
  meta.push(...deliveryMetaRows(workspaceDelivery(workspace), t));
  meta.push(timeRow('printed_at', t('receiptPrintedAt'), nowIso, timeZone));
  const seq = workspace.prebill?.sequence;
  meta.push({
    field: 'print_count',
    label: t('receiptPrintCount'),
    value: String(typeof seq === 'number' && seq > 0 ? seq : 1),
  });

  return {
    documentType: 'prebill',
    title: t('receiptPrebillTitle'),
    number: null,
    banner: t('receiptPrebillBanner'),
    ...placeData(place, t),
    cashier: null,
    time,
    table,
    businessDate: formatBusinessDate(workspace.business_date ?? null),
    callNumber: callNo,
    guestName: workspace.guest_name || null,
    taxesText: taxesSummary(workspace.totals?.taxes, currency, t),
    customerName: workspace.customer?.name || null,
    customerPhone: workspace.customer?.phone || null,
    customerAddress: workspace.customer?.address || null,
    meta,
    lines,
    lineLabels: lineLabels(t),
    signatureLabels: signatureLabels(t),
    totals: withDeliveryFee(totalRows, workspaceDelivery(workspace), currency, t),
    payments,
    transferQr: transferQrPrint(workspace.transfer_qr, t),
    // The order note carries what the customer asked for in their message.
    notes: [workspace.note?.trim(), t('receiptPrebillNote')].filter((note): note is string =>
      Boolean(note),
    ),
    disclaimer: t('receiptDisclaimer'),
  };
}

export type PaymentTicketInput = {
  workspace: PosWorkspace;
  attempts: PosFinancialAttempt[];
  handed: string | null;
  change: string | null;
  names: PrintPlace & { cashier?: string | null };
};

// The payment invoice handed over at the counter: the order as it is being
// paid. The change is the one already shown to the cashier on screen.
export function paymentTicketData(
  input: PaymentTicketInput,
  t: Translate,
  now: Date = new Date(),
  timeZone = 'Asia/Ho_Chi_Minh',
): TemplateData {
  const { workspace, attempts, handed, change, names } = input;
  const currency = workspace.totals?.currency ?? attempts[0]?.currency ?? 'VND';
  const money = (value: string | null | undefined) => formatMoney(value ?? null, currency);
  const nowIso = now.toISOString();
  const time = formatDocumentTime(nowIso, timeZone);
  const table = workspaceTableData(workspace, t);
  const meta: DataRow<MetaField>[] = [timeRow('time', t('receiptTime'), nowIso, timeZone)];
  if (table) {
    const oneLine = table.area ? `${table.area} - ${table.name}` : table.name;
    meta.push({ field: 'table', label: t('receiptTable'), value: oneLine });
  }
  const openedIso = str(workspace.opened_at);
  if (openedIso) {
    meta.push(timeRow('check_in', t('receiptCheckIn'), openedIso, timeZone));
    meta.push(timeRow('check_out', t('receiptCheckOut'), nowIso, timeZone));
    const dur = formatDurationBetween(openedIso, nowIso, t);
    if (dur) meta.push({ field: 'duration', label: t('receiptDuration'), value: dur });
  }
  const callNo = workspace.order_number == null ? null : String(workspace.order_number);
  if (callNo) meta.push({ field: 'call_number', label: t('receiptCallNumber'), value: callNo });
  const sourceLabel = orderSourceLabel(workspace.order_source, t);
  if (sourceLabel)
    meta.push({ field: 'order_source', label: t('receiptOrderSource'), value: sourceLabel });
  if (workspace.order_id)
    meta.push({ field: 'order_number', label: t('ticketOrder'), value: workspace.order_id });
  if (names.cashier)
    meta.push({ field: 'cashier', label: t('receiptCashier'), value: names.cashier });
  meta.push(...customerRows(workspaceCustomer(workspace), t, t('customerWalkIn')));
  meta.push(...deliveryMetaRows(workspaceDelivery(workspace), t));
  meta.push(timeRow('printed_at', t('receiptPrintedAt'), nowIso, timeZone));
  meta.push({ field: 'print_count', label: t('receiptPrintCount'), value: '1' });

  const lines = (workspace.line_items ?? []).map((line): LineData => {
    const price = lineUnitPrice(line);
    const discount = lineDiscount(line);
    const amount = line.item_net_amount ?? line.net_amount ?? line.amount;
    const [originalPrice, originalPriceCell] = originalPricePair(
      line.original_price ?? line.list_price,
      price,
      currency,
    );
    const barcode = line.barcode?.trim() || null;
    const note = line.note?.trim() || null;
    const trace = (line.serial_codes ?? []).map((serial) => t('receiptSerial', { serial }));
    if (line.lot_code) trace.push(t('receiptLot', { lot: line.lot_code }));
    return {
      ...emptyLine(line.name),
      sku: line.sku || null,
      barcodeText: barcode ? t('receiptBarcode', { barcode }) : null,
      quantity: formatQuantity(line.sale_quantity ?? line.quantity),
      unit: line.sale_unit || null,
      originalPrice,
      originalPriceCell,
      price: money(price),
      priceCell: bare(price, currency),
      discountNote: discount ? t('receiptLineDiscount', { amount: money(discount) }) : null,
      discountCell: discount ? bare(discount, currency) : '',
      amount: money(amount),
      amountCell: bare(amount, currency),
      trace,
      lineNote: note ? `* ${note}` : null,
      notes: menuNotes(line as unknown as Doc),
    };
  });

  const totals: DataRow<TotalField>[] = [];
  if (workspace.totals) {
    const itemCount = workspaceItemCount(workspace);
    if (itemCount)
      totals.push({
        field: 'item_count',
        label: t('receiptItemCount'),
        value: formatQuantity(itemCount),
      });
    totals.push({
      field: 'item_total',
      label: t('receiptItemTotal'),
      value: money(workspace.totals.item_total),
    });
    if (nonZero(workspace.totals.discount_total))
      totals.push({
        field: 'discount',
        label: t('receiptDiscount'),
        labelSuffix: workspace.coupon ? ` (${workspace.coupon.code})` : undefined,
        value: money(workspace.totals.discount_total),
      });
    totals.push(...promotionRows(workspace.promotions, currency, t));
    totals.push(...feeRows(workspace.totals.fees, currency, t));
    const breakdown = taxTableRows(workspace.totals.taxes, currency, t);
    if (breakdown.length > 0) totals.push(...breakdown);
    else {
      if (nonZero(workspace.totals.additional_tax_total))
        totals.push({
          field: 'tax',
          label: t('receiptTax'),
          value: money(workspace.totals.additional_tax_total),
        });
      if (nonZero(workspace.totals.included_tax_total))
        totals.push({
          field: 'included_tax',
          label: t('receiptIncludedTax'),
          value: money(workspace.totals.included_tax_total),
        });
    }
    totals.push({
      field: 'total',
      label: t('receiptTotal'),
      value: money(workspace.totals.total),
      strong: true,
    });
  }

  const payments: DataRow<PaymentField>[] = [];
  for (const attempt of attempts) {
    payments.push({
      field: 'methods',
      label: methodLabel(attempt.kind, t),
      value: formatMoney(attempt.amount, attempt.currency),
    });
    if (attempt.kind === 'cash' && handed !== null) {
      payments.push({
        field: 'handed',
        label: t('receiptHanded'),
        value: formatMoney(handed, attempt.currency),
      });
      if (change !== null && nonZero(change))
        payments.push({
          field: 'change',
          label: t('receiptChange'),
          value: formatMoney(change, attempt.currency),
        });
    }
  }

  return {
    documentType: 'payment_ticket',
    title: t('ticketTitle'),
    number: null,
    banner: null,
    ...placeData(names, t),
    cashier: names.cashier || null,
    time,
    table,
    businessDate: formatBusinessDate(workspace.business_date ?? null),
    callNumber: callNo,
    guestName: workspace.guest_name || null,
    taxesText: taxesSummary(workspace.totals?.taxes, currency, t),
    customerName: workspace.customer?.name || null,
    customerPhone: workspace.customer?.phone || null,
    customerAddress: workspace.customer?.address || null,
    meta,
    lines,
    lineLabels: lineLabels(t),
    signatureLabels: signatureLabels(t),
    totals: withDeliveryFee(totals, workspaceDelivery(workspace), currency, t),
    payments,
    transferQr: transferQrPrint(workspace.transfer_qr, t),
    notes: [],
    disclaimer: null,
  };
}
