// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { 
  onAuthStateChanged, 
  signOut,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection, 
  getDocs, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

// ===== CONFIG =====
const SESSION_TIMEOUT_HOURS = 5
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000
const SESSION_CHECK_INTERVAL = 60 * 1000

// Default roles (ใช้เมื่อยังไม่มีใน Firestore)
const DEFAULT_ROLES = {
  owner: {
    id: 'owner',
    name: 'Owner',
    color: '#f59e0b',
    icon: '👑',
    priority: 100,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'cost', 'statistics', 'sensory', 'shelf-life', 'manage-items', 'admin', 'manage-roles'],
    isSystem: true,
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    color: '#3b82f6',
    icon: '🛡️',
    priority: 80,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'cost', 'statistics', 'sensory', 'shelf-life', 'manage-items', 'admin'],
    isSystem: true,
  },
  mod: {
    id: 'mod',
    name: 'Moderator',
    color: '#8b5cf6',
    icon: '⭐',
    priority: 50,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'cost', 'statistics', 'sensory', 'shelf-life', 'manage-items'],
    isSystem: true,
  },
  user: {
    id: 'user',
    name: 'User',
    color: '#6b7280',
    icon: '👤',
    priority: 10,
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'cost', 'statistics', 'sensory', 'shelf-life'],
    isSystem: true,
  },
}

