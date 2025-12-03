// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// Default roles (ใช้เมื่อยังไม่มีใน Firestore)
const DEFAULT_ROLES = {
  owner: {
    id: 'owner',
    name: 'Owner',
    color: '#f59e0b',
    icon: '👑',
    priority: 100,
    permissions: [
      'nutrition', 'thai-rdi', 'recipes', 'compare', 
      'cost', 'statistics', 'sensory',  // หน้าใหม่
      'manage-items', 'admin', 'manage-roles'
    ],
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    color: '#3b82f6',
    icon: '🛡️',
    priority: 80,
    permissions: [
      'nutrition', 'thai-rdi', 'recipes', 'compare', 
      'cost', 'statistics', 'sensory',  // หน้าใหม่
      'manage-items', 'admin', 'manage-roles'
    ],
    isSystem: true,
  },
  mod: {
    id: 'mod',
    name: 'Moderator',
    color: '#8b5cf6',
    icon: '⭐',
    priority: 50,
    permissions: [
      'nutrition', 'thai-rdi', 'recipes', 'compare', 
      'cost', 'statistics', 'sensory',  // หน้าใหม่
      'manage-items'
    ],
    isSystem: true,
  },
  user: {
    id: 'user',
    name: 'User',
    color: '#6b7280',
    icon: '👤',
    priority: 10,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare'],
    isSystem: true,
  },
}

// ============================================
// 📋 รายการ permissions ทั้งหมดในระบบ
// ============================================
// 👉 เมื่อต้องการเพิ่มหน้าใหม่ ให้เพิ่มที่นี่!
// 👉 แล้วมันจะแสดงใน checkbox "จัดการบทบาท" อัตโนมัติ
// ============================================
export const ALL_PERMISSIONS = [
  // ===== หน้าคำนวณ =====
  { 
    id: 'nutrition', 
    name: 'คำนวณโภชนาการ', 
    icon: '🧮', 
    description: 'เข้าถึงหน้าคำนวณคุณค่าทางโภชนาการ' 
  },
  { 
    id: 'thai-rdi', 
    name: 'ฉลากโภชนาการ', 
    icon: '🏷️', 
    description: 'สร้างฉลากโภชนาการ Thai RDI' 
  },
  { 
    id: 'cost', 
    name: 'คำนวณต้นทุน', 
    icon: '💰', 
    description: 'คำนวณต้นทุนวัตถุดิบและสูตรอาหาร' 
  },

  // ===== หน้าสูตรอาหาร =====
  { 
    id: 'recipes', 
    name: 'สูตรอาหาร', 
    icon: '📖', 
    description: 'ดูและจัดการสูตรอาหาร' 
  },
  { 
    id: 'compare', 
    name: 'เปรียบเทียบสูตร', 
    icon: '📊', 
    description: 'เปรียบเทียบสูตรอาหาร' 
  },

  // ===== หน้าวิเคราะห์ =====
  { 
    id: 'statistics', 
    name: 'วิเคราะห์สถิติ', 
    icon: '📈', 
    description: 'วิเคราะห์ข้อมูลทางสถิติ ANOVA, t-test' 
  },
  { 
    id: 'sensory', 
    name: 'วิเคราะห์ประสาทสัมผัส', 
    icon: '🧪', 
    description: 'วิเคราะห์ผลทดสอบทางประสาทสัมผัส' 
  },

  // ===== หน้าจัดการ =====
  { 
    id: 'manage-items', 
    name: 'จัดการวัตถุดิบ', 
    icon: '🥗', 
    description: 'เพิ่ม/แก้ไข/ลบวัตถุดิบและเมนู' 
  },

  // ===== หน้า Admin =====
  { 
    id: 'admin', 
    name: 'Admin Console', 
    icon: '⚙️', 
    description: 'จัดการผู้ใช้และระบบ' 
  },
  { 
    id: 'manage-roles', 
    name: 'จัดการบทบาท', 
    icon: '🎭', 
    description: 'สร้าง/แก้ไข/ลบบทบาท' 
  },

  // ============================================
  // 👇 เพิ่มหน้าใหม่ที่นี่! 👇
  // ============================================
  // ตัวอย่าง:
  // { 
  //   id: 'new-page',           // key ที่ใช้เช็คสิทธิ์ (ต้องไม่ซ้ำ)
  //   name: 'หน้าใหม่',          // ชื่อที่แสดงใน checkbox
  //   icon: '🆕',               // ไอคอน
  //   description: 'คำอธิบาย'   // คำอธิบาย
  // },
]

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('user')
  const [roleData, setRoleData] = useState(null)
  const [allRoles, setAllRoles] = useState(DEFAULT_ROLES)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)

  // โหลด roles ทั้งหมดจาก Firestore
  const loadRoles = async () => {
    try {
      const rolesSnap = await getDocs(collection(db, 'roles'))
      if (!rolesSnap.empty) {
        const rolesData = {}
        rolesSnap.docs.forEach((doc) => {
          rolesData[doc.id] = { id: doc.id, ...doc.data() }
        })
        setAllRoles(rolesData)
        return rolesData
      }
    } catch (err) {
      console.error('โหลด roles ล้มเหลว:', err)
    }
    return DEFAULT_ROLES
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        const roles = await loadRoles()

        if (!firebaseUser) {
          setUser(null)
          setRole('guest')
          setRoleData(null)
          setPermissions([])
          setLoading(false)
          return
        }

        setUser(firebaseUser)

        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(userRef)

        let userRole = 'user'

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: 'user',
            createdAt: serverTimestamp(),
          })
          userRole = 'user'
        } else {
          userRole = snap.data().role || 'user'
        }

        setRole(userRole)

        const currentRoleData = roles[userRole] || DEFAULT_ROLES.user
        setRoleData(currentRoleData)
        setPermissions(currentRoleData?.permissions || [])

      } catch (err) {
        console.error('AuthContext error:', err)
        setRole('user')
        setRoleData(DEFAULT_ROLES.user)
        setPermissions(DEFAULT_ROLES.user.permissions)
      } finally {
        setLoading(false)
      }
    })

    return () => unsub()
  }, [])

  const hasPermission = (permissionId) => {
    return permissions.includes(permissionId)
  }

  const hasAllPermissions = (permissionIds) => {
    return permissionIds.every((p) => permissions.includes(p))
  }

  const hasAnyPermission = (permissionIds) => {
    return permissionIds.some((p) => permissions.includes(p))
  }

  const refreshRoles = async () => {
    const roles = await loadRoles()
    const currentRoleData = roles[role] || DEFAULT_ROLES.user
    setRoleData(currentRoleData)
    setPermissions(currentRoleData?.permissions || [])
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        roleData,
        allRoles,
        permissions,
        loading,
        logout,
        hasPermission,
        hasAllPermissions,
        hasAnyPermission,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
