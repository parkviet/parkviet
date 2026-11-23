import type {
  LabelBarcodeSymbology,
  LabelCurrency,
  ProductLabelField,
} from '@shared/product-label/types'
import {
  LABEL_CURRENCIES,
  LABEL_MAX_LINES_RANGE,
  LABEL_SYMBOLOGIES,
  MAX_LABEL_CAPTION_LENGTH,
  MAX_LABEL_TEXT_LENGTH,
} from '@shared/product-label/validate'
import { Button, Input } from '@spree/dashboard-ui'
import { GripVerticalIcon, MoveDownIcon, MoveUpIcon } from '@spree/dashboard-ui/icons'
import { type PointerEvent, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { moveBlock } from '../receipt-template/block-list'
import { Check, Choice, Problem } from '../receipt-template/controls'
import type { SectionGroupToggle } from '../receipt-template/editor-sections'
import { StepperInput } from '../receipt-template/stepper-input'

// The fields a label prints, in print order. Each row switches its field on
// and off, and holds the field's own settings while it is on. The order is
// the print order, top to bottom.

// Fields that carry a typed caption before their value.
const CAPTION_FIELDS = ['sku', 'unit', 'price', 'printed_date'] as const
// Fields whose text can replace the store's own detail.
const TEXT_FIELDS = ['store_name', 'store_address'] as const

export function fieldsGroupToggle(
  fields: readonly ProductLabelField[],
  disabled: boolean,
  onChange: (fields: ProductLabelField[]) => void,
): SectionGroupToggle {
  const enabled = fields.filter((field) => field.enabled).length
  return {
    enabled,
    total: fields.length,
    checked: enabled === fields.length,
    indeterminate: enabled > 0 && enabled < fields.length,
    disabled,
    onToggle: (next) => onChange(fields.map((field) => ({ ...field, enabled: next }))),
  }
}

export function LabelFieldList({
  fields,
  readOnly,
  storeHints,
  problemAt,
  onChange,
}: {
  fields: ProductLabelField[]
  readOnly: boolean
  // What a blank override prints: the store's own name and address.
  storeHints: { name: string; address: string }
  problemAt: (index: number) => string | null
  onChange: (fields: ProductLabelField[], coalesceKey?: string) => void
}) {
  const { t } = useTranslation('pos')
  const helpId = useId()
  const list = useRef<HTMLOListElement>(null)
  const [drag, setDrag] = useState<{ key: string; target: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const refocus = useRef<{ key: string; control: 'drag' | 'up' | 'down' } | null>(null)

  useEffect(() => {
    const target = refocus.current
    if (!target) return
    refocus.current = null
    list.current
      ?.querySelector<HTMLElement>(
        `[data-field-key="${target.key}"] [data-control="${target.control}"]`,
      )
      ?.focus()
  })

  const items = fields
  const nameOf = (field: ProductLabelField) => t(`productLabels.field.${field.key}`)

  const move = (key: string, target: number, control: 'drag' | 'up' | 'down') => {
    const next = moveBlock(items, key, target)
    if (!next) return false
    refocus.current = { key, control }
    onChange(next)
    return true
  }
  const patch = (index: number, change: Partial<ProductLabelField>, coalesceKey?: string) =>
    onChange(
      fields.map((field, at) =>
        at === index ? ({ ...field, ...change } as ProductLabelField) : field,
      ),
      coalesceKey,
    )

  const dropIndex = (key: string, clientY: number) =>
    Array.from(list.current?.querySelectorAll<HTMLElement>('[data-field-key]') ?? [])
      .filter((row) => row.dataset.fieldKey !== key)
      .filter((row) => {
        const box = row.getBoundingClientRect()
        return box.top + box.height / 2 < clientY
      }).length

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, key: string, index: number) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ key, target: index })
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const target = dropIndex(drag.key, event.clientY)
    if (target !== drag.target) setDrag({ ...drag, target })
  }
  const pointerUp = () => {
    if (!drag) return
    const current = drag
    setDrag(null)
    const field = items.find((item) => item.key === current.key)
    if (field && move(current.key, current.target, 'drag'))
      setAnnouncement(
        t('productLabels.fields.dropped', { name: nameOf(field), position: current.target + 1 }),
      )
  }

  return (
    <div className="grid gap-3">
      <ol ref={list} className="grid gap-2.5" aria-label={t('productLabels.section.fields')}>
        {items.map((field, index) => {
          const position = t('productLabels.fields.position', {
            name: nameOf(field),
            position: index + 1,
          })
          const problem = problemAt(index)
          return (
            <li
              key={field.key}
              data-field-key={field.key}
              data-enabled={field.enabled || undefined}
              data-dragging={drag?.key === field.key || undefined}
              data-invalid={problem ? 'true' : undefined}
              aria-label={position}
              className="grid gap-2 rounded-lg border bg-background/60 p-3 data-[enabled=true]:bg-card data-[dragging=true]:opacity-60 data-[invalid=true]:border-destructive"
            >
              <div className="flex flex-wrap items-center gap-2">
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="touch-none cursor-grab"
                    data-control="drag"
                    aria-label={t('productLabels.fields.handle', { name: nameOf(field) })}
                    aria-describedby={helpId}
                    onPointerDown={(event) => pointerDown(event, field.key, index)}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={() => setDrag(null)}
                  >
                    <GripVerticalIcon />
                  </Button>
                ) : null}
                <div className="mr-auto">
                  <Check
                    checked={field.enabled}
                    disabled={readOnly}
                    onChange={(enabled) => patch(index, { enabled })}
                  >
                    <span className="font-medium text-sm">{nameOf(field)}</span>
                  </Check>
                </div>
                {!readOnly ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      data-control="up"
                      aria-disabled={index === 0 || undefined}
                      aria-label={t('productLabels.fields.moveUp', { name: nameOf(field) })}
                      onClick={() => {
                        if (move(field.key, index - 1, 'up'))
                          setAnnouncement(
                            t('productLabels.fields.moved', {
                              name: nameOf(field),
                              position: index,
                              count: items.length,
                            }),
                          )
                      }}
                    >
                      <MoveUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      data-control="down"
                      aria-disabled={index === items.length - 1 || undefined}
                      aria-label={t('productLabels.fields.moveDown', { name: nameOf(field) })}
                      onClick={() => {
                        if (move(field.key, index + 1, 'down'))
                          setAnnouncement(
                            t('productLabels.fields.moved', {
                              name: nameOf(field),
                              position: index + 2,
                              count: items.length,
                            }),
                          )
                      }}
                    >
                      <MoveDownIcon />
                    </Button>
                  </div>
                ) : null}
              </div>

              {field.enabled ? (
                <FieldSettings
                  field={field}
                  index={index}
                  readOnly={readOnly}
                  storeHints={storeHints}
                  patch={patch}
                />
              ) : null}
              <Problem>{problem}</Problem>
            </li>
          )
        })}
      </ol>
      {!readOnly ? (
        <p id={helpId} className="sr-only">
          {t('productLabels.fields.help')}
        </p>
      ) : null}
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
    </div>
  )
}

