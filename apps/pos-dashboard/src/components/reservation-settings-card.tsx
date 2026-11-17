import {
  conflictReason,
  describeFailure,
  posFailureKey,
} from '@parkviet/pos-shared/request-failure'
import {
  acceptWindow,
  clockMinutes,
  MAX_RESERVATION_PERIODS,
  minutesClock,
  type PeriodProblem,
  periodProblems,
  periodSpan,
  RESERVATION_BUFFER_MAX,
  type ReservationPeriod,
  type ReservationRuleSettings,
  sortPeriods,
} from '@parkviet/pos-shared/reservation-window'
import { Button, Input, Label } from '@spree/dashboard-ui'
import { CalendarIcon, MinusIcon, PlusIcon, Trash2Icon } from '@spree/dashboard-ui/icons'
import { Link } from '@tanstack/react-router'
import { type FormEvent, type ReactNode, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFloorPlanWrite, useTableSettings } from '../hooks/use-floor-plan'
import { useSession } from '../hooks/use-session'
import { useBranchScope } from './branch-detail'
import { ModelCard, ModelNotice, ModelState } from './setup/model-ui'

const DAY = 24 * 60
const BOOKING_MINUTES_MAX = 1440
const REFUSALS = [
  'reservation_settings_invalid',
  'reservation_periods_invalid',
  'reservation_window_empty',
] as const

type Draft = {
  duration: string
  grace: string
  periods: ReservationPeriod[]
  openBuffer: string
  closeBuffer: string
  minLead: string
}

const draftOf = (settings: ReservationRuleSettings): Draft => ({
  duration: String(settings.reservation_duration_minutes),
  grace: String(settings.reservation_grace_minutes),
  periods: settings.reservation_periods,
  openBuffer: String(settings.reservation_open_buffer_minutes),
  closeBuffer: String(settings.reservation_close_buffer_minutes),
  minLead: String(settings.reservation_min_lead_minutes),
})

// Whole minutes within the range, or undefined.
function readMinutes(value: string, min: number, max: number): number | undefined {
  const text = value.trim()
  if (!/^\d+$/.test(text)) return undefined
  const minutes = Number(text)
  return minutes >= min && minutes <= max ? minutes : undefined
}

