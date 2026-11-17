import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$storeId/settings/business-model')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$storeId/settings/store-info', params, replace: true })
  },
})
