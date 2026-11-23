import { describeFailure } from '@shared/request-failure'
import {
  presetLockReason,
  BRANCH_PRESETS,
  type BranchPreset,
} from '@shared/selling-layout'
import { LayoutGridIcon } from '@spree/dashboard-ui/icons'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStoreWrite } from '../hooks/use-master-data'
import { useBranchScope } from './branch-detail'
import { ModelCard, ModelNotice } from './setup/model-ui'

// A miniature of each sample screen: the blocks are the panels, the accent
// block the payment.
function Thumb({ preset }: { preset: BranchPreset | 'auto' }) {
  const block = 'rounded-sm bg-muted-foreground/25'
  const accent = 'rounded-sm bg-primary/70'
  if (preset === 'tables_first')
    return (
      <div className="grid h-full grid-cols-4 gap-1">
        {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((cell, index) => (
          <span key={cell} className={index % 3 === 0 ? accent : block} />
        ))}
      </div>
    )
  if (preset === 'one_step')
    return (
      <div className="grid h-full grid-cols-[1.2fr_1fr_1fr] gap-1">
        <span className={block} />
        <span className={block} />
        <span className={accent} />
      </div>
    )
  if (preset === 'big_menu')
    return (
      <div className="grid h-full grid-cols-[3fr_1fr] gap-1">
        <div className="grid grid-cols-3 gap-1">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((cell) => (
            <span key={cell} className={block} />
          ))}
        </div>
        <div className="grid grid-rows-[1fr_18px] gap-1">
          <span className={block} />
          <span className={accent} />
        </div>
      </div>
    )
  if (preset === 'quick')
    return (
      <div className="grid h-full grid-cols-[2fr_1fr] gap-1">
        <span className={block} />
        <div className="grid grid-rows-[1fr_14px] gap-1">
          <span className={block} />
          <span className={accent} />
        </div>
      </div>
    )
  return <div className="grid h-full place-items-center text-lg text-muted-foreground">A</div>
}

// The sample selling screen the branch opens with, kept on the branch. A
// register can still pick another sample for itself at the counter; this is
// what it starts from.
export function BranchSellingPreset() {
  const { t } = useTranslation()
  const { branch, modules, access, branchWrite } = useBranchScope()
  const write = useStoreWrite()
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const canWrite = access.write || branchWrite
  const current = branch.selling_preset ?? ''
  const context = { modules }

  async function choose(value: BranchPreset | '') {
    if (value === current || write.isPending || !canWrite) return
    setNotice(null)
    try {
      await write.mutateAsync({
        method: 'PATCH',
        path: `/pos/branches/${branch.id}`,
        body: { selling_preset: value },
      })
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      setNotice({ text: describeFailure(failure, t), failed: true })
    }
  }

  const options: { value: BranchPreset | ''; locked: boolean }[] = [
    { value: '', locked: false },
    ...BRANCH_PRESETS.map((preset) => ({
      value: preset,
      locked: presetLockReason(preset, context) !== null,
    })),
  ]

  return (
    <ModelCard
      title={t('branchSellingPreset.title')}
      id="features-selling"
      icon={<LayoutGridIcon />}
    >
      <p className="text-sm text-muted-foreground">{t('branchSellingPreset.hint')}</p>
      <ModelNotice notice={notice} />
      <fieldset
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        disabled={!canWrite || write.isPending}
      >
        <legend className="sr-only">{t('branchSellingPreset.title')}</legend>
        {options.map(({ value, locked }) => {
          const key = value || 'auto'
          return (
            <label
              key={key}
              className={[
                'flex cursor-pointer flex-col gap-2 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary',
                locked ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name="selling-preset"
                className="sr-only"
                value={value}
                checked={current === value}
                disabled={locked}
                onChange={() => void choose(value)}
              />
              <span className="block h-16 rounded-md bg-muted/50 p-2" aria-hidden="true">
                <Thumb preset={key} />
              </span>
              <span className="font-medium">{t(`branchSellingPreset.preset_${key}`)}</span>
              <span className="text-sm text-muted-foreground">
                {t(`branchSellingPreset.hint_${key}`)}
              </span>
              {locked ? (
                <span className="text-sm text-muted-foreground">
                  {t('branchSellingPreset.lockedNeedsTables')}
                </span>
              ) : null}
            </label>
          )
        })}
      </fieldset>
    </ModelCard>
  )
}
