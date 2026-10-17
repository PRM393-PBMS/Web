import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import AdminPageShell from '../../components/AdminPageShell'
import { ADMIN_NAV } from '../../config/adminNav'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <AdminPageShell activeItem="dashboard">
      <div className="manager-dashboard-home">
        <header className="manager-dashboard-header">
          <span><ShieldCheck size={27} aria-hidden /></span>
          <div>
            <p>TRUNG TÂM QUẢN TRỊ</p>
            <h1>Quản trị hệ thống</h1>
            <small>Quản lý tài khoản và các vai trò được phép sử dụng trong hệ thống.</small>
          </div>
        </header>
        <div className="manager-dashboard-grid">
          {ADMIN_NAV.filter((item) => item.id !== 'dashboard').map((item) => (
            <button
              key={item.id}
              type="button"
              className="manager-dashboard-card"
              onClick={() => navigate(item.path)}
            >
              <div className="menu-card-icon">{item.icon}</div>
              <h3>{item.label}</h3>
              <p>{item.desc}</p>
              <span className="manager-dashboard-card-link">
                Mở chức năng <ArrowRight size={15} aria-hidden />
              </span>
            </button>
          ))}
        </div>
      </div>
    </AdminPageShell>
  )
}
