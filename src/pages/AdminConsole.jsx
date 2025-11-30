// src/pages/AdminConsole.jsx

import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

const ROLE_OWNER = 'owner'
const ROLE_ADMIN = 'admin'
const ROLE_MOD = 'mod'
const ROLE_USER = 'user'

const ROLE_LABELS = {
  [ROLE_OWNER]: 'owner',
  [ROLE_ADMIN]: 'admin',
  [ROLE_MOD]: 'mod',
  [ROLE_USER]: 'user',
}

// เลือก option ใน select (ไม่ให้มี owner ตามเงื่อนไข)
const ROLE_OPTIONS = [
  { value: ROLE_USER, label: 'user' },
  { value: ROLE_MOD, label: 'mod' },
  { value: ROLE_ADMIN, label: 'admin' },
]

// helper: ตรวจว่า role ปัจจุบันมีสิทธิ์จัดการคนอื่นไหม (admin / owner เท่านั้น)
function canManageAnything(currentRole) {
  return currentRole === ROLE_ADMIN || currentRole === ROLE_OWNER
}

// ตรวจว่าสามารถแก้ไขบทบาทของ user แถวนั้นได้ไหม
function canEditRoleRow(currentRole, currentUid, row) {
  const rowRole = row.role || ROLE_USER
  const isSelf = row.id === currentUid

  if (!canManageAnything(currentRole)) return false

  // ห้ามยุ่ง owner ผ่านเว็บทั้งหมด
  if (rowRole === ROLE_OWNER) return false

  // ห้ามแตะข้อมูลตัวเอง
  if (isSelf) return false

  // admin ห้ามแตะ admin ด้วยกัน
  if (currentRole === ROLE_ADMIN && rowRole === ROLE_ADMIN) return false

  // owner แก้ได้ทุกคน ยกเว้น owner ด้วยกัน (ซึ่งเราห้ามไปแล้วด้านบน)
  return true
}

// ตรวจว่าสามารถลบ user แถวนั้นได้ไหม
function canDeleteRow(currentRole, currentUid, row) {
  const rowRole = row.role || ROLE_USER
  const isSelf = row.id === currentUid

  if (!canManageAnything(currentRole)) return false
  if (rowRole === ROLE_OWNER) return false
  if (isSelf) return false
  if (currentRole === ROLE_ADMIN && rowRole === ROLE_ADMIN) return false

  return true
}

