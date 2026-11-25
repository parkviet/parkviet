import { canRemindDebt } from '@shared/debt-reminder'
import { canHandleDeliveries } from '@shared/deliveries'
import { navVisible } from '@shared/module-registry'
import { contextFeature } from '@shared/pos-features'
import { canReadReceivables } from '@shared/receivables'
import { canMoveCash, canReconcileCash } from '@shared/shifts'
import { canOpenInventory } from '@shared/traceability'
import type { PosContext } from '@shared/types/pos-context'

export type PosAccess = { permissionKeys: readonly string[]; context?: PosContext }
export type PosPage =
  | 'kitchen'
  | 'orders'
  | 'deliveries'
  | 'funds'
  | 'funds-attention'
  | 'shifts'
  | 'late-cash'
  | 'receivables'
  | 'credit-accounts'
  | 'credit-approvals'
  | 'inventory'
  | 'stock-overview'
  | 'stock-ledger'
  | 'stock-imports'
  | 'stock-exports'
  | 'stock-counts'
  | 'stock-opening'
  | 'partners-customers'
  | 'partners-suppliers'
  | 'reports'
  | 'reports-overview'
  | 'reports-profit'
  | 'reports-inventory'
  | 'reports-inventory-summary'
  | 'reports-transaction'
  | 'reports-history'
  | 'branches'
  | 'branch'
  | 'registers'
  | 'staff'
  | 'staff-directory'
  | 'staff-shifts'
  | 'payroll'
  | 'products'
  | 'labels'
  | 'features'
  | 'business-model'
  | 'branch-payments'
  | 'branch-printing'
  | 'branch-kitchen'
  | 'branch-floor-plan'
  | 'branch-emenu'
  | 'branch-platforms'
  | 'branch-rate-plans'
  | 'branch-hardware'
  | 'platform-settlement'
  | 'payment-methods'
  | 'units'
  | 'staff-roles'
  | 'receipt-templates'
  | 'setup'
  | 'store-model'
  | 'store-info'
  | 'stores'
  | 'tax-info'
  | 'tax'
  | 'devices'
  | 'menu'
  | 'stock-alerts'
  | 'einvoices'
  | 'einvoice-settings'
  | 'meal-accounts'
  | 'meal-sponsors'
  | 'vehicle-commission'
  // Goods: the store's Spree catalog kept from POS administration.
  | 'goods-products'
  | 'goods-barcode-labels'
  | 'goods-ingredients'
  | 'goods-price-lists'
  | 'goods-categories'
  | 'goods-addons'
  | 'goods-recipes'
  // Server information: store administrators (the default branch below).
  | 'system'
export function canAdminister(access: PosAccess, write = false) {
  return (
    access.permissionKeys.includes('write_pos_topology') ||
    (!write && access.permissionKeys.includes('read_pos_topology'))
  )
}
export function canManageBranch(
  access: PosAccess,
  branchId: string | null = access.context?.selection.branch_id ?? null,
) {
  return (
    canAdminister(access, true) ||
    Boolean(
      branchId &&
        access.context?.selection.branch_id === branchId &&
        access.context.capabilities.includes('pos.topology.manage'),
    )
  )
}
// Operational screens act on the selected branch with the reader's membership
// there; the server checks the same capabilities on every request.
export const hasCapability = (access: PosAccess, capability: string) =>
  Boolean(access.context?.capabilities.includes(capability))
export const canManagePrinters = (access: PosAccess) => hasCapability(access, 'pos.printer.manage')
// A branch's kitchen setup: stations, routes and the send trigger.
export const canManageKitchen = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.kitchen.manage')
// Working the kitchen screen: everyone who may run the kitchen at the selected
// branch, whatever their role (the API checks the same rights).
export const canOperateKitchen = (access: PosAccess) =>
  canAdminister(access, true) ||
  hasCapability(access, 'pos.kitchen.operate') ||
  hasCapability(access, 'pos.kitchen.manage')
export const runsKitchen = (access: PosAccess) => access.context?.modules?.['fnb.kitchen'] === true
// A branch's floor plan: its areas and tables. Offered while the branch runs
// `resources`; its table settings belong to the branch's managers.
export const canManageResources = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.resource.manage')
const runsResources = (access: PosAccess) => access.context?.modules?.resources === true
// The prices of play time, offered while the branch bills it (`timed_billing`).
export const canManageRatePlans = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.rate_plan.manage')
const billsPlayTime = (access: PosAccess) => access.context?.modules?.timed_billing === true
// Order history is read by any staff member of the branch.
export const canReadOrders = (access: PosAccess) => (access.context?.capabilities.length ?? 0) > 0
// The received-funds ledger is read by collectors and resolvers; only
// resolvers see the attention view and act on payouts.
export const canReadFunds = (access: PosAccess) =>
  hasCapability(access, 'pos.payment.resolve') || hasCapability(access, 'pos.payment.collect')
