import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useToast } from '../contexts/ToastContext'

const Login = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      showToast('เข้าสู่ระบบสำเร็จ', 'success')
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      showToast('เข้าสู่ระบบไม่สำเร็จ', 'error')
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
            อีเมล
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">ลืมรหัสผ่าน?</Link>
          <span> · </span>
          <Link to="/register">สมัครสมาชิก</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
