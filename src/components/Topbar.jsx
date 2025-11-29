import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const Topbar = () => {
  const { user, role, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const displayName = user?.displayName || user?.email || 'ผู้ใช้'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">แดชบอร์ด</h1>
      </div>
      <div className="topbar-right">
        <button className="topbar-btn" onClick={toggleTheme}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <div className="topbar-user">
          <span className="topbar-user-name">{displayName}</span>
          <span className="topbar-user-role">{role}</span>
        </div>
        <button className="topbar-btn" onClick={logout}>
          ออกจากระบบ
        </button>
      </div>
    </header>
  )
}

export default Topbar
