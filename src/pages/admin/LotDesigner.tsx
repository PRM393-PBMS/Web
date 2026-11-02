import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowUpDown,
  Bike,
  BrickWall,
  Car,
  Copy,
  CreditCard,
  DoorOpen,
  Eraser,
  Footprints,
  Image as ImageIcon,
  LayoutGrid,
  Map as MapIcon,
  MousePointer2,
  Paintbrush,
  Plus,
  Redo2,
  Route,
  Save,
  Send,
  Square,
  SquareDashed,
  Undo2,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminPageShell from '../../components/AdminPageShell'
import { apiClient } from '../../config/api'
import { floorApi, parkingApi, vehicleTypeApi, type ApiResponse, type FloorDto, type ParkingDto, type VehicleTypeDto } from '../../utils/apiServices'
import {
  DIR_ARROW,
  MAX_SIZE,
  MIN_SIZE,
  copyFromFloor,
  emptyLayout,
  key,
  nextGateName,
  nextLetter,
  nextSlotCode,
  putCell,
  resize,
  stampBasicFrame,
  stampDoubleRow,
  stampMotoArea,
  unreachableParking,
  type CellType,
  type Dir,
  type FloorLayoutData,
  type LayoutCell,
} from '../../utils/floorLayout'

type Tool = 'brush' | 'rect' | 'erase' | 'select' | 'stamp-row' | 'stamp-moto'

const PALETTE: { t: CellType; label: string; icon: ReactNode }[] = [
  { t: 'road', label: 'Lối đi', icon: <Route size={16} /> },
  { t: 'slot', label: 'Ô ô tô', icon: <Car size={16} /> },
  { t: 'moto', label: 'Khu xe máy', icon: <Bike size={16} /> },
  { t: 'gate', label: 'Cổng', icon: <DoorOpen size={16} /> },
  { t: 'ramp', label: 'Dốc lên/xuống', icon: <ArrowUpDown size={16} /> },
  { t: 'stairs', label: 'Thang', icon: <ArrowUpDown size={16} /> },
  { t: 'walk', label: 'Lối đi bộ', icon: <Footprints size={16} /> },
  { t: 'wall', label: 'Tường', icon: <BrickWall size={16} /> },
  { t: 'pillar', label: 'Cột', icon: <Square size={16} /> },
  { t: 'kiosk', label: 'Quầy thu', icon: <CreditCard size={16} /> },
]

