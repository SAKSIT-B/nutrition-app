// src/components/ProtectedRoute.jsx
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, requiredPermission, allowedRoles }) => {
  const { user, role, hasPermission, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-full">
        <div className="loader" />
        <p>กำลังตรวจสอบสิทธิ์การใช้งาน...</p>
      </div>
    )
  }

  // ไม่ได้ login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // เช็ค permission (แบบใหม่)
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="center-full">
        <div className="access-denied">
          <div className="access-denied-icon">🚫</div>
          <h2>ไม่มีสิทธิ์เข้าถึง</h2>
          <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
          <p className="access-denied-hint">
            ต้องการสิทธิ์: <code>{requiredPermission}</code>
          </p>
        </div>
      </div>
    )
  }

  // เช็ค role (แบบเดิม - backward compatible)
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="center-full">
        <div className="access-denied">
          <div className="access-denied-icon">🚫</div>
          <h2>ไม่มีสิทธิ์เข้าถึง</h2>
          <p>บทบาท <strong>{role}</strong> ไม่สามารถเข้าหน้านี้ได้</p>
        </div>
      </div>
    )
  }

  return children
}

export default ProtectedRoute
