import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const Sidebar = () => {
  const { role } = useAuth()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Nutrition App</h2>
        <p className="sidebar-subtitle">การคำนวณคุณค่าทางโภชนาการ</p>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard/nutrition"
          className={({ isActive }) =>
            'sidebar-link' + (isActive ? ' sidebar-link-active' : '')
          }
        >
          การคำนวณโภชนาการ
        </NavLink>

        {(role === 'admin' || role === 'mod') && (
          <NavLink
            to="/dashboard/manage-items"
            className={({ isActive }) =>
              'sidebar-link' + (isActive ? ' sidebar-link-active' : '')
            }
          >
            เพิ่ม/แก้ไขวัตถุดิบ & เมนู
          </NavLink>
        )}

        {role === 'admin' && (
          <NavLink
            to="/dashboard/admin"
            className={({ isActive }) =>
              'sidebar-link' + (isActive ? ' sidebar-link-active' : '')
            }
          >
            คอนโซลสำหรับ Admin
          </NavLink>
        )}
      </nav>
    </aside>
  )
}

export default Sidebar
