import {
  CalendarDays,
  Car,
  ChevronDown,
  CreditCard,
  History,
  LogIn,
  LogOut,
  Settings,
  UserCircle,
  UserPlus,
  Package,
  CircleParking,
  TriangleAlert,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
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
    case 'customer':
      return 'Khách tháng'
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

  const isParkingUser = user?.role === 'user' || user?.role === 'customer'
  const isCustomer = user?.role === 'customer'
  const isBackOffice =
    user?.role === 'staff' || user?.role === 'manager' || user?.role === 'admin'
  const brandDestination =
    user?.role === 'staff'
      ? '/staff/dashboard'
      : user?.role === 'manager'
        ? '/manager/dashboard'
        : user?.role === 'admin'
          ? '/admin/dashboard'
          : '/'
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
    navigate('/')
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          to={brandDestination}
          className="brand"
          aria-label={isBackOffice ? 'EasyParking - về bảng điều khiển' : 'EasyParking - về trang chủ'}
        >
          <img src={LOGO_SRC} alt="" className="brand-logo" />
          {/* <span className="brand-name">
            <span className="brand-easy">Easy</span>
            <span className="brand-parking">Parking</span>
          </span> */}
        </Link>

        <nav
          className={`main-nav${isParkingUser ? ' main-nav--parking-user' : ''}`}
          aria-label={isAuthenticated ? 'Menu người dùng' : 'Menu chính'}
        >
          {isAuthenticated ? (
            <>
              {isParkingUser && (
                <>
                  <NavLink to="/dat-cho">
                    <Car size={16} strokeWidth={2} aria-hidden />
                    Đặt chỗ
                  </NavLink>
                  <NavLink to="/dang-ky-thang">
                    <CreditCard size={16} strokeWidth={2} aria-hidden />
                    Mua gói
                  </NavLink>
                  <NavLink to="/lich-su">
                    <CalendarDays size={16} strokeWidth={2} aria-hidden />
                    Lịch sử
                  </NavLink>
                  <NavLink to="/my-subscriptions">
                    <Package size={16} strokeWidth={2} aria-hidden />
                    Gói của tôi
                  </NavLink>
                  <NavLink to="/phien-gui-xe">
                    <CircleParking size={16} strokeWidth={2} aria-hidden />
                    Phiên gửi xe
                  </NavLink>
                  <NavLink to="/bao-cao-su-co">
                    <TriangleAlert size={16} strokeWidth={2} aria-hidden />
                    Báo sự cố
                  </NavLink>
                </>
              )}
            </>
          ) : (
            <>
              <NavLink to="/dat-cho">
                <Car size={16} strokeWidth={2} aria-hidden />
                Đặt chỗ ngay
              </NavLink>
              <a href="/#subscriptions">Đăng ký gói</a>
              <a href="#support">Hỗ trợ</a>
            </>
          )}
        </nav>

        <div className="header-actions">
          {isAuthenticated ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className={`user-menu-trigger${isCustomer ? ' user-menu-trigger--customer' : ''}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className={`user-avatar${isCustomer ? ' user-avatar--customer' : ''}`} aria-hidden>
                  {getInitials(user?.name, user?.email)}
                </span>
                <span className={`user-menu-copy${isCustomer ? ' user-menu-copy--customer' : ''}`}>
                  <strong className={isCustomer ? 'user-name--customer' : undefined}>{user?.name}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ChevronDown size={16} strokeWidth={2.2} aria-hidden />
              </button>

              {menuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown-head">
                    <span
                      className={`user-avatar user-avatar--lg${isCustomer ? ' user-avatar--customer' : ''}`}
                      aria-hidden
                    >
                      {getInitials(user?.name, user?.email)}
                    </span>
                    <div>
                      <strong className={isCustomer ? 'user-name--customer' : undefined}>{user?.name}</strong>
                      <small>{user?.email}</small>
                    </div>
                  </div>

                  {isParkingUser && (
                    <>
                      <Link to="/tai-khoan" role="menuitem" onClick={closeMenu}>
                        <Settings size={16} strokeWidth={2} aria-hidden />
                        Chỉnh sửa thông tin cá nhân
                      </Link>
                      <Link to="/lich-su" role="menuitem" onClick={closeMenu}>
                        <History size={16} strokeWidth={2} aria-hidden />
                        Lịch sử đặt chỗ
                      </Link>
                      <Link to="/phien-gui-xe" role="menuitem" onClick={closeMenu}>
                        <CircleParking size={16} strokeWidth={2} aria-hidden />
                        Phiên gửi xe
                      </Link>
                      <Link to="/bao-cao-su-co" role="menuitem" onClick={closeMenu}>
                        <TriangleAlert size={16} strokeWidth={2} aria-hidden />
                        Báo cáo sự cố
                      </Link>
                      <Link to="/dat-cho" role="menuitem" onClick={closeMenu}>
                        <Car size={16} strokeWidth={2} aria-hidden />
                        Đặt chỗ theo giờ
                      </Link>
                      {user?.role === 'user' && (
                        <Link to="/dang-ky-thang" role="menuitem" onClick={closeMenu}>
                          <CreditCard size={16} strokeWidth={2} aria-hidden />
                          Đăng ký gói tháng
                        </Link>
                      )}
                    </>
                  )}

                  {!isParkingUser && (
                    <Link to="/tai-khoan" role="menuitem" onClick={closeMenu}>
                      <UserCircle size={16} strokeWidth={2} aria-hidden />
                      Thông tin tài khoản
                    </Link>
                  )}

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

              <Link to="/dang-ky" className="btn btn-primary btn-header">
                <UserPlus size={18} strokeWidth={2} aria-hidden />
                Bắt đầu
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
