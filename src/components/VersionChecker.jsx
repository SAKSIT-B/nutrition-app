// src/components/VersionChecker.jsx
// ตรวจสอบเวอร์ชันใหม่และแจ้งเตือนให้รีเฟรช

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// เวอร์ชันปัจจุบัน - เปลี่ยนทุกครั้งที่ deploy
const APP_VERSION = '1.0.1';
const CHECK_INTERVAL = 5 * 60 * 1000; // ตรวจสอบทุก 5 นาที

// เปิด/ปิด Dev Mode (ปุ่มทดสอบ - แสดงเฉพาะ Owner)
const DEV_MODE = true; // เปิดไว้ได้เลย เพราะแสดงเฉพาะ Owner

const VersionChecker = () => {
  const { role } = useAuth();
  
  // Dev Mode แสดงเฉพาะ Owner เท่านั้น
  const showDevTools = DEV_MODE && role === 'owner';
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    try {
      // ดึง index.html ใหม่เพื่อเช็ค hash ของ JS/CSS files
      const response = await fetch(`/?_=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      const html = await response.text();
      
      // เช็ค version จาก meta tag หรือ script hash
      const currentScripts = Array.from(document.querySelectorAll('script[src]'))
        .map(s => s.src)
        .filter(s => s.includes('/assets/'))
        .sort()
        .join(',');
      
      // หา scripts ใน HTML ใหม่
      const scriptMatch = html.match(/src="([^"]*\/assets\/[^"]*\.js)"/g) || [];
      const newScripts = scriptMatch
        .map(s => s.match(/src="([^"]*)"/)?.[1])
        .filter(Boolean)
        .map(s => new URL(s, window.location.origin).href)
        .sort()
        .join(',');
      
      // ถ้า scripts ต่างกัน = มี version ใหม่
      if (currentScripts && newScripts && currentScripts !== newScripts) {
        console.log('🔄 พบเวอร์ชันใหม่!');
        console.log('Current:', currentScripts);
        console.log('New:', newScripts);
        if (!updateDismissed) {
          setShowUpdateBanner(true);
        }
      } else {
        console.log('✅ เวอร์ชันปัจจุบันเป็นล่าสุดแล้ว');
      }
    } catch (error) {
      console.log('Version check failed:', error);
    }
  }, [updateDismissed]);

  useEffect(() => {
    // เช็คครั้งแรกหลังจาก 30 วินาที
    const initialTimeout = setTimeout(checkForUpdates, 30 * 1000);
    
    // ตั้ง interval สำหรับเช็คทุก 5 นาที
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);

    // เช็คเมื่อ user กลับมาที่หน้าเว็บ
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    // เช็คเมื่อ online กลับมา
    const handleOnline = () => {
      checkForUpdates();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', checkForUpdates);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', checkForUpdates);
    };
  }, [checkForUpdates]);

  const handleRefresh = () => {
    // Clear cache และ reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
    window.location.reload(true);
  };

  const handleDismiss = () => {
    setShowUpdateBanner(false);
    setUpdateDismissed(true);
    // Reset หลังจาก 30 นาที
    setTimeout(() => setUpdateDismissed(false), 30 * 60 * 1000);
  };

  // ปุ่มทดสอบ (แสดงเฉพาะ DEV_MODE)
  const handleTestBanner = () => {
    setShowUpdateBanner(true);
  };

  return (
    <>
      {/* Dev Mode: ปุ่มทดสอบ (แสดงเฉพาะ Owner) */}
      {showDevTools && !showUpdateBanner && (
        <button
          onClick={handleTestBanner}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px 16px',
            background: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            zIndex: 9998,
            fontSize: '14px',
          }}
        >
          🧪 ทดสอบ Banner
        </button>
      )}

      {/* Banner แจ้งเตือน */}
      {showUpdateBanner && (
        <div className="version-update-banner">
          <div className="update-content">
            <span className="update-icon">🔄</span>
            <span className="update-text">
              มีเวอร์ชันใหม่พร้อมใช้งาน! รีเฟรชเพื่ออัพเดท
            </span>
          </div>
          <div className="update-actions">
            <button className="update-btn refresh" onClick={handleRefresh}>
              🔃 รีเฟรชเลย
            </button>
            <button className="update-btn dismiss" onClick={handleDismiss}>
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VersionChecker;
