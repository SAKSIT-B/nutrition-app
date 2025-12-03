// src/components/AnnouncementBanner.jsx
// แถบประกาศข้อความวิ่งด้านบนเว็บ

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const AnnouncementBanner = () => {
  const { role } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // ตรวจสอบว่าเป็น Admin หรือ Owner หรือไม่
  const canEdit = role === 'owner' || role === 'admin';

  // ดึงข้อมูลประกาศจาก Firestore (realtime)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'announcement'),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setAnnouncement(data);
          setEditText(data.text || '');
          setIsEnabled(data.enabled !== false);
        } else {
          // ถ้ายังไม่มี ให้สร้างค่าเริ่มต้น
          setAnnouncement({
            text: 'ยินดีต้อนรับสู่ระบบคำนวณคุณค่าทางโภชนาการ 🎉',
            enabled: true,
            updatedAt: new Date()
          });
        }
      },
      (error) => {
        console.error('Error fetching announcement:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // บันทึกประกาศ
  const handleSave = async () => {
    if (!editText.trim()) {
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'announcement'), {
        text: editText.trim(),
        enabled: isEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: role
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving announcement:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  // Toggle เปิด/ปิดประกาศ
  const handleToggle = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'announcement'), {
        ...announcement,
        enabled: !isEnabled,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error toggling announcement:', error);
    } finally {
      setSaving(false);
    }
  };

  // ถ้าปิดประกาศ หรือไม่มีข้อความ หรือ user ซ่อนไว้
  if (!announcement || !isEnabled || !announcement.text || isHidden) {
    // แสดงปุ่มเปิดสำหรับ Admin/Owner
    if (canEdit && !isEnabled) {
      return (
        <div className="announcement-disabled">
          <button onClick={handleToggle} disabled={saving}>
            📢 เปิดแถบประกาศ
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <div 
        className={`announcement-banner ${isPaused ? 'paused' : ''}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* ปุ่มปิด (สำหรับ user) */}
        <button 
          className="announcement-close"
          onClick={() => setIsHidden(true)}
          title="ซ่อนประกาศ"
        >
          ✕
        </button>

        {/* ข้อความวิ่ง */}
        <div className="announcement-marquee">
          <div className="marquee-content">
            <span className="marquee-icon">📢</span>
            <span className="marquee-text">{announcement.text}</span>
            <span className="marquee-separator">•</span>
            <span className="marquee-icon">📢</span>
            <span className="marquee-text">{announcement.text}</span>
            <span className="marquee-separator">•</span>
            <span className="marquee-icon">📢</span>
            <span className="marquee-text">{announcement.text}</span>
            <span className="marquee-separator">•</span>
          </div>
        </div>

        {/* ปุ่มแก้ไข (สำหรับ Admin/Owner) */}
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
                  rows={3}
                  maxLength={200}
                />
                <span className="char-count">{editText.length}/200</span>
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

              {/* Preview */}
              <div className="form-group">
                <label>ตัวอย่าง</label>
                <div className="preview-marquee">
                  <div className="preview-content">
                    <span>📢</span>
                    <span>{editText || 'ข้อความประกาศ...'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setIsEditing(false)}
              >
                ยกเลิก
              </button>
              <button 
                className="btn-toggle"
                onClick={handleToggle}
                disabled={saving}
              >
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
  );
};

export default AnnouncementBanner;
