import { describeFailure } from '@shared/request-failure'
import type { PosMenuModifierGroup } from '@shared/types/pos-context'
import { Button } from '@spree/dashboard-ui'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { describeSelection } from '../lib/goods-addons'
import { ModelCheck } from './setup/model-ui'

// The add-on groups offered with a product, chosen from the store's
// modifier groups. Groups are made on the goods add-on groups screen.
export function GoodsAddonGroups({
  groups,
  value,
  onChange,
  combo,
  error,
  retry,
  storeId,
  disabled,
}: {
  groups: PosMenuModifierGroup[] | undefined
  value: string[]
  onChange: (ids: string[]) => void
  // A combo's menu item lists its contents instead of add-on groups.
  combo: boolean
  error: unknown
  retry: () => void
  storeId: string
  disabled: boolean
}) {
  const { t } = useTranslation()
  if (error)
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>{describeFailure(error, t)}</p>
        <Button type="button" size="sm" variant="outline" onClick={retry}>
          {t('retry')}
        </Button>
      </div>
    )
  if (combo)
    return <p className="text-sm text-muted-foreground">{t('goods.products.form.addons.combo')}</p>
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('goods.products.form.addons.hint')}</p>
      {groups === undefined ? (
        <p role="status" className="text-sm">
          {t('waiting')}
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('goods.products.form.addons.none')}</p>
      ) : (
        <fieldset className="space-y-2" aria-label={t('goods.products.form.addons.title')}>
          {groups.map((group) => (
            <ModelCheck
              key={group.id}
              checked={value.includes(group.id)}
              disabled={disabled}
              name={group.name}
              description={`${describeSelection(group, t)} · ${group.options.map((option) => option.name).join(', ') || '—'}`}
              onChange={(checked) =>
                onChange(
                  checked
                    ? [...value.filter((id) => id !== group.id), group.id]
                    : value.filter((id) => id !== group.id),
                )
              }
            >
              {group.name}
            </ModelCheck>
          ))}
        </fieldset>
      )}
      <Link to="/$storeId/goods/addons" params={{ storeId }} className="text-sm underline">
        {t('goods.products.form.addons.manage')}
      </Link>
    </div>
  )
}
