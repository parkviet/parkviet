import { createFileRoute } from '@tanstack/react-router'
import { MealAccountsPage } from '../../../../counter/pages/meal-accounts'

export const Route = createFileRoute('/_authenticated/$storeId/sell/meal-accounts')({
  component: MealAccountsPage,
})
