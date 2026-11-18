import { isSheetPaper } from '@parkviet/pos-shared/paper-size'
import type { PosModules } from '@parkviet/pos-shared/pos-modules'
import type { PaperSize, ReceiptDocumentType } from '@parkviet/pos-shared/receipt-template/types'
import { normalizeSalesSettings, type SalesSettings } from '@parkviet/pos-shared/sales-settings'
import type { Printer, PrinterRole } from '@parkviet/pos-shared/types/print-adapter'
import type { CupLabelSettings, KitchenSendTrigger, KitchenStation } from '../hooks/use-kitchen'
import type { BranchTemplateAssignment, StoreLabelFormat } from '../hooks/use-master-data'
import type { ReceiptTemplate } from '../hooks/use-receipt-templates'

export type PrintFunctionKey =
  | 'sale'
  | 'prebill'
  | 'payment_ticket'
  | 'return'
  | 'refund'
  | 'shift_closure'
  | 'kitchen_ticket'
  | 'void_ticket'
  | 'ready_ticket'
  | 'checklist'
  | 'cup_label'
  | 'scale_label'
  | 'table_qr'

export type PrintFunctionRouting = 'role' | 'kitchen_station' | 'cup_label' | 'scale_label'

export type PrintFunctionAutoSetting =
  | {
      kind: 'sales'
      key:
        | 'auto_print_receipt'
        | 'auto_print_prebill'
        | 'print_void_tickets'
        | 'auto_print_ready_ticket'
    }
  | { kind: 'kitchen_trigger' }
  | { kind: 'cup_label' }

export type PrintFunctionSettingsLink =
  | { kind: 'branch_tab'; tab: 'kitchen' | 'floor-plan'; hash?: string }
  | { kind: 'scale_labels' }

export type PrintFunctionDefinition = {
  key: PrintFunctionKey
  role: PrinterRole | null
  routing: PrintFunctionRouting
  documentType: ReceiptDocumentType | null
  module: string | null
  autoSetting: PrintFunctionAutoSetting | null
  settingsLink: PrintFunctionSettingsLink | null
}

export const PRINT_FUNCTIONS: readonly PrintFunctionDefinition[] = [
  {
    key: 'sale',
    role: 'receipt',
    routing: 'role',
    documentType: 'sale',
    module: null,
    autoSetting: { kind: 'sales', key: 'auto_print_receipt' },
    settingsLink: null,
  },
  {
    key: 'prebill',
    role: 'prebill',
    routing: 'role',
    documentType: 'prebill',
    module: null,
    autoSetting: { kind: 'sales', key: 'auto_print_prebill' },
    settingsLink: null,
  },
  {
    key: 'payment_ticket',
    role: 'receipt',
    routing: 'role',
    documentType: 'payment_ticket',
    module: null,
    autoSetting: null,
    settingsLink: null,
  },
  {
    key: 'return',
    role: 'receipt',
    routing: 'role',
    documentType: 'return',
    module: null,
    autoSetting: null,
    settingsLink: null,
  },
  {
    key: 'refund',
    role: 'receipt',
    routing: 'role',
    documentType: 'refund',
    module: null,
    autoSetting: null,
    settingsLink: null,
  },
  {
    key: 'shift_closure',
    role: 'receipt',
    routing: 'role',
    documentType: 'shift_closure',
    module: null,
    autoSetting: null,
    settingsLink: null,
  },
  {
    key: 'kitchen_ticket',
    role: 'kitchen_ticket',
    routing: 'kitchen_station',
    documentType: null,
    module: 'fnb.kitchen',
    autoSetting: { kind: 'kitchen_trigger' },
    settingsLink: { kind: 'branch_tab', tab: 'kitchen' },
  },
  {
    key: 'void_ticket',
    role: 'void_ticket',
    routing: 'kitchen_station',
    documentType: null,
    module: 'fnb.kitchen',
    autoSetting: { kind: 'sales', key: 'print_void_tickets' },
    settingsLink: { kind: 'branch_tab', tab: 'kitchen' },
  },
  {
    key: 'ready_ticket',
    role: 'ready_ticket',
    routing: 'role',
    documentType: null,
    module: 'fnb.kitchen',
    autoSetting: { kind: 'sales', key: 'auto_print_ready_ticket' },
    settingsLink: null,
  },
  {
    key: 'checklist',
    role: 'checklist',
    routing: 'role',
    documentType: null,
    module: 'fnb.tables',
    autoSetting: null,
    settingsLink: null,
  },
  {
    key: 'cup_label',
    role: 'cup_label',
    routing: 'cup_label',
    documentType: null,
    module: 'fnb.cup_label',
    autoSetting: { kind: 'cup_label' },
    settingsLink: { kind: 'branch_tab', tab: 'kitchen', hash: 'branch-cup-labels' },
  },
  {
    key: 'scale_label',
    role: null,
    routing: 'scale_label',
    documentType: null,
    module: 'retail.measured',
    autoSetting: null,
    settingsLink: { kind: 'scale_labels' },
  },
  {
    key: 'table_qr',
    role: 'table_qr',
    routing: 'role',
    documentType: null,
    module: 'fnb.qr_order',
    autoSetting: null,
    settingsLink: { kind: 'branch_tab', tab: 'floor-plan' },
  },
]

