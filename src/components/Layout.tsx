import { Outlet, useLocation } from 'react-router-dom'
import Footer from './Footer'
import Header from './Header'

export default function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/' || location.pathname === '/dat-cho'
  const isStaffOrAdmin =
    location.pathname.startsWith('/staff') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/manager')

  return (
    <div className="app-shell">
      <Header />
      <main
        className={
          isHome
            ? 'app-main app-main--home'
            : isStaffOrAdmin
              ? 'app-main app-main--workspace'
              : 'app-main'
        }
      >
        <Outlet />
      </main>
      {!isStaffOrAdmin && <Footer />}
    </div>
  )
}
