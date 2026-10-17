import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CarFront, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { ApiRequestError, apiClient } from '../../config/api'

interface VehicleType {
  vehicleTypeId: string
  typeName: string
  dimensions?: string | null
}

interface ApiResponse<T> {
  isSuccess: boolean
  result: T
  message?: string
}

const EMPTY_FORM = { typeName: '', dimensions: '' }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function ManagerVehicleTypes() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<VehicleType | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<VehicleType | null>(null)

  const fetchVehicleTypes = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<VehicleType[]>>('/VehicleType')
      setVehicleTypes(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      if (!res.isSuccess) setError(res.message ?? 'Không thể tải danh sách loại phương tiện.')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.statusCode === 404) {
        setVehicleTypes([])
      } else {
        setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void fetchVehicleTypes())
  }, [])

  const filteredVehicleTypes = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return vehicleTypes
    return vehicleTypes.filter((item) =>
      `${item.typeName} ${item.dimensions ?? ''}`.toLowerCase().includes(normalized),
    )
  }, [query, vehicleTypes])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (vehicleType: VehicleType) => {
    setEditTarget(vehicleType)
    setForm({ typeName: vehicleType.typeName, dimensions: vehicleType.dimensions ?? '' })
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
    const typeName = form.typeName.trim()
    if (!typeName) {
      setFormError('Vui lòng nhập tên loại phương tiện.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = { typeName, dimensions: form.dimensions.trim() || null }
      const res = editTarget
        ? await apiClient.put<ApiResponse<VehicleType>>('/VehicleType', {
            vehicleTypeId: editTarget.vehicleTypeId,
            ...payload,
          })
        : await apiClient.post<ApiResponse<VehicleType>>('/VehicleType', payload)

      if (!res.isSuccess) {
        setFormError(res.message ?? 'Không thể lưu loại phương tiện.')
        return
      }
      closeModal()
      await fetchVehicleTypes()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Lưu thất bại. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = (vehicleType: VehicleType) => {
    setDeleteTarget(vehicleType)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/VehicleType/${deleteTarget.vehicleTypeId}`)
    if (!response.isSuccess) throw new Error(response.message ?? 'Không thể xóa loại phương tiện.')
    setDeleteTarget(null)
    await fetchVehicleTypes()
  }

  return (
    <ManagerPageShell activeItem="vehicles">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><CarFront size={24} aria-hidden /></span>
            <div>
              <h2>Quản lý loại phương tiện</h2>
              <p>Thiết lập loại xe và kích thước để áp dụng cho tầng, slot, bảng giá và gói tháng.</p>
            </div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchVehicleTypes} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}>
            <Plus size={18} aria-hidden /> Thêm loại xe
          </button></div>
        </header>

        <section className="manager-summary-grid" aria-label="Tổng quan loại phương tiện">
          <article className="manager-summary-card">
            <span>Tổng loại phương tiện</span>
            <strong>{vehicleTypes.length}</strong>
            <small>Đang cấu hình trong hệ thống</small>
          </article>
          <article className="manager-summary-card manager-summary-card--accent">
            <span>Có thông tin kích thước</span>
            <strong>{vehicleTypes.filter((item) => item.dimensions?.trim()).length}</strong>
            <small>Hỗ trợ phân bổ slot phù hợp</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar">
            <label className="manager-search-field" htmlFor="vehicle-search">
              <Search size={18} aria-hidden />
              <input
                id="vehicle-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên hoặc kích thước..."
              />
              {query && (
                <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}>
                  <X size={16} aria-hidden />
                </button>
              )}
            </label>
            <div className="manager-toolbar-meta"><span>{filteredVehicleTypes.length}/{vehicleTypes.length} loại xe</span></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Loại phương tiện</th><th>Kích thước</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && vehicleTypes.length === 0 ? (
                  <tr><td colSpan={3}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : filteredVehicleTypes.length === 0 ? (
                  <tr><td colSpan={3}><div className="manager-empty-state"><CarFront size={30} aria-hidden /><strong>Không có dữ liệu phù hợp</strong><span>{query ? 'Thử từ khóa khác.' : 'Hãy thêm loại phương tiện đầu tiên.'}</span></div></td></tr>
                ) : filteredVehicleTypes.map((item) => (
                  <tr key={item.vehicleTypeId}>
                    <td><div className="manager-name-cell"><span><CarFront size={18} aria-hidden /></span><strong>{item.typeName}</strong></div></td>
                    <td>{item.dimensions || <span className="manager-muted-value">Chưa thiết lập</span>}</td>
                    <td><div className="manager-row-actions">
                      <button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(item)}><Pencil size={15} aria-hidden /> Sửa</button>
                      <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => openDeleteModal(item)}><Trash2 size={15} aria-hidden /> Xóa</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeModal()}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-modal-title">
            <div className="manager-modal-header">
              <div><h3 id="vehicle-modal-title" className="modal-title">{editTarget ? 'Cập nhật loại phương tiện' : 'Thêm loại phương tiện'}</h3><p>Thông tin này được dùng chung trong toàn hệ thống.</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={handleSave}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-field"><label htmlFor="vt-name">Tên loại phương tiện *</label><input id="vt-name" autoFocus maxLength={50} value={form.typeName} onChange={(event) => setForm({ ...form, typeName: event.target.value })} placeholder="Ví dụ: Ô tô, Xe máy" /></div>
              <div className="form-field"><label htmlFor="vt-dimensions">Kích thước</label><input id="vt-dimensions" maxLength={100} value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} placeholder="Ví dụ: 4.8m × 1.8m" /><small className="field-hint">Có thể để trống nếu loại xe không yêu cầu kích thước riêng.</small></div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving || !form.typeName.trim()}>{saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm loại xe'}</button></div>
            </form>
          </div>
        </div>
      )}

      <ManagerConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Xóa loại phương tiện?"
        description={<>Bạn có chắc muốn xóa <strong>{deleteTarget?.typeName}</strong>? Hành động này không thể hoàn tác.</>}
        targetLabel={deleteTarget?.typeName}
        targetMeta={deleteTarget?.dimensions}
        targetIcon={<CarFront size={18} aria-hidden />}
        note="Loại phương tiện đang được sử dụng bởi tầng, slot, bảng giá hoặc gói tháng có thể không xóa được."
        errorFallback="Không thể xóa loại phương tiện."
        onCancel={closeDeleteModal}
        onConfirm={handleDelete}
      />
    </ManagerPageShell>
  )
}
