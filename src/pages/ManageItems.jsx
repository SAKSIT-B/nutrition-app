// src/pages/ManageItems.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';

// ค่าเริ่มต้นของชุดโภชนาการทั้งหมด
const EMPTY_NUTRIENTS = {
  energy: '',
  water: '',
  protein: '',
  fat: '',
  carb: '',
  fibre: '',
  ash: '',
  calcium: '',
  phosphorus: '',
  magnesium: '',
  sodium: '',
  potassium: '',
  iron: '',
  copper: '',
  zinc: '',
  iodine: '',
  betacarotene: '',
  retinol: '',
  vitaminA: '',
  thiamin: '',
  riboflavin: '',
  niacin: '',
  vitaminC: '',
  vitaminE: '',
  sugar: '',
  cholessterol: '',
};

// กลุ่มสารอาหารพร้อมไอคอน
const NUTRIENT_GROUPS = [
  {
    id: 'main',
    title: 'กลุ่มที่ 1 สารอาหารหลัก',
    icon: '🍽️',
    color: '#6366f1',
    fields: [
      { key: 'energy', label: 'Energy [kcal]', icon: '⚡' },
      { key: 'water', label: 'Water [g]', icon: '💧' },
      { key: 'protein', label: 'Protein [g]', icon: '🥩' },
      { key: 'fat', label: 'Fat [g]', icon: '🧈' },
      { key: 'carb', label: 'Carbohydrate [g]', icon: '🍚' },
      { key: 'fibre', label: 'Dietary fibre [g]', icon: '🌾' },
      { key: 'ash', label: 'Ash [g]', icon: 'ite' },
    ],
  },
  {
    id: 'minerals',
    title: 'กลุ่มที่ 2 แร่ธาตุ',
    icon: '💎',
    color: '#10b981',
    fields: [
      { key: 'calcium', label: 'Calcium [mg]', icon: '🦴' },
      { key: 'phosphorus', label: 'Phosphorus [mg]', icon: '🔬' },
      { key: 'magnesium', label: 'Magnesium [mg]', icon: '✨' },
      { key: 'sodium', label: 'Sodium [mg]', icon: '🧂' },
      { key: 'potassium', label: 'Potassium [mg]', icon: '🍌' },
      { key: 'iron', label: 'Iron [mg]', icon: '🔩' },
      { key: 'copper', label: 'Copper [mg]', icon: '🪙' },
      { key: 'zinc', label: 'Zinc [mg]', icon: '⚙️' },
      { key: 'iodine', label: 'Iodine [µg]', icon: '🌊' },
    ],
  },
  {
    id: 'vitamins',
    title: 'กลุ่มที่ 3 วิตามิน',
    icon: '💊',
    color: '#f59e0b',
    fields: [
      { key: 'betacarotene', label: 'Betacarotene [µg]', icon: '🥕' },
      { key: 'retinol', label: 'Retinol [µg]', icon: '👁️' },
      { key: 'vitaminA', label: 'Total Vitamin A (RAE) [µg]', icon: '🅰️' },
      { key: 'thiamin', label: 'Thiamin (B1) [mg]', icon: '1️⃣' },
      { key: 'riboflavin', label: 'Riboflavin (B2) [mg]', icon: '2️⃣' },
      { key: 'niacin', label: 'Niacin (B3) [mg]', icon: '3️⃣' },
      { key: 'vitaminC', label: 'Vitamin C [mg]', icon: '🍊' },
      { key: 'vitaminE', label: 'Vitamin E [mg]', icon: '🌻' },
    ],
  },
  {
    id: 'other',
    title: 'กลุ่มที่ 4 อื่น ๆ',
    icon: '📋',
    color: '#ec4899',
    fields: [
      { key: 'sugar', label: 'Sugar [g]', icon: '🍬' },
      { key: 'cholessterol', label: 'Cholesterol [mg]', icon: '❤️' },
    ],
  },
];

