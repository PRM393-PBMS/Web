import { BarChart3, LayoutDashboard, Shield, Users, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: ReactNode
  desc?: string
}

export const ADMIN_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Tổng quan',
    path: '/admin/dashboard',
    icon: <LayoutDashboard size={18} />,
    desc: 'Truy cập nhanh các chức năng quản trị hệ thống',
  },
  {
    id: 'users',
    label: 'Quản lý tài khoản',
    path: '/admin/users',
    icon: <Users size={18} />,
    desc: 'Thêm, sửa, khóa tài khoản người dùng',
  },
  {
    id: 'roles',
    label: 'Quản lý vai trò',
    path: '/admin/roles',
    icon: <Shield size={18} />,
    desc: 'Tạo, sửa và xóa các vai trò có thể gán cho tài khoản',
  },
  {
    id: 'reports',
    label: 'Báo cáo',
    path: '/admin/reports',
    icon: <BarChart3 size={18} />,
    desc: 'Doanh thu và vận hành toàn hệ thống, xuất file',
  },
  {
    id: 'wallets',
    label: 'Ví khuyến mãi',
    path: '/admin/wallets',
    icon: <Wallet size={18} />,
    desc: 'Cộng hoặc thu hồi tiền khuyến mãi trong ví khách',
  },
]

export function navigateAdminNav(id: string, navigate: (path: string) => void) {
  const item = ADMIN_NAV.find((n) => n.id === id)
  if (item) navigate(item.path)
}
