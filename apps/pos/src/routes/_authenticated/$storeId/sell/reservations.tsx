import { createFileRoute } from '@tanstack/react-router'
import { ReservationsPage } from '../../../../counter/pages/reservations'

export const Route = createFileRoute('/_authenticated/$storeId/sell/reservations')({
  component: ReservationsPage,
})
