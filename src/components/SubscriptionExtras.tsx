import { useEffect, useState, type FormEvent } from 'react'
import { CalendarPlus, FileSignature, ShieldCheck, ShieldX } from 'lucide-react'
import { apiClient } from '../config/api'
import type { ApiResponse, SubscriptionRenewalDto } from '../utils/apiServices'
import { formatUtcToVietnamDate, formatUtcToVietnamDateTime } from '../utils/dateTime'
import { formatCurrency } from '../utils/pricing'

interface Contract {
  contractId: string
  contractNumber: string
  status: string
  signerName: string | null
  signedAt: string | null
}

interface ContractCheck {
  valid: boolean
  contentIntact: boolean
  signatureIntact: boolean
  sealValid: boolean
}

interface Props {
  subscriptionId: string
  status: string
  /** Gọi sau khi gia hạn để trang tải lại hạn mới. */
  onRenewed: () => void
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * Phần mở rộng trong chi tiết vé tháng: lịch sử gia hạn, hợp đồng điện tử (kiểm tra niêm phong)
 * và gia hạn tại quầy khi khách trả tiền mặt cho quản lý.
 */
export default function SubscriptionExtras({ subscriptionId, status, onRenewed }: Props) {
  const [renewals, setRenewals] = useState<SubscriptionRenewalDto[] | null>(null)
  const [contract, setContract] = useState<Contract | null | undefined>(undefined)
  const [check, setCheck] = useState<ContractCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [months, setMonths] = useState('1')
  const [amount, setAmount] = useState('')
  const [renewing, setRenewing] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  const loadRenewals = async () => {
    try {
      const res = await apiClient.get<ApiResponse<SubscriptionRenewalDto[]>>(`/SubscriptionRenewal/${subscriptionId}/renewals`)
      setRenewals(res.isSuccess ? res.result ?? [] : [])
    } catch {
      setRenewals([])
    }
  }

  useEffect(() => {
    let stopped = false
    queueMicrotask(() => {
      void loadRenewals()
      apiClient
        .get<ApiResponse<Contract>>(`/contracts/subscription/${subscriptionId}`)
        .then((res) => !stopped && setContract(res.isSuccess ? res.result ?? null : null))
        .catch(() => !stopped && setContract(null))
    })
    return () => {
      stopped = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionId])

  const verify = async () => {
    if (!contract) return
    setChecking(true)
    try {
      const res = await apiClient.get<ApiResponse<ContractCheck>>(`/contracts/${contract.contractId}/verify`)
      setCheck(res.isSuccess ? res.result ?? null : null)
      if (!res.isSuccess) setMessage({ tone: 'error', text: res.message || 'Không kiểm tra được hợp đồng.' })
    } catch (requestError) {
      setMessage({ tone: 'error', text: errorMessage(requestError, 'Không kiểm tra được hợp đồng.') })
    } finally {
      setChecking(false)
    }
  }

  const renew = async (event: FormEvent) => {
    event.preventDefault()
    const monthCount = Number(months)
    const paid = Number(amount.replace(/[.,\s]/g, ''))
    if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 24) {
      setMessage({ tone: 'error', text: 'Số tháng gia hạn từ 1 đến 24.' })
      return
    }
    if (!Number.isFinite(paid) || paid <= 0) {
      setMessage({ tone: 'error', text: 'Nhập số tiền khách đã trả tại quầy.' })
      return
    }
    setRenewing(true)
    setMessage(null)
    try {
      const res = await apiClient.post<ApiResponse>('/SubscriptionRenewal/direct-renew', {
        subscriptionId,
        months: monthCount,
        amount: paid,
      })
      if (!res.isSuccess) {
        setMessage({ tone: 'error', text: res.message || 'Gia hạn thất bại.' })
        return
      }
      setMessage({ tone: 'ok', text: `Đã gia hạn ${monthCount} tháng, ghi nhận ${formatCurrency(paid)}.` })
      setAmount('')
      await loadRenewals()
      onRenewed()
    } catch (requestError) {
      setMessage({ tone: 'error', text: errorMessage(requestError, 'Gia hạn thất bại.') })
    } finally {
      setRenewing(false)
    }
  }

  const canRenew = ['active', 'expired'].includes(status.toLowerCase())

  return (
    <div className="subscription-extras">
      {message && (
        <div className={message.tone === 'ok' ? 'manager-inline-success' : 'manager-inline-error'} role={message.tone === 'ok' ? 'status' : 'alert'}>
          {message.text}
        </div>
      )}

      <section>
        <h4><FileSignature size={16} aria-hidden /> Hợp đồng điện tử</h4>
        {contract === undefined ? (
          <p className="muted">Đang tải...</p>
        ) : contract === null ? (
          <p className="muted">Vé này chưa có hợp đồng (gói ngắn hạn hoặc khách chưa ký).</p>
        ) : (
          <div className="subscription-extras-row">
            <span>
              <strong>{contract.contractNumber}</strong> · {contract.status}
              {contract.signedAt && <> · ký {formatUtcToVietnamDateTime(contract.signedAt)} bởi {contract.signerName}</>}
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={verify} disabled={checking}>
              {checking ? 'Đang kiểm tra...' : 'Kiểm tra niêm phong'}
            </button>
          </div>
        )}
        {check && (
          <p className={check.valid ? 'contract-check contract-check--ok' : 'contract-check contract-check--bad'}>
            {check.valid ? <ShieldCheck size={16} aria-hidden /> : <ShieldX size={16} aria-hidden />}
            {check.valid
              ? 'Nội dung, chữ ký và niêm phong còn nguyên vẹn.'
              : `Hợp đồng không còn nguyên vẹn: ${[
                  !check.contentIntact && 'nội dung bị sửa',
                  !check.signatureIntact && 'chữ ký bị sửa',
                  !check.sealValid && 'niêm phong không hợp lệ',
                ].filter(Boolean).join(', ')}.`}
          </p>
        )}
      </section>

      <section>
        <h4><CalendarPlus size={16} aria-hidden /> Lịch sử gia hạn</h4>
        {renewals === null ? (
          <p className="muted">Đang tải...</p>
        ) : renewals.length === 0 ? (
          <p className="muted">Chưa gia hạn lần nào.</p>
        ) : (
          <ul className="subscription-renewal-list">
            {renewals.map((item) => (
              <li key={item.renewalId}>
                {formatUtcToVietnamDate(item.oldEndDate)} → <strong>{formatUtcToVietnamDate(item.newEndDate)}</strong>
                <span>{formatCurrency(item.amount)}{item.renewalDate ? ` · ${formatUtcToVietnamDateTime(item.renewalDate)}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canRenew && (
        <form onSubmit={renew}>
          <h4>Gia hạn tại quầy</h4>
          <div className="form-grid-2">
            <div className="form-field"><label htmlFor="renew-months">Số tháng</label><input id="renew-months" inputMode="numeric" value={months} onChange={(event) => setMonths(event.target.value)} /></div>
            <div className="form-field"><label htmlFor="renew-amount">Số tiền đã thu (VND)</label><input id="renew-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="300000" /></div>
          </div>
          <small className="field-hint">Dùng khi khách trả tiền mặt tại quầy. Khách tự gia hạn trên app thì không cần thao tác ở đây.</small>
          <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={renewing}>{renewing ? 'Đang gia hạn...' : 'Xác nhận gia hạn'}</button></div>
        </form>
      )}
    </div>
  )
}
