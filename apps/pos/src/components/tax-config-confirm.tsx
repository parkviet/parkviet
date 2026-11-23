import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@spree/dashboard-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RegimeChange } from '../schemas/tax-regime'
import { ModelCheck } from './setup/model-ui'

// Saving a new method reassigns every product; saving new defaults moves the
// products that follow them, and everything with "apply to all".
export function TaxConfigConfirm({
  change,
  productCount,
  openOrders,
  busy,
  onCancel,
  onConfirm,
}: {
  change: RegimeChange
  productCount: number
  openOrders: number
  busy: boolean
  onCancel: () => void
  onConfirm: (applyToAll: boolean) => void
}) {
  const { t } = useTranslation()
  const [applyToAll, setApplyToAll] = useState(false)
  const method = change.methodChanged
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {method ? t('taxConfig.confirmMethodTitle') : t('taxConfig.confirmDefaultsTitle')}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3 text-sm">
            {method ? (
              <>
                <p>{t('taxConfig.confirmMethodBody')}</p>
                <p data-testid="tax-confirm-products">
                  {t('taxConfig.confirmProducts', { count: productCount })}
                </p>
                <p data-testid="tax-confirm-orders">
                  {t('taxConfig.confirmOrders', { count: openOrders })}
                </p>
              </>
            ) : (
              <>
                <p>{t('taxConfig.confirmDefaultsBody')}</p>
                <ModelCheck
                  checked={applyToAll}
                  onChange={setApplyToAll}
                  disabled={busy}
                  description={t('taxConfig.applyToAllHint', { count: productCount })}
                >
                  {t('taxConfig.applyToAll')}
                </ModelCheck>
              </>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t('adminCancel')}
          </Button>
          <Button type="button" disabled={busy} onClick={() => onConfirm(!method && applyToAll)}>
            {busy ? t('waiting') : t('taxConfig.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