// When a branch takes bookings: how long a booking holds its table and how
// late a guest may be, the service periods (none: the opening hours), the
// minutes after a period opens and before it closes when no booking starts,
// and how far ahead a booking must be made. Staff bookings outside the rules
// are only warned about on the POS.
export function ReservationSettingsCard({ write }: { write: boolean }) {
  const { t } = useTranslation()
  const { branch } = useBranchScope()
  const { storeId } = useSession()
  const settings = useTableSettings(branch.id)
  const mutation = useFloorPlanWrite()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const loaded = settings.data?.reservation
  const current = draft ?? (loaded ? draftOf(loaded) : null)

  const duration = current ? readMinutes(current.duration, 1, BOOKING_MINUTES_MAX) : undefined
  const grace = current ? readMinutes(current.grace, 1, BOOKING_MINUTES_MAX) : undefined
  const openBuffer = current
    ? readMinutes(current.openBuffer, 0, RESERVATION_BUFFER_MAX)
    : undefined
  const closeBuffer = current
    ? readMinutes(current.closeBuffer, 0, RESERVATION_BUFFER_MAX)
    : undefined
  const minLead = current ? readMinutes(current.minLead, 0, RESERVATION_BUFFER_MAX) : undefined
  const problems = current ? periodProblems(current.periods, openBuffer ?? 0, closeBuffer ?? 0) : {}
  const invalid =
    [duration, grace, openBuffer, closeBuffer, minLead].some((value) => value === undefined) ||
    Object.keys(problems).length > 0

  const edit = (patch: Partial<Draft>) =>
    setDraft((value) => {
      const base = value ?? current
      return base ? { ...base, ...patch } : value
    })
  const setPeriod = (index: number, patch: Partial<ReservationPeriod>) =>
    current &&
    edit({
      periods: current.periods.map((row, position) =>
        position === index ? { ...row, ...patch } : row,
      ),
    })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!current || !draft || !loaded || invalid || mutation.isPending) return
    setNotice(null)
    try {
      await mutation.mutateAsync({
        method: 'PUT',
        path: '/pos/table_settings',
        body: {
          branch_id: branch.id,
          reservation_duration_minutes: duration,
          reservation_grace_minutes: grace,
          reservation_periods: sortPeriods(current.periods, loaded.business_day_cutoff),
          reservation_open_buffer_minutes: openBuffer,
          reservation_close_buffer_minutes: closeBuffer,
          reservation_min_lead_minutes: minLead,
        },
      })
      setDraft(null)
      setNotice({ text: t('saved'), failed: false })
    } catch (failure) {
      const reason = conflictReason(failure)
      setNotice({
        text:
          reason && (REFUSALS as readonly string[]).includes(reason)
            ? t(`floorPlan.reservationFailure_${reason}`)
            : describeFailure(failure, t),
        failed: true,
      })
    }
  }

  // What the timeline shows: the draft's periods, or the opening hours.
  const shown =
    current && current.periods.length > 0
      ? current.periods.filter((_, index) => !problems[index])
      : current && loaded?.reservation_periods_source !== 'branch'
        ? (loaded?.reservation_effective_periods ?? [])
        : []
  const opening = loaded?.reservation_periods_source === 'none' ? null : loaded

  return (
    <ModelCard
      title={t('floorPlan.reservationTitle')}
      id="branch-reservation-settings"
      icon={<CalendarIcon />}
    >
      <p className="text-sm text-muted-foreground">{t('floorPlan.reservationIntro')}</p>
      <ModelNotice notice={notice} />
      {settings.isPending ? (
        <ModelState title={t('waiting')} />
      ) : settings.error || !current || !loaded ? (
        <ModelState
          error
          title={t(posFailureKey(settings.error))}
          retry={() => void settings.refetch()}
        />
      ) : (
        <form className="space-y-6" onSubmit={(event) => void save(event)}>
          <Section title={t('floorPlan.reservationUsage')}>
            <MinuteRow
              label={t('floorPlan.reservationDuration')}
              hint={t('floorPlan.reservationDurationHint')}
              value={current.duration}
              min={1}
              max={BOOKING_MINUTES_MAX}
              invalid={duration === undefined}
              disabled={!write}
              onChange={(value) => edit({ duration: value })}
            />
            <MinuteRow
              label={t('floorPlan.reservationGrace')}
              hint={t('floorPlan.reservationGraceHint')}
              value={current.grace}
              min={1}
              max={BOOKING_MINUTES_MAX}
              invalid={grace === undefined}
              disabled={!write}
              onChange={(value) => edit({ grace: value })}
            />
          </Section>

          <Section
            title={t('floorPlan.reservationPeriods')}
            description={t('floorPlan.reservationPeriodsHint')}
          >
            {current.periods.length === 0 ? (
              <div className="space-y-2 text-sm">
                <p>
                  {opening && shown[0]
                    ? t('floorPlan.reservationPeriodsFromHours', {
                        start: shown[0].start,
                        end: shown[0].end,
                      })
                    : t('floorPlan.reservationPeriodsNone')}{' '}
                  <Link to={`/${storeId}/settings/store-info` as string} className="underline">
                    {t('floorPlan.reservationOpeningHoursLink')}
                  </Link>
                </p>
                {write ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      edit({
                        periods: [
                          opening && shown[0] ? { ...shown[0] } : { start: '10:00', end: '22:00' },
                        ],
                      })
                    }
                  >
                    <PlusIcon className="size-4" />
                    {t('floorPlan.reservationPeriodsSplit')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-3">
                {current.periods.map((period, index) => (
                  <PeriodRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: periods have no id; rows are edited in place.
                    key={index}
                    index={index}
                    period={period}
                    problem={problems[index]}
                    disabled={!write}
                    onChange={(patch) => setPeriod(index, patch)}
                    onRemove={() =>
                      edit({ periods: current.periods.filter((_, position) => position !== index) })
                    }
                  />
                ))}
              </ul>
            )}
            {write && current.periods.length > 0 ? (
              <Button
                type="button"
                variant="link"
                className="px-0"
                disabled={current.periods.length >= MAX_RESERVATION_PERIODS}
                onClick={() => edit({ periods: [...current.periods, nextPeriod(current.periods)] })}
              >
                <PlusIcon className="size-4" />
                {t('floorPlan.reservationPeriodAdd')}
              </Button>
            ) : null}
            {current.periods.length >= MAX_RESERVATION_PERIODS ? (
              <small className="block text-muted-foreground">
                {t('floorPlan.reservationPeriodsMax', { max: MAX_RESERVATION_PERIODS })}
              </small>
            ) : null}
          </Section>

          <Section
            title={t('floorPlan.reservationRules')}
            description={t('floorPlan.reservationRulesHint')}
          >
            <MinuteRow
              label={t('floorPlan.reservationOpenBuffer')}
              hint={t('floorPlan.reservationOpenBufferHint')}
              value={current.openBuffer}
              min={0}
              max={RESERVATION_BUFFER_MAX}
              invalid={openBuffer === undefined}
              disabled={!write}
              onChange={(value) => edit({ openBuffer: value })}
            />
            <MinuteRow
              label={t('floorPlan.reservationCloseBuffer')}
              hint={t('floorPlan.reservationCloseBufferHint')}
              value={current.closeBuffer}
              min={0}
              max={RESERVATION_BUFFER_MAX}
              invalid={closeBuffer === undefined}
              disabled={!write}
              onChange={(value) => edit({ closeBuffer: value })}
            />
          </Section>

          <Section title={t('floorPlan.reservationLead')}>
            <MinuteRow
              label={t('floorPlan.reservationMinLead')}
              hint={t('floorPlan.reservationMinLeadHint')}
              value={current.minLead}
              min={0}
              max={RESERVATION_BUFFER_MAX}
              invalid={minLead === undefined}
              disabled={!write}
              onChange={(value) => edit({ minLead: value })}
            />
          </Section>

          <Section
            title={t('floorPlan.reservationTimeline')}
            description={t('floorPlan.reservationTimelineHint', {
              cutoff: loaded.business_day_cutoff,
            })}
          >
            <Timeline
              periods={shown}
              cutoff={loaded.business_day_cutoff}
              openBuffer={openBuffer ?? 0}
              closeBuffer={closeBuffer ?? 0}
            />
          </Section>

          {write ? (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={!draft || mutation.isPending}
                onClick={() => {
                  setDraft(null)
                  setNotice(null)
                }}
              >
                {t('salesDiscard')}
              </Button>
              <Button type="submit" disabled={!draft || invalid || mutation.isPending}>
                {mutation.isPending ? t('waiting') : t('floorPlan.reservationSave')}
              </Button>
            </div>
          ) : null}
        </form>
      )}
    </ModelCard>
  )
}

