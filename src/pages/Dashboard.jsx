// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
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
import ProfileSettings from './ProfileSettings'  // เพิ่ม import
import VersionChecker from '../components/VersionChecker'
import { useAuth } from '../contexts/AuthContext'
import ShelfLifeCalculator from './ShelfLifeCalculator'


// ===== HomeOverview Component =====
const HomeOverview = () => {
  const { user, role, roleData, hasPermission } = useAuth()
  const [stats, setStats] = useState({
    ingredients: 0,
    recipes: 0,
    users: 0,
    experiments: 0
  })
  const [recentActivities, setRecentActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const itemsSnap = await getDocs(collection(db, 'items'))
        const recipesSnap = await getDocs(collection(db, 'recipes'))
        
        let usersCount = 0
        if (hasPermission('admin')) {
          const usersSnap = await getDocs(collection(db, 'users'))
          usersCount = usersSnap.size
        }

        setStats({
          ingredients: itemsSnap.size,
          recipes: recipesSnap.size,
          users: usersCount,
          experiments: 0
        })

        const recentRecipesQuery = query(
          collection(db, 'recipes'),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
        const recentSnap = await getDocs(recentRecipesQuery)
        const activities = recentSnap.docs.map(doc => ({
          id: doc.id,
          type: 'recipe',
          name: doc.data().name || 'ไม่มีชื่อ',
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          icon: '📖'
        }))

        setRecentActivities(activities)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [hasPermission])

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000)
    if (seconds < 60) return 'เมื่อสักครู่'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} วันที่แล้ว`
    return date.toLocaleDateString('th-TH')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'สวัสดีตอนเช้า'
    if (hour < 17) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้'

  const quickLinks = [
    { path: '/dashboard/nutrition', label: 'คำนวณโภชนาการ', icon: '🧮', color: '#6366f1', permission: 'nutrition' },
    { path: '/dashboard/recipes', label: 'สูตรอาหาร', icon: '📖', color: '#10b981', permission: 'recipes' },
    { path: '/dashboard/thai-rdi', label: 'ฉลากโภชนาการ', icon: '🏷️', color: '#f59e0b', permission: 'thai-rdi' },
    { path: '/dashboard/sensory', label: 'วิเคราะห์ประสาทสัมผัส', icon: '🧪', color: '#ec4899', permission: 'sensory' },
  ].filter(link => hasPermission(link.permission))

  if (loading) {
    return (
      <div className="home-loading">
        <div className="loading-spinner"></div>
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="home-overview">
      {/* Welcome Section */}
      <div className="home-welcome">
        <div className="welcome-content">
          <h1 className="welcome-title">
            {getGreeting()}, {displayName}! 👋
          </h1>
          <p className="welcome-subtitle">
            ยินดีต้อนรับสู่ระบบคำนวณคุณค่าทางโภชนาการ
          </p>
        </div>
        {roleData && (
          <div 
            className="welcome-role-badge"
            style={{ backgroundColor: roleData.color }}
          >
            {roleData.icon} {roleData.name}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="home-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            📦
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.ingredients}</div>
            <div className="stat-label">วัตถุดิบ</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
            📖
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.recipes}</div>
            <div className="stat-label">สูตรอาหาร</div>
          </div>
        </div>

        {hasPermission('admin') && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
              👥
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">ผู้ใช้งาน</div>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #f472b6)' }}>
            🧪
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.experiments}</div>
            <div className="stat-label">การทดลอง</div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="home-section">
        <h2 className="section-title">🚀 เข้าถึงด่วน</h2>
        <div className="quick-links">
          {quickLinks.map(link => (
            <Link 
              key={link.path} 
              to={link.path} 
              className="quick-link-card"
              style={{ '--link-color': link.color }}
            >
              <span className="quick-link-icon">{link.icon}</span>
              <span className="quick-link-label">{link.label}</span>
              <span className="quick-link-arrow">→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      <div className="home-section">
        <h2 className="section-title">📋 สูตรอาหารล่าสุด</h2>
        {recentActivities.length > 0 ? (
          <div className="activity-list">
            {recentActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <span className="activity-icon">{activity.icon}</span>
                <div className="activity-content">
                  <span className="activity-name">{activity.name}</span>
                  <span className="activity-time">{timeAgo(activity.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-activities">
            <p>ยังไม่มีสูตรอาหาร</p>
            <Link to="/dashboard/nutrition" className="empty-link">
              เริ่มสร้างสูตรแรก →
            </Link>
          </div>
        )}
      </div>

      {/* Tips Section */}
      <div className="home-section">
        <h2 className="section-title">💡 เคล็ดลับ</h2>
        <div className="tips-grid">
          <div className="tip-card">
            <div className="tip-icon">🧮</div>
            <div className="tip-content">
              <h4>คำนวณโภชนาการ</h4>
              <p>เลือกวัตถุดิบและใส่ปริมาณเพื่อคำนวณคุณค่าทางโภชนาการ</p>
            </div>
          </div>
          <div className="tip-card">
            <div className="tip-icon">📊</div>
            <div className="tip-content">
              <h4>เปรียบเทียบสูตร</h4>
              <p>เปรียบเทียบสูตรอาหารหลายสูตรพร้อมกันได้</p>
            </div>
          </div>
          <div className="tip-card">
            <div className="tip-icon">🧪</div>
            <div className="tip-content">
              <h4>วิเคราะห์ประสาทสัมผัส</h4>
              <p>ใช้ ANOVA และ Duncan's test วิเคราะห์ผลทดสอบชิม</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Access Denied =====
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

// ===== 404 Not Found =====
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

// ===== Protected Route =====
const ProtectedPage = ({ permission, children }) => {
  const { hasPermission } = useAuth()
  
  if (!hasPermission(permission)) {
    return <AccessDenied />
  }
  
  return children
}

// ===== Main Dashboard =====
const Dashboard = () => {
  return (
    <div className="layout">
      <VersionChecker />
      <Sidebar />

      <div className="layout-main">
        <Topbar />

        <div className="layout-content">
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="home" replace />} />
            
            {/* หน้าหลัก - ทุกคนเข้าได้ */}
            <Route path="home" element={<HomeOverview />} />

            {/* ✅ หน้าตั้งค่าโปรไฟล์ - ทุกคนเข้าได้ */}
            <Route path="profile" element={<ProfileSettings />} />
            <Route path="settings" element={<ProfileSettings />} />

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

            {/* หน้าเก็บรักษา */}
<Route
  path="shelf-life"
  element={
    <ProtectedPage permission="nutrition">
      <ShelfLifeCalculator />
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

            {/* หน้าคำนวณต้นทุน */}
            <Route
              path="cost"
              element={
                <ProtectedPage permission="cost">
                  <CostCalculator />
                </ProtectedPage>
              }
            />

            {/* หน้าวิเคราะห์สถิติ */}
            <Route
              path="statistics"
              element={
                <ProtectedPage permission="statistics">
                  <StatisticsAnalysis />
                </ProtectedPage>
              }
            />

            {/* หน้าวิเคราะห์ทางประสาทสัมผัส */}
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

