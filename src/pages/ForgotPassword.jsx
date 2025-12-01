// src/pages/ForgotPassword.jsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { useToast } from '../contexts/ToastContext'
import logo1 from '../assets/logo1.png'
import logo2 from '../assets/logo2.png'
import logo3 from '../assets/logo3.png'

const ForgotPassword = () => {
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (loading) return
    
    setError('')
    setMessage('')

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, email)
      setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว')
      setSent(true)
      showToast('ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว 📧', 'success')
    } catch (err) {
      console.error(err)
      
      let errorMessage = 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้'
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'ไม่พบอีเมลนี้ในระบบ'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง'
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'ส่งคำขอมากเกินไป กรุณารอสักครู่'
      }
      
      setError(errorMessage)
      showToast('ส่งอีเมลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    setSent(false)
    setMessage('')
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
              หากลืมรหัสผ่าน สามารถรีเซ็ตผ่านอีเมลที่ใช้สมัครสมาชิกได้จากหน้านี้
            </p>
            <ul className="auth-app-points">
              <li>
                <span className="point-icon">📧</span>
                <span>ป้อนอีเมลที่ใช้ลงทะเบียน สำหรับการรีเซ็ตรหัสผ่าน</span>
              </li>
              <li>
                <span className="point-icon">📬</span>
                <span>ตรวจสอบกล่องจดหมายหรือกล่องจดหมายขยะและทำตามขั้นตอน</span>
              </li>
              <li>
                <span className="point-icon">🔐</span>
                <span>ลิงก์รีเซ็ตจะหมดอายุใน 1 ชั่วโมง</span>
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
              <span className="auth-title-icon">🔑</span>
              ลืมรหัสผ่าน
            </h1>
            <p className="auth-subtitle">รีเซ็ตรหัสผ่านผ่านอีเมล</p>

            {error && (
              <div className="auth-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {message && (
              <div className="auth-success">
                <span className="success-icon">✅</span>
                <div className="success-content">
                  <strong>{message}</strong>
                  <p>กรุณาตรวจสอบอีเมล <strong>{email}</strong></p>
                </div>
              </div>
            )}

            {!sent ? (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">
                    <span className="label-icon">📧</span>
                    อีเมลที่ใช้สมัคร
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

                <button 
                  type="submit" 
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="btn-spinner"></span>
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">📤</span>
                      ส่งลิงก์รีเซ็ตรหัสผ่าน
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="reset-sent-actions">
                <div className="sent-illustration">📬</div>
                <p>ตรวจสอบกล่องจดหมายของคุณ</p>
                <button 
                  type="button" 
                  className="auth-submit-btn secondary"
                  onClick={handleResend}
                >
                  <span className="btn-icon">🔄</span>
                  ส่งอีกครั้ง
                </button>
              </div>
            )}

            <div className="auth-links">
              <Link to="/login" className="auth-link">
                <span>⬅️</span>
                กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default ForgotPassword