export type PrintFunctionWarning =
  | { kind: 'missing_printer' }
  | { kind: 'station_without_output'; stationNames: string[] }
  | { kind: 'sheet_template_disallowed'; templateName: string; paper: PaperSize }

export type ResolvedTemplateInfo = {
  documentType: ReceiptDocumentType
  branchTemplate: { id: string; name: string; paper: PaperSize } | null
  effectiveTemplate: ReceiptTemplate | null
  effectiveSummary: { id: string; name: string; paper: PaperSize } | null
  usesStoreDefault: boolean
  disabledBranchTemplateName: string | null
}

export type ResolvedAutoStatus =
  | { kind: 'boolean'; on: boolean }
  | { kind: 'kitchen_trigger'; trigger: KitchenSendTrigger }

export type ResolvedPrintFunction = {
  definition: PrintFunctionDefinition
  printers: Printer[]
  stationPrinterSummary: { stationName: string; printer: Printer | null; kdsEnabled: boolean }[]
  cupLabelLoaded: boolean
  scaleFormatCount: number | null
  template: ResolvedTemplateInfo | null
  autoStatus: ResolvedAutoStatus | null
  warnings: PrintFunctionWarning[]
  canChoosePrinters: boolean
}

export type PrintFunctionsInput = {
  modules: PosModules | null | undefined
  salesSettings: Partial<SalesSettings> | null | undefined
  returnWindowDays?: number | null
  kitchenTrigger?: KitchenSendTrigger | null
  printers: readonly Printer[]
  stations?: readonly KitchenStation[] | null
  cupLabelSettings?: Pick<CupLabelSettings, 'printer_id' | 'auto_print'> | null
  assignments?: readonly BranchTemplateAssignment[] | null
  templates?: readonly ReceiptTemplate[] | null
  labelFormats?: readonly StoreLabelFormat[] | null
}

// Roles covered across the print function catalogue (used by tests to catch
// drift whenever a new PrinterRole is added).
export function coveredPrinterRoles(): PrinterRole[] {
  return [...new Set(PRINT_FUNCTIONS.flatMap((item) => (item.role ? [item.role] : [])))]
}

export function visiblePrintFunctions(
  modules: PosModules | null | undefined,
): PrintFunctionDefinition[] {
  return PRINT_FUNCTIONS.filter((item) => item.module === null || modules?.[item.module] === true)
}

