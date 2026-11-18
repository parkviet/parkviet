import { defaultTemplate } from '@parkviet/pos-shared/receipt-template/defaults'
import { sampleData } from '@parkviet/pos-shared/receipt-template/sample-data'
import type { PaperSize, ReceiptDocumentType } from '@parkviet/pos-shared/receipt-template/types'
import { posFailureKey } from '@parkviet/pos-shared/request-failure'
import type { Printer, PrinterRole } from '@parkviet/pos-shared/types/print-adapter'
import { usePermissions } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@spree/dashboard-ui'
import { ReceiptTextIcon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCupLabelSettings, useKitchenSettings, useKitchenStations } from '../hooks/use-kitchen'
import {
  masterFailure,
  useBranchLabelFormats,
  useBranchReceiptTemplates,
  useStoreWrite,
} from '../hooks/use-master-data'
import { usePosSession } from '../hooks/use-pos-session'
import { usePrinterRoleBatchWrite, usePrinters } from '../hooks/use-printers'
import { type ReceiptTemplate, useReceiptTemplates } from '../hooks/use-receipt-templates'
import { useStoreInfo } from '../hooks/use-store-info'
import {
  canAdminister,
  canManageKitchen,
  canManagePrinters,
  hasCapability,
  routeAllowed,
} from '../lib/pos-access'
import {
  type PrintFunctionSettingsLink,
  type ResolvedPrintFunction,
  resolvePrintFunctions,
  roleChangesForFunction,
} from '../lib/print-functions'
import { useSalesDraft } from './branch-auto-print'
import { useBranchScope } from './branch-detail'
import { TemplatePreview } from './receipt-template/template-preview'
import { ModelCard, ModelCheck, ModelNotice, ModelSelect, ModelState } from './setup/model-ui'

