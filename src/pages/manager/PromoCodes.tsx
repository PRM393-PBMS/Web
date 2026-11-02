import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, TicketPercent, X } from 'lucide-react'
import ManagerPageShell from '../../components/ManagerPageShell'
import { apiClient } from '../../config/api'
import type { ApiResponse } from '../../utils/apiServices'
import { formatUtcToVietnamDateTime } from '../../utils/dateTime'
import { formatCurrency } from '../../utils/pricing'

interface PromoCodeDto {
  promoCodeId: string
  code: string
  description?: string | null
  minTopUp: number
  bonusAmount: number
  bonusValidDays: number
  maxUses?: number | null
  usedCount: number
  startsAt: string
  endsAt: string
  isActive: boolean
}

const EMPTY_FORM = { code: '', description: '', minTopUp: '500000', bonusAmount: '50000', bonusValidDays: '30', maxUses: '', endsAt: '' }

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Trạng thái hiển thị: tắt, chưa chạy, hết hạn, hết lượt, đang chạy. */
function promoState(p: PromoCodeDto, now: number) {
  if (!p.isActive) return { label: 'Đã tắt', tone: 'rejected' }
  if (new Date(p.startsAt).getTime() > now) return { label: 'Chưa bắt đầu', tone: 'pending' }
  if (new Date(p.endsAt).getTime() < now) return { label: 'Hết hạn', tone: 'rejected' }
  if (p.maxUses != null && p.usedCount >= p.maxUses) return { label: 'Hết lượt', tone: 'rejected' }
  return { label: 'Đang chạy', tone: 'approved' }
}

