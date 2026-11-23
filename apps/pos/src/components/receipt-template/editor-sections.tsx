import type { TemplateData } from '@shared/receipt-template/data'
import { MAX_COPIES } from '@shared/receipt-template/render'
import type {
  FieldSection,
  LineColumn,
  LinesSection,
  MetaField,
  MetaSection,
  PageMargins,
  PageSettings,
  PaperSize,
  PaymentsSection,
  ReceiptDocumentType,
  TableStyle,
  TemplateConfig,
  TimedStyle,
  TimeFormat,
} from '@shared/receipt-template/types'
import {
  COPIES_TYPES,
  type IssueArea,
  LOCKED_COLUMNS,
  LOCKED_TOTALS,
  MAX_NAME_LENGTH,
  SECTION_RULES,
  UNPRINTED_META,
} from '@shared/receipt-template/validate'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
} from '@spree/dashboard-ui'
import { AlertTriangleIcon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BlockProblems } from './block-editor'
import { BlockList, type KeyedBlock } from './block-list'
import { Check, Problem, SegmentedChoice } from './controls'
import { EinvoiceSectionFields, QrLayoutControls } from './einvoice-section'
import { FieldToggles } from './field-toggles'
import { PaperPicker } from './paper-picker'
import { RulingPicker } from './ruling-picker'
import { StepperInput } from './stepper-input'

export type EditorSectionId =
  | 'info'
  | 'appearance'
  | 'header'
  | 'meta'
  | 'lines'
  | 'totals'
  | 'payments'
  | 'einvoice'
  | 'footer'

export type SectionGroupToggle = {
  enabled: number
  total: number
  checked: boolean
  indeterminate: boolean
  disabled?: boolean
  onToggle: (next: boolean) => void
}

export function fieldGroupToggle<F extends string>(
  allowed: readonly F[],
  locked: readonly F[],
  section: FieldSection<F>,
  readOnly: boolean,
  onChange: (next: FieldSection<F>) => void,
): SectionGroupToggle {
  const enabledSet = new Set<string>(section.fields)
  const toggleable = allowed.filter((field) => !locked.includes(field))
  const enabledToggleable = toggleable.filter((field) => enabledSet.has(field)).length
  const enabledTotal = allowed.filter(
    (field) => locked.includes(field) || enabledSet.has(field),
  ).length
  const kept = section.fields.filter((field) => !allowed.includes(field))
  return {
    enabled: enabledTotal,
    total: allowed.length,
    checked: toggleable.length > 0 ? enabledToggleable === toggleable.length : enabledTotal > 0,
    indeterminate: enabledToggleable > 0 && enabledToggleable < toggleable.length,
    disabled: readOnly || toggleable.length === 0,
    onToggle: (turnOn) => {
      const next = turnOn ? [...allowed] : allowed.filter((field) => locked.includes(field))
      onChange({ ...section, fields: [...next, ...kept] })
    },
  }
}

export function linesGroupToggle(
  allowedColumns: readonly LineColumn[],
  lines: LinesSection,
  readOnly: boolean,
  onChange: (next: LinesSection) => void,
): SectionGroupToggle {
  const toggleableCols = allowedColumns.filter((col) => !LOCKED_COLUMNS.includes(col))
  const colSet = new Set<string>(lines.columns)
  const enabledToggleable =
    toggleableCols.filter((col) => colSet.has(col)).length +
    (lines.show_trace ? 1 : 0) +
    (lines.show_conversion ? 1 : 0)
  const totalToggleable = toggleableCols.length + 2
  const lockedCount = allowedColumns.length - toggleableCols.length
  return {
    enabled: lockedCount + enabledToggleable,
    total: allowedColumns.length + 2,
    checked: enabledToggleable === totalToggleable,
    indeterminate: enabledToggleable > 0 && enabledToggleable < totalToggleable,
    disabled: readOnly,
    onToggle: (turnOn) =>
      onChange({
        ...lines,
        columns: turnOn
          ? [...allowedColumns]
          : allowedColumns.filter((col) => LOCKED_COLUMNS.includes(col)),
        show_trace: turnOn,
        show_conversion: turnOn,
      }),
  }
}

