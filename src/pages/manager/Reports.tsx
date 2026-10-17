import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  Banknote,
  BarChart3,
  CalendarCheck2,
  Car,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorOpen,
  Download,
  Loader2,
  Package,
  ParkingSquare,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { toVietnamDateInput } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

const REPORT_LABELS: Record<string, string> = {
  deposit: 'Tiền đặt cọc',
  checkoutfee: 'Phí gửi xe',
  subscriptionfee: 'Phí đăng ký gói tháng',
  subscriptionrenewal: 'Phí gia hạn gói tháng',
  payos: 'Chuyển khoản PayOS',
  cash: 'Tiền mặt',
  pending: 'Chờ xử lý',
  success: 'Thành công',
  successful: 'Thành công',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  confirmed: 'Đã xác nhận',
  modified: 'Đã điều chỉnh',
  checkedin: 'Đã vào bãi',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  canceled: 'Đã hủy',
  noshow: 'Không đến',
  active: 'Đang hoạt động',
  exception: 'Có sự cố',
  unknown: 'Chưa xác định',
}

type GroupBy = 'day' | 'month' | 'quarter' | 'year'
type Preset = 'today' | '7d' | '30d' | 'this-month' | 'last-month' | 'this-year' | 'custom'

interface ApiRes<T = unknown> {
  isSuccess: boolean
  result?: T
  message?: string
}

interface ReportMetric {
  key: string
  label: string
  value: number
  unit: string
}

interface SeriesPoint {
  period: string
  count: number
  amount: number
}

interface Breakdown {
  name: string
  count: number
  amount: number
  percent: number
}

interface ChartPoint {
  label: string
  from?: string
  to?: string
  value: number
  count: number
}

interface PieChartSlice {
  label: string
  value: number
  count: number
  percent: number
}

interface PieChartDTO {
  title: string
  dimension: string
  unit: string
  slices: PieChartSlice[]
}

interface DoubleBarChartPoint {
  label: string
  currentPeriod: string
  comparisonPeriod: string
  currentValue: number
  comparisonValue: number
  currentCount: number
  comparisonCount: number
}

interface DoubleBarChartDTO {
  title: string
  unit: string
  groupBy: GroupBy
  currentSeriesName: string
  comparisonSeriesName: string
  points: DoubleBarChartPoint[]
}

interface LineChartDTO {
  title: string
  unit: string
  groupBy: GroupBy
  points: ChartPoint[]
}

interface RevenueOverviewDTO {
  totalRevenue: number
  successfulPaymentCount: number
  averagePaymentAmount: number
  highestRevenueAmount: number
  highestRevenuePeriod: string
  lowestRevenueAmount: number
  lowestRevenuePeriod: string
}

interface RevenueComparisonItemDTO {
  label: string
  currentFrom: string
  currentTo: string
  comparisonFrom: string
  comparisonTo: string
  currentRevenue: number
  comparisonRevenue: number
  differenceAmount: number
  growthPercent: number
  currentPaymentCount: number
  comparisonPaymentCount: number
  paymentCountDifference: number
  paymentCountGrowthPercent: number
}

interface RevenueComparisonDTO {
  previousPeriod: RevenueComparisonItemDTO
  samePeriodLastYear: RevenueComparisonItemDTO
}

interface RevenueChartsDTO {
  lineChart: LineChartDTO
  pieCharts: PieChartDTO[]
  doubleBarChart: DoubleBarChartDTO
  previousPeriodDoubleBarChart: DoubleBarChartDTO
}

interface SummaryDTO {
  metrics: ReportMetric[]
  revenueSeries: SeriesPoint[]
  revenueByPaymentType: Breakdown[]
  revenueByPaymentMethod?: Breakdown[]
  revenueComparison?: RevenueComparisonDTO
  revenueCharts?: RevenueChartsDTO
}

interface RevenueDTO {
  totalRevenue: number
  successfulPaymentCount: number
  averagePaymentAmount?: number
  overview?: RevenueOverviewDTO
  comparison?: RevenueComparisonDTO
  charts?: RevenueChartsDTO
  revenueSeries: SeriesPoint[]
  byPaymentType: Breakdown[]
  byPaymentMethod?: Breakdown[]
  byVehicleType?: Breakdown[]
}

interface OperationsDTO {
  sessionsByVehicleType: Breakdown[]
  reservationsByStatus: Breakdown[]
}

