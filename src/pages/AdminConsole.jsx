import React, { useEffect, useMemo, useState } from 'react';
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
  const [editingId, setEditingId] = useState(null);

  // 🔍 search
  const [searchTerm, setSearchTerm] = useState('');

  // โหลด users
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

  // หาว่าคนที่ล็อกอินตอนนี้คือใคร และมี role อะไร
  const myUser = useMemo(() => {
    if (!currentUser) return undefined;
    return (
      users.find((u) => u.uid === currentUser.uid) ||
      users.find((u) => u.id === currentUser.uid) ||
      users.find((u) => u.email === currentUser.email)
    );
  }, [users, currentUser]);

  const myRole = myUser?.role || 'user';

  // กติกาสิทธิ์แต่ละแถว
  function getRowPermissions(targetUser) {
    const targetRole = targetUser.role || 'user';
    const isSelf =
      currentUser &&
      (targetUser.uid === currentUser.uid ||
        targetUser.id === currentUser.uid ||
        targetUser.email === currentUser.email);

    // เริ่มต้นค่า default
    let canChangeRole = false;
    let canDelete = false;
    let canEditProfile = false;

    // ห้ามยุ่งกับ owner แถวไหนก็ตาม (เปลี่ยน role / ลบ ไม่ได้)
    if (targetRole === 'owner') {
      // owner ยังสามารถแก้ไขข้อมูลแสดงผล (displayName/email) ได้
      if (myRole === 'owner') {
        canEditProfile = true;
      }
      return { canChangeRole: false, canDelete: false, canEditProfile, isSelf };
    }

    // ป้องกันลบตัวเองเสมอ
    if (isSelf) {
      canDelete = false;
      canChangeRole = false;
    }

    if (myRole === 'owner') {
      // owner ทำได้กับทุกคน ยกเว้น owner ด้วยกันเอง (ด้านบนปิดไว้แล้ว)
      if (!isSelf) {
        canChangeRole = true;
        canDelete = true;
      }
      canEditProfile = true; // owner แก้ข้อมูลแสดงผลได้ทุกคน (รวมตัวเอง)
    } else if (myRole === 'admin') {
      // admin จัดการได้เฉพาะ mod + user
      if (!isSelf && (targetRole === 'mod' || targetRole === 'user')) {
        canChangeRole = true;
        canDelete = true;
      }
      // admin แก้ข้อมูลแสดงผลไม่ได้ (ตามที่ครูขอให้ owner เท่านั้น)
      canEditProfile = false;
    } else if (myRole === 'mod') {
      // mod จัดการได้เฉพาะ user เท่านั้น
      if (!isSelf && targetRole === 'user') {
        canChangeRole = true;
        canDelete = true;
      }
      canEditProfile = false;
    } else {
      // user ปกติ ไม่มีสิทธิ์อะไร
      canChangeRole = false;
      canDelete = false;
      canEditProfile = false;
    }

    return { canChangeRole, canDelete, canEditProfile, isSelf };
  }

  // เปลี่ยน role (ตามสิทธิ์)
  const handleRoleChange = async (userId, newRole) => {
    try {
      const target = users.find((u) => u.id === userId);
      if (!target) return;

      const { canChangeRole } = getRowPermissions(target);

      if (!canChangeRole) {
        showToast('คุณไม่มีสิทธิ์เปลี่ยนบทบาทของผู้ใช้นี้', 'error');
        return;
      }

      // ไม่อนุญาตให้ตั้ง role = owner ผ่านหน้าเว็บ
      if (newRole === 'owner') {
        showToast('บทบาท owner ต้องตั้งจาก Firebase Console เท่านั้น', 'error');
        return;
      }

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

  // ลบผู้ใช้
  const handleDelete = async (userId) => {
    try {
      const target = users.find((u) => u.id === userId);
      if (!target) return;

      const { canDelete, isSelf } = getRowPermissions(target);

      if (isSelf) {
        showToast('ไม่สามารถลบบัญชีของตัวเองได้', 'error');
        return;
      }

      if (!canDelete) {
        showToast('คุณไม่มีสิทธิ์ลบผู้ใช้นี้', 'error');
        return;
      }

      if (!window.confirm('ต้องการลบข้อมูลผู้ใช้นี้ออกจากระบบหรือไม่')) return;

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

  // owner แก้ไขข้อมูลแสดงผล (displayName + email)
  const handleEditProfile = async (userId) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const { canEditProfile } = getRowPermissions(target);
    if (!canEditProfile) {
      showToast('อนุญาตให้ owner เท่านั้นที่จะแก้ไขข้อมูลแสดงผล', 'error');
      return;
    }

    try {
      setEditingId(userId);

      const newDisplayName = window.prompt(
        'แก้ไขชื่อที่แสดง (Display name)',
        target.displayName || ''
      );
      if (newDisplayName === null) {
        setEditingId(null);
        return; // กดยกเลิก
      }

      const newEmail = window.prompt(
        'แก้ไขอีเมล (เฉพาะในตารางนี้ ไม่ได้เปลี่ยนอีเมลที่ใช้ล็อกอินจริงใน Firebase Authentication)',
        target.email || ''
      );
      if (newEmail === null) {
        setEditingId(null);
        return;
      }

      await updateDoc(doc(db, 'users', userId), {
        displayName: newDisplayName,
        email: newEmail,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, displayName: newDisplayName, email: newEmail } : u
        )
      );

      showToast('อัปเดตข้อมูลผู้ใช้สำเร็จ', 'success');
    } catch (e) {
      console.error('Edit profile error:', e);
      showToast('อัปเดตข้อมูลผู้ใช้ไม่สำเร็จ', 'error');
    } finally {
      setEditingId(null);
    }
  };

  // 🔍 ฟิลเตอร์รายการตาม search
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
                *การลบ/แก้ไขบัญชีใน Firebase Authentication จริง
                ยังต้องทำผ่าน Firebase Console หรือ Cloud Functions เพิ่มเติม
              </p>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                บทบาทปัจจุบันของคุณ: <strong>{myRole}</strong>
              </p>
            </div>

            {/* search box */}
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
                    <th style={{ width: '24%' }}>UID</th>
                    <th style={{ width: '14%' }}>Username</th>
                    <th style={{ width: '16%' }}>ชื่อแสดง</th>
                    <th style={{ width: '22%' }}>อีเมล</th>
                    <th style={{ width: '9%' }}>บทบาท</th>
                    <th style={{ width: '15%' }}>จัดการ</th>
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
                    filteredUsers.map((u) => {
                      const perms = getRowPermissions(u);
                      const roleValue = u.role || 'user';

                      return (
                        <tr key={u.id}>
                          <td className="mono">{u.uid || u.id}</td>
                          <td>{u.username || '-'}</td>
                          <td>{u.displayName || '-'}</td>
                          <td>{u.email || '-'}</td>
                          <td>
                            {/* เลือกบทบาท */}
                            {roleValue === 'owner' ? (
                              <select value="owner" disabled>
                                <option value="owner">owner</option>
                              </select>
                            ) : (
                              <select
                                value={roleValue}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                disabled={savingId === u.id || !perms.canChangeRole}
                              >
                                <option value="admin">admin</option>
                                <option value="mod">mod</option>
                                <option value="user">user</option>
                              </select>
                            )}
                          </td>
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                              }}
                            >
                              {/* ปุ่มแก้ไขข้อมูล (เฉพาะ owner) */}
                              {perms.canEditProfile && (
                                <button
                                  type="button"
                                  onClick={() => handleEditProfile(u.id)}
                                  disabled={editingId === u.id}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    fontSize: '0.8rem',
                                    background: 'var(--primary)',
                                  }}
                                >
                                  {editingId === u.id ? 'กำลังแก้ไข...' : 'แก้ไขข้อมูล'}
                                </button>
                              )}

                              {/* ปุ่มลบข้อมูล */}
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id)}
                                disabled={deletingId === u.id || !perms.canDelete}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '999px',
                                  fontSize: '0.8rem',
                                  background: 'var(--danger)',
                                  opacity: perms.canDelete ? 1 : 0.6,
                                  cursor: perms.canDelete ? 'pointer' : 'default',
                                }}
                              >
                                {deletingId === u.id ? 'กำลังลบ...' : 'ลบข้อมูล'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
