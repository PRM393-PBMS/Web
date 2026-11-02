/**
 * Sơ đồ tầng (cùng định dạng với backend src/parking/floor-layout.ts): lưới w×h, lưu thưa các ô có nội dung.
 * Kiểm tra lối đi ở đây chỉ để báo sớm khi vẽ; backend kiểm tra lại khi xuất bản.
 */
export type CellType = 'road' | 'slot' | 'moto' | 'gate' | 'ramp' | 'stairs' | 'wall' | 'pillar' | 'kiosk' | 'walk'
export type Dir = 'N' | 'E' | 'S' | 'W'

export interface LayoutCell {
  x: number
  y: number
  t: CellType
  dir?: Dir
  code?: string
  vehicleTypeId?: string
  slotId?: string
  name?: string
  gateType?: 'Entry' | 'Exit'
  gateId?: string
  to?: string
  cap?: number
}

export interface FloorLayoutData {
  w: number
  h: number
  cells: LayoutCell[]
  bg?: { url: string; opacity: number } | null
}

export const MIN_SIZE = 4
export const MAX_SIZE = 60
export const key = (x: number, y: number) => `${x},${y}`
const DIRS: Record<Dir, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }
const OPPOSITE: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' }
const DRIVABLE = new Set<CellType>(['road', 'gate', 'ramp'])
export const DIR_ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' }

export function emptyLayout(w = 24, h = 14): FloorLayoutData {
  return { w, h, cells: [] }
}

/** Đặt (hoặc xoá khi [cell] null) một ô; trả mảng mới. */
export function putCell(cells: LayoutCell[], x: number, y: number, cell: LayoutCell | null): LayoutCell[] {
  const rest = cells.filter((c) => c.x !== x || c.y !== y)
  return cell ? [...rest, { ...cell, x, y }] : rest
}

export function canMove(from: LayoutCell | undefined, to: LayoutCell | undefined, d: Dir): boolean {
  if (!from || !to || !DRIVABLE.has(from.t) || !DRIVABLE.has(to.t)) return false
  if (from.dir && from.dir !== d) return false
  return to.dir !== OPPOSITE[d]
}

/** Chỗ đỗ (ô tô, khu xe máy) chưa có lối đi nối từ cổng vào hoặc dốc. */
export function unreachableParking(layout: FloorLayoutData): Set<string> {
  const grid = new Map(layout.cells.map((c) => [key(c.x, c.y), c]))
  const queue = layout.cells.filter((c) => (c.t === 'gate' && c.gateType !== 'Exit') || c.t === 'ramp')
  const seen = new Set(queue.map((c) => key(c.x, c.y)))
  while (queue.length) {
    const cur = queue.shift()!
    for (const [d, [dx, dy]] of Object.entries(DIRS) as [Dir, [number, number]][]) {
      const k = key(cur.x + dx, cur.y + dy)
      if (!seen.has(k) && canMove(cur, grid.get(k), d)) {
        seen.add(k)
        queue.push(grid.get(k)!)
      }
    }
  }
  return new Set(
    layout.cells
      .filter((c) => (c.t === 'slot' || c.t === 'moto') && !Object.values(DIRS).some(([dx, dy]) => seen.has(key(c.x + dx, c.y + dy))))
      .map((c) => key(c.x, c.y)),
  )
}

/** Mã ô kế tiếp cho khu [prefix]: A01, A02... (bỏ qua mã đã có trong [taken]). */
export function nextSlotCode(prefix: string, taken: Iterable<string>): string {
  const p = prefix.trim().toUpperCase()
  const used = new Set(taken)
  let max = 0
  for (const code of used) {
    if (code.startsWith(p)) {
      const n = Number(code.slice(p.length).replace(/^-/, ''))
      if (Number.isInteger(n)) max = Math.max(max, n)
    }
  }
  let n = max + 1
  while (used.has(`${p}${String(n).padStart(2, '0')}`)) n++
  return `${p}${String(n).padStart(2, '0')}`
}

