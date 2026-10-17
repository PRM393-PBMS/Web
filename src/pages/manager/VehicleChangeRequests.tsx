import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Clock3,
  Loader2,
  Package,
  RefreshCw,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import {
  formatUtcToVietnamDate,
  formatUtcToVietnamDateTime,
  parseBackendUtcDate,
} from '../../utils/dateTime'
import type { ApiResponse } from '../../utils/apiServices'

interface VehicleChangeRequestDto {
  requestId: string
  subscriptionId: string
  oldLicensePlate?: string
  newLicensePlate?: string
  reason?: string
  rejectionReason?: string
  status?: string
  createdAt?: string
  processedAt?: string
  userFullName?: string
  packageName?: string
  handledByFullName?: string
}

type DateFilter = 'all' | 'today' | '7days' | '30days'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
}

function statusLabel(status?: string) {
  const normalized = status?.toLowerCase() ?? ''
  return STATUS_LABELS[normalized] ?? status ?? 'Không rõ'
}

export default function ManagerVehicleChangeRequests() {
  const [requests, setRequests] = useState<VehicleChangeRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [activeModal, setActiveModal] = useState<'approve' | 'reject' | null>(null)
  const [targetRequest, setTargetRequest] = useState<VehicleChangeRequestDto | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [referenceTime, setReferenceTime] = useState(() => Date.now())

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<VehicleChangeRequestDto[]>>('/VehicleChangeRequest/change-vehicle')
      setRequests(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      setReferenceTime(Date.now())
      if (!res.isSuccess) setError(res.message || 'Không thể tải danh sách yêu cầu thay đổi biển số.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối đến hệ thống.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void fetchRequests())
  }, [fetchRequests])

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const today = formatUtcToVietnamDate(new Date(referenceTime).toISOString())

    return requests
      .filter((request) => {
        const normalizedStatus = request.status?.toLowerCase() ?? ''
        if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false

        if (dateFilter !== 'all') {
          if (!request.createdAt) return false
          const createdTime = parseBackendUtcDate(request.createdAt).getTime()
          if (!Number.isFinite(createdTime)) return false
          if (dateFilter === 'today' && formatUtcToVietnamDate(request.createdAt) !== today) return false
          const maxAge = dateFilter === '7days' ? 7 * 86400000 : 30 * 86400000
          if (dateFilter !== 'today' && (createdTime > referenceTime || referenceTime - createdTime > maxAge)) return false
        }

        if (normalizedQuery) {
          const searchable = [
            request.userFullName,
            request.packageName,
            request.oldLicensePlate,
            request.newLicensePlate,
            request.reason,
            request.requestId,
          ].filter(Boolean).join(' ').toLowerCase()
          if (!searchable.includes(normalizedQuery)) return false
        }
        return true
      })
      .sort((left, right) => {
        const leftPending = left.status?.toLowerCase() === 'pending' ? 1 : 0
        const rightPending = right.status?.toLowerCase() === 'pending' ? 1 : 0
        if (leftPending !== rightPending) return rightPending - leftPending
        const leftTime = left.createdAt ? parseBackendUtcDate(left.createdAt).getTime() : 0
        const rightTime = right.createdAt ? parseBackendUtcDate(right.createdAt).getTime() : 0
        return rightTime - leftTime
      })
  }, [dateFilter, query, referenceTime, requests, statusFilter])

  const openModal = (mode: 'approve' | 'reject', request: VehicleChangeRequestDto) => {
    setTargetRequest(request)
    setRejectReason('')
    setActionError('')
    setActiveModal(mode)
  }

  const closeModal = () => {
    if (actionLoading) return
    setActiveModal(null)
    setTargetRequest(null)
    setRejectReason('')
    setActionError('')
  }

  const processRequest = async (mode: 'approve' | 'reject') => {
    if (!targetRequest) return
    if (mode === 'reject' && !rejectReason.trim()) {
      setActionError('Vui lòng nhập lý do từ chối để khách hàng biết cách xử lý.')
      return
    }

    setActionLoading(true)
    setActionError('')
    try {
      const endpoint = `/VehicleChangeRequest/change-vehicle/${targetRequest.requestId}/${mode}`
      const body = mode === 'reject' ? { reason: rejectReason.trim() } : {}
      const res = await apiClient.put<ApiResponse>(endpoint, body)
      if (!res.isSuccess) {
        setActionError(res.message || (mode === 'approve' ? 'Phê duyệt thất bại.' : 'Từ chối thất bại.'))
        return
      }
      setActiveModal(null)
      setTargetRequest(null)
      setRejectReason('')
      await fetchRequests()
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : 'Không thể xử lý yêu cầu.')
    } finally {
      setActionLoading(false)
    }
  }

  const pendingCount = requests.filter((request) => request.status?.toLowerCase() === 'pending').length
  const approvedCount = requests.filter((request) => request.status?.toLowerCase() === 'approved').length
  const rejectedCount = requests.filter((request) => request.status?.toLowerCase() === 'rejected').length
  const hasFilters = Boolean(query || statusFilter !== 'all' || dateFilter !== 'all')

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setDateFilter('all')
  }

  return (
    <ManagerPageShell activeItem="vehicle-change-requests">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--orange"><ClipboardCheck size={24} aria-hidden /></span>
            <div><h2>Duyệt sửa biển số xe</h2><p>Xem xét yêu cầu đổi biển số của khách tháng trước khi cập nhật vào gói.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchRequests} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four" aria-label="Tổng quan yêu cầu đổi biển số">
          <article className="manager-summary-card"><span>Tổng yêu cầu</span><strong>{requests.length}</strong><small>Tất cả yêu cầu đã ghi nhận</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Chờ xử lý</span><strong>{pendingCount}</strong><small>Cần manager xem xét</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Đã duyệt</span><strong>{approvedCount}</strong><small>Đã cập nhật biển số mới</small></article>
          <article className="manager-summary-card manager-summary-card--red"><span>Đã từ chối</span><strong>{rejectedCount}</strong><small>Yêu cầu không được chấp nhận</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-change-filters">
            <label className="manager-search-field" htmlFor="change-search"><Search size={18} aria-hidden /><input id="change-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm khách hàng, gói hoặc biển số..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-change-filter-controls">
              <label><span>Trạng thái</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả</option><option value="pending">Chờ xử lý</option><option value="approved">Đã duyệt</option><option value="rejected">Đã từ chối</option></select></label>
              <label><span>Ngày yêu cầu</span><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="all">Tất cả thời gian</option><option value="today">Hôm nay</option><option value="7days">7 ngày qua</option><option value="30days">30 ngày qua</option></select></label>
            </div>
            <div className="manager-session-filter-meta"><span>Hiển thị <strong>{filteredRequests.length}</strong>/{requests.length} yêu cầu</span>{hasFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={15} aria-hidden /> Xóa bộ lọc</button>}</div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && requests.length === 0 ? (
            <div className="manager-empty-state">Đang tải danh sách yêu cầu...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="manager-empty-state"><ClipboardCheck size={34} aria-hidden /><strong>Không có yêu cầu phù hợp</strong><span>{hasFilters ? 'Hãy thay đổi hoặc xóa bộ lọc.' : 'Chưa có yêu cầu đổi biển số nào.'}</span></div>
          ) : (
            <div className="manager-change-list">
              {filteredRequests.map((request) => {
                const normalizedStatus = request.status?.toLowerCase() ?? ''
                const isPending = normalizedStatus === 'pending'
                return (
                  <article key={request.requestId} className={`manager-change-card${isPending ? ' pending' : ''}`}>
                    <div className="manager-change-details">
                      <div className="manager-change-person"><span><UserRound size={20} aria-hidden /></span><div><strong>{request.userFullName || 'Khách hàng'}</strong><small><Package size={13} aria-hidden /> {request.packageName || 'Chưa rõ gói'}</small></div></div>
                      <div className="manager-change-info"><p><strong>Lý do khách gửi:</strong> {request.reason || 'Không cung cấp'}</p>{request.rejectionReason && <p><strong>Lý do từ chối:</strong> {request.rejectionReason}</p>}<span><Clock3 size={14} aria-hidden /> {request.createdAt ? formatUtcToVietnamDateTime(request.createdAt) : 'Không rõ thời gian'}</span>{request.processedAt && <span>Đã xử lý: {formatUtcToVietnamDateTime(request.processedAt)}{request.handledByFullName ? ` · ${request.handledByFullName}` : ''}</span>}</div>
                    </div>
                    <div className="manager-change-plates"><div><small>Biển số hiện tại</small><strong>{request.oldLicensePlate || '—'}</strong></div><ArrowRight size={20} aria-hidden /><div className="new"><small>Biển số đề nghị</small><strong>{request.newLicensePlate || '—'}</strong></div></div>
                    <div className="manager-change-side"><span className={`manager-change-status status-${normalizedStatus}`}><i />{statusLabel(request.status)}</span>{isPending && <div><button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('approve', request)}><Check size={16} aria-hidden /> Duyệt</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => openModal('reject', request)}><X size={16} aria-hidden /> Từ chối</button></div>}</div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {activeModal && targetRequest && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-change-modal" role="dialog" aria-modal="true" aria-labelledby="change-modal-title">
            <div className="manager-modal-header"><div><h3 id="change-modal-title" className="modal-title">{activeModal === 'approve' ? 'Xác nhận duyệt thay đổi' : 'Từ chối yêu cầu'}</h3><p>{activeModal === 'approve' ? 'Biển số mới sẽ được cập nhật ngay vào gói tháng.' : 'Lý do từ chối sẽ được lưu vào yêu cầu.'}</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={actionLoading}><X size={20} aria-hidden /></button></div>
            <div className="manager-change-modal-person"><UserRound size={19} aria-hidden /><div><strong>{targetRequest.userFullName || 'Khách hàng'}</strong><span>{targetRequest.packageName || 'Chưa rõ gói thuê bao'}</span></div></div>
            <div className="manager-change-modal-plates"><div><small>Biển số cũ</small><strong>{targetRequest.oldLicensePlate || '—'}</strong></div><ArrowRight size={22} aria-hidden /><div><small>Biển số mới</small><strong>{targetRequest.newLicensePlate || '—'}</strong></div></div>
            <div className="manager-change-reason"><span>Lý do khách gửi</span><p>{targetRequest.reason || 'Không cung cấp lý do.'}</p></div>
            {activeModal === 'approve' ? <div className="manager-change-warning">Hãy đối chiếu giấy tờ xe trước khi duyệt. Thao tác này thay đổi biển số dùng để xác thực check-in khách tháng.</div> : <div className="form-field"><label htmlFor="reject-note">Lý do từ chối *</label><textarea id="reject-note" rows={4} maxLength={500} autoFocus value={rejectReason} onChange={(event) => { setRejectReason(event.target.value); setActionError('') }} placeholder="Nêu rõ lý do để khách hàng có thể chỉnh sửa yêu cầu..." /><small className="field-hint">{rejectReason.length}/500 ký tự</small></div>}
            {actionError && <div className="manager-inline-error" role="alert">{actionError}</div>}
            <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={closeModal} disabled={actionLoading}>Hủy</button><button type="button" className={`btn ${activeModal === 'approve' ? 'btn-primary' : 'manager-reject-button'}`} onClick={() => processRequest(activeModal)} disabled={actionLoading || (activeModal === 'reject' && !rejectReason.trim())}>{actionLoading ? <Loader2 size={17} className="spin" aria-hidden /> : activeModal === 'approve' ? <Check size={17} aria-hidden /> : <X size={17} aria-hidden />}{actionLoading ? 'Đang xử lý...' : activeModal === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</button></div>
          </div>
        </div>
      )}
    </ManagerPageShell>
  )
}
