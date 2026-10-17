import { AlertCircle, ArrowLeft, LogIn, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LOGO_SRC = '/image/logo.png'

export default function Login() {
  const { login, isAuthenticated, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) {
    if (user?.role === 'staff') return <Navigate to="/staff/dashboard" replace />
    if (user?.role === 'manager') return <Navigate to="/manager/dashboard" replace />
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    return <Navigate to={returnTo || '/dat-cho'} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const success = await login(email, password)
      if (success) {
        const lowerEmail = email.trim().toLowerCase()
        if (lowerEmail === 'staff' || lowerEmail === 'staff@easyparking.vn') {
          navigate('/staff/dashboard')
        } else if (lowerEmail === 'manager' || lowerEmail === 'manager@easyparking.vn') {
          navigate('/manager/dashboard')
        } else if (lowerEmail === 'admin' || lowerEmail === 'admin@easyparking.vn') {
          navigate('/admin/dashboard')
        } else {
          navigate(returnTo || '/dat-cho', { replace: true })
        }
      } else {
        setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi đăng nhập. Vui lòng thử lại.'
      setError(errorMsg)
      console.error('Login error:', err)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_SRC} alt="EasyParking" className="auth-logo" />
          <h1>Đăng nhập</h1>
          <p>Đăng nhập để đặt chỗ đỗ xe.</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-standalone"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu của bạn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-standalone"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="form-error form-error--row"><AlertCircle size={16} strokeWidth={2} aria-hidden />{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}><LogIn size={18} strokeWidth={2} aria-hidden />{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
       
        <p className="auth-switch">Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link></p>
        <p className="auth-footer-link"><Link to="/"><ArrowLeft size={16} strokeWidth={2} aria-hidden />Về trang chủ</Link></p>
      </div>
    </section>
  )
}
