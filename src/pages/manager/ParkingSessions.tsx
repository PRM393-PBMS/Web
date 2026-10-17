import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  CarFront,
  ChevronDown,
  Clock3,
  CreditCard,
  Eye,
  Fingerprint,
  Hash,
  Image as ImageIcon,
  MapPin,
  ParkingSquare,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { useParkingFeePreviews } from '../../hooks/useParkingFeePreviews'
import {
  formatUtcToVietnamDate,
  formatUtcToVietnamDateTime,
  parseBackendUtcDate,
  toVietnamDatetimeLocal,
  vietnamDatetimeLocalToUtcIso,
} from '../../utils/dateTime'
import type { ApiResponse, MonthlySubscriptionDto, ParkingSessionDto } from '../../utils/apiServices'
import { normalizeLicensePlate } from '../../utils/licensePlate'
import { formatCurrency } from '../../utils/pricing'

type DateFilter = 'all' | 'today' | '7days' | '30days'

interface SessionOption { id: string; label: string; type?: string }
interface SessionForm {
  driverUserId: string; licensePlateIn: string; licensePlateOut: string
  entryImageUrl: string; exitImageUrl: string; vehicleTypeId: string
  entryTime: string; exitTime: string; entryGateId: string; exitGateId: string
  assignedSlotId: string; actualSlotId: string; status: string
}

const EMPTY_SESSION_FORM: SessionForm = {
  driverUserId: '', licensePlateIn: '', licensePlateOut: '', entryImageUrl: '', exitImageUrl: '',
  vehicleTypeId: '', entryTime: '', exitTime: '', entryGateId: '', exitGateId: '',
  assignedSlotId: '', actualSlotId: '', status: 'Active',
}

function toLocalInput(value?: string) {
  return toVietnamDatetimeLocal(value)
}

function sessionToForm(session: ParkingSessionDto): SessionForm {
  return {
    driverUserId: session.driverUserId ?? '', licensePlateIn: normalizeLicensePlate(session.licensePlateIn),
    licensePlateOut: normalizeLicensePlate(session.licensePlateOut ?? ''), entryImageUrl: session.entryImageUrl ?? '',
    exitImageUrl: session.exitImageUrl ?? '', vehicleTypeId: session.vehicleTypeId,
    entryTime: toLocalInput(session.entryTime), exitTime: toLocalInput(session.exitTime),
    entryGateId: session.entryGateId, exitGateId: session.exitGateId ?? '',
    assignedSlotId: session.assignedSlotId ?? '', actualSlotId: session.actualSlotId ?? '', status: session.status,
  }
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Đang trong bãi',
  completed: 'Đã hoàn thành',
  pending: 'Chờ xử lý',
  cancelled: 'Đã hủy',
  exception: 'Có sự cố',
}

function statusLabel(status?: string) {
  const normalized = status?.toLowerCase() ?? ''
  return STATUS_LABELS[normalized] ?? status ?? 'Không rõ'
}

function paymentStatusLabel(status?: string) {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized === 'success') return 'Đã thanh toán'
  if (normalized === 'pending') return 'Chờ thanh toán'
  if (normalized === 'failed') return 'Thanh toán thất bại'
  return status || 'Chưa có thanh toán'
}

