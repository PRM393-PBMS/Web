// API Configuration for Backend Connection
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://prm393backend.onrender.com/api'
/** Gốc máy chủ, cho các API không nằm dưới /api (ví dụ /parkings). */
export const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '')

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
}

// API Endpoints (chỉ các đường dẫn còn dùng; các API khác gọi qua utils/apiServices)
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_SEND_REGISTER_OTP: '/auth/send-register-otp',
  AUTH_VERIFY_REGISTER_OTP: '/auth/verify-register-otp',
  AUTH_REFRESH: '/auth/refresh-token',
  AUTH_LOGOUT: '/auth/logout',

  // User management (admin)
  USER_GET_ALL: '/User/all',
  USER_GET_ROLES: '/User/roles',
  USER_CREATE: '/User/create',
  USER_UPDATE: '/User/update',
  USER_DELETE: '/User',
  USER_STATUS: '/User',

  // Role management (admin)
  ROLES_GET_ALL: '/Role',
  ROLES_CREATE: '/Role',
  ROLES_UPDATE: '/Role',
  ROLES_DELETE: '/Role',
}

/** Thông báo cho người dùng thay cho lỗi kỹ thuật của trình duyệt ("Failed to fetch", "Unexpected end of JSON input"). */
export const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
export const BAD_RESPONSE_MESSAGE = 'Máy chủ trả dữ liệu không hợp lệ. Vui lòng thử lại sau.'

