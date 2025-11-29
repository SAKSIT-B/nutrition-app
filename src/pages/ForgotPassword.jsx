import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase'
import { useToast } from '../contexts/ToastContext'

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
      <div className="auth-card">
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
    </div>
  )
}

export default ForgotPassword
