import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'
import { PageHeader, usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Checkbox,
  DialogBody,
  DialogFooter,
  Field,
  FieldLabel,
  useConfirm,
} from '@spree/dashboard-ui'
import { BookOpenIcon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { GoodsComboEditor } from '../components/goods-combo-editor'
import { PageSkeleton } from '../components/page-skeleton'
import { RecipeEditor } from '../components/recipe-editor'
import { ModelCard } from '../components/setup/model-ui'
import { TopologyDialog } from '../components/topology-dialog'
import { Input, TopologyField, TopologySelect } from '../components/topology-fields'
import {
  type MenuSchedule,
  useBranchMenu,
  useMenuSchedules,
  useMenuWrite,
  useModifierGroups,
  useProductSettings,
} from '../hooks/use-menu-admin'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  canManageMenu,
  canManageRecipes,
  canSetSoldOut,
  type PosAccess,
  runsRecipes,
} from '../lib/pos-access'
import {
  type ComboRow,
  comboQuantityValid,
  comboRows,
  operationsOf,
  operationWrites,
  type ProductPosSettings,
  parseCombo,
} from '../lib/product-operations'

type Notice = { text: string; failed: boolean } | null
type Save = (method: string, path: string, body?: unknown) => Promise<void>

const MENU_REFUSALS = [
  'product_not_prepared',
  'module_disabled',
  'menu_schedule_days_invalid',
  'menu_favorites_limit',
  'menu_favorites_duplicate',
] as const

function menuFailure(error: unknown, t: (key: string) => string) {
  const reason = conflictReason(error)
  return reason && (MENU_REFUSALS as readonly string[]).includes(reason)
    ? t(`menuAdmin.failure_${reason}`)
    : describeFailure(error, t)
}

