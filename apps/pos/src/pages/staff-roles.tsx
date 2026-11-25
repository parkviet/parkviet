import {
  defineTable,
  mapSpreeErrorsToForm,
  PageHeader,
  ResourceTable,
  resourceSearchSchema,
} from '@spree/dashboard-core'
import {
  ActiveBadge,
  Badge,
  Button,
  Checkbox,
  DialogBody,
  DialogFooter,
  Field,
  FieldLabel,
  ResourceNameCell,
  RowActions,
  useConfirm,
  useRowClickBridge,
} from '@spree/dashboard-ui'
import { BanIcon, CopyIcon, RotateCcwIcon, TrashIcon } from '@spree/dashboard-ui/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { CapabilityChecklist } from '../components/capability-checklist'
import { MasterNotice, MasterState } from '../components/master-page'
import { TopologyDialog } from '../components/topology-dialog'
import { Input, TopologyField } from '../components/topology-fields'
import {
  masterFailure,
  readStaffRoles,
  type StaffRole,
  useStoreWrite,
} from '../hooks/use-master-data'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import { capabilityLabel, changesSensitive } from '../lib/capability-groups'
import { posKey } from '../lib/query-keys'
import { type StaffRoleFormValues, staffRoleSchema } from '../schemas/master-data'
import { hiddenTimestamps } from '../tables/columns'
import { localList } from '../tables/local-list'

const ROW_ATTRIBUTE = 'data-pos-staff-role-id' as const

// Quick-start F&B / retail role templates (Tendoo-inspired)
const ROLE_TEMPLATES: { key: string; capabilities: string[] }[] = [
  {
    key: 'cashier',
    capabilities: [
      'pos.shift.open',
      'pos.payment.collect',
      'pos.customer.write',
      'pos.discount.apply',
      'pos.return.process',
    ],
  },
  {
    key: 'server',
    capabilities: ['pos.table.serve', 'pos.reservation.manage', 'pos.guest_order.decide'],
  },
  {
    key: 'chef',
    capabilities: ['pos.kitchen.operate', 'pos.kitchen.manage', 'pos.expo.operate', 'pos.menu.sold_out'],
  },
  {
    key: 'stock',
    capabilities: ['pos.inventory.manage', 'pos.inventory.trace', 'pos.report.read'],
  },
  {
    key: 'manager',
    capabilities: [
      'pos.shift.open',
      'pos.payment.collect',
      'pos.payment.resolve',
      'pos.cash.move',
      'pos.discount.apply',
      'pos.price.override',
      'pos.return.process',
      'pos.approval.grant',
      'pos.workspace.takeover',
      'pos.topology.manage',
      'pos.report.read',
      'pos.report.export',
      'pos.inventory.manage',
    ],
  },
]

