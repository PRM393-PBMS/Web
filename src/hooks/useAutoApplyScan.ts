import { useEffect, useRef } from 'react'
import type { GateScan } from '../utils/gateScans'
import type { useGateScans } from './useGateScans'

/** Lượt quét cũ hơn mức này (vd. còn sót từ ca trước) không tự điền, nhân viên tự chọn. */
const FRESH_MS = 5 * 60 * 1000

interface Options {
  realtime: ReturnType<typeof useGateScans>
  /** Điền toàn bộ form từ một lượt quét (ảnh, biển số, loại khách...). */
  apply: (scan: GateScan) => void
  /** Chỉ điền biển số vào form đang mở (web đọc xong biển số sau khi form đã điền ảnh). */
  fillPlate: (plate: string, scan: GateScan) => void
  /** Form đang rảnh: không gửi, không tải ảnh, không chờ thanh toán. */
  idle: boolean
  /** Ô biển số đang trống: chỉ tự điền biển số đọc muộn khi nhân viên chưa gõ tay. */
  plateEmpty: boolean
}

/**
 * Lượt quét từ điện thoại tự điền vào form, không cần bấm "Dùng lượt quét":
 * - Có lượt quét mới (chưa xử lý, trong 5 phút) mà form không đang dùng lượt quét nào → điền luôn.
 * - Lượt quét đang dùng có biển số muộn (web tự đọc xong) mà ô biển số còn trống → điền biển số.
 * Lượt quét đang dùng chưa xử lý thì lượt mới chờ trong danh sách, không đè lên form đang nhập.
 */
export function useAutoApplyScan({ realtime, apply, fillPlate, idle, plateEmpty }: Options) {
  const applied = useRef(new Set<string>())
  const filledPlate = useRef(new Map<string, string>())
  // Giữ bản mới nhất của hàm điền, để effect không chạy lại chỉ vì hàm được tạo lại mỗi lần render.
  const applyRef = useRef(apply)
  const fillPlateRef = useRef(fillPlate)
  useEffect(() => {
    applyRef.current = apply
    fillPlateRef.current = fillPlate
  })

  const selected = realtime.selectedScan
  const scans = realtime.scans

  useEffect(() => {
    if (!idle) return
    if (selected && selected.status === 'New') {
      const plate = selected.licensePlate
      if (plate && plateEmpty && filledPlate.current.get(selected.scanId) !== plate) {
        filledPlate.current.set(selected.scanId, plate)
        queueMicrotask(() => fillPlateRef.current(plate, selected))
      }
      return
    }
    const now = Date.now()
    const next = scans
      .filter(
        (scan) =>
          scan.status === 'New' &&
          !applied.current.has(scan.scanId) &&
          now - new Date(scan.receivedAt).getTime() <= FRESH_MS,
      )
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]
    if (!next) return
    applied.current.add(next.scanId)
    if (next.licensePlate) filledPlate.current.set(next.scanId, next.licensePlate)
    queueMicrotask(() => applyRef.current(next))
  }, [idle, plateEmpty, scans, selected])
}
