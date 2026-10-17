export interface PaymentReturnContext {
  type?: string
  subscriptionId?: string
  successPath: string
  cancelPath: string
  successState?: Record<string, unknown>
  cancelState?: Record<string, unknown>
}

const SESSION_KEY = 'payment_return_context'
const ORDER_KEY_PREFIX = 'payment_return_context:'

function isSafeInternalPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
}

function parseContext(raw: string | null): PaymentReturnContext | null {
  if (!raw) return null

  try {
    const context = JSON.parse(raw) as Partial<PaymentReturnContext>
    if (!isSafeInternalPath(context.successPath) || !isSafeInternalPath(context.cancelPath)) {
      return null
    }
    return context as PaymentReturnContext
  } catch {
    return null
  }
}

export function savePaymentReturnContext(
  context: PaymentReturnContext,
  orderCode?: string,
) {
  const serialized = JSON.stringify(context)
  sessionStorage.setItem(SESSION_KEY, serialized)

  // PayOS có thể được mở trong tab mới. Lưu theo orderCode giúp callback ở tab đó
  // vẫn tìm đúng trang nguồn mà không bị lẫn với một giao dịch khác.
  if (orderCode) {
    localStorage.setItem(`${ORDER_KEY_PREFIX}${orderCode}`, serialized)
  }
}

export function readPaymentReturnContext(orderCode?: string) {
  if (orderCode) {
    const orderContext = parseContext(
      localStorage.getItem(`${ORDER_KEY_PREFIX}${orderCode}`),
    )
    if (orderContext) return orderContext
  }

  return parseContext(sessionStorage.getItem(SESSION_KEY))
}

export function clearPaymentReturnContext(orderCode?: string) {
  sessionStorage.removeItem(SESSION_KEY)
  if (orderCode) {
    localStorage.removeItem(`${ORDER_KEY_PREFIX}${orderCode}`)
  }
}
