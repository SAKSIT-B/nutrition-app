import React, { useEffect, useState } from 'react'
import { collection, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'

const AdminConsole = () => {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const snap = await getDocs(collection(db, 'users'))
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      showToast('โหลดข้อมูลผู้ใช้ไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const changeRole = async (id, role) => {
    try {
      await updateDoc(doc(db, 'users', id), { role })
      showToast('อัปเดตบทบาทสำเร็จ', 'success')
      loadUsers()
    } catch (err) {
      console.error(err)
      showToast('อัปเดตบทบาทไม่สำเร็จ', 'error')
    }
  }

  const deleteUserDoc = async (id) => {
    if (!window.confirm('ต้องการลบข้อมูลผู้ใช้นี้ออกจากฐานข้อมูลหรือไม่?')) return
    try {
      await deleteDoc(doc(db, 'users', id))
      showToast('ลบข้อมูลผู้ใช้ในฐานข้อมูลสำเร็จ', 'success')
      loadUsers()
    } catch (err) {
      console.error(err)
      showToast('ลบข้อมูลไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="card">
      <h2>คอนโซลสำหรับ Admin</h2>
      <p className="card-subtitle">
        จัดการบทบาทผู้ใช้ ดูข้อมูลการสมัคร (ดึงจาก collection "users")  
        <br />
        *การลบบัญชีผู้ใช้จริงใน Firebase Authentication ต้องทำผ่านหน้า Console
        หรือ Cloud Functions เพิ่มเติม
      </p>

      {loading && <div>กำลังโหลดข้อมูลผู้ใช้...</div>}

      <table className="table">
        <thead>
          <tr>
            <th>UID</th>
            <th>Username</th>
            <th>ชื่อแสดง</th>
            <th>อีเมล</th>
            <th>บทบาท</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="mono">{u.uid}</td>
              <td>{u.username || '-'}</td>
              <td>{u.displayName || '-'}</td>
              <td>{u.email || '-'}</td>
              <td>
                <select
                  value={u.role || 'user'}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  disabled={u.uid === user?.uid}
                >
                  <option value="admin">admin</option>
                  <option value="mod">mod</option>
                  <option value="user">user</option>
                </select>
              </td>
              <td>
                <button
                  onClick={() => deleteUserDoc(u.id)}
                  disabled={u.uid === user?.uid}
                >
                  ลบข้อมูล
                </button>
              </td>
            </tr>
          ))}
          {!users.length && (
            <tr>
              <td colSpan="6">ยังไม่มีข้อมูลผู้ใช้ในฐานข้อมูล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default AdminConsole
