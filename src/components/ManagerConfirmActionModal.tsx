import { useId, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'

interface ManagerConfirmActionModalProps {
  open: boolean
  title: string
  description: ReactNode
  targetLabel?: string
  targetMeta?: string | null
  targetIcon?: ReactNode
  note?: ReactNode
  confirmLabel?: string
  loadingLabel?: string
  errorFallback?: string
  variant?: 'danger' | 'warning'
  onCancel: () => void
  onConfirm: () => Promise<void> | void
}

export default function ManagerConfirmActionModal({
  open,
  title,
  description,
  targetLabel,
  targetMeta,
  targetIcon,
  note,
  confirmLabel = 'Xác nhận xóa',
  loadingLabel = 'Đang xóa...',
  errorFallback = 'Không thể thực hiện thao tác. Vui lòng thử lại.',
  variant = 'danger',
  onCancel,
  onConfirm,
}: ManagerConfirmActionModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    setError('')
    try {
      await onConfirm()
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : errorFallback)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (!submitting) {
      setError('')
      onCancel()
    }
  }

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && handleCancel()}>
      <div className={`modal-panel manager-delete-modal manager-delete-modal--${variant}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <div className="manager-delete-modal-icon" aria-hidden><AlertTriangle size={28} /></div>
        <div className="manager-delete-modal-content">
          <h3 id={titleId} className="modal-title">{title}</h3>
          <div id={descriptionId} className="manager-delete-modal-description">{description}</div>
          {targetLabel && <div className="manager-delete-modal-target">{targetIcon ?? <Trash2 size={18} aria-hidden />}<span><strong>{targetLabel}</strong>{targetMeta && <small>{targetMeta}</small>}</span></div>}
          {note && <div className="manager-delete-modal-note">{note}</div>}
          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={handleCancel} disabled={submitting} autoFocus>Hủy</button>
            <button type="button" className="btn manager-delete-confirm" onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? <Loader2 size={17} className="spin" aria-hidden /> : <Trash2 size={17} aria-hidden />}
              {submitting ? loadingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
