import {
  labelsPerPage,
  PRODUCT_LABEL_PRESETS,
  productLabelPreset,
} from '@shared/product-label/presets'
import type {
  ProductLabelPaper,
  ProductLabelPreset,
} from '@shared/product-label/types'
import { Label, RadioGroup, RadioGroupItem } from '@spree/dashboard-ui'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

export const LABEL_PAPER_GROUPS = ['roll1', 'roll2', 'roll3', 'a4', 'a5'] as const
export type LabelPaperGroup = (typeof LABEL_PAPER_GROUPS)[number]

// The family a stock belongs to: roll stocks by stickers per row, sheets by size.
export function labelPaperGroup(paper: ProductLabelPaper): LabelPaperGroup {
  const preset = productLabelPreset(paper)
  if (preset.kind === 'roll')
    return preset.columns === 1 ? 'roll1' : preset.columns === 2 ? 'roll2' : 'roll3'
  return preset.sheet_mm.width === 148 ? 'a5' : 'a4'
}

const mm = (value: number) => String(Number(value.toFixed(2)))

// "50 × 30 mm" for one sticker.
export const labelSizeText = (preset: ProductLabelPreset) =>
  `${mm(preset.label_mm.width)} × ${mm(preset.label_mm.height)} mm`

export function LabelPaperPicker({
  value,
  onChange,
  disabled,
}: {
  value: ProductLabelPaper
  onChange: (paper: ProductLabelPaper) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('pos')
  const id = useId()
  return (
    <div className="grid gap-3">
      <Label id={`${id}-label`}>{t('productLabels.paper.label')}</Label>
      <RadioGroup
        className="grid gap-4"
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange(next as ProductLabelPaper)}
        aria-labelledby={`${id}-label`}
      >
        {LABEL_PAPER_GROUPS.map((group) => (
          <div key={group} className="grid gap-2">
            <small className="font-medium text-muted-foreground">
              {t(`productLabels.group.${group}`)}
            </small>
            <div className="grid gap-2 sm:grid-cols-2">
              {PRODUCT_LABEL_PRESETS.filter((preset) => labelPaperGroup(preset.code) === group).map(
                (preset) => (
                  <div
                    key={preset.code}
                    className="flex items-start gap-2 rounded-lg border px-3 py-2 has-data-[checked]:border-primary"
                  >
                    <RadioGroupItem
                      id={`${id}-${preset.code}`}
                      value={preset.code}
                      className="mt-1"
                    />
                    <Label htmlFor={`${id}-${preset.code}`} className="grid cursor-pointer gap-0.5">
                      <span className="font-medium">
                        {t(`productLabels.paperName.${preset.code}`)}
                      </span>
                      <small className="font-normal text-muted-foreground">
                        {t(
                          preset.kind === 'roll'
                            ? 'productLabels.paper.detailRoll'
                            : 'productLabels.paper.detailSheet',
                          { size: labelSizeText(preset), perPage: labelsPerPage(preset) },
                        )}
                      </small>
                    </Label>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}
