import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, Check, Download, Eye, RefreshCw, X } from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import {
  CASH_STATE_LABELS,
  cashApi,
  cashCustomRange,
  cashPeriod,
  cashStateClass,
  formatCashRange,
  HANDOVER_STATUS_LABELS,
  handoverStatusClass,
  type CashHandoverDto,
  type CashLedgerDto,
  type CashPeriodPreset,
  type CashState,
} from '../../utils/cashLedger'
import { formatUtcToVietnamDateTime, toVietnamDateInput } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

const PRESETS: { value: CashPeriodPreset; label: string }[] = [
  { value: 'this-week', label: 'Tuần này' },
  { value: 'last-week', label: 'Tuần trước' },
  { value: 'this-month', label: 'Tháng này' },
  { value: 'last-month', label: 'Tháng trước' },
  { value: 'custom', label: 'Tuỳ chọn ngày' },
]

/** Phiếu chờ nhận không phụ thuộc kỳ đang xem: lấy trong 400 ngày gần nhất (giới hạn của máy chủ). */
const pendingRange = () => {
  const to = new Date(Date.now() + 86_400_000)
  return { from: new Date(to.getTime() - 399 * 86_400_000), to }
}

type Review = { handover: CashHandoverDto; mode: 'view' | 'confirm' | 'reject' }