// The day-to-day operation of the menu: the store's combos and time-of-day
// menus, and for the selected branch its favourites row, today's sold-out
// marks and the recipes of what it sells. Products, categories, add-on
// groups and kitchen settings are managed in Goods ("Hàng hoá").
export function MenuPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { storeId } = useSession()
  const { context, selection } = usePosSession()
  const { permissionKeys } = usePermissions()
  const access: PosAccess = { permissionKeys, context: context.data }
  const manage = canManageMenu(access)
  const soldOut = canSetSoldOut(access)
  const editRecipes = canManageRecipes(access)
  // Menu managers read the recipes; inventory managers change them.
  const recipes = runsRecipes(access) && (manage || editRecipes)
  const products = useProductSettings(true)
  const groups = useModifierGroups(recipes)
  const schedules = useMenuSchedules(true)
  const branchMenu = useBranchMenu(selection.branchId)
  const write = useMenuWrite()
  const [notice, setNotice] = useState<Notice>(null)
  const [dialog, setDialog] = useState<ReactNode>(null)

  const save: Save = async (method, path, body) => {
    await write.mutateAsync({ method, path, body })
    setNotice({ text: t('saved'), failed: false })
  }
  async function run(action: () => Promise<void>) {
    setNotice(null)
    try {
      await action()
    } catch (failure) {
      setNotice({ text: menuFailure(failure, t), failed: true })
    }
  }
  async function confirmed(message: string, label: string) {
    return confirm({
      message,
      variant: 'destructive',
      confirmLabel: label,
      cancelLabel: t('adminCancel'),
    })
  }
  async function remove(path: string, name: string) {
    if (!(await confirmed(t('menuAdmin.confirmDelete', { name }), t('menuAdmin.delete')))) return
    await run(() => save('DELETE', path))
  }
  async function removeCombo(product: ProductPosSettings) {
    if (
      !(await confirmed(
        t('menuAdmin.confirmUncombo', { name: product.name }),
        t('menuAdmin.uncombo'),
      ))
    )
      return
    await run(() => save('PUT', `/pos/products/${product.product_id}/combo`, { components: [] }))
  }
  const close = () => setDialog(null)
  const productRows = products.data ?? []
  const combos = productRows.filter((product) => product.kind === 'combo')
  const groupRows = groups.data ?? []
  const loading = [products, schedules].find((query) => query.isError)
  const comboDialog = (product?: ProductPosSettings) => (
    <ComboDialog
      product={product}
      candidates={productRows.filter((row) => row.kind !== 'combo')}
      branchId={selection.branchId}
      save={save}
      onClose={close}
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('menuAdmin.title')}
        actions={
          <div className="flex items-center gap-2">
            <BranchPicker />
            {!manage && <Badge variant="outline">{t('adminReadAccess')}</Badge>}
          </div>
        }
      />
      <p className="text-base text-muted-foreground">
        {t('menuAdmin.intro')}{' '}
        <Link to="/$storeId/goods/products" params={{ storeId }} className="underline">
          {t('menuAdmin.openGoods')}
        </Link>
      </p>
      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={notice.failed ? 'text-destructive' : 'text-muted-foreground'}
        >
          {notice.text}
        </p>
      )}
      {loading?.error && (
        <div role="alert" className="text-destructive">
          {menuFailure(loading.error, t)}{' '}
          <Button variant="outline" onClick={() => void loading.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}

      <Section
        title={t('menuAdmin.combos')}
        action={
          manage && (
            <Button
              disabled={write.isPending || !products.isSuccess}
              onClick={() => setDialog(comboDialog())}
            >
              {t('menuAdmin.addCombo')}
            </Button>
          )
        }
      >
        <Rows
          empty={t(products.isPending ? 'waiting' : 'menuAdmin.noCombos')}
          rows={combos.map((product) => ({
            id: product.product_id,
            cells: [
              <Link
                key="name"
                to="/$storeId/goods/products/$productId"
                params={{ storeId, productId: product.product_id }}
                className="font-medium hover:underline"
              >
                {product.name}
              </Link>,
              <span key="components" className="text-muted-foreground">
                {product.components.map((row) => `${row.name} ×${row.quantity}`).join(', ')}
              </span>,
            ],
            actions: manage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setDialog(comboDialog(product))}>
                  {t('adminEdit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void removeCombo(product)}>
                  {t('menuAdmin.uncombo')}
                </Button>
              </>
            ),
          }))}
        />
      </Section>

      <Section
        title={t('menuAdmin.schedules')}
        action={
          manage && (
            <Button
              disabled={write.isPending}
              onClick={() =>
                setDialog(<ScheduleDialog products={productRows} save={save} onClose={close} />)
              }
            >
              {t('menuAdmin.addSchedule')}
            </Button>
          )
        }
      >
        <Rows
          empty={t('menuAdmin.none')}
          rows={(schedules.data ?? []).map((schedule) => ({
            id: schedule.id,
            cells: [
              <span key="name" className="font-medium">
                {schedule.name}
              </span>,
              <span key="window" className="text-muted-foreground tabular-nums">
                {schedule.starts_at}–{schedule.ends_at} ·{' '}
                {schedule.days_of_week.length === 0
                  ? t('menuAdmin.everyDay')
                  : schedule.days_of_week.map((day) => t(`menuAdmin.day_${day}`)).join(', ')}
              </span>,
              <span key="items" className="text-muted-foreground">
                {t('menuAdmin.scheduleItems', { count: schedule.items.length })}
              </span>,
            ],
            actions: manage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDialog(
                      <ScheduleDialog
                        schedule={schedule}
                        products={productRows}
                        save={save}
                        onClose={close}
                      />,
                    )
                  }
                >
                  {t('adminEdit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void remove(`/pos/menu_schedules/${schedule.id}`, schedule.name)}
                >
                  {t('menuAdmin.delete')}
                </Button>
              </>
            ),
          }))}
        />
      </Section>

      <Section title={t('menuAdmin.branchTitle')}>
        {branchMenu.isPending && <PageSkeleton />}
        {branchMenu.isError && (
          <p role="alert" className="text-destructive">
            {menuFailure(branchMenu.error, t)}
          </p>
        )}
        {branchMenu.data && (
          <BranchMenu
            menu={branchMenu.data.items.map((item) => ({
              id: item.product_id,
              name: item.name,
              soldOut: item.sold_out,
              recipe:
                recipes && item.kind !== 'combo'
                  ? () =>
                      setDialog(
                        <RecipeEditor
                          item={item}
                          groups={groupRows}
                          branchId={selection.branchId}
                          canEdit={editRecipes}
                          onClose={close}
                        />,
                      )
                  : null,
            }))}
            favorites={branchMenu.data.favorites}
            canFavorite={manage}
            canSoldOut={soldOut}
            busy={write.isPending}
            onFavorites={(ids) =>
              run(() =>
                save('PUT', '/pos/menu_favorites', {
                  branch_id: selection.branchId,
                  product_ids: ids,
                }),
              )
            }
            onSoldOut={(id, value) =>
              run(() =>
                save('PUT', '/pos/menu_availabilities', {
                  branch_id: selection.branchId,
                  product_id: id,
                  sold_out: value,
                }),
              )
            }
          />
        )}
      </Section>
      {dialog}
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <ModelCard title={title} id={id} icon={<BookOpenIcon />} action={action}>
      {children}
    </ModelCard>
  )
}

function Rows({
  rows,
  empty,
}: {
  rows: { id: string; cells: ReactNode[]; actions?: ReactNode }[]
  empty: string
}) {
  if (rows.length === 0) return <p className="text-muted-foreground">{empty}</p>
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
          {row.cells}
          {row.actions && <span className="ml-auto flex gap-2">{row.actions}</span>}
        </li>
      ))}
    </ul>
  )
}

function useDialogSubmit(onClose: () => void) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
      onClose()
    } catch (failure) {
      setError(menuFailure(failure, t))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

function DialogError({ error }: { error: string }) {
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  )
}

function DialogActions({
  busy,
  close,
  disabled,
}: {
  busy: boolean
  close: () => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <DialogFooter>
      <Button type="button" variant="outline" disabled={busy} onClick={close}>
        {t('adminCancel')}
      </Button>
      <Button type="submit" disabled={busy || disabled}>
        {t(busy ? 'waiting' : 'save')}
      </Button>
    </DialogFooter>
  )
}

function TextField({
  label,
  value,
  onChange,
  hint,
  maxLength,
  inputMode,
  type,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  maxLength?: number
  inputMode?: 'numeric' | 'text'
  type?: string
}) {
  return (
    <TopologyField label={label} hint={hint}>
      {(id, describedBy) => (
        <Input
          id={id}
          aria-describedby={describedBy}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          type={type}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </TopologyField>
  )
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  )
}

// The contents of one prepared product's combo. A new combo picks a single
// prepared product first; its add-on groups are cleared, since a combo lists
// its contents instead.
function ComboDialog({
  product,
  candidates,
  branchId,
  save,
  onClose,
}: {
  product?: ProductPosSettings
  candidates: ProductPosSettings[]
  branchId: string | null
  save: Save
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [productId, setProductId] = useState(product?.product_id ?? '')
  const [rows, setRows] = useState<ComboRow[]>(comboRows(product?.components ?? []))
  const [checked, setChecked] = useState(false)
  const { busy, error, submit } = useDialogSubmit(onClose)
  const target = product ?? candidates.find((row) => row.product_id === productId)
  const valid =
    Boolean(target) && rows.length > 0 && rows.every((row) => comboQuantityValid(row.quantity))
  return (
    <TopologyDialog
      title={t(product ? 'menuAdmin.editCombo' : 'menuAdmin.addCombo')}
      subtitle={product?.name}
      dirty
      busy={busy}
      wide
      onClose={onClose}
    >
      {(close) => (
        <form
          className="flex min-h-0 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setChecked(true)
            if (!target || !valid) return
            void submit(async () => {
              const writes = operationWrites(target.product_id, target, {
                operations: operationsOf(target),
                comboComponents: parseCombo(rows),
                modifierGroupIds: target.modifier_group_ids,
              })
              for (const write of writes) await save('PUT', write.path, write.body)
            })
          }}
        >
          <DialogBody className="space-y-4">
            {!product && (
              <TopologyField
                label={t('menuAdmin.comboProduct')}
                hint={t('menuAdmin.comboProductHint')}
              >
                {(id, describedBy) => (
                  <TopologySelect
                    id={id}
                    describedBy={describedBy}
                    value={productId}
                    options={[
                      { value: '', label: '—' },
                      ...candidates.map((row) => ({ value: row.product_id, label: row.name })),
                    ]}
                    onChange={setProductId}
                  />
                )}
              </TopologyField>
            )}
            <GoodsComboEditor
              rows={rows}
              onChange={setRows}
              branchId={branchId}
              checked={checked}
              disabled={busy}
            />
            <DialogError error={error} />
          </DialogBody>
          <DialogActions busy={busy} close={close} disabled={!valid} />
        </form>
      )}
    </TopologyDialog>
  )
}

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const

function ScheduleDialog({
  schedule,
  products,
  save,
  onClose,
}: {
  schedule?: MenuSchedule
  products: ProductPosSettings[]
  save: Save
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(schedule?.name ?? '')
  const [label, setLabel] = useState(schedule?.label ?? '')
  const [startsAt, setStartsAt] = useState(schedule?.starts_at ?? '14:00')
  const [endsAt, setEndsAt] = useState(schedule?.ends_at ?? '16:00')
  const [days, setDays] = useState<number[]>(schedule?.days_of_week ?? [])
  const [active, setActive] = useState(schedule?.active ?? true)
  const [rows, setRows] = useState(
    (schedule?.items ?? []).map((row) => ({
      productId: row.product_id,
      price: row.price?.replace(/\.0+$/, '') ?? '',
      hidden: row.hidden,
    })),
  )
  const { busy, error, submit } = useDialogSubmit(onClose)
  const valid =
    name.trim() &&
    /^\d{2}:\d{2}$/.test(startsAt) &&
    /^\d{2}:\d{2}$/.test(endsAt) &&
    startsAt !== endsAt &&
    rows.every((row) => row.hidden || /^\d+$/.test(row.price))
  const unused = products.filter(
    (product) => !rows.some((row) => row.productId === product.product_id),
  )
  return (
    <TopologyDialog
      title={t(schedule ? 'menuAdmin.editSchedule' : 'menuAdmin.addSchedule')}
      subtitle={schedule?.name}
      dirty
      busy={busy}
      onClose={onClose}
    >
      {(close) => (
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            void submit(() =>
              save(
                schedule ? 'PATCH' : 'POST',
                `/pos/menu_schedules${schedule ? `/${schedule.id}` : ''}`,
                {
                  name: name.trim(),
                  label: label.trim() || null,
                  starts_at: startsAt,
                  ends_at: endsAt,
                  days_of_week: days,
                  active,
                  items: rows.map((row) => ({
                    product_id: row.productId,
                    hidden: row.hidden,
                    price: row.hidden ? null : row.price,
                  })),
                },
              ),
            )
          }}
        >
          <DialogBody className="space-y-4">
            <TextField label={t('adminName')} value={name} onChange={setName} maxLength={80} />
            <TextField
              label={t('menuAdmin.scheduleLabel')}
              hint={t('menuAdmin.scheduleLabelHint')}
              value={label}
              onChange={setLabel}
              maxLength={40}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t('menuAdmin.startsAt')}
                value={startsAt}
                onChange={setStartsAt}
                type="time"
              />
              <TextField
                label={t('menuAdmin.endsAt')}
                hint={t('menuAdmin.endsAtHint')}
                value={endsAt}
                onChange={setEndsAt}
                type="time"
              />
            </div>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="mb-1 text-sm font-medium">{t('menuAdmin.days')}</legend>
              {DAYS.map((day) => (
                <CheckField
                  key={day}
                  label={t(`menuAdmin.day_${day}`)}
                  checked={days.includes(day)}
                  onChange={(checked) =>
                    setDays((current) =>
                      checked ? [...current, day] : current.filter((value) => value !== day),
                    )
                  }
                />
              ))}
            </fieldset>
            <p className="text-sm text-muted-foreground">{t('menuAdmin.daysHint')}</p>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('menuAdmin.scheduleItemsTitle')}</legend>
              {rows.map((row, index) => (
                <div key={row.productId} className="flex flex-wrap items-end gap-2">
                  <span className="flex-1 pb-2">
                    {products.find((product) => product.product_id === row.productId)?.name ??
                      row.productId}
                  </span>
                  {!row.hidden && (
                    <TextField
                      label={t('menuAdmin.price')}
                      value={row.price}
                      inputMode="numeric"
                      onChange={(value) =>
                        setRows((current) =>
                          current.map((entry, at) =>
                            at === index ? { ...entry, price: value } : entry,
                          ),
                        )
                      }
                    />
                  )}
                  <CheckField
                    label={t('menuAdmin.hidden')}
                    checked={row.hidden}
                    onChange={(checked) =>
                      setRows((current) =>
                        current.map((entry, at) =>
                          at === index ? { ...entry, hidden: checked } : entry,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  >
                    {t('menuAdmin.delete')}
                  </Button>
                </div>
              ))}
              {unused.length > 0 && (
                <TopologyField label={t('menuAdmin.addScheduleItem')}>
                  {(id) => (
                    <TopologySelect
                      id={id}
                      value=""
                      options={[
                        { value: '', label: '—' },
                        ...unused.map((product) => ({
                          value: product.product_id,
                          label: product.name,
                        })),
                      ]}
                      onChange={(value) => {
                        if (value)
                          setRows((current) => [
                            ...current,
                            { productId: value, price: '', hidden: false },
                          ])
                      }}
                    />
                  )}
                </TopologyField>
              )}
            </fieldset>
            <CheckField label={t('statusActive')} checked={active} onChange={setActive} />
            <DialogError error={error} />
          </DialogBody>
          <DialogActions busy={busy} close={close} disabled={!valid} />
        </form>
      )}
    </TopologyDialog>
  )
}

// The selected branch: its favourites row (in order), today's sold-out marks
// and the recipes of what it sells, keyed by product.
function BranchMenu({
  menu,
  favorites,
  canFavorite,
  canSoldOut,
  busy,
  onFavorites,
  onSoldOut,
}: {
  menu: { id: string; name: string; soldOut: boolean; recipe: (() => void) | null }[]
  favorites: string[]
  canFavorite: boolean
  canSoldOut: boolean
  busy: boolean
  onFavorites: (ids: string[]) => Promise<void>
  onSoldOut: (id: string, soldOut: boolean) => Promise<void>
}) {
  const { t } = useTranslation()
  if (menu.length === 0) return <p className="text-muted-foreground">{t('menuAdmin.none')}</p>
  return (
    <ul className="divide-y">
      {menu.map((item) => {
        const favorite = favorites.includes(item.id)
        return (
          <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="flex-1 font-medium">{item.name}</span>
            {favorite && (
              <Badge variant="outline">
                {t('menuAdmin.favoriteAt', { position: favorites.indexOf(item.id) + 1 })}
              </Badge>
            )}
            {item.soldOut && <Badge variant="destructive">{t('menuAdmin.soldOut')}</Badge>}
            {item.recipe && (
              <Button variant="outline" size="sm" onClick={item.recipe}>
                {t('recipes.open')}
              </Button>
            )}
            {canFavorite && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void onFavorites(
                    favorite ? favorites.filter((id) => id !== item.id) : [...favorites, item.id],
                  )
                }
              >
                {t(favorite ? 'menuAdmin.unfavorite' : 'menuAdmin.favorite')}
              </Button>
            )}
            {canSoldOut && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void onSoldOut(item.id, !item.soldOut)}
              >
                {t(item.soldOut ? 'menuAdmin.backOnSale' : 'menuAdmin.markSoldOut')}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
