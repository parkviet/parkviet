import '../../../counter/styles.css'
import { createFileRoute } from '@tanstack/react-router'
import { PosShell } from '../../../counter/components/pos-shell'

export const Route = createFileRoute('/_authenticated/$storeId/sell')({
  component: () => (
    <div className="pos-app">
      <PosShell />
    </div>
  ),
})