// Shift management: closing shifts left open needs recovery rights, drawer
// requests are confirmed by another cash mover or an approver, and approvers
// grant variance approvals.
export const canRecoverShifts = (access: PosAccess) => hasCapability(access, 'pos.topology.recover')
export const canConfirmCash = (access: PosAccess) =>
  canMoveCash(access.context?.capabilities) || hasCapability(access, 'pos.approval.grant')
export const canApproveCloses = (access: PosAccess) => hasCapability(access, 'pos.approval.grant')
export const canManageShifts = (access: PosAccess) =>
  canRecoverShifts(access) || canConfirmCash(access) || canApproveCloses(access)
// Receivables are read by branch members; credit managers among them set
// credit terms, and approvers decide credit sales, returns and refunds.
export const canReadDebts = (access: PosAccess) => canReadReceivables(access.context?.capabilities)
export const canManageCredit = (access: PosAccess) =>
  canReadDebts(access) && hasCapability(access, 'pos.credit.manage')
// Reminders belong to credit sales: hidden while `credit` is off. Staff who
// see contacts unmasked may send them, as the server checks.
export const canSendReminders = (access: PosAccess) =>
  Boolean(access.context && contextFeature(access.context, 'credit')) &&
  canRemindDebt(access.context?.capabilities)
export const canApproveSales = (access: PosAccess) =>
  hasCapability(access, 'pos.approval.grant') &&
  (!hasCapability(access, 'pos.credit.manage') || canReadDebts(access))
// Traceable stock belongs to the traceability module; its entry stays while
// the store still has tracked SKUs. Approvers open it to decide adjustments.
export const canOpenStock = (access: PosAccess) => canOpenInventory(access.context?.capabilities)
// Any branch member reads reports (their own shifts unless they hold report access).
export const canReadReports = canReadOrders
// The menu belongs to the store and is changed by store administrators or
// menu managers; sold-out marks belong to the selected branch. The page is
// offered while the selected branch runs the menu.
export const canManageMenu = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.menu.manage')
export const canSetSoldOut = (access: PosAccess) =>
  canManageMenu(access) || hasCapability(access, 'pos.menu.sold_out')
const runsMenu = (access: PosAccess) => access.context?.modules?.['fnb.menu'] === true
// Recipes and low-stock thresholds are stock settings: store administrators
// or inventory managers change them, report readers see the thresholds. They
// are offered while the selected branch runs recipes.
export const canManageRecipes = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.inventory.manage')
export const runsRecipes = (access: PosAccess) => access.context?.modules?.['fnb.recipes'] === true
export const canReadStockAlerts = (access: PosAccess) =>
  canAdminister(access) || canManageRecipes(access) || hasCapability(access, 'pos.report.read')
// E-invoices of the selected branch: store administrators read them, and they
// or e-invoice managers act on them. Provider settings stay with store
// administrators. The list is offered while the store issues e-invoices.
export const canManageEinvoices = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.einvoice.manage')
const canReadEinvoices = (access: PosAccess) => canAdminister(access) || canManageEinvoices(access)
const issuesEinvoices = (access: PosAccess) => (access.context?.einvoice_type ?? 'none') !== 'none'
// Delivery platform orders: branch setup sets the platforms and their rates;
// money reconciliation (or store administration) records what they paid. The
// settlement entry is offered while the selected branch takes platform orders.
const takesPlatformOrders = (access: PosAccess) =>
  access.context?.modules?.['fnb.delivery_platforms'] === true
export const canSettlePlatforms = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.payment.resolve')
// A canteen's meal accounts and sponsors belong to the store; store
// administrators or meal account managers of the selected branch keep them,
// while that branch runs meal accounts. Wallet money moves at the counter.
export const runsMealAccounts = (access: PosAccess) =>
  access.context?.modules?.['fnb.meal_accounts'] === true
export const canManageMealAccounts = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.meal_account.manage')
// A rest stop's coach commission set-up (operators, rules, the visit window)
// is kept by store administrators or coach visit managers of the selected
// branch while it runs coach visits. Paying drivers is counter work.
export const runsVehicleCommission = (access: PosAccess) =>
  access.context?.modules?.['fnb.vehicle_commission'] === true
export const canManageVehicleCommission = (access: PosAccess) =>
  canAdminister(access, true) || hasCapability(access, 'pos.vehicle_visit.manage')
// Goods are Spree catalog records, so their gates are the staff role's
// catalog keys from /me (expanded server-side; `write_*` is still checked
// on its own so a role granting only writes reads too). Products, ingredients,
// price lists and product types share `products`; categories have their own
// keys; creating the `pos` channel is a settings write.
const hasKey = (access: PosAccess, key: string) => access.permissionKeys.includes(key)
export const canReadGoods = (access: PosAccess) =>
  hasKey(access, 'read_products') || hasKey(access, 'write_products')
export const canWriteGoods = (access: PosAccess) => hasKey(access, 'write_products')
export const canReadCategories = (access: PosAccess) =>
  hasKey(access, 'read_categories') || hasKey(access, 'write_categories')
export const canWriteCategories = (access: PosAccess) => hasKey(access, 'write_categories')
export const canCreatePosChannel = (access: PosAccess) => hasKey(access, 'write_settings')
// Price lists name channels and customer groups, which Spree reads under the
// settings and customers keys.
export const canReadChannels = (access: PosAccess) =>
  hasKey(access, 'read_settings') || hasKey(access, 'write_settings')
export const canReadCustomerGroups = (access: PosAccess) =>
  hasKey(access, 'read_customers') || hasKey(access, 'write_customers')
// Spree registers product types as their own catalog scope, apart from products.
export const canReadProductTypes = (access: PosAccess) =>
  hasKey(access, 'read_product_types') || hasKey(access, 'write_product_types')
export const canWriteProductTypes = (access: PosAccess) => hasKey(access, 'write_product_types')
export function visibleNav(page: PosPage, access: PosAccess) {
  if (
    page === 'goods-products' ||
    page === 'goods-barcode-labels' ||
    page === 'goods-ingredients' ||
    page === 'goods-price-lists'
  )
    return canReadGoods(access)
  if (page === 'goods-categories') return canReadCategories(access)
  // Add-on groups and recipes keep the menu and recipe gates, offered while
  // the selected branch runs those modules.
  if (page === 'goods-addons') return runsMenu(access) && canManageMenu(access)
  if (page === 'goods-recipes') return runsRecipes(access) && canManageRecipes(access)
  if (page === 'kitchen') return runsKitchen(access) && canOperateKitchen(access)
  if (page === 'vehicle-commission')
    return runsVehicleCommission(access) && canManageVehicleCommission(access)
  if (page === 'meal-accounts' || page === 'meal-sponsors')
    return runsMealAccounts(access) && canManageMealAccounts(access)
  if (page === 'einvoices') return issuesEinvoices(access) && canReadEinvoices(access)
  if (page === 'einvoice-settings') return canAdminister(access, true)
  if (page === 'platform-settlement')
    return takesPlatformOrders(access) && canSettlePlatforms(access)
  if (page === 'branch-platforms') return canAdminister(access) || canManageBranch(access)
  if (page === 'branch-rate-plans')
    return billsPlayTime(access) && (canAdminister(access) || canManageRatePlans(access))
  // The hardware checklist reads printers, devices and server health.
  if (page === 'branch-hardware') return canAdminister(access) || canManageBranch(access)
  if (page === 'stock-alerts') return runsRecipes(access) && canReadStockAlerts(access)
  if (
    page === 'stock-overview' ||
    page === 'stock-ledger' ||
    page === 'stock-imports' ||
    page === 'stock-exports' ||
    page === 'stock-counts' ||
    page === 'stock-opening'
  )
    return canReadStockAlerts(access) || canOpenStock(access)
  if (page === 'partners-customers' || page === 'partners-suppliers')
    return canAdminister(access) || canReadOrders(access)
  if (page === 'staff-shifts') return canAdminister(access) || canReadOrders(access)
  if (page === 'receivables') return canReadDebts(access)
  if (page === 'credit-accounts') return canManageCredit(access)
  if (page === 'credit-approvals') return canApproveSales(access)
  if (page === 'inventory') return navVisible(access.context, 'inventory')
  if (
    page === 'reports' ||
    page === 'reports-overview' ||
    page === 'reports-profit' ||
    page === 'reports-inventory' ||
    page === 'reports-inventory-summary' ||
    page === 'reports-transaction' ||
    page === 'reports-history'
  )
    return canReadReports(access)
  if (page === 'menu') return runsMenu(access) && canSetSoldOut(access)
  if (page === 'orders') return canReadOrders(access)
  if (page === 'funds') return canReadFunds(access)
  if (page === 'funds-attention') return hasCapability(access, 'pos.payment.resolve')
  if (page === 'shifts') return canManageShifts(access)
  if (page === 'late-cash') return canReconcileCash(access.context?.capabilities)
  // The list stays reachable with delivery switched off, so orders already
  // marked for delivery can still be handed over; only the entry is hidden.
  if (page === 'deliveries')
    return (
      canHandleDeliveries(access.context?.capabilities) &&
      access.context?.features?.delivery === true
    )
  // Administrators reach a branch from the branch list; a branch manager
  // without store administration gets a direct entry to their own branch.
  if (page === 'branch')
    return (
      !canAdminister(access) &&
      (canManageBranch(access) ||
        canManagePrinters(access) ||
        canManageKitchen(access) ||
        canManageResources(access))
    )
  if (page === 'branch-printing')
    return (
      canAdminister(access) ||
      canManagePrinters(access) ||
      canManageBranch(access) ||
      canManageKitchen(access)
    )
  if (page === 'branch-kitchen') return canAdminister(access) || canManageKitchen(access)
  if (page === 'branch-floor-plan')
    return (
      runsResources(access) &&
      (canAdminister(access) || canManageResources(access) || canManageBranch(access))
    )
  if (page === 'branch-emenu')
    return (
      access.context?.modules?.['fnb.qr_order'] === true &&
      (canAdminister(access) || canManageBranch(access) || canManageResources(access))
    )
  if (page === 'features' || page === 'business-model')
    return (
      canAdminister(access) ||
      canManageBranch(access) ||
      canManageKitchen(access) ||
      canManageResources(access)
    )
  // Tax declaration details are read by store readers and changed by writers,
  // like the store information they share fields with.
  if (page === 'store-info' || page === 'tax-info' || page === 'stores')
    return canAdminister(access)
  // The tax configuration API serves store writers only.
  if (page === 'tax') return canAdminister(access, true)
  if (page === 'setup' || page === 'store-model') return canAdminister(access, true)
  if (page === 'devices')
    return (
      canAdminister(access) || hasCapability(access, 'pos.device.manage') || canReadOrders(access)
    )
  return canAdminister(access)
}
// Direct URLs. Setup is reachable by readers: the page shows ask-admin
// guidance instead of a wizard, while nav keeps it write-only. Deliveries
// stay reachable with the delivery feature off, and traceable stock with the
// traceability module off.
export function routeAllowed(page: PosPage, access: PosAccess) {
  if (page === 'setup') return canAdminister(access)
  if (page === 'branch')
    return (
      canAdminister(access) ||
      canManageBranch(access) ||
      canManagePrinters(access) ||
      canManageKitchen(access) ||
      canManageResources(access)
    )
  if (page === 'deliveries') return canHandleDeliveries(access.context?.capabilities)
  if (page === 'inventory') return canOpenStock(access)
  // Store administrators prepare the menu before a branch turns it on.
  if (page === 'menu') return canSetSoldOut(access)
  // The page explains how to turn the kitchen on while the branch runs none.
  if (page === 'kitchen') return canOperateKitchen(access)
  // Store administrators prepare add-ons and recipes before a branch runs them.
  if (page === 'goods-addons') return canManageMenu(access)
  if (page === 'goods-recipes') return canManageRecipes(access)
  if (page === 'stock-alerts') return canReadStockAlerts(access)
  // Invoices already made stay reachable after the store stops issuing.
  if (page === 'einvoices') return canReadEinvoices(access)
  // Orders already completed are settled after the branch stops taking them.
  if (page === 'platform-settlement') return canSettlePlatforms(access)
  return visibleNav(page, access)
}

// Tabs of one branch's page, in display order, with the page each one gates on.
export const BRANCH_TABS = [
  { key: 'overview', page: 'branch', path: '' },
  { key: 'registers', page: 'registers', path: '/registers' },
  { key: 'staff', page: 'staff', path: '/staff' },
  { key: 'products', page: 'products', path: '/products' },
  { key: 'features', page: 'features', path: '/features' },
  { key: 'payments', page: 'branch-payments', path: '/payments' },
  { key: 'printing', page: 'branch-printing', path: '/printing' },
  { key: 'kitchen', page: 'branch-kitchen', path: '/kitchen' },
  { key: 'floorPlan', page: 'branch-floor-plan', path: '/floor-plan' },
  { key: 'emenu', page: 'branch-emenu', path: '/emenu' },
  { key: 'platforms', page: 'branch-platforms', path: '/platforms' },
  { key: 'ratePlans', page: 'branch-rate-plans', path: '/rate-plans' },
  { key: 'hardware', page: 'branch-hardware', path: '/hardware' },
] as const satisfies readonly { key: string; page: PosPage; path: string }[]
export type BranchTab = (typeof BRANCH_TABS)[number]['key']
// The tabs open to this reader at the selected branch.
export const branchTabs = (access: PosAccess) =>
  BRANCH_TABS.filter((tab) => routeAllowed(tab.page, access))