export default function ManagerPromoCodes() {
  const [items, setItems] = useState<PromoCodeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<ApiResponse<PromoCodeDto[]>>('/PromoCode')
      setItems(res.isSuccess && Array.isArray(res.result) ? res.result : [])
      setNow(Date.now())
      if (!res.isSuccess) setError(res.message || 'Không tải được mã khuyến mãi.')
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không thể kết nối đến hệ thống.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void fetchItems())
  }, [fetchItems])

  const toggle = async (p: PromoCodeDto) => {
    try {
      const res = await apiClient.put<ApiResponse>(`/PromoCode/${p.promoCodeId}`, { isActive: !p.isActive })
      if (!res.isSuccess) setError(res.message || 'Không cập nhật được mã.')
      await fetchItems()
    } catch (requestError) {
      setError(errorMessage(requestError, 'Không cập nhật được mã.'))
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.endsAt) {
      setFormError('Chọn ngày kết thúc.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const res = await apiClient.post<ApiResponse>('/PromoCode', {
        code: form.code.trim(),
        description: form.description.trim(),
        minTopUp: Number(form.minTopUp),
        bonusAmount: Number(form.bonusAmount),
        bonusValidDays: Number(form.bonusValidDays),
        ...(form.maxUses.trim() ? { maxUses: Number(form.maxUses) } : {}),
        // Hết ngày kết thúc theo giờ Việt Nam.
        endsAt: new Date(`${form.endsAt}T23:59:59+07:00`).toISOString(),
      })
      if (!res.isSuccess) {
        setFormError(res.message || 'Tạo mã thất bại.')
        return
      }
      setCreating(false)
      setForm(EMPTY_FORM)
      await fetchItems()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Tạo mã thất bại.'))
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value }),
  })

  return (
    <ManagerPageShell activeItem="promo-codes">
      <div className="staff-content-wrapper manager-resource-page">
        <header className="manager-resource-header">
          <div className="manager-resource-title">
            <span className="manager-resource-icon"><TicketPercent size={24} aria-hidden /></span>
            <div><h2>Mã khuyến mãi nạp ví</h2><p>Khách nạp đủ mức được tặng tiền vào ngăn khuyến mãi. Mỗi khách dùng mỗi mã một lần.</p></div>
          </div>
          <div className="manager-header-actions">
            <button type="button" className="btn btn-outline" onClick={fetchItems} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} aria-hidden /> Làm mới</button>
            <button type="button" className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setFormError(''); setCreating(true) }}><Plus size={17} aria-hidden /> Tạo mã</button>
          </div>
        </header>

        <section className="card-panel manager-resource-panel">
          {error && <div className="manager-inline-error" role="alert">{error}</div>}
          <div className="table-wrap manager-table-wrap">
            <table className="ui-table manager-resource-table">
              <thead><tr><th>Mã</th><th>Ưu đãi</th><th>Đã dùng</th><th>Thời gian</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {loading && items.length === 0 ? (
                  <tr><td colSpan={6}><div className="manager-empty-state">Đang tải dữ liệu...</div></td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6}><div className="manager-empty-state"><TicketPercent size={30} aria-hidden /><strong>Chưa có mã khuyến mãi</strong><span>Bấm "Tạo mã" để tạo, ví dụ NAP500K: nạp 500.000 đ tặng 50.000 đ.</span></div></td></tr>
                ) : items.map((p) => {
                  const state = promoState(p, now)
                  return (
                    <tr key={p.promoCodeId}>
                      <td><strong>{p.code}</strong>{p.description && <div><small className="manager-muted-value">{p.description}</small></div>}</td>
                      <td>Nạp từ {formatCurrency(p.minTopUp)}<div><small className="manager-muted-value">Tặng {formatCurrency(p.bonusAmount)}, dùng trong {p.bonusValidDays} ngày</small></div></td>
                      <td>{p.usedCount}{p.maxUses != null ? `/${p.maxUses}` : ''}</td>
                      <td><small>{formatUtcToVietnamDateTime(p.startsAt)}<br />→ {formatUtcToVietnamDateTime(p.endsAt)}</small></td>
                      <td><span className={`manager-change-status status-${state.tone}`}><i />{state.label}</span></td>
                      <td><button type="button" className="btn btn-outline btn-sm" onClick={() => toggle(p)}>{p.isActive ? 'Tắt mã' : 'Bật lại'}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {creating && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && !saving && setCreating(false)}>
          <div className="modal-panel manager-form-modal" role="dialog" aria-modal="true" aria-labelledby="promo-modal-title">
            <div className="manager-modal-header">
              <div><h3 id="promo-modal-title" className="modal-title">Tạo mã khuyến mãi</h3><p>Tiền tặng cộng vào ngăn khuyến mãi khi tiền nạp về.</p></div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng" onClick={() => setCreating(false)} disabled={saving}><X size={20} aria-hidden /></button>
            </div>
            <form onSubmit={handleCreate}>
              {formError && <div className="manager-inline-error" role="alert">{formError}</div>}
              <div className="form-grid-2">
                <div className="form-field"><label htmlFor="pc-code">Mã *</label><input id="pc-code" autoFocus maxLength={30} {...field('code')} placeholder="NAP500K" /></div>
                <div className="form-field"><label htmlFor="pc-desc">Mô tả hiện cho khách</label><input id="pc-desc" maxLength={255} {...field('description')} placeholder="Nạp 500k tặng 50k" /></div>
                <div className="form-field"><label htmlFor="pc-min">Nạp tối thiểu (VND) *</label><input id="pc-min" inputMode="numeric" {...field('minTopUp')} /></div>
                <div className="form-field"><label htmlFor="pc-bonus">Tiền tặng (VND) *</label><input id="pc-bonus" inputMode="numeric" {...field('bonusAmount')} /></div>
                <div className="form-field"><label htmlFor="pc-days">Tiền tặng dùng trong (ngày) *</label><input id="pc-days" inputMode="numeric" {...field('bonusValidDays')} /></div>
                <div className="form-field"><label htmlFor="pc-max">Tổng số lượt</label><input id="pc-max" inputMode="numeric" {...field('maxUses')} placeholder="Không giới hạn" /></div>
                <div className="form-field form-field--full"><label htmlFor="pc-end">Ngày kết thúc *</label><input id="pc-end" type="date" {...field('endsAt')} /><small className="field-hint">Mã chạy từ lúc tạo tới hết ngày kết thúc (giờ Việt Nam).</small></div>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-ghost" onClick={() => setCreating(false)} disabled={saving}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo mã'}</button></div>
            </form>
          </div>
        </div>
      )}
    </ManagerPageShell>
  )
}
