import {
  BarChart3,
  Car,
  Clock,
  CreditCard,
  DollarSign,
  DoorOpen,
  FileCheck,
  Layers,
  Package,
  CalendarRange,
  CalendarCheck2,
  ParkingSquare,
  AlertTriangle,
} from 'lucide-react'
import type { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  path: string
  icon: ReactNode
  desc?: string
}

export const MANAGER_NAV: NavItem[] = [
  {
    id: 'vehicles',
    label: 'Loại phương tiện',
    path: '/manager/vehicle-types',
    icon: <Car size={18} />,
    desc: 'Xe máy, ô tô, xe điện, SUV...',
  },
  {
    id: 'floors',
    label: 'Phân tầng theo loại xe',
    path: '/manager/floor-assignment',
    icon: <Layers size={18} />,
    desc: 'Gán tầng/khu cho từng loại xe',
  },
  {
    id: 'gates',
    label: 'Cổng ra vào',
    path: '/manager/gates',
    icon: <DoorOpen size={18} />,
    desc: 'Quản lý cổng ra vào bãi xe',
  },
  {
    id: 'subscriptions',
    label: 'Quản lý gói',
    path: '/manager/subscriptions',
    icon: <Package size={18} />,
    desc: 'Quản lý gói đăng ký tháng',
  },
  {
    id: 'sessions',
    label: 'Phiên ra vào',
    path: '/manager/sessions',
    icon: <Clock size={18} />,
    desc: 'Theo dõi phiên gửi xe',
  },
  {
    id: 'reservations',
    label: 'Quản lý đặt chỗ',
    path: '/manager/reservations',
    icon: <CalendarCheck2 size={18} />,
    desc: 'Theo dõi lịch hẹn và trạng thái đặt chỗ',
  },
  {
    id: 'incidents',
    label: 'Quản lý sự cố',
    path: '/manager/incidents',
    icon: <AlertTriangle size={18} />,
    desc: 'Phân công và theo dõi xử lý sự cố',
  },
  {
    id: 'monthly-subscriptions',
    label: 'Đăng ký gửi xe tháng',
    path: '/manager/monthly-subscriptions',
    icon: <CalendarRange size={18} />,
    desc: 'Quản lý các gói tháng khách hàng đã đăng ký',
  },
  {
    id: 'payments',
    label: 'Quản lý thanh toán',
    path: '/manager/payments',
    icon: <CreditCard size={18} />,
    desc: 'Tra cứu giao dịch và trạng thái thanh toán',
  },
  {
    id: 'vehicle-change-requests',
    label: 'Phê duyệt biển số',
    path: '/manager/vehicle-change-requests',
    icon: <FileCheck size={18} />,
    desc: 'Duyệt yêu cầu thay đổi biển số',
  },
  {
    id: 'slots',
    label: 'Slot đỗ xe',
    path: '/manager/slots',
    icon: <ParkingSquare size={18} />,
    desc: 'Trạng thái slot: trống, đang dùng, đặt trước...',
  },
  {
    id: 'pricing',
    label: 'Bảng giá đỗ xe',
    path: '/manager/pricing',
    icon: <DollarSign size={18} />,
    desc: 'Quy định tính phí gửi xe',
  },
  {
    id: 'reports',
    label: 'Báo cáo vận hành',
    path: '/manager/reports',
    icon: <BarChart3 size={18} />,
    desc: 'Lượt xe, doanh thu, lấp đầy, giờ cao điểm',
  },
]

export function navigateManagerNav(id: string, navigate: (path: string) => void) {
  const item = MANAGER_NAV.find((n) => n.id === id)
  if (item) navigate(item.path)
}
