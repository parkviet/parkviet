import {
  type BusinessProfile,
  profileDescriptionKey,
  profileLabelKey,
} from '@parkviet/pos-shared/pos-modules'
import { isComingSoon, type SetupAction, type SetupState } from '@parkviet/pos-shared/setup-wizard'
import { Badge, Button } from '@spree/dashboard-ui'
import type { Dispatch } from 'react'
import { useTranslation } from 'react-i18next'

export function ProfilePicker({
  headingId,
  profiles,
  state,
  dispatch,
}: {
  headingId: string
  profiles: BusinessProfile[]
  state: SetupState
  dispatch: Dispatch<SetupAction>
}) {
  const { t } = useTranslation()
  const pending = profiles.find((profile) => profile.key === state.choice)
  const waiting = isComingSoon(pending) && !state.declined
  const label = (key: string) => t(profileLabelKey(key), { defaultValue: key })
  const selected = state.profileKeys
  return (
    <div className="space-y-6">
      <fieldset aria-labelledby={headingId} className="min-w-0 space-y-6 border-0 p-0">
        {[
          {
            id: 'retail',
            title: t('setup.groupRetail'),
            rows: profiles.filter((profile) => profile.group === 'retail'),
          },
          {
            id: 'other',
            title: t('setup.groupFnb'),
            rows: profiles.filter((profile) => profile.group !== 'retail'),
          },
        ].map((section) =>
          section.rows.length ? (
            <fieldset key={section.id} className="min-w-0 space-y-3">
              <legend className="mb-3 font-semibold">{section.title}</legend>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
                {section.rows.map((profile) => {
                  const soon = profile.status !== 'available'
                  const id = `setup-profile-${profile.key}`
                  const on = selected.includes(profile.key)
                  const primary = selected[0] === profile.key
                  return (
                    <label
                      key={profile.key}
                      htmlFor={id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${on || state.choice === profile.key ? 'border-primary bg-muted' : 'hover:bg-muted/50'}`}
                      data-selected={on || state.choice === profile.key}
                      data-soon={soon}
                    >
                      {soon ? (
                        <input
                          id={id}
                          type="checkbox"
                          className="mt-1"
                          checked={state.choice === profile.key}
                          aria-labelledby={`${id}-name`}
                          onChange={() => dispatch({ type: 'choose', key: profile.key, profiles })}
                        />
                      ) : (
                        <input
                          id={id}
                          type="checkbox"
                          className="mt-1"
                          checked={on}
                          aria-labelledby={`${id}-name`}
                          onChange={() =>
                            dispatch(
                              on
                                ? { type: 'remove-profile', key: profile.key, profiles }
                                : { type: 'add-profile', key: profile.key, profiles },
                            )
                          }
                        />
                      )}
                      <div className="min-w-0 space-y-2">
                        <span id={`${id}-name`} className="text-base font-medium">
                          {label(profile.key)}
                        </span>
                        {primary ? <Badge>{t('storeInfo.primary')}</Badge> : null}
                        {on && !primary ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.preventDefault()
                              dispatch({ type: 'make-primary', key: profile.key, profiles })
                            }}
                          >
                            {t('storeInfo.makePrimary')}
                          </Button>
                        ) : null}
                        {soon ? (
                          <Badge variant="outline" id={`${id}-soon`}>
                            {t('setup.comingSoon')}
                          </Badge>
                        ) : null}
                        <p id={`${id}-description`} className="text-sm text-muted-foreground">
                          {t(profileDescriptionKey(profile.key), { defaultValue: '' })}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null,
        )}
      </fieldset>
      {waiting && pending ? (
        <fieldset className="space-y-3 rounded-md border bg-muted p-4">
          <legend>{t('setup.interestPrompt', { name: label(pending.key) })}</legend>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => dispatch({ type: 'answer-interest', sellsGoods: true, profiles })}
            >
              {t('setup.interestYes')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => dispatch({ type: 'answer-interest', sellsGoods: false, profiles })}
            >
              {t('setup.interestNo')}
            </Button>
          </div>
        </fieldset>
      ) : null}
      {state.declined && pending ? (
        <p role="status">{t('setup.interestDeclined', { name: label(pending.key) })}</p>
      ) : null}
      {state.interests.length ? (
        <div role="status" className="space-y-3">
          <p>{t('setup.interestsRecorded', { names: state.interests.map(label).join(', ') })}</p>
          <ul aria-label={t('setup.interestsList')} className="space-y-2">
            {state.interests.map((key) => (
              <li key={key} className="flex flex-wrap items-center gap-3">
                <span>{label(key)}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={t('setup.interestRemove', { name: label(key) })}
                  onClick={() => dispatch({ type: 'remove-interest', key })}
                >
                  {t('setup.interestRemoveShort')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
