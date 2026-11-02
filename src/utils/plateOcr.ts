import type { Worker } from 'tesseract.js'

/**
 * Đọc biển số Việt Nam từ ảnh ngay trên máy tính của staff (tesseract.js, không cần khoá API).
 * Dạng đã bỏ dấu và khoảng trắng: 2 số tỉnh + 1-2 chữ (+1 số với xe máy) + 4-5 số.
 * Ví dụ 51H12345, 51LD12345, 29B112345, 59X31234.
 */
const PLATE = /^(\d{2})([A-Z]{1,2}\d?)(\d{4,5})$/

/** Ký tự hay đọc nhầm ở chỗ phải là số / phải là chữ. */
const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' }
const TO_LETTER: Record<string, string> = { '0': 'D', '8': 'B', '5': 'S', '2': 'Z', '6': 'G', '4': 'A', '1': 'T' }

const fix = (part: string, map: Record<string, string>) =>
  [...part].map((c) => map[c] ?? c).join('')

/** Bỏ dấu, gạch, chấm, khoảng trắng; chữ hoa. Đ đọc thành D. */
export function cleanPlateText(raw: string) {
  return raw.toUpperCase().replace(/Đ/g, 'D').replace(/[^A-Z0-9]/g, '')
}

/** Biển số hợp lệ từ một chuỗi, có sửa ký tự nhầm theo vị trí; null nếu không ra biển số. */
export function parsePlate(raw: string): string | null {
  const s = cleanPlateText(raw)
  if (s.length < 7 || s.length > 10) return null
  if (PLATE.test(s)) return s
  // Thử các cách chia: 2 số tỉnh | 1-2 chữ (+ 1 số) | 4-5 số cuối.
  for (const serial of [5, 4]) {
    for (const letters of [1, 2]) {
      for (const extra of [0, 1]) {
        if (2 + letters + extra + serial !== s.length) continue
        const rawSeries = s.slice(2, 2 + letters)
        // Seri phải có ít nhất một chữ thật, để chuỗi toàn số (số điện thoại...) không thành biển số.
        if (!/[A-Z]/.test(rawSeries)) continue
        const fixed =
          fix(s.slice(0, 2), TO_DIGIT) +
          fix(rawSeries, TO_LETTER) +
          fix(s.slice(2 + letters, 2 + letters + extra), TO_DIGIT) +
          fix(s.slice(s.length - serial), TO_DIGIT)
        if (PLATE.test(fixed)) return fixed
      }
    }
  }
  return null
}

/** Tìm biển số trong các dòng chữ đọc được. Biển xe máy có 2 dòng nên ghép từng cặp dòng liền nhau. */
export function pickPlate(text: string): string | null {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const one = parsePlate(lines[i])
    if (one) return one
    if (i + 1 < lines.length) {
      const two = parsePlate(lines[i] + lines[i + 1])
      if (two) return two
    }
  }
  return parsePlate(lines.join(''))
}

export interface PlateBox {
  x: number
  y: number
  w: number
  h: number
}

/** Ngưỡng Otsu: tách nền sáng (biển số) và tối trên ảnh xám. */
export function otsuThreshold(gray: ArrayLike<number>) {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = gray.length - wB
    if (!wF) break
    sumB += t * hist[t]
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/**
 * Tìm vùng có thể là biển số: khối sáng liền nhau, tỉ lệ ngang/dọc của biển ô tô (~4:1) hoặc xe máy (~1.4:1),
 * phần lớn là nền sáng (chữ đen tạo lỗ bên trong). Trả tối đa 3 vùng, vùng gần giữa ảnh trước.
 */
export function findPlateBoxes(gray: ArrayLike<number>, width: number, height: number): PlateBox[] {
  const threshold = otsuThreshold(gray)
  const seen = new Uint8Array(width * height)
  const stack = new Int32Array(width * height)
  const boxes: (PlateBox & { score: number })[] = []
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || gray[start] <= threshold) continue
    let top = 0
    stack[top++] = start
    seen[start] = 1
    let count = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    while (top) {
      const i = stack[--top]
      const x = i % width
      const y = (i - x) / width
      count++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (const n of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (n >= 0 && !seen[n] && gray[n] > threshold) {
          seen[n] = 1
          stack[top++] = n
        }
      }
    }
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const aspect = w / h
    const fill = count / (w * h)
    if (w < width * 0.08 || h < height * 0.03) continue
    if (w * h > width * height * 0.6) continue
    if (aspect < 0.9 || aspect > 6.5 || fill < 0.4) continue
    const dx = (minX + w / 2) / width - 0.5
    const dy = (minY + h / 2) / height - 0.45
    boxes.push({ x: minX, y: minY, w, h, score: Math.hypot(dx, dy) })
  }
  return boxes
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ x, y, w, h }) => ({ x, y, w, h }))
}

let worker: Promise<Worker> | null = null
/** Một worker dùng chung; ảnh xếp hàng đọc lần lượt. */
let queue: Promise<unknown> = Promise.resolve()

function getWorker() {
  worker ??= import('tesseract.js').then(async ({ createWorker, PSM }) => {
    const w = await createWorker('eng')
    await w.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    })
    return w
  })
  worker.catch(() => {
    worker = null
  })
  return worker
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas')
  return { canvas, ctx }
}