export function EditorSection({
  id,
  title,
  problems,
  group,
  children,
}: {
  id: EditorSectionId
  title: string
  problems: number
  group?: SectionGroupToggle
  children: ReactNode
}) {
  const { t } = useTranslation('pos')
  return (
    <AccordionItem
      value={id}
      data-section={id}
      data-invalid={problems > 0 || undefined}
      className="overflow-hidden rounded-xl border bg-card last:border-b"
    >
      <div className="flex items-center">
        {group ? (
          <div className="flex items-center pl-4">
            <Checkbox
              checked={group.checked}
              indeterminate={group.indeterminate}
              disabled={group.disabled}
              aria-label={t('receiptTemplates.toggleSection', { title })}
              onCheckedChange={() => group.onToggle(!(group.checked && !group.indeterminate))}
            />
          </div>
        ) : null}
        <AccordionTrigger className={group ? 'pl-3' : undefined}>
          <span>{title}</span>
          {group ? (
            <Badge variant="outline" className="font-normal tabular-nums">
              {t('receiptTemplates.enabledCount', {
                enabled: group.enabled,
                total: group.total,
              })}
            </Badge>
          ) : null}
          {problems > 0 ? (
            <Badge variant="destructive">
              {t('receiptTemplates.problemCount', { count: problems })}
            </Badge>
          ) : null}
        </AccordionTrigger>
      </div>
      <AccordionContent className="grid gap-4 pt-1">{children}</AccordionContent>
    </AccordionItem>
  )
}

export function TemplateInfoFields({
  name,
  paper,
  readOnly,
  busy,
  nameProblem,
  paperProblem,
  onNameChange,
  onPaperChange,
}: {
  name: string
  paper: PaperSize
  readOnly: boolean
  busy: boolean
  nameProblem: string | null
  paperProblem: string | null
  onNameChange: (name: string) => void
  onPaperChange: (paper: PaperSize) => void
}) {
  const { t } = useTranslation('pos')
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="rt-template-name">{t('receiptTemplates.name')}</Label>
        <Input
          id="rt-template-name"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          disabled={readOnly}
          aria-invalid={Boolean(nameProblem)}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <Problem>{nameProblem}</Problem>
      </div>
      <PaperPicker value={paper} disabled={readOnly || busy} onChange={onPaperChange} />
      <Problem>{paperProblem}</Problem>
    </div>
  )
}

const SPACING_PRESETS = [
  { value: '1.15', key: 'compact' },
  { value: '1.35', key: 'normal' },
  { value: '1.5', key: 'relaxed' },
] as const

const DEFAULT_PAPER_MARGIN: Record<PaperSize, number> = {
  '58mm': 2,
  '80mm': 3,
  a6: 6,
  a5: 10,
  a4: 12,
}

const MARGIN_SIDES: readonly (keyof PageMargins)[] = ['top', 'bottom', 'left', 'right']

