import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Eye, Pencil, Plus, RefreshCw, Search, Trash2, WalletCards, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { formatUtcToVietnamDateTime, toVietnamDatetimeLocal, vietnamDatetimeLocalToUtcIso } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'
import type { ApiResponse, MonthlySubscriptionDto, ParkingSessionDto, ReservationDto, UserDto } from '../../utils/apiServices'

interface PaymentDto {
  paymentId: string
  userId?: string
  sessionId?: string
  reservationId?: string
  subscriptionId?: string
  amount: number
  paymentMethod: string
  paymentType?: string
  paymentTime: string
  paymentStatus: string
  transactionReference?: string
}

interface PaymentForm {
  userId: string
  sessionId: string
  reservationId: string
  subscriptionId: string
  amount: string
  paymentMethod: string
  paymentType: string
  paymentTime: string
  paymentStatus: string
  transactionReference: string
}

type ReferenceKind = 'user' | 'reservation' | 'subscription' | 'session'
type ReferenceDetail =
  | { kind: 'user'; data: UserDto }
  | { kind: 'reservation'; data: ReservationDto }
  | { kind: 'subscription'; data: MonthlySubscriptionDto }
  | { kind: 'session'; data: ParkingSessionDto }

const EMPTY_FORM: PaymentForm = {
  userId: '', sessionId: '', reservationId: '', subscriptionId: '', amount: '',
  paymentMethod: 'Cash', paymentType: 'CheckoutFee', paymentTime: '',
  paymentStatus: 'Success', transactionReference: '',
}

const LABELS: Record<string, string> = {
  deposit: 'Tiền đặt cọc', checkoutfee: 'Phí gửi xe', subscriptionfee: 'Phí đăng ký tháng',
  subscriptionrenewal: 'Phí gia hạn', payos: 'Chuyển khoản PayOS', cash: 'Tiền mặt',
  pending: 'Chờ xử lý', success: 'Thành công', failed: 'Thất bại',
}

function label(value?: string) {
  return LABELS[(value ?? '').replace(/[\s_-]/g, '').toLowerCase()] ?? value ?? 'Chưa xác định'
}

function toLocalInput(value?: string) {
  return toVietnamDatetimeLocal(value)
}

function toForm(payment: PaymentDto): PaymentForm {
  return {
    userId: payment.userId ?? '', sessionId: payment.sessionId ?? '',
    reservationId: payment.reservationId ?? '', subscriptionId: payment.subscriptionId ?? '',
    amount: String(payment.amount), paymentMethod: payment.paymentMethod,
    paymentType: payment.paymentType ?? 'CheckoutFee', paymentTime: toLocalInput(payment.paymentTime),
    paymentStatus: payment.paymentStatus, transactionReference: payment.transactionReference ?? '',
  }
}

