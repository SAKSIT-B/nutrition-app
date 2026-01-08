// src/contexts/AuthContext.jsx
// ระบบ Authentication พร้อม Session Timeout และ Single Device Login

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  browserSessionPersistence,
  setPersistence
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  collection, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ===== CONFIG =====
const SESSION_TIMEOUT_HOURS = 5; // Session timeout 5 ชั่วโมง
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000; // แปลงเป็น milliseconds
const SESSION_CHECK_INTERVAL = 60 * 1000; // ตรวจสอบทุก 1 นาที

// ===== PERMISSIONS CONFIG =====
export const ALL_PERMISSIONS = [
  'nutrition',
  'thai-rdi',
  'recipes',
  'compare',
  'cost',
  'statistics',
  'sensory',
  'shelf-life',
  'manage-items',
  'admin',
  'manage-roles',
];

export const DEFAULT_ROLES = {
  owner: {
    id: 'owner',
    name: 'Owner',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
    priority: 100,
    icon: '👑',
    color: '#ff9e0b'
  },
  admin: {
    id: 'admin',
    name: 'Admin',
    permissions: ALL_PERMISSIONS.filter(p => p !== 'manage-roles'),
    isSystem: true,
    priority: 90,
    icon: '🛡️',
    color: '#ef4444'
  },
  user: {
    id: 'user',
    name: 'User',
    permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare', 'cost', 'statistics', 'sensory', 'shelf-life'],
    isSystem: true,
    priority: 10,
    icon: '👤',
    color: '#6b7280'
  }
};

