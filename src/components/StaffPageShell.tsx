import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import ProtectedRoute from './ProtectedRoute'
import StaffLayout from './StaffLayout'
import { navigateStaffNav, STAFF_NAV } from '../config/staffNav'

interface StaffPageShellProps {
  activeItem: string
  children: ReactNode
  onSelectItem?: (id: string) => void
}

export default function StaffPageShell({ activeItem, children, onSelectItem }: StaffPageShellProps) {
  const navigate = useNavigate()
  const menuItems = STAFF_NAV.map(({ id, label, icon }) => ({ id, label, icon }))

  return (
    <ProtectedRoute allowedRoles={['staff']}>
      <StaffLayout
        items={menuItems}
        activeItem={activeItem}
        onSelectItem={(id) => onSelectItem ? onSelectItem(id) : navigateStaffNav(id, navigate)}
      >
        <div className="staff-page-canvas">{children}</div>
      </StaffLayout>
    </ProtectedRoute>
  )
}
