import { describeFailure } from '@shared/request-failure'
import { adminClient, usePermissions } from '@spree/dashboard-core'
import { Button, Checkbox, Field, FieldLabel, Input } from '@spree/dashboard-ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGoodsCategories, useGoodsWrite } from '../hooks/use-goods'
import { canWriteCategories } from '../lib/pos-access'

// The store's Spree categories as checkboxes, a product belonging to any
// number of them. With `allowCreate`, someone allowed to write categories
// adds a top-level one by name and it is ticked at once.
export function CategoryChecklist({
  value,
  onChange,
  allowCreate,
  disabled,
}: {
  value: string[]
  onChange: (ids: string[]) => void
  allowCreate: boolean
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const id = useId()
  const { permissionKeys } = usePermissions()
  const categories = useGoodsCategories()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const create = useGoodsWrite((categoryName: string) =>
    adminClient.categories.create({ name: categoryName }),
  )
  const canCreate = allowCreate && canWriteCategories({ permissionKeys })
  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    setError('')
    try {
      const category = await create.mutateAsync(trimmed)
      onChange([...value, category.id])
      setName('')
    } catch (failure) {
      setError(describeFailure(failure, t))
    }
  }
  const rows = categories.data ?? []
  return (
    <div className="space-y-3">
      {categories.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {describeFailure(categories.error, t)}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {categories.isPending ? t('waiting') : t('goods.products.form.noCategories')}
        </p>
      ) : (
        <fieldset
          className="max-h-60 space-y-2 overflow-y-auto"
          aria-label={t('goods.products.form.categories')}
        >
          {rows.map((category) => (
            <Field key={category.id} orientation="horizontal">
              <Checkbox
                id={`${id}-${category.id}`}
                checked={value.includes(category.id)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...value.filter((item) => item !== category.id), category.id]
                      : value.filter((item) => item !== category.id),
                  )
                }
              />
              <FieldLabel htmlFor={`${id}-${category.id}`} className="font-normal">
                {category.pretty_name || category.name}
              </FieldLabel>
            </Field>
          ))}
        </fieldset>
      )}
      {canCreate && (
        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor={`${id}-new`}>{t('goods.products.form.newCategory')}</FieldLabel>
            <Input
              id={`${id}-new`}
              value={name}
              maxLength={120}
              disabled={disabled || create.isPending}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void add()
                }
              }}
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || create.isPending || !name.trim()}
            onClick={() => void add()}
          >
            {t('goods.products.form.addCategory')}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
