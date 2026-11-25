import { createFileRoute } from '@tanstack/react-router'
import { PosRouteGuard } from '../../../lib/route-access'
import { StaffShiftsPage } from '../../../pages/staff-shifts'

export const Route = createFileRoute('/_authenticated/$storeId/staff-shifts')({
  component: () => (
    <PosRouteGuard page="staff-shifts">
      <StaffShiftsPage />
    </PosRouteGuard>
  ),
})