export function TemplateAppearanceFields({
  documentType,
  paper,
  page,
  readOnly,
  busy,
  fieldProblem,
  onChange,
}: {
  documentType: ReceiptDocumentType
  paper: PaperSize
  page: PageSettings
  readOnly: boolean
  busy: boolean
  fieldProblem: (key: string) => string | null
  onChange: (patch: Partial<PageSettings>, coalesceKey?: string) => void
}) {
  const { t } = useTranslation('pos')
  const spacingStr = String(page.line_spacing)
  const spacingOptions = [
    ...SPACING_PRESETS.map((preset) => ({
      value: preset.value,
      label: t(`receiptTemplates.spacing.${preset.key}`),
    })),
    ...(SPACING_PRESETS.some((preset) => preset.value === spacingStr)
      ? []
      : [{ value: spacingStr, label: spacingStr }]),
  ]

  const isThermal = paper === '58mm' || paper === '80mm'
  const fallbackMargin = DEFAULT_PAPER_MARGIN[paper]
  const margins = page.margins ?? undefined

  const updateMarginSide = (side: keyof PageMargins, next: number | undefined) => {
    if (next === undefined) {
      onChange({ margins: undefined }, `page-margin-${side}`)
      return
    }
    const base: PageMargins = margins ?? {
      top: fallbackMargin,
      right: fallbackMargin,
      bottom: fallbackMargin,
      left: fallbackMargin,
    }
    onChange({ margins: { ...base, [side]: next } }, `page-margin-${side}`)
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SegmentedChoice
          label={t('receiptTemplates.page.font')}
          value={page.font}
          disabled={readOnly || busy}
          options={[
            { value: 'sans', label: t('receiptTemplates.page.fontSans') },
            { value: 'mono', label: t('receiptTemplates.page.fontMono') },
          ]}
          onChange={(font) => onChange({ font })}
        />
        <SegmentedChoice
          label={t('receiptTemplates.page.fontSize')}
          value={page.font_size}
          disabled={readOnly || busy}
          options={(['s', 'm', 'l'] as const).map((value) => ({
            value,
            label: t(`receiptTemplates.size.${value}`),
          }))}
          onChange={(font_size) => onChange({ font_size })}
        />
      </div>

      <div className="grid gap-2">
        <SegmentedChoice
          label={t('receiptTemplates.page.lineSpacing')}
          value={spacingStr}
          disabled={readOnly || busy}
          invalid={Boolean(fieldProblem('line_spacing'))}
          options={spacingOptions}
          onChange={(next) => onChange({ line_spacing: Number(next) })}
        />
        <Problem>{fieldProblem('line_spacing')}</Problem>
      </div>

      <fieldset className="grid gap-2.5 border-t pt-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium text-sm">{t('receiptTemplates.page.margins')}</legend>
          {margins && !readOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy}
              onClick={() => onChange({ margins: undefined })}
            >
              {t('receiptTemplates.page.marginsReset')}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MARGIN_SIDES.map((side) => {
            const problem = fieldProblem(`margins/${side}`)
            return (
              <div key={side} className="grid gap-1">
                <StepperInput
                  id={`rt-margin-${side}`}
                  label={t(`receiptTemplates.page.margin_${side}`)}
                  min={0}
                  max={15}
                  step={1}
                  value={margins?.[side]}
                  fallbackOnStep={fallbackMargin}
                  placeholder={t('receiptTemplates.page.marginDefault')}
                  disabled={readOnly || busy}
                  invalid={Boolean(problem)}
                  onChange={(next) => updateMarginSide(side, next)}
                />
                <Problem>{problem}</Problem>
              </div>
            )
          })}
        </div>
      </fieldset>

      {isThermal ? (
        <div className="grid gap-1.5 border-t pt-3 sm:max-w-xs">
          <StepperInput
            id="rt-cut-feed"
            label={t('receiptTemplates.page.cutFeedMm')}
            min={0}
            max={30}
            step={1}
            value={page.cut_feed_mm}
            fallbackOnStep={0}
            placeholder="0"
            disabled={readOnly || busy}
            invalid={Boolean(fieldProblem('cut_feed_mm'))}
            describedBy="rt-cut-feed-hint"
            onChange={(cut_feed_mm) => onChange({ cut_feed_mm }, 'page-cut-feed')}
          />
          <small id="rt-cut-feed-hint" className="text-xs text-muted-foreground">
            {t('receiptTemplates.page.cutFeedHint')}
          </small>
          <Problem>{fieldProblem('cut_feed_mm')}</Problem>
        </div>
      ) : null}

      {COPIES_TYPES.includes(documentType) ? (
        <div className="grid gap-2 border-t pt-3">
          <SegmentedChoice
            label={t('receiptTemplates.page.copies')}
            value={String(page.copies ?? 1)}
            disabled={readOnly || busy}
            invalid={Boolean(fieldProblem('copies'))}
            describedBy="rt-copies-hint"
            options={Array.from({ length: MAX_COPIES }, (_, index) => ({
              value: String(index + 1),
              label: t('receiptTemplates.page.copiesCount', { count: index + 1 }),
            }))}
            onChange={(copies) => onChange({ copies: Number(copies) })}
          />
          <small id="rt-copies-hint" className="text-xs text-muted-foreground">
            {t('receiptTemplates.page.copiesHint')}
          </small>
          <Problem>{fieldProblem('copies')}</Problem>
        </div>
      ) : null}
    </div>
  )
}

