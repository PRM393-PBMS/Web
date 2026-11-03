import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Banknote, HandCoins, RefreshCw, X } from 'lucide-react'
import StaffPageShell from '../../components/StaffPageShell'
import {
  cashApi,
  cashPeriod,
  HANDOVER_STATUS_LABELS,
  handoverStatusClass,
  type CashHandoverDto,
  type CashHoldingDto,
} from '../../utils/cashLedger'
import { formatUtcToVietnamDateTime } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Nhân viên xem tiền mặt đang giữ từ các lượt checkout và chốt nộp cho quản lý cuối ca. */
export default function StaffCashHolding() {
  const [holding, setHolding] = useState<CashHoldingDto | null>(null)
  const [history, setHistory] = useState<CashHandoverDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [held, handovers] = await Promise.all([
        cashApi.myHolding(),
        cashApi.handovers(cashPeriod('this-month')),
      ])
      if (!held.isSuccess || !held.result) throw new Error(held.message || 'Không tải được tiền mặt đang giữ.')
      setHolding(held.result)
      setHistory(handovers.isSuccess && Array.isArray(handovers.result) ? handovers.result : [])
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try {
      const res = await cashApi.submitHandover(note.trim())
      if (!res.isSuccess || !res.result) {
        setFormError(res.message || 'Không chốt được phiếu nộp tiền.')
        return
      }
      setConfirmOpen(false)
      setNote('')
      setNotice(`Đã chốt ${formatCurrency(res.result.amount)} (${res.result.paymentCount} khoản). Giao tiền cho quản lý để xác nhận.`)
      await load()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Không chốt được phiếu nộp tiền.'))
    } finally {
      setSubmitting(false)
    }
  }

  const count = holding?.count ?? 0

  return (
    <StaffPageShell activeItem="cash">
      <div className="staff-content-wrapper staff-manager-page manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--green"><Banknote size={24} aria-hidden /></span>
            <div><h2>Tiền mặt đang giữ</h2><p>Tiền mặt thu khi checkout. Cuối ca chốt nộp, quản lý nhận đủ tiền thì xác nhận.</p></div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || count === 0}
              onClick={() => { setConfirmOpen(true); setFormError(''); setNotice('') }}
            >
              <HandCoins size={17} aria-hidden /> Chốt và nộp tiền
            </button>
          </div>
        </header>

        {error && <div className="manager-inline-error" role="alert">{error}</div>}
        {notice && <div className="alert-inline alert-success" role="status">{notice}</div>}

        <section className="manager-summary-grid manager-summary-grid--three">
          <article className="manager-summary-card manager-summary-card--money">
            <span>Đang giữ</span>
            <strong>{formatCurrency(holding?.amount ?? 0)}</strong>
            <small>{count} khoản{holding?.since ? ` · từ ${formatUtcToVietnamDateTime(holding.since)}` : ''}</small>
          </article>
          <article className="manager-summary-card manager-summary-card--orange">
            <span>Đã chốt, chờ quản lý nhận</span>
            <strong>{formatCurrency(holding?.pendingAmount ?? 0)}</strong>
            <small>{holding?.pendingHandovers.length ?? 0} phiếu</small>
          </article>
          <article className="manager-summary-card manager-summary-card--accent">
            <span>Đã nộp tháng này</span>
            <strong>{formatCurrency(history.filter((h) => h.status === 'Confirmed').reduce((sum, h) => sum + h.amount, 0))}</strong>
            <small>{history.filter((h) => h.status === 'Confirmed').length} phiếu quản lý đã nhận</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <h3 className="cash-section-title">Các khoản đang giữ</h3>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Thời gian thu</th><th>Biển số</th><th>Cổng</th><th className="cash-amount-col">Số tiền</th></tr></thead>
              <tbody>
                {loading && !holding ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : count === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state"><Banknote size={30} aria-hidden /><strong>Không giữ khoản tiền mặt nào</strong></div></td></tr>
                ) : holding!.payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{formatUtcToVietnamDateTime(p.paymentTime)}</td>
                    <td><strong>{p.licensePlate || '—'}</strong></td>
                    <td>{p.gateName || '—'}</td>
                    <td className="cash-amount-col"><strong>{formatCurrency(p.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-panel manager-resource-panel">
          <h3 className="cash-section-title">Phiếu nộp tháng này</h3>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Chốt lúc</th><th className="cash-amount-col">Số tiền</th><th>Trạng thái</th><th>Quản lý</th></tr></thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Chưa có phiếu nộp tháng này.</div></td></tr>
                ) : history.map((h) => (
                  <tr key={h.handoverId}>
                    <td>{formatUtcToVietnamDateTime(h.submittedAt)}{h.note && <div><small className="manager-muted-value">{h.note}</small></div>}</td>
                    <td className="cash-amount-col"><strong>{formatCurrency(h.amount)}</strong><div><small>{h.paymentCount} khoản</small></div></td>
                    <td><span className={`manager-change-status ${handoverStatusClass(h.status)}`}><i />{HANDOVER_STATUS_LABELS[h.status] ?? h.status}</span></td>
                    <td>
                      {h.reviewedByName || '—'}
                      {h.reviewNote && <div><small className="manager-muted-value">{h.reviewNote}</small></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {confirmOpen && holding && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !submitting && setConfirmOpen(false)}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="cash-submit-title">
            <div className="manager-modal-header">
              <div>
                <h3 id="cash-submit-title" className="modal-title">Chốt nộp {formatCurrency(holding.amount)}</h3>
                <p>{holding.count} khoản đang giữ sẽ vào một phiếu. Đếm tiền, giao cho quản lý; quản lý xác nhận khi nhận đủ.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setConfirmOpen(false)} disabled={submitting}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={submit}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-field">
                <label htmlFor="cash-note">Ghi chú (tuỳ chọn)</label>
                <textarea id="cash-note" maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: chốt ca chiều, cổng ra A" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Đang chốt...' : 'Chốt phiếu nộp'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StaffPageShell>
  )
}