// รายการ permissions ทั้งหมดในระบบ
export const ALL_PERMISSIONS = [
  { id: 'nutrition', name: 'คำนวณโภชนาการ', icon: '🧮', description: 'เข้าถึงหน้าคำนวณคุณค่าทางโภชนาการ' },
  { id: 'thai-rdi', name: 'ฉลากโภชนาการ', icon: '🏷️', description: 'สร้างฉลากโภชนาการ Thai RDI' },
  { id: 'recipes', name: 'สูตรอาหาร', icon: '📖', description: 'ดูและจัดการสูตรอาหาร' },
  { id: 'compare', name: 'เปรียบเทียบสูตร', icon: '📊', description: 'เปรียบเทียบสูตรอาหาร' },
  { id: 'cost', name: 'คำนวณต้นทุน', icon: '💰', description: 'คำนวณต้นทุนสูตรอาหาร' },
  { id: 'statistics', name: 'วิเคราะห์สถิติ', icon: '📈', description: 'วิเคราะห์ข้อมูลทางสถิติ' },
  { id: 'sensory', name: 'ประเมินประสาทสัมผัส', icon: '👅', description: 'วิเคราะห์ทางประสาทสัมผัส' },
  { id: 'shelf-life', name: 'อายุการเก็บรักษา', icon: '⏱️', description: 'คำนวณอายุการเก็บรักษา' },
  { id: 'manage-items', name: 'จัดการวัตถุดิบ', icon: '🥗', description: 'เพิ่ม/แก้ไข/ลบวัตถุดิบและเมนู' },
  { id: 'admin', name: 'Admin Console', icon: '⚙️', description: 'จัดการผู้ใช้และระบบ' },
  { id: 'manage-roles', name: 'จัดการบทบาท', icon: '🎭', description: 'สร้าง/แก้ไข/ลบบทบาท' },
]

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('user')
  const [roleData, setRoleData] = useState(null)
  const [allRoles, setAllRoles] = useState(DEFAULT_ROLES)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Session states
  const [sessionExpiry, setSessionExpiry] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [logoutReason, setLogoutReason] = useState(null)
  
  // Refs
  const sessionCheckIntervalRef = useRef(null)
  const sessionListenerRef = useRef(null)
  const currentSessionIdRef = useRef(null)
  const isProcessingAuthRef = useRef(false)

  // ===== ตั้งค่า Session Persistence =====
  useEffect(() => {
    const setupPersistence = async () => {
      try {
        await setPersistence(auth, browserSessionPersistence)
      } catch (error) {
        console.error('Error setting persistence:', error)
      }
    }
    setupPersistence()
  }, [])

  // ===== Force Logout Function =====
  const forceLogout = useCallback(async (reason = 'unknown') => {
    console.log('Force logout triggered:', reason)
    
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current)
      sessionCheckIntervalRef.current = null
    }
    if (sessionListenerRef.current) {
      sessionListenerRef.current()
      sessionListenerRef.current = null
    }
    
    sessionStorage.removeItem('sessionId')
    sessionStorage.removeItem('sessionExpiry')
    sessionStorage.removeItem('loginTime')
    
    if (reason !== 'manual') {
      setLogoutReason(reason)
    }
    
    const currentUid = user?.uid
    
    setUser(null)
    setRole('guest')
    setRoleData(null)
    setPermissions([])
    setSessionExpiry(null)
    setTimeRemaining(null)
    currentSessionIdRef.current = null
    
    try {
      if (currentUid) {
        await updateDoc(doc(db, 'users', currentUid), {
          currentSessionId: null,
          lastLogout: serverTimestamp()
        })
      }
    } catch (error) {
      console.error('Error clearing session:', error)
    }
    
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }, [user])

  // ===== Check Session Timeout =====
  const checkSessionTimeout = useCallback(() => {
    const expiry = sessionStorage.getItem('sessionExpiry')
    
    if (expiry) {
      const expiryTime = parseInt(expiry, 10)
      const now = Date.now()
      const remaining = expiryTime - now
      
      if (remaining <= 0) {
        forceLogout('session_expired')
      } else {
        setTimeRemaining(remaining)
        setSessionExpiry(expiryTime)
      }
    }
  }, [forceLogout])

  // ===== Start Session Timer =====
  const startSessionTimer = useCallback(() => {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current)
    }
    
    let expiryTime = sessionStorage.getItem('sessionExpiry')
    
    if (!expiryTime) {
      expiryTime = Date.now() + SESSION_TIMEOUT_MS
      sessionStorage.setItem('sessionExpiry', expiryTime.toString())
      sessionStorage.setItem('loginTime', Date.now().toString())
    } else {
      expiryTime = parseInt(expiryTime, 10)
    }
    
    setSessionExpiry(expiryTime)
    setTimeRemaining(Math.max(0, expiryTime - Date.now()))
    
    sessionCheckIntervalRef.current = setInterval(() => {
      checkSessionTimeout()
    }, SESSION_CHECK_INTERVAL)
    
    checkSessionTimeout()
  }, [checkSessionTimeout])

  // ===== Listen for Session Changes (Single Device) =====
  const startSessionListener = useCallback((userId, mySessionId) => {
    if (sessionListenerRef.current) {
      sessionListenerRef.current()
      sessionListenerRef.current = null
    }
    
    if (!mySessionId) return
    
    sessionListenerRef.current = onSnapshot(
      doc(db, 'users', userId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data()
          const serverSessionId = data.currentSessionId
          
          if (serverSessionId && mySessionId && serverSessionId !== mySessionId) {
            console.log('Another device logged in:', serverSessionId, 'vs', mySessionId)
            forceLogout('another_device')
          }
        }
      },
      (error) => {
        console.error('Session listener error:', error)
      }
    )
  }, [forceLogout])

  // โหลด roles ทั้งหมดจาก Firestore
  const loadRoles = async () => {
    try {
      const rolesSnap = await getDocs(collection(db, 'roles'))
      if (!rolesSnap.empty) {
        const rolesData = {}
        rolesSnap.docs.forEach((docSnap) => {
          rolesData[docSnap.id] = { id: docSnap.id, ...docSnap.data() }
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
      if (isProcessingAuthRef.current) {
        return
      }
      isProcessingAuthRef.current = true
      
      try {
        const roles = await loadRoles()

        if (!firebaseUser) {
          setUser(null)
          setRole('guest')
          setRoleData(null)
          setPermissions([])
          setSessionExpiry(null)
          setTimeRemaining(null)
          
          if (sessionCheckIntervalRef.current) {
            clearInterval(sessionCheckIntervalRef.current)
            sessionCheckIntervalRef.current = null
          }
          if (sessionListenerRef.current) {
            sessionListenerRef.current()
            sessionListenerRef.current = null
          }
          
          setLoading(false)
          isProcessingAuthRef.current = false
          return
        }

        // รอให้ sessionStorage มีค่าก่อน (จาก Login.jsx)
        let storedSessionId = sessionStorage.getItem('sessionId')
        let attempts = 0
        while (!storedSessionId && attempts < 20) {
          await new Promise(resolve => setTimeout(resolve, 100))
          storedSessionId = sessionStorage.getItem('sessionId')
          attempts++
        }
        
        if (!storedSessionId) {
          console.log('No session ID found after waiting, logging out')
          await signOut(auth)
          setLoading(false)
          isProcessingAuthRef.current = false
          return
        }
        
        const storedExpiry = sessionStorage.getItem('sessionExpiry')
        if (storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10)
          if (Date.now() > expiryTime) {
            console.log('Session expired')
            setLogoutReason('session_expired')
            sessionStorage.removeItem('sessionId')
            sessionStorage.removeItem('sessionExpiry')
            sessionStorage.removeItem('loginTime')
            await signOut(auth)
            setLoading(false)
            isProcessingAuthRef.current = false
            return
          }
        }

        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(userRef)

        if (snap.exists()) {
          const userData = snap.data()
          
          if (userData.currentSessionId && userData.currentSessionId !== storedSessionId) {
            console.log('Session mismatch:', userData.currentSessionId, 'vs', storedSessionId)
            setLogoutReason('another_device')
            sessionStorage.removeItem('sessionId')
            sessionStorage.removeItem('sessionExpiry')
            sessionStorage.removeItem('loginTime')
            await signOut(auth)
            setLoading(false)
            isProcessingAuthRef.current = false
            return
          }
        }

        setUser(firebaseUser)
        currentSessionIdRef.current = storedSessionId

        let userRole = 'user'

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: 'user',
            currentSessionId: storedSessionId,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          })
          userRole = 'user'
        } else {
          userRole = snap.data().role || 'user'
        }

        setRole(userRole)

        const currentRoleData = roles[userRole] || DEFAULT_ROLES.user
        setRoleData(currentRoleData)
        setPermissions(currentRoleData?.permissions || [])
        
        startSessionTimer()
        startSessionListener(firebaseUser.uid, storedSessionId)
        
        setLogoutReason(null)

      } catch (err) {
        console.error('AuthContext error:', err)
        setRole('user')
        setRoleData(DEFAULT_ROLES.user)
        setPermissions(DEFAULT_ROLES.user.permissions)
      } finally {
        setLoading(false)
        isProcessingAuthRef.current = false
      }
    })

    return () => {
      unsub()
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current)
      }
      if (sessionListenerRef.current) {
        sessionListenerRef.current()
      }
    }
  }, [startSessionTimer, startSessionListener])

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

  const clearLogoutReason = () => {
    setLogoutReason(null)
  }

  const formatTimeRemaining = () => {
    if (!timeRemaining) return null
    
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours} ชม. ${minutes} นาที`
    }
    return `${minutes} นาที`
  }

  const logout = () => forceLogout('manual')

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
        sessionExpiry,
        timeRemaining,
        formatTimeRemaining,
        logoutReason,
        clearLogoutReason,
        SESSION_TIMEOUT_HOURS,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
