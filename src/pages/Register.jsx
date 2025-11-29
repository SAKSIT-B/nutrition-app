import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth, db } from '../firebase'
import { doc, setDoc, serverTimestamp, getDocs, query, collection, where } from 'firebase/firestore'
import { useToast } from '../contexts/ToastContext'

const Register = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

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
      const q1 = query(collection(db, 'users'), where('username', '==', username))
      const q2 = query(collection(db, 'users'), where('email', '==', email))

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
        username,
        displayName,
        email,
        role: 'user',
        createdAt: serverTimestamp(),
      })

      showToast('สมัครสมาชิกสำเร็จ', 'success')
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      setError('ไม่สามารถสมัครสมาชิกได้')
      showToast('สมัครสมาชิกไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">สมัครสมาชิก</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          <label>
            ชื่อที่จะแสดงในแดชบอร์ด
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </label>

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

          <label>
            ยืนยันรหัสผ่าน
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  )
}

export default Register
