import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Gift, RefreshCw, Search, Wallet, X } from 'lucide-react'
import AdminPageShell from '../../components/AdminPageShell'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import { walletApi, type ApiResponse, type UserDto, type WalletAdjustmentResult } from '../../utils/apiServices'
import { formatCurrency } from '../../utils/pricing'

type Customer = UserDto & { walletId?: string | null }

const REASONS = [
  { value: 'PROMOTION', label: 'Khuyến mãi' },
  { value: 'COMPENSATION', label: 'Bồi thường sự cố' },
  { value: 'CORRECTION', label: 'Điều chỉnh sai sót' },
  { value: 'EXPIRED', label: 'Thu hồi khuyến mãi hết hạn' },
] as const

const EMPTY_FORM = { direction: 'add' as 'add' | 'revoke', amount: '', reasonType: 'PROMOTION', note: '', expiryDays: '' }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Cộng hoặc thu hồi tiền khuyến mãi (ngăn BONUS) trong ví khách. Ngăn tiền nạp không bị đụng tới;
 * mỗi lần điều chỉnh có lý do, ghi sổ và báo khách.
 */
export default function WalletAdjustments({ area = 'manager' }: { area?: 'manager' | 'admin' }) {
  const Shell = area === 'admin' ? AdminPageShell : ManagerPageShell
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [lastResult, setLastResult] = useState<(WalletAdjustmentResult & { customer: string }) | null>(null)

  const fetchCustomers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.get<ApiResponse<Customer[]>>('/User/all')
      if (!res.isSuccess) {
        setError(res.message || 'Không tải được danh sách khách hàng.')
        return
      }
      setCustomers((res.result ?? []).filter((user) => user.roleName?.toLowerCase() === 'customer'))
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không tải được danh sách khách hàng.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    queueMicrotask(() => void fetchCustomers())
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN')
    if (!normalized) return customers
    return customers.filter((user) =>
      [user.fullName, user.email, user.phoneNumber, user.userName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(normalized),
    )
  }, [customers, query])

  const openAdjust = (customer: Customer) => {
    setTarget(customer)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!target?.walletId) return
    const amount = Number(form.amount.replace(/[.,\s]/g, ''))
    if (!Number.isInteger(amount) || amount <= 0) {
      setFormError('Số tiền phải là số nguyên dương (VND).')
      return
    }
    if (form.note.trim().length < 5) {
      setFormError('Ghi chú tối thiểu 5 ký tự để khách và đối soát hiểu lý do.')
      return
    }
    const expiryDays = form.expiryDays.trim() ? Number(form.expiryDays) : undefined
    if (expiryDays !== undefined && (!Number.isInteger(expiryDays) || expiryDays < 1)) {
      setFormError('Số ngày hiệu lực phải là số nguyên lớn hơn 0.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const res = await walletApi.adjustBonus(target.walletId, {
        amount: form.direction === 'add' ? amount : -amount,
        reasonType: form.reasonType,
        note: form.note.trim(),
        ...(expiryDays ? { expiryDays } : {}),
      })
      if (!res.isSuccess || !res.result) {
        setFormError(res.message || 'Điều chỉnh ví thất bại.')
        return
      }
      setLastResult({ ...res.result, customer: target.fullName || target.email })
      setTarget(null)
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Điều chỉnh ví thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell activeItem="wallets">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><Wallet size={24} aria-hidden /></span>
            <div>
              <h2>Ví khuyến mãi</h2>
              <p>Cộng hoặc thu hồi tiền khuyến mãi trong ví khách. Tiền khách tự nạp không bị thay đổi.</p>
            </div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={fetchCustomers} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button>
          </div>
        </header>

        {lastResult && (
          <div className="manager-inline-success" role="status">
            Đã điều chỉnh {formatCurrency(Math.abs(lastResult.amount))} cho {lastResult.customer}. Số dư khuyến mãi mới {formatCurrency(lastResult.bonusBalance)}, tổng khả dụng {formatCurrency(lastResult.walletBalance)}.
          </div>
        )}

        <section className="card-panel manager-resource-panel">
          <div className="manager-resource-toolbar">
            <label className="manager-search-field" htmlFor="wallet-search">
              <Search size={18} aria-hidden />
              <input id="wallet-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, email, số điện thoại..." />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} aria-hidden /></button>}
            </label>
            <div className="manager-toolbar-meta"><span>{filtered.length}/{customers.length} khách hàng</span></div>
          </div>

          {error && <div className="manager-inline-error" role="alert">{error}</div>}

          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Ví</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && customers.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4}><div className="manager-empty-state"><Wallet size={30} aria-hidden /><strong>Không có khách hàng phù hợp</strong></div></td></tr>
                ) : filtered.map((user) => (
                  <tr key={user.userId}>
                    <td><strong>{user.fullName || user.userName}</strong></td>
                    <td><div>{user.email}</div><small className="manager-muted-value">{user.phoneNumber}</small></td>
                    <td>{user.walletId ? 'Đã mở ví' : <span className="manager-muted-value">Chưa mở ví</span>}</td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => openAdjust(user)} disabled={!user.walletId} title={user.walletId ? undefined : 'Khách cần mở ví trên app trước'}>
                        <Gift size={15} aria-hidden /> Điều chỉnh
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {target && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setTarget(null)}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
            <div className="manager-modal-header">
              <div><h3 id="wallet-modal-title" className="modal-title">Điều chỉnh ví khuyến mãi</h3><p>{target.fullName || target.userName}, {target.email}</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setTarget(null)} disabled={saving}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="wa-direction">Thao tác</label><select id="wa-direction" value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as 'add' | 'revoke' })}><option value="add">Cộng khuyến mãi</option><option value="revoke">Thu hồi khuyến mãi</option></select></div>
                <div className="form-field"><label htmlFor="wa-amount">Số tiền (VND) *</label><input id="wa-amount" inputMode="numeric" autoFocus value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" /></div>
                <div className="form-field"><label htmlFor="wa-reason">Lý do *</label><select id="wa-reason" value={form.reasonType} onChange={(event) => setForm({ ...form, reasonType: event.target.value })}>{REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></div>
                <div className="form-field"><label htmlFor="wa-expiry">Hiệu lực (ngày)</label><input id="wa-expiry" inputMode="numeric" value={form.expiryDays} onChange={(event) => setForm({ ...form, expiryDays: event.target.value })} placeholder="Giữ hạn hiện tại" /></div>
                <div className="form-field form-field--full"><label htmlFor="wa-note">Ghi chú gửi khách *</label><input id="wa-note" maxLength={255} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ví dụ: Bồi thường sự cố barie ngày 20/10" /><small className="field-hint">Thu hồi không được vượt số dư khuyến mãi hiện có.</small></div>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setTarget(null)} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Xác nhận điều chỉnh'}</button></div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  )
}
