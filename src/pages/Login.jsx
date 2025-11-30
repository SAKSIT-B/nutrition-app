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
    <div className="auth-layout">
      {/* ฝั่งซ้าย: แนะนำ Nutrition App */}
      <section className="auth-left">
        <h1 className="auth-app-name">Nutrition App</h1>
        <p className="auth-app-desc">
          เครื่องมือช่วยคำนวณและจัดการข้อมูลคุณค่าทางโภชนาการของวัตถุดิบและเมนูอาหาร
          เหมาะสำหรับใช้ในการเรียนการสอน งานวิจัย และงานพัฒนาเมนูสุขภาพ
        </p>
        <ul className="auth-app-points">
          <li>ค้นหาและดึงข้อมูลโภชนาการมาตรฐานจากฐานข้อมูล</li>
          <li>ปรับปริมาณวัตถุดิบเพื่อดูผลรวมคุณค่าทางโภชนาการ</li>
          <li>ระบบจัดการข้อมูลวัตถุดิบ / เมนู สำหรับผู้ดูแล</li>
        </ul>
      </section>

      {/* ฝั่งขวา: ฟอร์มเข้าสู่ระบบ */}
      <section className="auth-right">
        <div className="auth-card">
          {/* โลโก้ 3 อันด้านบน */}
          <div className="auth-logo-row">
            <img src={logo1} alt="โลโก้ 1" />
            <img src={logo2} alt="โลโก้ 2" />
            <img src={logo3} alt="โลโก้ 3" />
          </div>

          {/* ===== วางฟอร์มเดิมของหน้า Login ตรงนี้ ===== */}
          {/* 
            ให้ copy โค้ดเก่าที่อยู่ใน auth-card เดิม เช่น
            <h1 className="auth-title">เข้าสู่ระบบ</h1>
            <form ...> ... </form>
            <div className="auth-links"> ... </div>
          */}

          <h1 className="auth-title">เข้าสู่ระบบ</h1>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
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

            <button type="submit" disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="auth-links">
            <a href="#/forgot-password">ลืมรหัสผ่าน?</a> ·{' '}
            <a href="#/register">สมัครสมาชิก</a>
          </div>
          {/* ===== จบฟอร์มเดิม ===== */}
        </div>
      </section>
    </div>
  </div>
)

}
export default Login





