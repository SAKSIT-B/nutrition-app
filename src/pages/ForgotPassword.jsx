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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')

    try {
      setLoading(true)
      await sendPasswordResetEmail(auth, email)
      setMessage('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว')
      showToast('ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว', 'success')
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้')
      showToast('ส่งอีเมลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

 return (
  <div className="auth-page">
    <div className="auth-layout">
      <section className="auth-left">
        <h1 className="auth-app-name">Nutrition App</h1>
        <p className="auth-app-desc">
          หากลืมรหัสผ่าน สามารถรีเซ็ตผ่านอีเมลที่ใช้สมัครสมาชิกได้จากหน้านี้
        </p>
        <ul className="auth-app-points">
          <li>ป้อนอีเมลที่ใช้ลงทะเบียน สำหรับการรีเซ็ตรหัสผ่าน</li>
          <li>ตรวจสอบกล่องจดหมายหรือกล่องจดหมายขยะและทำตามขั้นตอน</li>
        </ul>
      </section>

      <section className="auth-right">
        <div className="auth-card">
          <div className="auth-logo-row">
            <img src={logo1} alt="โลโก้ 1" />
            <img src={logo2} alt="โลโก้ 2" />
            <img src={logo3} alt="โลโก้ 3" />
          </div>
        <h1 className="auth-title">ลืมรหัสผ่าน</h1>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            อีเมลที่ใช้สมัคร
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
       </div>
        </div>
      </section>
    </div>
  </div>
  )
}

export default ForgotPassword

