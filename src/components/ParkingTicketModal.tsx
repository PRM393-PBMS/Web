import { Download, Printer, X } from 'lucide-react'
import type { ParkingSessionDto } from '../utils/apiServices'
import { formatUtcToVietnamDateTime } from '../utils/dateTime'
import {
  downloadParkingTicket,
  printParkingTicket,
} from '../utils/parkingTicket'

interface ParkingTicketModalProps {
  session: ParkingSessionDto | null
  floorName?: string
  allowPrint?: boolean
  onClose: () => void
}

export default function ParkingTicketModal({
  session,
  floorName,
  allowPrint = true,
  onClose,
}: ParkingTicketModalProps) {
  if (!session?.ticket) return null

  const ticket = session.ticket
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel staff-ticket-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parking-ticket-modal-title"
      >
        <div className="staff-ticket-modal-header">
          <div>
            <h3 id="parking-ticket-modal-title" className="modal-title">
              Mã vé giữ xe
            </h3>
            <p>
              {session.licensePlateIn} ·{' '}
              {session.vehicleTypeName || 'Chưa rõ loại xe'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Đóng mã vé"
            onClick={onClose}
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="staff-ticket-modal-content">
          <img
            src={ticket.qrCodeDataUrl}
            alt={`Mã QR vé giữ xe ${session.licensePlateIn}`}
            className="staff-ticket-modal-qr"
          />
          <span>Mã vé</span>
          <code className="reservation-ticket-code">{ticket.qrPayload}</code>
          <p>Giờ vào: {formatUtcToVietnamDateTime(session.entryTime)}</p>
          <small>
            Dùng mã QR này để xác minh và làm thủ tục khi đưa xe ra khỏi bãi.
          </small>
          <div className="staff-ticket-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() =>
                downloadParkingTicket(
                  ticket.qrCodeDataUrl,
                  session.licensePlateIn,
                  session.sessionId,
                )
              }
            >
              <Download size={17} aria-hidden />
              Tải vé
            </button>
            {allowPrint && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  printParkingTicket({
                    qrCodeDataUrl: ticket.qrCodeDataUrl,
                    sessionId: session.sessionId,
                    licensePlate: session.licensePlateIn,
                    vehicleTypeName: session.vehicleTypeName,
                    slotCode:
                      session.actualSlotCode || session.assignedSlotCode,
                    floorName,
                    gateName: session.entryGateName,
                    entryTime: session.entryTime,
                  })
                }
              >
                <Printer size={17} aria-hidden />
                In vé
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
