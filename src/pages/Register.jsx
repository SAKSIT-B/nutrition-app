// src/pages/Register.jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, setDoc, serverTimestamp, getDocs, query, collection, where } from 'firebase/firestore'
import { useToast } from '../contexts/ToastContext'
import logo1 from '../assets/logo1.png'
import logo2 from '../assets/logo2.png'
import logo3 from '../assets/logo3.png'

const Register = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ตรวจสอบความแข็งแรงของรหัสผ่าน
  const getPasswordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' }
    
    let score = 0
    if (password.length >= 6) score++
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { level: 1, text: 'อ่อน', color: '#ef4444' }
    if (score <= 4) return { level: 2, text: 'ปานกลาง', color: '#f59e0b' }
    return { level: 3, text: 'แข็งแรง', color: '#22c55e' }
  }

  const passwordStrength = getPasswordStrength()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setError('')

    // Validations
    if (username.length < 3) {
      setError('Username ต้องมีอย่างน้อย 3 ตัวอักษร')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _ เท่านั้น')
      return
    }

    if (password !== confirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(password)) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัว และมีทั้งตัวอักษรและตัวเลข')
      return
    }

    try {
      setLoading(true)

      // ตรวจ username/email ซ้ำ จาก Firestore
      const q1 = query(collection(db, 'users'), where('username', '==', username.toLowerCase()))
      const q2 = query(collection(db, 'users'), where('email', '==', email.toLowerCase()))

      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)])

      if (!snap1.empty) {
        setError('Username นี้มีในระบบแล้ว')
        setLoading(false)
        return
      }
      if (!snap2.empty) {
        setError('อีเมลนี้มีในระบบแล้ว')
        setLoading(false)
        return
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password)

      if (displayName) {
        await updateProfile(cred.user, { displayName })
      }

      const userRef = doc(db, 'users', cred.user.uid)
      await setDoc(userRef, {
        uid: cred.user.uid,
        username: username.toLowerCase(),
        displayName,
        email: email.toLowerCase(),
        role: 'user',
        createdAt: serverTimestamp(),
      })

      showToast('สมัครสมาชิกสำเร็จ 🎉', 'success')
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      
      let message = 'ไม่สามารถสมัครสมาชิกได้'
      if (err.code === 'auth/email-already-in-use') {
        message = 'อีเมลนี้ถูกใช้งานแล้ว'
      } else if (err.code === 'auth/invalid-email') {
        message = 'รูปแบบอีเมลไม่ถูกต้อง'
      } else if (err.code === 'auth/weak-password') {
        message = 'รหัสผ่านไม่แข็งแรงพอ'
      }
      
      setError(message)
      showToast('สมัครสมาชิกไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <section className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-app-name">
              <span className="auth-app-icon">🥗</span>
              Nutrition App
            </h1>
            <p className="auth-app-desc">
              ลงทะเบียนเพื่อใช้งานระบบคำนวณและจัดการข้อมูลโภชนาการ
              สำหรับงานสอนและงานวิจัย
            </p>
            <ul className="auth-app-points">
              <li>
                <span className="point-icon">📝</span>
                <span>บันทึกวัตถุดิบ / เมนูที่ใช้บ่อย</span>
              </li>
              <li>
                <span className="point-icon">📊</span>
                <span>จัดการข้อมูลผ่านหน้าแดชบอร์ด</span>
              </li>
              <li>
                <span className="point-icon">🔐</span>
                <span>รองรับการกำหนดสิทธิ์การใช้งานหลายระดับ</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="auth-right">
          <div className="auth-card">
            <div className="auth-logo-row">
              <img src={logo1} alt="โลโก้ 1" className="auth-logo" />
              <img src={logo2} alt="โลโก้ 2" className="auth-logo" />
              <img src={logo3} alt="โลโก้ 3" className="auth-logo" />
            </div>
            
            <h1 className="auth-title">
              <span className="auth-title-icon">✨</span>
              สมัครสมาชิก
            </h1>
            <p className="auth-subtitle">สร้างบัญชีใหม่เพื่อเริ่มใช้งาน</p>

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🏷️</span>
                  Username
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="เช่น john_doe"
                    className="form-input"
                    required
                    autoComplete="username"
                  />
                </div>
                <span className="input-hint">ใช้ตัวอักษร ตัวเลข และ _ เท่านั้น</span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  ชื่อที่จะแสดงในแดชบอร์ด
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี"
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">📧</span>
                  อีเมล
                </label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="form-input"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔒</span>
                  รหัสผ่าน
                </label>
                <div className="input-wrapper password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัว มีตัวอักษรและตัวเลข"
                    className="form-input"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div 
                        className="strength-fill"
                        style={{ 
                          width: `${(passwordStrength.level / 3) * 100}%`,
                          backgroundColor: passwordStrength.color 
                        }}
                      ></div>
                    </div>
                    <span className="strength-text" style={{ color: passwordStrength.color }}>
                      {passwordStrength.text}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">🔐</span>
                  ยืนยันรหัสผ่าน
                </label>
                <div className="input-wrapper password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="form-input"
                    required
                    autoComplete="new-password"
                  />
                  {confirmPassword && (
                    <span className="password-match">
                      {password === confirmPassword ? '✅' : '❌'}
                    </span>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    กำลังสมัครสมาชิก...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🎉</span>
                    สมัครสมาชิก
                  </>
                )}
              </button>
            </form>

            <div className="auth-links">
              <span className="auth-link-text">มีบัญชีอยู่แล้ว?</span>
              <Link to="/login" className="auth-link highlight">
                🔑 เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Register
