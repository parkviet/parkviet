import { createFileRoute } from '@tanstack/react-router'
import { StoredValuePage } from '../../../../counter/pages/stored-value'

export const Route = createFileRoute('/_authenticated/$storeId/sell/stored-value')({
  component: StoredValuePage,
})
