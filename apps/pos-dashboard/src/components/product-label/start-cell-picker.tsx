import type { SheetLabelPreset } from '@parkviet/pos-shared/product-label/types'
import { cn } from '@spree/dashboard-ui'
import { useTranslation } from 'react-i18next'

// The grid of a label sheet, one small button per sticker cell. The cell the
// first label takes is chosen; cells before it stay empty, so a sheet that
// is already partly used can be fed again.
export function StartCellPicker({
  preset,
  value,
  onChange,
}: {
  preset: SheetLabelPreset
  value: number
  onChange: (cell: number) => void
}) {
  const { t } = useTranslation('pos')
  const cells = preset.columns * preset.rows
  return (
    <fieldset className="grid gap-2" data-testid="label-start-cell">
      <legend className="text-sm font-medium">{t('productLabelPrint.startCell')}</legend>
      <div
        className="grid max-h-56 gap-0.5 overflow-auto rounded-md border p-1"
        style={{ gridTemplateColumns: `repeat(${preset.columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cells }, (_, index) => {
          const cell = index + 1
          return (
            <button
              key={cell}
              type="button"
              aria-label={t('productLabelPrint.cell', { n: cell })}
              aria-pressed={cell === value}
              title={t('productLabelPrint.cell', { n: cell })}
              onClick={() => onChange(cell)}
              className={cn(
                'h-5 min-w-0 rounded-sm border text-[10px] leading-none tabular-nums',
                cell < value && 'bg-muted text-muted-foreground line-through',
                cell === value && 'border-primary bg-primary text-primary-foreground',
                cell > value && 'bg-background',
              )}
            >
              {preset.columns <= 12 ? cell : ''}
            </button>
          )
        })}
      </div>
      <small className="text-muted-foreground">
        {t('productLabelPrint.startCellHint', { n: value, total: cells })}
      </small>
    </fieldset>
  )
}
