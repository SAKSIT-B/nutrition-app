import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children, allowRoles }) => {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-full">
        <div className="loader" />
        <p>กำลังตรวจสอบสิทธิ์การใช้งาน...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowRoles && !allowRoles.includes(role)) {
    return <div className="center-full">คุณไม่มีสิทธิ์เข้าหน้านี้</div>
  }

  return children
}

export default ProtectedRoute