function isInUse(
  definition: PrintFunctionDefinition,
  sales: SalesSettings,
  returnWindowDays: number | null | undefined,
  cupLabelSettings: Pick<CupLabelSettings, 'printer_id' | 'auto_print'> | null | undefined,
): boolean {
  switch (definition.key) {
    case 'sale':
    case 'payment_ticket':
    case 'shift_closure':
      return true
    case 'return':
    case 'refund':
      return returnWindowDays != null
    case 'prebill':
      return sales.auto_print_prebill
    case 'void_ticket':
      return sales.print_void_tickets
    case 'ready_ticket':
      return sales.auto_print_ready_ticket
    case 'cup_label':
      return cupLabelSettings ? cupLabelSettings.auto_print : true
    case 'kitchen_ticket':
    case 'checklist':
    case 'table_qr':
    case 'scale_label':
      return true
  }
}

function resolveTemplate(
  documentType: ReceiptDocumentType,
  assignments: readonly BranchTemplateAssignment[] | null | undefined,
  templates: readonly ReceiptTemplate[] | null | undefined,
): ResolvedTemplateInfo | null {
  if (!assignments && !templates) return null
  const row = assignments?.find((item) => item.document_type === documentType)
  const list = templates ?? []
  const storeDefault =
    list.find(
      (item) => item.document_type === documentType && item.is_default && item.status === 'active',
    ) ?? null
  const activeBranchChoice =
    row?.receipt_template?.status === 'active' ? row.receipt_template : null
  const disabledBranchTemplateName =
    row?.receipt_template && row.receipt_template.status !== 'active'
      ? row.receipt_template.name
      : null
  const effectiveId =
    activeBranchChoice?.id ?? row?.effective_template?.id ?? storeDefault?.id ?? null
  const effectiveTemplate =
    (effectiveId ? list.find((item) => item.id === effectiveId) : null) ?? storeDefault
  const effectiveSummary = effectiveTemplate
    ? { id: effectiveTemplate.id, name: effectiveTemplate.name, paper: effectiveTemplate.paper }
    : row?.effective_template
      ? {
          id: row.effective_template.id,
          name: row.effective_template.name,
          paper: row.effective_template.paper,
        }
      : null
  return {
    documentType,
    branchTemplate: activeBranchChoice
      ? {
          id: activeBranchChoice.id,
          name: activeBranchChoice.name,
          paper: activeBranchChoice.paper,
        }
      : null,
    effectiveTemplate,
    effectiveSummary,
    usesStoreDefault: activeBranchChoice === null,
    disabledBranchTemplateName,
  }
}

function resolveAutoStatus(
  definition: PrintFunctionDefinition,
  sales: SalesSettings,
  kitchenTrigger: KitchenSendTrigger | null | undefined,
  cupLabelSettings: Pick<CupLabelSettings, 'printer_id' | 'auto_print'> | null | undefined,
): ResolvedAutoStatus | null {
  const auto = definition.autoSetting
  if (!auto) return null
  if (auto.kind === 'sales') return { kind: 'boolean', on: sales[auto.key] }
  if (auto.kind === 'kitchen_trigger')
    return kitchenTrigger ? { kind: 'kitchen_trigger', trigger: kitchenTrigger } : null
  if (auto.kind === 'cup_label')
    return cupLabelSettings ? { kind: 'boolean', on: cupLabelSettings.auto_print } : null
  return null
}