const META_SUBGROUPS: readonly {
  key: 'order' | 'table' | 'time' | 'staff' | 'customer' | 'print'
  fields: readonly MetaField[]
}[] = [
  { key: 'order', fields: ['order_number', 'return_number', 'call_number', 'order_source'] },
  { key: 'table', fields: ['table'] },
  { key: 'time', fields: ['time', 'check_in', 'check_out', 'duration'] },
  { key: 'staff', fields: ['cashier', 'register', 'branch'] },
  { key: 'customer', fields: ['customer'] },
  { key: 'print', fields: ['printed_at', 'print_count'] },
]

export function TemplateMetaFields({
  documentType,
  printedMeta,
  meta,
  readOnly,
  invalid,
  fieldProblem,
  onChange,
  onRelabel,
}: {
  documentType: ReceiptDocumentType
  printedMeta: readonly MetaField[]
  meta: MetaSection
  readOnly: boolean
  invalid: (field: MetaField) => string | null
  fieldProblem: (key: string) => string | null
  onChange: (meta: MetaSection) => void
  onRelabel: (meta: MetaSection, field: MetaField) => void
}) {
  const { t } = useTranslation('pos')
  const enabled = new Set<string>(meta.fields)

  return (
    <div className="grid gap-4">
      {META_SUBGROUPS.map((subgroup, index) => {
        const subFields = subgroup.fields.filter((field) => printedMeta.includes(field))
        if (subFields.length === 0) return null
        const title = t(`receiptTemplates.metaGroup.${subgroup.key}`)
        return (
          <div key={subgroup.key} className={`grid gap-2.5 ${index > 0 ? 'border-t pt-3' : ''}`}>
            <h4 className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
              {title}
            </h4>
            <FieldToggles
              section="meta"
              documentType={documentType}
              fields={subFields}
              allFields={printedMeta}
              ariaLabel={title}
              value={meta}
              readOnly={readOnly}
              invalid={invalid}
              onChange={(next) => onChange({ ...meta, ...next })}
              onRelabel={(next, field) => onRelabel({ ...meta, ...next }, field)}
            />
            {subgroup.key === 'table' && enabled.has('table') ? (
              <div className="grid gap-1.5 sm:max-w-xs">
                <SegmentedChoice
                  label={t('receiptTemplates.meta.tableStyle')}
                  value={meta.table_style ?? 'one_line'}
                  disabled={readOnly}
                  invalid={Boolean(fieldProblem('table_style'))}
                  options={(['one_line', 'two_lines'] as readonly TableStyle[]).map((style) => ({
                    value: style,
                    label: t(`receiptTemplates.meta.tableStyle_${style}`),
                  }))}
                  onChange={(table_style) => onChange({ ...meta, table_style })}
                />
                <Problem>{fieldProblem('table_style')}</Problem>
              </div>
            ) : null}
            {subgroup.key === 'time' ? (
              <div className="grid gap-1.5 sm:max-w-xs">
                <SegmentedChoice
                  label={t('receiptTemplates.meta.timeFormat')}
                  value={meta.time_format ?? 'datetime'}
                  disabled={readOnly}
                  invalid={Boolean(fieldProblem('time_format'))}
                  options={(['datetime', 'date'] as readonly TimeFormat[]).map((fmt) => ({
                    value: fmt,
                    label: t(`receiptTemplates.meta.timeFormat_${fmt}`),
                  }))}
                  onChange={(time_format) => onChange({ ...meta, time_format })}
                />
                <Problem>{fieldProblem('time_format')}</Problem>
              </div>
            ) : null}
          </div>
        )
      })}
      {documentType === 'shift_closure' ? (
        <small className="text-muted-foreground">{t('receiptTemplates.shiftFiguresLocked')}</small>
      ) : null}
    </div>
  )
}

