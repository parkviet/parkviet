import { createFileRoute } from '@tanstack/react-router'
import { CollectPage } from '../../../../counter/pages/collect'

export const Route = createFileRoute('/_authenticated/$storeId/sell/collect')({
  component: CollectPage,
})