export function resolvePrintFunctions(input: PrintFunctionsInput): ResolvedPrintFunction[] {
  const sales = normalizeSalesSettings(input.salesSettings)
  const printerById = new Map(input.printers.map((printer) => [printer.id, printer]))
  const activeStations = (input.stations ?? []).filter((station) => station.active)

  return visiblePrintFunctions(input.modules).map((definition) => {
    const warnings: PrintFunctionWarning[] = []
    let assignedPrinters: Printer[] = []
    let stationPrinterSummary: ResolvedPrintFunction['stationPrinterSummary'] = []

    if (definition.routing === 'kitchen_station') {
      stationPrinterSummary = activeStations.map((station) => ({
        stationName: station.name,
        printer: station.printer_id ? (printerById.get(station.printer_id) ?? null) : null,
        kdsEnabled: station.kds_enabled,
      }))
      const uniqueStationPrinters = new Map<string, Printer>()
      for (const entry of stationPrinterSummary) {
        if (entry.printer) uniqueStationPrinters.set(entry.printer.id, entry.printer)
      }
      assignedPrinters = [...uniqueStationPrinters.values()]

      if (input.stations != null) {
        const silentStations = stationPrinterSummary.filter(
          (entry) => !entry.kdsEnabled && entry.printer?.status !== 'active',
        )
        if (definition.key === 'kitchen_ticket' && silentStations.length > 0) {
          warnings.push({
            kind: 'station_without_output',
            stationNames: silentStations.map((entry) => entry.stationName),
          })
        } else if (
          definition.key === 'void_ticket' &&
          sales.print_void_tickets &&
          activeStations.length > 0 &&
          !stationPrinterSummary.some((entry) => entry.printer?.status === 'active')
        ) {
          const withoutPrinter = stationPrinterSummary.filter(
            (entry) => !entry.kdsEnabled && entry.printer?.status !== 'active',
          )
          if (withoutPrinter.length > 0) {
            warnings.push({
              kind: 'station_without_output',
              stationNames: withoutPrinter.map((entry) => entry.stationName),
            })
          }
        }
      }
    } else if (definition.routing === 'cup_label') {
      if (input.cupLabelSettings?.printer_id) {
        const cupPrinter = printerById.get(input.cupLabelSettings.printer_id)
        if (cupPrinter) assignedPrinters = [cupPrinter]
      }
      const hasActivePrinter = assignedPrinters.some((printer) => printer.status === 'active')
      if (input.cupLabelSettings?.auto_print && !hasActivePrinter) {
        warnings.push({ kind: 'missing_printer' })
      }
    } else if (definition.routing === 'role' && definition.role) {
      const role = definition.role
      assignedPrinters = input.printers.filter((printer) => printer.roles.includes(role))
      const hasActivePrinter = assignedPrinters.some((printer) => printer.status === 'active')
      if (
        !hasActivePrinter &&
        isInUse(definition, sales, input.returnWindowDays, input.cupLabelSettings)
      ) {
        warnings.push({ kind: 'missing_printer' })
      }
    }

    const template = definition.documentType
      ? resolveTemplate(definition.documentType, input.assignments, input.templates)
      : null

    if (
      template?.branchTemplate &&
      !sales.allow_sheet_receipts &&
      isSheetPaper(template.branchTemplate.paper)
    ) {
      warnings.push({
        kind: 'sheet_template_disallowed',
        templateName: template.branchTemplate.name,
        paper: template.branchTemplate.paper,
      })
    }

    return {
      definition,
      printers: assignedPrinters,
      stationPrinterSummary,
      cupLabelLoaded: input.cupLabelSettings != null,
      scaleFormatCount:
        definition.routing === 'scale_label' && input.labelFormats
          ? input.labelFormats.length
          : null,
      template,
      autoStatus: resolveAutoStatus(
        definition,
        sales,
        input.kitchenTrigger,
        input.cupLabelSettings,
      ),
      warnings,
      canChoosePrinters: definition.routing === 'role' && definition.role !== null,
    }
  })
}

export type PrinterRoleDiff = {
  printer: Printer
  added: boolean
  nextRoles: PrinterRole[]
}

export function roleChangesForFunction(
  printers: readonly Printer[],
  role: PrinterRole,
  selectedPrinterIds: ReadonlySet<string>,
): PrinterRoleDiff[] {
  const changes: PrinterRoleDiff[] = []
  for (const printer of printers) {
    const had = printer.roles.includes(role)
    const wants = selectedPrinterIds.has(printer.id)
    if (had === wants) continue
    changes.push({
      printer,
      added: wants,
      nextRoles: wants
        ? [...printer.roles, role]
        : printer.roles.filter((existing) => existing !== role),
    })
  }
  // Remove the role from deselected printers before adding it to newly selected
  // printers so moving a role between two printers on the same register never
  // trips `one_default_per_register_role`.
  return changes.sort((a, b) => Number(a.added) - Number(b.added))
}
