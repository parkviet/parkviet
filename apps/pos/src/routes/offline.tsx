import '../counter/styles.css'
import { createFileRoute } from '@tanstack/react-router'
import { OfflineSalePage } from '../counter/pages/offline-sale'

export const Route = createFileRoute('/offline')({
  component: () => (
    <div className="pos-app">
      <OfflineSalePage />
    </div>
  ),
})
