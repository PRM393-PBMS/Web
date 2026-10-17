import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, Eye, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { formatUtcToVietnamDate, formatUtcToVietnamDateTime, toVietnamDateInput, vietnamDateBoundaryToUtcIso } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'
import { normalizeLicensePlate } from '../../utils/licensePlate'
import type { ApiResponse, SubscriptionPackageDto, UserDto } from '../../utils/apiServices'

interface SubscriptionDto {
  subscriptionId: string
  fullName?: string
  licensePlate: string
  vehicleType?: string
  packageName?: string
  startDate: string
  endDate: string
  price: number
  status: string
  fixedSlot?: string
}

interface SlotDto { slotId: string; slotCode: string; vehicleTypeId?: string; floorName?: string; status?: string; isResident?: boolean }
interface FormState { licensePlate: string; startDate: string; endDate: string; status: string; fixedSlotId: string }
interface CreateFormState { userId: string; packageId: string; licensePlate: string; fixedSlotId: string }

const EMPTY_CREATE_FORM: CreateFormState = { userId: '', packageId: '', licensePlate: '', fixedSlotId: '' }

const STATUS_LABELS: Record<string, string> = {
  pendingpayment: 'Chờ thanh toán', active: 'Đang hiệu lực', cancelled: 'Đã hủy', expired: 'Hết hạn',
}

function statusLabel(status: string) {
  return STATUS_LABELS[status.replace(/[\s_-]/g, '').toLowerCase()] ?? status
}

function dateInput(value: string) {
  return value ? toVietnamDateInput(value) : ''
}

