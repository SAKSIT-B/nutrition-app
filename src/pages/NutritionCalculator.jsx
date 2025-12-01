// src/pages/NutritionCalculator.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

// กลุ่มสารอาหารที่ใช้ทั้งสำหรับแสดงผลรวม และ export Excel
const NUTRIENT_GROUPS = [
  {
    title: 'กลุ่มที่ 1 สารอาหารหลัก (Main nutrients)',
    icon: '🍽️',
    color: '#6366f1',
    keys: [
      { key: 'energy', label: 'Energy [kcal]', icon: '⚡' },
      { key: 'water', label: 'Water [g]', icon: '💧' },
      { key: 'protein', label: 'Protein [g]', icon: '🥩' },
      { key: 'fat', label: 'Fat [g]', icon: '🧈' },
      { key: 'carb', label: 'Carbohydrate total [g]', icon: '🍚' },
      { key: 'fibre', label: 'Dietary fibre (Crud fibre) [g]', icon: '🌾' },
      { key: 'ash', label: 'Ash [g]', icon: 'ite' },
    ],
  },
  {
    title: 'กลุ่มที่ 2 แร่ธาตุ (Minerals)',
    icon: '💎',
    color: '#10b981',
    keys: [
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
    title: 'กลุ่มที่ 3 วิตามิน (Vitamins)',
    icon: '💊',
    color: '#f59e0b',
    keys: [
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
    title: 'กลุ่มที่ 4 อื่น ๆ (Other)',
    icon: '📋',
    color: '#ec4899',
    keys: [
      { key: 'sugar', label: 'Sugar [g]', icon: '🍬' },
      { key: 'cholessterol', label: 'Cholessterol [mg]', icon: '❤️' },
    ],
  },
];

// Quick Stats Component
const QuickStats = ({ selected, totals }) => {
  const stats = [
    { label: 'พลังงาน', value: totals.energy || 0, unit: 'kcal', icon: '⚡', color: '#f59e0b' },
    { label: 'โปรตีน', value: totals.protein || 0, unit: 'g', icon: '🥩', color: '#ef4444' },
    { label: 'ไขมัน', value: totals.fat || 0, unit: 'g', icon: '🧈', color: '#eab308' },
    { label: 'คาร์โบไฮเดรต', value: totals.carb || 0, unit: 'g', icon: '🍚', color: '#22c55e' },
  ];

  if (selected.length === 0) return null;

  return (
    <div className="quick-stats">
      {stats.map((stat) => (
        <div key={stat.label} className="quick-stat-card" style={{ '--stat-color': stat.color }}>
          <div className="quick-stat-icon">{stat.icon}</div>
          <div className="quick-stat-info">
            <div className="quick-stat-value">
              {stat.value.toFixed(1)}
              <span className="quick-stat-unit">{stat.unit}</span>
            </div>
            <div className="quick-stat-label">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Empty State Component
const EmptyState = ({ type }) => {
  if (type === 'search') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-text">ไม่พบข้อมูลที่ตรงกับคำค้นหา</div>
        <div className="empty-state-hint">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนหมวดหมู่</div>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">🥗</div>
      <div className="empty-state-text">ยังไม่ได้เลือกวัตถุดิบ</div>
      <div className="empty-state-hint">คลิกที่รายการด้านซ้ายเพื่อเพิ่ม</div>
    </div>
  );
};

// Selected Item Card Component
const SelectedItemCard = ({ item, index, onUpdateAmount, onRemove }) => {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => onRemove(index), 300);
  };

  return (
    <div className={`selected-card ${isRemoving ? 'removing' : ''}`}>
      <div className="selected-card-header">
        <div className="selected-card-number">{index + 1}</div>
        <div className="selected-card-info">
          <div className="selected-card-name">{item.name}</div>
          {item.nameeng && (
            <div className="selected-card-nameeng">{item.nameeng}</div>
          )}
        </div>
        <button
          type="button"
          className="selected-card-remove"
          onClick={handleRemove}
          title="ลบรายการ"
        >
          ✕
        </button>
      </div>

      <div className="selected-card-body">
        <span className="selected-card-category">
          {item.category || 'ไม่มีหมวดหมู่'}
        </span>
        <div className="selected-card-amount">
          <input
            type="number"
            min="0"
            value={item.amount}
            onChange={(e) => onUpdateAmount(index, e.target.value)}
          />
          <span>กรัม</span>
        </div>
      </div>

      <div className="selected-card-nutrients">
        <span title="พลังงาน">⚡ {((item.nutrients?.energy || 0) * item.amount / 100).toFixed(1)}</span>
        <span title="โปรตีน">🥩 {((item.nutrients?.protein || 0) * item.amount / 100).toFixed(1)}</span>
        <span title="ไขมัน">🧈 {((item.nutrients?.fat || 0) * item.amount / 100).toFixed(1)}</span>
        <span title="คาร์โบไฮเดรต">🍚 {((item.nutrients?.carb || 0) * item.amount / 100).toFixed(1)}</span>
      </div>
    </div>
  );
};

// Nutrient Group Component
const NutrientGroup = ({ group, totals, isExpanded, onToggle }) => {
  return (
    <div className="nutrient-group">
      <button
        type="button"
        className="nutrient-group-header"
        onClick={onToggle}
        style={{ '--group-color': group.color }}
      >
        <span className="nutrient-group-icon">{group.icon}</span>
        <span className="nutrient-group-title">{group.title}</span>
        <span className={`nutrient-group-toggle ${isExpanded ? 'expanded' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="nutrient-group-content">
          <div className="nutrient-grid">
            {group.keys.map((n) => (
              <div key={n.key} className="nutrient-cell">
                <div className="nutrient-label">
                  <span className="nutrient-icon">{n.icon}</span>
                  {n.label}
                </div>
                <div className="nutrient-value">
                  {totals[n.key] != null ? totals[n.key] : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const NutritionCalculator = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [baseAmount] = useState(100);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [expandedGroups, setExpandedGroups] = useState({
    'กลุ่มที่ 1 สารอาหารหลัก (Main nutrients)': true,
    'กลุ่มที่ 2 แร่ธาตุ (Minerals)': true,
    'กลุ่มที่ 3 วิตามิน (Vitamins)': true,
    'กลุ่มที่ 4 อื่น ๆ (Other)': true,
  });

  const { showToast } = useToast();
  const { user, role } = useAuth();

  // State สำหรับ Modal บันทึกสูตร
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // Animation state
  const [recentlyAdded, setRecentlyAdded] = useState(null);

  // -----------------------------
  // 1) โหลดข้อมูลแบบ Realtime
  // -----------------------------
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('name'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);
      },
      (error) => {
        console.error(error);
        showToast('โหลดข้อมูลวัตถุดิบไม่สำเร็จ', 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // -----------------------------
  // 2) ดึงรายการหมวด (category)
  // -----------------------------
  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [items]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, pageSize]);

  // -----------------------------
  // 3) จัดการรายการที่เลือก
  // -----------------------------
  const addItem = (item) => {
    setSelected((prev) => [
      ...prev,
      {
        id: item.id,
        name: item.name,
        nameeng: item.nameeng,
        category: item.category || '',
        amount: 100,
        nutrients: item.nutrients || {},
      },
    ]);

    // Animation feedback
    setRecentlyAdded(item.id);
    setTimeout(() => setRecentlyAdded(null), 500);

    showToast(`เพิ่ม "${item.name}" แล้ว`, 'success');
  };

  const removeItem = (index) => {
    const removedName = selected[index]?.name;
    setSelected((prev) => prev.filter((_, i) => i !== index));
    showToast(`ลบ "${removedName}" แล้ว`, 'info');
  };

  const updateAmount = (index, value) => {
    const num = Number(value) || 0;
    setSelected((prev) =>
      prev.map((s, i) => (i === index ? { ...s, amount: num } : s)),
    );
  };

  const clearAll = () => {
    if (selected.length === 0) return;
    if (window.confirm('ต้องการล้างรายการทั้งหมดใช่ไหม?')) {
      setSelected([]);
      showToast('ล้างรายการทั้งหมดแล้ว', 'info');
    }
  };

  // Toggle nutrient group
  const toggleGroup = (title) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // -----------------------------
  // 4) รวมค่าสารอาหาร
  // -----------------------------
  const totals = useMemo(() => {
    const result = {};
    NUTRIENT_GROUPS.forEach((g) =>
      g.keys.forEach((n) => {
        result[n.key] = 0;
      }),
    );

    selected.forEach((item) => {
      const ratio = item.amount / 100;
      const nutrients = item.nutrients || {};
      Object.keys(result).forEach((key) => {
        const raw = Number(nutrients[key]) || 0;
        result[key] += raw * ratio;
      });
    });

    Object.keys(result).forEach((k) => {
      result[k] = Number(result[k].toFixed(2));
    });

    return result;
  }, [selected]);

  // -----------------------------
  // 5) filter ตามคำค้น + หมวด
  // -----------------------------
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((i) => {
      const name = (i.name || '').toLowerCase();
      const nameeng = (i.nameeng || '').toLowerCase();
      const cat = (i.category || '').toLowerCase();

      const matchSearch =
        !q || name.includes(q) || nameeng.includes(q) || cat.includes(q);

      const matchCategory =
        categoryFilter === 'all' || i.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [items, search, categoryFilter]);

  // -----------------------------
  // 6) แบ่งหน้า (pagination)
  // -----------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / pageSize || 1),
  );
  const startIndex = (page - 1) * pageSize;
  const pagedItems = filteredItems.slice(
    startIndex,
    startIndex + pageSize,
  );

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  // -----------------------------
  // 7) Export Excel
  // -----------------------------
  const handleExport = () => {
    if (!selected.length) {
      showToast('ยังไม่มีรายการที่เลือก', 'error');
      return;
    }

    const header = ['รายการ', ...selected.map((s) => s.name)];
    const amountRow = ['ปริมาณ (กรัม)', ...selected.map((s) => s.amount)];

    const rows = [header, amountRow];

    NUTRIENT_GROUPS.forEach((group) => {
      group.keys.forEach((n) => {
        const row = [n.label];
        selected.forEach((item) => {
          const ratio = item.amount / 100;
          const raw = Number(item.nutrients?.[n.key]) || 0;
          row.push(Number((raw * ratio).toFixed(2)));
        });
        rows.push(row);
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Nutrition');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      'nutrition.xlsx',
    );
    showToast('Export Excel สำเร็จ 📊', 'success');
  };

  // -----------------------------
  // 8) บันทึกสูตรอาหาร
  // -----------------------------
  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      showToast('กรุณาตั้งชื่อสูตร', 'error');
      return;
    }
    if (selected.length === 0) {
      showToast('กรุณาเลือกวัตถุดิบอย่างน้อย 1 รายการ', 'error');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'recipes'), {
        name: recipeName.trim(),
        description: recipeDescription.trim(),
        isPublic: isPublic,
        items: selected.map((item) => ({
          id: item.id,
          name: item.name,
          nameeng: item.nameeng || '',
          category: item.category || '',
          amount: item.amount,
          nutrients: item.nutrients || {},
        })),
        totalNutrients: { ...totals },
        createdBy: {
          uid: user?.uid || '',
          displayName: user?.displayName || user?.email || 'ไม่ระบุ',
          role: role || 'user',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast('บันทึกสูตรสำเร็จ! 🎉', 'success');
      setShowSaveModal(false);
      setRecipeName('');
      setRecipeDescription('');
      setIsPublic(false);
    } catch (e) {
      console.error(e);
      showToast('บันทึกสูตรไม่สำเร็จ', 'error');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------
  // 9) JSX แสดงผล
  // -----------------------------
  return (
    <div className="card nutrition-panel">
      {/* Header */}
      <div className="nutrition-header">
        <div className="nutrition-header-info">
          <h2 className="page-title">
            <span className="title-icon">🧮</span>
            การคำนวณคุณค่าทางโภชนาการ
          </h2>
          <p className="card-subtitle">
            หน่วยข้อมูลโภชนาการมาตรฐานต่อ 100 กรัม (kcal, mg, µg, g)
          </p>
        </div>
        <div className="nutrition-header-stats">
          <div className="header-stat">
            <span className="header-stat-value">{items.length}</span>
            <span className="header-stat-label">รายการทั้งหมด</span>
          </div>
          <div className="header-stat">
            <span className="header-stat-value">{selected.length}</span>
            <span className="header-stat-label">เลือกแล้ว</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats selected={selected} totals={totals} />

      {/* แถวค้นหา */}
      <div className="search-row">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder="ค้นหาชื่อวัตถุดิบ / เมนู / หมวด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nutrition-search-input"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ตัวกรองหมวด + ตัวเลือกจำนวนรายการต่อหน้า */}
      <div className="filter-row">
        <div className="filter-left">
          <span className="filter-label">หมวด:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">🏷️ แสดงทุกหมวด</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-right">
          <span className="filter-label">แสดง:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 10)}
            className="filter-select"
          >
            <option value={10}>10 รายการ</option>
            <option value={15}>15 รายการ</option>
            <option value={20}>20 รายการ</option>
            <option value={30}>30 รายการ</option>
          </select>
          <span className="filter-count">
            พบ {filteredItems.length} รายการ
          </span>
        </div>
      </div>

      <div className="calculator-layout">
        {/* ซ้าย: รายการวัตถุดิบ / เมนู */}
        <div className="item-list-container">
          <div className="item-list-header">
            <h3>📋 รายการวัตถุดิบ</h3>
          </div>

          <div className="item-list">
            {pagedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`item-row ${recentlyAdded === item.id ? 'just-added' : ''}`}
                onClick={() => addItem(item)}
              >
                <div className="item-main">
                  <div className="item-name">{item.name}</div>
                  {item.nameeng && (
                    <div className="item-nameeng">{item.nameeng}</div>
                  )}
                </div>

                <div className="item-category-pill">
                  {item.category || 'ไม่มีหมวด'}
                </div>

                <div className="item-add">
                  <span className="item-add-icon">+</span>
                  <span className="item-add-text">เพิ่ม</span>
                </div>
              </button>
            ))}

            {!pagedItems.length && <EmptyState type="search" />}
          </div>

          {/* Pagination */}
          {filteredItems.length > pageSize && (
            <div className="pagination">
              <button
                type="button"
                onClick={goPrev}
                disabled={page === 1}
                className="pagination-btn"
              >
                ◀ ก่อนหน้า
              </button>
              <span className="pagination-info">
                หน้า <strong>{page}</strong> / {totalPages}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                ถัดไป ▶
              </button>
            </div>
          )}
        </div>

        {/* ขวา: รายการที่เลือก + ผลรวม */}
        <div className="selected-container">
          {/* Header */}
          <div className="selected-header">
            <h3>
              <span>🛒</span> รายการที่เลือก
              {selected.length > 0 && (
                <span className="selected-count">{selected.length}</span>
              )}
            </h3>
            {selected.length > 0 && (
              <button
                type="button"
                className="clear-all-btn"
                onClick={clearAll}
              >
                🗑️ ล้างทั้งหมด
              </button>
            )}
          </div>

          {/* Selected Items */}
          <div className="selected-list">
            {selected.length === 0 ? (
              <EmptyState type="selected" />
            ) : (
              selected.map((item, index) => (
                <SelectedItemCard
                  key={`${item.id}-${index}`}
                  item={item}
                  index={index}
                  onUpdateAmount={updateAmount}
                  onRemove={removeItem}
                />
              ))
            )}
          </div>

          {/* Nutrient Summary */}
          {selected.length > 0 && (
            <>
              <div className="nutrient-summary-header">
                <h3>📊 ผลรวมคุณค่าทางโภชนาการ</h3>
                <p className="muted">
                  ปรับปริมาณกรัมของแต่ละวัตถุดิบด้านบน ผลรวมจะอัพเดตอัตโนมัติ
                </p>
              </div>

              {NUTRIENT_GROUPS.map((group) => (
                <NutrientGroup
                  key={group.title}
                  group={group}
                  totals={totals}
                  isExpanded={expandedGroups[group.title]}
                  onToggle={() => toggleGroup(group.title)}
                />
              ))}

              {/* Action Buttons */}
              <div className="action-buttons">
                <button
                  className="action-btn export-btn"
                  type="button"
                  onClick={handleExport}
                >
                  <span className="action-btn-icon">📥</span>
                  <span>Export Excel</span>
                </button>

                <button
                  className="action-btn save-btn"
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  disabled={selected.length === 0}
                >
                  <span className="action-btn-icon">💾</span>
                  <span>บันทึกสูตร</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal บันทึกสูตร */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content save-recipe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💾 บันทึกสูตรอาหาร</h3>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <label className="form-label">
                <span className="label-text">ชื่อสูตร *</span>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="เช่น ก๋วยเตี๋ยวสุโขทัยเสริมโปรตีน"
                  className="form-input"
                />
              </label>

              <label className="form-label">
                <span className="label-text">รายละเอียด (ถ้ามี)</span>
                <textarea
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  placeholder="เช่น สูตรทดลองครั้งที่ 1"
                  rows={3}
                  className="form-input"
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span className="checkbox-text">
                  🌐 แชร์เป็นสาธารณะ (ให้คนอื่นเห็นและใช้ได้)
                </span>
              </label>

              <div className="recipe-preview">
                <h4>🥗 รายการวัตถุดิบ ({selected.length} รายการ)</h4>
                <ul>
                  {selected.slice(0, 5).map((item, i) => (
                    <li key={i}>
                      <span className="preview-name">{item.name}</span>
                      <span className="preview-amount">{item.amount} กรัม</span>
                    </li>
                  ))}
                  {selected.length > 5 && (
                    <li className="preview-more">...และอีก {selected.length - 5} รายการ</li>
                  )}
                </ul>

                <div className="preview-summary">
                  <span>⚡ {totals.energy} kcal</span>
                  <span>🥩 {totals.protein} g</span>
                  <span>🧈 {totals.fat} g</span>
                  <span>🍚 {totals.carb} g</span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="btn-cancel"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกสูตร'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NutritionCalculator;
