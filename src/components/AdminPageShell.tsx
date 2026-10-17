import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import StaffLayout from './StaffLayout'
import ProtectedRoute from './ProtectedRoute'
import { ADMIN_NAV, navigateAdminNav } from '../config/adminNav'

interface AdminPageShellProps {
  activeItem: string
  children: ReactNode
}

export default function AdminPageShell({ activeItem, children }: AdminPageShellProps) {
  const navigate = useNavigate()
  const menuItems = ADMIN_NAV.map(({ id, label, icon }) => ({ id, label, icon }))

  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <StaffLayout
        items={menuItems}
        activeItem={activeItem}
        onSelectItem={(id) => navigateAdminNav(id, navigate)}
      >
        <div className="manager-page-canvas">{children}</div>
      </StaffLayout>
    </ProtectedRoute>
  )
}