function sessionDuration(session: ParkingSessionDto, referenceTime: number) {
  const start = parseBackendUtcDate(session.entryTime).getTime()
  const end = session.exitTime ? parseBackendUtcDate(session.exitTime).getTime() : referenceTime
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—'
  const totalMinutes = Math.floor((end - start) / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${minutes} phút`
  return `${Math.max(1, minutes)} phút`
}

function customerLabel(session: ParkingSessionDto) {
  if (session.reservationId) return 'Xe đặt trước'
  if (session.driverUserId) return 'Khách thành viên'
  return 'Khách vãng lai'
}

function subscriptionForSession(
  session: ParkingSessionDto,
  subscriptions: MonthlySubscriptionDto[],
) {
  if (session.reservationId) return undefined

  const sessionPlate = normalizeLicensePlate(session.licensePlateIn)
  const sessionVehicleType = session.vehicleTypeName?.trim().toLowerCase()
  const coverageTime = session.exitTime
    ? parseBackendUtcDate(session.exitTime).getTime()
    : Date.now()

  return subscriptions.find((subscription) => {
    const status = subscription.status.toLowerCase()
    const sameVehicleType =
      !sessionVehicleType ||
      !subscription.vehicleType ||
      subscription.vehicleType.trim().toLowerCase() === sessionVehicleType

    return (
      status !== 'pendingpayment' &&
      status !== 'cancelled' &&
      normalizeLicensePlate(subscription.licensePlate) === sessionPlate &&
      sameVehicleType &&
      parseBackendUtcDate(subscription.startDate).getTime() <= coverageTime &&
      parseBackendUtcDate(subscription.endDate).getTime() >= coverageTime
    )
  })
}

export default function ManagerParkingSessions() {
  const [sessions, setSessions] = useState<ParkingSessionDto[]>([])
  const [subscriptions, setSubscriptions] = useState<MonthlySubscriptionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [selectedSession, setSelectedSession] = useState<ParkingSessionDto | null>(null)
  const [referenceTime, setReferenceTime] = useState(() => Date.now())
  const [editingSession, setEditingSession] = useState<ParkingSessionDto | null | undefined>(undefined)
  const [sessionForm, setSessionForm] = useState<SessionForm>(EMPTY_SESSION_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ParkingSessionDto | null>(null)
  const [vehicleOptions, setVehicleOptions] = useState<SessionOption[]>([])
  const [gateOptions, setGateOptions] = useState<SessionOption[]>([])
  const [slotOptions, setSlotOptions] = useState<SessionOption[]>([])
  const { previews: feePreviews, errors: feePreviewErrors } = useParkingFeePreviews(sessions)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<ParkingSessionDto[]>>('/ParkingSession')
      setSessions(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      setReferenceTime(Date.now())
      if (!res.isSuccess) setError(res.message || 'Không thể tải danh sách phiên gửi xe.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối đến hệ thống.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchSessions()
      void Promise.all([
        apiClient.get<ApiResponse<Array<{ vehicleTypeId: string; typeName: string }>>>('/VehicleType'),
        apiClient.get<ApiResponse<Array<{ gateId: string; gateName: string; gateType?: string }>>>('/Gate'),
        apiClient.get<ApiResponse<Array<{ slotId: string; slotCode: string; status?: string }>>>('/ParkingSlot'),
        apiClient.get<ApiResponse<MonthlySubscriptionDto[]>>('/MonthlySubscription'),
      ]).then(([vehicles, gates, slots, monthlySubscriptions]) => {
        setVehicleOptions((vehicles.result ?? []).map((item) => ({ id: item.vehicleTypeId, label: item.typeName })))
        setGateOptions((gates.result ?? []).map((item) => ({ id: item.gateId, label: item.gateName, type: item.gateType })))
        setSlotOptions((slots.result ?? []).map((item) => ({ id: item.slotId, label: item.slotCode, type: item.status })))
        setSubscriptions(monthlySubscriptions.result ?? [])
      }).catch(() => setError('Không thể tải loại xe, cổng hoặc slot để chỉnh sửa phiên.'))
    })
  }, [fetchSessions])

  useEffect(() => {
    const timer = window.setInterval(() => setReferenceTime(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const selectedSubscription = useMemo(
    () =>
      selectedSession
        ? subscriptionForSession(selectedSession, subscriptions)
        : undefined,
    [selectedSession, subscriptions],
  )

  const openCreate = () => {
    setSessionForm({
      ...EMPTY_SESSION_FORM,
      vehicleTypeId: vehicleOptions[0]?.id ?? '',
      entryGateId: gateOptions.find((gate) => gate.type?.toLowerCase() === 'entry')?.id ?? gateOptions[0]?.id ?? '',
      entryTime: toLocalInput(new Date().toISOString()),
    })
    setEditingSession(null)
  }

  const openEdit = (session: ParkingSessionDto) => {
    setSessionForm(sessionToForm(session))
    setEditingSession(session)
    setSelectedSession(null)
  }

  const openDetail = async (session: ParkingSessionDto) => {
    try {
      const response = await apiClient.get<ApiResponse<ParkingSessionDto>>(`/ParkingSession/${session.sessionId}`)
      setSelectedSession(response.isSuccess && response.result ? response.result : session)
    } catch {
      setSelectedSession(session)
    }
  }

  const saveSession = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const optional = (value: string) => value.trim() || null
    const base = {
      driverUserId: optional(sessionForm.driverUserId), licensePlateIn: normalizeLicensePlate(sessionForm.licensePlateIn),
      entryImageUrl: optional(sessionForm.entryImageUrl), vehicleTypeId: sessionForm.vehicleTypeId,
      entryTime: sessionForm.entryTime ? vietnamDatetimeLocalToUtcIso(sessionForm.entryTime) : null,
      entryGateId: sessionForm.entryGateId, assignedSlotId: optional(sessionForm.assignedSlotId),
      actualSlotId: optional(sessionForm.actualSlotId), status: sessionForm.status,
    }
    const payload = editingSession ? {
      ...base, sessionId: editingSession.sessionId, licensePlateOut: optional(normalizeLicensePlate(sessionForm.licensePlateOut)),
      exitImageUrl: optional(sessionForm.exitImageUrl), entryTime: vietnamDatetimeLocalToUtcIso(sessionForm.entryTime),
      exitTime: sessionForm.exitTime ? vietnamDatetimeLocalToUtcIso(sessionForm.exitTime) : null,
      exitGateId: optional(sessionForm.exitGateId),
    } : {
      ...base, licensePlateOut: optional(normalizeLicensePlate(sessionForm.licensePlateOut)),
      exitImageUrl: optional(sessionForm.exitImageUrl),
      exitTime: sessionForm.exitTime ? vietnamDatetimeLocalToUtcIso(sessionForm.exitTime) : null,
      exitGateId: optional(sessionForm.exitGateId),
    }
    try {
      const response = editingSession
        ? await apiClient.put<ApiResponse<ParkingSessionDto>>('/ParkingSession', payload)
        : await apiClient.post<ApiResponse<ParkingSessionDto>>('/ParkingSession', payload)
      if (!response.isSuccess) throw new Error(response.message || 'Không thể lưu phiên gửi xe.')
      setEditingSession(undefined)
      await fetchSessions()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu phiên gửi xe.')
    } finally {
      setSaving(false)
    }
  }

  const deleteSession = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/ParkingSession/${deleteTarget.sessionId}`)
    if (!response.isSuccess) throw new Error(response.message || 'Không thể xóa phiên gửi xe.')
    setDeleteTarget(null)
    setSelectedSession(null)
    await fetchSessions()
  }

  const vehicleTypes = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.vehicleTypeName).filter(Boolean) as string[])).sort(),
    [sessions],
  )

  const statuses = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.status).filter(Boolean))).sort(),
    [sessions],
  )

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const today = formatUtcToVietnamDate(new Date(referenceTime).toISOString())
    const now = referenceTime

    return sessions
      .filter((session) => {
        if (statusFilter !== 'all' && session.status.toLowerCase() !== statusFilter) return false
        if (vehicleTypeFilter !== 'all' && session.vehicleTypeName !== vehicleTypeFilter) return false

        if (dateFilter !== 'all') {
          const entryTime = parseBackendUtcDate(session.entryTime).getTime()
          if (!Number.isFinite(entryTime)) return false
          if (dateFilter === 'today' && formatUtcToVietnamDate(session.entryTime) !== today) return false
          const maxAge = dateFilter === '7days' ? 7 * 86400000 : 30 * 86400000
          if (dateFilter !== 'today' && (entryTime > now || now - entryTime > maxAge)) return false
        }

        if (normalizedQuery) {
          const searchable = [
            session.licensePlateIn,
            session.licensePlateOut,
            session.driverFullName,
            session.vehicleTypeName,
            session.entryGateName,
            session.exitGateName,
            session.actualSlotCode,
            session.assignedSlotCode,
            session.sessionId,
          ].filter(Boolean).join(' ').toLowerCase()
          if (!searchable.includes(normalizedQuery)) return false
        }

        return true
      })
      .sort((left, right) => parseBackendUtcDate(right.entryTime).getTime() - parseBackendUtcDate(left.entryTime).getTime())
  }, [dateFilter, query, referenceTime, sessions, statusFilter, vehicleTypeFilter])

  const activeCount = sessions.filter((session) => session.status.toLowerCase() === 'active').length
  const completedCount = sessions.filter((session) => session.status.toLowerCase() === 'completed').length
  const reservationCount = sessions.filter((session) => session.reservationId).length
  const hasFilters = Boolean(query || statusFilter !== 'all' || dateFilter !== 'all' || vehicleTypeFilter !== 'all')

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setDateFilter('all')
    setVehicleTypeFilter('all')
  }

  return (
    <ManagerPageShell activeItem="sessions">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--green"><Activity size={24} aria-hidden /></span>
            <div><h2>Phiên gửi xe</h2><p>Theo dõi xe đang trong bãi và tra cứu toàn bộ lịch sử ra vào.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchSessions} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới
          </button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm phiên</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four" aria-label="Tổng quan phiên gửi xe">
          <article className="manager-summary-card"><span>Tổng phiên</span><strong>{sessions.length}</strong><small>Tất cả lịch sử ghi nhận</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Đang trong bãi</span><strong>{activeCount}</strong><small>Phiên chưa checkout</small></article>
          <article className="manager-summary-card manager-summary-card--accent"><span>Đã hoàn thành</span><strong>{completedCount}</strong><small>Phiên đã ra khỏi bãi</small></article>
          <article className="manager-summary-card manager-summary-card--purple"><span>Xe đặt trước</span><strong>{reservationCount}</strong><small>Phiên gắn đơn reservation</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-session-filters">
            <label className="manager-search-field" htmlFor="session-search">
              <Search size={18} aria-hidden />
              <input id="session-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm biển số, chủ xe, cổng hoặc mã phiên..." />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}
            </label>
            <div className="manager-session-filter-grid">
              <label><span>Trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option>{statuses.map((status) => <option key={status} value={status.toLowerCase()}>{statusLabel(status)}</option>)}</select></label>
              <label><span>Thời gian</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">Tất cả thời gian</option><option value="today">Hôm nay</option><option value="7days">7 ngày qua</option><option value="30days">30 ngày qua</option></select></label>
              <label><span>Loại xe</span><select value={vehicleTypeFilter} onChange={(event) => setVehicleTypeFilter(event.target.value)}><option value="all">Tất cả loại xe</option>{vehicleTypes.map((typeName) => <option key={typeName} value={typeName}>{typeName}</option>)}</select></label>
            </div>
            <div className="manager-session-filter-meta"><span>Hiển thị <strong>{filteredSessions.length}</strong>/{sessions.length} phiên</span>{hasFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={15} aria-hidden /> Xóa bộ lọc</button>}</div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && sessions.length === 0 ? (
            <div className="manager-empty-state">Đang tải phiên gửi xe...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="manager-empty-state"><CarFront size={34} aria-hidden /><strong>Không có phiên phù hợp</strong><span>{hasFilters ? 'Hãy thay đổi hoặc xóa bộ lọc.' : 'Chưa có phiên gửi xe nào được ghi nhận.'}</span></div>
          ) : (
            <div className="manager-session-list">
              {filteredSessions.map((session) => {
                const isActive = session.status.toLowerCase() === 'active'
                const coveringSubscription = subscriptionForSession(session, subscriptions)
                const slot = session.actualSlotCode || session.assignedSlotCode || 'Chưa xếp ô'
                return (
                  <article key={session.sessionId} className="manager-session-card">
                    <div className="manager-session-plate"><small>VIỆT NAM</small><strong>{session.licensePlateIn}</strong>{session.licensePlateOut && session.licensePlateOut !== session.licensePlateIn && <span>Ra: {session.licensePlateOut}</span>}</div>
                    <div className="manager-session-main">
                      <div className="manager-session-card-head">
                        <div><strong>{session.driverFullName || customerLabel(session)}</strong><span>{session.vehicleTypeName || 'Chưa rõ loại xe'} · {customerLabel(session)}</span></div>
                        <span className={`manager-session-status status-${session.status.toLowerCase()}`}><i />{statusLabel(session.status)}</span>
                      </div>
                      <div className="manager-session-meta">
                        <span><Clock3 size={15} aria-hidden /><span><small>Giờ vào</small><strong>{formatUtcToVietnamDateTime(session.entryTime)}</strong></span></span>
                        <span><MapPin size={15} aria-hidden /><span><small>Vị trí</small><strong>{slot}</strong></span></span>
                        <span><Activity size={15} aria-hidden /><span><small>Thời lượng</small><strong>{sessionDuration(session, referenceTime)}</strong></span></span>
                        <span><CreditCard size={15} aria-hidden /><span><small>{coveringSubscription ? 'Quyền lợi gói tháng' : isActive ? 'Phí tạm tính' : 'Phí gửi xe'}</small><strong>{coveringSubscription ? `Đã gồm trong ${coveringSubscription.packageName || 'gói tháng'} · 0 ₫` : isActive ? feePreviews[session.sessionId]?.isCoveredBySubscription ? 'Đã gồm trong gói tháng' : feePreviews[session.sessionId] ? `${formatCurrency(feePreviews[session.sessionId].amount)}${(feePreviews[session.sessionId].depositAmount ?? 0) > 0 ? ` · Đã trừ ${formatCurrency(feePreviews[session.sessionId].depositAmount ?? 0)} tiền cọc` : ''}` : feePreviewErrors[session.sessionId] || 'Đang tính phí...' : session.paymentAmount != null ? formatCurrency(session.paymentAmount) : 'Chưa có thanh toán'}</strong></span></span>
                      </div>
                    </div>
                    <div className="manager-session-side">
                      <span className={isActive ? 'active' : ''}>{isActive ? 'Xe vẫn đang trong bãi' : session.exitTime ? `Ra lúc ${formatUtcToVietnamDateTime(session.exitTime)}` : statusLabel(session.status)}</span>
                      <div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => void openDetail(session)}><Eye size={16} aria-hidden /> Xem</button><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(session)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(session)}><Trash2 size={15} /> Xóa</button></div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {editingSession !== undefined && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setEditingSession(undefined)}>
          <div className="modal-panel manager-form-modal manager-session-form-modal" role="dialog" aria-modal="true">
            <div className="manager-modal-header">
              <div><h3 className="modal-title">{editingSession ? 'Sửa phiên gửi xe' : 'Thêm phiên gửi xe'}</h3><p>{editingSession ? 'Cập nhật thông tin vận hành của phiên.' : 'Nhập thông tin xe vào bãi để tạo phiên mới.'}</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setEditingSession(undefined)}><X size={20} /></button>
            </div>
            <form onSubmit={saveSession} className="manager-session-form">
              <section className="manager-session-form-section">
                <div className="manager-session-form-section-title"><CarFront size={18} /><div><h4>Phương tiện</h4><p>Thông tin nhận diện và trạng thái hiện tại.</p></div></div>
                <div className="form-grid-2">
                  <div className="form-field"><label>Biển số vào *</label><input required autoFocus placeholder="Ví dụ: 60A99999" value={sessionForm.licensePlateIn} onChange={(e) => setSessionForm({...sessionForm, licensePlateIn: normalizeLicensePlate(e.target.value)})} /></div>
                  <div className="form-field"><label>Loại phương tiện *</label><select required value={sessionForm.vehicleTypeId} onChange={(e) => setSessionForm({...sessionForm, vehicleTypeId: e.target.value})}><option value="">Chọn loại xe</option>{vehicleOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  <div className="form-field"><label>Trạng thái *</label><select value={sessionForm.status} onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}><option value="Active">Đang trong bãi</option><option value="Completed">Đã hoàn thành</option><option value="Exception">Có sự cố</option></select></div>
                  <div className="form-field"><label>Biển số ra</label><input placeholder="Nếu khác biển số vào" value={sessionForm.licensePlateOut} onChange={(e) => setSessionForm({...sessionForm, licensePlateOut: normalizeLicensePlate(e.target.value)})} /></div>
                </div>
              </section>

              <section className="manager-session-form-section">
                <div className="manager-session-form-section-title"><MapPin size={18} /><div><h4>Cổng và vị trí</h4><p>Chọn đúng luồng di chuyển và chỗ đỗ của xe.</p></div></div>
                <div className="form-grid-2">
                  <div className="form-field"><label>Cổng vào *</label><select required value={sessionForm.entryGateId} onChange={(e) => setSessionForm({...sessionForm, entryGateId: e.target.value})}><option value="">Chọn cổng vào</option>{gateOptions.filter((item) => !item.type || item.type.toLowerCase() === 'entry').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  <div className="form-field"><label>Cổng ra{sessionForm.status === 'Completed' ? ' *' : ''}</label><select required={sessionForm.status === 'Completed'} value={sessionForm.exitGateId} onChange={(e) => setSessionForm({...sessionForm, exitGateId: e.target.value})}><option value="">Chưa ghi nhận</option>{gateOptions.filter((item) => !item.type || item.type.toLowerCase() === 'exit').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                  <div className="form-field"><label>Slot được xếp</label><select value={sessionForm.assignedSlotId} onChange={(e) => setSessionForm({...sessionForm, assignedSlotId: e.target.value})}><option value="">Chưa xếp</option>{slotOptions.map((item) => <option key={item.id} value={item.id}>{item.label}{item.type ? ` · ${item.type}` : ''}</option>)}</select></div>
                  <div className="form-field"><label>Slot thực tế</label><select value={sessionForm.actualSlotId} onChange={(e) => setSessionForm({...sessionForm, actualSlotId: e.target.value})}><option value="">Chưa ghi nhận</option>{slotOptions.map((item) => <option key={item.id} value={item.id}>{item.label}{item.type ? ` · ${item.type}` : ''}</option>)}</select></div>
                </div>
              </section>

              <section className="manager-session-form-section">
                <div className="manager-session-form-section-title"><Clock3 size={18} /><div><h4>Thời gian</h4><p>Kiểm tra thời điểm vào và ra của xe.</p></div></div>
                <div className="form-grid-2">
                  <div className="form-field"><label>Thời gian vào *</label><input type="datetime-local" required value={sessionForm.entryTime} onChange={(e) => setSessionForm({...sessionForm, entryTime: e.target.value})} /></div>
                  <div className="form-field"><label>Thời gian ra{sessionForm.status === 'Completed' ? ' *' : ''}</label><input type="datetime-local" required={sessionForm.status === 'Completed'} value={sessionForm.exitTime} onChange={(e) => setSessionForm({...sessionForm, exitTime: e.target.value})} /></div>
                </div>
              </section>

              <details className="manager-session-advanced">
                <summary><span><UserRound size={17} /> Thông tin nâng cao</span><small>UUID người lái và đường dẫn ảnh</small><ChevronDown size={17} /></summary>
                <div className="form-grid-2">
                  <div className="form-field form-field--full"><label>Mã người lái</label><input placeholder="UUID — không bắt buộc" value={sessionForm.driverUserId} onChange={(e) => setSessionForm({...sessionForm, driverUserId: e.target.value})} /></div>
                  <div className="form-field"><label>Đường dẫn ảnh vào</label><input type="url" placeholder="https://..." value={sessionForm.entryImageUrl} onChange={(e) => setSessionForm({...sessionForm, entryImageUrl: e.target.value})} /></div>
                  <div className="form-field"><label>Đường dẫn ảnh ra</label><input type="url" placeholder="https://..." value={sessionForm.exitImageUrl} onChange={(e) => setSessionForm({...sessionForm, exitImageUrl: e.target.value})} /></div>
                </div>
              </details>

              {error && <div className="manager-inline-error">{error}</div>}
              <div className="form-actions manager-session-form-actions"><button type="button" className="btn btn-ghost" onClick={() => setEditingSession(undefined)}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : editingSession ? 'Lưu thay đổi' : 'Tạo phiên'}</button></div>
            </form>
          </div>
        </div>
      )}

      {selectedSession && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedSession(null)}>
          <div className="modal-panel manager-session-modal" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
            <div className="manager-modal-header"><div><h3 id="session-modal-title" className="modal-title">Chi tiết phiên gửi xe</h3><p>Toàn bộ thông tin phiên được trả về từ hệ thống.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setSelectedSession(null)}><X size={20} aria-hidden /></button></div>
            <div className="manager-session-modal-hero"><div className="manager-session-plate"><small>VIỆT NAM</small><strong>{selectedSession.licensePlateIn}</strong>{selectedSession.licensePlateOut && selectedSession.licensePlateOut !== selectedSession.licensePlateIn && <span>Ra: {selectedSession.licensePlateOut}</span>}</div><div><strong>{selectedSession.driverFullName || customerLabel(selectedSession)}</strong><span>{selectedSession.vehicleTypeName || 'Chưa rõ loại xe'} · {customerLabel(selectedSession)}</span><span className={`manager-session-status status-${selectedSession.status.toLowerCase()}`}><i />{statusLabel(selectedSession.status)}</span></div></div>

            <section className="manager-session-detail-section">
              <div className="manager-session-section-heading"><Hash size={17} aria-hidden /><div><h4>Thông tin định danh</h4><p>Các mã liên kết của phiên trong backend.</p></div></div>
              <div className="manager-session-detail-grid manager-session-detail-grid--ids">
                <div><Fingerprint size={17} aria-hidden /><span>Mã phiên</span><code>{selectedSession.sessionId}</code></div>
                <div><QrCode size={17} aria-hidden /><span>Mã đặt chỗ</span><code>{selectedSession.reservationId || 'Không có'}</code></div>
                <div><UserRound size={17} aria-hidden /><span>Mã người lái</span><code>{selectedSession.driverUserId || 'Khách vãng lai'}</code></div>
                <div><CarFront size={17} aria-hidden /><span>Mã loại phương tiện</span><code>{selectedSession.vehicleTypeId || '—'}</code></div>
              </div>
            </section>

            <section className="manager-session-detail-section">
              <div className="manager-session-section-heading"><CalendarDays size={17} aria-hidden /><div><h4>Thời gian và biển số</h4><p>Thông tin check-in, checkout và thời lượng gửi xe.</p></div></div>
              <div className="manager-session-detail-grid">
                <div><CalendarDays size={17} aria-hidden /><span>Thời gian vào</span><strong>{formatUtcToVietnamDateTime(selectedSession.entryTime)}</strong></div>
                <div><CalendarDays size={17} aria-hidden /><span>Thời gian ra</span><strong>{selectedSession.exitTime ? formatUtcToVietnamDateTime(selectedSession.exitTime) : 'Chưa checkout'}</strong></div>
                <div><Clock3 size={17} aria-hidden /><span>Tổng thời lượng</span><strong>{sessionDuration(selectedSession, referenceTime)}</strong></div>
                <div><CarFront size={17} aria-hidden /><span>Biển số vào → ra</span><strong>{selectedSession.licensePlateIn || '—'} → {selectedSession.licensePlateOut || 'Chưa ghi nhận'}</strong></div>
              </div>
            </section>

            <section className="manager-session-detail-section">
              <div className="manager-session-section-heading"><CreditCard size={17} aria-hidden /><div><h4>Thanh toán</h4><p>Khoản phí checkout được liên kết với phiên gửi xe.</p></div></div>
              <div className="manager-session-detail-grid">
                <div><CreditCard size={17} aria-hidden /><span>{selectedSubscription ? 'Quyền lợi gói tháng' : selectedSession.status.toLowerCase() === 'active' ? 'Phí tạm tính hiện tại' : 'Phí gửi xe'}</span><strong>{selectedSubscription ? `Đã gồm trong ${selectedSubscription.packageName || 'gói tháng'} · 0 ₫` : selectedSession.status.toLowerCase() === 'active' ? feePreviews[selectedSession.sessionId]?.isCoveredBySubscription ? 'Đã gồm trong gói tháng · 0 ₫' : feePreviews[selectedSession.sessionId] ? `${formatCurrency(feePreviews[selectedSession.sessionId].amount)}${(feePreviews[selectedSession.sessionId].depositAmount ?? 0) > 0 ? ` · Đã trừ ${formatCurrency(feePreviews[selectedSession.sessionId].depositAmount ?? 0)} tiền cọc` : ''}` : feePreviewErrors[selectedSession.sessionId] || 'Đang tính phí...' : selectedSession.paymentAmount != null ? formatCurrency(selectedSession.paymentAmount) : 'Chưa có thanh toán'}</strong></div>
                {!selectedSubscription && feePreviews[selectedSession.sessionId] && !feePreviews[selectedSession.sessionId].isCoveredBySubscription && (
                  <>
                    <div><Clock3 size={17} aria-hidden /><span>Số giờ tính phí</span><strong>{feePreviews[selectedSession.sessionId].billedHours} giờ</strong></div>
                    <div><CreditCard size={17} aria-hidden /><span>Chính sách áp dụng</span><strong>{formatCurrency(feePreviews[selectedSession.sessionId].basePrice ?? 0)} / {feePreviews[selectedSession.sessionId].baseHours ?? 0} giờ · thêm {formatCurrency(feePreviews[selectedSession.sessionId].extraHourPrice ?? 0)}/giờ{feePreviews[selectedSession.sessionId].hasNightSurcharge ? ` · ${feePreviews[selectedSession.sessionId].nightSurchargeCount} đêm × ${formatCurrency(feePreviews[selectedSession.sessionId].nightSurcharge ?? 0)}` : ''}</strong></div>
                  </>
                )}
                <div><Activity size={17} aria-hidden /><span>Trạng thái</span><strong>{selectedSubscription ? 'Không cần thanh toán riêng' : paymentStatusLabel(selectedSession.paymentStatus)}</strong></div>
                <div><CreditCard size={17} aria-hidden /><span>Phương thức</span><strong>{selectedSubscription ? 'Gói tháng' : selectedSession.paymentMethod || 'Chưa ghi nhận'}</strong></div>
                <div><CalendarDays size={17} aria-hidden /><span>Thời gian thanh toán</span><strong>{selectedSubscription ? 'Đã thanh toán khi đăng ký gói' : selectedSession.paymentTime ? formatUtcToVietnamDateTime(selectedSession.paymentTime) : 'Chưa ghi nhận'}</strong></div>
              </div>
            </section>

            <section className="manager-session-detail-section">
              <div className="manager-session-section-heading"><MapPin size={17} aria-hidden /><div><h4>Cổng và vị trí đỗ</h4><p>Đối chiếu vị trí được phân bổ với dữ liệu vận hành thực tế.</p></div></div>
              <div className="manager-session-detail-grid manager-session-detail-grid--route">
                <div><MapPin size={17} aria-hidden /><span>Cổng vào</span><strong>{selectedSession.entryGateName || 'Chưa xác định'}</strong><code>{selectedSession.entryGateId}</code></div>
                <div><MapPin size={17} aria-hidden /><span>Cổng ra</span><strong>{selectedSession.exitGateName || 'Chưa checkout'}</strong><code>{selectedSession.exitGateId || 'Chưa có'}</code></div>
                <div><ParkingSquare size={17} aria-hidden /><span>Slot được xếp</span><strong>{selectedSession.assignedSlotCode || 'Chưa xếp slot'}</strong><code>{selectedSession.assignedSlotId || 'Chưa có'}</code></div>
                <div><ParkingSquare size={17} aria-hidden /><span>Slot thực tế</span><strong>{selectedSession.actualSlotCode || 'Chưa ghi nhận'}</strong><code>{selectedSession.actualSlotId || 'Chưa có'}</code></div>
              </div>
            </section>
            <section className="manager-session-detail-section">
              <div className="manager-session-section-heading"><ImageIcon size={17} aria-hidden /><div><h4>Ảnh phương tiện vào / ra</h4><p>Ảnh được nhân viên ghi nhận tại thời điểm check-in và checkout.</p></div></div>
              <div className="manager-session-image-grid">
                <article>
                  <div>{selectedSession.entryImageUrl ? <a href={selectedSession.entryImageUrl} target="_blank" rel="noreferrer" aria-label="Mở ảnh xe lúc vào"><img src={selectedSession.entryImageUrl} alt={`Xe ${selectedSession.licensePlateIn} lúc vào`} loading="lazy" /></a> : <span className="manager-session-image-empty"><ImageIcon size={28} aria-hidden />Chưa có ảnh lúc vào</span>}</div>
                  <strong>Ảnh lúc vào</strong><small>{formatUtcToVietnamDateTime(selectedSession.entryTime)}</small>
                </article>
                <article>
                  <div>{selectedSession.exitImageUrl ? <a href={selectedSession.exitImageUrl} target="_blank" rel="noreferrer" aria-label="Mở ảnh xe lúc ra"><img src={selectedSession.exitImageUrl} alt={`Xe ${selectedSession.licensePlateOut || selectedSession.licensePlateIn} lúc ra`} loading="lazy" /></a> : <span className="manager-session-image-empty"><ImageIcon size={28} aria-hidden />Chưa có ảnh lúc ra</span>}</div>
                  <strong>Ảnh lúc ra</strong><small>{selectedSession.exitTime ? formatUtcToVietnamDateTime(selectedSession.exitTime) : 'Xe chưa checkout'}</small>
                </article>
              </div>
            </section>
            {selectedSession.ticket && <div className="manager-session-ticket"><QrCode size={21} aria-hidden /><div><strong>Mã vé phiên đang hoạt động</strong><code>{selectedSession.ticket.qrPayload}</code></div><img src={selectedSession.ticket.qrCodeDataUrl} alt={`QR vé xe ${selectedSession.licensePlateIn}`} /></div>}
            <div className="form-actions manager-session-modal-actions">
              <button
                type="button"
                className="btn manager-session-modal-edit"
                onClick={() => {
                  const session = selectedSession
                  setSelectedSession(null)
                  openEdit(session)
                }}
              >
                <Pencil size={16} aria-hidden /> Sửa phiên
              </button>
              <button
                type="button"
                className="btn manager-session-modal-delete"
                onClick={() => {
                  const session = selectedSession
                  setSelectedSession(null)
                  setDeleteTarget(session)
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa phiên
              </button>
            </div>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa phiên gửi xe?" description={<>Bạn có chắc muốn xóa phiên của xe <strong>{deleteTarget?.licensePlateIn}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.licensePlateIn} targetMeta={deleteTarget ? `${formatUtcToVietnamDateTime(deleteTarget.entryTime)} · ${statusLabel(deleteTarget.status)}` : undefined} targetIcon={<ParkingSquare size={18} aria-hidden />} note="Ảnh vào/ra, dữ liệu vị trí và lịch sử liên quan của phiên có thể bị ảnh hưởng." errorFallback="Không thể xóa phiên gửi xe." onCancel={() => setDeleteTarget(null)} onConfirm={deleteSession} />
    </ManagerPageShell>
  )
}
