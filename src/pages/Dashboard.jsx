// src/pages/Dashboard.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import NutritionCalculator from './NutritionCalculator'
import ManageItems from './ManageItems'
import AdminConsole from './AdminConsole'
import ThaiRDICalculator from './ThaiRDICalculator'
import SavedRecipes from './SavedRecipes'
import CompareRecipes from './CompareRecipes'
import CostCalculator from './CostCalculator'
import StatisticsAnalysis from './StatisticsAnalysis'
import SensoryEvaluation from './SensoryEvaluation'
import VersionChecker from '../components/VersionChecker'
import { useAuth } from '../contexts/AuthContext'

// หน้า Home/Welcome
const HomePage = () => {
  const { user, roleData } = useAuth()
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้'

  return (
    <div className="home-page">
      <div className="home-welcome">
        <h1>👋 สวัสดี, {displayName}!</h1>
        <p>ยินดีต้อนรับสู่ระบบคำนวณคุณค่าทางโภชนาการ</p>
        {roleData && (
          <span 
            className="home-role-badge"
            style={{ backgroundColor: roleData.color }}
          >
            {roleData.icon} {roleData.name}
          </span>
        )}
      </div>
      <div className="home-quick-links">
        <h3>🚀 เริ่มต้นใช้งาน</h3>
        <p>เลือกเมนูจากแถบด้านซ้ายเพื่อเริ่มใช้งาน</p>
      </div>
    </div>
  )
}

// หน้า Access Denied
const AccessDenied = () => (
  <div className="center-full">
    <div className="access-denied">
      <div className="access-denied-icon">🚫</div>
      <h2>ไม่มีสิทธิ์เข้าถึง</h2>
      <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
      <p className="access-denied-hint">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง</p>
    </div>
  </div>
)

// หน้า 404
const NotFound = () => {
  const { role } = useAuth()
  return (
    <div className="center-full">
      <div className="not-found">
        <div className="not-found-icon">🔍</div>
        <h2>404</h2>
        <p>ไม่พบหน้านี้</p>
        <p className="not-found-role">บทบาท: {role}</p>
      </div>
    </div>
  )
}

// Component สำหรับ Protected Route
const ProtectedPage = ({ permission, children }) => {
  const { hasPermission } = useAuth()
  
  if (!hasPermission(permission)) {
    return <AccessDenied />
  }
  
  return children
}

const Dashboard = () => {
  return (
    <div className="layout">
      {/* ตรวจสอบเวอร์ชันใหม่ */}
      <VersionChecker />
      
      <Sidebar />

      <div className="layout-main">
        <Topbar />

        <div className="layout-content">
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="home" replace />} />
            
            {/* หน้าหลัก - ทุกคนเข้าได้ */}
            <Route path="home" element={<HomePage />} />

            {/* หน้าคำนวณโภชนาการ */}
            <Route
              path="nutrition"
              element={
                <ProtectedPage permission="nutrition">
                  <NutritionCalculator />
                </ProtectedPage>
              }
            />

            {/* หน้าฉลากโภชนาการ */}
            <Route
              path="thai-rdi"
              element={
                <ProtectedPage permission="thai-rdi">
                  <ThaiRDICalculator />
                </ProtectedPage>
              }
            />

            {/* หน้าสูตรอาหาร */}
            <Route
              path="recipes"
              element={
                <ProtectedPage permission="recipes">
                  <SavedRecipes />
                </ProtectedPage>
              }
            />

            {/* หน้าเปรียบเทียบสูตร */}
            <Route
              path="compare"
              element={
                <ProtectedPage permission="compare">
                  <CompareRecipes />
                </ProtectedPage>
              }
            />

            {/* หน้าคำนวณต้นทุน - ใช้ permission 'cost' */}
            <Route
              path="cost"
              element={
                <ProtectedPage permission="cost">
                  <CostCalculator />
                </ProtectedPage>
              }
            />

            {/* หน้าวิเคราะห์สถิติ - ใช้ permission 'statistics' */}
            <Route
              path="statistics"
              element={
                <ProtectedPage permission="statistics">
                  <StatisticsAnalysis />
                </ProtectedPage>
              }
            />

            {/* หน้าวิเคราะห์ทางประสาทสัมผัส - ใช้ permission 'sensory' */}
            <Route
              path="sensory"
              element={
                <ProtectedPage permission="sensory">
                  <SensoryEvaluation />
                </ProtectedPage>
              }
            />

            {/* หน้าจัดการวัตถุดิบ */}
            <Route
              path="manage-items"
              element={
                <ProtectedPage permission="manage-items">
                  <ManageItems />
                </ProtectedPage>
              }
            />

            {/* หน้า Admin Console */}
            <Route
              path="admin"
              element={
                <ProtectedPage permission="admin">
                  <AdminConsole />
                </ProtectedPage>
              }
            />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
