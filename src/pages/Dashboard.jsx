// src/pages/Dashboard.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import NutritionCalculator from './NutritionCalculator'
import ManageItems from './ManageItems'
import AdminConsole from './AdminConsole'
import ThaiRDICalculator from './ThaiRDICalculator'
import SavedRecipes from './SavedRecipes'  // เพิ่มบรรทัดนี้
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
            <Route path="/" element={<Navigate to="nutrition" />} />
            <Route path="nutrition" element={<NutritionCalculator />} />
            <Route path="thai-rdi" element={<ThaiRDICalculator />} />
            
            {/* เพิ่ม route สูตรอาหาร */}
            <Route path="recipes" element={<SavedRecipes />} />

            <Route
              path="manage-items"
              element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'mod']}>
                  <ManageItems />
                </ProtectedRoute>
              }
            />
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