const CELL_COLOR: Record<CellType, string> = {
  road: '#e2e8f0',
  slot: '#10b981',
  moto: '#6ee7b7',
  gate: '#087b8c',
  ramp: '#f59e0b',
  stairs: '#fbbf24',
  walk: '#bfdbfe',
  wall: '#475569',
  pillar: '#94a3b8',
  kiosk: '#8b5cf6',
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function cellText(c: LayoutCell): string {
  switch (c.t) {
    case 'road':
      return c.dir ? DIR_ARROW[c.dir] : ''
    case 'slot':
      return c.code ?? ''
    case 'moto':
      return 'XM'
    case 'gate':
      return c.gateType === 'Exit' ? 'RA' : 'VÀO'
    case 'ramp':
      return 'DỐC'
    case 'stairs':
      return 'TH'
    case 'kiosk':
      return '₫'
    default:
      return ''
  }
}

/** Trình vẽ sơ đồ bãi (chỉ admin): mỗi tầng một trang lưới, tô bằng icon, xuất bản thì đồng bộ ô đỗ và cổng thật. */
export default function LotDesigner() {
  const navigate = useNavigate()
  const [lots, setLots] = useState<ParkingDto[]>([])
  const [floors, setFloors] = useState<FloorDto[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeDto[]>([])
  const [lotId, setLotId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [layout, setLayout] = useState<FloorLayoutData>(emptyLayout())
  const [version, setVersion] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [undo, setUndo] = useState<FloorLayoutData[]>([])
  const [redo, setRedo] = useState<FloorLayoutData[]>([])
  const [tool, setTool] = useState<Tool>('brush')
  const [brush, setBrush] = useState<CellType>('road')
  const [roadDir, setRoadDir] = useState<Dir | ''>('')
  const [prefix, setPrefix] = useState('A')
  const [vehicleTypeId, setVehicleTypeId] = useState('')
  const [gateType, setGateType] = useState<'Entry' | 'Exit'>('Entry')
  const [rampTo, setRampTo] = useState('')
  const [rowLength, setRowLength] = useState(8)
  const [cellPx, setCellPx] = useState(30)
  const [selected, setSelected] = useState<string | null>(null)
  const [rectFrom, setRectFrom] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string; problems?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<'lot' | 'floor' | 'copy' | null>(null)
  const painting = useRef(false)
  const strokeStart = useRef<FloorLayoutData | null>(null)

  const lotFloors = useMemo(() => floors.filter((f) => f.parkingId === lotId), [floors, lotId])
  const grid = useMemo(() => new Map(layout.cells.map((c) => [key(c.x, c.y), c])), [layout])
  const stuck = useMemo(() => unreachableParking(layout), [layout])

  const loadCatalog = useCallback(async () => {
    try {
      const [p, f, v] = await Promise.all([parkingApi.getAll(), floorApi.getAll(), vehicleTypeApi.getAll()])
      setLots(Array.isArray(p) ? p : [])
      setFloors(f.isSuccess && Array.isArray(f.result) ? f.result : [])
      const types = v.isSuccess && Array.isArray(v.result) ? v.result : []
      setVehicleTypes(types)
      setVehicleTypeId((cur) => cur || types.find((t) => !/máy/i.test(t.typeName))?.vehicleTypeId || types[0]?.vehicleTypeId || '')
      setLotId((cur) => cur || (Array.isArray(p) && p[0]?.id) || '')
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Không tải được danh sách bãi.') })
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void loadCatalog())
  }, [loadCatalog])

  const loadFloor = useCallback(async (id: string) => {
    setMessage(null)
    try {
      const res = await apiClient.get<ApiResponse<{ version: number; layout: FloorLayoutData | null }>>(`/FloorLayout/${id}/draft`)
      if (!res.isSuccess || !res.result) {
        setMessage({ tone: 'error', text: res.message || 'Không tải được bản vẽ.' })
        return
      }
      setLayout(res.result.layout ?? emptyLayout())
      setVersion(res.result.version)
      setDirty(false)
      setUndo([])
      setRedo([])
      setSelected(null)
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Không tải được bản vẽ.') })
    }
  }, [])

  useEffect(() => {
    const first = lotFloors.find((f) => f.floorId === floorId) ?? lotFloors[0]
    if (first && first.floorId !== floorId) queueMicrotask(() => setFloorId(first.floorId))
  }, [lotFloors, floorId])

  useEffect(() => {
    if (floorId) queueMicrotask(() => void loadFloor(floorId))
  }, [floorId, loadFloor])

  const commit = (next: FloorLayoutData, before: FloorLayoutData = layout) => {
    setUndo((u) => [...u.slice(-49), before])
    setRedo([])
    setLayout(next)
    setDirty(true)
  }

  const brushCell = (cells: LayoutCell[]): LayoutCell | null => {
    switch (brush) {
      case 'road':
        return { x: 0, y: 0, t: 'road', ...(roadDir ? { dir: roadDir } : {}) }
      case 'slot':
        return { x: 0, y: 0, t: 'slot', vehicleTypeId, code: nextSlotCode(prefix, cells.filter((c) => c.code).map((c) => c.code!)) }
      case 'moto':
        return { x: 0, y: 0, t: 'moto', cap: 6 }
      case 'gate':
        return { x: 0, y: 0, t: 'gate', gateType, name: nextGateName(cells) }
      case 'ramp':
      case 'stairs':
        return { x: 0, y: 0, t: brush, to: rampTo || lotFloors.find((f) => f.floorId !== floorId)?.floorId }
      default:
        return { x: 0, y: 0, t: brush }
    }
  }

  const paintAt = (x: number, y: number, base: FloorLayoutData) => {
    const existing = base.cells.find((c) => c.x === x && c.y === y)
    if (tool === 'erase') return existing ? { ...base, cells: putCell(base.cells, x, y, null) } : base
    // Tô lại cùng loại thì giữ ô cũ (không đổi mã ô đã có).
    if (existing && existing.t === brush && brush !== 'road') return base
    return { ...base, cells: putCell(base.cells, x, y, brushCell(base.cells)) }
  }

  const onCellDown = (x: number, y: number) => {
    if (!floorId) return
    if (tool === 'select') {
      setSelected(key(x, y))
      return
    }
    if (tool === 'stamp-row') {
      commit({ ...layout, cells: stampDoubleRow(layout, x, y, rowLength, prefix, nextLetter(prefix), vehicleTypeId) })
      setPrefix(nextLetter(nextLetter(prefix)))
      return
    }
    if (tool === 'stamp-moto') {
      commit({ ...layout, cells: stampMotoArea(layout, x, y) })
      return
    }
    if (tool === 'rect') {
      setRectFrom([x, y])
      return
    }
    painting.current = true
    strokeStart.current = layout
    setLayout((l) => paintAt(x, y, l))
  }

  const onCellEnter = (x: number, y: number) => {
    setHover([x, y])
    if (painting.current) setLayout((l) => paintAt(x, y, l))
  }

  const onPointerUp = () => {
    if (painting.current && strokeStart.current) {
      painting.current = false
      const before = strokeStart.current
      strokeStart.current = null
      if (before !== layout) {
        setUndo((u) => [...u.slice(-49), before])
        setRedo([])
        setDirty(true)
      }
    }
    if (rectFrom && hover) {
      const [x0, x1] = [Math.min(rectFrom[0], hover[0]), Math.max(rectFrom[0], hover[0])]
      const [y0, y1] = [Math.min(rectFrom[1], hover[1]), Math.max(rectFrom[1], hover[1])]
      let next = layout
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) next = paintAt(x, y, next)
      setRectFrom(null)
      if (next !== layout) commit(next)
    }
  }

  const doUndo = () => {
    const prev = undo[undo.length - 1]
    if (!prev) return
    setUndo((u) => u.slice(0, -1))
    setRedo((r) => [...r, layout])
    setLayout(prev)
    setDirty(true)
  }

  const doRedo = () => {
    const next = redo[redo.length - 1]
    if (!next) return
    setRedo((r) => r.slice(0, -1))
    setUndo((u) => [...u, layout])
    setLayout(next)
    setDirty(true)
  }

  const updateSelected = (patch: Partial<LayoutCell>) => {
    const cell = selected ? grid.get(selected) : undefined
    if (!cell) return
    commit({ ...layout, cells: putCell(layout.cells, cell.x, cell.y, { ...cell, ...patch }) })
  }

  const saveDraft = async (): Promise<number | null> => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await apiClient.put<ApiResponse<{ version: number }>>(`/FloorLayout/${floorId}/draft`, { version, layout })
      if (!res.isSuccess || !res.result) {
        setMessage({ tone: 'error', text: res.message || 'Lưu nháp thất bại.' })
        return null
      }
      setVersion(res.result.version)
      setDirty(false)
      setMessage({ tone: 'ok', text: 'Đã lưu nháp. App khách chưa thấy thay đổi cho tới khi xuất bản.' })
      return res.result.version
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Lưu nháp thất bại.') })
      return null
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    if (stuck.size && !window.confirm(`Có ${stuck.size} chỗ đỗ chưa có lối đi tới. Máy chủ sẽ từ chối xuất bản. Vẫn gửi để xem lỗi?`)) return
    const v = dirty ? await saveDraft() : version
    if (v === null) return
    setBusy(true)
    try {
      const res = await apiClient.post<ApiResponse<{ version: number; layout: FloorLayoutData; problems?: string[] }>>(
        `/FloorLayout/${floorId}/publish`,
        { version: v },
      )
      if (!res.isSuccess) {
        setMessage({ tone: 'error', text: res.message || 'Xuất bản thất bại.', problems: res.result?.problems })
        return
      }
      setLayout(res.result!.layout)
      setVersion(res.result!.version)
      setDirty(false)
      setMessage({ tone: 'ok', text: 'Đã xuất bản. Ô đỗ và cổng đã cập nhật theo sơ đồ; app khách dùng sơ đồ mới.' })
      await loadCatalog()
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Xuất bản thất bại.') })
    } finally {
      setBusy(false)
    }
  }

  const uploadBackground = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiClient.post<ApiResponse<{ url: string }>>(`/FloorLayout/${floorId}/background`, form)
      if (!res.isSuccess || !res.result) {
        setMessage({ tone: 'error', text: res.message || 'Tải ảnh nền thất bại.' })
        return
      }
      commit({ ...layout, bg: { url: res.result.url, opacity: 0.4 } })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, 'Tải ảnh nền thất bại.') })
    }
  }

  const changeFloor = (id: string) => {
    if (dirty && !window.confirm('Bản vẽ chưa lưu. Chuyển tầng sẽ mất thay đổi?')) return
    setFloorId(id)
  }

  const sel = selected ? grid.get(selected) : undefined
  const rectBox = rectFrom && hover
    ? { x0: Math.min(rectFrom[0], hover[0]), x1: Math.max(rectFrom[0], hover[0]), y0: Math.min(rectFrom[1], hover[1]), y1: Math.max(rectFrom[1], hover[1]) }
    : null

  const toolButton = (t: Tool, label: string, icon: ReactNode) => (
    <button type="button" className={`designer-tool${tool === t ? ' active' : ''}`} onClick={() => setTool(t)} aria-pressed={tool === t}>
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <AdminPageShell activeItem="lot-designer">
      <div className="staff-content-wrapper manager-resource-page" onPointerUp={onPointerUp} onPointerLeave={() => { if (painting.current) onPointerUp() }}>
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><MapIcon size={24} aria-hidden /></span>
            <div><h2>Thiết kế bãi đỗ</h2><p>Mỗi tầng là một trang lưới. Tô icon để vẽ; xuất bản thì ô đỗ, cổng cập nhật theo sơ đồ và app khách chỉ đường theo lối đi đã vẽ.</p></div>
          </div>
          <div className="manager-header-actions">
            <select value={lotId} onChange={(e) => { if (!dirty || window.confirm('Bản vẽ chưa lưu. Đổi bãi?')) { setLotId(e.target.value); setFloorId('') } }} aria-label="Chọn bãi">
              {lots.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button type="button" className="btn btn-outline" onClick={() => setModal('lot')}><Plus size={16} aria-hidden /> Tạo bãi</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/parkings')}>Thông tin bãi</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/floors')}>Sửa tầng</button>
          </div>
        </header>

        <div className="designer-floor-tabs" role="tablist" aria-label="Tầng">
          {lotFloors.map((f) => (
            <button key={f.floorId} type="button" role="tab" aria-selected={f.floorId === floorId} className={f.floorId === floorId ? 'active' : ''} onClick={() => changeFloor(f.floorId)}>
              {f.floorName}{f.isResident ? ' · cư dân' : ''}
            </button>
          ))}
          <button type="button" onClick={() => setModal('floor')} disabled={!lotId}><Plus size={14} aria-hidden /> Thêm tầng</button>
        </div>

        {message && (
          <div className={message.tone === 'ok' ? 'manager-inline-success' : 'manager-inline-error'} role={message.tone === 'ok' ? 'status' : 'alert'}>
            {message.text}
            {message.problems && <ul>{message.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          </div>
        )}

        {!floorId ? (
          <section className="card-panel manager-resource-panel"><div className="manager-empty-state"><LayoutGrid size={30} aria-hidden /><strong>Chưa có tầng</strong><span>Tạo bãi rồi thêm tầng để bắt đầu vẽ.</span></div></section>
        ) : (
          <div className="designer-layout">
            <aside className="card-panel designer-panel">
              <h3>Công cụ</h3>
              <div className="designer-tools">
                {toolButton('brush', 'Bút', <Paintbrush size={16} />)}
                {toolButton('rect', 'Kéo vùng', <SquareDashed size={16} />)}
                {toolButton('erase', 'Tẩy', <Eraser size={16} />)}
                {toolButton('select', 'Chọn ô', <MousePointer2 size={16} />)}
              </div>
              <h3>Icon</h3>
              <div className="designer-palette">
                {PALETTE.map((p) => (
                  <button key={p.t} type="button" className={`designer-swatch${brush === p.t && (tool === 'brush' || tool === 'rect') ? ' active' : ''}`}
                    onClick={() => { setBrush(p.t); if (tool !== 'rect') setTool('brush') }}>
                    <span style={{ background: CELL_COLOR[p.t] }}>{p.icon}</span>{p.label}
                  </button>
                ))}
              </div>
              {brush === 'road' && (
                <label className="designer-field">Hướng (lối một chiều)
                  <select value={roadDir} onChange={(e) => setRoadDir(e.target.value as Dir | '')}>
                    <option value="">Hai chiều</option><option value="E">→ Phải</option><option value="W">← Trái</option><option value="N">↑ Lên</option><option value="S">↓ Xuống</option>
                  </select>
                </label>
              )}
              {(brush === 'slot' || tool === 'stamp-row') && (
                <>
                  <label className="designer-field">Khu (tiền tố mã ô)<input value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} /></label>
                  <label className="designer-field">Loại xe
                    <select value={vehicleTypeId} onChange={(e) => setVehicleTypeId(e.target.value)}>{vehicleTypes.map((v) => <option key={v.vehicleTypeId} value={v.vehicleTypeId}>{v.typeName}</option>)}</select>
                  </label>
                  <small className="field-hint">Ô kế tiếp: {nextSlotCode(prefix, layout.cells.filter((c) => c.code).map((c) => c.code!))}</small>
                </>
              )}
              {brush === 'gate' && (
                <label className="designer-field">Loại cổng
                  <select value={gateType} onChange={(e) => setGateType(e.target.value as 'Entry' | 'Exit')}><option value="Entry">Cổng vào</option><option value="Exit">Cổng ra</option></select>
                </label>
              )}
              {(brush === 'ramp' || brush === 'stairs') && (
                <label className="designer-field">Nối tới tầng
                  <select value={rampTo} onChange={(e) => setRampTo(e.target.value)}>
                    <option value="">Chọn tầng</option>
                    {lotFloors.filter((f) => f.floorId !== floorId).map((f) => <option key={f.floorId} value={f.floorId}>{f.floorName}</option>)}
                  </select>
                </label>
              )}
              <h3>Mẫu có sẵn</h3>
              <div className="designer-tools">
                {toolButton('stamp-row', 'Dãy ô 2 bên lối đi', <LayoutGrid size={16} />)}
                {toolButton('stamp-moto', 'Khu xe máy', <Bike size={16} />)}
                <button type="button" className="designer-tool" onClick={() => {
                  if (layout.cells.length && !window.confirm('Thay toàn bộ sơ đồ tầng này bằng khung bãi cơ bản?')) return
                  commit({ ...layout, cells: stampBasicFrame(layout.w, layout.h) })
                }}><BrickWall size={16} /><span>Khung bãi cơ bản</span></button>
                <button type="button" className="designer-tool" onClick={() => setModal('copy')} disabled={lotFloors.length < 2}><Copy size={16} /><span>Chép từ tầng khác</span></button>
              </div>
              {tool === 'stamp-row' && <label className="designer-field">Số ô mỗi bên<input type="number" min={1} max={MAX_SIZE} value={rowLength} onChange={(e) => setRowLength(Math.max(1, Number(e.target.value) || 1))} /></label>}
              {tool.startsWith('stamp') && <small className="field-hint">Bấm vào lưới để đặt mẫu (góc trên trái).</small>}
            </aside>

            <section className="card-panel designer-canvas-panel">
              <div className="designer-toolbar">
                <button type="button" className="btn btn-ghost btn-sm" onClick={doUndo} disabled={!undo.length} aria-label="Hoàn tác"><Undo2 size={16} /></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={doRedo} disabled={!redo.length} aria-label="Làm lại"><Redo2 size={16} /></button>
                <label>Rộng <input type="number" min={MIN_SIZE} max={MAX_SIZE} value={layout.w} onChange={(e) => {
                  const w = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE))
                  commit(resize(layout, w, layout.h))
                }} /></label>
                <label>Cao <input type="number" min={MIN_SIZE} max={MAX_SIZE} value={layout.h} onChange={(e) => {
                  const h = Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE))
                  commit(resize(layout, layout.w, h))
                }} /></label>
                <label>Thu phóng <input type="range" min={16} max={44} value={cellPx} onChange={(e) => setCellPx(Number(e.target.value))} /></label>
                <label className="btn btn-ghost btn-sm designer-upload"><ImageIcon size={16} aria-hidden /> Ảnh nền
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadBackground(f); e.target.value = '' }} />
                </label>
                {layout.bg && (
                  <>
                    <input type="range" min={0} max={100} value={Math.round(layout.bg.opacity * 100)} aria-label="Độ mờ ảnh nền"
                      onChange={(e) => setLayout({ ...layout, bg: { ...layout.bg!, opacity: Number(e.target.value) / 100 } })} onMouseUp={() => setDirty(true)} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => commit({ ...layout, bg: null })}>Bỏ nền</button>
                  </>
                )}
                <span className="designer-spacer" />
                {stuck.size > 0 && <span className="designer-warning">{stuck.size} chỗ đỗ chưa có lối đi tới</span>}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => void saveDraft()} disabled={busy || !dirty}><Save size={15} aria-hidden /> Lưu nháp</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void publish()} disabled={busy}><Send size={15} aria-hidden /> Xuất bản</button>
              </div>
              <div className="designer-scroll">
                <div className="designer-stage">
                {layout.bg && <img className="designer-bg" src={layout.bg.url} alt="" style={{ opacity: layout.bg.opacity }} />}
                <div
                  className="designer-grid"
                  style={{
                    gridTemplateColumns: `repeat(${layout.w}, ${cellPx}px)`,
                    gridTemplateRows: `repeat(${layout.h}, ${cellPx}px)`,
                  }}
                  onPointerDown={(e) => e.preventDefault()}
                >
                  {Array.from({ length: layout.w * layout.h }, (_, i) => {
                    const x = i % layout.w
                    const y = Math.floor(i / layout.w)
                    const k = key(x, y)
                    const c = grid.get(k)
                    const inRect = rectBox && x >= rectBox.x0 && x <= rectBox.x1 && y >= rectBox.y0 && y <= rectBox.y1
                    return (
                      <div
                        key={k}
                        className={`designer-cell${c ? ` t-${c.t}` : ''}${stuck.has(k) ? ' stuck' : ''}${selected === k ? ' selected' : ''}${inRect ? ' in-rect' : ''}`}
                        style={c ? { background: CELL_COLOR[c.t], fontSize: Math.max(8, cellPx / 3.4) } : undefined}
                        title={c ? `${PALETTE.find((p) => p.t === c.t)?.label}${c.code ? ` ${c.code}` : ''}${c.name ? ` ${c.name}` : ''} (${x}, ${y})` : `(${x}, ${y})`}
                        onPointerDown={() => onCellDown(x, y)}
                        onPointerEnter={() => onCellEnter(x, y)}
                      >
                        {c ? cellText(c) : ''}
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
              <p className="field-hint">Viền đỏ: chỗ đỗ chưa nối với lối đi từ cổng vào. Ô đỗ phải nằm cạnh lối đi. Tầng hầm không có cổng thì vẽ dốc nối tới tầng có cổng.</p>
            </section>

            {tool === 'select' && sel && (
              <aside className="card-panel designer-panel">
                <h3>Ô ({sel.x}, {sel.y}) · {PALETTE.find((p) => p.t === sel.t)?.label}</h3>
                {sel.t === 'slot' && (
                  <>
                    <label className="designer-field">Mã ô<input defaultValue={sel.code} key={`code-${selected}`} maxLength={15} onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (v && v !== sel.code) updateSelected({ code: v }) }} /></label>
                    <label className="designer-field">Loại xe<select value={sel.vehicleTypeId} onChange={(e) => updateSelected({ vehicleTypeId: e.target.value })}>{vehicleTypes.map((v) => <option key={v.vehicleTypeId} value={v.vehicleTypeId}>{v.typeName}</option>)}</select></label>
                    {sel.slotId && <small className="field-hint">Ô đã có trên hệ thống: đổi mã sẽ đổi mã ô thật khi xuất bản.</small>}
                  </>
                )}
                {sel.t === 'gate' && (
                  <>
                    <label className="designer-field">Tên cổng<input defaultValue={sel.name} key={`name-${selected}`} maxLength={50} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== sel.name) updateSelected({ name: v }) }} /></label>
                    <label className="designer-field">Loại<select value={sel.gateType} onChange={(e) => updateSelected({ gateType: e.target.value as 'Entry' | 'Exit' })}><option value="Entry">Cổng vào</option><option value="Exit">Cổng ra</option></select></label>
                  </>
                )}
                {sel.t === 'road' && (
                  <label className="designer-field">Hướng<select value={sel.dir ?? ''} onChange={(e) => updateSelected({ dir: (e.target.value || undefined) as Dir | undefined })}><option value="">Hai chiều</option><option value="E">→ Phải</option><option value="W">← Trái</option><option value="N">↑ Lên</option><option value="S">↓ Xuống</option></select></label>
                )}
                {(sel.t === 'ramp' || sel.t === 'stairs') && (
                  <label className="designer-field">Nối tới tầng<select value={sel.to ?? ''} onChange={(e) => updateSelected({ to: e.target.value })}><option value="">Chọn tầng</option>{lotFloors.filter((f) => f.floorId !== floorId).map((f) => <option key={f.floorId} value={f.floorId}>{f.floorName}</option>)}</select></label>
                )}
                {sel.t === 'moto' && (
                  <label className="designer-field">Sức chứa (xe)<input type="number" min={1} max={50} value={sel.cap ?? 6} onChange={(e) => updateSelected({ cap: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} /></label>
                )}
                <button type="button" className="btn btn-ghost btn-sm manager-danger-action" onClick={() => { commit({ ...layout, cells: putCell(layout.cells, sel.x, sel.y, null) }); setSelected(null) }}><X size={15} aria-hidden /> Xoá ô này</button>
              </aside>
            )}
          </div>
        )}
      </div>

      {modal === 'lot' && <LotModal onClose={() => setModal(null)} onCreated={async (id) => { setModal(null); await loadCatalog(); setLotId(id); setFloorId('') }} />}
      {modal === 'floor' && <FloorModal parkingId={lotId} vehicleTypes={vehicleTypes} onClose={() => setModal(null)} onCreated={async (id) => { setModal(null); await loadCatalog(); setFloorId(id) }} />}
      {modal === 'copy' && (
        <CopyModal floors={lotFloors.filter((f) => f.floorId !== floorId)} onClose={() => setModal(null)} onCopy={(source, codePrefix) => {
          setModal(null)
          if (layout.cells.length && !window.confirm('Thay sơ đồ tầng này bằng bản chép?')) return
          commit(copyFromFloor(source, codePrefix))
        }} />
      )}
    </AdminPageShell>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="manager-modal-header"><div><h3 className="modal-title">{title}</h3></div><button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={onClose}><X size={20} aria-hidden /></button></div>
        {children}
      </div>
    </div>
  )
}

function LotModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !location.trim()) return setError('Nhập tên và địa chỉ bãi.')
    try {
      const lot = await parkingApi.create({ name: name.trim(), location: location.trim(), latitude: null, longitude: null, openingHours: null })
      onCreated(lot.id)
    } catch (err) {
      setError(errorMessage(err, 'Tạo bãi thất bại.'))
    }
  }
  return (
    <Modal title="Tạo bãi đỗ" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="manager-inline-error" role="alert">{error}</div>}
        <div className="form-field"><label htmlFor="lot-name">Tên bãi *</label><input id="lot-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="form-field"><label htmlFor="lot-loc">Địa chỉ *</label><input id="lot-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <small className="field-hint">Toạ độ, ảnh và giờ mở cửa sửa ở trang Bãi đỗ.</small>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary">Tạo bãi</button></div>
      </form>
    </Modal>
  )
}

function FloorModal({ parkingId, vehicleTypes, onClose, onCreated }: { parkingId: string; vehicleTypes: VehicleTypeDto[]; onClose: () => void; onCreated: (id: string) => void }) {
  const [floorName, setFloorName] = useState('')
  const [isResident, setIsResident] = useState(false)
  const [dedicated, setDedicated] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!floorName.trim()) return setError('Nhập tên tầng, ví dụ B1, Tầng 1.')
    try {
      // Sức chứa tạm 1: xuất bản sơ đồ sẽ tính lại theo số chỗ đỗ đã vẽ.
      const res = await apiClient.post<ApiResponse<FloorDto>>('/Floor', { parkingId, floorName: floorName.trim(), totalCapacity: 1, isResident, dedicatedVehicleTypeId: dedicated || null })
      if (!res.isSuccess || !res.result) return setError(res.message || 'Tạo tầng thất bại.')
      onCreated(res.result.floorId)
    } catch (err) {
      setError(errorMessage(err, 'Tạo tầng thất bại.'))
    }
  }
  return (
    <Modal title="Thêm tầng" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="manager-inline-error" role="alert">{error}</div>}
        <div className="form-field"><label htmlFor="fl-name">Tên tầng *</label><input id="fl-name" autoFocus value={floorName} onChange={(e) => setFloorName(e.target.value)} placeholder="B1, Tầng 1, Hầm 2..." /></div>
        <div className="form-field"><label htmlFor="fl-type">Dành riêng cho loại xe</label><select id="fl-type" value={dedicated} onChange={(e) => setDedicated(e.target.value)}><option value="">Không (vẽ ô theo loại xe)</option>{vehicleTypes.map((v) => <option key={v.vehicleTypeId} value={v.vehicleTypeId}>{v.typeName}</option>)}</select></div>
        <label className="manager-checkbox"><input type="checkbox" checked={isResident} onChange={(e) => setIsResident(e.target.checked)} /> Tầng cư dân (chỉ vé tháng)</label>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary">Thêm tầng</button></div>
      </form>
    </Modal>
  )
}