// ===== Generate Unique Session ID =====
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ===== Get Device Info =====
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let device = 'Unknown Device';
  
  if (/iPhone/i.test(ua)) device = 'iPhone';
  else if (/iPad/i.test(ua)) device = 'iPad';
  else if (/Android/i.test(ua)) device = 'Android';
  else if (/Windows/i.test(ua)) device = 'Windows PC';
  else if (/Mac/i.test(ua)) device = 'Mac';
  else if (/Linux/i.test(ua)) device = 'Linux';
  
  return device;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState({});
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [logoutReason, setLogoutReason] = useState(null);
  
  // Refs
  const sessionCheckIntervalRef = useRef(null);
  const sessionListenerRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  // ===== ตั้งค่า Session Persistence =====
  useEffect(() => {
    const setupPersistence = async () => {
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (error) {
        console.error('Error setting persistence:', error);
      }
    };
    setupPersistence();
  }, []);

  // ===== Force Logout Function =====
  const forceLogout = useCallback(async (reason = 'unknown') => {
    console.log('Force logout triggered:', reason);
    
    // Clear intervals and listeners
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }
    if (sessionListenerRef.current) {
      sessionListenerRef.current();
    }
    
    // Clear session storage
    sessionStorage.removeItem('sessionId');
    sessionStorage.removeItem('sessionExpiry');
    sessionStorage.removeItem('loginTime');
    
    // Set logout reason before signing out
    setLogoutReason(reason);
    
    try {
      // Clear session in Firestore
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          currentSessionId: null,
          lastLogout: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error clearing session:', error);
    }
    
    // Sign out from Firebase
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    
    // Clear state
    setUser(null);
    setUserRole(null);
    setPermissions([]);
    setSessionExpiry(null);
    setTimeRemaining(null);
    currentSessionIdRef.current = null;
  }, [user]);

  // ===== Check Session Timeout =====
  const checkSessionTimeout = useCallback(() => {
    const expiry = sessionStorage.getItem('sessionExpiry');
    
    if (expiry) {
      const expiryTime = parseInt(expiry, 10);
      const now = Date.now();
      const remaining = expiryTime - now;
      
      if (remaining <= 0) {
        // Session หมดอายุ
        forceLogout('session_expired');
      } else {
        // อัพเดทเวลาที่เหลือ
        setTimeRemaining(remaining);
        setSessionExpiry(expiryTime);
      }
    }
  }, [forceLogout]);

  // ===== Start Session Timer =====
  const startSessionTimer = useCallback(() => {
    // Clear existing interval
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }
    
    // Set session expiry
    const expiryTime = Date.now() + SESSION_TIMEOUT_MS;
    sessionStorage.setItem('sessionExpiry', expiryTime.toString());
    sessionStorage.setItem('loginTime', Date.now().toString());
    setSessionExpiry(expiryTime);
    setTimeRemaining(SESSION_TIMEOUT_MS);
    
    // Start checking interval
    sessionCheckIntervalRef.current = setInterval(() => {
      checkSessionTimeout();
    }, SESSION_CHECK_INTERVAL);
    
    // Initial check
    checkSessionTimeout();
  }, [checkSessionTimeout]);

  // ===== Listen for Session Changes (Single Device) =====
  const startSessionListener = useCallback((userId, mySessionId) => {
    // Unsubscribe previous listener
    if (sessionListenerRef.current) {
      sessionListenerRef.current();
    }
    
    // Listen to user document changes
    sessionListenerRef.current = onSnapshot(
      doc(db, 'users', userId),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const serverSessionId = data.currentSessionId;
          
          // ถ้า session ID ไม่ตรงกับของเรา = มีคนอื่น login
          if (serverSessionId && serverSessionId !== mySessionId) {
            console.log('Another device logged in, forcing logout');
            forceLogout('another_device');
          }
        }
      },
      (error) => {
        console.error('Session listener error:', error);
      }
    );
  }, [forceLogout]);

  // ===== โหลด Roles จาก Firestore =====
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const rolesSnapshot = await getDocs(collection(db, 'roles'));
        const rolesData = { ...DEFAULT_ROLES };
        
        rolesSnapshot.forEach((docSnap) => {
          rolesData[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        
        setRoles(rolesData);
      } catch (error) {
        console.error('Error fetching roles:', error);
        setRoles(DEFAULT_ROLES);
      }
    };
    
    fetchRoles();
  }, []);

  // ===== ติดตามสถานะ Auth =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // ตรวจสอบว่ามี session ที่ valid อยู่ไหม
        const storedSessionId = sessionStorage.getItem('sessionId');
        const storedExpiry = sessionStorage.getItem('sessionExpiry');
        
        if (!storedSessionId || !storedExpiry) {
          // ไม่มี session = ล้าง cache มาหรือ browser ใหม่
          // ให้ logout
          await signOut(auth);
          setUser(null);
          setUserRole(null);
          setPermissions([]);
          setLoading(false);
          return;
        }
        
        // ตรวจสอบว่า session หมดอายุหรือยัง
        const expiryTime = parseInt(storedExpiry, 10);
        if (Date.now() > expiryTime) {
          // Session หมดอายุ
          forceLogout('session_expired');
          setLoading(false);
          return;
        }
        
        setUser(currentUser);
        currentSessionIdRef.current = storedSessionId;
        
        // ดึงข้อมูล Role ของ User
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // ตรวจสอบ session ID ตรงกันไหม
            if (userData.currentSessionId && userData.currentSessionId !== storedSessionId) {
              // Session ไม่ตรง = มีคนอื่น login ไปแล้ว
              forceLogout('session_invalid');
              setLoading(false);
              return;
            }
            
            const roleId = userData.role || 'user';
            const role = roles[roleId] || DEFAULT_ROLES[roleId] || DEFAULT_ROLES.user;
            
            setUserRole(role);
            setPermissions(role.permissions || []);
            
            // Start session timer และ listener
            startSessionTimer();
            startSessionListener(currentUser.uid, storedSessionId);
          } else {
            // User document ไม่มี
            forceLogout('user_not_found');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole(DEFAULT_ROLES.user);
          setPermissions(DEFAULT_ROLES.user.permissions);
        }
      } else {
        setUser(null);
        setUserRole(null);
        setPermissions([]);
        setSessionExpiry(null);
        setTimeRemaining(null);
        
        // Clear intervals
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }
        if (sessionListenerRef.current) {
          sessionListenerRef.current();
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (sessionListenerRef.current) {
        sessionListenerRef.current();
      }
    };
  }, [roles, forceLogout, startSessionTimer, startSessionListener]);

  // ===== Login Function =====
  const login = async (email, password) => {
    try {
      // Generate new session ID
      const newSessionId = generateSessionId();
      const deviceInfo = getDeviceInfo();
      
      // Sign in
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // บันทึก session ลง Firestore (จะทำให้ session เก่าถูก invalidate)
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        // อัพเดท session
        await updateDoc(userDocRef, {
          currentSessionId: newSessionId,
          lastLogin: serverTimestamp(),
          lastDevice: deviceInfo,
          lastLoginIP: 'N/A' // ถ้าต้องการเก็บ IP ต้องใช้ backend
        });
      } else {
        // สร้าง user document ใหม่
        await setDoc(userDocRef, {
          email: email,
          role: 'user',
          currentSessionId: newSessionId,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          lastDevice: deviceInfo
        });
      }
      
      // บันทึก session ลง sessionStorage
      sessionStorage.setItem('sessionId', newSessionId);
      currentSessionIdRef.current = newSessionId;
      
      // Start session timer
      startSessionTimer();
      
      // Start listening for session changes
      startSessionListener(result.user.uid, newSessionId);
      
      // Clear logout reason
      setLogoutReason(null);
      
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // ===== Register Function =====
  const register = async (email, password) => {
    try {
      const newSessionId = generateSessionId();
      const deviceInfo = getDeviceInfo();
      
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // สร้าง User Document
      await setDoc(doc(db, 'users', result.user.uid), {
        email: email,
        role: 'user',
        currentSessionId: newSessionId,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        lastDevice: deviceInfo
      });
      
      // บันทึก session
      sessionStorage.setItem('sessionId', newSessionId);
      currentSessionIdRef.current = newSessionId;
      
      // Start session timer
      startSessionTimer();
      
      // Start listening
      startSessionListener(result.user.uid, newSessionId);
      
      setLogoutReason(null);
      
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: getErrorMessage(error.code) };
    }
  };

  // ===== Logout Function =====
  const logout = async () => {
    try {
      await forceLogout('manual');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  // ===== Clear Logout Reason =====
  const clearLogoutReason = () => {
    setLogoutReason(null);
  };

  // ===== Check Permission =====
  const hasPermission = (permission) => {
    if (!permission) return true;
    return permissions.includes(permission);
  };

  // ===== Error Messages =====
  const getErrorMessage = (errorCode) => {
    const messages = {
      'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
      'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
      'auth/email-already-in-use': 'อีเมลนี้ถูกใช้งานแล้ว',
      'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
      'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
      'auth/too-many-requests': 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่',
      'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    };
    return messages[errorCode] || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  };

  // ===== Format Time Remaining =====
  const formatTimeRemaining = () => {
    if (!timeRemaining) return null;
    
    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours} ชม. ${minutes} นาที`;
    }
    return `${minutes} นาที`;
  };

  const value = {
    user,
    userRole,
    permissions,
    roles,
    loading,
    login,
    register,
    logout,
    hasPermission,
    ALL_PERMISSIONS,
    DEFAULT_ROLES,
    // Session info
    sessionExpiry,
    timeRemaining,
    formatTimeRemaining,
    logoutReason,
    clearLogoutReason,
    SESSION_TIMEOUT_HOURS,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
