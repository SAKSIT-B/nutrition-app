// src/components/SessionAlert.jsx
// Component แสดงข้อความแจ้งเตือนเมื่อถูก Logout

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const SessionAlert = () => {
  const { logoutReason, clearLogoutReason, user, timeRemaining, formatTimeRemaining, SESSION_TIMEOUT_HOURS } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState({ title: '', message: '', icon: '' });
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  // ===== แสดง Alert เมื่อถูก Logout =====
  useEffect(() => {
    if (logoutReason && !user) {
      let title = '';
      let message = '';
      let icon = '';

      switch (logoutReason) {
        case 'session_expired':
          title = '⏰ หมดเวลาใช้งาน';
          message = `Session หมดอายุแล้ว (เกิน ${SESSION_TIMEOUT_HOURS} ชั่วโมง) กรุณาเข้าสู่ระบบใหม่`;
          icon = '⏰';
          break;
        case 'another_device':
          title = '📱 มีการเข้าสู่ระบบจากอุปกรณ์อื่น';
          message = 'บัญชีของคุณถูกเข้าสู่ระบบจากอุปกรณ์อื่น คุณจึงถูกออกจากระบบโดยอัตโนมัติ';
          icon = '📱';
          break;
        case 'session_invalid':
          title = '🔒 Session ไม่ถูกต้อง';
          message = 'Session ของคุณไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่';
          icon = '🔒';
          break;
        case 'user_not_found':
          title = '❓ ไม่พบข้อมูลผู้ใช้';
          message = 'ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาเข้าสู่ระบบใหม่';
          icon = '❓';
          break;
        case 'manual':
          // ไม่แสดง alert สำหรับ logout ปกติ
          return;
        default:
          title = '🔐 ออกจากระบบแล้ว';
          message = 'คุณได้ออกจากระบบแล้ว กรุณาเข้าสู่ระบบใหม่';
          icon = '🔐';
      }

      setAlertMessage({ title, message, icon });
      setShowAlert(true);
    }
  }, [logoutReason, user, SESSION_TIMEOUT_HOURS]);

  // ===== แสดง Warning เมื่อใกล้หมดเวลา (เหลือ 15 นาที) =====
  useEffect(() => {
    if (user && timeRemaining) {
      const fifteenMinutes = 15 * 60 * 1000;
      if (timeRemaining <= fifteenMinutes && timeRemaining > 0) {
        setShowTimeWarning(true);
      } else {
        setShowTimeWarning(false);
      }
    } else {
      setShowTimeWarning(false);
    }
  }, [user, timeRemaining]);

  // ===== Handle Close Alert =====
  const handleCloseAlert = () => {
    setShowAlert(false);
    clearLogoutReason();
  };

  return (
    <>
      {/* ===== Logout Alert Modal ===== */}
      {showAlert && (
        <div className="session-alert-overlay">
          <div className="session-alert-modal">
            <div className="session-alert-icon">{alertMessage.icon}</div>
            <h2 className="session-alert-title">{alertMessage.title}</h2>
            <p className="session-alert-message">{alertMessage.message}</p>
            <button className="session-alert-btn" onClick={handleCloseAlert}>
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}

      {/* ===== Time Warning Banner ===== */}
      {showTimeWarning && (
        <div className="session-time-warning">
          <div className="time-warning-content">
            <span className="time-warning-icon">⚠️</span>
            <span className="time-warning-text">
              เหลือเวลาใช้งานอีก <strong>{formatTimeRemaining()}</strong> - ระบบจะออกจากระบบอัตโนมัติเมื่อหมดเวลา
            </span>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionAlert;
