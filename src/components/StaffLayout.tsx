import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SidebarItem {
  id: string
  label: string
  icon?: ReactNode
}

interface StaffLayoutProps {
  children: ReactNode
  items: SidebarItem[]
  activeItem: string
  onSelectItem: (id: string) => void
}

export default function StaffLayout({ children, items, activeItem, onSelectItem }: StaffLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="staff-layout">
      {/* Sidebar */}
      <aside className={`staff-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar-menu-item ${activeItem === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onSelectItem(item.id)
                    setSidebarOpen(false)
                  }}
                >
                  {item.icon && <span className="sidebar-menu-icon">{item.icon}</span>}
                  <span className="sidebar-menu-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="staff-main">
        <div className="staff-mobile-nav">
          <button type="button" className="sidebar-toggle-btn" onClick={() => setSidebarOpen(true)} aria-label="Mở menu chức năng"><Menu size={21} aria-hidden /></button>
          <strong>Chức năng hệ thống</strong>
        </div>
        {/* Content */}
        <main className="staff-content">
          {children}
        </main>
      </div>

      {/* Overlay khi sidebar mở */}
      {sidebarOpen && (
        <div
          className="staff-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
