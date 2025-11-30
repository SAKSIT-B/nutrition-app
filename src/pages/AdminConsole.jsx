import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const AdminConsole = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // 🔍 state สำหรับค้นหา
  const [searchTerm, setSearchTerm] = useState('');

  // โหลดผู้ใช้จาก collection "users"
  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setUsers(list);
      } catch (e) {
        console.error('Load users error:', e);
        showToast('ไม่สามารถโหลดข้อมูลผู้ใช้ได้', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [showToast]);

  // เปลี่ยน role
  const handleRoleChange = async (userId, newRole) => {
    try {
      setSavingId(userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      showToast('บันทึกสิทธิ์ผู้ใช้สำเร็จ', 'success');
    } catch (e) {
      console.error('Update role error:', e);
      showToast('บันทึกสิทธิ์ผู้ใช้ไม่สำเร็จ', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // ลบผู้ใช้ (ใน collection users เท่านั้น)
  const handleDelete = async (userId) => {
    if (!window.confirm('ต้องการลบข้อมูลผู้ใช้นี้ออกจากระบบหรือไม่')) return;

    try {
      setDeletingId(userId);
      await deleteDoc(doc(db, 'users', userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast('ลบข้อมูลผู้ใช้แล้ว', 'success');
    } catch (e) {
      console.error('Delete user error:', e);
      showToast('ลบข้อมูลผู้ใช้ไม่สำเร็จ', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // 🔍 ฟิลเตอร์ตามช่องค้นหา (ค้นจาก username, displayName, email)
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers =
    normalizedSearch === ''
      ? users
      : users.filter((u) => {
          const username = (u.username || '').toLowerCase();
          const displayName = (u.displayName || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          return (
            username.includes(normalizedSearch) ||
            displayName.includes(normalizedSearch) ||
            email.includes(normalizedSearch)
          );
        });

  return (
    <div className="layout-main">
      <div className="layout-content">
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>คอนโซลสำหรับ Admin</h2>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                จัดการบทบาทผู้ใช้ ข้อมูลจากการสมัคร (ดึงจาก collection <code>"users"</code>)
              </p>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                *การลบบัญชีผู้ใช้จริงใน Firebase Authentication ต้องทำผ่านหน้า Console หรือ
                Cloud Functions เพิ่มเติม
              </p>
            </div>

            {/* 🔍 ช่องค้นหา username / ชื่อแสดง / email */}
            <div style={{ minWidth: '220px' }}>
              <input
                type="text"
                placeholder="ค้นหา username / ชื่อแสดง / อีเมล..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.9rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="center-full" style={{ minHeight: '120px' }}>
              <div className="loader" />
              <span className="muted">กำลังโหลดข้อมูลผู้ใช้...</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '26%' }}>UID</th>
                    <th style={{ width: '14%' }}>Username</th>
                    <th style={{ width: '16%' }}>ชื่อแสดง</th>
                    <th style={{ width: '22%' }}>อีเมล</th>
                    <th style={{ width: '10%' }}>บทบาท</th>
                    <th style={{ width: '12%' }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>
                        ไม่พบผู้ใช้ที่ตรงกับคำค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td className="mono">{u.uid || u.id}</td>
                        <td>{u.username || '-'}</td>
                        <td>{u.displayName || '-'}</td>
                        <td>{u.email || '-'}</td>
                        <td>
                          <select
                            value={u.role || 'user'}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={savingId === u.id}
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            disabled={deletingId === u.id}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.8rem',
                              background: 'var(--danger)',
                            }}
                          >
                            {deletingId === u.id ? 'กำลังลบ...' : 'ลบข้อมูล'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
