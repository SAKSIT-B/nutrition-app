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
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'manage-items', 'admin', 'manage-roles'],
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    color: '#3b82f6',
    icon: '🛡️',
    priority: 80,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'manage-items', 'admin'],
    isSystem: true,
  },
  mod: {
    id: 'mod',
    name: 'Moderator',
    color: '#8b5cf6',
    icon: '⭐',
    priority: 50,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'manage-items'],
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

// รายการ permissions ทั้งหมดในระบบ
export const ALL_PERMISSIONS = [
  { id: 'nutrition', name: 'คำนวณโภชนาการ', icon: '🧮', description: 'เข้าถึงหน้าคำนวณคุณค่าทางโภชนาการ' },
  { id: 'thai-rdi', name: 'ฉลากโภชนาการ', icon: '🏷️', description: 'สร้างฉลากโภชนาการ Thai RDI' },
  { id: 'recipes', name: 'สูตรอาหาร', icon: '📖', description: 'ดูและจัดการสูตรอาหาร' },
  { id: 'compare', name: 'เปรียบเทียบสูตร', icon: '📊', description: 'เปรียบเทียบสูตรอาหาร' },
  { id: 'manage-items', name: 'จัดการวัตถุดิบ', icon: '🥗', description: 'เพิ่ม/แก้ไข/ลบวัตถุดิบและเมนู' },
  { id: 'admin', name: 'Admin Console', icon: '⚙️', description: 'จัดการผู้ใช้และระบบ' },
  { id: 'manage-roles', name: 'จัดการบทบาท', icon: '🎭', description: 'สร้าง/แก้ไข/ลบบทบาท' },
]

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('user')
  const [roleData, setRoleData] = useState(null) // ข้อมูล role เต็ม
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
        // โหลด roles ก่อน
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
          // สร้าง user ใหม่
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

        // หา role data และ permissions
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

  // ฟังก์ชันตรวจสอบ permission
  const hasPermission = (permissionId) => {
    return permissions.includes(permissionId)
  }

  // ฟังก์ชันตรวจสอบหลาย permissions (ต้องมีทั้งหมด)
  const hasAllPermissions = (permissionIds) => {
    return permissionIds.every((p) => permissions.includes(p))
  }

  // ฟังก์ชันตรวจสอบหลาย permissions (มีอย่างน้อยหนึ่ง)
  const hasAnyPermission = (permissionIds) => {
    return permissionIds.some((p) => permissions.includes(p))
  }

  // รีโหลด roles (เรียกหลังจากแก้ไข roles)
  const refreshRoles = async () => {
    const roles = await loadRoles()
    // อัพเดท permissions ของ user ปัจจุบัน
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
