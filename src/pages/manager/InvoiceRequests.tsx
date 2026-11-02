import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, FileText, RefreshCw, X } from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import type { ApiResponse } from '../../utils/apiServices'
import { formatUtcToVietnamDateTime } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'

interface InvoiceRequestDto {
  id: string
  paymentId: string
  companyName: string
  taxCode: string
  address: string
  email: string
  status: string
  invoiceNo?: string | null
  createdAt: string
  issuedAt?: string | null
  amount?: number | null
  paymentTypeLabel?: string | null
  paymentTime?: string | null
  orderCode?: string | null
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Kế toán xuất hoá đơn GTGT trên phần mềm hoá đơn điện tử, rồi ghi số hoá đơn ở đây để báo khách. */
export default function ManagerInvoiceRequests() {
  const [items, setItems] = useState<InvoiceRequestDto[]>([])
  const [status, setStatus] = useState('Pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<InvoiceRequestDto | null>(null)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = status ? `?status=${status}` : ''
      const res = await apiClient.get<ApiResponse<InvoiceRequestDto[]>>(`/receipts/invoice-requests${query}`)
      setItems(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      if (!res.isSuccess) setError(res.message || 'Không tải được yêu cầu xuất hoá đơn.')
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    queueMicrotask(() => void fetchItems())
  }, [fetchItems])

  const handleIssue = async (event: FormEvent) => {
    event.preventDefault()
    if (!target || !invoiceNo.trim()) {
      setFormError('Nhập số hoá đơn đã xuất.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await apiClient.put<ApiResponse>(`/receipts/invoice-requests/${target.id}`, { invoiceNo: invoiceNo.trim() })
      if (!res.isSuccess) {
        setFormError(res.message || 'Không cập nhật được.')
        return
      }
      setTarget(null)
      await fetchItems()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Không cập nhật được.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ManagerPageShell activeItem="invoice-requests">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><FileText size={24} aria-hidden /></span>
            <div><h2>Yêu cầu xuất hoá đơn GTGT</h2><p>Xuất hoá đơn trên phần mềm hoá đơn điện tử của công ty, rồi ghi số hoá đơn để báo khách.</p></div>
          </div>
          <div className="manager-header-actions">
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái">
              <option value="Pending">Chờ xuất</option>
              <option value="Issued">Đã xuất</option>
              <option value="">Tất cả</option>
            </select>
            <button type="button" className="btn btn-outline" onClick={fetchItems} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button>
          </div>
        </header>

        <section className="card-panel manager-resource-panel">
          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Công ty</th><th>Thanh toán</th><th>Gửi lúc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={5}><div className="manager-empty-state"><FileText size={30} aria-hidden /><strong>Không có yêu cầu</strong></div></td></tr>
                ) : items.map((item) => {
                  const issued = item.status === 'Issued'
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.companyName}</strong><div><small>MST {item.taxCode}</small></div><div><small className="manager-muted-value">{item.address}</small></div><div><small className="manager-muted-value">{item.email}</small></div></td>
                      <td>{item.paymentTypeLabel || 'Thanh toán'}<div><strong>{item.amount != null ? formatCurrency(item.amount) : '—'}</strong></div><div><small className="manager-muted-value">Mã {item.orderCode || item.paymentId.slice(0, 8)}{item.paymentTime ? ` · ${formatUtcToVietnamDateTime(item.paymentTime)}` : ''}</small></div></td>
                      <td><small>{formatUtcToVietnamDateTime(item.createdAt)}</small></td>
                      <td><span className={`manager-change-status status-${issued ? 'approved' : 'pending'}`}><i />{issued ? `Đã xuất số ${item.invoiceNo}` : 'Chờ xuất'}</span></td>
                      <td>{!issued && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setTarget(item); setInvoiceNo(''); setFormError('') }}><Check size={15} aria-hidden /> Đã xuất</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {target && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setTarget(null)}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
            <div className="manager-modal-header">
              <div><h3 id="invoice-modal-title" className="modal-title">Ghi số hoá đơn đã xuất</h3><p>{target.companyName}, MST {target.taxCode}. Khách nhận thông báo kèm số hoá đơn.</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setTarget(null)} disabled={saving}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={handleIssue}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-field"><label htmlFor="inv-no">Số hoá đơn *</label><input id="inv-no" autoFocus maxLength={50} value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} placeholder="00001234" /></div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setTarget(null)} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận đã xuất'}</button></div>
            </form>
          </div>
        </div>
      )}
    </ManagerPageShell>
  )
}
