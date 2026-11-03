import { useEffect, useState } from 'react'
import { DoorOpen, Layers3, LogIn, LogOut, RefreshCw, Search, X } from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient, apiErrorMessage } from '../../config/api'

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

export default function ManagerGates() {
  const [gates, setGates] = useState<Gate[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [gateTypeFilter, setGateTypeFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')

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
        setError(res.message || 'Không thể tải danh sách cổng.')
      }
    } catch (err: unknown) {
      console.error(err)
      setError(apiErrorMessage(err, 'Không thể tải danh sách cổng.'))
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
          <div className="manager-header-actions"><button type="button" className="btn btn-outline" onClick={fetchGates} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button><span className="field-hint">Cổng được thêm và đổi tên trên sơ đồ ở mục Thiết kế bãi đỗ (admin).</span></div>
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
    </ManagerPageShell>
  )
}
