// Authentication Service
import { apiClient, API_ENDPOINTS, type ApiClient } from '../config/api'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  statusCode: number
  message: string
  isSuccess: boolean
  result?: {
    user: {
      userId: string
      userName: string
      email: string
      fullName: string
      phoneNumber: string
      roleName: string
    }
    accessToken: string
    refreshToken: string
  }
}

export interface RegisterRequest {
  userName: string
  fullName: string
  email: string
  phoneNumber: string
  password: string
  confirmPassword: string
}

export interface RegisterResponse {
  statusCode: number
  message: string
  isSuccess: boolean
  result?: {
    userId: string
    email: string
    userName: string
    fullName: string
    phoneNumber: string
  }
}

export interface VerifyRegisterOtpRequest {
  email: string
  otp: string
}

export interface RefreshTokenResponse {
  statusCode: number
  message: string
  isSuccess: boolean
  result?: {
    accessToken: string
    refreshToken?: string
  }
}

export class AuthService {
  constructor(private api: ApiClient = apiClient) {}

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await this.api.post<LoginResponse>(
        API_ENDPOINTS.AUTH_LOGIN,
        credentials,
      )

      if (response.isSuccess && response.result?.accessToken) {
        this.api.setToken(response.result.accessToken)
        sessionStorage.setItem('refresh_token', response.result.refreshToken)
        sessionStorage.setItem('user_email', response.result.user.email)
        sessionStorage.setItem('user_name', response.result.user.fullName)
        sessionStorage.setItem('user_role', response.result.user.roleName)
        sessionStorage.setItem('user_id', response.result.user.userId)
        sessionStorage.setItem('user_phone', response.result.user.phoneNumber ?? '')
        return response
      }

      // Handle success: false response
      return {
        statusCode: response.statusCode || 400,
        message: response.message || 'Login failed',
        isSuccess: false,
      }
    } catch (error) {
      console.error('Login error:', error)
      // Return error response instead of throwing
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      return {
        statusCode: 400,
        message: errorMessage,
        isSuccess: false,
      }
    }
  }

  async sendRegisterOtp(data: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response = await this.api.post<RegisterResponse>(
        API_ENDPOINTS.AUTH_SEND_REGISTER_OTP,
        data,
      )
      return response
    } catch (error) {
      console.error('Register error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Registration failed'
      return {
        statusCode: 400,
        message: errorMessage,
        isSuccess: false,
      }
    }
  }

  async verifyRegisterOtp(data: VerifyRegisterOtpRequest): Promise<RegisterResponse> {
    try {
      return await this.api.post<RegisterResponse>(
        API_ENDPOINTS.AUTH_VERIFY_REGISTER_OTP,
        data,
      )
    } catch (error) {
      console.error('Verify register OTP error:', error)
      const errorMessage = error instanceof Error ? error.message : 'OTP verification failed'
      return {
        statusCode: 400,
        message: errorMessage,
        isSuccess: false,
      }
    }
  }

  async logout() {
    const refreshTokenKey = sessionStorage.getItem('refresh_token')

    try {
      if (refreshTokenKey) {
        await this.api.post(API_ENDPOINTS.AUTH_LOGOUT, { refreshTokenKey })
      }
    } catch (error) {
      // A failed revoke request must not prevent the user from ending the
      // current browser session.
      console.error('Logout API error:', error)
    } finally {
      this.api.clearToken()
      sessionStorage.removeItem('refresh_token')
      sessionStorage.removeItem('user_email')
      sessionStorage.removeItem('user_name')
      sessionStorage.removeItem('user_role')
      sessionStorage.removeItem('user_id')
      sessionStorage.removeItem('user_phone')
    }
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const accessToken = await this.api.refreshAccessToken()
    return accessToken
      ? {
          statusCode: 200,
          message: 'Cấp token mới thành công',
          isSuccess: true,
          result: { accessToken },
        }
      : {
          statusCode: 401,
          message: 'Refresh token không hợp lệ hoặc đã hết hạn',
          isSuccess: false,
        }
  }

  // Get stored user info
  getStoredUser() {
    if (!sessionStorage.getItem('auth_token')) return null

    const email = sessionStorage.getItem('user_email')
    const name = sessionStorage.getItem('user_name')
    const role = sessionStorage.getItem('user_role')
    const userId = sessionStorage.getItem('user_id')
    const phone = sessionStorage.getItem('user_phone')

    if (!email) return null

    return {
      userId,
      email,
      name: name || email,
      role: (role?.toLowerCase() as import('../context/AuthContext').UserRole) || 'user',
      phone: phone || undefined,
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!sessionStorage.getItem('auth_token')
  }
}

export const authService = new AuthService()
