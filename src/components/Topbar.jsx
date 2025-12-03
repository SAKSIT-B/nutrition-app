// src/components/Topbar.jsx
import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const Topbar = () => {
  const { user, role, roleData, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้'

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ปิด dropdown เมื่อเปลี่ยนหน้า
  useEffect(() => {
    setShowDropdown(false)
  }, [location])

  // หา Page Title จาก path
  const getPageTitle = () => {
    const path = location.pathname
    const titles = {
      '/dashboard': 'ภาพรวม',
      '/dashboard/home': 'ภาพรวม',
      '/dashboard/nutrition': 'คำนวณโภชนาการ',
      '/dashboard/thai-rdi': 'ฉลากโภชนาการ',
      '/dashboard/recipes': 'สูตรอาหาร',
      '/dashboard/compare': 'เปรียบเทียบสูตร',
      '/dashboard/manage-items': 'จัดการวัตถุดิบ',
      '/dashboard/admin': 'Admin Console',
      '/dashboard/statistics': 'วิเคราะห์สถิติ',
      '/dashboard/sensory': 'วิเคราะห์ประสาทสัมผัส',
      '/dashboard/profile': 'ตั้งค่าโปรไฟล์',
    }
    return titles[path] || 'แดชบอร์ด'
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{getPageTitle()}</h1>
      </div>
      
      <div className="topbar-right">
        {/* Theme Toggle */}
        <button className="topbar-icon-btn" onClick={toggleTheme} title="เปลี่ยนธีม">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        {/* User Dropdown */}
        <div className="topbar-user-dropdown" ref={dropdownRef}>
          <button 
            className="topbar-user-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="topbar-user-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{displayName}</span>
              <span className="topbar-user-role">{roleData?.name || role}</span>
            </div>
            <span className={`topbar-dropdown-arrow ${showDropdown ? 'open' : ''}`}>
              ▼
            </span>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="topbar-dropdown-menu">
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="dropdown-user-info">
                  <span className="dropdown-name">{displayName}</span>
                  <span className="dropdown-email">{user?.email}</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <Link to="/dashboard/home" className="dropdown-item">
                <span className="dropdown-icon">🏠</span>
                หน้าหลัก
              </Link>

              <Link to="/dashboard/profile" className="dropdown-item">
                <span className="dropdown-icon">👤</span>
                ตั้งค่าโปรไฟล์
              </Link>

              <div className="dropdown-divider"></div>

              <button className="dropdown-item logout" onClick={logout}>
                <span className="dropdown-icon">🚪</span>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Topbar
