import { Button } from '@spree/dashboard-ui'
import { Trash2Icon } from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'
import { type ComboRow, comboQuantityValid, withComboRow } from '../lib/product-operations'
import { ProductSearch } from './product-search'
import { Input, TopologyField } from './topology-fields'

// The contents of a combo: variants of other products, each with how many
// come in one combo. No row is a single product. The product form and the
// menu screen's combo dialog edit the same rows.
export function GoodsComboEditor({
  rows,
  onChange,
  branchId,
  checked,
  disabled,
}: {
  rows: ComboRow[]
  onChange: (rows: ComboRow[]) => void
  // The branch whose catalogue the variant search reads.
  branchId: string | null
  // Show quantity problems (after a save was tried).
  checked: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const update = (index: number, quantity: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, quantity } : row)))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('goods.products.form.combo.hint')}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.products.form.combo.empty')}</p>
      ) : (
        <ul className="space-y-2" aria-label={t('goods.products.form.combo.title')}>
          {rows.map((row, index) => {
            const invalid = checked && !comboQuantityValid(row.quantity)
            return (
              <li key={row.variantId} className="flex flex-wrap items-end gap-2">
                <span className="min-w-0 flex-1 pb-2 font-medium">{row.name}</span>
                <div className="w-28">
                  <TopologyField
                    label={t('goods.products.form.combo.quantity')}
                    error={invalid ? t('goods.products.form.errors.comboQuantity') : undefined}
                  >
                    {(id, describedBy) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid}
                        inputMode="numeric"
                        disabled={disabled}
                        value={row.quantity}
                        onChange={(event) => update(index, event.target.value)}
                      />
                    )}
                  </TopologyField>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={disabled}
                  aria-label={t('goods.products.form.combo.remove', { name: row.name })}
                  onClick={() => onChange(rows.filter((_, at) => at !== index))}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {!disabled && (
        <ProductSearch
          branchId={branchId}
          label={t('goods.products.form.combo.add')}
          onPick={(hit) => onChange(withComboRow(rows, hit))}
        />
      )}
    </div>
  )
}
