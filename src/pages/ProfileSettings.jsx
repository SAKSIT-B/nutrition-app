// src/pages/ProfileSettings.jsx
// หน้าตั้งค่าโปรไฟล์และเปลี่ยนรหัสผ่าน

import React, { useState, useEffect } from 'react';
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const ProfileSettings = () => {
  const { user, role, roleData } = useAuth();
  const { showToast } = useToast();

  // State สำหรับข้อมูลโปรไฟล์
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // State สำหรับเปลี่ยนรหัสผ่าน
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // State สำหรับข้อมูลเพิ่มเติม
  const [userInfo, setUserInfo] = useState(null);

  // โหลดข้อมูลผู้ใช้
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setEmail(user.email || '');

      // ดึงข้อมูลเพิ่มเติมจาก Firestore
      const fetchUserInfo = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserInfo(userDoc.data());
          }
        } catch (error) {
          console.error('Error fetching user info:', error);
        }
      };
      fetchUserInfo();
    }
  }, [user]);

  // บันทึกโปรไฟล์
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      showToast('กรุณากรอกชื่อที่แสดง', 'error');
      return;
    }

    setLoading(true);

    try {
      // อัพเดท Firebase Auth
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim()
      });

      // อัพเดท Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        updatedAt: new Date()
      });

      showToast('บันทึกข้อมูลเรียบร้อย', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // เปลี่ยนรหัสผ่าน
  const handleChangePassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentPassword) {
      showToast('กรุณากรอกรหัสผ่านปัจจุบัน', 'error');
      return;
    }

    if (!newPassword) {
      showToast('กรุณากรอกรหัสผ่านใหม่', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('รหัสผ่านใหม่ไม่ตรงกัน', 'error');
      return;
    }

    setPasswordLoading(true);

    try {
      // Re-authenticate ก่อน
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // เปลี่ยนรหัสผ่าน
      await updatePassword(auth.currentUser, newPassword);

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);

      showToast('เปลี่ยนรหัสผ่านเรียบร้อย', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      
      if (error.code === 'auth/wrong-password') {
        showToast('รหัสผ่านปัจจุบันไม่ถูกต้อง', 'error');
      } else if (error.code === 'auth/too-many-requests') {
        showToast('มีการพยายามมากเกินไป กรุณารอสักครู่', 'error');
      } else {
        showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  // Format วันที่
  const formatDate = (date) => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="profile-settings">
      <div className="profile-header">
        <h2 className="page-title">
          <span className="title-icon">👤</span>
          ตั้งค่าโปรไฟล์
        </h2>
        <p className="page-subtitle">จัดการข้อมูลส่วนตัวและรหัสผ่าน</p>
      </div>

      <div className="profile-content">
        {/* Profile Info Card */}
        <div className="profile-card">
          <div className="profile-avatar">
            <div className="avatar-circle">
              {displayName ? displayName.charAt(0).toUpperCase() : '👤'}
            </div>
            {roleData && (
              <span 
                className="avatar-role-badge"
                style={{ backgroundColor: roleData.color }}
              >
                {roleData.icon} {roleData.name}
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="profile-form">
            <div className="form-group">
              <label>ชื่อที่แสดง</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ชื่อของคุณ"
              />
            </div>

            <div className="form-group">
              <label>อีเมล</label>
              <input
                type="email"
                value={email}
                disabled
                className="disabled"
              />
              <p className="form-hint">ไม่สามารถเปลี่ยนอีเมลได้</p>
            </div>

            <div className="form-group">
              <label>บทบาท</label>
              <input
                type="text"
                value={roleData?.name || role}
                disabled
                className="disabled"
              />
            </div>

            <button 
              type="submit" 
              className="profile-btn primary"
              disabled={loading}
            >
              {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="profile-card">
          <h3 className="card-title">🔐 รหัสผ่าน</h3>

          {!showPasswordForm ? (
            <div className="password-info">
              <p>รหัสผ่านของคุณถูกเข้ารหัสอย่างปลอดภัย</p>
              <button 
                className="profile-btn secondary"
                onClick={() => setShowPasswordForm(true)}
              >
                🔄 เปลี่ยนรหัสผ่าน
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="password-form">
              <div className="form-group">
                <label>รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>

              <div className="form-group">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="password-actions">
                <button 
                  type="submit" 
                  className="profile-btn primary"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? '⏳ กำลังเปลี่ยน...' : '✓ เปลี่ยนรหัสผ่าน'}
                </button>
                <button 
                  type="button" 
                  className="profile-btn secondary"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Account Info Card */}
        <div className="profile-card">
          <h3 className="card-title">📋 ข้อมูลบัญชี</h3>
          
          <div className="account-info">
            <div className="info-row">
              <span className="info-label">User ID</span>
              <span className="info-value code">{user?.uid || '-'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">สร้างเมื่อ</span>
              <span className="info-value">{formatDate(userInfo?.createdAt)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">อัพเดทล่าสุด</span>
              <span className="info-value">{formatDate(userInfo?.updatedAt)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">เข้าสู่ระบบล่าสุด</span>
              <span className="info-value">
                {user?.metadata?.lastSignInTime 
                  ? new Date(user.metadata.lastSignInTime).toLocaleDateString('th-TH')
                  : '-'
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
