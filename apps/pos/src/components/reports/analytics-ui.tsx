import { Badge, Button, Card, Input } from '@spree/dashboard-ui'
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { ReportPeriod } from '../../hooks/use-report-analytics'
import { dayText } from '../../lib/report-table'

export function formatMoney(value: string | number | null | undefined, currency = 'VND'): string {
  const num = Number(value ?? 0)
  if (!Number.isFinite(num)) return '0'
  return new Intl.NumberFormat('vi-VN', {
    style: currency === 'VND' ? 'decimal' : 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(num) + (currency === 'VND' ? ' ₫' : '')
}

export function formatNumber(value: number | string | null | undefined): string {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? new Intl.NumberFormat('vi-VN').format(num) : '0'
}

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type DatePresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'thisWeek'
  | 'lastWeek'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'

export function presetRange(key: DatePresetKey): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const shift = (days: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + days)
    return d
  }
  switch (key) {
    case 'today':
      return { from: isoDate(today), to: isoDate(today) }
    case 'yesterday': {
      const y = shift(-1)
      return { from: isoDate(y), to: isoDate(y) }
    }
    case 'last7':
      return { from: isoDate(shift(-6)), to: isoDate(today) }
    case 'thisWeek': {
      const dow = (today.getDay() + 6) % 7
      return { from: isoDate(shift(-dow)), to: isoDate(today) }
    }
    case 'lastWeek': {
      const dow = (today.getDay() + 6) % 7
      return { from: isoDate(shift(-dow - 7)), to: isoDate(shift(-dow - 1)) }
    }
    case 'last30':
      return { from: isoDate(shift(-29)), to: isoDate(today) }
    case 'thisMonth':
      return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: isoDate(start), to: isoDate(end) }
    }
    case 'thisYear':
      return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: isoDate(today) }
  }
}

const PRESETS: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'last7', label: '7 ngày qua' },
  { key: 'thisWeek', label: 'Tuần này' },
  { key: 'lastWeek', label: 'Tuần trước' },
  { key: 'last30', label: '30 ngày qua' },
  { key: 'thisMonth', label: 'Tháng này' },
  { key: 'lastMonth', label: 'Tháng trước' },
  { key: 'thisYear', label: 'Năm nay' },
]

export function ReportDateBar({
  from,
  to,
  period,
  onChange,
  extra,
}: {
  from: string
  to: string
  period?: ReportPeriod
  onChange: (range: { from: string; to: string }) => void
  extra?: React.ReactNode
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Ngày bắt đầu"
            value={from}
            onChange={(e) => onChange({ from: e.target.value, to })}
            className="w-40"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="Ngày kết thúc"
            value={to}
            onChange={(e) => onChange({ from, to: e.target.value })}
            className="w-40"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.key}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              onClick={() => onChange(presetRange(preset.key))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      {period && (
        <p className="text-xs text-muted-foreground">
          So sánh với kỳ trước ({dayText(period.prev_from)} – {dayText(period.prev_to)})
        </p>
      )}
    </div>
  )
}

export function ChangeBadge({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">Không đổi</span>
  const positive = pct >= 0
  return (
    <Badge variant={positive ? 'success' : 'warning'} className="gap-1 text-xs font-normal">
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? '+' : ''}
      {pct}%
    </Badge>
  )
}

export function KpiMetricCard({
  label,
  value,
  changePct,
  hint,
  accent,
}: {
  label: string
  value: string
  changePct?: number | null
  hint?: string
  accent?: 'default' | 'success' | 'danger'
}) {
  const tone =
    accent === 'success'
      ? 'text-emerald-600'
      : accent === 'danger'
        ? 'text-rose-600'
        : 'text-foreground'
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {changePct !== undefined && <ChangeBadge pct={changePct} />}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export function SimpleSeriesChart({
  title,
  points,
  valueFormatter,
  controls,
}: {
  title: string
  points: Array<{ label: string; value: number }>
  valueFormatter?: (v: number) => string
  controls?: React.ReactNode
}) {
  const [mode, setMode] = useState<'bar' | 'line'>('bar')
  const fmt = valueFormatter ?? ((v: number) => formatNumber(v))
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1)
  const height = 180
  const width = 640
  const padX = 24
  const padY = 18
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const step = points.length > 0 ? innerW / points.length : innerW

  const linePath = points
    .map((pt, idx) => {
      const x = padX + idx * step + step / 2
      const y = padY + innerH - (Math.max(pt.value, 0) / max) * innerH
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <div className="inline-flex rounded-md border p-0.5 text-xs">
            <button
              type="button"
              className={`rounded px-2 py-1 ${mode === 'bar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('bar')}
            >
              Cột
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${mode === 'line' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              onClick={() => setMode('line')}
            >
              Đường
            </button>
          </div>
        </div>
      </div>
      {points.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Không có dữ liệu trong kỳ.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height + 24}`} className="h-52 w-full min-w-[420px]">
            <line
              x1={padX}
              y1={padY + innerH}
              x2={width - padX}
              y2={padY + innerH}
              stroke="currentColor"
              strokeOpacity="0.15"
            />
            {mode === 'bar'
              ? points.map((pt, idx) => {
                  const barH = (Math.max(pt.value, 0) / max) * innerH
                  const barW = Math.max(Math.min(step * 0.55, 36), 6)
                  const x = padX + idx * step + (step - barW) / 2
                  const y = padY + innerH - barH
                  return (
                    <g key={pt.label}>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(barH, 2)}
                        rx={3}
                        className="fill-primary/80"
                      >
                        <title>{`${pt.label}: ${fmt(pt.value)}`}</title>
                      </rect>
                    </g>
                  )
                })
              : (
                <>
                  <path
                    d={linePath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-primary"
                  />
                  {points.map((pt, idx) => {
                    const x = padX + idx * step + step / 2
                    const y = padY + innerH - (Math.max(pt.value, 0) / max) * innerH
                    return (
                      <circle key={pt.label} cx={x} cy={y} r={3.5} className="fill-primary">
                        <title>{`${pt.label}: ${fmt(pt.value)}`}</title>
                      </circle>
                    )
                  })}
                </>
              )}
            {points.map((pt, idx) => {
              const showTick =
                points.length <= 10 || idx === 0 || idx === points.length - 1 || idx % Math.ceil(points.length / 7) === 0
              if (!showTick) return null
              const x = padX + idx * step + step / 2
              return (
                <text
                  key={`lbl-${pt.label}`}
                  x={x}
                  y={height + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {pt.label}
                </text>
              )
            })}
          </svg>
        </div>
      )}
    </Card>
  )
}
