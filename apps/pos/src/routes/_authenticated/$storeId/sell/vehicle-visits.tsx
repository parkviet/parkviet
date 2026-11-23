import { createFileRoute } from '@tanstack/react-router'
import { VehicleVisitsPage } from '../../../../counter/pages/vehicle-visits'

export const Route = createFileRoute('/_authenticated/$storeId/sell/vehicle-visits')({
  component: VehicleVisitsPage,
})
