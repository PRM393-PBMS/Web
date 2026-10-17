import { useEffect, useState } from 'react'
import { CarFront, Layers3, Pencil, Plus, RefreshCw, Search, SquareParking, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'

interface ParkingSlot {
  slotId: string
  floorId: string
  slotCode: string
  floorName: string
  vehicleTypeId: string
  vehicleTypeName: string
  status: string
}

interface FloorOption {
  floorId: string
  floorName: string
  dedicatedVehicleTypeId?: string
  dedicatedVehicleTypeName?: string
  isResident: boolean
}

interface VehicleTypeOption {
  vehicleTypeId: string
  typeName: string
}

interface ApiResponse<T> {
  isSuccess: boolean
  result: T
  message?: string
}

// Normalize API status strings to local display keys
const STATUS_LABEL_MAP: Record<string, string> = {
  Available: 'Còn trống',
  Occupied: 'Đang sử dụng',
  Assigned: 'Đã phân bổ',
  Maintenance: 'Bảo trì',
  Locked: 'Tạm khóa',
}

const STATUS_BADGE_MAP: Record<string, string> = {
  Available: 'slot-badge--empty',
  Occupied: 'slot-badge--occupied',
  Assigned: 'slot-badge--assigned',
  Maintenance: 'slot-badge--maintenance',
  Locked: 'slot-badge--locked',
}

const STATUS_TILE_MAP: Record<string, string> = {
  Available: 'slot-tile--empty',
  Occupied: 'slot-tile--occupied',
  Assigned: 'slot-tile--assigned',
  Maintenance: 'slot-tile--maintenance',
  Locked: 'slot-tile--locked',
}

const EMPTY_FORM = { slotCode: '', floorId: '', vehicleTypeId: '', status: 'Available' }

function getLabel(status: string) {
  return STATUS_LABEL_MAP[status] ?? status
}

export default function ManagerSlots() {
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [floors, setFloors] = useState<FloorOption[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeOption[]>([])
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterFloor, setFilterFloor] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [query, setQuery] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ParkingSlot | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ParkingSlot | null>(null)

  const fetchSlots = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<ParkingSlot[]>>('/ParkingSlot')
      if (res.isSuccess) {
        setSlots(res.result)
      } else {
        setError(res.message ?? 'Không thể tải danh sách slot.')
      }
    } catch (e) {
      console.error(e)
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const fetchOptions = async () => {
    setOptionsLoading(true)
    try {
      const [floorResponse, vehicleTypeResponse] = await Promise.all([
        apiClient.get<ApiResponse<FloorOption[]>>('/Floor'),
        apiClient.get<ApiResponse<VehicleTypeOption[]>>('/VehicleType'),
      ])
      if (!floorResponse.isSuccess) throw new Error(floorResponse.message || 'Không thể tải danh sách tầng.')
      if (!vehicleTypeResponse.isSuccess) throw new Error(vehicleTypeResponse.message || 'Không thể tải danh sách loại xe.')
      setFloors(floorResponse.result ?? [])
      setVehicleTypes(vehicleTypeResponse.result ?? [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu lựa chọn.')
    } finally {
      setOptionsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchSlots(); void fetchOptions() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Derived filter values
  const uniqueFloors = Array.from(new Set(slots.map((s) => s.floorName))).sort()
  const uniqueStatuses = Array.from(new Set(slots.map((s) => s.status)))

  const filteredSlots = slots.filter((s) => {
    const floorOk = filterFloor === 'all' || s.floorName === filterFloor
    const statusOk = filterStatus === 'all' || s.status === filterStatus
    const normalizedQuery = query.trim().toLowerCase()
    const queryOk = !normalizedQuery || s.slotCode.toLowerCase().includes(normalizedQuery) || s.vehicleTypeName.toLowerCase().includes(normalizedQuery)
    return floorOk && statusOk && queryOk
  })

  // Summary counts from full list
  const summaryCounts = uniqueStatuses.reduce<Record<string, number>>((acc, st) => {
    acc[st] = slots.filter((s) => s.status === st).length
    return acc
  }, {})

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (slot: ParkingSlot) => {
    setEditTarget(slot)
    setForm({
      slotCode: slot.slotCode,
      floorId: slot.floorId,
      vehicleTypeId: slot.vehicleTypeId,
      status: slot.status,
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
      if (editTarget) {
        await apiClient.put<ApiResponse<ParkingSlot>>('/ParkingSlot', {
          slotId: editTarget.slotId,
          ...form,
        })
      } else {
        await apiClient.post<ApiResponse<ParkingSlot>>('/ParkingSlot', form)
      }
      closeModal()
      await fetchSlots()
    } catch (e) {
      console.error(e)
      alert('Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/ParkingSlot/${deleteTarget.slotId}`)
    if (!response.isSuccess) throw new Error(response.message ?? 'Không thể xóa slot.')
    setDeleteTarget(null)
    await fetchSlots()
  }

  return (
    <ManagerPageShell activeItem="slots">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title"><span className="manager-resource-icon manager-resource-icon--orange"><SquareParking size={24} aria-hidden /></span><div><h2>Quản lý slot đỗ xe</h2><p>Theo dõi trạng thái, tầng và loại phương tiện của từng vị trí đỗ xe.</p></div></div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchSlots} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm slot</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--four" aria-label="Tổng quan slot đỗ xe">
          <article className="manager-summary-card"><span>Tổng số slot</span><strong>{slots.length}</strong><small>Trên {uniqueFloors.length} tầng</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Còn trống</span><strong>{summaryCounts.Available ?? 0}</strong><small>Sẵn sàng tiếp nhận xe</small></article>
          <article className="manager-summary-card"><span>Đang sử dụng</span><strong>{summaryCounts.Occupied ?? 0}</strong><small>Đang có xe trong vị trí</small></article>
          <article className="manager-summary-card manager-summary-card--orange"><span>Đã phân bổ / Hạn chế</span><strong>{(summaryCounts.Assigned ?? 0) + (summaryCounts.Maintenance ?? 0) + (summaryCounts.Locked ?? 0)}</strong><small>Chưa thể sử dụng ngay</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-slot-toolbar">
            <label className="manager-search-field" htmlFor="slot-search"><Search size={18} aria-hidden /><input id="slot-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã slot hoặc loại xe..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <label><span>Tầng</span><select value={filterFloor} onChange={(event) => setFilterFloor(event.target.value)}><option value="all">Tất cả tầng</option>{uniqueFloors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}</select></label>
            <label><span>Trạng thái</span><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="all">Tất cả trạng thái</option>{uniqueStatuses.map((status) => <option key={status} value={status}>{getLabel(status)}</option>)}</select></label>
          </div>
          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          <div className="manager-slot-visual-head"><div><h3>Sơ đồ slot</h3><p>Chọn một slot để chỉnh sửa nhanh.</p></div><span>{filteredSlots.length}/{slots.length} vị trí</span></div>
          {loading && slots.length === 0 ? <div className="manager-empty-state">Đang tải danh sách slot...</div> : filteredSlots.length === 0 ? <div className="manager-empty-state"><SquareParking size={34} aria-hidden /><strong>Không có slot phù hợp</strong><span>Hãy thay đổi bộ lọc hoặc từ khóa.</span></div> : <div className="slot-visual-grid manager-slot-visual-grid">{filteredSlots.map((slot) => <button key={slot.slotId} type="button" className={`slot-tile ${STATUS_TILE_MAP[slot.status] ?? ''}`} title={`${slot.slotCode} · ${getLabel(slot.status)}`} onClick={() => openEdit(slot)}><span className="slot-tile-id">{slot.slotCode}</span><span className="slot-tile-status">{getLabel(slot.status)}</span><small>{slot.floorName} · {slot.vehicleTypeName}</small></button>)}</div>}
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-panel-heading manager-panel-heading--border"><div><h3>Danh sách chi tiết</h3><p>Thông tin đầy đủ và thao tác quản lý từng slot.</p></div><span className="manager-toolbar-meta">{filteredSlots.length} kết quả</span></div>
          <div className="table-wrap manager-table-wrap"><table className="ui-table manager-resource-table manager-slot-table">
              <thead>
                <tr>
                  <th>Mã slot</th>
                  <th>Tầng</th>
                  <th>Loại xe</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5}><div className="manager-empty-state">Đang tải dữ liệu...</div></td>
                  </tr>
                )}
                {!loading && filteredSlots.length === 0 && (
                  <tr>
                    <td colSpan={5}><div className="manager-empty-state">Không có slot nào phù hợp.</div></td>
                  </tr>
                )}
                {filteredSlots.map((slot) => (
                  <tr key={slot.slotId}>
                    <td><div className="manager-name-cell"><span><SquareParking size={17} aria-hidden /></span><strong>{slot.slotCode}</strong></div></td>
                    <td><span className="manager-gate-floor"><Layers3 size={15} aria-hidden />{slot.floorName}</span></td>
                    <td><span className="manager-gate-floor"><CarFront size={15} aria-hidden />{slot.vehicleTypeName}</span></td>
                    <td>
                      <span className={`slot-badge ${STATUS_BADGE_MAP[slot.status] ?? ''}`}>
                        {getLabel(slot.status)}
                      </span>
                    </td>
                    <td>
                      <div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(slot)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(slot)}><Trash2 size={15} aria-hidden /> Xóa</button></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
        </section>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
            <div className="manager-modal-header"><div><h3 id="slot-modal-title" className="modal-title">{editTarget ? 'Cập nhật slot' : 'Thêm slot mới'}</h3><p>Thiết lập mã, tầng, loại xe và trạng thái sử dụng.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={saving}><X size={20} aria-hidden /></button></div>
            <form onSubmit={handleSave}>
              <div className="form-field">
                <label htmlFor="slot-code">Mã slot *</label>
                <input
                  id="slot-code"
                  type="text"
                  required
                  value={form.slotCode}
                  onChange={(e) => setForm({ ...form, slotCode: e.target.value })}
                  placeholder="VD: B1-A01"
                />
              </div>
              <div className="form-field">
                <label htmlFor="slot-floor">Tầng *</label>
                <select
                  id="slot-floor"
                  required
                  value={form.floorId}
                  disabled={optionsLoading}
                  onChange={(e) => {
                    const floor = floors.find((item) => item.floorId === e.target.value)
                    setForm({
                      ...form,
                      floorId: e.target.value,
                      vehicleTypeId: floor?.dedicatedVehicleTypeId || form.vehicleTypeId,
                    })
                  }}
                >
                  <option value="" disabled>{optionsLoading ? 'Đang tải tầng...' : '-- Chọn tầng --'}</option>
                  {floors.map((floor) => <option key={floor.floorId} value={floor.floorId}>{floor.floorName}{floor.isResident ? ' · Tầng cư dân' : ''}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="slot-vtype">Loại xe *</label>
                <select
                  id="slot-vtype"
                  required
                  value={form.vehicleTypeId}
                  disabled={optionsLoading}
                  onChange={(e) => setForm({ ...form, vehicleTypeId: e.target.value })}
                >
                  <option value="" disabled>{optionsLoading ? 'Đang tải loại xe...' : '-- Chọn loại xe --'}</option>
                  {vehicleTypes.map((vehicleType) => <option key={vehicleType.vehicleTypeId} value={vehicleType.vehicleTypeId}>{vehicleType.typeName}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="slot-status">Trạng thái</label>
                <select
                  id="slot-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Available">Còn trống</option>
                  <option value="Occupied">Đang sử dụng</option>
                  <option value="Assigned">Đã phân bổ</option>
                  <option value="Maintenance">Bảo trì</option>
                  <option value="Locked">Tạm khóa</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || optionsLoading || !form.floorId || !form.vehicleTypeId}>
                  {saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa slot đỗ xe?" description={<>Bạn có chắc muốn xóa slot <strong>{deleteTarget?.slotCode}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.slotCode} targetMeta={deleteTarget ? `${deleteTarget.floorName} · ${deleteTarget.vehicleTypeName} · ${getLabel(deleteTarget.status)}` : undefined} targetIcon={<SquareParking size={18} aria-hidden />} note="Slot đang có xe, đã được đặt hoặc liên kết với gói tháng có thể không xóa được." errorFallback="Không thể xóa slot." onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </ManagerPageShell>
  )
}