// Named capability sets that memberships take instead of their own list. A
// change reaches every member at once; a role in use cannot be disabled or
// deleted.
export function StaffRolesPage() {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const client = useQueryClient()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const searchParams = resourceSearchSchema.parse(useSearch({ strict: false }))
  const access = context.data?.administration ?? { read: false, write: false }
  const write = useStoreWrite()
  const [editor, setEditor] = useState<{ role?: StaffRole; cloneFrom?: StaffRole } | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  async function run(
    request: { method: string; path: string; body?: unknown },
    question: { message: string; confirmLabel: string; destructive: boolean },
  ) {
    if (!access.write || write.isPending) return
    if (
      !(await confirm({
        message: question.message,
        variant: question.destructive ? 'destructive' : 'default',
        confirmLabel: question.confirmLabel,
        cancelLabel: t('adminCancel'),
      }))
    )
      return
    setNotice(null)
    try {
      await write.mutateAsync(request)
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: masterFailure(failure, t), failed: true })
    }
  }
  const setStatus = (role: StaffRole) => {
    const disabling = role.status === 'active'
    return run(
      {
        method: 'PATCH',
        path: `/pos/staff_roles/${role.id}`,
        body: { status: disabling ? 'disabled' : 'active' },
      },
      {
        message: t(disabling ? 'adminConfirmDisable' : 'adminConfirmEnable', { name: role.name }),
        confirmLabel: t(disabling ? 'adminDisable' : 'adminEnable'),
        destructive: disabling,
      },
    )
  }
  const remove = (role: StaffRole) =>
    run(
      { method: 'DELETE', path: `/pos/staff_roles/${role.id}` },
      {
        message: t('staffRoles.confirmDelete', { name: role.name }),
        confirmLabel: t('staffRoles.delete'),
        destructive: true,
      },
    )
  function edit(role?: StaffRole, cloneFrom?: StaffRole) {
    setNotice(null)
    setEditor({ role, cloneFrom })
  }
  const rows = useRef<StaffRole[]>([])
  const openRole = useRef<(id: string) => void>(() => {})
  openRole.current = (id) => {
    const role = rows.current.find((row) => row.id === id)
    if (role && access.write) edit(role)
  }
  const openRow = useCallback((id: string) => openRole.current(id), [])
  useRowClickBridge(ROW_ATTRIBUTE, openRow)
  const tableKey = 'pos-staff-roles'
  defineTable<StaffRole>(tableKey, {
    searchParam: 'search',
    searchPlaceholder: t('adminSearchName'),
    defaultSort: { field: 'name', direction: 'asc' },
    emptyMessage: t('staffRoles.empty'),
    columns: [
      {
        key: 'name',
        label: t('adminName'),
        sortable: true,
        default: true,
        render: (role) => (
          <ResourceNameCell
            id={role.id}
            dataAttr={access.write ? ROW_ATTRIBUTE : undefined}
            name={role.name}
            secondary={t('staffRoles.capabilityCount', { count: role.capabilities.length })}
          />
        ),
      },
      {
        key: 'capabilities',
        label: t('membership'),
        default: true,
        className: 'whitespace-normal',
        render: (role) => (
          <div className="flex flex-wrap gap-1">
            {role.capabilities.map((capability) => (
              <Badge key={capability} variant="outline">
                {t(capabilityLabel(capability))}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'membership_count',
        label: t('staffRoles.members'),
        sortable: true,
        default: true,
        className: 'tabular-nums',
      },
      {
        key: 'status',
        label: t('adminStatus'),
        sortable: true,
        filterable: true,
        default: true,
        filterType: 'enum',
        quickFilter: true,
        filterOptions: ['active', 'disabled'].map((value) => ({
          value,
          label: t(value === 'active' ? 'statusActive' : 'statusDisabled'),
        })),
        render: (role) => (
          <ActiveBadge
            active={role.status === 'active'}
            activeLabel={t('statusActive')}
            inactiveLabel={t('statusDisabled')}
          />
        ),
      },
      ...hiddenTimestamps<StaffRole>(),
    ],
  })
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffRoles.title')}
        actions={
          access.write ? (
            <Button disabled={write.isPending} onClick={() => edit()}>
              {t('staffRoles.create')}
            </Button>
          ) : access.read ? (
            <Badge variant="outline">{t('adminReadAccess')}</Badge>
          ) : undefined
        }
      />
      <MasterState>
        <MasterNotice notice={notice} />
        <ResourceTable<StaffRole>
          tableKey={tableKey}
          hideHeader
          queryKey={['pos', 'staff-roles', 'table']}
          queryFn={async (params: Record<string, unknown>) => {
            const all = await client.fetchQuery({
              queryKey: posKey(storeId, 'staff-roles', 'all'),
              queryFn: () => readStaffRoles(true),
            })
            rows.current = all
            return localList(all, params, {
              searchParam: 'search',
              text: (role) => role.name,
              sortValue: (role, field) =>
                field === 'membership_count'
                  ? String(role.membership_count).padStart(9, '0')
                  : undefined,
            })
          }}
          searchParams={searchParams}
          rowActions={(role) => (
            <RowActions
              actions={[
                {
                  key: 'edit',
                  label: t('adminEdit'),
                  visible: access.write,
                  disabled: write.isPending,
                  onSelect: () => edit(role),
                },
                {
                  key: 'duplicate',
                  label: t('staffRoles.duplicate'),
                  icon: <CopyIcon className="size-4" />,
                  visible: access.write,
                  disabled: write.isPending,
                  onSelect: () => edit(undefined, role),
                },
                {
                  key: role.status === 'active' ? 'disable' : 'enable',
                  label: t(role.status === 'active' ? 'adminDisable' : 'adminEnable'),
                  icon:
                    role.status === 'active' ? (
                      <BanIcon className="size-4" />
                    ) : (
                      <RotateCcwIcon className="size-4" />
                    ),
                  visible: access.write,
                  destructive: role.status === 'active',
                  disabled: write.isPending,
                  onSelect: () => void setStatus(role),
                },
                {
                  key: 'delete',
                  label: t('staffRoles.delete'),
                  icon: <TrashIcon className="size-4" />,
                  visible: access.write,
                  destructive: true,
                  disabled: write.isPending,
                  onSelect: () => void remove(role),
                },
              ]}
            />
          )}
        />
      </MasterState>
      {editor && access.write && (
        <StaffRoleDialog
          role={editor.role}
          cloneFrom={editor.cloneFrom}
          onSave={async (body) => {
            await write.mutateAsync({
              method: editor.role ? 'PATCH' : 'POST',
              path: `/pos/staff_roles${editor.role ? `/${editor.role.id}` : ''}`,
              body,
            })
            setNotice({ text: t('saved'), failed: false })
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

function StaffRoleDialog({
  role,
  cloneFrom,
  onSave,
  onClose,
}: {
  role?: StaffRole
  cloneFrom?: StaffRole
  onSave: (body: StaffRoleFormValues) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const form = useForm<StaffRoleFormValues>({
    defaultValues: {
      name: role?.name ?? (cloneFrom ? `${cloneFrom.name} (${t('staffRoles.copySuffix')})` : ''),
      capabilities: role?.capabilities ?? cloneFrom?.capabilities ?? [],
    },
  })
  const draft = form.watch()
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const busy = form.formState.isSubmitting
  const dirty = form.formState.isDirty || Boolean(cloneFrom)
  // Members of the role get the change at once, so sensitive grants are confirmed.
  const sensitive = changesSensitive(role?.capabilities ?? [], draft.capabilities)
  async function submit(values: StaffRoleFormValues) {
    if (sensitive && !confirmed) return
    form.clearErrors()
    const parsed = staffRoleSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        form.setError(issue.path[0] as keyof StaffRoleFormValues, { message: t(issue.message) })
      return
    }
    setError('')
    try {
      await onSave(parsed.data)
      onClose()
    } catch (failure) {
      mapSpreeErrorsToForm(failure, form.setError)
      setError(masterFailure(failure, t))
    }
  }
  return (
    <TopologyDialog
      title={t(role ? 'staffRoles.editTitle' : 'staffRoles.createTitle')}
      subtitle={
        role ? t('staffRoles.membersNote', { count: role.membership_count }) : t('staffRoles.intro')
      }
      dirty={dirty}
      busy={busy}
      onClose={onClose}
    >
      {(close) => (
        <form
          onSubmit={form.handleSubmit(submit)}
          aria-busy={busy}
          className="flex min-h-0 flex-col"
        >
          <DialogBody className="space-y-5">
            <fieldset disabled={busy} className="space-y-4">
              <TopologyField label={t('adminName')} error={form.formState.errors.name?.message}>
                {(id) => (
                  <Input
                    id={id}
                    maxLength={80}
                    aria-invalid={Boolean(form.formState.errors.name)}
                    value={draft.name}
                    onChange={(event) =>
                      form.setValue('name', event.target.value, { shouldDirty: true })
                    }
                  />
                )}
              </TopologyField>
              {!role && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    {t('staffRoles.quickStartHint')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLE_TEMPLATES.map((tpl) => (
                      <Button
                        key={tpl.key}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (!draft.name.trim()) {
                            form.setValue('name', t(`staffRoles.template_${tpl.key}`), {
                              shouldDirty: true,
                            })
                          }
                          form.setValue('capabilities', tpl.capabilities, { shouldDirty: true })
                          setConfirmed(false)
                        }}
                      >
                        {t(`staffRoles.template_${tpl.key}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <fieldset aria-label={t('membership')}>
                <CapabilityChecklist
                  value={draft.capabilities}
                  onChange={(next) => {
                    form.setValue('capabilities', next, { shouldDirty: true })
                    setConfirmed(false)
                  }}
                />
              </fieldset>
              {sensitive && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="confirm-role-permissions"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  <FieldLabel htmlFor="confirm-role-permissions">
                    {t('adminConfirmPermissions')}
                  </FieldLabel>
                </Field>
              )}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={busy || !dirty || (sensitive && !confirmed)}>
              {t(busy ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      )}
    </TopologyDialog>
  )
}
