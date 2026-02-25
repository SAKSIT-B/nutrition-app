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

const SESSION_TIMEOUT_HOURS = 5
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000
const SESSION_CHECK_INTERVAL = 60 * 1000

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
  
  const [sessionExpiry, setSessionExpiry] = useState(null)
  const [timeRemaining, setTimeRemaining] = useState(null)
  const [logoutReason, setLogoutReason] = useState(null)
  
  const sessionCheckIntervalRef = useRef(null)
  const sessionListenerRef = useRef(null)
  const currentSessionIdRef = useRef(null)

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
      console.log('onAuthStateChanged:', firebaseUser?.email || 'no user')
      
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
          return
        }

        // ✅ รอให้ sessionStorage มีค่า (Login.jsx จะ set หลัง Firestore)
        let storedSessionId = sessionStorage.getItem('sessionId')
        let attempts = 0
        const maxAttempts = 30 // รอสูงสุด 3 วินาที
        
        while (!storedSessionId && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100))
          storedSessionId = sessionStorage.getItem('sessionId')
          attempts++
        }
        
        console.log('Session ID from storage:', storedSessionId)
        
        if (!storedSessionId) {
          console.log('No session ID found, signing out')
          await signOut(auth)
          setLoading(false)
          return
        }

        // ✅ ตรวจสอบ session expiry
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
            return
          }
        }

        // ✅ ดึงข้อมูล user จาก Firestore
        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(userRef)
        
        let userRole = 'user'
        
        if (snap.exists()) {
          const userData = snap.data()
          console.log('User data from Firestore:', userData)
          console.log('Firestore role:', userData.role)
          console.log('Firestore sessionId:', userData.currentSessionId)
          console.log('Local sessionId:', storedSessionId)
          
          // ✅ ตรวจสอบ session ตรงกันหรือไม่
          // ข้าม check ถ้า currentSessionId ใน Firestore เป็น null (เพิ่ง logout)
          if (userData.currentSessionId && userData.currentSessionId !== storedSessionId) {
            console.log('Session mismatch - another device')
            setLogoutReason('another_device')
            sessionStorage.removeItem('sessionId')
            sessionStorage.removeItem('sessionExpiry')
            sessionStorage.removeItem('loginTime')
            await signOut(auth)
            setLoading(false)
            return
          }
          
          // ✅ อ่าน role จาก Firestore
          userRole = userData.role || 'user'
        } else {
          // User ใหม่ - ไม่ควรเกิดขึ้นเพราะ Login.jsx สร้างไว้แล้ว
          console.log('User document not found, creating...')
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
        }

        console.log('Setting user role to:', userRole)
        
        // ✅ Set state
        setUser(firebaseUser)
        currentSessionIdRef.current = storedSessionId
        setRole(userRole)

        const currentRoleData = roles[userRole] || DEFAULT_ROLES[userRole] || DEFAULT_ROLES.user
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