const GROUP_BY_OPTIONS: { value: GroupBy; label: string; description: string }[] = [
  { value: 'day', label: 'Theo ngày', description: 'yyyy-MM-dd' },
  { value: 'month', label: 'Theo tháng', description: 'yyyy-MM' },
  { value: 'quarter', label: 'Theo quý', description: 'yyyy-Qn' },
  { value: 'year', label: 'Theo năm', description: 'yyyy' },
]

const PRESET_LABELS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7d', label: '7 ngày qua' },
  { value: '30d', label: '30 ngày qua' },
  { value: 'this-month', label: 'Tháng này' },
  { value: 'last-month', label: 'Tháng trước' },
  { value: 'this-year', label: 'Năm nay' },
  { value: 'custom', label: 'Tùy chỉnh' },
]

const METRIC_ICONS: Record<string, ReactNode> = {
  totalRevenue: <Banknote size={22} />,
  successfulPayments: <CreditCard size={22} />,
  entries: <DoorOpen size={22} />,
  exits: <DoorOpen size={22} />,
  activeSessions: <Activity size={22} />,
  completedSessions: <CheckCircle2 size={22} />,
  averageParkingMinutes: <Timer size={22} />,
  reservations: <CalendarCheck2 size={22} />,
  newSubscriptions: <Package size={22} />,
  activeSubscriptions: <Package size={22} />,
  expiredSubscriptions: <Package size={22} />,
  expiringSubscriptions: <Clock3 size={22} />,
  openIncidents: <Activity size={22} />,
  resolvedIncidents: <CheckCircle2 size={22} />,
  slotUtilizationRate: <ParkingSquare size={22} />,
}

const OVERVIEW_METRIC_KEYS = [
  'totalRevenue',
  'successfulPayments',
  'entries',
  'exits',
  'reservations',
]

function localizeReportLabel(value: string) {
  const key = (value || '').replace(/[\s_-]/g, '').toLowerCase()
  return REPORT_LABELS[key] ?? (value || 'Chưa xác định')
}

function shiftCalendarDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function presetDates(preset: Preset): { from: string; to: string } {
  const today = toVietnamDateInput()
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case '7d':
      return { from: shiftCalendarDate(today, -6), to: today }
    case '30d':
      return { from: shiftCalendarDate(today, -29), to: today }
    case 'this-month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'last-month': {
      const firstDayThisMonth = `${today.slice(0, 7)}-01`
      const lastDayLastMonth = shiftCalendarDate(firstDayThisMonth, -1)
      return { from: `${lastDayLastMonth.slice(0, 7)}-01`, to: lastDayLastMonth }
    }
    case 'this-year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today }
    default:
      return { from: shiftCalendarDate(today, -29), to: today }
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value)
}

function formatPercent(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)}%`
}

function formatSignedCurrency(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatCurrency(value)}`
}

