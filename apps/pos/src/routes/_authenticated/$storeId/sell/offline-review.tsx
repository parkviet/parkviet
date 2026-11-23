import { createFileRoute } from '@tanstack/react-router'
import { OfflineReviewPage } from '../../../../counter/pages/offline-review'

export const Route = createFileRoute('/_authenticated/$storeId/sell/offline-review')({
  component: OfflineReviewPage,
})
