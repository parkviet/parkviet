import { Badge, Button } from '@spree/dashboard-ui'
import { PlusIcon, XIcon } from '@spree/dashboard-ui/icons'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  type AttributeValues,
  combinationCount,
  MAX_ATTRIBUTE_VALUES,
  MAX_ATTRIBUTES,
  MAX_VARIANTS,
  rowLabel,
  sameText,
  syncVariantRows,
  type VariantRowValues,
} from '../lib/goods-variants'
import { Input, TopologyField } from './topology-fields'

type Branch = { id: string; name: string }
type RowField = 'sku' | 'barcode' | 'price' | 'costPrice'

// Attributes (name and values, Enter adds a value) and the variant matrix
// they make. A product whose variants are stored keeps its attribute names;
// values can be added and removed, and a combination can be left out.
export function GoodsVariantEditor({
  attributes,
  rows,
  initialRows,
  onChange,
  defaults,
  lockNames,
  suggestions,
  branches,
  trackInventory,
  onHand,
  errorAt,
  disabled,
}: {
  attributes: AttributeValues[]
  rows: VariantRowValues[]
  // The matrix when the form opened, so a value added back edits its variant.
  initialRows: VariantRowValues[]
  onChange: (next: { attributes: AttributeValues[]; rows: VariantRowValues[] }) => void
  defaults: { price: string; costPrice: string }
  lockNames: boolean
  suggestions: string[]
  // Branches a new variant gets opening stock at.
  branches: Branch[]
  trackInventory: boolean
  // Stock of a stored variant across the branches, shown instead of an input.
  onHand: (variantId: string) => number
  errorAt: (path: string) => string | undefined
  disabled: boolean
}) {
  const { t } = useTranslation()
  const listId = useId()
  const [typed, setTyped] = useState<string[]>([])
  const change = (next: AttributeValues[]) =>
    onChange({ attributes: next, rows: syncVariantRows(next, rows, initialRows, defaults) })
  const setRow = (index: number, patch: Partial<VariantRowValues>) =>
    onChange({
      attributes,
      rows: rows.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    })
  function addValue(index: number) {
    const raw = (typed[index] ?? '').split(',')
    const current = attributes[index]
    const fresh = raw
      .map((value) => value.trim())
      .filter(
        (value, at, all) =>
          value &&
          !current.values.some((existing) => sameText(existing) === sameText(value)) &&
          all.findIndex((other) => sameText(other) === sameText(value)) === at,
      )
    setTyped((list) => list.map((value, at) => (at === index ? '' : value)))
    if (fresh.length === 0) return
    change(
      attributes.map((attribute, at) =>
        at === index
          ? {
              ...attribute,
              values: [...attribute.values, ...fresh].slice(0, MAX_ATTRIBUTE_VALUES),
            }
          : attribute,
      ),
    )
  }
  const removeValue = (index: number, value: string) =>
    change(
      attributes.map((attribute, at) =>
        at === index
          ? { ...attribute, values: attribute.values.filter((item) => item !== value) }
          : attribute,
      ),
    )
  const removed = initialRows.filter(
    (row) =>
      row.variantId &&
      !rows.some((current) => current.variantId === row.variantId && current.enabled),
  )
  const tooMany = combinationCount(attributes) > MAX_VARIANTS
  const cell = (index: number, field: RowField, row: VariantRowValues) => {
    const message = errorAt(`variants.${index}.${field}`)
    return (
      <td className="p-1 align-top">
        <Input
          aria-label={`${t(`goods.products.form.variants.${field}`)} – ${rowLabel(row)}`}
          aria-invalid={Boolean(message)}
          inputMode={field === 'price' || field === 'costPrice' ? 'numeric' : 'text'}
          value={row[field]}
          disabled={disabled || !row.enabled}
          onChange={(event) => setRow(index, { [field]: event.target.value })}
        />
        {message && <p className="mt-1 text-xs text-destructive">{message}</p>}
      </td>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          lockNames
            ? 'goods.products.form.variants.lockedHint'
            : 'goods.products.form.variants.hint',
        )}
      </p>
      <datalist id={listId}>
        {suggestions.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      {attributes.map((attribute, index) => {
        const nameError = errorAt(`attributes.${index}.name`)
        const valuesError = errorAt(`attributes.${index}.values`)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: attributes have no id until saved and keep their order.
          <div key={index} className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <TopologyField
                  label={t('goods.products.form.variants.attribute')}
                  error={nameError}
                >
                  {(id) => (
                    <Input
                      id={id}
                      list={listId}
                      maxLength={64}
                      aria-invalid={Boolean(nameError)}
                      placeholder={t('goods.products.form.variants.attributePlaceholder')}
                      value={attribute.name}
                      disabled={disabled || lockNames}
                      onChange={(event) =>
                        onChange({
                          attributes: attributes.map((item, at) =>
                            at === index ? { ...item, name: event.target.value } : item,
                          ),
                          rows,
                        })
                      }
                    />
                  )}
                </TopologyField>
              </div>
              {!lockNames && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => {
                    setTyped((list) => list.filter((_, at) => at !== index))
                    change(attributes.filter((_, at) => at !== index))
                  }}
                >
                  {t('goods.products.form.variants.removeAttribute')}
                </Button>
              )}
            </div>
            <ul
              className="flex flex-wrap gap-2"
              aria-label={t('goods.products.form.variants.values', { name: attribute.name })}
            >
              {attribute.values.map((value) => (
                <li key={value}>
                  <Badge variant="outline" className="gap-1">
                    {value}
                    <button
                      type="button"
                      className="rounded-sm hover:bg-muted"
                      disabled={disabled}
                      aria-label={t('goods.products.form.variants.removeValue', { value })}
                      onClick={() => removeValue(index, value)}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
            <TopologyField
              label={t('goods.products.form.variants.addValue', { name: attribute.name || '…' })}
              hint={t('goods.products.form.variants.addValueHint')}
              error={valuesError}
            >
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={Boolean(valuesError)}
                  maxLength={200}
                  value={typed[index] ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    setTyped((list) => {
                      const next = [...list]
                      next[index] = event.target.value
                      return next
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addValue(index)
                  }}
                  onBlur={() => addValue(index)}
                />
              )}
            </TopologyField>
          </div>
        )
      })}
      {!lockNames && attributes.length < MAX_ATTRIBUTES && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => change([...attributes, { name: '', values: [] }])}
        >
          <PlusIcon className="size-4" />
          {t('goods.products.form.variants.addAttribute')}
        </Button>
      )}
      {(errorAt('attributes') || tooMany) && (
        <p role="alert" className="text-sm text-destructive">
          {tooMany
            ? t('goods.products.form.errors.tooManyVariants', { max: MAX_VARIANTS })
            : errorAt('attributes')}
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{t('goods.products.form.variants.matrix')}</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-1 font-medium">{t('goods.products.form.variants.variant')}</th>
                <th className="p-1 font-medium">{t('goods.products.form.variants.sku')}</th>
                <th className="p-1 font-medium">{t('goods.products.form.variants.barcode')}</th>
                <th className="p-1 font-medium">{t('goods.products.form.variants.price')}</th>
                <th className="p-1 font-medium">{t('goods.products.form.variants.costPrice')}</th>
                {trackInventory && (
                  <th className="p-1 font-medium">{t('goods.products.form.variants.stock')}</th>
                )}
                <th className="p-1">
                  <span className="sr-only">{t('goods.products.form.variants.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className={row.enabled ? 'border-t' : 'border-t opacity-60'}>
                  <th scope="row" className="p-1 text-left font-normal">
                    <span className="font-medium">{rowLabel(row)}</span>
                    {!row.enabled && (
                      <span className="block text-xs text-muted-foreground">
                        {t('goods.products.form.variants.leftOut')}
                      </span>
                    )}
                  </th>
                  {cell(index, 'sku', row)}
                  {cell(index, 'barcode', row)}
                  {cell(index, 'price', row)}
                  {cell(index, 'costPrice', row)}
                  {trackInventory && (
                    <td className="p-1 align-top">
                      {row.variantId ? (
                        <span className="tabular-nums">{onHand(row.variantId)}</span>
                      ) : branches.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {branches.map((branch) => (
                            <Input
                              key={branch.id}
                              inputMode="numeric"
                              aria-label={t('goods.products.form.variants.opening', {
                                branch: branch.name,
                                variant: rowLabel(row),
                              })}
                              placeholder={branches.length > 1 ? branch.name : undefined}
                              value={row.openingStock[branch.id] ?? ''}
                              disabled={disabled || !row.enabled}
                              onChange={(event) =>
                                setRow(index, {
                                  openingStock: {
                                    ...row.openingStock,
                                    [branch.id]: event.target.value,
                                  },
                                })
                              }
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="p-1 text-right align-top">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      aria-label={t(
                        row.enabled
                          ? 'goods.products.form.variants.leaveOut'
                          : 'goods.products.form.variants.restore',
                        { variant: rowLabel(row) },
                      )}
                      onClick={() => setRow(index, { enabled: !row.enabled })}
                    >
                      {t(
                        row.enabled
                          ? 'goods.products.form.variants.leaveOutShort'
                          : 'goods.products.form.variants.restoreShort',
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {errorAt('variants') && (
        <p role="alert" className="text-sm text-destructive">
          {errorAt('variants')}
        </p>
      )}
      {removed.length > 0 && (
        <div role="note" className="rounded-md border border-warning/50 p-3 text-sm">
          <p className="font-medium">{t('goods.products.form.variants.willDelete')}</p>
          <ul className="mt-1 list-disc pl-5">
            {removed.map((row) => (
              <li key={row.key}>{rowLabel(row)}</li>
            ))}
          </ul>
          <p className="mt-1 text-muted-foreground">
            {t('goods.products.form.variants.deleteHint')}
          </p>
        </div>
      )}
    </div>
  )
}
