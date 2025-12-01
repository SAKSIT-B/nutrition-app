// src/pages/Login.jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useToast } from '../contexts/ToastContext'
import logo1 from '../assets/logo1.png'
import logo2 from '../assets/logo2.png'
import logo3 from '../assets/logo3.png'

const Login = () => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // ป้องกันการ submit ซ้ำ
    if (loading) return
    
    setError('')
    setLoading(true)

    try {
      let email = identifier.trim()

      // ถ้าไม่ได้พิมพ์เครื่องหมาย @ ให้ถือว่าเป็น username
      if (!email.includes('@')) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('username', '==', email.toLowerCase()))
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          throw new Error('USERNAME_NOT_FOUND')
        }

        const userData = snapshot.docs[0].data()
        email = userData.email
      }

      // ล็อกอินด้วย email
      await signInWithEmailAndPassword(auth, email, password)

      showToast('เข้าสู่ระบบสำเร็จ 🎉', 'success')
      navigate('/dashboard')
    } catch (err) {
      console.error('Login error:', err)

      let message = 'ไม่สามารถเข้าสู่ระบบได้'
      if (err.code === 'auth/user-not-found') {
        message = 'ไม่พบบัญชีผู้ใช้นี้'
      } else if (err.code === 'auth/wrong-password') {
        message = 'รหัสผ่านไม่ถูกต้อง'
      } else if (err.code === 'auth/invalid-credential') {
        message = 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง'
      } else if (err.code === 'auth/too-many-requests') {
        message = 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง'
      } else if (err.message === 'USERNAME_NOT_FOUND') {
        message = 'ไม่พบ username นี้ในระบบ'
      }

      setError(message)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* ฝั่งซ้าย: แนะนำ Nutrition App */}
        <section className="auth-left">
          <div className="auth-left-content">
            <h1 className="auth-app-name">
              <span className="auth-app-icon">🥗</span>
              Nutrition App
            </h1>
            <p className="auth-app-desc">
              เครื่องมือช่วยคำนวณและจัดการข้อมูลคุณค่าทางโภชนาการของวัตถุดิบและเมนูอาหาร
              เหมาะสำหรับใช้ในการเรียนการสอน งานวิจัย และงานพัฒนาเมนูเพื่อสุขภาพ
            </p>
            <ul className="auth-app-points">
              <li>
                <span className="point-icon">🔍</span>
                <span>ค้นหาและดึงข้อมูลโภชนาการมาตรฐาน</span>
              </li>
              <li>
                <span className="point-icon">📊</span>
                <span>ปรับปริมาณวัตถุดิบเพื่อดูผลรวมคุณค่าทางโภชนาการ และสามารถส่งออกไฟล์ได้ (xlsx)</span>
              </li>
              <li>
                <span className="point-icon">📚</span>
                <span>ฐานข้อมูลที่ได้มาตรฐานจาก สำนักโภชนาการ กรมอนามัย (Thai FCD)</span>
              </li>
              <li>
                <span className="point-icon">⚙️</span>
                <span>ระบบจัดการข้อมูลวัตถุดิบ / เมนู สำหรับผู้ดูแล</span>
              </li>
              <li>
                <span className="point-icon">🎓</span>
                <span>พัฒนาและแก้ไขโดย ครูศักดิ์สิทธิ์ บำรุง • แผนกวิชาอาหารและโภชนาการ วิทยาลัยอาชีวศึกษาสุโขทัย</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ฝั่งขวา: ฟอร์มเข้าสู่ระบบ */}
        <section className="auth-right">
          <div className="auth-card">
            {/* โลโก้ 3 อันด้านบน */}
            <div className="auth-logo-row">
              <img src={logo1} alt="โลโก้ 1" className="auth-logo" />
              <img src={logo2} alt="โลโก้ 2" className="auth-logo" />
              <img src={logo3} alt="โลโก้ 3" className="auth-logo" />
            </div>

            <h1 className="auth-title">
              <span className="auth-title-icon">👋</span>
              เข้าสู่ระบบ
            </h1>
            <p className="auth-subtitle">ยินดีต้อนรับกลับมา!</p>

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">
                  <span className="label-icon">👤</span>
                  Username หรือ อีเมล
                </label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="กรอก Username หรืออีเมล"
                    className="form-input"
                    required
                    autoComplete="username"
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
                    placeholder="กรอกรหัสผ่าน"
                    className="form-input"
                    required
                    autoComplete="current-password"
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
              </div>

              <button 
                type="submit" 
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="btn-spinner"></span>
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">🚀</span>
                    เข้าสู่ระบบ
                  </>
                )}
              </button>
            </form>

            {/* ✅ แก้จาก <a href="#/..."> เป็น <Link to="..."> */}
            <div className="auth-links">
              <Link to="/forgot-password" className="auth-link">
                🔑 ลืมรหัสผ่าน?
              </Link>
              <span className="auth-link-divider">•</span>
              <Link to="/register" className="auth-link">
                ✨ สมัครสมาชิก
              </Link>
            </div>

            <div className="auth-footer">
              <p>© 2024 Nutrition App - วิทยาลัยอาชีวศึกษาสุโขทัย</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Login
