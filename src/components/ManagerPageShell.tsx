import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import StaffLayout from './StaffLayout'
import ProtectedRoute from './ProtectedRoute'
import { MANAGER_NAV, navigateManagerNav } from '../config/managerNav'

interface ManagerPageShellProps {
  activeItem: string
  children: ReactNode
}

export default function ManagerPageShell({ activeItem, children }: ManagerPageShellProps) {
  const navigate = useNavigate()
  const menuItems = MANAGER_NAV.map(({ id, label, icon }) => ({ id, label, icon }))

  return (
    <ProtectedRoute allowedRoles={['manager']}>
      <StaffLayout
        items={menuItems}
        activeItem={activeItem}
        onSelectItem={(id) => navigateManagerNav(id, navigate)}
      >
        <div className="manager-page-canvas">{children}</div>
      </StaffLayout>
    </ProtectedRoute>
  )
}
