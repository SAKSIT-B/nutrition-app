// src/pages/AdminConsole.jsx

import React, { useEffect, useState, useMemo } from 'react'
import { auth, db } from '../firebase'
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore'

const AdminConsole = () => {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentRole, setCurrentRole] = useState('user')
  const [loadingMe, setLoadingMe] = useState(true)

  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // ---------------- Current user + role ----------------
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) {
        setCurrentUser(null)
        setCurrentRole('guest')
        setLoadingMe(false)
        return
      }

      setCurrentUser(fbUser)

      try {
        const profileRef = doc(db, 'users', fbUser.uid)
        const snap = await getDoc(profileRef)
        if (snap.exists()) {
          const data = snap.data()
          setCurrentRole(data.role || 'user')
        } else {
          setCurrentRole('user')
        }
      } catch (err) {
        console.error('โหลด role ผู้ใช้ปัจจุบันล้มเหลว', err)
        setCurrentRole('user')
      } finally {
        setLoadingMe(false)
      }
    })

    return () => unsub()
  }, [])

  const canAccessAdmin = useMemo(
    () => currentRole === 'owner' || currentRole === 'admin',
    [currentRole]
  )

  // ---------------- Load all users ----------------
  useEffect(() => {
    const loadUsers = async () => {
      if (!canAccessAdmin) return
      setLoadingUsers(true)
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        setUsers(list)
      } catch (err) {
        console.error('โหลด users ล้มเหลว', err)
      } finally {
        setLoadingUsers(false)
      }
    }

    if (!loadingMe) {
      loadUsers()
    }
  }, [loadingMe, canAccessAdmin])

  // ---------------- Permission helpers ----------------

  const isOwnerRow = (u) => u.role === 'owner'

  // ใครเปลี่ยนหรือลบได้บ้าง
  const canManageThisUser = (u) => {
    if (!currentUser) return false
    if (currentUser.uid === u.id) return false // ห้ามจัดการตัวเอง

    if (currentRole === 'owner') {
      // owner จัดการทุกคนได้ ยกเว้นตัวเอง
      return true
    }

    if (currentRole === 'admin') {
      // admin จัดการได้เฉพาะ mod + user เท่านั้น
      return u.role === 'mod' || u.role === 'user'
    }

    return false
  }

  // เลือก role ที่ให้เลือกได้จาก dropdown (ไม่ให้เปลี่ยน/สร้าง owner ผ่านเว็บ)
  const roleOptions = ['admin', 'mod', 'user']

  const handleChangeRole = async (u, newRole) => {
    if (!canManageThisUser(u)) return
    if (isOwnerRow(u)) return // ป้องกันกรณี owner เผลอเปลี่ยน owner คนอื่น

    try {
      setSaving(true)
      const ref = doc(db, 'users', u.id)
      await updateDoc(ref, { role: newRole })

      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x))
      )
    } catch (err) {
      console.error('อัปเดต role ล้มเหลว', err)
      alert('อัปเดตบทบาทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (u) => {
    if (!canManageThisUser(u)) return
    if (!window.confirm(`ยืนยันการลบผู้ใช้ "${u.username || u.displayName || u.email}" ?`))
      return

    try {
      setSaving(true)
      await deleteDoc(doc(db, 'users', u.id))
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (err) {
      console.error('ลบผู้ใช้ล้มเหลว', err)
      alert('ลบผู้ใช้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  // ---------------- Filtering ----------------

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users

    return users.filter((u) => {
      const t =
        `${u.username || ''} ${u.displayName || ''} ${u.email || ''}`.toLowerCase()
      return t.includes(q)
    })
  }, [users, search])

  // ---------------- Render ----------------

  if (loadingMe || loadingUsers) {
    return (
      <div className="center-full">
        <div className="loader" />
        <div style={{ marginTop: 8 }}>กำลังโหลดข้อมูลผู้ใช้…</div>
      </div>
    )
  }

  if (!canAccessAdmin) {
    return (
      <div className="center-full">
        <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
      </div>
    )
  }

  return (
    <div className="layout-content">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>คอนโซลสำหรับ Admin</h2>
        <p className="card-subtitle">
          จัดการบทบาทผู้ใช้ ข้อมูลจากการสมัครสมาชิก (collection <code>users</code>)<br />
          <span>
            บทบาทปัจจุบันของคุณ: <strong>{currentRole}</strong>
          </span>
        </p>

        {/* แถวค้นหา */}
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <input
            type="search"
            placeholder="ค้นหา username / ชื่อแสดง / อีเมล"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nutrition-search-input"
          />
        </div>

        {/* ตารางผู้ใช้ */}
        <div style={{ overflowX: 'auto' }}>
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
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '12px 8px' }}>
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              )}

              {filteredUsers.map((u) => {
                const disableOwnerRow = isOwnerRow(u)
                const canManage = canManageThisUser(u)

                return (
                  <tr key={u.id}>
                    <td className="mono">{u.id}</td>
                    <td>{u.username || '-'}</td>
                    <td>{u.displayName || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td>
                      {disableOwnerRow ? (
                        <span>owner</span>
                      ) : (
                        <select
                          value={u.role || 'user'}
                          disabled={!canManage || saving}
                          onChange={(e) => handleChangeRole(u, e.target.value)}
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        style={{ background: '#dc2626' }}
                        disabled={!canManage || saving}
                        onClick={() => handleDeleteUser(u)}
                      >
                        ลบข้อมูล
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: 10, fontSize: '0.8rem', color: '#6b7280' }}>
          * owner สามารถจัดการทุกบทบาทได้ (ยกเว้นลบ / เปลี่ยนบทบาทตัวเอง) และบทบาท owner
          ต้องแก้ไขจาก Firebase Console เท่านั้น
        </p>
      </div>
    </div>
  )
}

export default AdminConsole
