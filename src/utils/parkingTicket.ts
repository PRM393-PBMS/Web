import { formatUtcToVietnamDateTime } from './dateTime'

export interface PrintableParkingTicket {
  qrCodeDataUrl: string
  sessionId: string
  licensePlate?: string
  vehicleTypeName?: string
  slotCode?: string
  floorName?: string
  gateName?: string
  entryTime?: string
}

function ticketFileName(licensePlate?: string, sessionId?: string) {
  const identity = (licensePlate || sessionId?.slice(0, 8) || 'xe')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
  return `ve-xe-${identity}.png`
}

export function downloadParkingTicket(
  qrCodeDataUrl: string,
  licensePlate?: string,
  sessionId?: string,
) {
  const anchor = document.createElement('a')
  anchor.href = qrCodeDataUrl
  anchor.download = ticketFileName(licensePlate, sessionId)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function escapeTicketText(value?: string) {
  return (value || '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function printParkingTicket(ticket: PrintableParkingTicket) {
  const printWindow = window.open('', '_blank', 'width=520,height=760')
  if (!printWindow) return

  const entryTime = ticket.entryTime
    ? formatUtcToVietnamDateTime(ticket.entryTime)
    : '—'
  printWindow.document.write(`<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>Vé xe ${escapeTicketText(ticket.licensePlate)}</title>
        <style>
          @page { size: 80mm auto; margin: 5mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
          .ticket { width: 70mm; margin: 0 auto; padding: 5mm; border: 1px dashed #64748b; text-align: center; }
          h1 { margin: 0 0 2mm; font-size: 18px; }
          .sub { margin: 0 0 4mm; color: #475569; font-size: 11px; }
          img { width: 42mm; height: 42mm; object-fit: contain; }
          .plate { margin: 3mm 0; padding: 2mm; border: 2px solid #111827; border-radius: 3px; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
          dl { display: grid; grid-template-columns: 24mm 1fr; gap: 1.5mm; margin: 4mm 0 0; text-align: left; font-size: 11px; }
          dt { color: #64748b; } dd { margin: 0; font-weight: 700; overflow-wrap: anywhere; }
          .note { margin: 4mm 0 0; padding-top: 3mm; border-top: 1px dashed #cbd5e1; font-size: 10px; color: #475569; }
        </style>
      </head>
      <body>
        <section class="ticket">
          <h1>VÉ GIỮ XE</h1>
          <p class="sub">Xuất trình mã QR khi làm thủ tục ra bãi</p>
          <img src="${ticket.qrCodeDataUrl}" alt="QR vé xe" />
          <div class="plate">${escapeTicketText(ticket.licensePlate)}</div>
          <dl>
            <dt>Loại xe</dt><dd>${escapeTicketText(ticket.vehicleTypeName)}</dd>
            <dt>Tầng</dt><dd>${escapeTicketText(ticket.floorName)}</dd>
            <dt>Cổng vào</dt><dd>${escapeTicketText(ticket.gateName)}</dd>
            <dt>Vị trí</dt><dd>${escapeTicketText(ticket.slotCode)}</dd>
            <dt>Giờ vào</dt><dd>${escapeTicketText(entryTime)}</dd>
            <dt>Session ID</dt><dd>${escapeTicketText(ticket.sessionId)}</dd>
          </dl>
          <p class="note">Không chia sẻ vé cho người khác. Báo ngay cho nhân viên nếu mã vé không sử dụng được.</p>
        </section>
      </body>
    </html>`)
  printWindow.document.close()

  const print = () => {
    printWindow.focus()
    printWindow.print()
  }
  const qrImage = printWindow.document.querySelector('img')
  if (qrImage?.complete) {
    window.setTimeout(print, 150)
  } else {
    qrImage?.addEventListener('load', print, { once: true })
  }
}
