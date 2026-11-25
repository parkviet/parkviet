import { describeFailure } from '@shared/request-failure'
import { PageHeader } from '@spree/dashboard-core'
import {
  ActiveBadge,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Label,
  RowActions,
  useConfirm,
} from '@spree/dashboard-ui'
import {
  BanIcon,
  Building2Icon,
  PlusIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  UserPlusIcon,
} from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CapabilityChecklist } from '../components/capability-checklist'
import { PageSkeleton } from '../components/page-skeleton'
import { ModelCard } from '../components/setup/model-ui'
import { type StaffRole, useStaffRoles } from '../hooks/use-master-data'
import { usePosSession } from '../hooks/use-pos-session'
import { useSession } from '../hooks/use-session'
import {
  type StaffMember,
  type StaffMembershipSummary,
  useStaffDirectory,
  useStaffMutation,
} from '../hooks/use-staff-directory'
import { useBranches } from '../hooks/use-topology'
import { capabilityLabel, changesSensitive } from '../lib/capability-groups'

const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring'

function displayName(member: StaffMember) {
  if (member.full_name?.trim()) return member.full_name.trim()
  const parts = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
  return parts || member.email
}

function initials(member: StaffMember) {
  const name = displayName(member)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('vi-VN')
}

export function StaffDirectoryPage() {
  const { t } = useTranslation()
  const { storeId } = useSession()
  const { context } = usePosSession()
  const confirm = useConfirm()
  const access = context.data?.administration ?? { read: false, write: false }
  const currentStaffId = context.data?.staff.id ?? null

  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const [editor, setEditor] = useState<{ member?: StaffMember } | null>(null)
  const [assignTarget, setAssignTarget] = useState<StaffMember | null>(null)

  const staffQuery = useStaffDirectory(
    { q: search.trim(), branch_id: branchFilter, status: statusFilter, limit: 100 },
    access.read,
  )
  const branchesQuery = useBranches(access.read)
  const rolesQuery = useStaffRoles(access.read)
  const mutation = useStaffMutation()

  const branches = branchesQuery.data?.data ?? []
  const activeBranches = branches.filter((b) => b.status === 'active')
  const roles = (rolesQuery.data ?? []).filter((r) => r.status === 'active')
  const members = staffQuery.data?.data ?? []
  const summary = staffQuery.data?.meta.summary ?? {
    total: 0,
    active: 0,
    disabled: 0,
    assigned: 0,
    unassigned: 0,
  }

  // Keep assignTarget synced with latest query data after mutations
  const activeAssignMember = assignTarget
    ? (members.find((m) => m.id === assignTarget.id) ?? assignTarget)
    : null

  async function toggleStatus(member: StaffMember) {
    if (!access.write || mutation.isPending) return
    const disabling = member.status === 'active'
    const ok = await confirm({
      message: t(disabling ? 'adminConfirmDisable' : 'adminConfirmEnable', {
        name: displayName(member),
      }),
      variant: disabling ? 'destructive' : 'default',
      confirmLabel: t(disabling ? 'adminDisable' : 'adminEnable'),
      cancelLabel: t('adminCancel'),
    })
    if (!ok) return
    setNotice(null)
    try {
      await mutation.mutateAsync({
        method: 'POST',
        path: `/pos/staff/${member.id}/${disabling ? 'disable' : 'enable'}`,
        body: {},
      })
      setNotice({ text: t('saved'), failed: false })
    } catch (err) {
      setNotice({ text: describeFailure(err, t), failed: true })
    }
  }

  if (context.isPending) return <PageSkeleton />

  if (!access.read) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('staffDirectory.title')} />
        <ModelCard title={t('forbidden')} id="staff-forbidden" icon={<ShieldAlertIcon />}>
          <p>{t('adminAccessDenied')}</p>
        </ModelCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffDirectory.title')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/$storeId/staff-roles" params={{ storeId }}>
                {t('staffRoles.title')}
              </Link>
            </Button>
            {access.write ? (
              <Button
                disabled={mutation.isPending}
                onClick={() => {
                  setNotice(null)
                  setEditor({})
                }}
              >
                <UserPlusIcon className="mr-1.5 size-4" />
                {t('staffDirectory.create')}
              </Button>
            ) : (
              <Badge variant="outline">{t('adminReadAccess')}</Badge>
            )}
          </div>
        }
      />

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setBranchFilter('')
            setStatusFilter('')
          }}
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffDirectory.kpiTotal')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{summary.total}</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setBranchFilter('')
            setStatusFilter('active')
          }}
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffDirectory.kpiActive')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
            {summary.active}
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setBranchFilter('')
            setStatusFilter('')
          }}
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffDirectory.kpiAssigned')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{summary.assigned}</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setBranchFilter('unassigned')
            setStatusFilter('')
          }}
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="text-xs font-medium text-muted-foreground">
            {t('staffDirectory.kpiUnassigned')}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">
            {summary.unassigned}
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Input
          type="search"
          className="w-full sm:w-64"
          placeholder={t('staffDirectory.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={t('staffDirectory.filterBranch')}
          className={`${selectClass} w-full sm:w-56`}
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
        >
          <option value="">{t('staffDirectory.allBranches')}</option>
          <option value="unassigned">{t('staffDirectory.unassigned')}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('adminStatus')}
          className={`${selectClass} w-full sm:w-44`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t('staffDirectory.allStatuses')}</option>
          <option value="active">{t('statusActive')}</option>
          <option value="disabled">{t('statusDisabled')}</option>
        </select>
        {(search || branchFilter || statusFilter) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('')
              setBranchFilter('')
              setStatusFilter('')
            }}
          >
            {t('staffDirectory.clearFilters')}
          </Button>
        )}
      </div>

      {notice && (
        <p
          role={notice.failed ? 'alert' : 'status'}
          className={`text-sm ${notice.failed ? 'text-destructive' : 'text-emerald-600'}`}
        >
          {notice.text}
        </p>
      )}

      {staffQuery.isError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {describeFailure(staffQuery.error, t)}
        </div>
      )}

      {/* Staff Table */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">{t('adminStaff')}</th>
              <th className="px-4 py-3">{t('staffDirectory.branchesColumn')}</th>
              <th className="px-4 py-3">{t('adminStatus')}</th>
              <th className="px-4 py-3">{t('staffDirectory.joinedAt')}</th>
              <th className="w-24 px-4 py-3 text-right">{t('staffDirectory.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {staffQuery.isPending ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t('waiting')}
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {t('staffDirectory.empty')}
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(member)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{displayName(member)}</div>
                        <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {member.memberships.length === 0 ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                          {t('staffDirectory.unassigned')}
                        </Badge>
                      ) : (
                        member.memberships.map((m) => (
                          <Badge
                            key={m.id}
                            variant={m.status === 'active' ? 'secondary' : 'outline'}
                            className={m.status === 'disabled' ? 'opacity-60 line-through' : ''}
                          >
                            {m.branch_name}
                            {' · '}
                            {m.staff_role?.name ?? t('staffRoles.custom')}
                          </Badge>
                        ))
                      )}
                      {access.write && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-primary"
                          onClick={() => {
                            setNotice(null)
                            setAssignTarget(member)
                          }}
                        >
                          <Building2Icon className="mr-1 size-3" />
                          {t('staffDirectory.assignBranches')}
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ActiveBadge
                      active={member.status === 'active'}
                      activeLabel={t('statusActive')}
                      inactiveLabel={t('statusDisabled')}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(member.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      actions={[
                        {
                          key: 'assign',
                          label: t('staffDirectory.assignBranches'),
                          icon: <Building2Icon className="size-4" />,
                          visible: access.write,
                          onSelect: () => {
                            setNotice(null)
                            setAssignTarget(member)
                          },
                        },
                        {
                          key: 'edit',
                          label: t('adminEdit'),
                          visible: access.write,
                          onSelect: () => {
                            setNotice(null)
                            setEditor({ member })
                          },
                        },
                        {
                          key: member.status === 'active' ? 'disable' : 'enable',
                          label: t(member.status === 'active' ? 'adminDisable' : 'adminEnable'),
                          icon:
                            member.status === 'active' ? (
                              <BanIcon className="size-4" />
                            ) : (
                              <RotateCcwIcon className="size-4" />
                            ),
                          visible: access.write && member.id !== currentStaffId,
                          destructive: member.status === 'active',
                          disabled: mutation.isPending,
                          onSelect: () => void toggleStatus(member),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Staff Modal */}
      {editor && access.write && (
        <StaffFormDialog
          member={editor.member}
          branches={activeBranches}
          roles={roles}
          onSuccess={() => {
            setEditor(null)
            setNotice({ text: t('saved'), failed: false })
          }}
          onClose={() => setEditor(null)}
        />
      )}

      {/* Assign Branches Modal */}
      {activeAssignMember && access.write && (
        <StaffBranchAssignmentsDialog
          member={activeAssignMember}
          branches={branches}
          roles={roles}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  )
}

function StaffFormDialog({
  member,
  branches,
  roles,
  onSuccess,
  onClose,
}: {
  member?: StaffMember
  branches: { id: string; name: string }[]
  roles: StaffRole[]
  onSuccess: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = useStaffMutation()
  const isEdit = Boolean(member)

  const [firstName, setFirstName] = useState(member?.first_name ?? '')
  const [lastName, setLastName] = useState(member?.last_name ?? '')
  const [email, setEmail] = useState(member?.email ?? '')
  const [password, setPassword] = useState('')
  const [initialBranchId, setInitialBranchId] = useState('')
  const [initialRoleId, setInitialRoleId] = useState('')
  const [error, setError] = useState('')

  const selectedRole = roles.find((r) => r.id === initialRoleId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError(t('staffDirectory.emailRequired'))
      return
    }
    if (!isEdit && password.length < 6) {
      setError(t('staffDirectory.passwordMinLength'))
      return
    }
    if (isEdit && password.length > 0 && password.length < 6) {
      setError(t('staffDirectory.passwordMinLength'))
      return
    }

    try {
      if (isEdit && member) {
        const body: Record<string, unknown> = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
        }
        if (password) body.password = password
        await mutation.mutateAsync({ method: 'PATCH', path: `/pos/staff/${member.id}`, body })
      } else {
        const memberships = initialBranchId
          ? [
              {
                branch_id: initialBranchId,
                staff_role_id: initialRoleId || null,
                capabilities: initialRoleId ? [] : ['pos.shift.open'],
              },
            ]
          : []
        await mutation.mutateAsync({
          method: 'POST',
          path: '/pos/staff',
          body: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            password,
            memberships,
          },
        })
      }
      onSuccess()
    } catch (err) {
      setError(describeFailure(err, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t(isEdit ? 'staffDirectory.editTitle' : 'staffDirectory.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(isEdit ? 'staffDirectory.editSubtitle' : 'staffDirectory.createSubtitle')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex min-h-0 flex-col">
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-first-name">{t('staffDirectory.firstName')}</Label>
                <Input
                  id="staff-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nguyễn"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-last-name">{t('staffDirectory.lastName')}</Label>
                <Input
                  id="staff-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Văn A"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-email">{t('staffDirectory.email')} *</Label>
              <Input
                id="staff-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhanvien@parkviet.vn"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-password">
                {t(isEdit ? 'staffDirectory.newPassword' : 'staffDirectory.password')}
                {!isEdit && ' *'}
              </Label>
              <Input
                id="staff-password"
                type="password"
                required={!isEdit}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  isEdit
                    ? t('staffDirectory.passwordKeepPlaceholder')
                    : t('staffDirectory.passwordPlaceholder')
                }
              />
            </div>

            {!isEdit && branches.length > 0 && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
                <div>
                  <div className="text-sm font-medium">{t('staffDirectory.initialBranchTitle')}</div>
                  <p className="text-xs text-muted-foreground">
                    {t('staffDirectory.initialBranchHint')}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="initial-branch">{t('branch')}</Label>
                    <select
                      id="initial-branch"
                      className={selectClass}
                      value={initialBranchId}
                      onChange={(e) => setInitialBranchId(e.target.value)}
                    >
                      <option value="">{t('staffDirectory.assignLater')}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {initialBranchId && (
                    <div className="space-y-1">
                      <Label htmlFor="initial-role">{t('staffRoles.field')}</Label>
                      <select
                        id="initial-role"
                        className={selectClass}
                        value={initialRoleId}
                        onChange={(e) => setInitialRoleId(e.target.value)}
                      >
                        <option value="">{t('staffDirectory.defaultBasicRole')}</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {initialBranchId && selectedRole && (
                  <div className="rounded-md border bg-background p-2.5">
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t('staffDirectory.rolePermissionsPreview', { name: selectedRole.name })}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedRole.capabilities.map((cap) => (
                        <Badge key={cap} variant="outline" className="text-xs">
                          {t(capabilityLabel(cap))}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t(mutation.isPending ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function StaffBranchAssignmentsDialog({
  member,
  branches,
  roles,
  onClose,
}: {
  member: StaffMember
  branches: { id: string; name: string; status: string }[]
  roles: StaffRole[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = useStaffMutation()
  const confirm = useConfirm()

  const assignedBranchIds = new Set(member.memberships.map((m) => m.branch_id))
  const unassignedBranches = branches.filter(
    (b) => b.status === 'active' && !assignedBranchIds.has(b.id),
  )

  const [editingMembership, setEditingMembership] = useState<StaffMembershipSummary | null>(null)
  const [branchId, setBranchId] = useState(unassignedBranches[0]?.id ?? '')
  const [staffRoleId, setStaffRoleId] = useState(roles[0]?.id ?? '')
  const [capabilities, setCapabilities] = useState<string[]>(['pos.shift.open'])
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(member.memberships.length === 0)

  const selectedRole = roles.find((r) => r.id === staffRoleId)
  const effectiveCapabilities = staffRoleId ? (selectedRole?.capabilities ?? []) : capabilities
  const previousCapabilities = editingMembership?.capabilities ?? ['pos.shift.open']
  const sensitive = changesSensitive(previousCapabilities, effectiveCapabilities)

  function openEditMembership(m: StaffMembershipSummary) {
    setError('')
    setShowAddForm(false)
    setEditingMembership(m)
    setBranchId(m.branch_id)
    setStaffRoleId(m.staff_role?.id ?? '')
    setCapabilities(m.custom_capabilities ?? m.capabilities)
    setConfirmed(false)
  }

  function openAddForm() {
    setError('')
    setEditingMembership(null)
    setBranchId(unassignedBranches[0]?.id ?? '')
    setStaffRoleId(roles[0]?.id ?? '')
    setCapabilities(['pos.shift.open'])
    setConfirmed(false)
    setShowAddForm(true)
  }

  async function submitAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (sensitive && !confirmed) return
    setError('')
    try {
      if (editingMembership) {
        await mutation.mutateAsync({
          method: 'PATCH',
          path: `/pos/memberships/${editingMembership.id}`,
          body: {
            staff_role_id: staffRoleId || null,
            capabilities: staffRoleId ? editingMembership.custom_capabilities ?? [] : capabilities,
          },
        })
        setEditingMembership(null)
      } else {
        if (!branchId) {
          setError(t('chooseBranch'))
          return
        }
        await mutation.mutateAsync({
          method: 'POST',
          path: '/pos/memberships',
          body: {
            branch_id: branchId,
            staff_id: member.id,
            staff_role_id: staffRoleId || null,
            capabilities: staffRoleId ? [] : capabilities,
          },
        })
        setShowAddForm(false)
      }
    } catch (err) {
      setError(describeFailure(err, t))
    }
  }

  async function toggleMembership(m: StaffMembershipSummary) {
    const disabling = m.status === 'active'
    const ok = await confirm({
      message: t(disabling ? 'adminConfirmDisable' : 'adminConfirmEnable', {
        name: `${displayName(member)} · ${m.branch_name}`,
      }),
      variant: disabling ? 'destructive' : 'default',
      confirmLabel: t(disabling ? 'adminDisable' : 'adminEnable'),
      cancelLabel: t('adminCancel'),
    })
    if (!ok) return
    setError('')
    try {
      await mutation.mutateAsync({
        method: 'POST',
        path: `/pos/memberships/${m.id}/${disabling ? 'disable' : 'enable'}`,
        body: {},
      })
    } catch (err) {
      setError(describeFailure(err, t))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('staffDirectory.assignModalTitle')}</DialogTitle>
          <DialogDescription>
            {displayName(member)} · {member.email}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] space-y-5 overflow-y-auto">
          {/* Current Branch Assignments */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {t('staffDirectory.assignedBranchesCount', { count: member.memberships.length })}
              </div>
              {unassignedBranches.length > 0 && !showAddForm && !editingMembership && (
                <Button type="button" size="sm" variant="outline" onClick={openAddForm}>
                  <PlusIcon className="mr-1 size-3.5" />
                  {t('staffDirectory.addBranchAssignment')}
                </Button>
              )}
            </div>

            {member.memberships.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                {t('staffDirectory.noBranchesAssigned')}
              </p>
            ) : (
              <div className="space-y-2">
                {member.memberships.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.branch_name}</span>
                        <ActiveBadge
                          active={m.status === 'active'}
                          activeLabel={t('statusActive')}
                          inactiveLabel={t('statusDisabled')}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>{m.staff_role?.name ?? t('staffRoles.custom')}</span>
                        <span>·</span>
                        <span>
                          {t('staffRoles.capabilityCount', { count: m.capabilities.length })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => openEditMembership(m)}
                      >
                        {t('adminEdit')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={mutation.isPending}
                        onClick={() => void toggleMembership(m)}
                      >
                        {t(m.status === 'active' ? 'adminDisable' : 'adminEnable')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add or Edit Membership Form */}
          {(showAddForm || editingMembership) && (
            <form
              onSubmit={(e) => void submitAssignment(e)}
              className="space-y-4 rounded-lg border bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {editingMembership
                    ? t('staffDirectory.editBranchAssignment', {
                        branch: editingMembership.branch_name,
                      })
                    : t('staffDirectory.addBranchAssignment')}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingMembership(null)
                    setError('')
                  }}
                >
                  {t('adminCancel')}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {!editingMembership && (
                  <div className="space-y-1.5">
                    <Label htmlFor="assign-branch">{t('branch')} *</Label>
                    <select
                      id="assign-branch"
                      className={selectClass}
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                    >
                      <option value="">{t('chooseBranch')}</option>
                      {unassignedBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="assign-role">{t('staffRoles.field')}</Label>
                  <select
                    id="assign-role"
                    className={selectClass}
                    value={staffRoleId}
                    onChange={(e) => {
                      setStaffRoleId(e.target.value)
                      setConfirmed(false)
                    }}
                  >
                    <option value="">{t('staffRoles.custom')}</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Split-pane style live permission preview (Tendoo-inspired) */}
              {staffRoleId && selectedRole ? (
                <div className="rounded-md border bg-background p-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    {t('staffDirectory.rolePermissionsPreview', { name: selectedRole.name })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRole.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline">
                        {t(capabilityLabel(cap))}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border bg-background p-3">
                  <CapabilityChecklist
                    value={capabilities}
                    onChange={(next) => {
                      setCapabilities(next)
                      setConfirmed(false)
                    }}
                  />
                </div>
              )}

              {sensitive && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="confirm-assign-permissions"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  <FieldLabel htmlFor="confirm-assign-permissions">
                    {t('adminConfirmPermissions')}
                  </FieldLabel>
                </Field>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={mutation.isPending || (sensitive && !confirmed)}
                >
                  {t(mutation.isPending ? 'waiting' : 'save')}
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('staffDirectory.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
