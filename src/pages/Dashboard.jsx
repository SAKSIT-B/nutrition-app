// src/pages/Dashboard.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import HomeOverview from './HomeOverview'
import NutritionCalculator from './NutritionCalculator'
import ManageItems from './ManageItems'
import AdminConsole from './AdminConsole'
import ThaiRDICalculator from './ThaiRDICalculator'
import SavedRecipes from './SavedRecipes'
import CompareRecipes from './CompareRecipes'
import StatisticsAnalysis from './StatisticsAnalysis'
import SensoryEvaluation from './SensoryEvaluation'
import ProfileSettings from './ProfileSettings'
import CostCalculator from './CostCalculator'
import VersionChecker from '../components/VersionChecker'
import AnnouncementBanner from '../components/AnnouncementBanner'
import { useAuth } from '../contexts/AuthContext'

// หน้า Access Denied
const AccessDenied = () => (
  <div className="center-full">
    <div className="access-denied">
      <div className="access-denied-icon">🚫</div>
      <h2>ไม่มีสิทธิ์เข้าถึง</h2>
      <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
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

const Dashboard = () => {
  const { hasPermission } = useAuth()

  return (
    <div className="layout">
      {/* แถบประกาศข้อความวิ่ง */}
      <AnnouncementBanner />
      
      {/* ตรวจสอบเวอร์ชันใหม่ */}
      <VersionChecker />
      
      <Sidebar />

      <div className="layout-main">
        <Topbar />

        <div className="layout-content">
          <Routes>
            {/* Default redirect ไปหน้า Home */}
            <Route path="/" element={<Navigate to="home" />} />

            {/* หน้าหลัก (Home Overview) */}
            <Route path="home" element={<HomeOverview />} />

            {/* หน้าตั้งค่าโปรไฟล์ */}
            <Route path="profile" element={<ProfileSettings />} />

            {/* หน้าคำนวณโภชนาการ */}
            <Route
              path="nutrition"
              element={
                hasPermission('nutrition') ? (
                  <NutritionCalculator />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้าฉลากโภชนาการ */}
            <Route
              path="thai-rdi"
              element={
                hasPermission('thai-rdi') ? (
                  <ThaiRDICalculator />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้าสูตรอาหาร */}
            <Route
              path="recipes"
              element={
                hasPermission('recipes') ? (
                  <SavedRecipes />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้าเปรียบเทียบสูตร */}
            <Route
              path="compare"
              element={
                hasPermission('compare') ? (
                  <CompareRecipes />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้าคำนวณต้นทุน */}
            <Route
              path="cost"
              element={
                hasPermission('nutrition') ? (
                  <CostCalculator />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้าจัดการวัตถุดิบ */}
            <Route
              path="manage-items"
              element={
                hasPermission('manage-items') ? (
                  <ManageItems />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* หน้า Admin Console */}
            <Route
              path="admin"
              element={
                hasPermission('admin') ? (
                  <AdminConsole />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* วิเคราะห์สถิติ */}
            <Route
              path="statistics"
              element={
                hasPermission('nutrition') ? (
                  <StatisticsAnalysis />
                ) : (
                  <AccessDenied />
                )
              }
            />

            {/* วิเคราะห์ทางประสาทสัมผัส */}
            <Route
              path="sensory"
              element={
                hasPermission('nutrition') ? (
                  <SensoryEvaluation />
                ) : (
                  <AccessDenied />
                )
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
