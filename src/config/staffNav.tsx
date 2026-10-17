import {
  AlertTriangle,
  CalendarCheck2,
  CarFront,
  Gauge,
  LogIn,
  LogOut,
} from 'lucide-react'
import type { ReactNode } from 'react'

export interface StaffNavItem {
  id: string
  label: string
  path: string
  icon: ReactNode
  desc: string
  state?: { activePanel: 'scan' | 'reservations' | 'active-vehicles' }
}

export const STAFF_NAV: StaffNavItem[] = [
  { id: 'dashboard', label: 'Tổng quan', path: '/staff/dashboard', icon: <Gauge size={18} />, desc: 'Tình hình vận hành trong ca' },
  { id: 'scan', label: 'Check-in tại cổng', path: '/staff/chon-cong/checkin?destination=scan', icon: <LogIn size={18} />, desc: 'Chọn tầng, cổng rồi cho xe vào bãi', state: { activePanel: 'scan' } },
  { id: 'reservations', label: 'Đơn đặt trước', path: '/staff/reservations', icon: <CalendarCheck2 size={18} />, desc: 'Tra cứu khách có lịch hẹn', state: { activePanel: 'reservations' } },
  { id: 'active-vehicles', label: 'Xe trong bãi', path: '/staff/active-vehicles', icon: <CarFront size={18} />, desc: 'Tra cứu phiên đang hoạt động', state: { activePanel: 'active-vehicles' } },
  { id: 'checkout', label: 'Checkout tại cổng', path: '/staff/chon-cong/checkout', icon: <LogOut size={18} />, desc: 'Chọn tầng, cổng rồi xác nhận xe ra' },
  { id: 'exception', label: 'Xử lý sự cố', path: '/staff/exception', icon: <AlertTriangle size={18} />, desc: 'Tiếp nhận và đóng sự cố' },
]

export function navigateStaffNav(
  id: string,
  navigate: (path: string, options?: { state?: StaffNavItem['state'] }) => void,
) {
  const item = STAFF_NAV.find((navItem) => navItem.id === id)
  if (!item) return

  if (id === 'reservations' || id === 'active-vehicles') {
    navigate(item.path)
    return
  }

  navigate(item.path, item.state ? { state: item.state } : undefined)
}
