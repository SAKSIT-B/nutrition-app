// src/pages/Dashboard.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import NutritionCalculator from './NutritionCalculator'
import ManageItems from './ManageItems'
import AdminConsole from './AdminConsole'
import ThaiRDICalculator from './ThaiRDICalculator'  // เพิ่มบรรทัดนี้
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../contexts/AuthContext'

const Dashboard = () => {
  const { role } = useAuth()

  return (
    <div className="layout">
      <Sidebar />

      <div className="layout-main">
        <Topbar />

        <div className="layout-content">
          <Routes>

            {/* default redirect */}
            <Route path="/" element={<Navigate to="nutrition" />} />

            {/* หน้าใช้งานทั่วไป */}
            <Route path="nutrition" element={<NutritionCalculator />} />

            {/* เพิ่ม route ใหม่ตรงนี้ */}
            <Route path="thai-rdi" element={<ThaiRDICalculator />} />

            {/* หน้าเพิ่ม/แก้ไขข้อมูล — owner/admin/mod เข้าถึงได้ */}
            <Route
              path="manage-items"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'mod']}>
                  <ManageItems />
                </ProtectedRoute>
              }
            />

            {/* หน้าแอดมิน — owner/admin เท่านั้น */}
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin']}>
                  <AdminConsole />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<div>ไม่พบหน้านี้ (role: {role})</div>} />

          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