function CopyModal({ floors, onClose, onCopy }: { floors: FloorDto[]; onClose: () => void; onCopy: (layout: FloorLayoutData, prefix: string) => void }) {
  const [source, setSource] = useState(floors[0]?.floorId ?? '')
  const [prefix, setPrefix] = useState('')
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const res = await apiClient.get<ApiResponse<{ layout: FloorLayoutData | null }>>(`/FloorLayout/${source}/draft`)
      if (!res.isSuccess || !res.result?.layout) return setError('Tầng nguồn chưa có sơ đồ.')
      onCopy(res.result.layout, prefix)
    } catch (err) {
      setError(errorMessage(err, 'Không chép được.'))
    }
  }
  return (
    <Modal title="Chép sơ đồ từ tầng khác" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="manager-inline-error" role="alert">{error}</div>}
        <div className="form-field"><label htmlFor="cp-src">Tầng nguồn</label><select id="cp-src" value={source} onChange={(e) => setSource(e.target.value)}>{floors.map((f) => <option key={f.floorId} value={f.floorId}>{f.floorName}</option>)}</select></div>
        <div className="form-field"><label htmlFor="cp-prefix">Tiền tố thêm vào mã ô</label><input id="cp-prefix" value={prefix} maxLength={4} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="B2 → B2-A01" /><small className="field-hint">Mã ô không được trùng trong cả bãi.</small></div>
        <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary">Chép</button></div>
      </form>
    </Modal>
  )
}
