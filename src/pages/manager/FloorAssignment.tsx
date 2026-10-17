import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, CarFront, Layers3, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { ApiRequestError, apiClient } from '../../config/api'

interface Floor {
  floorId: string
  floorName: string
  totalCapacity: number
  dedicatedVehicleTypeId?: string | null
  dedicatedVehicleTypeName?: string | null
  isResident: boolean
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

type FloorScope = 'all' | 'resident' | 'public'

const EMPTY_FORM = {
  floorName: '',
  totalCapacity: '',
  dedicatedVehicleTypeId: '',
  isResident: false,
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ManagerFloorAssignment() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<FloorScope>('all')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Floor | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Floor | null>(null)

  const fetchFloors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<Floor[]>>('/Floor')
      setFloors(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      if (!res.isSuccess) setError(res.message ?? 'Không thể tải danh sách tầng.')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.statusCode === 404) {
        setFloors([])
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
    await Promise.all([fetchFloors(), fetchVehicleTypes()])
  }, [fetchFloors, fetchVehicleTypes])

  useEffect(() => {
    queueMicrotask(() => void refreshData())
  }, [refreshData])

  const filteredFloors = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return floors.filter((floor) => {
      const matchesScope = scope === 'all' || (scope === 'resident' ? floor.isResident : !floor.isResident)
      const matchesQuery = !normalized || `${floor.floorName} ${floor.dedicatedVehicleTypeName ?? ''}`.toLowerCase().includes(normalized)
      return matchesScope && matchesQuery
    })
  }, [floors, query, scope])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (floor: Floor) => {
    setEditTarget(floor)
    setForm({
      floorName: floor.floorName,
      totalCapacity: String(floor.totalCapacity),
      dedicatedVehicleTypeId: floor.dedicatedVehicleTypeId ?? '',
      isResident: floor.isResident,
    })
    setFormError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    const floorName = form.floorName.trim()
    const totalCapacity = Number(form.totalCapacity)
    if (!floorName) {
      setFormError('Vui lòng nhập tên tầng.')
      return
    }
    if (!Number.isInteger(totalCapacity) || totalCapacity < 1) {
      setFormError('Sức chứa phải là số nguyên lớn hơn 0.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        floorName,
        totalCapacity,
        isResident: form.isResident,
        dedicatedVehicleTypeId: form.dedicatedVehicleTypeId || null,
      }
      const res = editTarget
        ? await apiClient.put<ApiResponse<Floor>>('/Floor', { floorId: editTarget.floorId, ...payload })
        : await apiClient.post<ApiResponse<Floor>>('/Floor', payload)

      if (!res.isSuccess) {
        setFormError(res.message ?? 'Không thể lưu thông tin tầng.')
        return
      }
      closeModal()
      await fetchFloors()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Lưu thất bại. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/Floor/${deleteTarget.floorId}`)
    if (!response.isSuccess) throw new Error(response.message ?? 'Không thể xóa tầng này.')
    setDeleteTarget(null)
    await fetchFloors()
  }

  const residentCount = floors.filter((floor) => floor.isResident).length
  const totalCapacity = floors.reduce((sum, floor) => sum + floor.totalCapacity, 0)

  return (
    <ManagerPageShell activeItem="floors">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--purple"><Layers3 size={24} aria-hidden /></span>
            <div><h2>Quản lý tầng</h2><p>Cấu hình sức chứa, khu vực phục vụ và loại phương tiện chuyên dụng cho từng tầng.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={refreshData} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm tầng</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--three" aria-label="Tổng quan tầng">
          <article className="manager-summary-card"><span>Tổng số tầng</span><strong>{floors.length}</strong><small>Đang được cấu hình</small></article>
          <article className="manager-summary-card manager-summary-card--accent"><span>Tổng sức chứa</span><strong>{totalCapacity}</strong><small>Vị trí trên toàn bãi</small></article>
          <article className="manager-summary-card manager-summary-card--purple"><span>Tầng cư dân</span><strong>{residentCount}</strong><small>{floors.length - residentCount} tầng khách/vãng lai</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field" htmlFor="floor-search"><Search size={18} aria-hidden /><input id="floor-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên tầng hoặc loại xe..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-filter-controls"><select aria-label="Lọc loại tầng" value={scope} onChange={(event) => setScope(event.target.value as FloorScope)}>
              <option value="all">Tất cả loại tầng</option>
              <option value="public">Tầng dành cho khách</option>
              <option value="resident">Tầng dành cho cư dân</option>
            </select></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          {loading && floors.length === 0 ? (
            <div className="manager-empty-state">Đang tải dữ liệu...</div>
          ) : filteredFloors.length === 0 ? (
            <div className="manager-empty-state"><Building2 size={34} aria-hidden /><strong>Không có tầng phù hợp</strong><span>{query || scope !== 'all' ? 'Hãy thay đổi bộ lọc.' : 'Hãy thêm tầng đầu tiên để bắt đầu.'}</span></div>
          ) : (
            <div className="manager-floor-grid">
              {filteredFloors.map((floor) => (
                <article key={floor.floorId} className="manager-floor-card">
                  <div className="manager-floor-card-head">
                    <span className={`manager-floor-symbol${floor.isResident ? ' resident' : ''}`}><Building2 size={22} aria-hidden /></span>
                    <div><h3>{floor.floorName}</h3><span className={`manager-floor-scope${floor.isResident ? ' resident' : ''}`}>{floor.isResident ? 'Tầng cư dân' : 'Tầng khách'}</span></div>
                  </div>
                  <div className="manager-floor-metrics">
                    <div><span>Sức chứa</span><strong>{floor.totalCapacity}</strong><small>vị trí</small></div>
                    <div><span>Phương tiện</span><strong className="manager-floor-vehicle"><CarFront size={16} aria-hidden /> {floor.dedicatedVehicleTypeName || 'Dùng chung'}</strong></div>
                  </div>
                  <div className="manager-floor-card-actions">
                    <button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(floor)}><Pencil size={15} aria-hidden /> Sửa</button>
                    <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(floor)}><Trash2 size={15} aria-hidden /> Xóa</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="floor-modal-title">
            <div className="manager-modal-header"><div><h3 id="floor-modal-title" className="modal-title">{editTarget ? 'Cập nhật tầng' : 'Thêm tầng mới'}</h3><p>Thiết lập thông tin vận hành cơ bản của tầng.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={saving}><X size={20} aria-hidden /></button></div>
            <form onSubmit={handleSave}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="floor-name">Tên tầng *</label><input id="floor-name" autoFocus maxLength={50} value={form.floorName} onChange={(event) => setForm({ ...form, floorName: event.target.value })} placeholder="Ví dụ: B1" /></div>
                <div className="form-field"><label htmlFor="floor-capacity">Sức chứa *</label><input id="floor-capacity" type="number" min={1} step={1} value={form.totalCapacity} onChange={(event) => setForm({ ...form, totalCapacity: event.target.value })} placeholder="Ví dụ: 100" /></div>
                <div className="form-field form-field--full"><label htmlFor="floor-vehicle">Loại phương tiện chuyên dụng</label><select id="floor-vehicle" value={form.dedicatedVehicleTypeId} onChange={(event) => setForm({ ...form, dedicatedVehicleTypeId: event.target.value })}><option value="">Dùng chung cho nhiều loại xe</option>{vehicleTypes.map((vehicleType) => <option key={vehicleType.vehicleTypeId} value={vehicleType.vehicleTypeId}>{vehicleType.typeName}</option>)}</select><small className="field-hint">Chọn một loại nếu tầng chỉ phục vụ riêng loại phương tiện đó.</small></div>
                <label className="manager-checkbox-card form-field--full" htmlFor="floor-resident"><input id="floor-resident" type="checkbox" checked={form.isResident} onChange={(event) => setForm({ ...form, isResident: event.target.checked })} /><span><Users size={19} aria-hidden /><span><strong>Tầng dành cho cư dân / khách tháng</strong><small>Slot tại tầng này được ưu tiên cho gói gửi xe tháng.</small></span></span></label>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving || !form.floorName.trim() || !form.totalCapacity}>{saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm tầng'}</button></div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa tầng?" description={<>Bạn có chắc muốn xóa tầng <strong>{deleteTarget?.floorName}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.floorName} targetMeta={deleteTarget ? `${deleteTarget.totalCapacity} vị trí · ${deleteTarget.dedicatedVehicleTypeName || 'Dùng chung'}` : undefined} targetIcon={<Layers3 size={18} aria-hidden />} note="Các slot hoặc cổng đang liên kết với tầng có thể khiến thao tác xóa thất bại." errorFallback="Không thể xóa tầng." onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </ManagerPageShell>
  )
}
