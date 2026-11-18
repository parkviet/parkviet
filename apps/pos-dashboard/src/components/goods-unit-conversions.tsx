import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { Button } from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVariantUnits, type VariantUnitRow } from '../hooks/use-goods-products'
import { VariantUnitEditor } from './variant-unit-editor'

// How each variant is sold and converted ("1 Lốc = 4 chai"). The conversion
// is the store-wide `variant_units` row, set in the same editor as the
// branch Products tab through a branch that sells the product.
export function conversionText(
  unit: Pick<
    VariantUnitRow,
    'sale_unit' | 'sale_unit_name' | 'base_unit' | 'ratio_numerator' | 'ratio_denominator'
  >,
) {
  const numerator = unit.ratio_numerator ?? 1
  const denominator = unit.ratio_denominator ?? 1
  const base = unit.base_unit ?? unit.sale_unit
  if (base === unit.sale_unit && numerator === denominator) return unit.sale_unit_name
  const ratio = denominator === 1 ? String(numerator) : `${numerator}/${denominator}`
  return `1 ${unit.sale_unit_name} = ${ratio} ${base}`
}

export function GoodsUnitConversions({
  product,
  variants,
  branchId,
  storeId,
  canWrite,
}: {
  product: { id: string; name: string; status: string }
  variants: { id: string; label: string }[]
  // A branch selling the product; null while it is sold nowhere.
  branchId: string | null
  storeId: string
  canWrite: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const units = useVariantUnits(variants.map((variant) => variant.id))
  if (!branchId)
    return (
      <p className="text-sm text-muted-foreground">{t('goods.products.form.units.noBranch')}</p>
    )
  const unitOf = new Map((units.data ?? []).map((row) => [row.variant_id, row]))
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('goods.products.form.units.hint')}</p>
      {units.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{describeFailure(units.error, t)}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void units.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <ul className="space-y-1 text-sm" aria-busy={units.isPending}>
          {variants.map((variant) => {
            const unit = unitOf.get(variant.id)
            return (
              <li key={variant.id} className="flex justify-between gap-4">
                <span>{variant.label}</span>
                <span className="text-muted-foreground">
                  {unit ? conversionText(unit) : units.isPending ? t('waiting') : '—'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          {t(canWrite ? 'goods.products.form.units.edit' : 'goods.products.form.units.view')}
        </Button>
        <Link to="/$storeId/units" params={{ storeId }} className="text-sm underline">
          {t('goods.products.form.units.manage')}
        </Link>
      </div>
      {open && (
        <VariantUnitEditor
          branchId={branchId}
          storeId={storeId}
          product={{
            id: product.id,
            name: product.name,
            status: product.status,
            skus: [],
            assigned: true,
          }}
          canWrite={canWrite}
          onClose={() => {
            setOpen(false)
            void units.refetch()
          }}
        />
      )}
    </div>
  )
}
