import type { Printer } from '@parkviet/pos-shared/types/print-adapter'
import { describe, expect, it } from 'vitest'
import { PRINTER_ROLES } from '../components/branch-printers'
import type { KitchenStation } from '../hooks/use-kitchen'
import type { BranchTemplateAssignment } from '../hooks/use-master-data'
import type { ReceiptTemplate } from '../hooks/use-receipt-templates'
import {
  coveredPrinterRoles,
  resolvePrintFunctions,
  roleChangesForFunction,
  visiblePrintFunctions,
} from './print-functions'

const makePrinter = (overrides: Partial<Printer> & Pick<Printer, 'id' | 'name'>): Printer => ({
  branch_id: 'br_1',
  connection: 'escpos_lan',
  address: '192.168.1.20',
  bluetooth_id: null,
  paper: '80mm',
  command_language: 'escpos',
  roles: [],
  print_station_device_id: 'dev_1',
  register_id: null,
  status: 'active',
  settings: {},
  ...overrides,
})

const makeStation = (
  overrides: Partial<KitchenStation> & Pick<KitchenStation, 'id' | 'name'>,
): KitchenStation => ({
  branch_id: 'br_1',
  kind: 'prep',
  printer_id: null,
  printer_name: null,
  kds_enabled: false,
  is_default: true,
  warn_after_minutes: 8,
  late_after_minutes: 15,
  position: 0,
  active: true,
  expo_station_id: null,
  ...overrides,
})

describe('print functions catalogue', () => {
  it('covers every PrinterRole known to the dashboard', () => {
    // Product labels are printed from the goods list, not from a function row.
    const fromGoodsList = new Set(['product_label'])
    expect(new Set([...coveredPrinterRoles(), ...fromGoodsList])).toEqual(new Set(PRINTER_ROLES))
  })

  it('hides module-gated functions when their module is off', () => {
    const retailKeys = visiblePrintFunctions({}).map((item) => item.key)
    expect(retailKeys).toEqual([
      'sale',
      'prebill',
      'payment_ticket',
      'return',
      'refund',
      'shift_closure',
    ])

    const withoutQrOrder = visiblePrintFunctions({ resources: true }).map((item) => item.key)
    expect(withoutQrOrder).not.toContain('table_qr')

    const fnbKeys = visiblePrintFunctions({
      'fnb.kitchen': true,
      'fnb.tables': true,
      'fnb.cup_label': true,
      'fnb.qr_order': true,
      'retail.measured': true,
    }).map((item) => item.key)
    expect(fnbKeys).toContain('kitchen_ticket')
    expect(fnbKeys).toContain('void_ticket')
    expect(fnbKeys).toContain('ready_ticket')
    expect(fnbKeys).toContain('checklist')
    expect(fnbKeys).toContain('cup_label')
    expect(fnbKeys).toContain('scale_label')
    expect(fnbKeys).toContain('table_qr')
  })

  it('counts a browser printer as satisfying a role and warns when an active function has no printer', () => {
    const emptyRows = resolvePrintFunctions({
      modules: { 'fnb.kitchen': true },
      salesSettings: { auto_print_ready_ticket: true, auto_print_prebill: false },
      printers: [],
    })
    const byKey = Object.fromEntries(emptyRows.map((row) => [row.definition.key, row]))
    expect(byKey.sale.warnings).toEqual([{ kind: 'missing_printer' }])
    expect(byKey.ready_ticket.warnings).toEqual([{ kind: 'missing_printer' }])
    // Pre-bill auto-print is off, so missing a prebill printer is not warned.
    expect(byKey.prebill.warnings).toEqual([])

    const withBrowser = resolvePrintFunctions({
      modules: {},
      salesSettings: {},
      printers: [
        makePrinter({
          id: 'p_browser',
          name: 'Trình duyệt quầy',
          connection: 'browser',
          address: null,
          print_station_device_id: null,
          roles: ['receipt'],
        }),
      ],
    })
    const sale = withBrowser.find((row) => row.definition.key === 'sale')
    expect(sale?.warnings).toEqual([])
    expect(sale?.printers.map((row) => row.id)).toEqual(['p_browser'])
  })

  it('warns when an active kitchen station has neither KDS nor an active printer', () => {
    const rows = resolvePrintFunctions({
      modules: { 'fnb.kitchen': true },
      salesSettings: { print_void_tickets: true },
      printers: [],
      stations: [
        makeStation({ id: 'st_1', name: 'Bếp nóng', kds_enabled: false, printer_id: null }),
      ],
    })
    const kitchen = rows.find((row) => row.definition.key === 'kitchen_ticket')
    expect(kitchen?.warnings).toEqual([
      { kind: 'station_without_output', stationNames: ['Bếp nóng'] },
    ])
  })

  it('warns when a branch assigned an A4/A5 template while allow_sheet_receipts is false', () => {
    const a4Template = {
      id: 'tpl_a4',
      document_type: 'sale' as const,
      name: 'Hoá đơn A4',
      paper: 'a4' as const,
      status: 'active' as const,
      is_default: false,
      current_version: 1,
      version: 1,
      config: {} as ReceiptTemplate['config'],
      updated_by: null,
      created_at: '2026-11-18T00:00:00Z',
      updated_at: '2026-11-18T00:00:00Z',
    }
    const assignments: BranchTemplateAssignment[] = [
      {
        document_type: 'sale',
        receipt_template: {
          id: 'tpl_a4',
          name: 'Hoá đơn A4',
          paper: 'a4',
          status: 'active',
          is_default: false,
        },
        effective_template: {
          id: 'tpl_a4',
          name: 'Hoá đơn A4',
          paper: 'a4',
          status: 'active',
          is_default: false,
        },
        uses_store_default: false,
      },
    ]
    const rows = resolvePrintFunctions({
      modules: {},
      salesSettings: { allow_sheet_receipts: false },
      printers: [makePrinter({ id: 'p_1', name: 'Quầy', roles: ['receipt'] })],
      assignments,
      templates: [a4Template],
    })
    const sale = rows.find((row) => row.definition.key === 'sale')
    expect(sale?.warnings).toEqual([
      { kind: 'sheet_template_disallowed', templateName: 'Hoá đơn A4', paper: 'a4' },
    ])
  })

  it('routes cup_label solely through cupLabelSettings.printer_id and disables inline role picker', () => {
    const roleOnlyPrinter = makePrinter({ id: 'p_role', name: 'Máy role', roles: ['cup_label'] })
    const cupPrinter = makePrinter({ id: 'p_cup', name: 'Máy tem ly', roles: [] })

    const missingCup = resolvePrintFunctions({
      modules: { 'fnb.cup_label': true },
      salesSettings: {},
      printers: [roleOnlyPrinter, cupPrinter],
      cupLabelSettings: { printer_id: null, auto_print: true },
    }).find((row) => row.definition.key === 'cup_label')
    expect(missingCup?.canChoosePrinters).toBe(false)
    expect(missingCup?.printers).toEqual([])
    expect(missingCup?.warnings).toEqual([{ kind: 'missing_printer' }])

    const assignedCup = resolvePrintFunctions({
      modules: { 'fnb.cup_label': true },
      salesSettings: {},
      printers: [roleOnlyPrinter, cupPrinter],
      cupLabelSettings: { printer_id: 'p_cup', auto_print: true },
    }).find((row) => row.definition.key === 'cup_label')
    expect(assignedCup?.printers.map((row) => row.id)).toEqual(['p_cup'])
    expect(assignedCup?.warnings).toEqual([])
  })

  it('computes added and removed roles across printers with removals sorted before additions', () => {
    const pAddFirst = makePrinter({ id: 'p_add', name: 'Máy mới', roles: ['kitchen_ticket'] })
    const pRemoveSecond = makePrinter({
      id: 'p_remove',
      name: 'Máy cũ',
      roles: ['receipt', 'prebill'],
    })
    const diff = roleChangesForFunction([pAddFirst, pRemoveSecond], 'prebill', new Set(['p_add']))
    expect(diff).toEqual([
      { printer: pRemoveSecond, added: false, nextRoles: ['receipt'] },
      { printer: pAddFirst, added: true, nextRoles: ['kitchen_ticket', 'prebill'] },
    ])
  })
})
