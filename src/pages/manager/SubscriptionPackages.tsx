import { useEffect, useState } from 'react'
import { CalendarDays, CarFront, MapPin, Package, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { formatCurrency } from '../../utils/pricing'

interface SubscriptionPackage {
  packageId: string
  packageName: string
  price: number
  duration?: number
  durationMonths?: number
  description?: string
  vehicleTypeId?: string
  vehicleTypeName?: string
  requireFixedSlot?: boolean
  status?: string
}

interface VehicleType {
  vehicleTypeId: string
  typeName: string
}

interface ApiResponse<T> {
  isSuccess: boolean
  result: T
  message?: string
}

const EMPTY_FORM = {
  packageName: '',
  price: '',
  duration: '',
  description: '',
  vehicleTypeId: '',
  requireFixedSlot: false,
  status: 'Active',
}

const isMotorbike = (typeName?: string) => {
  const normalized = (typeName ?? '').toLowerCase()
  return normalized.includes('motor') || normalized.includes('bike') || normalized.includes('xe máy') || normalized.includes('xe may')
}

const statusLabel = (status?: string) => {
  const normalized = (status ?? '').toLowerCase()
  if (normalized === 'active') return 'Đang bán'
  if (normalized === 'inactive') return 'Ngừng bán'
  if (normalized === 'suspended') return 'Tạm ngưng'
  return status || 'Chưa xác định'
}

export default function ManagerSubscriptionPackages() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<SubscriptionPackage | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPackage | null>(null)

  const fetchPackages = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<SubscriptionPackage[]>>('/SubscriptionPackage')
      if (res.isSuccess) {
        setPackages(res.result)
      } else {
        setError(res.message ?? 'Không thể tải danh sách gói thuê bao.')
      }
    } catch (e) {
      console.error(e)
      setError('Không thể tải danh sách gói thuê bao.')
    } finally {
      setLoading(false)
    }
  }

  const fetchVehicleTypes = async () => {
    try {
      const res = await apiClient.get<ApiResponse<VehicleType[]>>('/VehicleType')
      if (res.isSuccess) setVehicleTypes(res.result)
      else setError(res.message ?? 'Không thể tải danh sách loại phương tiện.')
    } catch (e) {
      console.error(e)
      setError('Không thể tải danh sách loại phương tiện.')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPackages()
      void fetchVehicleTypes()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const openCreate = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM, vehicleTypeId: vehicleTypes[0]?.vehicleTypeId ?? '' })
    setShowModal(true)
  }

  const openEdit = (p: SubscriptionPackage) => {
    setEditTarget(p)
    const dur = p.durationMonths !== undefined ? p.durationMonths : p.duration ?? 0
    setForm({
      packageName: p.packageName,
      price: String(p.price),
      duration: String(dur),
      description: p.description ?? '',
      vehicleTypeId: p.vehicleTypeId ?? '',
      requireFixedSlot: p.requireFixedSlot ?? false,
      status: p.status ?? 'Active',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        packageName: form.packageName.trim(),
        price: Number(form.price),
        duration: Number(form.duration),
        durationMonths: Number(form.duration),
        description: form.description.trim() || null,
        vehicleTypeId: form.vehicleTypeId,
        requireFixedSlot: form.requireFixedSlot,
        status: form.status,
      }

      if (editTarget) {
        const res = await apiClient.put<ApiResponse<unknown>>(
          `/SubscriptionPackage/${editTarget.packageId}`,
          payload,
        )
        if (!res.isSuccess) throw new Error(res.message || 'Lưu gói thất bại')
      } else {
        const res = await apiClient.post<ApiResponse<unknown>>('/SubscriptionPackage', payload)
        if (!res.isSuccess) throw new Error(res.message || 'Tạo gói thất bại')
      }
      closeModal()
      await fetchPackages()
    } catch (e: unknown) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/SubscriptionPackage/${deleteTarget.packageId}`)
    if (!response.isSuccess) throw new Error(response.message || 'Ngừng bán gói thất bại.')
    setDeleteTarget(null)
    await fetchPackages()
  }

  const getDuration = (p: SubscriptionPackage) =>
    p.durationMonths !== undefined ? p.durationMonths : p.duration ?? 0

  const selectedVehicleType = vehicleTypes.find((item) => item.vehicleTypeId === form.vehicleTypeId)
  const selectedIsMotorbike = isMotorbike(selectedVehicleType?.typeName)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredPackages = packages.filter((item) => {
    const isActive = (item.status ?? '').toLowerCase() === 'active'
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? isActive : !isActive)
    const matchesQuery = !normalizedQuery || item.packageName.toLowerCase().includes(normalizedQuery) || (item.vehicleTypeName ?? '').toLowerCase().includes(normalizedQuery)
    return matchesStatus && matchesQuery
  })
  const activeCount = packages.filter((item) => (item.status ?? '').toLowerCase() === 'active').length
  const fixedSlotCount = packages.filter((item) => item.requireFixedSlot).length
  const coveredVehicleTypes = new Set(packages.map((item) => item.vehicleTypeId).filter(Boolean)).size
  const hasFilters = Boolean(query || statusFilter !== 'all')

  return (
    <ManagerPageShell activeItem="subscriptions">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--purple"><Package size={24} aria-hidden /></span>
            <div><h2>Quản lý gói tháng</h2><p>Thiết lập mức giá, thời hạn và cách phân bổ vị trí cho từng loại phương tiện.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={() => { void fetchPackages(); void fetchVehicleTypes() }} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate} disabled={vehicleTypes.length === 0}><Plus size={18} aria-hidden /> Thêm gói</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four" aria-label="Tổng quan gói tháng">
          <article className="manager-summary-card"><span>Tổng số gói</span><strong>{packages.length}</strong><small>Bao gồm mọi trạng thái</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Đang bán</span><strong>{activeCount}</strong><small>Khách hàng có thể đăng ký</small></article>
          <article className="manager-summary-card manager-summary-card--purple"><span>Có vị trí cố định</span><strong>{fixedSlotCount}</strong><small>Cho phép chọn chỗ đỗ</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Loại xe đã có gói</span><strong>{coveredVehicleTypes}/{vehicleTypes.length}</strong><small>Phạm vi phương tiện hỗ trợ</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field" htmlFor="package-search"><Search size={18} aria-hidden /><input id="package-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên gói hoặc loại xe..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-filter-controls"><select aria-label="Lọc trạng thái gói" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}><option value="all">Tất cả trạng thái</option><option value="active">Đang bán</option><option value="inactive">Ngừng bán</option></select></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && packages.length === 0 ? (
            <div className="manager-empty-state">Đang tải danh sách gói...</div>
          ) : filteredPackages.length === 0 ? (
            <div className="manager-empty-state"><Package size={34} aria-hidden /><strong>Không có gói phù hợp</strong><span>{hasFilters ? 'Hãy thay đổi bộ lọc hoặc từ khóa.' : 'Hãy thêm gói tháng đầu tiên.'}</span></div>
          ) : (
            <div className="manager-package-grid">
              {filteredPackages.map((item) => {
                const isActive = (item.status ?? '').toLowerCase() === 'active'
                return (
                  <article key={item.packageId} className={`manager-package-card${isActive ? ' active' : ''}`}>
                    <div className="manager-package-card-head"><span className="manager-package-symbol"><Package size={21} aria-hidden /></span><div><h3>{item.packageName}</h3><span className="manager-package-vehicle"><CarFront size={14} aria-hidden />{item.vehicleTypeName || 'Chưa xác định loại xe'}</span></div><span className={`manager-package-status${isActive ? ' active' : ''}`}><i />{statusLabel(item.status)}</span></div>
                    <div className="manager-package-price"><span>Giá gói</span><strong>{formatCurrency(item.price)}</strong><small>cho {getDuration(item)} tháng</small></div>
                    <div className="manager-package-details"><div><CalendarDays size={17} aria-hidden /><span>Thời hạn</span><strong>{getDuration(item)} tháng</strong></div><div><MapPin size={17} aria-hidden /><span>Phân bổ chỗ</span><strong>{item.requireFixedSlot ? 'Khách chọn cố định' : 'Hệ thống tự chọn'}</strong></div></div>
                    <p className="manager-package-description">{item.description || 'Chưa có mô tả cho gói này.'}</p>
                    <div className="manager-pricing-actions"><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(item)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(item)}><Trash2 size={15} aria-hidden /> Ngừng bán</button></div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="modal-panel manager-form-modal manager-package-modal" role="dialog" aria-modal="true" aria-labelledby="package-modal-title">
            <div className="manager-modal-header"><div><h3 id="package-modal-title" className="modal-title">{editTarget ? 'Cập nhật gói tháng' : 'Thêm gói tháng'}</h3><p>Thông tin này sẽ hiển thị cho khách hàng khi đăng ký.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={saving}><X size={20} aria-hidden /></button></div>
            <form onSubmit={handleSave}>
              <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="pkg-name">Tên gói *</label>
                <input
                  id="pkg-name"
                  type="text"
                  required
                  value={form.packageName}
                  onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                  placeholder="VD: Gói cơ bản"
                />
              </div>
              <div className="form-field">
                <label htmlFor="pkg-vehicle-type">Loại phương tiện *</label>
                <select
                  id="pkg-vehicle-type"
                  required
                  value={form.vehicleTypeId}
                  onChange={(e) => {
                    const nextType = vehicleTypes.find((item) => item.vehicleTypeId === e.target.value)
                    setForm({
                      ...form,
                      vehicleTypeId: e.target.value,
                      requireFixedSlot: isMotorbike(nextType?.typeName) ? false : form.requireFixedSlot,
                    })
                  }}
                >
                  <option value="" disabled>-- Chọn loại xe --</option>
                  {vehicleTypes.map((item) => (
                    <option key={item.vehicleTypeId} value={item.vehicleTypeId}>{item.typeName}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="pkg-price">Giá (VNĐ) *</label>
                <input
                  id="pkg-price"
                  type="number"
                  required
                  min={1}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="VD: 200000"
                />
              </div>
              <div className="form-field">
                <label htmlFor="pkg-duration">Thời hạn (tháng) *</label>
                <input
                  id="pkg-duration"
                  type="number"
                  required
                  min={1}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="VD: 1"
                />
              </div>
              <div className="form-field form-field--full">
                <label htmlFor="pkg-desc">Mô tả</label>
                <textarea
                  id="pkg-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết về gói thuê bao..."
                />
              </div>
              <div className="form-field form-field--full">
                <label className="manager-checkbox-card">
                  <input
                    type="checkbox"
                    checked={form.requireFixedSlot}
                    disabled={selectedIsMotorbike}
                    onChange={(e) => setForm({ ...form, requireFixedSlot: e.target.checked })}
                  />
                  <span><MapPin size={18} aria-hidden /><span><strong>Cho phép khách hàng chọn vị trí ô tô cố định</strong><small>{selectedIsMotorbike ? 'Xe máy không sử dụng vị trí cố định.' : 'Vị trí được giữ cố định trong thời gian sử dụng gói.'}</small></span></span>
                </label>
              </div>
              <div className="form-field">
                <label htmlFor="pkg-status">Trạng thái *</label>
                <select
                  id="pkg-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Active">Đang bán</option>
                  <option value="Inactive">Ngừng bán</option>
                  <option value="Suspended">Tạm ngưng</option>
                </select>
              </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm gói'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Ngừng bán gói tháng?" description={<>Bạn có chắc muốn ngừng bán gói <strong>{deleteTarget?.packageName}</strong>?</>} targetLabel={deleteTarget?.packageName} targetMeta={deleteTarget ? `${deleteTarget.vehicleTypeName || 'Chưa rõ loại xe'} · ${formatCurrency(deleteTarget.price)}` : undefined} targetIcon={<Package size={18} aria-hidden />} note="Khách hàng sẽ không thể đăng ký mới; các đăng ký đang hiệu lực không bị xóa." confirmLabel="Xác nhận ngừng bán" loadingLabel="Đang cập nhật..." errorFallback="Không thể ngừng bán gói." variant="warning" onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </ManagerPageShell>
  )
}