export function PrintFunctionList() {
  const { t } = useTranslation()
  const { branch, access, modules, storeId } = useBranchScope()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const { draft: salesDraft } = useSalesDraft()
  const posAccess = { permissionKeys, context: context.data }
  const managePrinters = canAdminister(posAccess, true) || canManagePrinters(posAccess)
  const kitchenRead =
    access.read || canManageKitchen(posAccess) || hasCapability(posAccess, 'pos.kitchen.operate')
  const kitchenOn = modules?.['fnb.kitchen'] === true
  const cupOn = modules?.['fnb.cup_label'] === true
  const measuredOn = modules?.['retail.measured'] === true

  const printers = usePrinters(branch.id)
  const stations = useKitchenStations(branch.id, kitchenOn && kitchenRead)
  const kitchenSettings = useKitchenSettings(branch.id, kitchenOn && kitchenRead)
  const cupSettings = useCupLabelSettings(branch.id, cupOn && kitchenRead)
  const assignments = useBranchReceiptTemplates(branch.id, access.read)
  const templates = useReceiptTemplates(access.read)
  const labelFormats = useBranchLabelFormats(branch.id, measuredOn && access.read)
  const storeInfo = useStoreInfo(storeId, access.read)

  const [previewTarget, setPreviewTarget] = useState<ResolvedPrintFunction | null>(null)
  const [printerTarget, setPrinterTarget] = useState<ResolvedPrintFunction | null>(null)
  const [templateTarget, setTemplateTarget] = useState<ResolvedPrintFunction | null>(null)

  const registers = useMemo(
    () => (context.data?.registers ?? []).filter((row) => row.branch_id === branch.id),
    [context.data?.registers, branch.id],
  )
  const registerName = (registerId: string | null) =>
    registerId ? (registers.find((row) => row.id === registerId)?.name ?? null) : null

  const loading =
    printers.isPending || (access.read && (assignments.isPending || templates.isPending))
  const failed = printers.error ?? (access.read ? (assignments.error ?? templates.error) : null)

  const rows = useMemo(
    () =>
      resolvePrintFunctions({
        modules,
        salesSettings: salesDraft,
        returnWindowDays: branch.return_window_days,
        kitchenTrigger:
          kitchenSettings.data?.kitchen_send_trigger ?? branch.kitchen_send_trigger ?? null,
        printers: printers.data ?? [],
        stations: kitchenOn ? (stations.data ?? null) : null,
        cupLabelSettings: cupOn ? (cupSettings.data ?? null) : null,
        assignments: access.read ? (assignments.data ?? null) : null,
        templates: access.read ? (templates.data ?? null) : null,
        labelFormats: measuredOn && access.read ? (labelFormats.data ?? null) : null,
      }),
    [
      modules,
      salesDraft,
      branch.return_window_days,
      branch.kitchen_send_trigger,
      kitchenSettings.data,
      printers.data,
      kitchenOn,
      stations.data,
      cupOn,
      cupSettings.data,
      access.read,
      assignments.data,
      templates.data,
      measuredOn,
      labelFormats.data,
    ],
  )

  const settingsHref = (link: PrintFunctionSettingsLink) => {
    if (link.kind === 'scale_labels') {
      return access.read
        ? { to: `/${storeId}/scale-labels`, hash: undefined, allowed: true }
        : {
            to: `/${storeId}/branches/${branch.id}/features`,
            hash: 'features-flow',
            allowed: routeAllowed('features', posAccess),
          }
    }
    const page = link.tab === 'kitchen' ? 'branch-kitchen' : 'branch-floor-plan'
    return {
      to: `/${storeId}/branches/${branch.id}/${link.tab}`,
      hash: link.hash,
      allowed: routeAllowed(page, posAccess),
    }
  }

  return (
    <ModelCard
      title={t('branchPrinting.sectionFunctions')}
      id="printing-functions"
      icon={<ReceiptTextIcon />}
    >
      <p className="text-sm text-muted-foreground">{t('printFunctions.intro')}</p>
      {!managePrinters && !access.write ? (
        <p className="text-sm text-muted-foreground">{t('adminReadAccess')}</p>
      ) : null}
      {loading ? (
        <ModelState title={t('waiting')} />
      ) : failed || !printers.data ? (
        <ModelState
          error
          title={t(posFailureKey(failed))}
          retry={() =>
            void Promise.all([
              printers.refetch(),
              ...(access.read ? [assignments.refetch(), templates.refetch()] : []),
            ])
          }
        />
      ) : (
        <ul className="divide-y" aria-label={t('branchPrinting.sectionFunctions')}>
          {rows.map((row) => {
            const key = row.definition.key
            const link = row.definition.settingsLink
              ? settingsHref(row.definition.settingsLink)
              : null
            return (
              <li
                key={key}
                data-testid="print-function-row"
                data-function={key}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold">
                      {t(`printFunctions.name_${key}`)}
                    </strong>
                    {row.autoStatus ? (
                      <Badge variant="outline">
                        {row.autoStatus.kind === 'boolean'
                          ? t(
                              row.autoStatus.on
                                ? 'printFunctions.autoOn'
                                : 'printFunctions.autoOff',
                            )
                          : t(`branchKitchen.trigger_${row.autoStatus.trigger}`)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{t(`printFunctions.desc_${key}`)}</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      {t('printFunctions.printersLabel')}:{' '}
                    </span>
                    <PrinterSummary row={row} registerName={registerName} />
                  </p>
                  {row.template ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">
                        {t('printFunctions.templateLabel')}:{' '}
                      </span>
                      {row.template.usesStoreDefault
                        ? t('branchPrinting.storeDefault', {
                            name: row.template.effectiveSummary?.name ?? '—',
                          })
                        : `${row.template.branchTemplate?.name ?? '—'} (${row.template.branchTemplate?.paper ?? ''})`}
                    </p>
                  ) : null}
                  {row.template?.disabledBranchTemplateName ? (
                    <p role="note" className="text-xs text-muted-foreground">
                      {t('branchPrinting.disabledChoice', {
                        name: row.template.disabledBranchTemplateName,
                      })}
                    </p>
                  ) : null}
                  {row.warnings.map((warning) => (
                    <p
                      key={
                        warning.kind === 'station_without_output'
                          ? `${warning.kind}-${warning.stationNames.join(',')}`
                          : warning.kind === 'missing_printer'
                            ? warning.kind
                            : `${warning.kind}-${warning.templateName}`
                      }
                      role="note"
                      data-testid="print-function-warning"
                      className="text-sm text-amber-600 dark:text-amber-400"
                    >
                      {warning.kind === 'missing_printer'
                        ? t('printFunctions.warnMissingPrinter')
                        : warning.kind === 'station_without_output'
                          ? t('printFunctions.warnStationNoOutput', {
                              stations: warning.stationNames.join(', '),
                            })
                          : t('printFunctions.warnSheetTemplate', {
                              name: warning.templateName,
                            })}
                    </p>
                  ))}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {row.definition.documentType && access.read ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewTarget(row)}
                    >
                      {t('printFunctions.preview')}
                    </Button>
                  ) : null}
                  {row.canChoosePrinters && managePrinters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPrinterTarget(row)}
                    >
                      {t('printFunctions.choosePrinters')}
                    </Button>
                  ) : null}
                  {row.definition.documentType && access.read && access.write ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTemplateTarget(row)}
                    >
                      {t('printFunctions.chooseTemplate')}
                    </Button>
                  ) : null}
                  {link?.allowed ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={link.to as string} hash={link.hash}>
                        {t('printFunctions.configure')}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {previewTarget?.definition.documentType ? (
        <FunctionPreviewDialog
          row={previewTarget}
          storeName={storeInfo.data?.name ?? context.data?.store.name ?? null}
          onClose={() => setPreviewTarget(null)}
        />
      ) : null}

      {printerTarget?.definition.role && printers.data ? (
        <ChoosePrintersDialog
          row={printerTarget}
          role={printerTarget.definition.role}
          printers={printers.data}
          registerName={registerName}
          onClose={() => setPrinterTarget(null)}
        />
      ) : null}

      {templateTarget?.definition.documentType && assignments.data && templates.data ? (
        <ChooseTemplateDialog
          branchId={branch.id}
          documentType={templateTarget.definition.documentType}
          row={templateTarget}
          templates={templates.data}
          onClose={() => setTemplateTarget(null)}
        />
      ) : null}
    </ModelCard>
  )
}

function PrinterSummary({
  row,
  registerName,
}: {
  row: ResolvedPrintFunction
  registerName: (id: string | null) => string | null
}) {
  const { t } = useTranslation()
  if (row.definition.routing === 'scale_label') {
    return (
      <span>
        {row.scaleFormatCount !== null
          ? t('printFunctions.scaleFormatsCount', { count: row.scaleFormatCount })
          : t('printFunctions.configuredInScaleLabels')}
      </span>
    )
  }
  if (row.definition.routing === 'kitchen_station') {
    if (row.stationPrinterSummary.length === 0) {
      return <span>{t('printFunctions.configuredInKitchen')}</span>
    }
    return (
      <span>
        {row.stationPrinterSummary
          .map((entry) => {
            const target = entry.printer
              ? `${entry.printer.name}${entry.printer.status === 'disabled' ? ` (${t('branchPrinters.disabled')})` : ''}`
              : entry.kdsEnabled
                ? t('branchKitchen.screenOn')
                : t('branchKitchen.noPrinter')
            return `${entry.stationName}: ${target}`
          })
          .join(' · ')}
      </span>
    )
  }
  if (row.definition.routing === 'cup_label' && !row.cupLabelLoaded) {
    return <span>{t('printFunctions.configuredInKitchen')}</span>
  }
  if (row.printers.length === 0) {
    return <span className="text-muted-foreground">{t('printFunctions.noPrinterAssigned')}</span>
  }
  return (
    <span>
      {row.printers
        .map((printer) => {
          const reg = registerName(printer.register_id)
          const parts = [printer.name]
          if (reg) parts.push(reg)
          if (printer.status === 'disabled') parts.push(t('branchPrinters.disabled'))
          return parts.join(' · ')
        })
        .join(', ')}
    </span>
  )
}

function FunctionPreviewDialog({
  row,
  storeName,
  onClose,
}: {
  row: ResolvedPrintFunction
  storeName: string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { t: posT } = useTranslation('pos')
  const { branch } = useBranchScope()
  const { context } = usePosSession()
  const documentType = row.definition.documentType as ReceiptDocumentType
  const effective = row.template?.effectiveTemplate
  const paper: PaperSize = effective?.paper ?? row.template?.effectiveSummary?.paper ?? '80mm'
  const config =
    effective?.config && typeof effective.config === 'object' && 'page' in effective.config
      ? effective.config
      : defaultTemplate(documentType)

  const data = useMemo(
    () =>
      sampleData(
        documentType,
        {
          storeName: storeName ?? context.data?.store.name ?? null,
          storeProfile: context.data?.store.profile ?? null,
          branchName: branch.name,
          branchCode: branch.code,
          returnWindowDays: branch.return_window_days ?? null,
          registerName: null,
          cashier: context.data?.staff.full_name || context.data?.staff.email || null,
          timeZone: branch.timezone,
        },
        posT,
        new Date(),
      ),
    [documentType, storeName, context.data, branch, posT],
  )

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(`printFunctions.name_${row.definition.key}`)}</DialogTitle>
          <DialogDescription>
            {row.template?.effectiveSummary
              ? `${row.template.effectiveSummary.name} · ${paper}`
              : paper}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <TemplatePreview
            config={config}
            data={data}
            paper={paper}
            zoom="fit"
            testId="print-function-preview"
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('branchPrinters.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChoosePrintersDialog({
  row,
  role,
  printers,
  registerName,
  onClose,
}: {
  row: ResolvedPrintFunction
  role: PrinterRole
  printers: Printer[]
  registerName: (id: string | null) => string | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = usePrinterRoleBatchWrite()
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(printers.filter((printer) => printer.roles.includes(role)).map((p) => p.id)),
  )
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  const diffs = useMemo(
    () => roleChangesForFunction(printers, role, selected),
    [printers, role, selected],
  )

  function toggle(printerId: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(printerId)
      else next.delete(printerId)
      return next
    })
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (diffs.length === 0 || mutation.isPending) return
    setNotice(null)
    try {
      await mutation.mutateAsync(
        diffs.map((diff) => ({ printerId: diff.printer.id, roles: diff.nextRoles })),
      )
      onClose()
    } catch (failure) {
      setNotice({ text: masterFailure(failure, t), failed: true })
    }
  }

  const roleLabel = t(`branchPrinters.role_${role}`)

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('printFunctions.choosePrintersTitle', {
              name: t(`printFunctions.name_${row.definition.key}`),
            })}
          </DialogTitle>
          <DialogDescription>
            {t('printFunctions.choosePrintersDesc', { role: roleLabel })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <DialogBody className="space-y-4">
            <ModelNotice notice={notice} />
            {printers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('branchPrinters.empty')}</p>
            ) : (
              <fieldset className="space-y-2">
                <legend className="sr-only">{t('branchPrinters.title')}</legend>
                {printers.map((printer) => {
                  const reg = registerName(printer.register_id) ?? t('branchPrinters.wholeBranch')
                  const detail = [
                    t(`branchPrinters.connection_${printer.connection}`),
                    printer.paper,
                    reg,
                    ...(printer.status === 'disabled' ? [t('branchPrinters.disabled')] : []),
                  ].join(' · ')
                  return (
                    <ModelCheck
                      key={printer.id}
                      checked={selected.has(printer.id)}
                      disabled={mutation.isPending}
                      description={detail}
                      onChange={(on) => toggle(printer.id, on)}
                    >
                      {printer.name}
                    </ModelCheck>
                  )
                })}
              </fieldset>
            )}
            {diffs.length > 0 ? (
              <div
                role="note"
                data-testid="printer-role-diff"
                className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm"
              >
                {diffs.map((diff) => (
                  <p key={diff.printer.id}>
                    {t(
                      diff.added ? 'printFunctions.willAddRole' : 'printFunctions.willRemoveRole',
                      { printer: diff.printer.name, role: roleLabel },
                    )}
                  </p>
                ))}
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={diffs.length === 0 || mutation.isPending}>
              {t(mutation.isPending ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ChooseTemplateDialog({
  branchId,
  documentType,
  row,
  templates,
  onClose,
}: {
  branchId: string
  documentType: ReceiptDocumentType
  row: ResolvedPrintFunction
  templates: ReceiptTemplate[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mutation = useStoreWrite()
  const initial = row.template?.branchTemplate?.id ?? ''
  const [chosen, setChosen] = useState(initial)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const changed = chosen !== initial
  const storeDefault = templates.find(
    (template) => template.document_type === documentType && template.is_default,
  )

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!changed || mutation.isPending) return
    setNotice(null)
    try {
      await mutation.mutateAsync({
        method: 'PUT',
        path: `/pos/branches/${branchId}/receipt_templates`,
        body: { templates: { [documentType]: chosen || null } },
      })
      onClose()
    } catch (failure) {
      setNotice({ text: masterFailure(failure, t), failed: true })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !mutation.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('printFunctions.chooseTemplate')}</DialogTitle>
          <DialogDescription>{t(`printFunctions.name_${row.definition.key}`)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)} className="space-y-4">
          <DialogBody className="space-y-4">
            <ModelNotice notice={notice} />
            <ModelSelect
              label={t(`receiptTemplates.type.${documentType}`)}
              value={chosen}
              disabled={mutation.isPending}
              onChange={setChosen}
              options={[
                {
                  value: '',
                  label: t('branchPrinting.storeDefault', {
                    name: storeDefault?.name ?? row.template?.effectiveSummary?.name ?? '—',
                  }),
                },
                ...templates
                  .filter(
                    (template) =>
                      template.document_type === documentType && template.status === 'active',
                  )
                  .map((template) => ({ value: template.id, label: template.name })),
              ]}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={!changed || mutation.isPending}>
              {t(mutation.isPending ? 'waiting' : 'save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
