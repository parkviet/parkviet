import { createFileRoute } from '@tanstack/react-router'
import { TipsPage } from '../../../../counter/pages/tips'

export const Route = createFileRoute('/_authenticated/$storeId/sell/tips')({
  component: TipsPage,
})
