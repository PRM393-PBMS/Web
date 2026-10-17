import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarCheck2,
  CalendarDays,
  CarFront,
  Clock3,
  Eye,
  Pencil,
  QrCode,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import { formatUtcToVietnamDate, formatUtcToVietnamDateTime, parseBackendUtcDate } from '../../utils/dateTime'
import { reservationApi, type ReservationDto } from '../../utils/apiServices'

type DateFilter = 'all' | 'today' | '7days' | '30days'

const RESERVATION_STATUSES = [
  'Pending',
  'Confirmed',
  'Modified',
  'CheckedIn',
  'Completed',
  'Cancelled',
  'NoShow',
] as const

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ thanh toán',
  confirmed: 'Đã xác nhận',
  modified: 'Đã đổi giờ',
  checkedin: 'Đã check-in',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  noshow: 'Không đến',
}

function normalizedStatus(status?: string) {
  return (status || '').replace(/[\s_-]/g, '').toLowerCase()
}

function statusLabel(status?: string) {
  return STATUS_LABELS[normalizedStatus(status)] ?? status ?? 'Không rõ'
}

function isOpenReservation(status?: string) {
  return ['pending', 'confirmed', 'modified'].includes(normalizedStatus(status))
}

export default function ManagerReservations() {
  const [reservations, setReservations] = useState<ReservationDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [referenceTime, setReferenceTime] = useState(() => Date.now())
  const [selected, setSelected] = useState<ReservationDto | null>(null)
  const [statusTarget, setStatusTarget] = useState<ReservationDto | null>(null)
  const [nextStatus, setNextStatus] = useState('Confirmed')

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await reservationApi.getAll()
      if (!response.isSuccess) throw new Error(response.message || 'Không thể tải danh sách đặt chỗ.')
      setReservations(Array.isArray(response.result) ? response.result : [])
      setReferenceTime(Date.now())
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối đến hệ thống.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void fetchReservations())
  }, [fetchReservations])

  const filteredReservations = useMemo(() => {
    const term = query.trim().toLowerCase()
    const today = formatUtcToVietnamDate(new Date(referenceTime).toISOString())

    return reservations
      .filter((reservation) => {
        const status = normalizedStatus(reservation.status)
        if (statusFilter !== 'all' && status !== statusFilter) return false

        if (dateFilter !== 'all') {
          const entryTime = parseBackendUtcDate(reservation.expectedEntryTime).getTime()
          if (!Number.isFinite(entryTime)) return false
          if (dateFilter === 'today') {
            if (formatUtcToVietnamDate(reservation.expectedEntryTime) !== today) return false
          } else {
            const maxAge = dateFilter === '7days' ? 7 * 86400000 : 30 * 86400000
            if (entryTime > referenceTime || referenceTime - entryTime > maxAge) return false
          }
        }

        if (term) {
          const searchable = [
            reservation.userFullName,
            reservation.user?.fullName,
            reservation.user?.email,
            reservation.vehicleTypeName,
            reservation.vehicleType?.typeName,
            reservation.reservationId,
          ].filter(Boolean).join(' ').toLowerCase()
          if (!searchable.includes(term)) return false
        }
        return true
      })
      .sort((left, right) => {
        const leftOpen = isOpenReservation(left.status)
        const rightOpen = isOpenReservation(right.status)
        if (leftOpen !== rightOpen) return leftOpen ? -1 : 1
        const leftTime = parseBackendUtcDate(left.expectedEntryTime).getTime()
        const rightTime = parseBackendUtcDate(right.expectedEntryTime).getTime()
        return leftOpen ? leftTime - rightTime : rightTime - leftTime
      })
  }, [dateFilter, query, referenceTime, reservations, statusFilter])

  const openDetail = async (reservation: ReservationDto) => {
    setActionError('')
    try {
      const response = await reservationApi.getById(reservation.reservationId)
      setSelected(response.isSuccess && response.result ? response.result : reservation)
    } catch {
      setSelected(reservation)
    }
  }

  const openStatusModal = (reservation: ReservationDto) => {
    setStatusTarget(reservation)
    setNextStatus(RESERVATION_STATUSES.find((status) => normalizedStatus(status) === normalizedStatus(reservation.status)) || 'Confirmed')
    setActionError('')
    setSelected(null)
  }

  const updateStatus = async () => {
    if (!statusTarget) return
    setSaving(true)
    setActionError('')
    try {
      const response = await reservationApi.updateStatus(statusTarget.reservationId, nextStatus)
      if (!response.isSuccess) throw new Error(response.message || 'Không thể cập nhật trạng thái đặt chỗ.')
      setStatusTarget(null)
      await fetchReservations()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật trạng thái đặt chỗ.')
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = reservations.filter((item) => normalizedStatus(item.status) === 'pending').length
  const confirmedCount = reservations.filter((item) => ['confirmed', 'modified'].includes(normalizedStatus(item.status))).length
  const checkedInCount = reservations.filter((item) => normalizedStatus(item.status) === 'checkedin').length
  const hasFilters = Boolean(query || statusFilter !== 'all' || dateFilter !== 'all')

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setDateFilter('all')
  }

  return (
    <ManagerPageShell activeItem="reservations">
      <div className="staff-content-wrapper manager-resource-page manager-reservation-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--purple"><CalendarCheck2 size={24} aria-hidden /></span>
            <div><h2>Quản lý đặt chỗ</h2><p>Theo dõi lịch hẹn vào bãi và cập nhật trạng thái đặt chỗ của khách hàng.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchReservations} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four" aria-label="Tổng quan đặt chỗ">
          <article className="manager-summary-card"><span>Tổng đặt chỗ</span><strong>{reservations.length}</strong><small>Tất cả lịch hẹn đã ghi nhận</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Chờ thanh toán</span><strong>{pendingCount}</strong><small>Chưa hoàn tất tiền cọc</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Đã xác nhận</span><strong>{confirmedCount}</strong><small>Sẵn sàng đón xe</small></article>
          <article className="manager-summary-card manager-summary-card--accent"><span>Đã check-in</span><strong>{checkedInCount}</strong><small>Khách đã vào bãi</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-session-filters">
            <label className="manager-search-field" htmlFor="reservation-search"><Search size={18} aria-hidden /><input id="reservation-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm khách hàng, email, loại xe hoặc mã đặt chỗ..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-session-filter-grid manager-reservation-filter-grid">
              <label><span>Trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option>{RESERVATION_STATUSES.map((status) => <option key={status} value={normalizedStatus(status)}>{statusLabel(status)}</option>)}</select></label>
              <label><span>Thời gian dự kiến</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">Tất cả thời gian</option><option value="today">Hôm nay</option><option value="7days">7 ngày qua</option><option value="30days">30 ngày qua</option></select></label>
            </div>
            <div className="manager-session-filter-meta"><span>Hiển thị <strong>{filteredReservations.length}</strong>/{reservations.length} đặt chỗ</span>{hasFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={15} aria-hidden /> Xóa bộ lọc</button>}</div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && reservations.length === 0 ? (
            <div className="manager-empty-state">Đang tải danh sách đặt chỗ...</div>
          ) : filteredReservations.length === 0 ? (
            <div className="manager-empty-state"><CalendarCheck2 size={34} aria-hidden /><strong>Không có đặt chỗ phù hợp</strong><span>{hasFilters ? 'Hãy thay đổi hoặc xóa bộ lọc.' : 'Chưa có đặt chỗ nào được ghi nhận.'}</span></div>
          ) : (
            <div className="table-wrap manager-table-wrap">
              <table className="ui-table manager-resource-table manager-reservation-table">
                <thead><tr><th>Khách hàng</th><th>Loại xe</th><th>Thời gian dự kiến đến</th><th>Thời điểm đặt chỗ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>{filteredReservations.map((reservation) => (
                  <tr key={reservation.reservationId}>
                    <td><strong>{reservation.userFullName || reservation.user?.fullName || 'Chưa có tên'}</strong>{reservation.user?.email && <small>{reservation.user.email}</small>}</td>
                    <td><span className="manager-reservation-vehicle"><CarFront size={16} aria-hidden />{reservation.vehicleTypeName || reservation.vehicleType?.typeName || 'Chưa rõ'}</span></td>
                    <td><strong>{formatUtcToVietnamDateTime(reservation.expectedEntryTime)}</strong></td>
                    <td>{reservation.createdAt ? formatUtcToVietnamDateTime(reservation.createdAt) : 'Chưa ghi nhận'}</td>
                    <td><span className={`manager-session-status status-${normalizedStatus(reservation.status)}`}><i />{statusLabel(reservation.status)}</span></td>
                    <td><div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => void openDetail(reservation)}><Eye size={15} aria-hidden /> Xem</button><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openStatusModal(reservation)}><Pencil size={15} aria-hidden /> Trạng thái</button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="modal-panel manager-reservation-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-detail-title">
            <div className="manager-modal-header"><div><h3 id="reservation-detail-title" className="modal-title">Chi tiết đặt chỗ</h3><p>Thông tin lịch hẹn và vé QR của khách hàng.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setSelected(null)}><X size={20} aria-hidden /></button></div>
            <div className="manager-reservation-hero"><span><CalendarCheck2 size={25} aria-hidden /></span><div><small>Thời gian dự kiến đến</small><strong>{formatUtcToVietnamDateTime(selected.expectedEntryTime)}</strong><span className={`manager-session-status status-${normalizedStatus(selected.status)}`}><i />{statusLabel(selected.status)}</span></div></div>
            <div className="manager-reservation-detail-grid">
              <div><UserRound size={17} aria-hidden /><span>Khách hàng</span><strong>{selected.userFullName || selected.user?.fullName || 'Chưa có tên'}</strong></div>
              <div><CarFront size={17} aria-hidden /><span>Loại xe</span><strong>{selected.vehicleTypeName || selected.vehicleType?.typeName || 'Chưa rõ'}</strong></div>
              <div><CalendarDays size={17} aria-hidden /><span>Thời điểm đặt chỗ</span><strong>{selected.createdAt ? formatUtcToVietnamDateTime(selected.createdAt) : 'Chưa ghi nhận'}</strong></div>
              <div><Clock3 size={17} aria-hidden /><span>Trạng thái hiện tại</span><strong>{statusLabel(selected.status)}</strong></div>
              <div className="manager-reservation-id-field"><QrCode size={17} aria-hidden /><span>Mã đặt chỗ</span><code>{selected.reservationId}</code></div>
            </div>
            {selected.ticket?.qrCodeDataUrl && <div className="manager-reservation-ticket"><img src={selected.ticket.qrCodeDataUrl} alt={`Mã QR đặt chỗ ${selected.reservationId}`} /><div><strong>Vé QR đặt chỗ</strong><span>Khách xuất trình mã này khi đến cổng vào.</span><code>{selected.ticket.qrPayload || selected.reservationId}</code></div></div>}
            <div className="form-actions"><button type="button" className="btn btn-outline manager-edit-button" onClick={() => openStatusModal(selected)}><Pencil size={16} aria-hidden /> Cập nhật trạng thái</button></div>
          </div>
        </div>
      )}

      {statusTarget && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setStatusTarget(null)}>
          <div className="modal-panel manager-form-modal manager-reservation-status-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-status-title">
            <div className="manager-modal-header"><div><h3 id="reservation-status-title" className="modal-title">Cập nhật trạng thái đặt chỗ</h3><p>{statusTarget.userFullName || statusTarget.user?.fullName || 'Khách hàng'} · {formatUtcToVietnamDateTime(statusTarget.expectedEntryTime)}</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setStatusTarget(null)} disabled={saving}><X size={20} aria-hidden /></button></div>
            <div className="form-field"><label htmlFor="reservation-status">Trạng thái mới *</label><select id="reservation-status" autoFocus value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{RESERVATION_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div>
            {actionError && <div className="manager-inline-error" role="alert">{actionError}</div>}
            <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setStatusTarget(null)} disabled={saving}>Hủy</button><button type="button" className="btn btn-primary" onClick={() => void updateStatus()} disabled={saving || normalizedStatus(nextStatus) === normalizedStatus(statusTarget.status)}>{saving ? 'Đang cập nhật...' : 'Lưu trạng thái'}</button></div>
          </div>
        </div>
      )}
    </ManagerPageShell>
  )
}
