import { Button, Input, Label } from '@spree/dashboard-ui'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProvinces, useWards } from '../hooks/use-store-info'

export type PickedAddress = {
  provinceCode: string
  wardCode: string
  street: string
  provinceName: string
  wardName: string
}

// The store's two-level Vietnam address: province, ward, then street.
export function AddressDialog({
  provinceCode,
  wardCode,
  street,
  onClose,
  onPick,
}: {
  provinceCode: string
  wardCode: string
  street: string
  onClose: () => void
  onPick: (value: PickedAddress) => void
}) {
  const { t } = useTranslation()
  const streetId = useId()
  const provinces = useProvinces(true)
  const [province, setProvince] = useState(provinceCode)
  const [ward, setWard] = useState(wardCode)
  const [road, setRoad] = useState(street)
  const wards = useWards(province || null)
  const provinceName = provinces.data?.find((row) => row.code === province)?.name ?? ''
  const wardName = wards.data?.find((row) => row.code === ward)?.name ?? ''
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('storeInfo.chooseAddress')}
        className="w-full max-w-lg space-y-4 rounded-lg bg-background p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onPick({ provinceCode: province, wardCode: ward, street: road, provinceName, wardName })
        }}
      >
        <label className="block space-y-2">
          <span>{t('storeInfo.province')}</span>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={province}
            onChange={(event) => {
              setProvince(event.target.value)
              setWard('')
            }}
          >
            <option value="">{t('storeInfo.province')}</option>
            {(provinces.data ?? []).map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span>{t('storeInfo.ward')}</span>
          <select
            className="w-full rounded-md border px-3 py-2"
            value={ward}
            onChange={(event) => setWard(event.target.value)}
          >
            <option value="">{t('storeInfo.ward')}</option>
            {(wards.data ?? []).map((row) => (
              <option key={row.code} value={row.code}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <Label htmlFor={streetId}>{t('storeInfo.street')}</Label>
          <Input id={streetId} value={road} onChange={(event) => setRoad(event.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('storeInfo.revert')}
          </Button>
          <Button type="submit" disabled={!province || !ward || !road.trim()}>
            {t('storeInfo.chooseAddress')}
          </Button>
        </div>
      </form>
    </div>
  )
}
