import { MAX_LABEL_LENGTH } from '@parkviet/pos-shared/receipt-template/render'
import type { FieldSection, ReceiptDocumentType } from '@parkviet/pos-shared/receipt-template/types'
import { FIXED_LABELS } from '@parkviet/pos-shared/receipt-template/validate'
import { Badge, Input } from '@spree/dashboard-ui'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Problem } from './controls'

export type FieldSectionName = 'meta' | 'totals' | 'payments' | 'einvoice'
const DEFAULT_LABEL_KEYS: Record<FieldSectionName, Record<string, string>> = {
  meta: {
    time: 'receiptTime',
    cashier: 'receiptCashier',
    register: 'receiptTemplates.fields.meta.register',
    branch: 'receiptTemplates.fields.meta.branch',
    order_number: 'receiptOrderNumber',
    return_number: 'receiptReturnNumber',
    customer: 'receiptCustomer',
    table: 'receiptTable',
    check_in: 'receiptCheckIn',
    check_out: 'receiptCheckOut',
    duration: 'receiptDuration',
    call_number: 'receiptCallNumber',
    order_source: 'receiptOrderSource',
    printed_at: 'receiptPrintedAt',
    print_count: 'receiptPrintCount',
  },
  totals: {
    item_count: 'receiptItemCount',
    item_total: 'receiptItemTotal',
    discount: 'receiptDiscount',
    promotions: 'receiptPromotion',
    shipping: 'receiptDeliveryFee',
    fees: 'receiptFee',
    tax: 'receiptTax',
    included_tax: 'receiptIncludedTax',
    total: 'receiptTotal',
  },
  payments: {
    methods: 'receiptTemplates.fields.payments.methods',
    handed: 'receiptHanded',
    change: 'receiptChange',
    reference: 'receiptReference',
    paid_total: 'receiptPaidTotal',
    debt: 'receiptDebt',
    previous_debt: 'receiptPreviousDebt',
    customer_debt: 'receiptCustomerDebt',
    due_on: 'receiptDueOn',
    pay_qr: 'receiptPayQrCaption',
    transfer_qr: 'receiptTransferQrCaption',
  },
  einvoice: {
    seller_tax_code: 'receiptEinvoiceSellerTaxCode',
    number: 'receiptEinvoiceNumber',
    lookup_code: 'receiptEinvoiceLookupCode',
    cqt_code: 'receiptEinvoiceCqtCode',
    lookup_url: 'receiptEinvoiceLookupUrl',
    qr: 'receiptEinvoiceQrCaption',
  },
}

function defaultLabelKey(section: FieldSectionName, field: string, type: ReceiptDocumentType) {
  if (section === 'meta' && field === 'order_number' && type === 'payment_ticket')
    return 'ticketOrder'
  if (section === 'totals' && field === 'total' && type === 'return') return 'receiptReturnValue'
  return DEFAULT_LABEL_KEYS[section][field] ?? field
}

export function FieldToggles<F extends string>({
  section,
  documentType,
  fields,
  allFields,
  locked = [],
  fieldHints,
  ariaLabel,
  value,
  readOnly,
  invalid,
  onToggle,
  onRelabel,
  onChange,
}: {
  section: FieldSectionName
  documentType: ReceiptDocumentType
  fields: readonly F[]
  allFields?: readonly F[]
  locked?: readonly F[]
  fieldHints?: Partial<Record<F, string>>
  ariaLabel?: string
  value: FieldSection<F>
  readOnly: boolean
  invalid: (field: F) => string | null
  onToggle?: (next: FieldSection<F>) => void
  onRelabel?: (next: FieldSection<F>, field: F) => void
  onChange: (next: FieldSection<F>) => void
}) {
  const { t } = useTranslation('pos')
  const id = useId()
  const enabled = new Set<string>(value.fields)
  const labels = (value.labels ?? {}) as Partial<Record<string, string>>
  const order = allFields ?? fields

  const toggle = (field: F, on: boolean) => {
    const nextSet = new Set<string>(value.fields)
    if (on) nextSet.add(field)
    else nextSet.delete(field)
    const ordered = order.filter((item) => nextSet.has(item))
    const kept = value.fields.filter((item) => !order.includes(item) && nextSet.has(item))
    const updated = { ...value, fields: [...ordered, ...kept] }
    if (onToggle) onToggle(updated)
    else onChange(updated)
  }

  const relabel = (field: F, label: string) => {
    const next = { ...labels }
    if (label === '') delete next[field]
    else next[field] = label
    const updated = { ...value, labels: next as Partial<Record<F, string>> }
    if (onRelabel) onRelabel(updated, field)
    else onChange(updated)
  }

  const labelSectionKey = section === 'totals' ? 'totalsOnly' : section

  return (
    <ul
      className="grid gap-2.5 sm:grid-cols-2"
      aria-label={ariaLabel ?? t(`receiptTemplates.section.${labelSectionKey}`)}
    >
      {fields.map((field) => {
        const isLocked = locked.includes(field)
        const isChecked = isLocked || enabled.has(field)
        const name = t(`receiptTemplates.fields.${section}.${field}`)
        const hint = `${id}-${field}-hint`
        const error = invalid(field)
        const showLabelInput = isChecked || Boolean(error) || Boolean(labels[field])
        const note = fieldHints?.[field]

        return (
          <li
            key={field}
            className="grid content-start gap-2 rounded-lg border bg-background/60 px-3 py-2.5 transition-colors data-[checked=true]:bg-card data-[invalid=true]:border-destructive"
            data-checked={isChecked ? 'true' : undefined}
            data-invalid={error ? 'true' : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <Check
                checked={isChecked}
                disabled={readOnly || isLocked}
                describedBy={isLocked ? hint : undefined}
                onChange={(on) => toggle(field, on)}
              >
                <span className="font-medium text-sm">{name}</span>
              </Check>
              {isLocked ? (
                <Badge id={hint} variant="outline" className="shrink-0 text-xs font-normal">
                  {t('receiptTemplates.locked')}
                </Badge>
              ) : null}
            </div>
            {note ? <small className="text-xs text-muted-foreground">{note}</small> : null}
            {showLabelInput ? (
              section === 'payments' && FIXED_LABELS.includes(field) ? (
                <small className="text-xs text-muted-foreground">
                  {t('receiptTemplates.methodLabelFixed')}
                </small>
              ) : (
                <Input
                  aria-label={t('receiptTemplates.labelFor', { name })}
                  value={labels[field] ?? ''}
                  placeholder={t(defaultLabelKey(section, field, documentType))}
                  maxLength={MAX_LABEL_LENGTH}
                  disabled={readOnly}
                  aria-invalid={error ? true : undefined}
                  className="h-8 text-sm"
                  onChange={(event) => relabel(field, event.target.value)}
                />
              )
            ) : null}
            <Problem>{error}</Problem>
          </li>
        )
      })}
    </ul>
  )
}