function FieldSettings({
  field,
  index,
  readOnly,
  storeHints,
  patch,
}: {
  field: ProductLabelField
  index: number
  readOnly: boolean
  storeHints: { name: string; address: string }
  patch: (index: number, change: Partial<ProductLabelField>, coalesceKey?: string) => void
}) {
  const { t } = useTranslation('pos')
  const name = t(`productLabels.field.${field.key}`)
  const coalesce = (part: string) => `field-${field.key}-${part}`

  if ((TEXT_FIELDS as readonly string[]).includes(field.key) && 'text' in field)
    return (
      <Input
        aria-label={t('productLabels.fields.textFor', { name })}
        value={field.text ?? ''}
        placeholder={
          (field.key === 'store_name' ? storeHints.name : storeHints.address) ||
          t('productLabels.fields.storeBlank')
        }
        maxLength={MAX_LABEL_TEXT_LENGTH}
        disabled={readOnly}
        className="h-8 text-sm"
        onChange={(event) =>
          patch(
            index,
            { text: event.target.value === '' ? null : event.target.value },
            coalesce('text'),
          )
        }
      />
    )

  if ((CAPTION_FIELDS as readonly string[]).includes(field.key) && 'label' in field)
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label={t('productLabels.fields.labelFor', { name })}
          value={field.label ?? ''}
          placeholder={t(`productLabels.fields.caption.${field.key}`)}
          maxLength={MAX_LABEL_CAPTION_LENGTH}
          disabled={readOnly}
          className="h-8 text-sm"
          onChange={(event) =>
            patch(
              index,
              { label: event.target.value === '' ? null : event.target.value },
              coalesce('label'),
            )
          }
        />
        {field.key === 'price' ? (
          <Choice<LabelCurrency>
            label={t('productLabels.fields.currency')}
            hideLabel
            value={field.currency}
            disabled={readOnly}
            options={LABEL_CURRENCIES.map((value) => ({
              value,
              label: t(`productLabels.fields.currencyOption.${value}`),
            }))}
            onChange={(currency) => patch(index, { currency })}
          />
        ) : null}
      </div>
    )

  if (field.key === 'product_name')
    return (
      <StepperInput
        label={t('productLabels.fields.maxLines')}
        value={field.max_lines}
        min={LABEL_MAX_LINES_RANGE[0]}
        max={LABEL_MAX_LINES_RANGE[1]}
        disabled={readOnly}
        onChange={(lines) => {
          if (lines !== undefined) patch(index, { max_lines: lines })
        }}
      />
    )

  if (field.key === 'barcode')
    return (
      <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
        <Choice<LabelBarcodeSymbology>
          label={t('productLabels.fields.symbology')}
          value={field.symbology}
          disabled={readOnly}
          options={LABEL_SYMBOLOGIES.map((value) => ({
            value,
            label: t(`productLabels.fields.symbologyOption.${value}`),
          }))}
          onChange={(symbology) => patch(index, { symbology })}
        />
        <Check
          checked={field.show_text}
          disabled={readOnly}
          onChange={(show_text) => patch(index, { show_text })}
        >
          {t('productLabels.fields.showCode')}
        </Check>
      </div>
    )

  return null
}