export default function ManagerMonthlySubscriptions() {
  const [items, setItems] = useState<SubscriptionDto[]>([])
  const [slots, setSlots] = useState<SlotDto[]>([])
  const [users, setUsers] = useState<UserDto[]>([])
  const [packages, setPackages] = useState<SubscriptionPackageDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<SubscriptionDto | null>(null)
  const [editing, setEditing] = useState<SubscriptionDto | null>(null)
  const [form, setForm] = useState<FormState>({ licensePlate: '', startDate: '', endDate: '', status: 'Active', fixedSlotId: '' })
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(EMPTY_CREATE_FORM)
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionDto | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subscriptions, parkingSlots, userResponse, packageResponse] = await Promise.all([
        apiClient.get<ApiResponse<SubscriptionDto[]>>('/MonthlySubscription'),
        apiClient.get<ApiResponse<SlotDto[]>>('/ParkingSlot'),
        apiClient.get<ApiResponse<UserDto[]>>('/User/all'),
        apiClient.get<ApiResponse<SubscriptionPackageDto[]>>('/SubscriptionPackage'),
      ])
      if (!subscriptions.isSuccess) throw new Error(subscriptions.message || 'Không thể tải đăng ký tháng.')
      setItems(subscriptions.result ?? [])
      setSlots(parkingSlots.result ?? [])
      setUsers((userResponse.result ?? []).filter((user) => {
        const role = user.roleName.toLowerCase()
        return user.status.toLowerCase() === 'active' && (role === 'user' || role === 'customer')
      }))
      setPackages((packageResponse.result ?? []).filter((item) => item.status.toLowerCase() === 'active'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối đến hệ thống.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void fetchData()) }, [fetchData])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return items.filter((item) => (statusFilter === 'all' || item.status.toLowerCase() === statusFilter) &&
      (!term || [item.fullName, item.licensePlate, item.vehicleType, item.packageName, item.fixedSlot, item.subscriptionId].filter(Boolean).join(' ').toLowerCase().includes(term)))
  }, [items, query, statusFilter])

  const selectedPackage = useMemo(
    () => packages.find((item) => item.packageId === createForm.packageId),
    [createForm.packageId, packages],
  )
  const requiresFixedSlot = Boolean(selectedPackage?.requireFixedSlot)
  const availableCreateSlots = useMemo(() => slots.filter((slot) =>
    slot.status?.toLowerCase() === 'available' &&
    slot.isResident === true &&
    slot.vehicleTypeId === selectedPackage?.vehicleTypeId
  ), [selectedPackage?.vehicleTypeId, slots])

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM)
    setError(null)
    setCreating(true)
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, string> = {
        userId: createForm.userId,
        packageId: createForm.packageId,
        licensePlate: normalizeLicensePlate(createForm.licensePlate),
      }
      if (requiresFixedSlot) payload.fixedSlotId = createForm.fixedSlotId
      const response = await apiClient.post<ApiResponse<unknown>>('/MonthlySubscription', payload)
      if (!response.isSuccess) throw new Error(response.message || 'Không thể thêm đăng ký tháng.')
      setCreating(false)
      setCreateForm(EMPTY_CREATE_FORM)
      await fetchData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể thêm đăng ký tháng.')
    } finally { setSaving(false) }
  }

  const openDetail = async (item: SubscriptionDto) => {
    try {
      const response = await apiClient.get<ApiResponse<SubscriptionDto>>(`/MonthlySubscription/${item.subscriptionId}`)
      setSelected(response.isSuccess && response.result ? response.result : item)
    } catch { setSelected(item) }
  }

  const openEdit = (item: SubscriptionDto) => {
    setForm({ licensePlate: item.licensePlate, startDate: dateInput(item.startDate), endDate: dateInput(item.endDate), status: item.status, fixedSlotId: '' })
    setEditing(item)
    setSelected(null)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)
    const payload: Record<string, string> = {
      startDate: vietnamDateBoundaryToUtcIso(form.startDate),
      endDate: vietnamDateBoundaryToUtcIso(form.endDate, true), status: form.status,
    }
    if (form.fixedSlotId) payload.fixedSlotId = form.fixedSlotId
    try {
      const response = await apiClient.put<ApiResponse<SubscriptionDto>>(`/MonthlySubscription/${editing.subscriptionId}`, payload)
      if (!response.isSuccess) throw new Error(response.message || 'Không thể cập nhật đăng ký tháng.')
      setEditing(null)
      await fetchData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật đăng ký tháng.')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/MonthlySubscription/${deleteTarget.subscriptionId}`)
    if (!response.isSuccess) throw new Error(response.message || 'Không thể xóa đăng ký tháng.')
    setDeleteTarget(null)
    setSelected(null)
    await fetchData()
  }

  return <ManagerPageShell activeItem="monthly-subscriptions">
    <div className="staff-content-wrapper manager-resource-page">
      <header className="manager-resource-header"><div className="manager-resource-title"><span className="manager-resource-icon manager-resource-icon--purple"><CalendarRange size={24} /></span><div><h2>Đăng ký gửi xe tháng</h2><p>Quản lý các gói tháng khách hàng đã đăng ký và thanh toán.</p></div></div><div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchData} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm đăng ký</button></div></header>
      <section className="manager-summary-grid manager-summary-grid--four"><article className="manager-summary-card"><span>Tổng đăng ký</span><strong>{items.length}</strong><small>Tất cả trạng thái</small></article><article className="manager-summary-card manager-summary-card--green"><span>Đang hiệu lực</span><strong>{items.filter((x) => x.status.toLowerCase() === 'active').length}</strong><small>Được phép sử dụng</small></article><article className="manager-summary-card manager-summary-card--orange"><span>Chờ thanh toán</span><strong>{items.filter((x) => x.status.toLowerCase() === 'pendingpayment').length}</strong><small>Chưa kích hoạt</small></article><article className="manager-summary-card manager-summary-card--red"><span>Hết hạn/đã hủy</span><strong>{items.filter((x) => ['expired','cancelled'].includes(x.status.toLowerCase())).length}</strong><small>Không còn hiệu lực</small></article></section>
      <section className="card-panel manager-resource-panel"><div className="manager-resource-toolbar manager-resource-toolbar--wrap"><label className="manager-search-field"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm khách hàng, biển số, gói hoặc slot..." />{query && <button onClick={() => setQuery('')}><X size={16} /></button>}</label><div className="manager-filter-controls"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="pendingpayment">Chờ thanh toán</option><option value="active">Đang hiệu lực</option><option value="cancelled">Đã hủy</option><option value="expired">Hết hạn</option></select></div></div>
        {error && <div className="manager-inline-error">{error}</div>}
        <div className="table-wrap manager-table-wrap"><table className="ui-table manager-resource-table"><thead><tr><th>Khách hàng</th><th>Biển số</th><th>Gói / loại xe</th><th>Thời hạn</th><th>Giá</th><th>Slot</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{loading && items.length === 0 && <tr><td colSpan={8}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>}{!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="manager-empty-state">Không có đăng ký phù hợp.</div></td></tr>}{filtered.map((item) => <tr key={item.subscriptionId}><td><strong>{item.fullName || 'Chưa có tên'}</strong></td><td><strong>{item.licensePlate}</strong></td><td>{item.packageName || '—'}<br/><small>{item.vehicleType || '—'}</small></td><td>{formatUtcToVietnamDate(item.startDate)} – {formatUtcToVietnamDate(item.endDate)}</td><td>{formatCurrency(item.price)}</td><td>{item.fixedSlot || 'Không cố định'}</td><td><span className={`manager-session-status status-${item.status.toLowerCase()}`}><i />{statusLabel(item.status)}</span></td><td><div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => void openDetail(item)}><Eye size={15} /> Xem</button><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(item)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /> Xóa</button></div></td></tr>)}</tbody></table></div>
      </section>
    </div>
    {creating && (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !saving && setCreating(false)}>
        <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="create-subscription-title">
          <div className="manager-modal-header">
            <div><h3 id="create-subscription-title" className="modal-title">Thêm đăng ký gửi xe tháng</h3><p>Đăng ký mới sẽ ở trạng thái chờ khách hàng thanh toán.</p></div>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setCreating(false)} disabled={saving}><X size={20} /></button>
          </div>
          <form onSubmit={create}>
            <div className="form-grid-2">
              <div className="form-field form-field--full">
                <label htmlFor="subscription-user">Khách hàng *</label>
                <select id="subscription-user" required value={createForm.userId} onChange={(e) => setCreateForm({...createForm, userId: e.target.value})}>
                  <option value="" disabled>-- Chọn khách hàng --</option>
                  {users.map((user) => <option key={user.userId} value={user.userId}>{user.fullName} · {user.email}</option>)}
                </select>
                {users.length === 0 && <small className="field-hint">Không có tài khoản khách hàng đang hoạt động.</small>}
              </div>
              <div className="form-field">
                <label htmlFor="subscription-package">Gói tháng *</label>
                <select id="subscription-package" required value={createForm.packageId} onChange={(e) => setCreateForm({...createForm, packageId: e.target.value, fixedSlotId: ''})}>
                  <option value="" disabled>-- Chọn gói --</option>
                  {packages.map((item) => <option key={item.packageId} value={item.packageId}>{item.packageName} · {item.vehicleTypeName || 'Chưa rõ loại xe'} · {formatCurrency(item.price)}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="subscription-license-plate">Biển số *</label>
                <input id="subscription-license-plate" required value={createForm.licensePlate} onChange={(e) => setCreateForm({...createForm, licensePlate: normalizeLicensePlate(e.target.value)})} placeholder="VD: 51A12345" />
              </div>
              {requiresFixedSlot && <div className="form-field form-field--full">
                <label htmlFor="subscription-slot">Slot cố định *</label>
                <select id="subscription-slot" required value={createForm.fixedSlotId} onChange={(e) => setCreateForm({...createForm, fixedSlotId: e.target.value})}>
                  <option value="" disabled>-- Chọn slot còn trống tại tầng cư dân --</option>
                  {availableCreateSlots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.slotCode}{slot.floorName ? ` · ${slot.floorName}` : ''}</option>)}
                </select>
                {availableCreateSlots.length === 0 && <small className="field-hint">Không còn slot phù hợp với loại xe của gói.</small>}
              </div>}
            </div>
            {error && <div className="manager-inline-error" role="alert">{error}</div>}
            <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving || !createForm.userId || !createForm.packageId || !createForm.licensePlate.trim() || (requiresFixedSlot && !createForm.fixedSlotId)}>{saving ? 'Đang thêm...' : 'Thêm đăng ký'}</button></div>
          </form>
        </div>
      </div>
    )}
    {editing && (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
        <div className="modal-panel manager-form-modal">
          <div className="manager-modal-header">
            <div><h3 className="modal-title">Sửa đăng ký tháng</h3><p>{editing.fullName || editing.subscriptionId}</p></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}><X size={20} /></button>
          </div>
          <form onSubmit={save}>
            <div className="form-grid-2">
              <div className="form-field">
                <label>Biển số</label>
                <input value={form.licensePlate} readOnly disabled />
                <small className="field-hint">Biển số chỉ thay đổi qua quy trình duyệt yêu cầu đổi biển số.</small>
              </div>
              <div className="form-field"><label>Trạng thái *</label><select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}><option value="PendingPayment">Chờ thanh toán</option><option value="Active">Đang hiệu lực</option><option value="Cancelled">Đã hủy</option><option value="Expired">Hết hạn</option></select></div>
              <div className="form-field"><label>Ngày bắt đầu *</label><input type="date" required value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} /></div>
              <div className="form-field"><label>Ngày kết thúc *</label><input type="date" required value={form.endDate} onChange={(e) => setForm({...form, endDate: e.target.value})} /></div>
              <div className="form-field form-field--full"><label>Đổi slot cố định</label><select value={form.fixedSlotId} onChange={(e) => setForm({...form, fixedSlotId: e.target.value})}><option value="">Giữ nguyên: {editing.fixedSlot || 'Không cố định'}</option>{slots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.slotCode}{slot.status ? ` · ${slot.status}` : ''}</option>)}</select></div>
            </div>
            {error && <div className="manager-inline-error">{error}</div>}
            <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
          </form>
        </div>
      </div>
    )}
    {selected && <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}><div className="modal-panel manager-form-modal"><div className="manager-modal-header"><div><h3 className="modal-title">Chi tiết đăng ký tháng</h3><p>{selected.subscriptionId}</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}><X size={20} /></button></div><div className="manager-payment-detail-grid"><div><span>Khách hàng</span><strong>{selected.fullName || 'Chưa có tên'}</strong></div><div><span>Biển số</span><strong>{selected.licensePlate}</strong></div><div><span>Gói</span><strong>{selected.packageName || '—'}</strong></div><div><span>Loại xe</span><strong>{selected.vehicleType || '—'}</strong></div><div><span>Bắt đầu</span><strong>{formatUtcToVietnamDateTime(selected.startDate)}</strong></div><div><span>Kết thúc</span><strong>{formatUtcToVietnamDateTime(selected.endDate)}</strong></div><div><span>Giá</span><strong>{formatCurrency(selected.price)}</strong></div><div><span>Slot</span><strong>{selected.fixedSlot || 'Không cố định'}</strong></div></div><div className="form-actions"><button type="button" className="btn btn-outline manager-edit-button" onClick={() => openEdit(selected)}><Pencil size={16} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost manager-danger-action" onClick={() => setDeleteTarget(selected)}><Trash2 size={16} /> Xóa</button></div></div></div>}
    <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa đăng ký gửi xe tháng?" description={<>Bạn có chắc muốn xóa đăng ký của xe <strong>{deleteTarget?.licensePlate}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.licensePlate} targetMeta={deleteTarget ? `${deleteTarget.fullName || 'Chưa có tên'} · ${deleteTarget.packageName || 'Chưa rõ gói'}` : undefined} targetIcon={<CalendarRange size={18} aria-hidden />} note="Quyền sử dụng gói và slot cố định liên quan có thể bị ảnh hưởng sau khi xóa." errorFallback="Không thể xóa đăng ký tháng." onCancel={() => setDeleteTarget(null)} onConfirm={remove} />
  </ManagerPageShell>
}
