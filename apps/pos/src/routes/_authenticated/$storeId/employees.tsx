import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../lib/route-access'
import { StaffDirectoryPage } from '../../../pages/staff-directory'

export const Route = createFileRoute('/_authenticated/$storeId/employees')({
  component: () => (
    <PosRouteGuard page="staff-directory">
      <StaffDirectoryPage />
    </PosRouteGuard>
  ),
})