const TIMED_DOCUMENT_TYPES: readonly ReceiptDocumentType[] = ['sale', 'prebill', 'payment_ticket']

export function TemplateLinesFields({
  documentType,
  paper,
  lines,
  allowedColumns,
  readOnly,
  busy,
  columnsProblem,
  rulingProblem,
  timedProblem,
  onChange,
}: {
  documentType: ReceiptDocumentType
  paper: PaperSize
  lines: LinesSection
  allowedColumns: readonly LineColumn[]
  readOnly: boolean
  busy: boolean
  columnsProblem: string | null
  rulingProblem: string | null
  timedProblem: string | null
  onChange: (lines: LinesSection) => void
}) {
  const { t } = useTranslation('pos')
  const columnSet = new Set<string>(lines.columns)
  const toggleColumn = (column: LineColumn, on: boolean) => {
    const columns = on
      ? allowedColumns.filter((item) => item === column || columnSet.has(item))
      : lines.columns.filter((item) => item !== column)
    onChange({ ...lines, columns })
  }

  const defaultRuling = paper === 'a4' || paper === 'a5' ? 'grid' : 'none'

  return (
    <div className="grid gap-4">
      <SegmentedChoice
        label={t('receiptTemplates.lines.layout')}
        value={lines.layout}
        disabled={readOnly || busy}
        options={[
          { value: 'stacked', label: t('receiptTemplates.lines.stacked') },
          { value: 'table', label: t('receiptTemplates.lines.table') },
        ]}
        onChange={(layout) => onChange({ ...lines, layout })}
      />

      <div className="grid gap-1">
        <RulingPicker
          value={lines.ruling}
          defaultValue={defaultRuling}
          disabled={readOnly || busy}
          onChange={(ruling) => onChange({ ...lines, ruling })}
        />
        <Problem>{rulingProblem}</Problem>
      </div>

      <fieldset className="grid gap-2 border-t pt-3">
        <legend className="mb-1 font-medium text-sm">{t('receiptTemplates.lines.columns')}</legend>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {allowedColumns.map((column) => {
            const locked = LOCKED_COLUMNS.includes(column)
            return (
              <Check
                key={column}
                checked={locked || columnSet.has(column)}
                disabled={readOnly || busy || locked}
                onChange={(on) => toggleColumn(column, on)}
              >
                <span>{t(`receiptTemplates.fields.lines.${column}`)}</span>
                {locked ? (
                  <small className="ml-1.5 text-muted-foreground">
                    ({t('receiptTemplates.locked')})
                  </small>
                ) : null}
              </Check>
            )
          })}
        </div>
      </fieldset>
      <Problem>{columnsProblem}</Problem>

      <div className="grid gap-x-4 gap-y-1 border-t pt-3 sm:grid-cols-2">
        <Check
          checked={lines.show_trace}
          disabled={readOnly || busy}
          onChange={(show_trace) => onChange({ ...lines, show_trace })}
        >
          {t('receiptTemplates.lines.showTrace')}
        </Check>
        <Check
          checked={lines.show_conversion}
          disabled={readOnly || busy}
          onChange={(show_conversion) => onChange({ ...lines, show_conversion })}
        >
          {t('receiptTemplates.lines.showConversion')}
        </Check>
      </div>

      {TIMED_DOCUMENT_TYPES.includes(documentType) ? (
        <div className="grid gap-1.5 border-t pt-3 sm:max-w-sm">
          <SegmentedChoice
            label={t('receiptTemplates.lines.timedStyle')}
            value={lines.timed_style ?? 'range'}
            disabled={readOnly || busy}
            invalid={Boolean(timedProblem)}
            options={(['range', 'duration'] as readonly TimedStyle[]).map((style) => ({
              value: style,
              label: t(`receiptTemplates.lines.timedStyle_${style}`),
            }))}
            onChange={(timed_style) => onChange({ ...lines, timed_style })}
          />
          <Problem>{timedProblem}</Problem>
        </div>
      ) : null}
    </div>
  )
}

