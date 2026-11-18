import { formatMoney } from '@parkviet/pos-shared/money'
import { describeFailure } from '@parkviet/pos-shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Card,
  CardContent,
  RowActions,
  SearchInput,
  useConfirm,
} from '@spree/dashboard-ui'
import { LayersIcon, PlusIcon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddonGroupDialog } from '../components/addon-group-dialog'
import { BranchPicker } from '../components/branch-picker'
import { MasterNotice } from '../components/master-page'
import { useMenuItems, useMenuWrite, useModifierGroups } from '../hooks/use-menu-admin'
import { usePosSession } from '../hooks/use-pos-session'
import { type AddonGroup, appliedItems, describeSelection } from '../lib/goods-addons'

type Notice = { text: string; failed: boolean } | null

// The store's add-on groups ("Topping", "Đường", "Size bánh"): how each is
// picked at the counter, its options, and how many products offer it. The
// route lets only menu managers in; they also edit the menu screen's groups.
export function GoodsAddonsPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { selection } = usePosSession()
  const groups = useModifierGroups(true)
  const items = useMenuItems(true)
  const write = useMenuWrite()
  const [notice, setNotice] = useState<Notice>(null)
  const [editor, setEditor] = useState<{ group?: AddonGroup } | null>(null)
  const [term, setTerm] = useState('')

  const rows = groups.data ?? []
  const needle = term.trim().toLocaleLowerCase()
  const shown = needle
    ? rows.filter((group) =>
        [group.name, ...group.options.map((option) => option.name)]
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle),
      )
    : rows

  async function remove(group: AddonGroup) {
    if (
      !(await confirm({
        message: t('goods.addons.deleteConfirm', { name: group.name }),
        variant: 'destructive',
        confirmLabel: t('goods.addons.delete'),
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    try {
      await write.mutateAsync({ method: 'DELETE', path: `/pos/modifier_groups/${group.id}` })
      setNotice({ text: t('goods.addons.deleted', { name: group.name }), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }
  function edit(group?: AddonGroup) {
    setNotice(null)
    setEditor({ group })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('goods.addons.title')}
        actions={
          <div className="flex items-center gap-2">
            <BranchPicker />
            <Button onClick={() => edit()}>
              <PlusIcon className="size-4" />
              {t('goods.addons.create')}
            </Button>
          </div>
        }
      />
      <p className="text-base text-muted-foreground">{t('goods.addons.hint')}</p>
      <MasterNotice notice={notice} />
      <SearchInput
        value={term}
        onValueChange={setTerm}
        placeholder={t('goods.addons.searchPlaceholder')}
        aria-label={t('goods.addons.searchPlaceholder')}
        clearLabel={t('goods.addons.clearSearch')}
        className="h-[2.125rem] max-w-sm"
      />
      {groups.isError ? (
        <div role="alert" className="space-y-2 text-sm">
          <p>{describeFailure(groups.error, t)}</p>
          <Button size="sm" variant="outline" onClick={() => void groups.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {groups.isPending ? t('waiting') : t('goods.addons.empty')}
        </p>
      ) : (
        <ul
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          aria-label={t('goods.addons.title')}
        >
          {shown.map((group) => {
            const count = items.data ? appliedItems(items.data, group.id).length : null
            return (
              <li key={group.id}>
                <Card className="h-full" data-addon-group={group.id}>
                  <CardContent className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <LayersIcon className="size-5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium hover:underline"
                        onClick={() => edit(group)}
                      >
                        {group.name}
                      </button>
                      <p className="text-sm text-muted-foreground">{describeSelection(group, t)}</p>
                      <ul
                        className="flex flex-wrap gap-1.5"
                        aria-label={t('goods.addons.optionsOf', { name: group.name })}
                      >
                        {group.options.map((option) => (
                          <li key={option.id}>
                            <Badge
                              variant={option.active ? 'secondary' : 'outline'}
                              className={option.active ? '' : 'text-muted-foreground line-through'}
                            >
                              {option.name}
                              {Number(option.price_delta) > 0 &&
                                ` +${formatMoney(option.price_delta)}`}
                              {!option.active && (
                                <span className="sr-only"> ({t('goods.addons.outOfStock')})</span>
                              )}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {count === null ? t('waiting') : t('goods.addons.productCount', { count })}
                      </p>
                    </div>
                    <RowActions
                      actions={[
                        {
                          key: 'edit',
                          label: t('adminEdit'),
                          disabled: write.isPending,
                          onSelect: () => edit(group),
                        },
                        {
                          key: 'delete',
                          label: t('goods.addons.delete'),
                          destructive: true,
                          disabled: write.isPending,
                          onSelect: () => void remove(group),
                        },
                      ]}
                    />
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      {editor && (
        <AddonGroupDialog
          group={editor.group}
          branchId={selection.branchId}
          onSaved={(name) => setNotice({ text: t('goods.addons.saved', { name }), failed: false })}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}