export function nextGateName(cells: LayoutCell[]): string {
  const names = new Set(cells.filter((c) => c.t === 'gate').map((c) => c.name))
  let n = 1
  while (names.has(`Cổng ${n}`)) n++
  return `Cổng ${n}`
}

export const nextLetter = (prefix: string) =>
  prefix.length === 1 && /[A-Y]/i.test(prefix) ? String.fromCharCode(prefix.toUpperCase().charCodeAt(0) + 1) : `${prefix}2`

/** Mẫu "dãy ô hai bên lối đi": hàng ô [prefixA], lối đi, hàng ô [prefixB]; lối đi kéo dài 1 ô về bên trái để nối. */
export function stampDoubleRow(
  layout: FloorLayoutData,
  ox: number,
  oy: number,
  n: number,
  prefixA: string,
  prefixB: string,
  vehicleTypeId: string,
): LayoutCell[] {
  let cells = layout.cells
  const codes = () => cells.filter((c) => c.code).map((c) => c.code!)
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < layout.w && y < layout.h
  for (let i = 0; i < n; i++) {
    if (inside(ox + i, oy)) cells = putCell(cells, ox + i, oy, { x: 0, y: 0, t: 'slot', code: nextSlotCode(prefixA, codes()), vehicleTypeId })
  }
  for (let i = -1; i < n; i++) if (inside(ox + i, oy + 1)) cells = putCell(cells, ox + i, oy + 1, { x: 0, y: 0, t: 'road' })
  for (let i = 0; i < n; i++) {
    if (inside(ox + i, oy + 2)) cells = putCell(cells, ox + i, oy + 2, { x: 0, y: 0, t: 'slot', code: nextSlotCode(prefixB, codes()), vehicleTypeId })
  }
  return cells
}

/** Mẫu "khu xe máy": khối 4×3 ô xe máy và một hàng lối đi phía dưới. */
export function stampMotoArea(layout: FloorLayoutData, ox: number, oy: number): LayoutCell[] {
  let cells = layout.cells
  for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) {
    if (ox + x < layout.w && oy + y < layout.h) cells = putCell(cells, ox + x, oy + y, { x: 0, y: 0, t: 'moto', cap: 6 })
  }
  for (let x = -1; x < 4; x++) {
    if (ox + x >= 0 && ox + x < layout.w && oy + 3 < layout.h) cells = putCell(cells, ox + x, oy + 3, { x: 0, y: 0, t: 'road' })
  }
  return cells
}

/** Mẫu "khung bãi cơ bản": tường bao, lối đi vòng bên trong, cổng vào giữa cạnh trái. Thay toàn bộ sơ đồ. */
export function stampBasicFrame(w: number, h: number): LayoutCell[] {
  const cells: LayoutCell[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1
    const ring = !edge && (x === 1 || y === 1 || x === w - 2 || y === h - 2)
    if (edge) cells.push({ x, y, t: 'wall' })
    else if (ring) cells.push({ x, y, t: 'road' })
  }
  const mid = Math.floor(h / 2)
  return putCell(cells, 0, mid, { x: 0, y: mid, t: 'gate', name: 'Cổng 1', gateType: 'Entry' })
}

/** Chép sơ đồ tầng khác: bỏ id ô/cổng (ô mới), thêm tiền tố vào mã ô để không trùng trong bãi. */
export function copyFromFloor(source: FloorLayoutData, codePrefix: string): FloorLayoutData {
  const p = codePrefix.trim().toUpperCase()
  return {
    w: source.w,
    h: source.h,
    bg: source.bg ?? null,
    cells: source.cells.map((c) => {
      const copy: LayoutCell = { ...c }
      delete copy.slotId
      delete copy.gateId
      if (copy.code && p) copy.code = `${p}-${copy.code}`.slice(0, 15)
      return copy
    }),
  }
}

/** Đổi kích thước lưới; ô nằm ngoài bị bỏ. */
export function resize(layout: FloorLayoutData, w: number, h: number): FloorLayoutData {
  return { ...layout, w, h, cells: layout.cells.filter((c) => c.x < w && c.y < h) }
}