const AdminConsole = () => {
  const { currentUser, currentUserData } = useAuth()
  const { showToast } = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const currentRole = currentUserData?.role || ROLE_USER
  const currentUid = currentUser?.uid || ''

  // --------- ตรวจสิทธิ์เข้าเพจ (admin + owner เท่านั้น) ----------
  if (!currentUserData || (currentRole !== ROLE_ADMIN && currentRole !== ROLE_OWNER)) {
    return (
      <div className="center-full">
        คุณไม่มีสิทธิ์เข้าหน้านี้
      </div>
    )
  }

  // ------------------ ดึงข้อมูล users จาก Firestore ------------------
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list = snap.docs.map((d) => ({
          id: d.id, // ใช้เป็น UID ด้วย
          ...d.data(),
        }))
        setUsers(list)
      } catch (err) {
        console.error('Fetch users error:', err)
        showToast('โหลดข้อมูลผู้ใช้ไม่สำเร็จ', 'error')
      } finally {
        setLoading(false)
      }
    }

    if (currentUser) {
      fetchUsers()
    }
  }, [currentUser, showToast])

  // ------------------ ค้นหา / filter ------------------
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const term = search.toLowerCase()
    return users.filter((u) => {
      const username = (u.username || '').toLowerCase()
      const displayName = (u.displayName || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return (
        username.includes(term) ||
        displayName.includes(term) ||
        email.includes(term)
      )
    })
  }, [users, search])

  // ------------------ เปลี่ยนบทบาท ------------------
  const handleChangeRole = async (user, newRole) => {
    const oldRole = user.role || ROLE_USER
    if (oldRole === newRole) return

    if (!canEditRoleRow(currentRole, currentUid, user)) {
      showToast('คุณไม่มีสิทธิ์เปลี่ยนบทบาทนี้', 'error')
      return
    }

    // ห้ามตั้ง / เปลี่ยนเป็น owner ผ่านเว็บ
    if (newRole === ROLE_OWNER || oldRole === ROLE_OWNER) {
      showToast('บทบาท owner ต้องแก้ไขผ่าน Firebase Console เท่านั้น', 'error')
      return
    }

    try {
      await updateDoc(doc(db, 'users', user.id), { role: newRole })
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      )
      showToast('อัปเดตบทบาทผู้ใช้เรียบร้อย', 'success')
    } catch (err) {
      console.error('Update role error:', err)
      showToast('อัปเดตบทบาทไม่สำเร็จ', 'error')
    }
  }

  // ------------------ ลบผู้ใช้ ------------------
  const handleDeleteUser = async (user) => {
    if (!canDeleteRow(currentRole, currentUid, user)) {
      showToast('คุณไม่มีสิทธิ์ลบผู้ใช้นี้', 'error')
      return
    }

    const confirmText = window.confirm(
      `ยืนยันการลบผู้ใช้ "${user.username || user.email || user.id}" หรือไม่?`,
    )
    if (!confirmText) return

    try {
      await deleteDoc(doc(db, 'users', user.id))
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
      showToast('ลบผู้ใช้เรียบร้อย', 'success')
    } catch (err) {
      console.error('Delete user error:', err)
      showToast('ลบผู้ใช้ไม่สำเร็จ', 'error')
    }
  }

  // ------------------ UI ------------------
  return (
    <div className="layout-main">
      <div className="layout-content">
        <div className="card">
          <h2>คอนโซลสำหรับ Admin</h2>
          <p className="card-subtitle">
            จัดการบทบาทผู้ใช้ ข้อมูลจากการสมัคร (ดึงจาก collection <code>&quot;users&quot;</code>)<br />
            *การลงทะเบียนผู้ใช้เริ่มต้นใน Firebase Authentication ต้องจัดทำผ่านหน้า Firebase Console
            หรือ Cloud Functions เพิ่มเติม
          </p>

          <div
            className="search-row"
            style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}
          >
            <input
              type="search"
              placeholder="ค้นหา username / ชื่อแสดง / อีเมล"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 280 }}
            />
          </div>

          {loading ? (
            <div className="center-full">
              กำลังโหลดข้อมูลผู้ใช้...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>UID</th>
                    <th style={{ width: '13%' }}>Username</th>
                    <th style={{ width: '15%' }}>ชื่อแสดง</th>
                    <th style={{ width: '22%' }}>อีเมล</th>
                    <th style={{ width: '10%' }}>บทบาท</th>
                    <th style={{ width: '10%' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '16px 0' }}>
                        ไม่พบข้อมูลผู้ใช้
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const role = user.role || ROLE_USER
                      const isSelf = user.id === currentUid
                      const editable = canEditRoleRow(currentRole, currentUid, user)
                      const deletable = canDeleteRow(currentRole, currentUid, user)

                      return (
                        <tr key={user.id}>
                          <td className="mono">{user.id}</td>
                          <td>{user.username || '-'}</td>
                          <td>{user.displayName || '-'}</td>
                          <td>{user.email || '-'}</td>
                          <td>
                            {role === ROLE_OWNER ? (
                              // owner แสดงข้อความเฉย ๆ แก้ไม่ได้
                              <span className="mono">owner</span>
                            ) : (
                              <select
                                value={role}
                                onChange={(e) => handleChangeRole(user, e.target.value)}
                                disabled={!editable}
                              >
                                {ROLE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {isSelf && (
                              <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                (บัญชีของคุณ)
                              </div>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={!deletable}
                              style={{
                                background: '#ef4444',
                                padding: '4px 10px',
                                fontSize: '0.8rem',
                              }}
                            >
                              ลบข้อมูล
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminConsole
