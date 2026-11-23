// Thiết lập → Danh sách cửa hàng: every store the signed-in admin manages and
// opening a new one, like the admin dashboard's Settings → Stores. A new store
// opens straight away, where POS setup asks for its first branch.
import {
  Can,
  defineTable,
  mapSpreeErrorsToForm,
  PageHeader,
  ResourceTable,
  resourceSearchSchema,
  Subject,
  useAuth,
} from '@spree/dashboard-core'
import {
  ActiveBadge,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  ResourceNameCell,
  RowActions,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import { ArrowLeftRightIcon, Building2Icon, PlusIcon } from '@spree/dashboard-ui/icons'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { Controller, type UseFormReturn, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSession } from '../hooks/use-session'
import { useCountryCodes, useCreateStore } from '../hooks/use-stores'
import {
  EMPTY_NEW_STORE,
  type NewStoreFormValues,
  newStorePayload,
  type StoreRow,
} from '../schemas/store'
import { localList } from '../tables/local-list'

const ROW_ATTRIBUTE = 'data-pos-store-id' as const

export function StoresPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { storeId } = useSession()
  const [creating, setCreating] = useState(false)
  const search = resourceSearchSchema.parse(useSearch({ strict: false }))
  const rows: StoreRow[] = (user?.stores ?? []).map((store) => ({
    id: store.id,
    name: store.name,
    code: store.code,
    current: store.id === storeId,
  }))

  const openStore = useCallback(
    (id: string) => navigate({ to: '/$storeId', params: { storeId: id } }),
    [navigate],
  )
  useRowClickBridge(ROW_ATTRIBUTE, openStore)

  const tableKey = 'pos-stores'
  defineTable<StoreRow>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('stores.searchPlaceholder'),
    defaultSort: { field: 'name', direction: 'asc' },
    emptyIcon: <Building2Icon className="size-8 text-muted-foreground" />,
    emptyMessage: t('stores.empty'),
    columns: [
      {
        key: 'name',
        label: t('stores.fields.name'),
        sortable: true,
        default: true,
        render: (store) => (
          <ResourceNameCell id={store.id} dataAttr={ROW_ATTRIBUTE} name={store.name} />
        ),
      },
      {
        key: 'code',
        label: t('stores.fields.code'),
        sortable: true,
        default: true,
        render: (store) => <span className="text-muted-foreground">{store.code}</span>,
      },
      {
        key: 'current',
        label: t('stores.current'),
        default: true,
        render: (store) => (
          <ActiveBadge active={store.current} activeLabel={t('stores.current')} dashWhenInactive />
        ),
      },
    ],
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('stores.title')}
        description={t('stores.subtitle')}
        actions={
          <Can I="update" a={Subject.Store}>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="size-4" />
              {t('stores.add')}
            </Button>
          </Can>
        }
      />
      <ResourceTable<StoreRow>
        tableKey={tableKey}
        hideHeader
        queryKey={['pos', 'stores', rows.map((row) => `${row.id}:${row.name}:${row.current}`)]}
        queryFn={(params: Record<string, unknown>) =>
          Promise.resolve(
            localList(rows, params, {
              searchParam: 'search',
              text: (row) => `${row.name} ${row.code}`,
            }),
          )
        }
        searchParams={search}
        rowActions={(store) => (
          <RowActions
            actions={[
              {
                key: 'switch',
                label: t('stores.switch'),
                icon: <ArrowLeftRightIcon className="size-4" />,
                visible: !store.current,
                onSelect: () => openStore(store.id),
              },
            ]}
          />
        )}
      />
      {creating && <NewStoreSheet onClose={() => setCreating(false)} onCreated={openStore} />}
    </div>
  )
}

function NewStoreSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const createStore = useCreateStore()
  const form = useForm<NewStoreFormValues>({ defaultValues: EMPTY_NEW_STORE })

  async function onSubmit(values: NewStoreFormValues) {
    try {
      const created = await createStore.mutateAsync(newStorePayload(values))
      onClose()
      onCreated(created.id)
    } catch (err) {
      if (!mapSpreeErrorsToForm(err, form.setError)) throw err
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('stores.add')}</SheetTitle>
          <SheetDescription>{t('stores.sheetDescription')}</SheetDescription>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <TextField form={form} name="name" required />
            <CountryField form={form} />
            <TextField form={form} name="mail_from_address" help={t('stores.help.copied')} />
            <TextField form={form} name="customer_support_email" help={t('stores.help.copied')} />
          </div>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={form.formState.isSubmitting}
            >
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('stores.creating') : t('stores.create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function CountryField({ form }: { form: UseFormReturn<NewStoreFormValues> }) {
  const { t, i18n } = useTranslation()
  const { data: codes = [] } = useCountryCodes()
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: 'region' })
    return codes
      .map((code) => ({ value: code, label: names.of(code) ?? code }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [codes, i18n.language])
  const error = form.formState.errors.country_code

  return (
    <Field>
      <FieldLabel htmlFor="store-country_code">{t('stores.fields.country_code')}</FieldLabel>
      <Controller
        control={form.control}
        name="country_code"
        render={({ field }) => (
          <Select value={field.value} onValueChange={(value) => field.onChange(value as string)}>
            <SelectTrigger id="store-country_code" aria-invalid={!!error || undefined}>
              <SelectValue>
                {(value) => countries.find((country) => country.value === value)?.label ?? value}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>
                  {country.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldDescription>{t('stores.help.country')}</FieldDescription>
      <FieldError errors={[error]} />
    </Field>
  )
}

function TextField({
  form,
  name,
  required,
  help,
}: {
  form: UseFormReturn<NewStoreFormValues>
  name: 'name' | 'mail_from_address' | 'customer_support_email'
  required?: boolean
  help?: string
}) {
  const { t } = useTranslation()
  const error = form.formState.errors[name]
  return (
    <Field>
      <FieldLabel htmlFor={`store-${name}`}>{t(`stores.fields.${name}`)}</FieldLabel>
      <Input
        id={`store-${name}`}
        type={name === 'name' ? 'text' : 'email'}
        autoComplete="off"
        aria-invalid={!!error || undefined}
        {...form.register(name, required ? { required: t('stores.required') } : {})}
      />
      {help && <FieldDescription>{help}</FieldDescription>}
      <FieldError errors={[error]} />
    </Field>
  )
}
