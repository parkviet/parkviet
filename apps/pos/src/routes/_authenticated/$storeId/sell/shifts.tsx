import { createFileRoute } from '@tanstack/react-router'
import { ShiftsPage } from '../../../../counter/pages/shifts'

export const Route = createFileRoute('/_authenticated/$storeId/sell/shifts')({
  component: ShiftsPage,
})