export default function ManagerPayments() {
  const [payments, setPayments] = useState<PaymentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<PaymentDto | null>(null)
  const [editing, setEditing] = useState<PaymentDto | null | undefined>(undefined)
  const [form, setForm] = useState<PaymentForm>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<PaymentDto | null>(null)
  const [users, setUsers] = useState<UserDto[]>([])
  const [sessions, setSessions] = useState<ParkingSessionDto[]>([])
  const [reservations, setReservations] = useState<ReservationDto[]>([])
  const [subscriptions, setSubscriptions] = useState<MonthlySubscriptionDto[]>([])
  const [referencesLoading, setReferencesLoading] = useState(false)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [referenceModal, setReferenceModal] = useState<{ kind: ReferenceKind; title: string } | null>(null)
  const [referenceDetail, setReferenceDetail] = useState<ReferenceDetail | null>(null)
  const [referenceDetailLoading, setReferenceDetailLoading] = useState(false)
  const [referenceDetailError, setReferenceDetailError] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiClient.get<ApiResponse<PaymentDto[]>>('/payments')
      if (!response.isSuccess) throw new Error(response.message || 'Không thể tải danh sách thanh toán.')
      setPayments(Array.isArray(response.result) ? response.result : [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối đến hệ thống.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchReferenceOptions = useCallback(async () => {
    setReferencesLoading(true)
    setReferenceError(null)
    try {
      const [userResponse, sessionResponse, reservationResponse, subscriptionResponse] = await Promise.all([
        apiClient.get<ApiResponse<UserDto[]>>('/User/all'),
        apiClient.get<ApiResponse<ParkingSessionDto[]>>('/ParkingSession'),
        apiClient.get<ApiResponse<ReservationDto[]>>('/reservations'),
        apiClient.get<ApiResponse<MonthlySubscriptionDto[]>>('/MonthlySubscription'),
      ])
      setUsers(userResponse.isSuccess && Array.isArray(userResponse.result) ? userResponse.result : [])
      setSessions(sessionResponse.isSuccess && Array.isArray(sessionResponse.result) ? sessionResponse.result : [])
      setReservations(reservationResponse.isSuccess && Array.isArray(reservationResponse.result) ? reservationResponse.result : [])
      setSubscriptions(subscriptionResponse.isSuccess && Array.isArray(subscriptionResponse.result) ? subscriptionResponse.result : [])
      const failedMessage = [userResponse, sessionResponse, reservationResponse, subscriptionResponse]
        .find((response) => !response.isSuccess)?.message
      if (failedMessage) setReferenceError(failedMessage)
    } catch (requestError) {
      setReferenceError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu để lựa chọn.')
    } finally {
      setReferencesLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchPayments()
      void fetchReferenceOptions()
    })
  }, [fetchPayments, fetchReferenceOptions])

  const getPaymentSubject = useCallback((payment: PaymentDto) => {
    const lines: string[] = []
    const user = users.find((item) => item.userId === payment.userId)
    if (payment.userId) {
      lines.push(user
        ? `${user.fullName || user.userName} · ${user.email}`
        : 'Không tải được thông tin khách hàng')
    }

    if (payment.reservationId) {
      const reservation = reservations.find((item) => item.reservationId === payment.reservationId)
      lines.push(reservation
        ? [
            reservation.licensePlate,
            reservation.vehicleTypeName || reservation.vehicleType?.typeName,
            formatUtcToVietnamDateTime(reservation.expectedEntryTime),
          ].filter(Boolean).join(' · ')
        : 'Không tải được thông tin đặt chỗ')
    }

    if (payment.subscriptionId) {
      const subscription = subscriptions.find((item) => item.subscriptionId === payment.subscriptionId)
      lines.push(subscription
        ? `${subscription.licensePlate} · ${subscription.packageName || 'Chưa rõ gói'}`
        : 'Không tải được thông tin gói tháng')
    }

    if (payment.sessionId) {
      const session = sessions.find((item) => item.sessionId === payment.sessionId)
      lines.push(session
        ? `${session.licensePlateIn} · ${formatUtcToVietnamDateTime(session.entryTime)}`
        : 'Không tải được thông tin phiên gửi xe')
    }

    return {
      lines: lines.length > 0 ? lines : ['Không có thông tin liên kết'],
      searchText: lines.join(' '),
    }
  }, [reservations, sessions, subscriptions, users])

  const getPayerName = useCallback((payment: PaymentDto) => {
    const user = users.find((item) => item.userId === payment.userId)
    if (user) return user.fullName || user.userName

    const reservation = reservations.find((item) => item.reservationId === payment.reservationId)
    if (reservation) return reservation.userFullName || reservation.user?.fullName || 'Chưa rõ khách hàng'

    const subscription = subscriptions.find((item) => item.subscriptionId === payment.subscriptionId)
    if (subscription) return subscription.fullName || 'Chưa rõ khách hàng'

    const session = sessions.find((item) => item.sessionId === payment.sessionId)
    if (session) return session.driverFullName || 'Khách vãng lai'

    return payment.userId ? 'Không tải được thông tin khách hàng' : 'Không liên kết khách hàng'
  }, [reservations, sessions, subscriptions, users])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return payments.filter((item) => {
      if (statusFilter !== 'all' && item.paymentStatus.toLowerCase() !== statusFilter) return false
      const subject = getPaymentSubject(item)
      return !term || [item.paymentId, item.transactionReference, subject.searchText]
        .filter(Boolean).join(' ').toLowerCase().includes(term)
    })
  }, [getPaymentSubject, payments, query, statusFilter])

  const success = payments.filter((item) => item.paymentStatus.toLowerCase() === 'success')
  const selectableUsers = users.filter((user) => {
    const role = user.roleName.toLowerCase()
    return role === 'user' || role === 'customer' || user.userId === form.userId
  })
  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setError(null); void fetchReferenceOptions() }
  const openEdit = (payment: PaymentDto) => { setForm(toForm(payment)); setEditing(payment); setSelected(null); setError(null); void fetchReferenceOptions() }

  const openReference = async (kind: ReferenceKind, id: string) => {
    const titles: Record<ReferenceKind, string> = {
      user: 'Chi tiết khách hàng',
      reservation: 'Chi tiết đặt chỗ',
      subscription: 'Chi tiết đăng ký tháng',
      session: 'Chi tiết phiên gửi xe',
    }
    setReferenceModal({ kind, title: titles[kind] })
    setReferenceDetail(null)
    setReferenceDetailError(null)
    setReferenceDetailLoading(true)
    try {
      if (kind === 'user') {
        const response = await apiClient.get<ApiResponse<UserDto>>(`/User/${id}`)
        if (!response.isSuccess || !response.result) throw new Error(response.message || 'Không thể tải khách hàng.')
        setReferenceDetail({ kind, data: response.result })
      } else if (kind === 'reservation') {
        const response = await apiClient.get<ApiResponse<ReservationDto>>(`/reservations/${id}`)
        if (!response.isSuccess || !response.result) throw new Error(response.message || 'Không thể tải đặt chỗ.')
        setReferenceDetail({ kind, data: response.result })
      } else if (kind === 'subscription') {
        const response = await apiClient.get<ApiResponse<MonthlySubscriptionDto>>(`/MonthlySubscription/${id}`)
        if (!response.isSuccess || !response.result) throw new Error(response.message || 'Không thể tải đăng ký tháng.')
        setReferenceDetail({ kind, data: response.result })
      } else {
        const response = await apiClient.get<ApiResponse<ParkingSessionDto>>(`/ParkingSession/${id}`)
        if (!response.isSuccess || !response.result) throw new Error(response.message || 'Không thể tải phiên gửi xe.')
        setReferenceDetail({ kind, data: response.result })
      }
    } catch (requestError) {
      setReferenceDetailError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu liên kết.')
    } finally {
      setReferenceDetailLoading(false)
    }
  }

  const renderReferenceButtons = (payment: PaymentDto) => {
    const paymentType = (payment.paymentType ?? '').replace(/[\s_-]/g, '').toLowerCase()
    const references: Array<{ kind: Exclude<ReferenceKind, 'user'>; id: string; label: string }> = []

    if (paymentType === 'deposit' && payment.reservationId) {
      references.push({ kind: 'reservation', id: payment.reservationId, label: 'Xem đặt chỗ' })
    } else if (paymentType === 'checkoutfee' && payment.sessionId) {
      references.push({ kind: 'session', id: payment.sessionId, label: 'Xem phiên gửi xe' })
    } else if ((paymentType === 'subscriptionfee' || paymentType === 'subscriptionrenewal') && payment.subscriptionId) {
      references.push({ kind: 'subscription', id: payment.subscriptionId, label: 'Xem gói tháng' })
    }

    if (references.length === 0) return <small>Không có liên kết</small>
    return <div className="manager-row-actions">{references.map((reference) => (
      <button key={reference.kind} type="button" className="btn btn-outline btn-sm manager-payment-reference-button" onClick={() => void openReference(reference.kind, reference.id)}><Eye size={14} aria-hidden /> {reference.label}</button>
    ))}</div>
  }

  const handlePaymentTypeChange = (paymentType: string) => {
    setForm((current) => ({
      ...current,
      paymentType,
      sessionId: paymentType === 'CheckoutFee' ? current.sessionId : '',
      reservationId: paymentType === 'Deposit' ? current.reservationId : '',
      subscriptionId: paymentType === 'SubscriptionFee' || paymentType === 'SubscriptionRenewal' ? current.subscriptionId : '',
    }))
  }

  const selectSession = (sessionId: string) => {
    const session = sessions.find((item) => item.sessionId === sessionId)
    setForm((current) => ({ ...current, sessionId, userId: session?.driverUserId ?? current.userId }))
  }

  const selectReservation = (reservationId: string) => {
    const reservation = reservations.find((item) => item.reservationId === reservationId)
    setForm((current) => ({ ...current, reservationId, userId: reservation?.userId ?? current.userId }))
  }

  const selectSubscription = (subscriptionId: string) => {
    const subscription = subscriptions.find((item) => item.subscriptionId === subscriptionId)
    setForm((current) => ({ ...current, subscriptionId, userId: subscription?.userId ?? current.userId }))
  }

  const openDetail = async (payment: PaymentDto) => {
    try {
      const response = await apiClient.get<ApiResponse<PaymentDto>>(`/payments/${payment.paymentId}`)
      setSelected(response.isSuccess && response.result ? response.result : payment)
    } catch {
      setSelected(payment)
    }
  }

  const savePayment = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const optionalGuid = (value: string) => value.trim() || null
    const payload = {
      ...(editing ? { paymentId: editing.paymentId } : {}),
      userId: optionalGuid(form.userId), sessionId: optionalGuid(form.sessionId),
      reservationId: optionalGuid(form.reservationId), subscriptionId: optionalGuid(form.subscriptionId),
      amount: Number(form.amount), paymentMethod: form.paymentMethod, paymentType: form.paymentType,
      paymentTime: form.paymentTime ? vietnamDatetimeLocalToUtcIso(form.paymentTime) : editing?.paymentTime ?? null,
      paymentStatus: form.paymentStatus, transactionReference: form.transactionReference.trim() || null,
    }
    try {
      const response = editing
        ? await apiClient.put<ApiResponse<PaymentDto>>('/payments', payload)
        : await apiClient.post<ApiResponse<PaymentDto>>('/payments', payload)
      if (!response.isSuccess) throw new Error(response.message || 'Không thể lưu thanh toán.')
      setEditing(undefined)
      await Promise.all([fetchPayments(), fetchReferenceOptions()])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu thanh toán.')
    } finally {
      setSaving(false)
    }
  }

  const deletePayment = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/payments/${deleteTarget.paymentId}`)
    if (!response.isSuccess) throw new Error(response.message || 'Không thể xóa thanh toán.')
    setDeleteTarget(null)
    setSelected(null)
    await fetchPayments()
  }

  return (
    <ManagerPageShell activeItem="payments">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title"><span className="manager-resource-icon manager-resource-icon--money"><WalletCards size={24} /></span><div><h2>Quản lý thanh toán</h2><p>Tra cứu và quản lý các giao dịch trong toàn hệ thống.</p></div></div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchPayments} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm thanh toán</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four">
          <article className="manager-summary-card"><span>Tổng giao dịch</span><strong>{payments.length}</strong><small>Tất cả trạng thái</small></article>
          <article className="manager-summary-card manager-summary-card--money"><span>Doanh thu thành công</span><strong>{formatCurrency(success.reduce((sum, item) => sum + item.amount, 0))}</strong><small>{success.length} giao dịch</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Chờ xử lý</span><strong>{payments.filter((item) => item.paymentStatus.toLowerCase() === 'pending').length}</strong><small>Cần kiểm tra</small></article>
          <article className="manager-summary-card manager-summary-card--red"><span>Thất bại</span><strong>{payments.filter((item) => item.paymentStatus.toLowerCase() === 'failed').length}</strong><small>Chưa hoàn tất</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã giao dịch hoặc mã liên kết..." />{query && <button type="button" onClick={() => setQuery('')}><X size={16} /></button>}</label>
            <div className="manager-filter-controls"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ xử lý</option><option value="success">Thành công</option><option value="failed">Thất bại</option></select></div>
          </div>
          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          <div className="table-wrap manager-table-wrap"><table className="ui-table manager-resource-table manager-payment-table"><thead><tr><th>Mã thanh toán</th><th>Thanh toán cho</th><th>Thời gian</th><th>Loại</th><th>Phương thức</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {loading && payments.length === 0 && <tr><td colSpan={8}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="manager-empty-state">Không có giao dịch phù hợp.</div></td></tr>}
            {filtered.map((payment) => <tr key={payment.paymentId}><td><code className="manager-code-value">{payment.paymentId.slice(0, 8)}…</code></td><td>{renderReferenceButtons(payment)}</td><td>{formatUtcToVietnamDateTime(payment.paymentTime)}</td><td>{label(payment.paymentType)}</td><td>{label(payment.paymentMethod)}</td><td><strong className="manager-payment-amount">{formatCurrency(payment.amount)}</strong></td><td><span className={`manager-payment-status ${payment.paymentStatus.toLowerCase()}`}><i />{label(payment.paymentStatus)}</span></td><td><div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => void openDetail(payment)}><Eye size={15} /> Xem</button><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(payment)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(payment)}><Trash2 size={15} /> Xóa</button></div></td></tr>)}
          </tbody></table></div>
        </section>
      </div>

      {editing !== undefined && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setEditing(undefined)}>
          <div className="modal-panel manager-form-modal manager-payment-form-modal" role="dialog" aria-modal="true" aria-labelledby="payment-form-title">
            <div className="manager-modal-header">
              <div><h3 id="payment-form-title" className="modal-title">{editing ? 'Sửa thanh toán' : 'Thêm thanh toán'}</h3><p>Chọn dữ liệu liên quan theo tên và biển số; hệ thống sẽ tự gửi ID cho backend.</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setEditing(undefined)} disabled={saving}><X size={20} /></button>
            </div>
            <form onSubmit={savePayment}>
              {referencesLoading && <div className="manager-reference-loading"><RefreshCw size={16} className="spin" aria-hidden /> Đang tải danh sách để lựa chọn...</div>}
              {referenceError && <div className="manager-inline-error" role="alert">{referenceError}<button type="button" className="btn btn-outline btn-sm" onClick={() => void fetchReferenceOptions()}>Thử lại</button></div>}
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="payment-type">Loại thanh toán *</label><select id="payment-type" value={form.paymentType} onChange={(event) => handlePaymentTypeChange(event.target.value)}><option value="CheckoutFee">Phí gửi xe</option><option value="Deposit">Tiền đặt cọc</option><option value="SubscriptionFee">Phí đăng ký tháng</option><option value="SubscriptionRenewal">Phí gia hạn</option></select></div>
                <div className="form-field"><label htmlFor="payment-user">Khách hàng</label><select id="payment-user" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} disabled={referencesLoading}><option value="">Không liên kết khách hàng</option>{selectableUsers.map((user) => <option key={user.userId} value={user.userId}>{user.fullName || user.userName} · {user.email}</option>)}</select><small className="field-hint">Tự động chọn khi bạn chọn phiên, đặt chỗ hoặc gói tháng.</small></div>

                {form.paymentType === 'CheckoutFee' && <div className="form-field form-field--full"><label htmlFor="payment-session">Phiên gửi xe *</label><select id="payment-session" required value={form.sessionId} onChange={(event) => selectSession(event.target.value)} disabled={referencesLoading}><option value="">Chọn theo biển số xe và thời gian vào</option>{sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.licensePlateIn} · {session.driverFullName || 'Khách vãng lai'} · {formatUtcToVietnamDateTime(session.entryTime)} · {label(session.status)}</option>)}</select></div>}

                {form.paymentType === 'Deposit' && <div className="form-field form-field--full"><label htmlFor="payment-reservation">Đặt chỗ *</label><select id="payment-reservation" required value={form.reservationId} onChange={(event) => selectReservation(event.target.value)} disabled={referencesLoading}><option value="">Chọn theo khách hàng và thời gian dự kiến</option>{reservations.map((reservation) => <option key={reservation.reservationId} value={reservation.reservationId}>{reservation.userFullName || reservation.user?.fullName || 'Chưa có tên'} · {reservation.vehicleTypeName || reservation.vehicleType?.typeName || 'Chưa rõ loại xe'} · {formatUtcToVietnamDateTime(reservation.expectedEntryTime)} · {label(reservation.status)}</option>)}</select></div>}

                {(form.paymentType === 'SubscriptionFee' || form.paymentType === 'SubscriptionRenewal') && <div className="form-field form-field--full"><label htmlFor="payment-subscription">Đăng ký gửi xe tháng *</label><select id="payment-subscription" required value={form.subscriptionId} onChange={(event) => selectSubscription(event.target.value)} disabled={referencesLoading}><option value="">Chọn theo biển số, khách hàng và gói</option>{subscriptions.map((subscription) => <option key={subscription.subscriptionId} value={subscription.subscriptionId}>{subscription.licensePlate} · {subscription.fullName || 'Chưa có tên'} · {subscription.packageName || 'Chưa rõ gói'} · {label(subscription.status)}</option>)}</select></div>}

                <div className="form-field"><label htmlFor="payment-amount">Số tiền *</label><input id="payment-amount" type="number" min="0" step="1000" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="Ví dụ: 30000" /></div>
                <div className="form-field"><label htmlFor="payment-time">Thời gian</label><input id="payment-time" type="datetime-local" value={form.paymentTime} onChange={(event) => setForm({ ...form, paymentTime: event.target.value })} /></div>
                <div className="form-field"><label htmlFor="payment-method">Phương thức *</label><select id="payment-method" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option value="Cash">Tiền mặt</option><option value="PayOS">Chuyển khoản PayOS</option></select></div>
                <div className="form-field"><label htmlFor="payment-status">Trạng thái *</label><select id="payment-status" value={form.paymentStatus} onChange={(event) => setForm({ ...form, paymentStatus: event.target.value })}><option value="Pending">Chờ xử lý</option><option value="Success">Thành công</option><option value="Failed">Thất bại</option></select></div>
                <div className="form-field form-field--full"><label htmlFor="payment-reference">Order code</label><input id="payment-reference" value={form.transactionReference} onChange={(event) => setForm({ ...form, transactionReference: event.target.value })} placeholder="Có thể để trống với thanh toán tiền mặt" /></div>
              </div>
              {error && <div className="manager-inline-error" role="alert">{error}</div>}
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setEditing(undefined)} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving || referencesLoading || !form.amount}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm thanh toán'}</button></div>
            </form>
          </div>
        </div>
      )}

      {selected && <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}><div className="modal-panel manager-payment-modal"><div className="manager-modal-header"><div><h3 className="modal-title">Chi tiết thanh toán</h3><p>Thông tin giao dịch và đối tượng liên kết</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><X size={20} /></button></div><div className={`manager-payment-modal-hero manager-payment-modal-hero--${selected.paymentStatus.toLowerCase()}`}><span><Banknote size={25} /></span><div><small>Số tiền</small><strong>{formatCurrency(selected.amount)}</strong><span className={`manager-payment-status ${selected.paymentStatus.toLowerCase()}`}><i />{label(selected.paymentStatus)}</span></div></div><div className="manager-payment-detail-grid manager-payment-detail-grid--complete"><div><span>Mã thanh toán</span><code>{selected.paymentId}</code></div><div><span>Trạng thái</span><strong>{label(selected.paymentStatus)}</strong></div><div><span>Người thanh toán</span><strong>{getPayerName(selected)}</strong></div><div><span>Loại thanh toán</span><strong>{label(selected.paymentType)}</strong></div><div><span>Phương thức</span><strong>{label(selected.paymentMethod)}</strong></div><div><span>Thời gian thanh toán</span><strong>{formatUtcToVietnamDateTime(selected.paymentTime)}</strong></div><div><span>Order code</span><code>{selected.transactionReference || 'Không có'}</code></div><div className="manager-payment-reference-field"><span>Thanh toán cho</span>{renderReferenceButtons(selected)}</div></div><div className="form-actions"><button type="button" className="btn btn-outline manager-edit-button" onClick={() => openEdit(selected)}><Pencil size={16} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost manager-danger-action" onClick={() => setDeleteTarget(selected)}><Trash2 size={16} /> Xóa</button></div></div></div>}
      {referenceModal && <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setReferenceModal(null)}><div className="modal-panel manager-form-modal manager-payment-reference-modal" role="dialog" aria-modal="true"><div className="manager-modal-header"><div><h3 className="modal-title">{referenceModal.title}</h3><p>Dữ liệu liên kết trực tiếp với thanh toán.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setReferenceModal(null)}><X size={20} /></button></div>
        {referenceDetailLoading && <div className="manager-empty-state"><RefreshCw size={20} className="spin" aria-hidden /> Đang tải chi tiết...</div>}
        {referenceDetailError && <div className="manager-inline-error" role="alert">{referenceDetailError}</div>}
        {referenceDetail?.kind === 'user' && <div className="manager-payment-detail-grid"><div><span>Họ tên</span><strong>{referenceDetail.data.fullName}</strong></div><div><span>Tài khoản</span><strong>{referenceDetail.data.userName}</strong></div><div><span>Email</span><strong>{referenceDetail.data.email}</strong></div><div><span>Số điện thoại</span><strong>{referenceDetail.data.phoneNumber || 'Chưa có'}</strong></div><div><span>Vai trò</span><strong>{referenceDetail.data.roleName}</strong></div><div><span>Trạng thái</span><strong>{referenceDetail.data.status}</strong></div></div>}
        {referenceDetail?.kind === 'reservation' && <><div className="manager-payment-session-hero manager-payment-reservation-hero"><div className="manager-session-plate"><small>ĐẶT CHỖ</small><strong>{referenceDetail.data.licensePlate || 'CHƯA CÓ BIỂN'}</strong></div><div><span>Trạng thái đặt chỗ</span><strong>{label(referenceDetail.data.status)}</strong><small>{referenceDetail.data.userFullName || referenceDetail.data.user?.fullName || 'Chưa có tên khách hàng'}</small></div></div><div className="manager-payment-detail-grid manager-payment-session-detail-grid"><div><span>Khách hàng</span><strong>{referenceDetail.data.userFullName || referenceDetail.data.user?.fullName || 'Chưa có tên'}</strong></div><div><span>Loại xe</span><strong>{referenceDetail.data.vehicleTypeName || referenceDetail.data.vehicleType?.typeName || 'Chưa rõ'}</strong></div><div><span>Thời gian dự kiến đến</span><strong>{formatUtcToVietnamDateTime(referenceDetail.data.expectedEntryTime)}</strong></div><div><span>Thời điểm đặt chỗ</span><strong>{referenceDetail.data.createdAt ? formatUtcToVietnamDateTime(referenceDetail.data.createdAt) : 'Chưa ghi nhận'}</strong></div></div></>}
        {referenceDetail?.kind === 'subscription' && <><div className="manager-payment-session-hero manager-payment-subscription-hero"><div className="manager-session-plate"><small>VIỆT NAM</small><strong>{referenceDetail.data.licensePlate}</strong></div><div><span>Gói đăng ký</span><strong>{referenceDetail.data.packageName || 'Chưa rõ gói'}</strong><small>{referenceDetail.data.fullName || 'Chưa có tên khách hàng'}</small></div></div><div className="manager-payment-detail-grid manager-payment-session-detail-grid"><div><span>Loại xe</span><strong>{referenceDetail.data.vehicleType || 'Chưa rõ'}</strong></div><div><span>Trạng thái</span><strong>{label(referenceDetail.data.status)}</strong></div><div><span>Giá gói</span><strong>{formatCurrency(referenceDetail.data.price)}</strong></div><div><span>Slot cố định</span><strong>{referenceDetail.data.fixedSlot || 'Không cố định'}</strong></div><div><span>Ngày bắt đầu</span><strong>{formatUtcToVietnamDateTime(referenceDetail.data.startDate)}</strong></div><div><span>Ngày kết thúc</span><strong>{formatUtcToVietnamDateTime(referenceDetail.data.endDate)}</strong></div></div></>}
        {referenceDetail?.kind === 'session' && <><div className="manager-payment-session-hero"><div className="manager-session-plate"><small>VIỆT NAM</small><strong>{referenceDetail.data.licensePlateIn}</strong>{referenceDetail.data.licensePlateOut && referenceDetail.data.licensePlateOut !== referenceDetail.data.licensePlateIn && <span>Ra: {referenceDetail.data.licensePlateOut}</span>}</div><div><span>Trạng thái phiên</span><strong>{label(referenceDetail.data.status)}</strong><small>{referenceDetail.data.exitTime ? 'Phiên đã ghi nhận thời gian xe ra' : 'Xe chưa hoàn tất checkout'}</small></div></div><div className="manager-payment-detail-grid manager-payment-session-detail-grid"><div><span>Người gửi</span><strong>{referenceDetail.data.driverFullName || 'Khách vãng lai'}</strong></div><div><span>Loại xe</span><strong>{referenceDetail.data.vehicleTypeName || 'Chưa rõ'}</strong></div><div><span>Thời gian vào</span><strong>{formatUtcToVietnamDateTime(referenceDetail.data.entryTime)}</strong></div><div><span>Thời gian ra</span><strong>{referenceDetail.data.exitTime ? formatUtcToVietnamDateTime(referenceDetail.data.exitTime) : 'Chưa ra'}</strong></div><div><span>Slot được xếp</span><strong>{referenceDetail.data.assignedSlotCode || 'Chưa xếp slot'}</strong></div><div><span>Slot thực tế</span><strong>{referenceDetail.data.actualSlotCode || 'Chưa ghi nhận'}</strong></div><div><span>Cổng vào</span><strong>{referenceDetail.data.entryGateName || 'Chưa xác định'}</strong></div><div><span>Cổng ra</span><strong>{referenceDetail.data.exitGateName || 'Chưa ghi nhận'}</strong></div></div></>}
        <div className="form-actions"><button type="button" className="btn btn-primary" onClick={() => setReferenceModal(null)}>Đóng</button></div>
      </div></div>}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa giao dịch?" description={<>Bạn có chắc muốn xóa giao dịch <strong>{deleteTarget?.paymentId}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget ? `${deleteTarget.paymentId.slice(0, 8)}…` : undefined} targetMeta={deleteTarget ? `${formatCurrency(deleteTarget.amount)} · ${label(deleteTarget.paymentStatus)}` : undefined} targetIcon={<Banknote size={18} aria-hidden />} note="Việc xóa giao dịch có thể ảnh hưởng đến dữ liệu đối soát và báo cáo doanh thu." errorFallback="Không thể xóa thanh toán." onCancel={() => setDeleteTarget(null)} onConfirm={deletePayment} />
    </ManagerPageShell>
  )
}
