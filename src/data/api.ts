// API Configuration for Backend Connection
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5264/api'

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
}

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_SEND_REGISTER_OTP: '/auth/send-register-otp',
  AUTH_VERIFY_REGISTER_OTP: '/auth/verify-register-otp',
  AUTH_REFRESH: '/auth/refresh-token',
  AUTH_LOGOUT: '/auth/logout',

  // Users (profile — legacy paths)
  USERS_GET_PROFILE: '/users/profile',
  USERS_UPDATE_PROFILE: '/users/profile',
  USERS_LIST: '/users',

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

  // Floors
  FLOORS_GET_ALL: '/floors',
  FLOORS_GET_BY_ID: '/floors/:id',
  FLOORS_CREATE: '/floors',
  FLOORS_UPDATE: '/floors/:id',
  FLOORS_DELETE: '/floors/:id',

  // Parking Slots
  SLOTS_GET_ALL: '/parking-slots',
  SLOTS_GET_BY_FLOOR: '/parking-slots/floor/:floorId',
  SLOTS_UPDATE: '/parking-slots/:id',

  // Vehicle Types
  VEHICLE_TYPES_GET_ALL: '/vehicle-types',
  VEHICLE_TYPES_CREATE: '/vehicle-types',
  VEHICLE_TYPES_UPDATE: '/vehicle-types/:id',

  // Parking Sessions
  SESSIONS_CREATE: '/parking-sessions',
  SESSIONS_GET: '/parking-sessions/:id',
  SESSIONS_CHECKOUT: '/parking-sessions/:id/checkout',

  // Pricing
  PRICING_GET: '/pricing-policies',
  PRICING_UPDATE: '/pricing-policies/:id',
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
        const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.AUTH_REFRESH}`, {
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
      const response = await fetch(url, options)

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
          return (await response.json()) as T
        }

        if (contentType?.includes('application/json')) {
          const errorBody = await response.json()
          const message =
            typeof errorBody?.message === 'string'
              ? errorBody.message
              : `HTTP ${response.status}`
          throw new ApiRequestError(response.status, message, errorBody)
        }

        const error = await response.text()
        throw new ApiRequestError(response.status, error || `HTTP ${response.status}`, error)
      }

      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T
      }

      return response.text() as unknown as T
    } catch (error) {
      console.error(`API Error [${method} ${endpoint}]:`, error)
      throw error
    }
  }

  // Convenience methods
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
    const response = await fetch(`${this.baseUrl}${endpoint}`, { method: 'GET', headers: this.getHeaders() })
    if (response.status === 401 && !_isRetry) {
      const token = await this.refreshAccessToken()
      if (token) return this.download(endpoint, true)
    }
    if (!response.ok) {
      const contentType = response.headers.get('content-type')
      const body = contentType?.includes('application/json') ? await response.json() : await response.text()
      const message = typeof body?.message === 'string' ? body.message : `HTTP ${response.status}`
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
