// src/pages/Login.jsx
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useToast } from '../contexts/ToastContext'

const Login = () => {
  const [identifier, setIdentifier] = useState('') // username หรือ email
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let email = identifier.trim()

      // ถ้าไม่ได้พิมพ์เครื่องหมาย @ ให้ถือว่าเป็น username
      if (!email.includes('@')) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('username', '==', email))
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          throw new Error('USERNAME_NOT_FOUND')
        }

        // สมมติว่า username ไม่ซ้ำ → เอา doc แรก
        const userData = snapshot.docs[0].data()
        email = userData.email
      }

      // ล็อกอินด้วย email (จาก username หรือ email ที่พิมพ์มา)
      await signInWithEmailAndPassword(auth, email, password)

      showToast('เข้าสู่ระบบสำเร็จ', 'success')
      navigate('/dashboard')
    } catch (err) {
      console.error('Login error:', err)

      let message = 'ไม่สามารถเข้าสู่ระบบได้'
      if (err.code === 'auth/user-not-found') {
        message = 'ไม่พบบัญชีผู้ใช้'
      } else if (err.code === 'auth/wrong-password') {
        message = 'รหัสผ่านไม่ถูกต้อง'
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
      <div className="auth-card">
        <h1 className="auth-title">เข้าสู่ระบบ</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {/* เปลี่ยนข้อความให้สื่อว่าใส่ได้ทั้งสองแบบ */}
            Username หรือ อีเมล
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="กรอก Username หรืออีเมล"
              required
            />
          </label>

          <label>
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </label>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">ลืมรหัสผ่าน?</Link> ·{' '}
          <Link to="/register">สมัครสมาชิก</Link>
        </div>
      </div>
    </div>
  )
}

export default Login


