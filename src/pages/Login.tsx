import { AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleHome } from '../utils/roleHome'

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

  // Chỉ quay lại trang cũ nếu trang đó thuộc khu của vai trò đang đăng nhập.
  const destinationFor = (role?: string) =>
    returnTo && role && returnTo.startsWith(`/${role}/`) ? returnTo : roleHome(role)

  if (isAuthenticated && user) {
    return <Navigate to={destinationFor(user.role)} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const result = await login(email, password)
    if (result.ok) {
      navigate(destinationFor(result.role), { replace: true })
    } else {
      setError(result.message)
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={LOGO_SRC} alt="EasyParking" className="auth-logo" />
          <h1>Đăng nhập</h1>
          <p>Đăng nhập nội bộ</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Nhập email"
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
                placeholder="Nhập mật khẩu"
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
       
        {/* <p className="auth-switch">Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link></p>
        <p className="auth-footer-link"><Link to="/"><ArrowLeft size={16} strokeWidth={2} aria-hidden />Về trang chủ</Link></p> */}
      </div>
    </section>
  )
}