// A new period starting an hour after the last one ends, two hours long.
function nextPeriod(periods: ReservationPeriod[]): ReservationPeriod {
  const last = periods[periods.length - 1]
  const start = last ? periodSpan(last)[1] + 60 : 10 * 60
  return { start: minutesClock(start), end: minutesClock(start + 120) }
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
      <legend className="text-base font-medium">{title}</legend>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </fieldset>
  )
}

// A label with its explanation on the left and a minute field with -/+ on the right.
function MinuteRow({
  label,
  hint,
  value,
  min,
  max,
  invalid,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  value: string
  min: number
  max: number
  invalid: boolean
  disabled: boolean
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const number = Number(value)
  const step = (delta: number) =>
    onChange(String(Math.min(max, Math.max(min, (Number.isFinite(number) ? number : min) + delta))))
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
        {invalid ? (
          <p className="text-sm text-destructive">
            {t('floorPlan.reservationMinutesInvalid', { min, max })}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('floorPlan.reservationDecrease')}
          disabled={disabled || number <= min}
          onClick={() => step(-1)}
        >
          <MinusIcon className="size-4" />
        </Button>
        <Input
          id={id}
          inputMode="numeric"
          className="w-20 text-center"
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('floorPlan.reservationIncrease')}
          disabled={disabled || number >= max}
          onClick={() => step(1)}
        >
          <PlusIcon className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {t('floorPlan.reservationMinuteUnit')}
        </span>
      </div>
    </div>
  )
}

