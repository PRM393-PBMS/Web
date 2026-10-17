import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BadgeDollarSign,
  CarFront,
  Clock3,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { ApiRequestError, apiClient } from '../../config/api'
import { formatUtcToVietnamDate, toVietnamDateInput } from '../../utils/dateTime'

interface PricingPolicy {
  policyId: string
  vehicleTypeId: string
  vehicleTypeName?: string | null
  basePrice: number
  baseHours: number
  extraHourPrice: number
  nightSurcharge?: number | null
  effectiveDate: string
  status: string
}

interface VehicleType {
  vehicleTypeId: string
  typeName: string
}

interface ApiResponse<T = unknown> {
  isSuccess: boolean
  result: T
  message?: string
}

interface PricingForm {
  vehicleTypeId: string
  basePrice: string
  baseHours: string
  extraHourPrice: string
  nightSurcharge: string
  effectiveDate: string
  status: 'Active' | 'Inactive'
}

function createEmptyForm(): PricingForm {
  return {
    vehicleTypeId: '',
    basePrice: '',
    baseHours: '1',
    extraHourPrice: '',
    nightSurcharge: '0',
    effectiveDate: toVietnamDateInput(),
    status: 'Active',
  }
}

function formatVND(amount?: number | null) {
  return `${(amount ?? 0).toLocaleString('vi-VN')} ₫`
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ManagerPricing() {
  const [policies, setPolicies] = useState<PricingPolicy[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PricingPolicy | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<PricingPolicy | null>(null)
  const [form, setForm] = useState<PricingForm>(createEmptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<PricingPolicy[]>>('/PricingPolicy')
      setPolicies(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      if (!res.isSuccess) setError(res.message ?? 'Không thể tải bảng giá.')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.statusCode === 404) {
        setPolicies([])
      } else {
        setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchVehicleTypes = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse<VehicleType[]>>('/VehicleType')
      setVehicleTypes(res.isSuccess && Array.isArray(res.result) ? res.result : [])
    } catch (requestError) {
      if (!(requestError instanceof ApiRequestError && requestError.statusCode === 404)) {
        console.error('Không thể tải loại phương tiện:', requestError)
      }
      setVehicleTypes([])
    }
  }, [])

  const refreshData = useCallback(async () => {
    await Promise.all([fetchPolicies(), fetchVehicleTypes()])
  }, [fetchPolicies, fetchVehicleTypes])

  useEffect(() => {
    queueMicrotask(() => void refreshData())
  }, [refreshData])

  const filteredPolicies = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return policies.filter((policy) => {
      if (statusFilter !== 'all' && policy.status.toLowerCase() !== statusFilter) return false
      if (normalized && !`${policy.vehicleTypeName ?? ''} ${policy.policyId}`.toLowerCase().includes(normalized)) return false
      return true
    })
  }, [policies, query, statusFilter])

  const openCreate = () => {
    setEditTarget(null)
    setForm(createEmptyForm())
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (policy: PricingPolicy) => {
    setEditTarget(policy)
    setForm({
      vehicleTypeId: policy.vehicleTypeId,
      basePrice: String(policy.basePrice),
      baseHours: String(policy.baseHours),
      extraHourPrice: String(policy.extraHourPrice),
      nightSurcharge: String(policy.nightSurcharge ?? 0),
      effectiveDate: policy.effectiveDate ? toVietnamDateInput(policy.effectiveDate) : toVietnamDateInput(),
      status: policy.status.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return
    setShowModal(false)
    setEditTarget(null)
    setForm(createEmptyForm())
    setFormError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const basePrice = Number(form.basePrice)
    const baseHours = Number(form.baseHours)
    const extraHourPrice = Number(form.extraHourPrice)
    const nightSurcharge = Number(form.nightSurcharge || 0)

    if (!form.vehicleTypeId) {
      setFormError('Vui lòng chọn loại phương tiện.')
      return
    }
    if (!form.effectiveDate) {
      setFormError('Vui lòng chọn ngày hiệu lực.')
      return
    }
    if ([basePrice, extraHourPrice, nightSurcharge].some((value) => !Number.isFinite(value) || value < 0)) {
      setFormError('Các mức giá phải là số không âm.')
      return
    }
    if (!Number.isInteger(baseHours) || baseHours < 1) {
      setFormError('Số giờ cơ bản phải là số nguyên lớn hơn 0.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        vehicleTypeId: form.vehicleTypeId,
        basePrice,
        baseHours,
        extraHourPrice,
        nightSurcharge,
        effectiveDate: form.effectiveDate,
        status: form.status,
      }
      const res = editTarget
        ? await apiClient.put<ApiResponse<PricingPolicy>>('/PricingPolicy', { policyId: editTarget.policyId, ...payload })
        : await apiClient.post<ApiResponse<PricingPolicy>>('/PricingPolicy', payload)

      if (!res.isSuccess) {
        setFormError(res.message ?? 'Không thể lưu chính sách giá.')
        return
      }
      setShowModal(false)
      setEditTarget(null)
      await fetchPolicies()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Lưu chính sách thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse>(`/PricingPolicy/${deleteTarget.policyId}`)
    if (!response.isSuccess) throw new Error(response.message ?? 'Không thể xóa chính sách giá.')
    setDeleteTarget(null)
    await fetchPolicies()
  }

  const activeCount = policies.filter((policy) => policy.status.toLowerCase() === 'active').length
  const coveredVehicleTypes = new Set(policies.filter((policy) => policy.status.toLowerCase() === 'active').map((policy) => policy.vehicleTypeId)).size
  const hasFilters = Boolean(query || statusFilter !== 'all')

  return (
    <ManagerPageShell activeItem="pricing">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--money"><BadgeDollarSign size={25} aria-hidden /></span>
            <div><h2>Bảng giá đỗ xe</h2><p>Thiết lập giá cơ bản, giờ phát sinh và phụ thu đêm cho từng loại phương tiện.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={refreshData} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate} disabled={vehicleTypes.length === 0}><Plus size={18} aria-hidden /> Thêm chính sách</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--three" aria-label="Tổng quan bảng giá">
          <article className="manager-summary-card"><span>Tổng chính sách</span><strong>{policies.length}</strong><small>Bao gồm đang và ngừng áp dụng</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Đang áp dụng</span><strong>{activeCount}</strong><small>Chính sách có hiệu lực</small></article>
          <article className="manager-summary-card manager-summary-card--money"><span>Loại xe đã có giá</span><strong>{coveredVehicleTypes}/{vehicleTypes.length}</strong><small>Theo chính sách đang hoạt động</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field" htmlFor="pricing-search"><Search size={18} aria-hidden /><input id="pricing-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo loại phương tiện..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-filter-controls"><select aria-label="Lọc trạng thái chính sách" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang áp dụng</option><option value="inactive">Ngừng áp dụng</option></select></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && policies.length === 0 ? (
            <div className="manager-empty-state">Đang tải bảng giá...</div>
          ) : filteredPolicies.length === 0 ? (
            <div className="manager-empty-state"><BadgeDollarSign size={34} aria-hidden /><strong>Không có chính sách phù hợp</strong><span>{hasFilters ? 'Hãy thay đổi bộ lọc.' : 'Hãy thêm chính sách giá đầu tiên.'}</span></div>
          ) : (
            <div className="manager-pricing-grid">
              {filteredPolicies.map((policy) => {
                const isActive = policy.status.toLowerCase() === 'active'
                return (
                  <article key={policy.policyId} className={`manager-pricing-card${isActive ? ' active' : ''}`}>
                    <div className="manager-pricing-card-head"><span><CarFront size={21} aria-hidden /></span><div><h3>{policy.vehicleTypeName || 'Chưa rõ loại xe'}</h3><small>Hiệu lực từ {formatUtcToVietnamDate(policy.effectiveDate) || '—'}</small></div><span className={`manager-pricing-status${isActive ? ' active' : ''}`}><i />{isActive ? 'Đang áp dụng' : 'Ngừng áp dụng'}</span></div>
                    <div className="manager-pricing-base"><span>Giá cơ bản</span><strong>{formatVND(policy.basePrice)}</strong><small>Cho {policy.baseHours} giờ đầu</small></div>
                    <div className="manager-pricing-rates"><div><Clock3 size={17} aria-hidden /><span>Giờ phát sinh</span><strong>{formatVND(policy.extraHourPrice)}<small>/giờ</small></strong></div><div><Moon size={17} aria-hidden /><span>Phụ thu đêm</span><strong>{formatVND(policy.nightSurcharge)}</strong></div></div>
                    <div className="manager-pricing-formula">Cách tính: {formatVND(policy.basePrice)} cho {policy.baseHours} giờ đầu + {formatVND(policy.extraHourPrice)} mỗi giờ tiếp theo{(policy.nightSurcharge ?? 0) > 0 ? ` + ${formatVND(policy.nightSurcharge)} nếu qua đêm` : ''}.</div>
                    <div className="manager-pricing-actions"><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(policy)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(policy)}><Trash2 size={15} aria-hidden /> Xóa</button></div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-form-modal manager-pricing-modal" role="dialog" aria-modal="true" aria-labelledby="pricing-modal-title">
            <div className="manager-modal-header"><div><h3 id="pricing-modal-title" className="modal-title">{editTarget ? 'Cập nhật chính sách giá' : 'Thêm chính sách giá'}</h3><p>Các mức giá được dùng để tính tiền khi xe checkout.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={saving}><X size={20} aria-hidden /></button></div>
            <form onSubmit={handleSave}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-grid-2">
                <div className="form-field form-field--full"><label htmlFor="pp-vtype">Loại phương tiện *</label><select id="pp-vtype" autoFocus required value={form.vehicleTypeId} onChange={(event) => setForm({ ...form, vehicleTypeId: event.target.value })}><option value="">Chọn loại phương tiện</option>{vehicleTypes.map((vehicleType) => <option key={vehicleType.vehicleTypeId} value={vehicleType.vehicleTypeId}>{vehicleType.typeName}</option>)}</select></div>
                <div className="form-field"><label htmlFor="pp-base-price">Giá cơ bản (VNĐ) *</label><input id="pp-base-price" type="number" min={0} step={1000} required value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} placeholder="Ví dụ: 30000" /></div>
                <div className="form-field"><label htmlFor="pp-base-hours">Số giờ cơ bản *</label><input id="pp-base-hours" type="number" min={1} step={1} required value={form.baseHours} onChange={(event) => setForm({ ...form, baseHours: event.target.value })} placeholder="Ví dụ: 2" /></div>
                <div className="form-field"><label htmlFor="pp-extra-hour">Giá mỗi giờ phát sinh (VNĐ) *</label><input id="pp-extra-hour" type="number" min={0} step={1000} required value={form.extraHourPrice} onChange={(event) => setForm({ ...form, extraHourPrice: event.target.value })} placeholder="Ví dụ: 10000" /></div>
                <div className="form-field"><label htmlFor="pp-night">Phụ thu qua đêm (VNĐ)</label><input id="pp-night" type="number" min={0} step={1000} value={form.nightSurcharge} onChange={(event) => setForm({ ...form, nightSurcharge: event.target.value })} placeholder="Ví dụ: 20000" /></div>
                <div className="form-field"><label htmlFor="pp-effective">Ngày hiệu lực *</label><input id="pp-effective" type="date" required value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></div>
                <div className="form-field"><label htmlFor="pp-status">Trạng thái</label><select id="pp-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PricingForm['status'] })}><option value="Active">Đang áp dụng</option><option value="Inactive">Ngừng áp dụng</option></select></div>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving || !form.vehicleTypeId || !form.basePrice || !form.baseHours || !form.extraHourPrice}>{saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm chính sách'}</button></div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa chính sách giá?" description={<>Bạn có chắc muốn xóa chính sách giá của <strong>{deleteTarget?.vehicleTypeName || 'loại xe này'}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.vehicleTypeName || 'Chưa rõ loại xe'} targetMeta={deleteTarget ? `${formatVND(deleteTarget.basePrice)} cho ${deleteTarget.baseHours} giờ đầu` : undefined} targetIcon={<BadgeDollarSign size={18} aria-hidden />} note="Việc xóa chính sách có thể ảnh hưởng đến cách tính tiền cho các phiên gửi xe mới." errorFallback="Không thể xóa chính sách giá." onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </ManagerPageShell>
  )
}
