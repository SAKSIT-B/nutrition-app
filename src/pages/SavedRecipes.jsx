// src/pages/SavedRecipes.jsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  collection,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// Badge สำหรับแสดง role
const RoleBadge = ({ role }) => {
  const badges = {
    owner: { label: '👑 Owner', color: '#f59e0b' },
    admin: { label: '🛡️ Admin', color: '#3b82f6' },
    mod: { label: '⭐ Mod', color: '#8b5cf6' },
    user: { label: '👤 User', color: '#6b7280' },
  };
  const badge = badges[role] || badges.user;

  return (
    <span
      style={{
        fontSize: '0.7rem',
        padding: '2px 6px',
        borderRadius: '999px',
        backgroundColor: badge.color,
        color: 'white',
        marginLeft: '6px',
      }}
    >
      {badge.label}
    </span>
  );
};

const SavedRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [activeTab, setActiveTab] = useState('my'); // 'my' หรือ 'public'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  const { user, role } = useAuth();
  const { showToast } = useToast();

  // โหลดสูตรทั้งหมด
  const loadRecipes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRecipes(docs);
    } catch (e) {
      console.error(e);
      showToast('โหลดสูตรอาหารไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // กรองสูตร
  const filteredRecipes = useMemo(() => {
    let result = recipes;

    // กรองตาม tab
    if (activeTab === 'my') {
      result = result.filter((r) => r.createdBy?.uid === user?.uid);
    } else {
      result = result.filter((r) => r.isPublic === true);
    }

    // กรองตามคำค้นหา
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.createdBy?.displayName || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [recipes, activeTab, search, user]);

  // ลบสูตร
  const handleDelete = async (recipe) => {
    if (!window.confirm(`ต้องการลบสูตร "${recipe.name}" ใช่ไหม?`)) return;
    try {
      await deleteDoc(doc(db, 'recipes', recipe.id));
      showToast('ลบสูตรสำเร็จ', 'success');
      loadRecipes();
    } catch (e) {
      console.error(e);
      showToast('ลบสูตรไม่สำเร็จ', 'error');
    }
  };

  // เปลี่ยนสถานะ public/private
  const togglePublic = async (recipe) => {
    try {
      await updateDoc(doc(db, 'recipes', recipe.id), {
        isPublic: !recipe.isPublic,
      });
      showToast(
        recipe.isPublic ? 'เปลี่ยนเป็นส่วนตัวแล้ว' : 'เปลี่ยนเป็นสาธารณะแล้ว',
        'success'
      );
      loadRecipes();
    } catch (e) {
      console.error(e);
      showToast('เปลี่ยนสถานะไม่สำเร็จ', 'error');
    }
  };

  // Export สูตรเป็น Excel
  const handleExport = (recipe) => {
    const header = ['รายการ', ...recipe.items.map((s) => s.name)];
    const amountRow = ['ปริมาณ (กรัม)', ...recipe.items.map((s) => s.amount)];
    const rows = [header, amountRow];

    // เพิ่มข้อมูลสารอาหาร
    if (recipe.totalNutrients) {
      Object.entries(recipe.totalNutrients).forEach(([key, value]) => {
        rows.push([key, value]);
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Recipe');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `${recipe.name}.xlsx`
    );
    showToast('Export สำเร็จ', 'success');
  };

  // แปลงวันที่
  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="card">
      <h2 className="page-title">📖 สูตรอาหาร</h2>
      <p className="card-subtitle">บันทึกและจัดการสูตรอาหารของคุณ</p>

      {/* Tabs */}
      <div className="recipe-tabs">
        <button
          type="button"
          className={`recipe-tab ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          📂 สูตรของฉัน
        </button>
        <button
          type="button"
          className={`recipe-tab ${activeTab === 'public' ? 'active' : ''}`}
          onClick={() => setActiveTab('public')}
        >
          🌐 สูตรสาธารณะ
        </button>
      </div>

      {/* ค้นหา */}
      <div className="search-row">
        <input
          type="search"
          placeholder="ค้นหาสูตร..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="nutrition-search-input"
        />
      </div>

      {/* รายการสูตร */}
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>กำลังโหลด...</div>
      ) : filteredRecipes.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          {activeTab === 'my'
            ? 'ยังไม่มีสูตรที่บันทึกไว้ ไปที่หน้า "การคำนวณโภชนาการ" เพื่อสร้างและบันทึกสูตร'
            : 'ยังไม่มีสูตรสาธารณะ'}
        </div>
      ) : (
        <div className="recipe-list">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} className="recipe-card">
              <div className="recipe-header">
                <div className="recipe-title">
                  <h3>{recipe.name}</h3>
                  {recipe.isPublic ? (
                    <span className="recipe-badge public">🌐 สาธารณะ</span>
                  ) : (
                    <span className="recipe-badge private">🔒 ส่วนตัว</span>
                  )}
                </div>
                {recipe.description && (
                  <p className="recipe-description">{recipe.description}</p>
                )}
              </div>

              <div className="recipe-meta">
                <div className="recipe-author">
                  <span>👤 {recipe.createdBy?.displayName || 'ไม่ระบุ'}</span>
                  <RoleBadge role={recipe.createdBy?.role} />
                </div>
                <div className="recipe-date">
                  📅 {formatDate(recipe.createdAt)}
                </div>
              </div>

              <div className="recipe-summary">
                <span>🍽️ {recipe.items?.length || 0} วัตถุดิบ</span>
                <span>⚡ {recipe.totalNutrients?.energy || 0} kcal</span>
                <span>🥩 {recipe.totalNutrients?.protein || 0} g โปรตีน</span>
              </div>

              <div className="recipe-actions">
                <button
                  type="button"
                  onClick={() => setViewingRecipe(recipe)}
                  className="recipe-btn view"
                >
                  ดูรายละเอียด
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(recipe)}
                  className="recipe-btn export"
                >
                  Export
                </button>
                {recipe.createdBy?.uid === user?.uid && (
                  <>
                    <button
                      type="button"
                      onClick={() => togglePublic(recipe)}
                      className="recipe-btn toggle"
                    >
                      {recipe.isPublic ? '🔒 ซ่อน' : '🌐 แชร์'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(recipe)}
                      className="recipe-btn delete"
                    >
                      ลบ
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ดูรายละเอียด */}
      {viewingRecipe && (
        <div className="modal-overlay" onClick={() => setViewingRecipe(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingRecipe.name}</h3>
              <button
                type="button"
                onClick={() => setViewingRecipe(null)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {viewingRecipe.description && (
                <p className="recipe-description">คำอธิบาย:''{viewingRecipe.description}</p>
              )}

              <h4>วัตถุดิบ ({viewingRecipe.items?.length || 0} รายการ)</h4>
              <div className="recipe-items-list">
                {viewingRecipe.items?.map((item, index) => (
                  <div key={index} className="recipe-item">
                    <span>{item.name}</span>
                    <span>{item.amount} กรัม</span>
                  </div>
                ))}
              </div>

              <h4>คุณค่าทางโภชนาการรวม</h4>
              <div className="recipe-nutrients">
                <div className="nutrient-item">
                  <span>พลังงาน</span>
                  <span>{viewingRecipe.totalNutrients?.energy || 0} kcal</span>
                </div>
                <div className="nutrient-item">
                  <span>โปรตีน</span>
                  <span>{viewingRecipe.totalNutrients?.protein || 0} g</span>
                </div>
                <div className="nutrient-item">
                  <span>ไขมัน</span>
                  <span>{viewingRecipe.totalNutrients?.fat || 0} g</span>
                </div>
                <div className="nutrient-item">
                  <span>คาร์โบไฮเดรต</span>
                  <span>{viewingRecipe.totalNutrients?.carb || 0} g</span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => handleExport(viewingRecipe)}
                  className="primary-btn"
                >
                  Export เป็น Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedRecipes;
