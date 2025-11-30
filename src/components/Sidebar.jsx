import React from 'react';
import { NavLink } from 'react-router-dom';
import logo1 from '../assets/logo1.png';
import logo2 from '../assets/logo2.png';
import logo3 from '../assets/logo3.png';

const Sidebar = () => {
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

      {/* ด้านล่างนี้ให้ใช้โค้ดเมนูเดิมของครูต่อจากนี้เลย */}
      <nav className="sidebar-nav">
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


