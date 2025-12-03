// src/components/Topbar.jsx
import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

const Topbar = () => {
  const { user, role, roleData, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Announcement State
  const [announcement, setAnnouncement] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [isEnabled, setIsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isHiddenByUser, setIsHiddenByUser] = useState(false)

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้'
  const canEdit = role === 'owner' || role === 'admin'

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

  // ดึงข้อมูลประกาศจาก Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'announcement'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          setAnnouncement(data)
          setEditText(data.text || '')
          setIsEnabled(data.enabled !== false)
        } else {
          const defaultAnnouncement = {
            text: 'ยินดีต้อนรับสู่ระบบคำนวณคุณค่าทางโภชนาการ 🎉',
            enabled: true
          }
          setAnnouncement(defaultAnnouncement)
          setEditText(defaultAnnouncement.text)
          setIsEnabled(true)
        }
      },
      (error) => {
        console.error('Error fetching announcement:', error)
      }
    )
    return () => unsubscribe()
  }, [])

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
      '/dashboard/cost': 'คำนวณต้นทุน',
      '/dashboard/manage-items': 'จัดการวัตถุดิบ',
      '/dashboard/admin': 'Admin Console',
      '/dashboard/statistics': 'วิเคราะห์สถิติ',
      '/dashboard/sensory': 'วิเคราะห์ประสาทสัมผัส',
      '/dashboard/profile': 'ตั้งค่าโปรไฟล์',
    }
    return titles[path] || 'แดชบอร์ด'
  }

  // บันทึกประกาศ
  const handleSave = async () => {
    if (!editText.trim()) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'announcement'), {
        text: editText.trim(),
        enabled: isEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: role
      })
      setIsEditing(false)
      setIsHiddenByUser(false)
    } catch (error) {
      console.error('Error saving announcement:', error)
      alert('เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSaving(false)
    }
  }

  // Toggle เปิด/ปิดประกาศ
  const handleToggle = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'announcement'), {
        ...announcement,
        enabled: !isEnabled,
        updatedAt: serverTimestamp()
      })
      setIsHiddenByUser(false)
    } catch (error) {
      console.error('Error toggling announcement:', error)
    } finally {
      setSaving(false)
    }
  }

  // คำนวณความเร็ว animation ตามความยาวข้อความ
  const getAnimationDuration = () => {
    const textLength = announcement?.text?.length || 50
    // ข้อความยาว = ช้าลง เพื่อให้อ่านทัน
    const baseDuration = Math.max(15, textLength * 0.15)
    return `${baseDuration}s`
  }

  const showAnnouncement = announcement && isEnabled && announcement.text && !isHiddenByUser

  return (
    <>
      <header className="topbar">
        {/* ซ้าย - ชื่อหน้า */}
        <div className="topbar-left">
          <h1 className="topbar-title">{getPageTitle()}</h1>
        </div>

        {/* กลาง - Announcement */}
        <div className="topbar-center">
          {showAnnouncement ? (
            <div 
              className={`topbar-announcement ${isPaused ? 'paused' : ''}`}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* ปุ่มปิด */}
              <button 
                className="announcement-close-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsHiddenByUser(true)
                }}
                title="ซ่อนประกาศ"
              >
                ✕
              </button>

              {/* ข้อความวิ่ง */}
              <div className="announcement-track-wrapper">
                <div 
                  className="announcement-track"
                  style={{ animationDuration: getAnimationDuration() }}
                  onClick={() => canEdit && setIsEditing(true)}
                >
                  <span className="announcement-text">
                    📢 {announcement.text}
                  </span>
                  <span className="announcement-spacer"></span>
                  <span className="announcement-text">
                    📢 {announcement.text}
                  </span>
                  <span className="announcement-spacer"></span>
                </div>
              </div>

              {/* ปุ่มแก้ไข */}
              {canEdit && (
                <button 
                  className="announcement-edit-btn"
                  onClick={() => setIsEditing(true)}
                  title="แก้ไขประกาศ"
                >
                  ✏️
                </button>
              )}
            </div>
          ) : (
            <div className="topbar-announcement-placeholder">
              {canEdit && !isEnabled && (
                <button 
                  className="announcement-enable-btn"
                  onClick={handleToggle}
                  disabled={saving}
                >
                  📢 เปิดประกาศ
                </button>
              )}
              {canEdit && isEnabled && isHiddenByUser && (
                <button 
                  className="announcement-show-btn"
                  onClick={() => setIsHiddenByUser(false)}
                >
                  📢 แสดงประกาศ
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* ขวา - User controls */}
        <div className="topbar-right">
          <button className="topbar-icon-btn" onClick={toggleTheme} title="เปลี่ยนธีม">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

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

      {/* Modal แก้ไขประกาศ */}
      {isEditing && (
        <div className="announcement-modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="announcement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📢 แก้ไขข้อความประกาศ</h3>
              <button className="modal-close" onClick={() => setIsEditing(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>ข้อความประกาศ</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="พิมพ์ข้อความประกาศที่นี่..."
                  rows={4}
                  maxLength={300}
                />
                <span className="char-count">{editText.length}/300</span>
              </div>

              <div className="form-group toggle-group">
                <label>สถานะ</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">
                    {isEnabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}
                  </span>
                </label>
              </div>

              <div className="form-group">
                <label>ตัวอย่าง</label>
                <div className="preview-marquee">
                  <div className="preview-text">📢 {editText || 'ข้อความประกาศ...'}</div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setIsEditing(false)}>
                ยกเลิก
              </button>
              <button className="btn-toggle" onClick={handleToggle} disabled={saving}>
                {isEnabled ? '🔴 ปิดประกาศ' : '🟢 เปิดประกาศ'}
              </button>
              <button 
                className="btn-save" 
                onClick={handleSave}
                disabled={saving || !editText.trim()}
              >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Topbar