/** Lỗi khi gọi API mà không có lý do từ máy chủ (lỗi JS, dữ liệu sai dạng): không hiện lỗi kỹ thuật cho người dùng. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError && error.message ? error.message : fallback
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new ApiRequestError(response.status, BAD_RESPONSE_MESSAGE, error)
  }
}

async function send(url: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(url, options)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE, error)
  }
}

export class ApiRequestError extends Error {
  statusCode: number
  data: unknown
  response: { status: number; data: unknown }

  constructor(statusCode: number, message: string, data: unknown) {
    super(message)
    this.name = 'ApiRequestError'
    this.statusCode = statusCode
    this.data = data
    this.response = { status: statusCode, data }
  }
}

// API Client Class
export class ApiClient {
  private baseUrl: string
  private token: string | null = null
  private refreshPromise: Promise<string | null> | null = null
  private redirectingToLogin = false

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl
    this.loadToken()
  }

  // Authentication is tab-scoped so signing in from another tab does not
  // replace the identity used by requests in this tab.
  private loadToken() {
    this.token = sessionStorage.getItem('auth_token')
  }

  // Set token
  setToken(token: string) {
    this.token = token
    this.redirectingToLogin = false
    sessionStorage.setItem('auth_token', token)
  }

  // Clear token
  clearToken() {
    this.token = null
    sessionStorage.removeItem('auth_token')
  }

  private clearSessionTokens() {
    this.clearToken()
    sessionStorage.removeItem('refresh_token')
    sessionStorage.removeItem('user_email')
    sessionStorage.removeItem('user_name')
    sessionStorage.removeItem('user_role')
    sessionStorage.removeItem('user_id')
    sessionStorage.removeItem('user_phone')
  }

  private redirectToLogin() {
    if (this.redirectingToLogin) return
    this.redirectingToLogin = true
    this.clearSessionTokens()

    if (window.location.pathname !== '/dang-nhap') {
      window.location.replace('/dang-nhap')
    }
  }

  /**
   * Refresh outside request() so a failed refresh response cannot enter the
   * 401 interceptor recursively. Concurrent 401s share this same promise.
   */
  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise

    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
      return null
    }

    this.refreshPromise = (async () => {
      try {
        const response = await send(`${this.baseUrl}${API_ENDPOINTS.AUTH_REFRESH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ refreshTokenKey: refreshToken }),
        })

        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
          return null
        }

        const body = (await response.json()) as {
          isSuccess?: boolean
          result?: { accessToken?: string; refreshToken?: string }
        }
        const accessToken = body.isSuccess ? body.result?.accessToken : undefined
        if (!accessToken) return null

        this.setToken(accessToken)
        // Current backend keeps the old refresh token. Only rotate it if a
        // future backend response explicitly supplies a replacement.
        if (body.result?.refreshToken) {
          sessionStorage.setItem('refresh_token', body.result.refreshToken)
        }
        return accessToken
      } catch (error) {
        console.error('Token refresh failed:', error)
        return null
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  // Get headers with authorization
  private getHeaders(): Record<string, string> {
    const storedToken = sessionStorage.getItem('auth_token')
    if (storedToken !== this.token) this.token = storedToken

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    return headers
  }

  // Generic request method
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    data?: unknown,
    _isRetry = false,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const headers = this.getHeaders()
    if (data instanceof FormData) {
      delete headers['Content-Type']
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      if (data instanceof FormData) {
        options.body = data
      } else {
        options.body = JSON.stringify(data)
      }
    }

    try {
      const response = await send(url, options)

      // Only 401 means the access token needs refreshing. A 403 is an
      // authorization failure and must be returned to the caller unchanged.
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        if (!_isRetry) {
          const newAccessToken = await this.refreshAccessToken()
          if (newAccessToken) {
            return this.request<T>(method, endpoint, data, true)
          }
        }

        this.redirectToLogin()
        throw new ApiRequestError(401, 'Phiên đăng nhập đã hết hạn.', null)
      }

      // ── Handle all other non-OK responses ──
      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (response.status === 422 && contentType?.includes('application/json')) {
          return readJson<T>(response)
        }

        if (contentType?.includes('application/json')) {
          const errorBody = await readJson<{ message?: unknown }>(response)
          // Lỗi kiểm tra dữ liệu của NestJS trả `message` là mảng.
          const message =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : Array.isArray(errorBody?.message)
                ? errorBody.message.join('. ')
                : `HTTP ${response.status}`
          throw new ApiRequestError(response.status, message, errorBody)
        }

        const error = await response.text()
        throw new ApiRequestError(response.status, error || `HTTP ${response.status}`, error)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return readJson<T>(response)
      }

      return response.text() as unknown as T
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error)
      throw error
    }
  }

  // Convenience methods
  async openEventStream(endpoint: string, signal: AbortSignal): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      signal.throwIfAborted()
      const headers = this.getHeaders()
      delete headers['Content-Type']
      headers.Accept = 'text/event-stream'
      const response = await fetch(`${this.baseUrl}${endpoint}`, { headers, signal, cache: 'no-store' })
      if (response.status === 401) {
        await response.body?.cancel()
        if (attempt === 0 && await this.refreshAccessToken()) continue
        signal.throwIfAborted()
        this.redirectToLogin()
        throw new ApiRequestError(401, 'Phiên đăng nhập đã hết hạn.', null)
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new ApiRequestError(response.status, `Không kết nối được lượt quét (HTTP ${response.status}).`, null)
      }
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        await response.body?.cancel()
        throw new Error('Máy chủ chưa trả về luồng lượt quét hợp lệ.')
      }
      return response
    }
    throw new Error('Không mở được kết nối lượt quét.')
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint)
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, data)
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, data)
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint)
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, data)
  }

  async download(endpoint: string, _isRetry = false): Promise<{ blob: Blob; fileName: string }> {
    const response = await send(`${this.baseUrl}${endpoint}`, { method: 'GET', headers: this.getHeaders() })
    if (response.status === 401 && !_isRetry) {
      const token = await this.refreshAccessToken()
      if (token) return this.download(endpoint, true)
    }
    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      const body: unknown = contentType?.includes('application/json') ? await readJson<unknown>(response) : await response.text()
      const raw = (body as { message?: unknown } | null)?.message
      const message = typeof raw === 'string' ? raw : `HTTP ${response.status}`
      throw new ApiRequestError(response.status, message, body)
    }
    const disposition = response.headers.get('content-disposition') ?? ''
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
    const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    return {
      blob: await response.blob(),
      fileName: encodedName ? decodeURIComponent(encodedName) : plainName ?? 'report',
    }
  }
}

// Create a default API client instance
export const apiClient = new ApiClient()
export const rootApiClient = new ApiClient(API_ROOT_URL)