export function TemplatePaymentsFields({
  storeId,
  documentType,
  paper,
  fields,
  payments,
  hasVietqrAccount,
  readOnly,
  invalid,
  fieldProblem,
  onChange,
  onRelabel,
}: {
  storeId: string
  documentType: ReceiptDocumentType
  paper: PaperSize
  fields: readonly PaymentsSection['fields'][number][]
  payments: PaymentsSection
  hasVietqrAccount: boolean
  readOnly: boolean
  invalid: (field: PaymentsSection['fields'][number]) => string | null
  fieldProblem: (key: string) => string | null
  onChange: (next: PaymentsSection) => void
  onRelabel: (next: PaymentsSection, field: PaymentsSection['fields'][number]) => void
}) {
  const { t } = useTranslation('pos')
  const hasQr = payments.fields.includes('pay_qr') || payments.fields.includes('transfer_qr')

  return (
    <div className="grid gap-4">
      <FieldToggles
        section="payments"
        documentType={documentType}
        fields={fields}
        value={payments}
        readOnly={readOnly}
        invalid={invalid}
        onChange={(next) => onChange({ ...payments, ...next })}
        onRelabel={(next, field) => onRelabel({ ...payments, ...next }, field)}
      />

      {hasQr ? (
        <>
          <QrLayoutControls
            paper={paper}
            size={payments.qr_size}
            captionPosition={payments.qr_caption}
            readOnly={readOnly}
            sizeProblem={fieldProblem('qr_size')}
            captionProblem={fieldProblem('qr_caption')}
            onSizeChange={(qr_size) => onChange({ ...payments, qr_size })}
            onCaptionChange={(qr_caption) => onChange({ ...payments, qr_caption })}
          />
          {!hasVietqrAccount ? (
            <div
              role="note"
              data-testid="vietqr-account-warning"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50/80 px-3 py-2.5 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>{t('receiptTemplates.payments.vietqrMissing')}</span>
              <Link
                to="/$storeId/payment-methods"
                params={{ storeId }}
                className="font-medium underline underline-offset-2"
              >
                {t('receiptTemplates.payments.vietqrSetupLink')}
              </Link>
            </div>
          ) : null}
        </>
      ) : null}

      {documentType === 'refund' ? (
        <small className="text-muted-foreground">{t('receiptTemplates.refundAmountLocked')}</small>
      ) : null}
    </div>
  )
}

const RECORDED: readonly ReceiptDocumentType[] = ['sale', 'return', 'refund', 'shift_closure']

