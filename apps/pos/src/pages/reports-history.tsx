import { failureStatus } from '@shared/request-failure'
import { describeShiftFailure } from '@shared/shifts'
import { PageHeader } from '@spree/dashboard-core'
import { Badge, Button, Card } from '@spree/dashboard-ui'
import { DownloadIcon } from '@spree/dashboard-ui/icons'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BranchPicker } from '../components/branch-picker'
import { Select } from '../components/topology-fields'
import { usePosSession } from '../hooks/use-pos-session'
import { exportDownloadLink, useExports } from '../hooks/use-reports'
import { branchTimeZone, formatInstant } from '../lib/format-time'
import { startDownload } from '../lib/report-download'

export function ReportsHistoryPage() {
  const { t, i18n } = useTranslation()
  const { context } = usePosSession()
  const branchId = context.data?.selection.branch_id ?? null
  const timeZone = branchTimeZone(context.data)

  const exportsQuery = useExports(branchId ?? '', Boolean(branchId))
  const [reportType, setReportType] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')

  const allRows = exportsQuery.data?.data ?? []
  const types = [...new Set(allRows.map((row) => row.report_type))]

  const rows = allRows.filter((row) => {
    const expired = row.status === 'expired' || Date.parse(row.expires_at) <= Date.now()
    const effectiveStatus = expired ? 'expired' : row.status
    if (reportType !== 'all' && row.report_type !== reportType) return false
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false
    return true
  })

  async function download(id: string) {
    setError('')
    try {
      const link = await exportDownloadLink(id)
      startDownload(link.url, link.filename)
    } catch (failure) {
      if (failureStatus(failure) === 410) {
        setError(t('reportExportExpired'))
        void exportsQuery.refetch()
        return
      }
      setError(describeShiftFailure(failure, t))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.historyTitle')}
        actions={
          <div className="flex items-center gap-2">
            <BranchPicker />
            <Button
              type="button"
              variant="outline"
              onClick={() => void exportsQuery.refetch()}
              disabled={exportsQuery.isFetching}
            >
              <RefreshCw className={`size-4 ${exportsQuery.isFetching ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        }
      />
      {!branchId ? (
        <p className="text-muted-foreground">{t('pageChooseBranchHint')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              aria-label="Loại báo cáo"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-56"
            >
              <option value="all">Tất cả loại báo cáo</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {t(`reportTab_${type}`, { defaultValue: type })}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Trạng thái xuất"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="ready">Hoàn thành</option>
              <option value="queued">Đang chờ</option>
              <option value="processing">Đang xử lý</option>
              <option value="failed">Thất bại</option>
              <option value="expired">Hết hạn</option>
            </Select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {exportsQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              {describeShiftFailure(exportsQuery.error, t)}
            </p>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2.5">Loại báo cáo</th>
                    <th className="px-4 py-2.5">Khoảng thời gian</th>
                    <th className="px-4 py-2.5">Hết hạn lúc</th>
                    <th className="px-4 py-2.5">Số dòng</th>
                    <th className="px-4 py-2.5">Trạng thái</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-muted-foreground">
                        Chưa có lịch sử xuất báo cáo nào.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const expired =
                        row.status === 'expired' || Date.parse(row.expires_at) <= Date.now()
                      const effectiveStatus = expired ? 'expired' : row.status
                      return (
                        <tr key={row.id}>
                          <td className="px-4 py-3 font-medium">
                            {t(`reportTab_${row.report_type}`, { defaultValue: row.report_type })}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {[row.filters.from, row.filters.to].filter(Boolean).join(' – ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatInstant(row.expires_at, i18n.language, timeZone)}
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {row.row_count != null ? row.row_count : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                effectiveStatus === 'failed' || effectiveStatus === 'expired'
                                  ? 'warning'
                                  : effectiveStatus === 'ready'
                                    ? 'success'
                                    : 'secondary'
                              }
                            >
                              {t(`reportExportStatus_${effectiveStatus}`)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {effectiveStatus === 'ready' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void download(row.id)}
                              >
                                <DownloadIcon className="size-4" />
                                {t('reportDownload')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