/**
 * Link ảnh cũ lưu dạng http:// (máy chủ sau proxy HTTPS). Render chuyển hướng sang https không kèm CORS
 * nên trình duyệt chặn; đổi sẵn sang https, trừ máy chạy local.
 */
export function secureImageUrl(url: string): string {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(url) ? url : url.replace(/^http:\/\//i, 'https://')
}

/**
 * Khung căn biển số trên màn máy quét của điện thoại, quy ra toạ độ ảnh chụp dọc:
 * khung rộng 82% màn hình, cao bằng nửa chiều rộng, tâm ở 42% chiều cao; màn hình (~9:19.5) cắt
 * hai bên ảnh 3:4. Kèm một vùng rộng hơn phòng khi nhân viên căn lệch.
 */
export function phoneFrameBoxes(width: number, height: number): PlateBox[] {
  if (height <= width) {
    // Ảnh ngang: không rõ khung, lấy dải giữa.
    return [{ x: width * 0.15, y: height * 0.25, w: width * 0.7, h: height * 0.5 }]
  }
  const box = (wf: number, hf: number, cy: number) => ({
    x: width * (0.5 - wf / 2),
    y: height * (cy - hf / 2),
    w: width * wf,
    h: height * hf,
  })
  return [box(0.5, 0.19, 0.42), box(0.7, 0.3, 0.42)]
}

/** Một vùng ảnh (mặc định cả ảnh) thu nhỏ sang xám để tìm vùng biển số cho nhanh. */
function smallGray(image: ImageBitmap, region: PlateBox = { x: 0, y: 0, w: image.width, h: image.height }, width = 480) {
  const scale = Math.min(1, width / region.w)
  const { canvas, ctx } = canvasOf(region.w * scale, region.h * scale)
  ctx.drawImage(image, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const gray = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = Math.round(data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114)
  }
  return { gray, width: canvas.width, height: canvas.height, scale }
}

/** Vùng giống biển số bên trong `region`, quy về toạ độ ảnh gốc. */
function plateBoxesIn(image: ImageBitmap, region?: PlateBox): PlateBox[] {
  const small = smallGray(image, region)
  return findPlateBoxes(small.gray, small.width, small.height).map((b) => ({
    x: (region?.x ?? 0) + b.x / small.scale,
    y: (region?.y ?? 0) + b.y / small.scale,
    w: b.w / small.scale,
    h: b.h / small.scale,
  }))
}

/**
 * Cắt một vùng ảnh gốc, lẹm vào trong một chút, xám và tăng tương phản, cỡ vừa cho tesseract.
 * Không thêm lề ra ngoài: nền tối quanh biển làm tesseract không đọc ra chữ nào.
 */
function crop(image: ImageBitmap, box: PlateBox) {
  const pad = -Math.round(Math.min(box.w, box.h) * 0.03)
  const sx = Math.max(0, box.x - pad)
  const sy = Math.max(0, box.y - pad)
  const sw = Math.min(image.width - sx, box.w + pad * 2)
  const sh = Math.min(image.height - sy, box.h + pad * 2)
  const scale = Math.min(3, 900 / sw)
  const { canvas, ctx } = canvasOf(sw * scale, sh * scale)
  ctx.filter = 'grayscale(1) contrast(1.5)'
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Đọc biển số từ ảnh lượt quét, thử lần lượt tới khi ra biển số:
 * vùng giống biển trong khung căn của điện thoại → chính khung căn (sát, rộng) → vùng giống biển trong cả ảnh → cả ảnh.
 * Trả null khi không đọc được, không ném lỗi (lý do ghi ở console để dò lỗi).
 */
export function readPlateFromImage(imageUrl: string): Promise<string | null> {
  const job = queue.then(async () => {
    const url = secureImageUrl(imageUrl)
    try {
      const response = await fetch(url, { mode: 'cors' })
      if (!response.ok) {
        console.warn(`[plateOcr] Không tải được ảnh ${url}: HTTP ${response.status}`)
        return null
      }
      const image = await createImageBitmap(await response.blob())
      const frames = phoneFrameBoxes(image.width, image.height)
      const candidates = [
        ...plateBoxesIn(image, frames[frames.length - 1]),
        ...frames,
        ...plateBoxesIn(image),
        { x: 0, y: 0, w: image.width, h: image.height },
      ]
      const w = await getWorker()
      const seen: string[] = []
      for (const box of candidates) {
        const { data } = await w.recognize(crop(image, box))
        const plate = pickPlate(data.text)
        if (plate) return plate
        if (data.text.trim()) seen.push(data.text.trim().replace(/\s+/g, ' '))
      }
      console.info(`[plateOcr] Không ra biển số từ ${url}. Chữ đọc được: ${seen.join(' | ') || '(không có)'}`)
      return null
    } catch (error) {
      // Thường là CORS: origin của web chưa nằm trong CORS_ORIGIN của backend.
      console.warn(`[plateOcr] Lỗi đọc ảnh ${url}:`, error)
      return null
    }
  })
  queue = job
  return job
}
