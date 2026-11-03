import { apiClient } from '../config/api'
import type { ApiResponse } from './apiServices'

/** Holding: nhân viên còn giữ; Submitted: đã chốt chờ quản lý nhận; Confirmed: quản lý đã nhận; Unassigned: không rõ người thu. */
export type CashState = 'Holding' | 'Submitted' | 'Confirmed' | 'Unassigned'
export type HandoverStatus = 'Submitted' | 'Confirmed' | 'Rejected'

export interface CashPaymentDto {
  paymentId: string
  amount: number
  paymentTime: string
  paymentType: string | null
  sessionId: string | null
  licensePlate: string | null
  staffId: string | null
  staffName: string
  gateId: string | null
  gateName: string | null
  handoverId: string | null
  state: CashState
}

export interface CashHandoverDto {
  handoverId: string
  staffId: string
  staffName: string | null
  amount: number
  paymentCount: number
  status: HandoverStatus
  note: string | null
  submittedAt: string
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewNote: string | null
  payments?: CashPaymentDto[]
}

export interface CashHoldingDto {
  amount: number
  count: number
  since: string | null
  payments: CashPaymentDto[]
  pendingAmount: number
  pendingHandovers: CashHandoverDto[]
}

export interface CashLedgerDto {
  from: string
  to: string
  summary: { total: number; count: number; holding: number; submitted: number; confirmed: number; unassigned: number }
  byStaff: { staffId: string | null; staffName: string; amount: number; count: number }[]
  byGate: { gateId: string | null; gateName: string; amount: number; count: number }[]
  holdingNow: { staffId: string; staffName: string; holding: number; submitted: number; count: number; since: string }[]
  payments: CashPaymentDto[]
}

export interface CashRange {
  from: Date
  to: Date
}

const rangeQuery = (range: CashRange, extra: Record<string, string> = {}) =>
  new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString(), ...extra }).toString()

export const cashApi = {
  myHolding: () => apiClient.get<ApiResponse<CashHoldingDto>>('/cash/my-holding'),
  submitHandover: (note: string) => apiClient.post<ApiResponse<CashHandoverDto>>('/cash/handovers', { reason: note }),
  handovers: (range: CashRange, status = '') =>
    apiClient.get<ApiResponse<CashHandoverDto[]>>(`/cash/handovers?${rangeQuery(range, status ? { status } : {})}`),
  handover: (id: string) => apiClient.get<ApiResponse<CashHandoverDto>>(`/cash/handovers/${id}`),
  confirm: (id: string, note: string) => apiClient.post<ApiResponse<CashHandoverDto>>(`/cash/handovers/${id}/confirm`, { reason: note }),
  reject: (id: string, note: string) => apiClient.post<ApiResponse<CashHandoverDto>>(`/cash/handovers/${id}/reject`, { reason: note }),
  ledger: (range: CashRange) => apiClient.get<ApiResponse<CashLedgerDto>>(`/cash/ledger?${rangeQuery(range)}`),
  exportCsv: (range: CashRange) => apiClient.download(`/cash/ledger/export?${rangeQuery(range)}`),
}

export type CashPeriodPreset = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom'

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** 0h giờ Việt Nam của ngày (năm, tháng 0-11, ngày); tràn ngày/tháng tự lùi tiến như Date.UTC. */
const vnMidnight = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day) - VN_OFFSET_MS)

/** Kỳ tra cứu theo giờ Việt Nam, tuần bắt đầu thứ Hai; `to` không tính (nửa mở). */
export function cashPeriod(preset: Exclude<CashPeriodPreset, 'custom'>, now = new Date()): CashRange {
  const vn = new Date(now.getTime() + VN_OFFSET_MS)
  const y = vn.getUTCFullYear()
  const m = vn.getUTCMonth()
  const d = vn.getUTCDate()
  const sinceMonday = (vn.getUTCDay() + 6) % 7
  switch (preset) {
    case 'this-week':
      return { from: vnMidnight(y, m, d - sinceMonday), to: vnMidnight(y, m, d - sinceMonday + 7) }
    case 'last-week':
      return { from: vnMidnight(y, m, d - sinceMonday - 7), to: vnMidnight(y, m, d - sinceMonday) }
    case 'this-month':
      return { from: vnMidnight(y, m, 1), to: vnMidnight(y, m + 1, 1) }
    case 'last-month':
      return { from: vnMidnight(y, m - 1, 1), to: vnMidnight(y, m, 1) }
  }
}

/** Từ ngày đến hết ngày (ô date "YYYY-MM-DD", giờ Việt Nam). Null khi thiếu hoặc ngược chiều. */
export function cashCustomRange(fromDate: string, toDate: string): CashRange | null {
  const parse = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').map(Number) : null
  const f = parse(fromDate)
  const t = parse(toDate)
  if (!f || !t) return null
  const from = vnMidnight(f[0], f[1] - 1, f[2])
  const to = vnMidnight(t[0], t[1] - 1, t[2] + 1)
  return from < to ? { from, to } : null
}

/** "27/10 – 02/11/2026": ngày cuối là ngày trước mốc `to`. */
export function formatCashRange(range: CashRange) {
  const fmt = (date: Date, withYear: boolean) =>
    date.toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      ...(withYear ? { year: 'numeric' } : {}),
    })
  return `${fmt(range.from, false)} – ${fmt(new Date(range.to.getTime() - DAY_MS), true)}`
}

export const CASH_STATE_LABELS: Record<CashState, string> = {
  Holding: 'Nhân viên đang giữ',
  Submitted: 'Chờ quản lý nhận',
  Confirmed: 'Quản lý đã nhận',
  Unassigned: 'Không rõ người thu',
}

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  Submitted: 'Chờ quản lý nhận',
  Confirmed: 'Đã nhận tiền',
  Rejected: 'Bị từ chối',
}

/** Lớp màu trạng thái dùng chung với các trang quản lý (manager-change-status). */
export const handoverStatusClass = (status: string) =>
  status === 'Confirmed' ? 'status-approved' : status === 'Rejected' ? 'status-rejected' : 'status-pending'

export const cashStateClass = (state: CashState) =>
  state === 'Confirmed' ? 'status-approved' : state === 'Unassigned' ? 'status-rejected' : 'status-pending'
