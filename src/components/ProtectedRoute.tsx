import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'
import { roleHome } from '../utils/roleHome'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()


  if (!isAuthenticated) {
    return <Navigate to="/dang-nhap" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  // Sai khu: về trang chủ của vai trò (không về "/", vì "/" lại đưa sang đăng nhập rồi quay lại đây).
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />
  }

  return children
}