function PeriodRow({
  index,
  period,
  problem,
  disabled,
  onChange,
  onRemove,
}: {
  index: number
  period: ReservationPeriod
  problem: PeriodProblem | undefined
  disabled: boolean
  onChange: (patch: Partial<ReservationPeriod>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const name = t('floorPlan.reservationPeriodName', { number: index + 1 })
  const overnight = !problem && clockMinutes(period.end) < clockMinutes(period.start)
  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 text-sm font-medium">{name}</span>
        <Input
          type="time"
          className="w-32"
          value={period.start}
          disabled={disabled}
          aria-label={t('floorPlan.reservationPeriodStart', { name })}
          aria-invalid={Boolean(problem)}
          onChange={(event) => onChange({ start: event.target.value })}
        />
        <span aria-hidden>–</span>
        <Input
          type="time"
          className="w-32"
          value={period.end}
          disabled={disabled}
          aria-label={t('floorPlan.reservationPeriodEnd', { name })}
          aria-invalid={Boolean(problem)}
          onChange={(event) => onChange({ end: event.target.value })}
        />
        {overnight ? (
          <span className="text-sm text-muted-foreground">
            {t('floorPlan.reservationPeriodOvernight')}
          </span>
        ) : null}
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('floorPlan.reservationPeriodRemove', { name })}
            onClick={onRemove}
          >
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>
      {problem ? (
        <p className="text-sm text-destructive">{t(`floorPlan.reservationPeriod_${problem}`)}</p>
      ) : null}
    </li>
  )
}

// The business day from its cutoff, each period drawn as its opening buffer,
// the time bookings are taken and its closing buffer; gaps are breaks.
function Timeline({
  periods,
  cutoff,
  openBuffer,
  closeBuffer,
}: {
  periods: ReservationPeriod[]
  cutoff: string
  openBuffer: number
  closeBuffer: number
}) {
  const { t } = useTranslation()
  const origin = clockMinutes(cutoff)
  const percent = (minutes: number) => `${(minutes / DAY) * 100}%`
  const bars = sortPeriods(periods, cutoff).map((period) => {
    const [from, to] = periodSpan(period)
    const start = (from - origin + DAY) % DAY
    const length = to - from
    const window = acceptWindow(period, openBuffer, closeBuffer)
    return { period, start, length, window, from }
  })
  return (
    <div className="space-y-3">
      {bars.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('floorPlan.reservationTimelineEmpty')}</p>
      ) : (
        <div className="space-y-1" role="img" aria-label={t('floorPlan.reservationTimeline')}>
          <div className="relative h-6 overflow-hidden rounded-md bg-muted">
            {bars.map(({ period, start, length, window, from }) => {
              const open = window ? window.from - from : length
              const accept = window ? window.to - window.from : 0
              return (
                <div
                  key={`${period.start}-${period.end}`}
                  className="absolute inset-y-0 flex"
                  style={{ left: percent(start), width: percent(Math.min(length, DAY - start)) }}
                >
                  <div
                    className="h-full bg-success/30"
                    style={{ width: `${(open / length) * 100}%` }}
                  />
                  <div
                    className="h-full bg-success"
                    style={{ width: `${(accept / length) * 100}%` }}
                  />
                  <div className="h-full flex-1 bg-success/30" />
                </div>
              )
            })}
          </div>
          <div className="relative h-10 text-xs text-muted-foreground">
            {bars.map(({ period, start, length, window }) => (
              <div
                key={`${period.start}-${period.end}`}
                className="absolute flex flex-col"
                style={{ left: percent(start), width: percent(Math.min(length, DAY - start)) }}
              >
                <span className="font-medium text-foreground">
                  {period.start} – {period.end}
                </span>
                {window ? (
                  <span>
                    {t('floorPlan.reservationTimelineAccept', {
                      from: minutesClock(window.from),
                      to: minutesClock(window.to),
                    })}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <Legend className="bg-success">{t('floorPlan.reservationLegendAccept')}</Legend>
        <Legend className="bg-success/30">{t('floorPlan.reservationLegendBuffer')}</Legend>
        <Legend className="bg-muted">{t('floorPlan.reservationLegendBreak')}</Legend>
      </ul>
    </div>
  )
}

function Legend({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-sm border ${className}`} aria-hidden />
      {children}
    </li>
  )
}
