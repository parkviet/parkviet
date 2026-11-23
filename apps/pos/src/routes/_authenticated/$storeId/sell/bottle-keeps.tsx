import { createFileRoute } from '@tanstack/react-router'
import { BottleKeepsPage } from '../../../../counter/pages/bottle-keeps'

export const Route = createFileRoute('/_authenticated/$storeId/sell/bottle-keeps')({
  component: BottleKeepsPage,
})
