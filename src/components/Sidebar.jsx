// src/components/Sidebar.jsx
import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo1 from '../assets/logo1.png'
import logo2 from '../assets/logo2.png'
import logo3 from '../assets/logo3.png'

// รายการเมนูทั้งหมด
const MENU_ITEMS = [
  {
    path: '/dashboard/nutrition',
    label: 'การคำนวณโภชนาการ',
    icon: '🧮',
    permission: 'nutrition',
  },
  {
    path: '/dashboard/thai-rdi',
    label: 'ฉลากโภชนาการ (Thai RDI)',
    icon: '🏷️',
    permission: 'thai-rdi',
  },
  {
    path: '/dashboard/recipes',
    label: 'สูตรอาหาร',
    icon: '📖',
    permission: 'recipes',
  },
  {
    path: '/dashboard/compare',
    label: 'เปรียบเทียบสูตร',
    icon: '📊',
    permission: 'compare',
  },

{ 
  path: '/dashboard/statistics', 
  label: 'วิเคราะห์สถิติ', 
  icon: '📊',
  permission: 'nutrition'
},

{ 
  path: '/dashboard/sensory', 
  label: 'วิเคราะห์ทางประสาทสัมผัส', 
  icon: '🧪',
  permission: 'nutrition'
},
  
  {
    path: '/dashboard/manage-items',
    label: 'เพิ่ม/แก้ไขวัตถุดิบ & เมนู',
    icon: '🥗',
    permission: 'manage-items',
  },
  {
    path: '/dashboard/admin',
    label: 'คอนโซลสำหรับ Admin',
    icon: '⚙️',
    permission: 'admin',
  },
]

const Sidebar = () => {
  const { hasPermission, roleData } = useAuth()

  // กรองเมนูตาม permission
  const visibleMenus = MENU_ITEMS.filter((item) => hasPermission(item.permission))

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logos">
          <img src={logo1} alt="โลโก้ 1" />
          <img src={logo2} alt="โลโก้ 2" />
          <img src={logo3} alt="โลโก้ 3" />
        </div>
        <div className="sidebar-header">
          <h2>Nutrition App</h2>
          <p className="sidebar-subtitle">
            การคำนวณคุณค่าทางโภชนาการ
          </p>
        </div>
      </div>

      {/* แสดงบทบาทปัจจุบัน */}
      {roleData && (
        <div className="sidebar-role">
          <span
            className="sidebar-role-badge"
            style={{ backgroundColor: roleData.color }}
          >
            {roleData.icon} {roleData.name}
          </span>
        </div>
      )}

      <nav className="sidebar-nav">
        {visibleMenus.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              'sidebar-link' + (isActive ? ' sidebar-link-active' : '')
            }
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span className="sidebar-link-label">{item.label}</span>
          </NavLink>
        ))}

        {visibleMenus.length === 0 && (
          <div className="sidebar-empty">
            <p>ไม่มีเมนูที่เข้าถึงได้</p>
          </div>
        )}
      </nav>
    </aside>
  )
}

export default Sidebar