export function EditorSectionsAccordion({
  storeId,
  open,
  onOpenChange,
  documentType,
  name,
  paper,
  config,
  header,
  footer,
  previewData,
  hasVietqrAccount,
  readOnly,
  busy,
  problemCount,
  fieldProblem,
  sectionFieldProblem,
  listProblem,
  blockProblems,
  onNameChange,
  onPaperChange,
  onPageChange,
  onConfigChange,
  onHeaderChange,
  onFooterChange,
}: {
  storeId: string
  open: string[]
  onOpenChange: (open: string[]) => void
  documentType: ReceiptDocumentType
  name: string
  paper: PaperSize
  config: TemplateConfig
  header: KeyedBlock[]
  footer: KeyedBlock[]
  previewData: TemplateData
  hasVietqrAccount: boolean
  readOnly: boolean
  busy: boolean
  problemCount: (section: EditorSectionId) => number
  fieldProblem: (area: IssueArea, key: string) => string | null
  sectionFieldProblem: (
    section: 'meta' | 'totals' | 'payments' | 'einvoice',
  ) => (field: string) => string | null
  listProblem: (place: 'header' | 'footer') => string | null
  blockProblems: (place: 'header' | 'footer') => (index: number) => BlockProblems
  onNameChange: (name: string) => void
  onPaperChange: (paper: PaperSize) => void
  onPageChange: (patch: Partial<PageSettings>, coalesceKey?: string) => void
  onConfigChange: (patch: Partial<TemplateConfig>, coalesceKey?: string) => void
  onHeaderChange: (header: KeyedBlock[], coalesceKey?: string) => void
  onFooterChange: (footer: KeyedBlock[], coalesceKey?: string) => void
}) {
  const { t } = useTranslation('pos')
  const rules = SECTION_RULES[documentType]
  const printedMeta = rules.meta?.filter((field) => !UNPRINTED_META.includes(field)) ?? []
  const metaGroup =
    printedMeta.length > 0 && config.meta
      ? fieldGroupToggle(printedMeta, [], config.meta, readOnly || busy, (next) =>
          onConfigChange({ meta: { ...config.meta, ...next } }),
        )
      : undefined
  const totalsGroup =
    rules.totals && config.totals
      ? fieldGroupToggle(rules.totals, LOCKED_TOTALS, config.totals, readOnly || busy, (totals) =>
          onConfigChange({ totals }),
        )
      : undefined
  const paymentsGroup =
    rules.payments && config.payments
      ? fieldGroupToggle(rules.payments, [], config.payments, readOnly || busy, (next) =>
          onConfigChange({ payments: { ...config.payments, ...next } }),
        )
      : undefined
  const einvoiceGroup =
    rules.einvoice && config.einvoice
      ? fieldGroupToggle(rules.einvoice, [], config.einvoice, readOnly || busy, (next) =>
          onConfigChange({ einvoice: { ...config.einvoice, ...next } }),
        )
      : undefined
  const lines = config.lines
  const linesGroup =
    rules.lines && lines
      ? linesGroupToggle(rules.lines, lines, readOnly || busy, (nextLines) =>
          onConfigChange({ lines: nextLines }),
        )
      : undefined

  return (
    <Accordion
      multiple
      value={open}
      onValueChange={(value) => onOpenChange(value as string[])}
      className="grid gap-3"
    >
      <EditorSection
        id="info"
        problems={problemCount('info')}
        title={t('receiptTemplates.section.info')}
      >
        <TemplateInfoFields
          name={name}
          paper={paper}
          readOnly={readOnly}
          busy={busy}
          nameProblem={fieldProblem('name', 'name')}
          paperProblem={fieldProblem('paper', 'paper')}
          onNameChange={onNameChange}
          onPaperChange={onPaperChange}
        />
      </EditorSection>

      <EditorSection
        id="appearance"
        problems={problemCount('appearance')}
        title={t('receiptTemplates.section.appearance')}
      >
        <TemplateAppearanceFields
          documentType={documentType}
          paper={paper}
          page={config.page}
          readOnly={readOnly}
          busy={busy}
          fieldProblem={(key) => fieldProblem('page', key)}
          onChange={onPageChange}
        />
      </EditorSection>

      <EditorSection
        id="header"
        problems={problemCount('header')}
        title={t('receiptTemplates.section.header')}
      >
        <BlockList
          place="header"
          blocks={header}
          data={previewData}
          documentType={documentType}
          paper={paper}
          pageSize={config.page.font_size}
          margins={config.page.margins}
          readOnly={readOnly || busy}
          lockedBefore={[
            ...(RECORDED.includes(documentType) ? [t('receiptTemplates.lockedCopyBanner')] : []),
            ...(documentType === 'prebill' ? [t('receiptTemplates.lockedPrebillBanner')] : []),
          ]}
          listProblem={listProblem('header')}
          problemsAt={blockProblems('header')}
          onChange={onHeaderChange}
        />
      </EditorSection>

      {printedMeta.length > 0 && config.meta ? (
        <EditorSection
          id="meta"
          problems={problemCount('meta')}
          title={t('receiptTemplates.section.meta')}
          group={metaGroup}
        >
          <TemplateMetaFields
            documentType={documentType}
            printedMeta={printedMeta}
            meta={config.meta}
            readOnly={readOnly || busy}
            invalid={sectionFieldProblem('meta')}
            fieldProblem={(key) => fieldProblem('meta', key)}
            onChange={(meta) => onConfigChange({ meta })}
            onRelabel={(meta, field) => onConfigChange({ meta }, `meta-label-${field}`)}
          />
        </EditorSection>
      ) : null}

      {rules.lines && lines ? (
        <EditorSection
          id="lines"
          problems={problemCount('lines')}
          title={t('receiptTemplates.section.lines')}
          group={linesGroup}
        >
          <TemplateLinesFields
            documentType={documentType}
            paper={paper}
            lines={lines}
            allowedColumns={rules.lines}
            readOnly={readOnly}
            busy={busy}
            columnsProblem={fieldProblem('lines', 'columns')}
            rulingProblem={fieldProblem('lines', 'ruling')}
            timedProblem={fieldProblem('lines', 'timed_style')}
            onChange={(nextLines) => onConfigChange({ lines: nextLines })}
          />
        </EditorSection>
      ) : null}

      {rules.totals && config.totals ? (
        <EditorSection
          id="totals"
          problems={problemCount('totals')}
          title={t('receiptTemplates.section.totalsOnly')}
          group={totalsGroup}
        >
          <FieldToggles
            section="totals"
            documentType={documentType}
            fields={rules.totals}
            locked={LOCKED_TOTALS}
            fieldHints={{ fees: t('receiptTemplates.totals.feesHint') }}
            value={config.totals}
            readOnly={readOnly || busy}
            invalid={sectionFieldProblem('totals')}
            onChange={(totals) => onConfigChange({ totals })}
            onRelabel={(totals, field) => onConfigChange({ totals }, `totals-label-${field}`)}
          />
        </EditorSection>
      ) : null}

      {rules.payments && config.payments ? (
        <EditorSection
          id="payments"
          problems={problemCount('payments')}
          title={t('receiptTemplates.section.payments')}
          group={paymentsGroup}
        >
          <TemplatePaymentsFields
            storeId={storeId}
            documentType={documentType}
            paper={paper}
            fields={rules.payments}
            payments={config.payments}
            hasVietqrAccount={hasVietqrAccount}
            readOnly={readOnly || busy}
            invalid={sectionFieldProblem('payments')}
            fieldProblem={(key) => fieldProblem('payments', key)}
            onChange={(payments) => onConfigChange({ payments })}
            onRelabel={(payments, field) => onConfigChange({ payments }, `payments-label-${field}`)}
          />
        </EditorSection>
      ) : null}

      {rules.einvoice && config.einvoice ? (
        <EditorSection
          id="einvoice"
          problems={problemCount('einvoice')}
          title={t('receiptTemplates.section.einvoice')}
          group={einvoiceGroup}
        >
          <EinvoiceSectionFields
            paper={paper}
            fields={rules.einvoice}
            value={config.einvoice}
            readOnly={readOnly || busy}
            invalid={sectionFieldProblem('einvoice')}
            fieldProblem={(key) => fieldProblem('einvoice', key)}
            onChange={(einvoice) => onConfigChange({ einvoice })}
            onRelabel={(einvoice, field) => onConfigChange({ einvoice }, `einvoice-label-${field}`)}
          />
        </EditorSection>
      ) : null}

      <EditorSection
        id="footer"
        problems={problemCount('footer')}
        title={t('receiptTemplates.section.footer')}
      >
        <BlockList
          place="footer"
          blocks={footer}
          data={previewData}
          documentType={documentType}
          paper={paper}
          pageSize={config.page.font_size}
          margins={config.page.margins}
          readOnly={readOnly || busy}
          lockedAfter={
            previewData.disclaimer
              ? [t('receiptTemplates.lockedDisclaimer', { text: previewData.disclaimer })]
              : []
          }
          listProblem={listProblem('footer')}
          problemsAt={blockProblems('footer')}
          onChange={onFooterChange}
        />
      </EditorSection>
    </Accordion>
  )
}
