import { apiClient } from '../config/api'
import type { ApiResponse } from './apiServices'

export interface GateScan {
  scanId: string
  gateId: string
  gateName: string
  imageUrl: string
  licensePlate: string | null
  /** 'web': máy chủ không đọc được, web tự đọc từ ảnh (cần staff kiểm tra kỹ). */
  plateSource?: 'server' | 'web'
  confidence: number | null
  capturedAt: string
  receivedAt: string
  scannedBy: { userId: string; fullName: string }
  status: 'New' | 'Handled' | 'Dismissed'
  suggestedType: string
  reservationId: string | null
  match: {
    reservation?: { reservationId: string; onTime: boolean } | null
    activeSession?: { sessionId: string } | null
  } | null
}

export const gateScanApi = {
  recent: (gateId: string) =>
    apiClient.get<ApiResponse<GateScan[]>>(
      `/GateScan/recent?gateId=${encodeURIComponent(gateId)}&limit=20`,
    ),
  setStatus: (id: string, status: 'Handled' | 'Dismissed') =>
    apiClient.patch<ApiResponse<GateScan>>(
      `/GateScan/${encodeURIComponent(id)}/status`,
      { status },
    ),
  /** Báo cổng đang trực để điện thoại máy quét của cùng tài khoản đổi theo. */
  claimGate: (gateId: string) =>
    apiClient.put<ApiResponse<unknown>>('/GateScan/my-gate', { gateId }),
}

export function mergeGateScans(
  current: GateScan[],
  incoming: GateScan[],
  gateId: string,
) {
  const byId = new Map(current.map((scan) => [scan.scanId, scan]))
  for (const scan of incoming) {
    if (scan.gateId === gateId) byId.set(scan.scanId, scan)
  }
  return [...byId.values()]
    .filter((scan) => scan.gateId === gateId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, 20)
}

/** Read lines rather than chunks: UTF-8 characters and SSE delimiters can span network reads. */
export async function readGateScanStream(
  response: Response,
  signal: AbortSignal,
  onScan: (scan: GateScan) => void,
) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let event = ''
  let data: string[] = []
  let eventSize = 0
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) cancel()
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      if (buffer.length + eventSize > 256 * 1024)
        throw new Error('Lượt quét trả về quá lớn.')
      let end = buffer.search(/[\r\n]/)
      while (end >= 0) {
        if (buffer[end] === '\r' && end === buffer.length - 1 && !done) break
        const line = buffer.slice(0, end)
        const separator =
          buffer[end] === '\r' && buffer[end + 1] === '\n' ? 2 : 1
        buffer = buffer.slice(end + separator)
        if (!line) {
          if ((event === 'scan' || event === 'scan-updated') && data.length) {
            let scan: GateScan | null = null
            try {
              scan = JSON.parse(data.join('\n')) as GateScan
            } catch {
              /* Ignore one malformed event. */
            }
            if (
              scan &&
              typeof scan.scanId === 'string' &&
              typeof scan.gateId === 'string' &&
              typeof scan.receivedAt === 'string' &&
              typeof scan.imageUrl === 'string' &&
              typeof scan.capturedAt === 'string' &&
              (scan.licensePlate === null ||
                typeof scan.licensePlate === 'string') &&
              ['New', 'Handled', 'Dismissed'].includes(scan.status)
            )
              onScan(scan)
          }
          event = ''
          data = []
          eventSize = 0
        } else {
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          const content =
            colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
          if (field === 'event') event = content
          if (field === 'data') {
            data.push(content)
            eventSize += content.length
          }
        }
        end = buffer.search(/[\r\n]/)
      }
      if (done) break
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