/** Sổ quỹ tiền mặt: tra cứu theo tuần/tháng, ai đang giữ tiền, nhận phiếu nộp tiền của nhân viên. */
export default function ManagerCashLedger() {
  const [preset, setPreset] = useState<CashPeriodPreset>('this-month')
  const [customFrom, setCustomFrom] = useState(() => toVietnamDateInput())
  const [customTo, setCustomTo] = useState(() => toVietnamDateInput())
  const [ledger, setLedger] = useState<CashLedgerDto | null>(null)
  const [pending, setPending] = useState<CashHandoverDto[]>([])
  const [periodHandovers, setPeriodHandovers] = useState<CashHandoverDto[]>([])
  const [stateFilter, setStateFilter] = useState<CashState | ''>('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState<Review | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const range = useMemo(
    () => (preset === 'custom' ? cashCustomRange(customFrom, customTo) : cashPeriod(preset)),
    [preset, customFrom, customTo],
  )

  const load = useCallback(async () => {
    if (!range) {
      setError('Chọn ngày bắt đầu trước hoặc bằng ngày kết thúc.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const [ledgerRes, pendingRes, periodRes] = await Promise.all([
        cashApi.ledger(range),
        cashApi.handovers(pendingRange(), 'Submitted'),
        cashApi.handovers(range),
      ])
      if (!ledgerRes.isSuccess || !ledgerRes.result) throw new Error(ledgerRes.message || 'Không tải được sổ quỹ.')
      setLedger(ledgerRes.result)
      setPending(pendingRes.isSuccess && Array.isArray(pendingRes.result) ? pendingRes.result : [])
      setPeriodHandovers(periodRes.isSuccess && Array.isArray(periodRes.result) ? periodRes.result : [])
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const exportCsv = async () => {
    if (!range) return
    setExporting(true)
    try {
      const file = await cashApi.exportCsv(range)
      const url = URL.createObjectURL(file.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      // Tên tệp đặt ở web: khác origin thì trình duyệt không cho đọc Content-Disposition.
      const day = (date: Date) => toVietnamDateInput(date)
      anchor.download = `so-quy-tien-mat_${day(range.from)}_${day(new Date(range.to.getTime() - 86_400_000))}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không xuất được sổ quỹ.'))
    } finally {
      setExporting(false)
    }
  }

  const openReview = async (handover: CashHandoverDto, mode: Review['mode']) => {
    setReview({ handover, mode })
    setReviewNote('')
    setReviewError('')
    if (mode !== 'view' || handover.payments) return
    try {
      const res = await cashApi.handover(handover.handoverId)
      if (res.isSuccess && res.result) setReview((current) => current && { ...current, handover: res.result! })
    } catch {
      // Vẫn hiện thông tin phiếu; danh sách khoản tải lại khi mở lần sau.
    }
  }

  const submitReview = async (event: FormEvent) => {
    event.preventDefault()
    if (!review || review.mode === 'view') return
    if (review.mode === 'reject' && !reviewNote.trim()) {
      setReviewError('Ghi lý do từ chối, ví dụ thiếu bao nhiêu tiền.')
      return
    }
    setReviewing(true)
    setReviewError('')
    try {
      const call = review.mode === 'confirm' ? cashApi.confirm : cashApi.reject
      const res = await call(review.handover.handoverId, reviewNote.trim())
      if (!res.isSuccess) {
        setReviewError(res.message || 'Không cập nhật được phiếu.')
        return
      }
      setReview(null)
      await load()
    } catch (requestError) {
      setReviewError(errorMessage(requestError, 'Không cập nhật được phiếu.'))
    } finally {
      setReviewing(false)
    }
  }

  const summary = ledger?.summary
  const payments = (ledger?.payments ?? []).filter((p) => !stateFilter || p.state === stateFilter)
  const holdingTotal = (ledger?.holdingNow ?? []).reduce((sum, row) => sum + row.holding + row.submitted, 0)

  return (
    <ManagerPageShell activeItem="cash-ledger">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon manager-resource-icon--green"><Banknote size={24} aria-hidden /></span>
            <div><h2>Sổ quỹ tiền mặt</h2><p>Tiền mặt thu tại cổng theo tuần, tháng: ai thu, ở cổng nào, đã nộp chưa.</p></div>
          </div>
          <div className="manager-header-actions">
            <select value={preset} onChange={(event) => setPreset(event.target.value as CashPeriodPreset)} aria-label="Kỳ tra cứu">
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {preset === 'custom' && (
              <>
                <input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Từ ngày" />
                <input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} aria-label="Đến ngày" />
              </>
            )}
            <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
              <RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới
            </button>
            <button type="button" className="btn btn-primary" onClick={exportCsv} disabled={exporting || !range}>
              <Download size={17} aria-hidden /> {exporting ? 'Đang xuất...' : 'Xuất Excel (CSV)'}
            </button>
          </div>
        </header>

        {range && <p className="cash-period-label">Kỳ: <strong>{formatCashRange(range)}</strong></p>}
        {error && <div className="manager-inline-error" role="alert">{error}</div>}

        <section className="manager-summary-grid manager-summary-grid--four">
          <article className="manager-summary-card manager-summary-card--money">
            <span>Tổng thu trong kỳ</span>
            <strong>{formatCurrency(summary?.total ?? 0)}</strong>
            <small>{summary?.count ?? 0} khoản tiền mặt</small>
          </article>
          <article className="manager-summary-card manager-summary-card--accent">
            <span>Quản lý đã nhận</span>
            <strong>{formatCurrency(summary?.confirmed ?? 0)}</strong>
            <small>Đã đối soát trong kỳ</small>
          </article>
          <article className="manager-summary-card manager-summary-card--orange">
            <span>Chờ quản lý nhận</span>
            <strong>{formatCurrency(summary?.submitted ?? 0)}</strong>
            <small>{pending.length} phiếu đang chờ (mọi kỳ)</small>
          </article>
          <article className="manager-summary-card manager-summary-card--red">
            <span>Nhân viên còn giữ</span>
            <strong>{formatCurrency(summary?.holding ?? 0)}</strong>
            <small>{summary?.unassigned ? `${formatCurrency(summary.unassigned)} không rõ người thu` : 'Chưa chốt nộp'}</small>
          </article>
        </section>

        <section className="card-panel manager-resource-panel">
          <h3 className="cash-section-title">Phiếu nộp chờ xác nhận</h3>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Nhân viên</th><th>Chốt lúc</th><th className="cash-amount-col">Số tiền</th><th>Thao tác</th></tr></thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Không có phiếu nào chờ nhận tiền.</div></td></tr>
                ) : pending.map((h) => (
                  <tr key={h.handoverId}>
                    <td><strong>{h.staffName || 'Nhân viên'}</strong>{h.note && <div><small className="manager-muted-value">{h.note}</small></div>}</td>
                    <td>{formatUtcToVietnamDateTime(h.submittedAt)}</td>
                    <td className="cash-amount-col"><strong>{formatCurrency(h.amount)}</strong><div><small>{h.paymentCount} khoản</small></div></td>
                    <td>
                      <div className="cash-row-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openReview(h, 'view')}><Eye size={15} aria-hidden /> Chi tiết</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openReview(h, 'confirm')}><Check size={15} aria-hidden /> Đã nhận đủ</button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openReview(h, 'reject')}><X size={15} aria-hidden /> Từ chối</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-panel manager-resource-panel">
          <h3 className="cash-section-title">Ai đang giữ tiền <small>(tính đến lúc này: {formatCurrency(holdingTotal)})</small></h3>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Nhân viên</th><th className="cash-amount-col">Chưa chốt</th><th className="cash-amount-col">Đã chốt, chờ nhận</th><th>Giữ từ</th></tr></thead>
              <tbody>
                {(ledger?.holdingNow ?? []).length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Không nhân viên nào đang giữ tiền mặt.</div></td></tr>
                ) : ledger!.holdingNow.map((row) => (
                  <tr key={row.staffId}>
                    <td><strong>{row.staffName}</strong><div><small>{row.count} khoản</small></div></td>
                    <td className="cash-amount-col"><strong>{formatCurrency(row.holding)}</strong></td>
                    <td className="cash-amount-col">{formatCurrency(row.submitted)}</td>
                    <td>{formatUtcToVietnamDateTime(row.since)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="cash-breakdown-grid">
          <section className="card-panel manager-resource-panel">
            <h3 className="cash-section-title">Theo nhân viên thu</h3>
            <table className="ui-table manager-resource-table cash-table">
              <tbody>
                {(ledger?.byStaff ?? []).length === 0 ? (
                  <tr><td><div className="manager-empty-state">Không có khoản thu trong kỳ.</div></td></tr>
                ) : ledger!.byStaff.map((row) => (
                  <tr key={row.staffId ?? 'none'}><td>{row.staffName}<div><small>{row.count} khoản</small></div></td><td className="cash-amount-col"><strong>{formatCurrency(row.amount)}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card-panel manager-resource-panel">
            <h3 className="cash-section-title">Theo cổng thu</h3>
            <table className="ui-table manager-resource-table cash-table">
              <tbody>
                {(ledger?.byGate ?? []).length === 0 ? (
                  <tr><td><div className="manager-empty-state">Không có khoản thu trong kỳ.</div></td></tr>
                ) : ledger!.byGate.map((row) => (
                  <tr key={row.gateId ?? 'none'}><td>{row.gateName}<div><small>{row.count} khoản</small></div></td><td className="cash-amount-col"><strong>{formatCurrency(row.amount)}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section className="card-panel manager-resource-panel">
          <h3 className="cash-section-title">Phiếu nộp trong kỳ</h3>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Nhân viên</th><th>Chốt lúc</th><th className="cash-amount-col">Số tiền</th><th>Trạng thái</th><th>Người xác nhận</th><th /></tr></thead>
              <tbody>
                {periodHandovers.length === 0 ? (
                  <tr><td colSpan={6}><div className="manager-empty-state">Chưa có phiếu nộp trong kỳ.</div></td></tr>
                ) : periodHandovers.map((h) => (
                  <tr key={h.handoverId}>
                    <td><strong>{h.staffName || 'Nhân viên'}</strong></td>
                    <td>{formatUtcToVietnamDateTime(h.submittedAt)}</td>
                    <td className="cash-amount-col"><strong>{formatCurrency(h.amount)}</strong><div><small>{h.paymentCount} khoản</small></div></td>
                    <td><span className={`manager-change-status ${handoverStatusClass(h.status)}`}><i />{HANDOVER_STATUS_LABELS[h.status] ?? h.status}</span></td>
                    <td>{h.reviewedByName || '—'}{h.reviewNote && <div><small className="manager-muted-value">{h.reviewNote}</small></div>}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => openReview(h, 'view')}><Eye size={15} aria-hidden /> Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-panel manager-resource-panel">
          <div className="cash-section-head">
            <h3 className="cash-section-title">Các khoản tiền mặt trong kỳ</h3>
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as CashState | '')} aria-label="Lọc trạng thái tiền">
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(CASH_STATE_LABELS) as CashState[]).map((s) => <option key={s} value={s}>{CASH_STATE_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table cash-table">
              <thead><tr><th>Thời gian thu</th><th>Biển số</th><th>Nhân viên</th><th>Cổng</th><th className="cash-amount-col">Số tiền</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {loading && !ledger ? (
                  <tr><td colSpan={6}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={6}><div className="manager-empty-state"><Banknote size={30} aria-hidden /><strong>Không có khoản tiền mặt</strong></div></td></tr>
                ) : payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{formatUtcToVietnamDateTime(p.paymentTime)}</td>
                    <td><strong>{p.licensePlate || '—'}</strong></td>
                    <td>{p.staffName}</td>
                    <td>{p.gateName || '—'}</td>
                    <td className="cash-amount-col"><strong>{formatCurrency(p.amount)}</strong></td>
                    <td><span className={`manager-change-status ${cashStateClass(p.state)}`}><i />{CASH_STATE_LABELS[p.state]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {review && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !reviewing && setReview(null)}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="cash-review-title">
            <div className="manager-modal-header">
              <div>
                <h3 id="cash-review-title" className="modal-title">
                  {review.mode === 'confirm' ? 'Xác nhận đã nhận đủ tiền' : review.mode === 'reject' ? 'Từ chối phiếu nộp' : 'Phiếu nộp tiền'}
                </h3>
                <p>
                  {review.handover.staffName || 'Nhân viên'} · {formatCurrency(review.handover.amount)} · {review.handover.paymentCount} khoản · chốt {formatUtcToVietnamDateTime(review.handover.submittedAt)}
                </p>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setReview(null)} disabled={reviewing}><X size={20} aria-hidden /></button>
            </div>
            {review.mode === 'view' ? (
              <div className="table-wrap manager-table-wrap">
                <table className="ui-table manager-resource-table cash-table">
                  <thead><tr><th>Thời gian thu</th><th>Biển số</th><th>Cổng</th><th className="cash-amount-col">Số tiền</th></tr></thead>
                  <tbody>
                    {!review.handover.payments ? (
                      <tr><td colSpan={4}><div className="manager-empty-state">Đang tải các khoản...</div></td></tr>
                    ) : review.handover.payments.length === 0 ? (
                      <tr><td colSpan={4}><div className="manager-empty-state">Phiếu bị từ chối: các khoản đã trả về nhân viên giữ.</div></td></tr>
                    ) : review.handover.payments.map((p) => (
                      <tr key={p.paymentId}>
                        <td>{formatUtcToVietnamDateTime(p.paymentTime)}</td>
                        <td>{p.licensePlate || '—'}</td>
                        <td>{p.gateName || '—'}</td>
                        <td className="cash-amount-col">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <form onSubmit={submitReview}>
                {reviewError && <div className="manager-inline-error" role="alert">{reviewError}</div>}
                <p className="cash-review-hint">
                  {review.mode === 'confirm'
                    ? `Chỉ xác nhận khi đã đếm đủ ${formatCurrency(review.handover.amount)}.`
                    : 'Các khoản trong phiếu trả về nhân viên giữ; nhân viên chốt lại sau khi bù đủ.'}
                </p>
                <div className="form-field">
                  <label htmlFor="cash-review-note">{review.mode === 'reject' ? 'Lý do từ chối *' : 'Ghi chú (tuỳ chọn)'}</label>
                  <textarea
                    id="cash-review-note"
                    autoFocus
                    maxLength={500}
                    rows={3}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder={review.mode === 'reject' ? 'Ví dụ: thiếu 20.000đ so với phiếu' : 'Ví dụ: đã nhận đủ, cất két'}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setReview(null)} disabled={reviewing}>Hủy</button>
                  <button type="submit" className={review.mode === 'confirm' ? 'btn btn-primary' : 'btn btn-primary cash-danger-btn'} disabled={reviewing}>
                    {reviewing ? 'Đang lưu...' : review.mode === 'confirm' ? 'Xác nhận đã nhận' : 'Từ chối phiếu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </ManagerPageShell>
  )
}
