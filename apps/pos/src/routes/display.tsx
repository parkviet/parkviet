import '../counter/styles.css'
import { createFileRoute } from '@tanstack/react-router'
import { CustomerDisplayPage } from '../counter/pages/customer-display'

export const Route = createFileRoute('/display')({
  component: () => (
    <div className="pos-app">
      <CustomerDisplayPage />
    </div>
  ),
})
