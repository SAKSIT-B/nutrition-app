// src/components/SessionInfo.jsx
// Component แสดงข้อมูล Session ใน Topbar

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const SessionInfo = () => {
  const { user, formatTimeRemaining, timeRemaining, logout } = useAuth();

  if (!user || !timeRemaining) return null;

  // คำนวณเปอร์เซ็นต์เวลาที่เหลือ
  const totalTime = 5 * 60 * 60 * 1000; // 5 ชั่วโมง
  const percentRemaining = (timeRemaining / totalTime) * 100;
  
  // กำหนดสีตามเวลาที่เหลือ
  let statusColor = '#10b981'; // เขียว
  if (percentRemaining <= 25) {
    statusColor = '#ef4444'; // แดง
  } else if (percentRemaining <= 50) {
    statusColor = '#f59e0b'; // ส้ม
  }

  return (
    <div className="session-info-container">
      <div className="session-info-badge">
        <span className="session-icon">⏱️</span>
        <span className="session-time" style={{ color: statusColor }}>
          {formatTimeRemaining()}
        </span>
      </div>
      <div className="session-progress">
        <div 
          className="session-progress-bar"
          style={{ 
            width: `${percentRemaining}%`,
            backgroundColor: statusColor 
          }}
        />
      </div>
    </div>
  );
};

export default SessionInfo;