function currencyTick(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

function metricDisplayValue(metric: ReportMetric) {
  if (metric.unit === 'VND') return formatCurrency(metric.value)
  if (metric.unit === '%') return `${metric.value}%`
  return formatNumber(metric.value)
}

function groupByLabel(groupBy: GroupBy) {
  return GROUP_BY_OPTIONS.find((item) => item.value === groupBy)?.label.toLowerCase() ?? 'theo ngày'
}

function dateOnly(value: string) {
  return value ? value.slice(0, 10) : '—'
}

function toLinePoints(series: SeriesPoint[]): ChartPoint[] {
  return series.map((item) => ({
    label: item.period,
    value: item.amount,
    count: item.count,
  }))
}

function breakdownToPieChart(title: string, dimension: string, breakdown: Breakdown[] = []): PieChartDTO {
  return {
    title,
    dimension,
    unit: 'VND',
    slices: breakdown.map((item) => ({
      label: localizeReportLabel(item.name),
      value: item.amount,
      count: item.count,
      percent: item.percent,
    })),
  }
}

function normalizePieCharts(revenue: RevenueDTO | null, summary: SummaryDTO | null): PieChartDTO[] {
  const charts = revenue?.charts?.pieCharts ?? summary?.revenueCharts?.pieCharts
  if (charts?.length) {
    return charts.map((chart) => ({
      ...chart,
      slices: chart.slices.map((slice) => ({
        ...slice,
        label: localizeReportLabel(slice.label),
      })),
    }))
  }

  return [
    breakdownToPieChart('Tỷ trọng doanh thu theo loại thanh toán', 'paymentType', revenue?.byPaymentType ?? summary?.revenueByPaymentType ?? []),
    breakdownToPieChart('Tỷ trọng doanh thu theo phương thức thanh toán', 'paymentMethod', revenue?.byPaymentMethod ?? summary?.revenueByPaymentMethod ?? []),
    breakdownToPieChart('Tỷ trọng doanh thu theo loại xe', 'vehicleType', revenue?.byVehicleType ?? []),
  ].filter((chart) => chart.slices.length > 0)
}

function comparisonTone(value: number) {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function ComparisonCard({ item }: { item: RevenueComparisonItemDTO }) {
  const tone = comparisonTone(item.growthPercent)
  const TrendIcon = item.growthPercent < 0 ? TrendingDown : TrendingUp
  const maxRevenue = Math.max(item.currentRevenue, item.comparisonRevenue, 1)
  const currentWidth = clampPercent((item.currentRevenue / maxRevenue) * 100)
  const comparisonWidth = clampPercent((item.comparisonRevenue / maxRevenue) * 100)
  const toneLabel = item.growthPercent > 0 ? 'Tăng trưởng' : item.growthPercent < 0 ? 'Giảm so với cùng kỳ' : 'Ổn định'

  return (
    <article className={`card-panel manager-report-comparison-card manager-report-comparison-card--${tone}`}>
      <div className="manager-report-comparison-header">
        <span>{item.label}</span>
        <strong>{formatPercent(item.growthPercent)}</strong>
      </div>
      <div className="manager-report-comparison-badge">
        <TrendIcon size={16} />
        <span>{toneLabel}</span>
      </div>
      <div className="manager-report-comparison-main">
        <TrendIcon size={24} />
        <div>
          <strong>{formatSignedCurrency(item.differenceAmount)}</strong>
        </div>
      </div>
      <div className="manager-report-comparison-grid">
        <div>
          <span>Kỳ hiện tại</span>
          <strong>{formatCurrency(item.currentRevenue)}</strong>
          <small>{dateOnly(item.currentFrom)} → {dateOnly(item.currentTo)}</small>
        </div>
        <div>
          <span>Kỳ so sánh</span>
          <strong>{formatCurrency(item.comparisonRevenue)}</strong>
          <small>{dateOnly(item.comparisonFrom)} → {dateOnly(item.comparisonTo)}</small>
        </div>
      </div>
      <div className="manager-report-comparison-bars" aria-label="So sánh tỷ lệ doanh thu hai kỳ">
        <div>
          <span>Kỳ hiện tại</span>
          <strong>{formatCurrency(item.currentRevenue)}</strong>
          <div className="manager-report-comparison-track">
            <i style={{ width: `${currentWidth}%` }} />
          </div>
        </div>
        <div>
          <span>Cùng kỳ năm trước</span>
          <strong>{formatCurrency(item.comparisonRevenue)}</strong>
          <div className="manager-report-comparison-track manager-report-comparison-track--muted">
            <i style={{ width: `${comparisonWidth}%` }} />
          </div>
        </div>
      </div>
    </article>
  )
}

function renderPieLabel(props: PieLabelRenderProps) {
  const payload = props.payload as { percent?: number } | undefined
  const payloadPercent = Number(payload?.percent)
  const percent = Number.isFinite(payloadPercent) ? payloadPercent : Number(props.percent) || 0
  return `${percent.toFixed(1)}%`
}

export default function ManagerReports() {
  const defaults = presetDates('7d')
  const [preset, setPreset] = useState<Preset>('7d')
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [groupBy, setGroupBy] = useState<GroupBy>('day')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summary, setSummary] = useState<SummaryDTO | null>(null)
  const [revenue, setRevenue] = useState<RevenueDTO | null>(null)
  const [operations, setOperations] = useState<OperationsDTO | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchReports = useCallback(async (from: string, to: string, selectedGroupBy: GroupBy) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      from,
      to,
      period: selectedGroupBy,
      groupBy: selectedGroupBy,
    })

    try {
      const [sumRes, revRes, opsRes] = await Promise.all([
        apiClient.get<ApiRes<SummaryDTO>>(`/reports/summary?${params}`),
        apiClient.get<ApiRes<RevenueDTO>>(`/reports/revenue?${params}`),
        apiClient.get<ApiRes<OperationsDTO>>(`/reports/operations?${params}`),
      ])

      setSummary(sumRes.isSuccess ? sumRes.result ?? null : null)
      setRevenue(revRes.isSuccess ? revRes.result ?? null : null)
      setOperations(opsRes.isSuccess ? opsRes.result ?? null : null)

      if (!sumRes.isSuccess && !revRes.isSuccess && !opsRes.isSuccess) {
        setError(sumRes.message || revRes.message || opsRes.message || 'Không thể tải dữ liệu báo cáo.')
      }
    } catch (requestError) {
      console.error(requestError)
      setError(requestError instanceof Error ? requestError.message : 'Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReports(fromDate, toDate, groupBy)
    // chỉ load lần đầu, các thay đổi filter sẽ gọi qua nút áp dụng hoặc select handler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePresetChange = (nextPreset: Preset) => {
    setPreset(nextPreset)
    if (nextPreset !== 'custom') {
      const dates = presetDates(nextPreset)
      setFromDate(dates.from)
      setToDate(dates.to)
      void fetchReports(dates.from, dates.to, groupBy)
    }
  }

  const handleGroupByChange = (nextGroupBy: GroupBy) => {
    setGroupBy(nextGroupBy)
    void fetchReports(fromDate, toDate, nextGroupBy)
  }

  const handleApply = () => {
    void fetchReports(fromDate, toDate, groupBy)
  }

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        from: fromDate,
        to: toDate,
        period: groupBy,
        groupBy,
        reportType: 'full',
        format: 'pdf',
      })
      const file = await apiClient.download(`/reports/export?${params}`)
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xuất báo cáo.')
    } finally {
      setExporting(false)
    }
  }

  const revenueSeries = useMemo(
    () => revenue?.revenueSeries ?? summary?.revenueSeries ?? [],
    [summary, revenue],
  )

  const lineChartPoints = useMemo(
    () => revenue?.charts?.lineChart?.points ?? summary?.revenueCharts?.lineChart?.points ?? toLinePoints(revenueSeries),
    [revenue, summary, revenueSeries],
  )

  const pieCharts = useMemo(
    () => normalizePieCharts(revenue, summary),
    [revenue, summary],
  )

  const samePeriodDoubleBar = revenue?.charts?.doubleBarChart ?? summary?.revenueCharts?.doubleBarChart
  const samePeriodDoubleBarPoints = samePeriodDoubleBar?.points ?? []
  const comparison = revenue?.comparison ?? summary?.revenueComparison

  const overviewMetrics = useMemo(() => {
    if (summary?.metrics?.length) {
      return OVERVIEW_METRIC_KEYS
        .map((key) => summary.metrics.find((metric) => metric.key === key))
        .filter((metric): metric is ReportMetric => Boolean(metric))
    }

    if (!revenue) return []

    return [
      {
        key: 'totalRevenue',
        label: 'Tổng doanh thu',
        value: revenue.overview?.totalRevenue ?? revenue.totalRevenue,
        unit: 'VND',
      },
      {
        key: 'successfulPayments',
        label: 'Thanh toán thành công',
        value: revenue.overview?.successfulPaymentCount ?? revenue.successfulPaymentCount,
        unit: 'lần',
      },
    ]
  }, [summary, revenue])

  const reservationPie = useMemo(
    () => (operations?.reservationsByStatus ?? []).map((item) => ({
      name: localizeReportLabel(item.name),
      count: item.count,
      amount: item.amount,
      percent: item.percent,
    })),
    [operations],
  )

  return (
    <ManagerPageShell activeItem="reports">
      <div className="staff-content-wrapper manager-resource-page manager-report-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--purple">
              <BarChart3 size={24} />
            </span>
            <div>
              <h2>Báo cáo, thống kê</h2>
              <p>Doanh thu theo ngày/tháng/quý/năm, so sánh cùng kỳ và dữ liệu biểu đồ cho dashboard quản lý.</p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={handleApply} disabled={loading}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} /> Làm mới
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void handleExport()} disabled={exporting || loading}>
              {exporting ? <><Loader2 size={16} className="spin" /> Đang xuất...</> : <><Download size={16} /> Xuất báo cáo</>}
            </button>
          </div>
        </header>

        <div className="staff-section">
          <div className="manager-report-toolbar card-panel">
            <div className="form-field">
              <label htmlFor="report-from">Từ ngày</label>
              <input
                id="report-from"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  setPreset('custom')
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="report-to">Đến ngày</label>
              <input
                id="report-to"
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  setPreset('custom')
                }}
              />
            </div>

            <div className="form-field">
              <label htmlFor="report-preset">Khoảng thời gian</label>
              <select
                id="report-preset"
                value={preset}
                onChange={(event) => handlePresetChange(event.target.value as Preset)}
              >
                {PRESET_LABELS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="report-group-by">Nhóm doanh thu</label>
              <select
                id="report-group-by"
                value={groupBy}
                onChange={(event) => handleGroupByChange(event.target.value as GroupBy)}
              >
                {GROUP_BY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} ({item.description})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={loading}
            >
              {loading ? <><Loader2 size={16} className="spin" /> Đang tải...</> : <><TrendingUp size={16} /> Xem báo cáo</>}
            </button>

          </div>

          {error && (
            <div className="manager-inline-error manager-report-message" role="alert">{error}</div>
          )}

          {loading && !summary && !revenue && (
            <div className="card-panel manager-empty-state manager-report-message">
              <Loader2 size={32} className="spin" />
              <strong>Đang tải dữ liệu báo cáo...</strong>
            </div>
          )}

          {overviewMetrics.length > 0 && (
            <div className="manager-report-metrics">
              {overviewMetrics.map((metric) => (
                <article key={metric.key} className="manager-summary-card manager-report-metric">
                  <div className="manager-report-metric-icon">
                    {METRIC_ICONS[metric.key] ?? <Activity size={22} />}
                  </div>
                  <strong>{metricDisplayValue(metric)}</strong>
                  <span>{localizeReportLabel(metric.label)}</span>
                </article>
              ))}
            </div>
          )}

          {!loading && lineChartPoints.length > 0 && (
            <div className="manager-report-chart-grid">
              <div className="card-panel manager-report-chart-card manager-report-chart-card--wide">
                <h3 className="panel-subtitle">Doanh thu {groupByLabel(groupBy)}</h3>
                <p className="manager-report-chart-note">Các kỳ không có doanh thu vẫn hiển thị 0 để dễ theo dõi xu hướng.</p>
                <ResponsiveContainer width="100%" height={330}>
                  <LineChart data={lineChartPoints}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={currencyTick} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: unknown) => [formatCurrency(Number(value)), 'Doanh thu']}
                      labelFormatter={(label: unknown) => `Kỳ: ${String(label)}`}
                    />
                    <Line type="monotone" dataKey="value" name="Doanh thu" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {samePeriodDoubleBarPoints.length > 0 && (
                <div className="card-panel manager-report-chart-card">
                  <h3 className="panel-subtitle">So sánh doanh thu với cùng kỳ năm trước</h3>
                  <p className="manager-report-chart-note">Đối chiếu doanh thu kỳ hiện tại và cùng kỳ năm trước {groupByLabel(groupBy)}.</p>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={samePeriodDoubleBarPoints}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={currencyTick} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [formatCurrency(Number(value)), String(name)]}
                        labelFormatter={(label: unknown) => `Kỳ: ${String(label)}`}
                      />
                      <Legend />
                      <Bar dataKey="currentValue" name={samePeriodDoubleBar?.currentSeriesName || 'Kỳ này'} fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="comparisonValue" name={samePeriodDoubleBar?.comparisonSeriesName || 'Cùng kỳ năm trước'} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {comparison && samePeriodDoubleBarPoints.length > 0 && (
                <ComparisonCard item={comparison.samePeriodLastYear} />
              )}
            </div>
          )}

          {!loading && (pieCharts.length > 0 || reservationPie.length > 0) && (
            <div className="manager-report-chart-grid">
              {pieCharts.map((chart, chartIndex) => (
                <div key={chart.dimension || chart.title} className="card-panel manager-report-chart-card">
                  <h3 className="panel-subtitle">{chart.title}</h3>
                  <p className="manager-report-chart-note">Tỷ lệ phần trăm được tính trên tổng doanh thu trong khoảng thời gian đã chọn.</p>
                  <ResponsiveContainer width="100%" height={310}>
                    <PieChart>
                      <Pie
                        data={chart.slices}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={96}
                        label={renderPieLabel}
                        labelLine={false}
                      >
                        {chart.slices.map((slice, sliceIndex) => (
                          <Cell key={`${chart.dimension}-${slice.label}`} fill={COLORS[(chartIndex + sliceIndex) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ))}

              {reservationPie.length > 0 && (
                <div className="card-panel manager-report-chart-card">
                  <h3 className="panel-subtitle">Trạng thái đặt chỗ</h3>
                  <p className="manager-report-chart-note">Tỷ lệ đặt chỗ theo từng trạng thái trong khoảng thời gian đã chọn.</p>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reservationPie}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={96}
                        label={renderPieLabel}
                        labelLine={false}
                      >
                        {reservationPie.map((item, index) => (
                          <Cell key={item.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: unknown) => [formatNumber(Number(value)), 'Số lượt']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {!loading && !error && !summary && !revenue && !operations && (
            <div className="card-panel manager-empty-state manager-report-message">
              <Car size={40} aria-hidden />
              <strong>Không có dữ liệu</strong>
              <span>Không có dữ liệu trong khoảng thời gian này.</span>
            </div>
          )}
        </div>
      </div>
    </ManagerPageShell>
  )
}
