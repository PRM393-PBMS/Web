import { ChevronDown, LogIn, LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const LOGO_SRC = '/image/logo.png'

function getInitials(name?: string, email?: string) {
  const label = name?.trim() || email?.trim() || 'U'
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase()
}

function getRoleLabel(role?: string) {
  switch (role) {
    case 'staff':
      return 'Nhân viên'
    case 'manager':
      return 'Quản lý bãi xe'
    case 'admin':
      return 'Quản trị viên'
    default:
      return 'Người dùng'
  }
}

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Web chỉ dành cho nhân viên, quản lý và quản trị; khách hàng dùng app di động.
  const brandDestination =
    user?.role === 'staff'
      ? '/staff/dashboard'
      : user?.role === 'manager'
        ? '/manager/dashboard'
        : user?.role === 'admin'
          ? '/admin/dashboard'
          : '/dang-nhap'
  const roleLabel = getRoleLabel(user?.role)

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleLogout = async () => {
    await logout()
    setMenuOpen(false)
    navigate('/dang-nhap')
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to={brandDestination} className="brand" aria-label="PBMS - về bảng điều khiển">
          <img src={LOGO_SRC} alt="" className="brand-logo" />
        </Link>

        <div className="header-actions">
          {isAuthenticated ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="user-avatar" aria-hidden>
                  {getInitials(user?.name, user?.email)}
                </span>
                <span className="user-menu-copy">
                  <strong>{user?.name}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
              </button>

              {menuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <span className="user-avatar user-avatar--lg" aria-hidden>
                      {getInitials(user?.name, user?.email)}
                    </span>
                    <div>
                      <strong>{user?.name}</strong>
                      <small>{user?.email}</small>
                    </div>
                  </div>

                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={16} strokeWidth={2} aria-hidden />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/dang-nhap" className="btn btn-outline btn-header">
                <LogIn size={18} strokeWidth={2} aria-hidden />
                Đăng nhập
              </Link>

            </>
          )}
        </div>
      </div>
    </header>
  )
}
