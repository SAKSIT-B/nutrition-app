// src/pages/Dashboard.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import NutritionCalculator from './NutritionCalculator'
import ManageItems from './ManageItems'
import AdminConsole from './AdminConsole'
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
            {/* default → หน้าโภชนาการ */}
            <Route path="/" element={<Navigate to="nutrition" />} />

            {/* ทุก role ที่ล็อกอินเข้าได้ */}
            <Route path="nutrition" element={<NutritionCalculator />} />

            {/* owner / admin / mod เท่านั้น */}
            <Route
              path="manage-items"
              element={
                <ProtectedRoute
                  allowRoles={['owner', 'admin', 'mod']}
                  allowedRoles={['owner', 'admin', 'mod']}
                >
                  <ManageItems />
                </ProtectedRoute>
              }
            />

            {/* owner / admin เท่านั้น */}
            <Route
              path="admin"
              element={
                <ProtectedRoute
                  allowRoles={['owner', 'admin']}
                  allowedRoles={['owner', 'admin']}
                >
                  <AdminConsole />
                </ProtectedRoute>
              }
            />

            {/* route อื่น ๆ ที่ไม่ตรง */}
            <Route
              path="*"
              element={<div>ไม่พบหน้านี้ (role: {role || 'ไม่ทราบสิทธิ์'})</div>}
            />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
