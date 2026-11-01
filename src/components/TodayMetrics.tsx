import { useEffect, useState } from 'react'
import { apiClient } from '../config/api'
import type { ApiResponse } from '../utils/apiServices'
import { toVietnamDateInput } from '../utils/dateTime'
import { formatCurrency } from '../utils/pricing'

interface Metric {
  key: string
  label: string
  value: number
  unit: string
}

const TONES: Record<string, string> = {
  totalRevenue: 'manager-summary-card--accent',
  entries: 'manager-summary-card--green',
  exits: 'manager-summary-card--orange',
  slotUtilizationRate: '',
}

const REFRESH_MS = 60_000

function formatMetric(metric: Metric) {
  if (metric.unit === 'VND') return formatCurrency(metric.value)
  if (metric.unit === '%') return `${Math.round(metric.value)}%`
  return metric.value.toLocaleString('vi-VN')
}

/** Số liệu hôm nay (giờ Việt Nam) cho trang tổng quan manager / admin, tự làm mới mỗi phút. */
export default function TodayMetrics() {
  const [metrics, setMetrics] = useState<Metric[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stopped = false
    const load = async () => {
      const today = toVietnamDateInput()
      const params = new URLSearchParams({ from: today, to: today, period: 'day', groupBy: 'day' })
      try {
        const res = await apiClient.get<ApiResponse<{ metrics: Metric[] }>>(`/reports/summary?${params}`)
        if (stopped) return
        if (res.isSuccess && res.result) {
          setMetrics(res.result.metrics.filter((metric) => metric.key in TONES))
          setError('')
        } else {
          setError(res.message || 'Chưa tải được số liệu hôm nay.')
        }
      } catch (requestError) {
        if (!stopped) setError(requestError instanceof Error ? requestError.message : 'Chưa tải được số liệu hôm nay.')
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  if (error && !metrics) return <div className="manager-inline-error" role="alert">{error}</div>
  return (
    <section className="manager-summary-grid manager-summary-grid--four" aria-label="Số liệu hôm nay" aria-busy={!metrics}>
      {(metrics ?? Object.keys(TONES).map((key) => ({ key, label: '…', value: 0, unit: '' }))).map((metric) => (
        <article key={metric.key} className={`manager-summary-card ${TONES[metric.key] ?? ''}`}>
          <span>{metric.label}</span>
          <strong>{metrics ? formatMetric(metric) : '…'}</strong>
          <small>Hôm nay</small>
        </article>
      ))}
    </section>
  )
}
