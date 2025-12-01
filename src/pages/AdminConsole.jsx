// src/pages/AdminConsole.jsx
import React, { useEffect, useState, useMemo } from 'react'
import { db } from '../firebase'
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { useAuth, ALL_PERMISSIONS } from '../contexts/AuthContext'

// ===========================================
// Role Badge Component
// ===========================================
const RoleBadge = ({ roleData, size = 'normal' }) => {
  if (!roleData) return <span className="role-badge">ไม่ทราบ</span>

  const style = {
    backgroundColor: roleData.color || '#6b7280',
    color: 'white',
    padding: size === 'small' ? '2px 6px' : '4px 10px',
    borderRadius: '999px',
    fontSize: size === 'small' ? '0.7rem' : '0.8rem',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  }

  return (
    <span style={style}>
      <span>{roleData.icon}</span>
      <span>{roleData.name}</span>
    </span>
  )
}

// ===========================================
// Main AdminConsole Component
// ===========================================
const AdminConsole = () => {
  const { user, role, roleData, allRoles, hasPermission, refreshRoles } = useAuth()

  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // State สำหรับ Role Editor
  const [editingRole, setEditingRole] = useState(null)
  const [showRoleModal, setShowRoleModal] = useState(false)

  const canManageRoles = hasPermission('manage-roles')
  const canAccessAdmin = hasPermission('admin')

  // โหลด Users แบบ Realtime
  useEffect(() => {
    if (!canAccessAdmin) return

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setUsers(list)
        setLoading(false)
      },
      (error) => {
        console.error('โหลด users ล้มเหลว:', error)
        setLoading(false)
      }
    )

    return () => unsubUsers()
  }, [canAccessAdmin])

  // โหลด Roles แบบ Realtime
  useEffect(() => {
    if (!canAccessAdmin) return

    const unsubRoles = onSnapshot(
      collection(db, 'roles'),
      (snapshot) => {
        const rolesData = {}
        snapshot.docs.forEach((d) => {
          rolesData[d.id] = { id: d.id, ...d.data() }
        })
        setRoles(rolesData)
      },
      (error) => {
        console.error('โหลด roles ล้มเหลว:', error)
      }
    )

    return () => unsubRoles()
  }, [canAccessAdmin])

  // หา priority ของ current user
  const myPriority = useMemo(() => {
    return roleData?.priority || 0
  }, [roleData])

  // ตรวจสอบว่าจัดการ user นี้ได้ไหม
  const canManageUser = (targetUser) => {
    if (!user) return false
    if (user.uid === targetUser.id) return false // ห้ามจัดการตัวเอง

    const targetRoleData = roles[targetUser.role] || allRoles[targetUser.role]
    const targetPriority = targetRoleData?.priority || 0

    return myPriority > targetPriority
  }

  // ตรวจสอบว่าจัดการ role นี้ได้ไหม
  const canManageRole = (targetRole) => {
    if (!canManageRoles) return false
    const targetPriority = targetRole?.priority || 0
    return myPriority > targetPriority
  }

  // รายการ roles ที่สามารถกำหนดให้ user ได้
  const assignableRoles = useMemo(() => {
    const combined = { ...allRoles, ...roles }
    return Object.values(combined)
      .filter((r) => (r.priority || 0) < myPriority)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }, [roles, allRoles, myPriority])

  // เปลี่ยน role ของ user
  const handleChangeRole = async (targetUser, newRole) => {
    if (!canManageUser(targetUser)) return

    try {
      setSaving(true)
      await updateDoc(doc(db, 'users', targetUser.id), { role: newRole })
    } catch (err) {
      console.error('เปลี่ยน role ล้มเหลว:', err)
      alert('เปลี่ยนบทบาทไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // ลบ user
  const handleDeleteUser = async (targetUser) => {
    if (!canManageUser(targetUser)) return
    if (!window.confirm(`ยืนยันลบผู้ใช้ "${targetUser.displayName || targetUser.email}" ?`)) return

    try {
      setSaving(true)
      await deleteDoc(doc(db, 'users', targetUser.id))
    } catch (err) {
      console.error('ลบ user ล้มเหลว:', err)
      alert('ลบผู้ใช้ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // บันทึก Role
  const handleSaveRole = async (roleId, roleDataToSave) => {
    try {
      setSaving(true)
      await setDoc(doc(db, 'roles', roleId), roleDataToSave)
      await refreshRoles()
      setShowRoleModal(false)
      setEditingRole(null)
    } catch (err) {
      console.error('บันทึก role ล้มเหลว:', err)
      alert('บันทึกบทบาทไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // ลบ Role
  const handleDeleteRole = async (roleId) => {
    const targetRole = roles[roleId]
    if (!canManageRole(targetRole)) return
    if (targetRole?.isSystem) {
      alert('ไม่สามารถลบบทบาทระบบได้')
      return
    }
    if (!window.confirm(`ยืนยันลบบทบาท "${targetRole?.name}" ?`)) return

    try {
      setSaving(true)
      await deleteDoc(doc(db, 'roles', roleId))
      await refreshRoles()
    } catch (err) {
      console.error('ลบ role ล้มเหลว:', err)
      alert('ลบบทบาทไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // กรอง users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users

    return users.filter((u) => {
      const text = `${u.username || ''} ${u.displayName || ''} ${u.email || ''} ${u.role || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [users, search])

  // เรียง roles ตาม priority
  const sortedRoles = useMemo(() => {
    const combined = { ...allRoles, ...roles }
    return Object.values(combined).sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }, [roles, allRoles])

  // Render
  if (!canAccessAdmin) {
    return (
      <div className="center-full">
        <div className="error-icon">🚫</div>
        <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="center-full">
        <div className="loader" />
        <p>กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div className="card admin-console">
      <h2 className="page-title">⚙️ คอนโซลสำหรับ Admin</h2>
      <p className="card-subtitle">
        จัดการผู้ใช้และบทบาท • บทบาทของคุณ: <RoleBadge roleData={roleData} size="small" />
      </p>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 จัดการผู้ใช้
        </button>
        {canManageRoles && (
          <button
            type="button"
            className={`admin-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            🎭 จัดการบทบาท
          </button>
        )}
      </div>

      {/* ==================== Tab: Users ==================== */}
      {activeTab === 'users' && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <input
              type="search"
              placeholder="🔍 ค้นหาผู้ใช้..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="admin-search"
            />
            <span className="admin-count">ทั้งหมด {filteredUsers.length} คน</span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ผู้ใช้</th>
                  <th>อีเมล</th>
                  <th>บทบาท</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const userRoleData = roles[u.role] || allRoles[u.role]
                  const canManage = canManageUser(u)
                  const isSelf = user?.uid === u.id

                  return (
                    <tr key={u.id} className={isSelf ? 'row-self' : ''}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div className="user-info">
                            <div className="user-name">
                              {u.displayName || u.username || 'ไม่ระบุชื่อ'}
                              {isSelf && <span className="self-badge">คุณ</span>}
                            </div>
                            <div className="user-uid">{u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{u.email || '-'}</td>
                      <td>
                        {canManage ? (
                          <select
                            value={u.role || 'user'}
                            onChange={(e) => handleChangeRole(u, e.target.value)}
                            disabled={saving}
                            className="role-select"
                            style={{ borderColor: userRoleData?.color }}
                          >
                            {assignableRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.icon} {r.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge roleData={userRoleData} />
                        )}
                      </td>
                      <td>
                        {canManage ? (
                          <button
                            type="button"
                            className="btn-delete"
                            onClick={() => handleDeleteUser(u)}
                            disabled={saving}
                          >
                            🗑️ ลบ
                          </button>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== Tab: Roles ==================== */}
      {activeTab === 'roles' && canManageRoles && (
        <div className="admin-section">
          <div className="admin-toolbar">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingRole({
                  id: '',
                  name: '',
                  color: '#6366f1',
                  icon: '🏷️',
                  priority: 20,
                  permissions: ['nutrition', 'thai-rdi', 'recipes', 'compare'],
                  isSystem: false,
                  isNew: true,
                })
                setShowRoleModal(true)
              }}
            >
              ➕ สร้างบทบาทใหม่
            </button>
          </div>

          <div className="roles-grid">
            {sortedRoles.map((r) => {
              const canEdit = canManageRole(r)

              return (
                <div
                  key={r.id}
                  className={`role-card ${canEdit ? '' : 'role-card-locked'}`}
                  style={{ borderColor: r.color }}
                >
                  <div className="role-card-header" style={{ backgroundColor: r.color }}>
                    <span className="role-card-icon">{r.icon}</span>
                    <span className="role-card-name">{r.name}</span>
                    {r.isSystem && <span className="system-badge">ระบบ</span>}
                  </div>

                  <div className="role-card-body">
                    <div className="role-meta">
                      <span>Priority: {r.priority}</span>
                      <span>•</span>
                      <span>{r.permissions?.length || 0} สิทธิ์</span>
                    </div>

                    <div className="role-permissions">
                      {r.permissions?.slice(0, 4).map((p) => {
                        const permData = ALL_PERMISSIONS.find((x) => x.id === p)
                        return (
                          <span key={p} className="permission-chip" title={permData?.name}>
                            {permData?.icon || '•'}
                          </span>
                        )
                      })}
                      {(r.permissions?.length || 0) > 4 && (
                        <span className="permission-chip more">
                          +{r.permissions.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="role-card-actions">
                      <button
                        type="button"
                        className="btn-edit"
                        onClick={() => {
                          setEditingRole({ ...r, isNew: false })
                          setShowRoleModal(true)
                        }}
                      >
                        ✏️ แก้ไข
                      </button>
                      {!r.isSystem && (
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDeleteRole(r.id)}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="roles-info">
            <p>💡 <strong>Priority</strong> = ลำดับความสำคัญ (สูงกว่าจัดการต่ำกว่าได้)</p>
            <p>🔒 บทบาทระบบ (owner, admin, mod, user) ไม่สามารถลบได้</p>
          </div>
        </div>
      )}

      {/* ==================== Role Editor Modal ==================== */}
      {showRoleModal && editingRole && (
        <RoleEditorModal
          role={editingRole}
          myPriority={myPriority}
          onSave={handleSaveRole}
          onClose={() => {
            setShowRoleModal(false)
            setEditingRole(null)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// ===========================================
// Role Editor Modal Component
// ===========================================
const RoleEditorModal = ({ role, myPriority, onSave, onClose, saving }) => {
  const [formData, setFormData] = useState({
    id: role.id || '',
    name: role.name || '',
    color: role.color || '#6366f1',
    icon: role.icon || '🏷️',
    priority: role.priority || 20,
    permissions: role.permissions || [],
    isSystem: role.isSystem || false,
  })

  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: null }))
  }

  const togglePermission = (permId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }))
  }

  const handleSubmit = () => {
    const newErrors = {}

    // Validation
    if (!formData.id.trim()) {
      newErrors.id = 'กรุณากรอก ID'
    } else if (!/^[a-z0-9-]+$/.test(formData.id)) {
      newErrors.id = 'ID ต้องเป็นตัวอักษรพิมพ์เล็ก ตัวเลข หรือ - เท่านั้น'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'กรุณากรอกชื่อ'
    }

    if (formData.priority >= myPriority) {
      newErrors.priority = `Priority ต้องน้อยกว่า ${myPriority}`
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Save
    const dataToSave = {
      name: formData.name.trim(),
      color: formData.color,
      icon: formData.icon,
      priority: Number(formData.priority),
      permissions: formData.permissions,
      isSystem: formData.isSystem,
    }

    onSave(formData.id.toLowerCase().trim(), dataToSave)
  }

  const iconOptions = ['👑', '🛡️', '⭐', '👤', '🎭', '🏷️', '💎', '🔥', '⚡', '🌟', '🎯', '🚀', '💼', '🎨', '🔧', '📚', '🎓', '🏆']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content role-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{role.isNew ? '➕ สร้างบทบาทใหม่' : `✏️ แก้ไข ${role.name}`}</h3>
          <button type="button" onClick={onClose} className="modal-close">✕</button>
        </div>

        <div className="modal-body">
          {/* Preview */}
          <div className="role-preview">
            <span
              className="role-preview-badge"
              style={{ backgroundColor: formData.color }}
            >
              {formData.icon} {formData.name || 'ชื่อบทบาท'}
            </span>
          </div>

          {/* ID */}
          <div className="form-group">
            <label>ID (ภาษาอังกฤษ พิมพ์เล็ก)</label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => handleChange('id', e.target.value.toLowerCase())}
              placeholder="เช่น vip, tester, researcher"
              disabled={!role.isNew || role.isSystem}
              className={errors.id ? 'input-error' : ''}
            />
            {errors.id && <span className="error-text">{errors.id}</span>}
          </div>

          {/* Name */}
          <div className="form-group">
            <label>ชื่อแสดง</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="เช่น VIP, ผู้ทดสอบ, นักวิจัย"
              className={errors.name ? 'input-error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          {/* Icon & Color */}
          <div className="form-row">
            <div className="form-group">
              <label>ไอคอน</label>
              <div className="icon-picker">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`icon-option ${formData.icon === icon ? 'active' : ''}`}
                    onClick={() => handleChange('icon', icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>สี</label>
              <div className="color-picker">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  placeholder="#6366f1"
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div className="form-group">
            <label>Priority (ลำดับความสำคัญ: 1-{myPriority - 1})</label>
            <input
              type="number"
              min="1"
              max={myPriority - 1}
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className={errors.priority ? 'input-error' : ''}
            />
            {errors.priority && <span className="error-text">{errors.priority}</span>}
            <span className="help-text">ยิ่งสูงยิ่งมีอำนาจมาก</span>
          </div>

          {/* Permissions */}
          <div className="form-group">
            <label>สิทธิ์การเข้าถึง</label>
            <div className="permissions-grid">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm.id} className="permission-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                  />
                  <span className="permission-icon">{perm.icon}</span>
                  <span className="permission-name">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-cancel">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminConsole
