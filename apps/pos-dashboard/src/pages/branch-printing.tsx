import { usePermissions } from '@spree/dashboard-core'
import { useTranslation } from 'react-i18next'
import { BranchAutoPrint, SalesDraftProvider, SalesSaveBar } from '../components/branch-auto-print'
import { useBranchScope } from '../components/branch-detail'
import { BranchPrinters } from '../components/branch-printers'
import { PrintFunctionList } from '../components/print-function-list'
import { SectionNav } from '../components/section-nav'
import { usePosSession } from '../hooks/use-pos-session'
import { canAdminister, canManagePrinters } from '../lib/pos-access'

// Everything related to printing at one branch: automatic printing switches,
// the branch's printers, and the overview of print functions (which printer
// and template each document uses).
export function BranchPrintingTab() {
  const { t } = useTranslation()
  const { branch, access, branchWrite, storeId } = useBranchScope()
  const { permissionKeys } = usePermissions()
  const { context } = usePosSession()
  const posAccess = { permissionKeys, context: context.data }
  const seesPrinters = canAdminister(posAccess) || canManagePrinters(posAccess)
  const sections = [
    { id: 'printing-auto', label: t('branchPrinting.sectionAuto') },
    ...(seesPrinters
      ? [
          { id: 'printing-printers', label: t('branchPrinting.sectionPrinters') },
          { id: 'printing-functions', label: t('branchPrinting.sectionFunctions') },
        ]
      : []),
  ]

  return (
    <SalesDraftProvider branch={branch} storeId={storeId} canWrite={branchWrite || access.write}>
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-6">
          <BranchAutoPrint />
          {seesPrinters ? <BranchPrinters /> : null}
          {seesPrinters ? <PrintFunctionList /> : null}
          <SalesSaveBar />
        </div>
        {sections.length > 1 ? (
          <SectionNav sections={sections} label={t('branchPrinting.sectionNav')} />
        ) : null}
      </div>
    </SalesDraftProvider>
  )
}
