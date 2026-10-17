import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '../context/AuthContext'

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

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
