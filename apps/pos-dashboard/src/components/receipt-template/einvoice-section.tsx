import type {
  EinvoiceField,
  EinvoiceSection,
  PaperSize,
  QrCaptionPosition,
  QrSize,
} from '@parkviet/pos-shared/receipt-template/types'
import { useTranslation } from 'react-i18next'
import { Problem, SegmentedChoice } from './controls'
import { FieldToggles } from './field-toggles'

const QR_SIZES: readonly QrSize[] = ['s', 'm', 'l']
const QR_CAPTIONS: readonly QrCaptionPosition[] = ['below', 'above', 'left', 'right']

export function QrLayoutControls({
  paper,
  size,
  captionPosition,
  readOnly,
  sizeProblem,
  captionProblem,
  onSizeChange,
  onCaptionChange,
}: {
  paper: PaperSize
  size: QrSize | undefined
  captionPosition: QrCaptionPosition | undefined
  readOnly: boolean
  sizeProblem?: string | null
  captionProblem?: string | null
  onSizeChange: (size: QrSize) => void
  onCaptionChange: (pos: QrCaptionPosition) => void
}) {
  const { t } = useTranslation('pos')
  const pos = captionPosition ?? 'below'
  const narrowSide = paper === '58mm' && (pos === 'left' || pos === 'right')

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <SegmentedChoice
            label={t('receiptTemplates.qr.size')}
            value={size ?? 'm'}
            disabled={readOnly}
            invalid={Boolean(sizeProblem)}
            options={QR_SIZES.map((item) => ({
              value: item,
              label: t(`receiptTemplates.size.${item}`),
            }))}
            onChange={onSizeChange}
          />
          <Problem>{sizeProblem}</Problem>
        </div>
        <div className="grid gap-1.5">
          <SegmentedChoice
            label={t('receiptTemplates.qr.captionPosition')}
            value={pos}
            disabled={readOnly}
            invalid={Boolean(captionProblem)}
            options={QR_CAPTIONS.map((item) => ({
              value: item,
              label: t(`receiptTemplates.qr.caption_${item}`),
            }))}
            onChange={onCaptionChange}
          />
          <Problem>{captionProblem}</Problem>
        </div>
      </div>
      {narrowSide ? (
        <small className="text-xs text-muted-foreground">
          {t('receiptTemplates.qr.narrowPaperNote')}
        </small>
      ) : null}
    </div>
  )
}

export function EinvoiceSectionFields({
  paper,
  fields,
  value,
  readOnly,
  invalid,
  fieldProblem,
  onChange,
  onRelabel,
}: {
  paper: PaperSize
  fields: readonly EinvoiceField[]
  value: EinvoiceSection
  readOnly: boolean
  invalid: (field: EinvoiceField) => string | null
  fieldProblem: (key: string) => string | null
  onChange: (next: EinvoiceSection) => void
  onRelabel: (next: EinvoiceSection, field: EinvoiceField) => void
}) {
  const { t } = useTranslation('pos')
  const hasQr = value.fields.includes('qr')

  return (
    <div className="grid gap-4">
      <FieldToggles
        section="einvoice"
        documentType="sale"
        fields={fields}
        value={value}
        readOnly={readOnly}
        invalid={invalid}
        onChange={(next) => onChange({ ...value, ...next })}
        onRelabel={(next, field) => onRelabel({ ...value, ...next }, field)}
      />

      {hasQr ? (
        <QrLayoutControls
          paper={paper}
          size={value.qr_size}
          captionPosition={value.qr_caption}
          readOnly={readOnly}
          sizeProblem={fieldProblem('qr_size')}
          captionProblem={fieldProblem('qr_caption')}
          onSizeChange={(qr_size) => onChange({ ...value, qr_size })}
          onCaptionChange={(qr_caption) => onChange({ ...value, qr_caption })}
        />
      ) : null}

      {value.fields.length === 0 ? (
        <small className="text-xs text-muted-foreground">
          {t('receiptTemplates.einvoice.legacyFallbackHint')}
        </small>
      ) : null}
    </div>
  )
}
