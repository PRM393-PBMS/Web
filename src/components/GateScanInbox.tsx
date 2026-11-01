import { useState } from 'react'
import { CheckCircle2, Radio, Smartphone } from 'lucide-react'
import type { useGateScans } from '../hooks/useGateScans'
import type { GateScan } from '../utils/gateScans'
import { formatUtcToVietnamDateTime } from '../utils/dateTime'

interface Props {
  realtime: ReturnType<typeof useGateScans>
  disabled: boolean
  onUseScan: (scan: GateScan) => void
}

/** Kết quả đối chiếu của máy chủ (cùng nhãn với app máy quét của nhân viên). */
function suggestionOf(scan: GateScan): { label: string; tone: 'ok' | 'warn' | 'danger' | 'info' } | null {
  switch (scan.suggestedType?.toLowerCase()) {
    case 'reservation':
      return scan.match?.reservation?.onTime
        ? { label: 'Có đặt chỗ · đúng giờ', tone: 'ok' }
        : { label: 'Có đặt chỗ · lệch giờ hẹn', tone: 'warn' }
    case 'resident':
      return { label: 'Khách vé tháng', tone: 'ok' }
    case 'entrypass':
      return { label: 'Đã đăng ký gửi 1 lần', tone: 'ok' }
    case 'guest':
      return { label: 'Khách vãng lai', tone: 'info' }
    case 'inside':
      return { label: 'Xe đang trong bãi', tone: 'danger' }
    case 'checkout':
      return { label: 'Đang gửi · chờ checkout', tone: 'info' }
    case 'unknown':
      return scan.licensePlate ? { label: 'Không có phiên gửi xe', tone: 'warn' } : null
    default:
      return null
  }
}

export default function GateScanInbox({
  realtime,
  disabled,
  onUseScan,
}: Props) {
  const [updating, setUpdating] = useState(false)
  const pending = realtime.scans.filter((scan) => scan.status === 'New').length
  const connectionLabel = {
    connecting: 'Đang kết nối',
    connected: 'Đang nhận trực tiếp',
    retrying: 'Đang kết nối lại',
    error: 'Chưa kết nối',
  }[realtime.connection]
  const update = async (scan: GateScan, status: 'Handled' | 'Dismissed') => {
    setUpdating(true)
    try {
      await realtime.markStatus(scan.scanId, status)
    } finally {
      setUpdating(false)
    }
  }
  return (
    <section
      className="card-panel gate-scan-inbox"
      aria-label="Lượt quét từ điện thoại"
    >
      <header>
        <div>
          <Smartphone size={20} aria-hidden />
          <h3>
            Lượt quét từ điện thoại <small>({pending} chờ xử lý)</small>
          </h3>
        </div>
        <span
          className={`gate-scan-connection is-${realtime.connection}`}
          role="status"
        >
          <Radio size={14} aria-hidden />
          {connectionLabel}
        </span>
      </header>
      <p>
        Điện thoại chọn cùng cổng rồi chụp biển số. Chọn “Dùng lượt quét” để
        điền vào form bên dưới. Hiển thị tối đa 20 lượt gần nhất.
      </p>
      {realtime.error && (
        <p className="alert-inline alert-error" role="alert">
          {realtime.error}
        </p>
      )}
      {realtime.selectedScan && realtime.selectedScan.status !== 'New' && (
        <p role="alert">
          Lượt quét đang chọn đã được xử lý hoặc bỏ qua. Chọn lượt khác trước
          khi xác nhận.
        </p>
      )}
      {!realtime.scans.length ? (
        <p className="muted">Chưa có lượt quét tại cổng này.</p>
      ) : (
        <div className="gate-scan-list">
          {realtime.scans.map((scan) => (
            <article
              key={scan.scanId}
              className={`gate-scan-item${realtime.selectedScan?.scanId === scan.scanId ? ' is-selected' : ''}`}
            >
              <img
                src={scan.imageUrl}
                alt={`Ảnh biển số ${scan.licensePlate || 'chưa đọc được'}`}
                loading="lazy"
              />
              <div>
                <strong>{scan.licensePlate || 'Chưa đọc được biển số'}</strong>
                {suggestionOf(scan) && (
                  <span className={`gate-scan-suggestion gate-scan-suggestion--${suggestionOf(scan)!.tone}`}>
                    {suggestionOf(scan)!.label}
                  </span>
                )}
                <small>
                  {scan.scannedBy?.fullName || 'Nhân viên'} ·{' '}
                  {formatUtcToVietnamDateTime(scan.capturedAt)}
                </small>
                <small>
                  {scan.gateName} ·{' '}
                  {scan.status === 'New'
                    ? 'Chờ xử lý'
                    : scan.status === 'Handled'
                      ? 'Đã xử lý'
                      : 'Đã bỏ qua'}
                </small>
                <div className="gate-scan-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={disabled || updating || scan.status !== 'New'}
                    onClick={() => onUseScan(scan)}
                  >
                    {realtime.selectedScan?.scanId === scan.scanId
                      ? 'Đang dùng lượt này'
                      : 'Dùng lượt quét'}
                  </button>
                  {scan.status === 'New' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={disabled || updating}
                        onClick={() => void update(scan, 'Handled')}
                      >
                        <CheckCircle2 size={14} aria-hidden />
                        Đã xử lý
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={disabled || updating}
                        onClick={() => void update(scan, 'Dismissed')}
                      >
                        Bỏ qua
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
