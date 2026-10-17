import { useEffect, useState } from 'react'
import { DoorOpen, Layers3, LogIn, LogOut, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import ManagerConfirmActionModal from '../../components/ManagerConfirmActionModal'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'

interface Gate {
  gateId: string
  gateName: string
  gateType: 'Entry' | 'Exit' | string
  floorId: string
  floorName?: string
}

interface Floor {
  floorId: string
  floorName: string
}

interface ApiResponse<T> {
  isSuccess: boolean
  result: T
  message?: string
}

const EMPTY_FORM = {
  gateName: '',
  gateType: 'Entry',
  floorId: '',
}

export default function ManagerGates() {
  const [gates, setGates] = useState<Gate[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Gate | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [gateTypeFilter, setGateTypeFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<Gate | null>(null)

  // Load supporting floors list for the FloorId selector.
  const fetchFloors = async () => {
    try {
      const res = await apiClient.get<ApiResponse<Floor[]>>('/Floor')
      if (res.isSuccess && res.result) {
        setFloors(res.result)
      }
    } catch (err) {
      console.error('Không thể tải danh sách tầng để đối chiếu vị trí:', err)
    }
  }

  // Load gates list
  const fetchGates = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<Gate[]>>('/Gate')
      if (res.isSuccess && res.result) {
        setGates(res.result)
      } else {
        setError('Không thể tải danh sách cổng.')
      }
    } catch (err: unknown) {
      console.error(err)
      setError('Không thể tải danh sách cổng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void fetchFloors()
      void fetchGates()
    }, 0)

    return () => window.clearTimeout(loadTimer)
  }, [])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (g: Gate) => {
    setEditTarget(g)
    setForm({
      gateName: g.gateName,
      gateType: g.gateType,
      floorId: g.floorId,
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
      const payload = {
        gateName: form.gateName.trim(),
        gateType: form.gateType,
        floorId: form.floorId,
      }

      if (editTarget) {
        const body = {
          gateId: editTarget.gateId,
          ...payload,
        }
        await apiClient.put<ApiResponse<unknown>>('/Gate', body)
      } else {
        await apiClient.post<ApiResponse<unknown>>('/Gate', payload)
      }

      closeModal()
      await fetchGates()
    } catch (err: unknown) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Lưu thất bại. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const response = await apiClient.delete<ApiResponse<unknown>>(`/Gate/${deleteTarget.gateId}`)
    if (!response.isSuccess) throw new Error(response.message ?? 'Không thể xóa cổng.')
    setDeleteTarget(null)
    await fetchGates()
  }

  const normalizedQuery = query.trim().toLowerCase()
  const filteredGates = gates.filter((gate) => {
    const matchesQuery = !normalizedQuery ||
      gate.gateName.toLowerCase().includes(normalizedQuery) ||
      (gate.floorName ?? '').toLowerCase().includes(normalizedQuery)
    const matchesType = gateTypeFilter === 'all' || gate.gateType.toLowerCase() === gateTypeFilter
    const matchesFloor = floorFilter === 'all' || gate.floorId === floorFilter
    return matchesQuery && matchesType && matchesFloor
  })
  const hasSelectFilters = gateTypeFilter !== 'all' || floorFilter !== 'all'
  const entryCount = gates.filter((gate) => gate.gateType.toLowerCase() === 'entry').length
  const exitCount = gates.filter((gate) => gate.gateType.toLowerCase() === 'exit').length
  const assignedFloorCount = new Set(gates.map((gate) => gate.floorId).filter(Boolean)).size

  return (
    <ManagerPageShell activeItem="gates">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--green"><DoorOpen size={24} aria-hidden /></span>
            <div><h2>Quản lý cổng ra vào</h2><p>Thiết lập cổng vào, cổng ra và vị trí tầng phục vụ vận hành bãi xe.</p></div>
          </div>
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchGates} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><button type="button" className="btn btn-primary manager-add-button" onClick={openCreate}><Plus size={18} aria-hidden /> Thêm cổng</button></div>
        </header>

        <section className="manager-summary-grid manager-summary-grid--three" aria-label="Tổng quan cổng ra vào">
          <article className="manager-summary-card"><span>Tổng số cổng</span><strong>{gates.length}</strong><small>Đang cấu hình trong hệ thống</small></article>
          <article className="manager-summary-card manager-summary-card--green"><span>Cổng vào / Cổng ra</span><strong>{entryCount} / {exitCount}</strong><small>Phân bổ theo hướng di chuyển</small></article>
          <article className="manager-summary-card manager-summary-card--purple"><span>Tầng đã bố trí cổng</span><strong>{assignedFloorCount}</strong><small>Trên tổng số {floors.length} tầng</small></article>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar manager-resource-toolbar--wrap">
            <label className="manager-search-field" htmlFor="gate-search"><Search size={18} aria-hidden /><input id="gate-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên cổng hoặc tầng..." />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}</label>
            <div className="manager-filter-controls"><select aria-label="Lọc loại cổng" value={gateTypeFilter} onChange={(event) => setGateTypeFilter(event.target.value)}><option value="all">Tất cả loại cổng</option><option value="entry">Cổng vào</option><option value="exit">Cổng ra</option></select><select aria-label="Lọc tầng phục vụ" value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}><option value="all">Tất cả tầng</option>{floors.map((floor) => <option key={floor.floorId} value={floor.floorId}>{floor.floorName}</option>)}</select></div>
            <div className="manager-filter-actions"><span>{filteredGates.length}/{gates.length} cổng</span>{hasSelectFilters && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setGateTypeFilter('all'); setFloorFilter('all') }}><X size={15} aria-hidden /> Xóa lọc</button>}</div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          <div className="table-wrap manager-table-wrap">
              <table className="ui-table manager-resource-table manager-gate-table">
                <thead>
                  <tr>
                    <th>Tên cổng</th>
                    <th>Tầng</th>
                    <th>Loại cổng</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && gates.length === 0 ? (
                    <tr><td colSpan={4}><div className="manager-empty-state">Đang tải danh sách cổng...</div></td></tr>
                  ) : filteredGates.length === 0 ? (
                    <tr>
                      <td colSpan={4}><div className="manager-empty-state"><DoorOpen size={32} aria-hidden /><strong>{query ? 'Không tìm thấy cổng phù hợp' : 'Chưa có cổng ra vào'}</strong><span>{query ? 'Hãy thử từ khóa khác.' : 'Hãy thêm cổng đầu tiên để bắt đầu vận hành.'}</span></div></td>
                    </tr>
                  ) : (
                    filteredGates.map((g) => (
                      <tr key={g.gateId}>
                        <td><div className="manager-name-cell"><span>{g.gateType === 'Entry' ? <LogIn size={18} aria-hidden /> : <LogOut size={18} aria-hidden />}</span><strong>{g.gateName}</strong></div></td>
                        <td><span className="manager-gate-floor"><Layers3 size={15} aria-hidden />{g.floorName || 'Chưa xác định'}</span></td>
                        <td>
                          <span className={`manager-gate-badge ${g.gateType === 'Entry' ? 'entry' : 'exit'}`}>
                            {g.gateType === 'Entry' ? 'Cổng vào' : g.gateType === 'Exit' ? 'Cổng ra' : g.gateType}
                          </span>
                        </td>
                        <td>
                          <div className="manager-row-actions"><button type="button" className="btn btn-outline btn-sm manager-edit-button" onClick={() => openEdit(g)}><Pencil size={15} aria-hidden /> Sửa</button><button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => setDeleteTarget(g)}><Trash2 size={15} aria-hidden /> Xóa</button></div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </section>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="gate-modal-title">
            <div className="manager-modal-header"><div><h3 id="gate-modal-title" className="modal-title">{editTarget ? 'Cập nhật cổng' : 'Thêm cổng mới'}</h3><p>Chọn đúng tầng và hướng di chuyển của cổng.</p></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={closeModal} disabled={saving}><X size={20} aria-hidden /></button></div>
            <form onSubmit={handleSave}>
              <div className="form-field">
                <label htmlFor="gate-name">Tên cổng *</label>
                <input
                  id="gate-name"
                  type="text"
                  required
                  value={form.gateName}
                  onChange={(e) => setForm({ ...form, gateName: e.target.value })}
                  placeholder="VD: Cổng chính"
                />
              </div>
              <div className="form-field">
                <label htmlFor="gate-floor">Tầng *</label>
                <select
                  id="gate-floor"
                  required
                  value={form.floorId}
                  onChange={(e) => setForm({ ...form, floorId: e.target.value })}
                >
                  <option value="" disabled>-- Chọn tầng --</option>
                  {floors.map((floor) => (
                    <option key={floor.floorId} value={floor.floorId}>{floor.floorName}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="gate-type">Loại cổng *</label>
                <select
                  id="gate-type"
                  required
                  value={form.gateType}
                  onChange={(e) => setForm({ ...form, gateType: e.target.value })}
                >
                  <option value="Entry">Cổng vào</option>
                  <option value="Exit">Cổng ra</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : editTarget ? 'Lưu thay đổi' : 'Thêm cổng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ManagerConfirmActionModal open={Boolean(deleteTarget)} title="Xóa cổng?" description={<>Bạn có chắc muốn xóa cổng <strong>{deleteTarget?.gateName}</strong>? Hành động này không thể hoàn tác.</>} targetLabel={deleteTarget?.gateName} targetMeta={deleteTarget ? `${deleteTarget.gateType === 'Entry' ? 'Cổng vào' : 'Cổng ra'} · ${deleteTarget.floorName || 'Chưa rõ tầng'}` : undefined} targetIcon={<DoorOpen size={18} aria-hidden />} note="Cổng đang được sử dụng trong phiên ra vào có thể không xóa được." errorFallback="Không thể xóa cổng." onCancel={() => setDeleteTarget(null)} onConfirm={handleDelete} />
    </ManagerPageShell>
  )
}
