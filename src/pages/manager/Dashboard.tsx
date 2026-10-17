import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Building2,
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
} from 'lucide-react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { MANAGER_NAV } from '../../config/managerNav'

const hubIcons: Record<string, React.ReactNode> = {
  vehicles: <Car size={32} />,
  floors: <Layers size={32} />,
  gates: <DoorOpen size={32} />,
  subscriptions: <Package size={32} />,
  'monthly-subscriptions': <CalendarRange size={32} />,
  sessions: <Clock size={32} />,
  reservations: <CalendarCheck2 size={32} />,
  incidents: <AlertTriangle size={32} />,
  payments: <CreditCard size={32} />,
  'vehicle-change-requests': <FileCheck size={32} />,
  slots: <ParkingSquare size={32} />,
  pricing: <DollarSign size={32} />,
  reports: <BarChart3 size={32} />,
}

export default function ManagerDashboard() {
  const navigate = useNavigate()

  return (
    <ProtectedRoute allowedRoles={['manager']}>
      <div className="manager-dashboard-home">
        <header className="manager-dashboard-header">
          <span><Building2 size={28} aria-hidden /></span>
          <div><p>TRUNG TÂM QUẢN LÝ</p><h1>Quản lý bãi gửi xe</h1><small>Cấu hình tài nguyên, theo dõi vận hành và xử lý công việc tại một nơi.</small></div>
        </header>
        <div className="manager-dashboard-grid">
          {MANAGER_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="manager-dashboard-card"
              onClick={() => navigate(item.path)}
            >
              <div className="menu-card-icon">{hubIcons[item.id]}</div>
              <h3>{item.label}</h3>
              <p>{item.desc}</p>
              <span className="manager-dashboard-card-link">Mở quản lý <ArrowRight size={15} aria-hidden /></span>
            </button>
          ))}
        </div>
      </div>
    </ProtectedRoute>
  )
}
