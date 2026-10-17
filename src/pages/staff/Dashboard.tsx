import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CarFront,
  Clock3,
  RefreshCw,
} from 'lucide-react'
import StaffPageShell from '../../components/StaffPageShell'
import { navigateStaffNav, STAFF_NAV } from '../../config/staffNav'
import {
  incidentReportApi,
  parkingSessionApi,
  reservationApi,
  type IncidentReportDto,
  type ParkingSessionDto,
  type ReservationDto,
} from '../../utils/apiServices'
import { formatUtcToVietnamDateTime, parseBackendUtcDate } from '../../utils/dateTime'

const ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'modified']

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [reservations, setReservations] = useState<ReservationDto[]>([])
  const [sessions, setSessions] = useState<ParkingSessionDto[]>([])
  const [incidents, setIncidents] = useState<IncidentReportDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    const [reservationResult, sessionResult, incidentResult] = await Promise.allSettled([
      reservationApi.getAll(),
      parkingSessionApi.getAll(),
      incidentReportApi.getAll(),
    ])

    if (reservationResult.status === 'fulfilled' && reservationResult.value.isSuccess) {
      setReservations(reservationResult.value.result ?? [])
    } else {
      setReservations([])
    }
    if (sessionResult.status === 'fulfilled' && sessionResult.value.isSuccess) {
      setSessions(sessionResult.value.result ?? [])
    } else {
      setSessions([])
    }
    if (incidentResult.status === 'fulfilled' && incidentResult.value.isSuccess) {
      setIncidents(incidentResult.value.result ?? [])
    } else {
      setIncidents([])
    }

    if (reservationResult.status === 'rejected' && sessionResult.status === 'rejected') {
      setError('Không thể tải dữ liệu vận hành. Vui lòng kiểm tra kết nối backend.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => void loadDashboard())
  }, [loadDashboard])

  const activeSessions = useMemo(
    () => sessions
      .filter((item) => item.status?.toLowerCase() === 'active')
      .sort((left, right) => parseBackendUtcDate(right.entryTime).getTime() - parseBackendUtcDate(left.entryTime).getTime()),
    [sessions],
  )
  const upcomingReservations = useMemo(
    () => reservations
      .filter((item) => ACTIVE_RESERVATION_STATUSES.includes(item.status?.toLowerCase()))
      .sort((left, right) => parseBackendUtcDate(left.expectedEntryTime).getTime() - parseBackendUtcDate(right.expectedEntryTime).getTime()),
    [reservations],
  )
  const openIncidents = incidents.filter((item) => item.status?.toLowerCase() !== 'resolved' && item.status?.toLowerCase() !== 'cancelled')
  const completedToday = sessions.filter((item) => item.status?.toLowerCase() === 'completed').length

  return (
    <StaffPageShell activeItem="dashboard">
      <div className="staff-content-wrapper staff-manager-page manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><Clock3 size={24} aria-hidden /></span>
            <div><h2>Tổng quan vận hành</h2><p>Theo dõi nhanh xe vào, xe ra, lịch đặt trước và sự cố trong ca trực.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={loadDashboard} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four">
          <article className="manager-summary-card manager-summary-card--green"><span>Xe đang trong bãi</span><strong>{activeSessions.length}</strong><small>Phiên chưa checkout</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Đặt chỗ chờ đến</span><strong>{upcomingReservations.length}</strong><small>Chờ thanh toán hoặc đã xác nhận</small></article>
          <article className="manager-summary-card manager-summary-card--accent"><span>Phiên hoàn tất</span><strong>{completedToday}</strong><small>Tổng phiên đã checkout</small></article>
          <article className="manager-summary-card manager-summary-card--red"><span>Sự cố đang mở</span><strong>{openIncidents.length}</strong><small>Cần tiếp nhận hoặc xử lý</small></article>
        </section>

        {error && <div className="manager-inline-error" role="alert">{error}</div>}

        <section className="staff-operation-grid">
          <article className="card-panel staff-operation-panel">
            <div className="staff-operation-panel-head"><div><CalendarCheck2 size={20} aria-hidden /><span><strong>Đặt chỗ sắp đến</strong><small>{upcomingReservations.length} lịch đang hoạt động</small></span></div><button type="button" className="btn btn-outline btn-sm" onClick={() => navigateStaffNav('reservations', navigate)}>Xem tất cả</button></div>
            <div className="staff-dashboard-list">
              {upcomingReservations.slice(0, 3).map((reservation) => <div key={reservation.reservationId}><span><strong>{reservation.userFullName || 'Khách hàng'}</strong><small>{reservation.vehicleTypeName || 'Chưa rõ loại xe'}</small></span><time>{formatUtcToVietnamDateTime(reservation.expectedEntryTime)}</time></div>)}
              {!loading && upcomingReservations.length === 0 && <div className="staff-dashboard-list-empty">Không có lịch đặt trước đang chờ.</div>}
            </div>
          </article>

          <article className="card-panel staff-operation-panel">
            <div className="staff-operation-panel-head"><div><CarFront size={20} aria-hidden /><span><strong>Xe đang trong bãi</strong><small>{activeSessions.length} phiên hoạt động</small></span></div><button type="button" className="btn btn-outline btn-sm" onClick={() => navigateStaffNav('active-vehicles', navigate)}>Xem tất cả</button></div>
            <div className="staff-dashboard-list">
              {activeSessions.slice(0, 3).map((session) => <div key={session.sessionId}><span><strong>{session.licensePlateIn}</strong><small>{session.vehicleTypeName || 'Chưa rõ loại xe'} · {session.actualSlotCode || session.assignedSlotCode || 'Chưa xếp ô'}</small></span><time>{formatUtcToVietnamDateTime(session.entryTime)}</time></div>)}
              {!loading && activeSessions.length === 0 && <div className="staff-dashboard-list-empty">Hiện không có xe trong bãi.</div>}
            </div>
          </article>
        </section>

        <section className="card-panel staff-quick-panel">
          <div className="staff-quick-panel-head"><div><h3>Thao tác nhanh</h3><p>Truy cập các nghiệp vụ staff được phân quyền.</p></div>{openIncidents.length > 0 && <span><AlertTriangle size={15} aria-hidden /> {openIncidents.length} sự cố cần xử lý</span>}</div>
          <div className="manager-dashboard-grid staff-dashboard-action-grid">
            {STAFF_NAV.filter((item) => item.id !== 'dashboard').map((item) => (
              <button key={item.id} type="button" className="manager-dashboard-card" onClick={() => navigateStaffNav(item.id, navigate)}>
                <div className="menu-card-icon">{item.icon}</div><h3>{item.label}</h3><p>{item.desc}</p><span className="manager-dashboard-card-link">Mở nghiệp vụ <ArrowRight size={15} aria-hidden /></span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </StaffPageShell>
  )
}