const ManageItems = () => {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchAll, setSearchAll] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    main: true,
    minerals: false,
    vitamins: false,
    other: false,
  });

  const [form, setForm] = useState({
    name: '',
    nameeng: '',
    description: '',
    category: '',
    nutrients: { ...EMPTY_NUTRIENTS },
  });

  const { showToast } = useToast();

  // -----------------------------
  // โหลดข้อมูลแบบ Realtime
  // -----------------------------
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'items'),
      (snapshot) => {
        let docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // เรียงตาม updatedAt ใน JavaScript แทน
        docs.sort((a, b) => {
          const ta =
            (a.updatedAt?.toMillis?.()) ||
            (a.createdAt?.toMillis?.()) ||
            0;
          const tb =
            (b.updatedAt?.toMillis?.()) ||
            (b.createdAt?.toMillis?.()) ||
            0;
          return tb - ta;
        });

        setItems(docs);
      },
      (error) => {
        console.error(error);
        showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // -----------------------------
  // จัดการโหมดแก้ไข / รีเซ็ตฟอร์ม
  // -----------------------------
  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      nameeng: item.nameeng || '',
      description: item.description || '',
      category: item.category || '',
      nutrients: { ...EMPTY_NUTRIENTS, ...(item.nutrients || {}) },
    });
    // เลื่อนขึ้นไปด้านบน
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`กำลังแก้ไข "${item.name}" ✏️`, 'info');
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      nameeng: '',
      description: '',
      category: '',
      nutrients: { ...EMPTY_NUTRIENTS },
    });
  };

  // Toggle nutrient group
  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Expand all groups
  const expandAllGroups = () => {
    setExpandedGroups({
      main: true,
      minerals: true,
      vitamins: true,
      other: true,
    });
  };

  // Collapse all groups
  const collapseAllGroups = () => {
    setExpandedGroups({
      main: false,
      minerals: false,
      vitamins: false,
      other: false,
    });
  };

  // -----------------------------
  // handle input ฟอร์ม
  // -----------------------------
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNutrientChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      nutrients: { ...prev.nutrients, [field]: value },
    }));
  };

  // -----------------------------
  // บันทึกข้อมูล (เพิ่ม / แก้ไข)
  // -----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('กรุณากรอกชื่อวัตถุดิบ / เมนู', 'error');
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const ref = doc(db, 'items', editingId);
        await updateDoc(ref, {
          ...form,
          updatedAt: serverTimestamp(),
        });
        showToast('อัพเดทข้อมูลสำเร็จ 🥗', 'success');
      } else {
        await addDoc(collection(db, 'items'), {
          ...form,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast('เพิ่มข้อมูลสำเร็จ ✨', 'success');
      }
      resetForm();
    } catch (e) {
      console.error(e);
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // ลบข้อมูล
  // -----------------------------
  const handleDelete = async (item) => {
    if (!window.confirm(`ต้องการลบ "${item.name}" ใช่ไหม?`)) return;
    try {
      await deleteDoc(doc(db, 'items', item.id));
      showToast('ลบข้อมูลสำเร็จ 🗑️', 'success');
    } catch (e) {
      console.error(e);
      showToast('ลบข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // -----------------------------
  // filter สำหรับช่องค้นหา
  // -----------------------------
  const filteredItems = useMemo(() => {
    const q = searchAll.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const nameeng = (item.nameeng || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return (
        name.includes(q) ||
        nameeng.includes(q) ||
        cat.includes(q) ||
        desc.includes(q)
      );
    });
  }, [items, searchAll]);

  // -----------------------------
  // render
  // -----------------------------
  return (
    <div className="card manage-items-page">
      {/* Header */}
      <div className="manage-header">
        <div className="manage-header-info">
          <h2 className="page-title">
            <span className="title-icon">📝</span>
            การเพิ่มและแก้ไขรายการวัตถุดิบ / เมนู
          </h2>
          <p className="card-subtitle">
            ข้อมูลคุณค่าทางโภชนาการต่อ 100 กรัม ตามหน่วยที่กำหนด (อัพเดท Realtime)
          </p>
        </div>
        <div className="manage-header-stats">
          <div className="header-stat">
            <span className="header-stat-value">{items.length}</span>
            <span className="header-stat-label">รายการทั้งหมด</span>
          </div>
        </div>
      </div>

      {/* แสดงสถานะแก้ไข */}
      {editingId && (
        <div className="editing-banner">
          <span className="editing-icon">✏️</span>
          <span>กำลังแก้ไข: <strong>{form.name}</strong></span>
          <button type="button" className="cancel-edit-btn" onClick={resetForm}>
            ✕ ยกเลิก
          </button>
        </div>
      )}

      {/* ฟอร์มกรอกข้อมูล */}
      <form onSubmit={handleSubmit} className="manage-form">
        <div className="form-section">
          <h3 className="form-section-title">
            <span>📋</span> ข้อมูลพื้นฐาน
          </h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🏷️</span>
                ชื่อวัตถุดิบ / เมนู (ภาษาไทย) *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="เช่น ก๋วยเตี๋ยว เส้นจันทน์ แห้ง"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔤</span>
                ชื่อวัตถุดิบ / เมนู (ภาษาอังกฤษ)
              </label>
              <input
                type="text"
                value={form.nameeng}
                onChange={(e) => handleChange('nameeng', e.target.value)}
                placeholder="ex. Noodle, rice, small size strip, dried"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📁</span>
                หมวด / ประเภท
              </label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="เช่น ธัญพืชและผลิตภัณฑ์ / อาหารจานเดียว"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📝</span>
                ข้อมูลเพิ่มเติม / หมายเหตุ
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* กลุ่มสารอาหาร */}
        <div className="form-section">
          <div className="form-section-header">
            <h3 className="form-section-title">
              <span>🧪</span> ข้อมูลสารอาหาร
            </h3>
            <div className="section-actions">
              <button type="button" className="section-btn" onClick={expandAllGroups}>
                📂 ขยายทั้งหมด
              </button>
              <button type="button" className="section-btn" onClick={collapseAllGroups}>
                📁 ยุบทั้งหมด
              </button>
            </div>
          </div>

          <div className="nutrient-groups">
            {NUTRIENT_GROUPS.map((group) => (
              <div key={group.id} className="nutrient-group-card">
                <button
                  type="button"
                  className="nutrient-group-header"
                  onClick={() => toggleGroup(group.id)}
                  style={{ '--group-color': group.color }}
                >
                  <span className="group-icon">{group.icon}</span>
                  <span className="group-title">{group.title}</span>
                  <span className={`group-toggle ${expandedGroups[group.id] ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </button>

                {expandedGroups[group.id] && (
                  <div className="nutrient-group-content">
                    <div className="nutrient-input-grid">
                      {group.fields.map((field) => (
                        <div key={field.key} className="nutrient-input-item">
                          <label>
                            <span className="nutrient-icon">{field.icon}</span>
                            {field.label}
                          </label>
                          <input
                            type="text"
                            value={form.nutrients[field.key]}
                            onChange={(e) => handleNutrientChange(field.key, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ปุ่ม Actions */}
        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="btn-spinner"></span>
                กำลังบันทึก...
              </>
            ) : editingId ? (
              <>
                <span>💾</span>
                บันทึกการแก้ไข
              </>
            ) : (
              <>
                <span>➕</span>
                เพิ่มรายการ
              </>
            )}
          </button>
          
          {editingId && (
            <button type="button" className="submit-btn secondary" onClick={resetForm}>
              <span>❌</span>
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>
      </form>

      <hr className="section-divider" />

      {/* ช่องค้นหาจากรายการทั้งหมด */}
      <div className="search-section">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder="ค้นหารายการทั้งหมดตามชื่อไทยและอังกฤษ / หมวด / หมายเหตุ..."
            value={searchAll}
            onChange={(e) => setSearchAll(e.target.value)}
            className="search-input"
          />
          {searchAll && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchAll('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* รายการทั้งหมด */}
      <div className="items-section">
        <h3 className="items-section-title">
          <span>📚</span>
          รายการทั้งหมด
          <span className="items-count">{filteredItems.length} รายการ</span>
        </h3>

        <div className="items-list">
          {filteredItems.map((item, index) => (
            <div 
              key={item.id} 
              className={`item-card ${editingId === item.id ? 'editing' : ''}`}
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              <div className="item-card-number">{index + 1}</div>
              
              <div className="item-card-info">
                <div className="item-card-name">{item.name}</div>
                <div className="item-card-nameeng">{item.nameeng || '-'}</div>
              </div>

              <div className="item-card-category">
                <span className="category-pill">
                  {item.category || 'ไม่มีหมวด'}
                </span>
              </div>

              <div className="item-card-nutrients">
                <span title="พลังงาน">⚡ {item.nutrients?.energy || 0}</span>
                <span title="โปรตีน">🥩 {item.nutrients?.protein || 0}</span>
                <span title="ไขมัน">🧈 {item.nutrients?.fat || 0}</span>
              </div>

              <div className="item-card-actions">
                <button
                  type="button"
                  className="action-btn edit"
                  onClick={() => startEdit(item)}
                  title="แก้ไข"
                >
                  ✏️ แก้ไข
                </button>
                <button
                  type="button"
                  className="action-btn delete"
                  onClick={() => handleDelete(item)}
                  title="ลบ"
                >
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}

          {!filteredItems.length && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>
              <div className="empty-hint">ลองค้นหาด้วยคำอื่น</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageItems;
