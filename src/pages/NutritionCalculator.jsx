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
    keys: [
      { key: 'energy', label: 'Energy [kcal]' },
      { key: 'water', label: 'Water [g]' },
      { key: 'protein', label: 'Protein [g]' },
      { key: 'fat', label: 'Fat [g]' },
      { key: 'carb', label: 'Carbohydrate total [g]' },
      { key: 'fibre', label: 'Dietary fibre (Crud fibre) [g]' },
      { key: 'ash', label: 'Ash [g]' },
    ],
  },
  {
    title: 'กลุ่มที่ 2 แร่ธาตุ (Minerals)',
    keys: [
      { key: 'calcium', label: 'Calcium [mg]' },
      { key: 'phosphorus', label: 'Phosphorus [mg]' },
      { key: 'magnesium', label: 'Magnesium [mg]' },
      { key: 'sodium', label: 'Sodium [mg]' },
      { key: 'potassium', label: 'Potassium [mg]' },
      { key: 'iron', label: 'Iron [mg]' },
      { key: 'copper', label: 'Copper [mg]' },
      { key: 'zinc', label: 'Zinc [mg]' },
      { key: 'iodine', label: 'Iodine [µg]' },
    ],
  },
  {
    title: 'กลุ่มที่ 3 วิตามิน (Vitamins)',
    keys: [
      { key: 'betacarotene', label: 'Betacarotene [µg]' },
      { key: 'retinol', label: 'Retinol [µg]' },
      { key: 'vitaminA', label: 'Total Vitamin A (RAE) [µg]' },
      { key: 'thiamin', label: 'Thiamin (B1) [mg]' },
      { key: 'riboflavin', label: 'Riboflavin (B2) [mg]' },
      { key: 'niacin', label: 'Niacin (B3) [mg]' },
      { key: 'vitaminC', label: 'Vitamin C [mg]' },
      { key: 'vitaminE', label: 'Vitamin E [mg]' },
    ],
  },
  {
    title: 'กลุ่มที่ 4 อื่น ๆ (Other)',
    keys: [
      { key: 'sugar', label: 'Sugar [g]' },
      { key: 'cholessterol', label: 'Cholessterol [mg]' },
    ],
  },
];

const NutritionCalculator = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [baseAmount] = useState(100);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { showToast } = useToast();
  const { user, role } = useAuth();

  // State สำหรับ Modal บันทึกสูตร
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // -----------------------------
  // 1) โหลดข้อมูลแบบ Realtime
  // -----------------------------
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('name'));
    
    // ใช้ onSnapshot แทน getDocs เพื่อให้เป็น realtime
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

    // Cleanup: ยกเลิก listener เมื่อ component unmount
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
  };

  const removeItem = (index) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAmount = (index, value) => {
    const num = Number(value) || 0;
    setSelected((prev) =>
      prev.map((s, i) => (i === index ? { ...s, amount: num } : s)),
    );
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
    showToast('Export Excel สำเร็จ', 'success');
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
      <h2 className="page-title">การคำนวณคุณค่าทางโภชนาการ</h2>
      <p className="card-subtitle">
        หน่วยข้อมูลโภชนาการมาตรฐานต่อ 100 กรัม (kcal, mg, µg, g)
      </p>

      {/* แถวค้นหา */}
      <div className="search-row">
        <input
          type="search"
          placeholder="ค้นหาชื่อวัตถุดิบ / เมนู / หมวด..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="nutrition-search-input"
        />
      </div>

      {/* ตัวกรองหมวด + ตัวเลือกจำนวนรายการต่อหน้า */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span>หมวด:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              fontSize: '0.85rem',
            }}
          >
            <option value="all">แสดงทุกหมวด</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
        >
          <span>แสดงต่อหน้า:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 10)}
            style={{
              padding: '4px 8px',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              fontSize: '0.85rem',
            }}
          >
            <option value={10}>10 รายการ</option>
            <option value={15}>15 รายการ</option>
            <option value={20}>20 รายการ</option>
            <option value={30}>30 รายการ</option>
          </select>
          <span style={{ color: 'var(--text-muted)' }}>
            ทั้งหมด {filteredItems.length} รายการ
          </span>
        </div>
      </div>

      <div className="calculator-layout">
        {/* ซ้าย: รายการวัตถุดิบ / เมนู */}
        <div className="item-list">
          {pagedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="item-row"
              onClick={() => addItem(item)}
            >
              <div className="item-main">
                <div className="item-name">{item.name}</div>
                {item.nameeng && (
                  <div className="item-nameeng">{item.nameeng}</div>
                )}
              </div>

              <div className="item-category-pill">
                {item.category || 'ไม่มีหมวดหมู่กำหนด'}
              </div>

              <div className="item-add">เพิ่ม</div>
            </button>
          ))}

          {!pagedItems.length && (
            <div style={{ padding: '8px 10px', fontSize: '0.85rem' }}>
              ไม่พบข้อมูลที่ตรงกับคำค้นหา
            </div>
          )}

          {filteredItems.length > pageSize && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                fontSize: '0.8rem',
              }}
            >
              <button
                type="button"
                onClick={goPrev}
                disabled={page === 1}
                className="pagination-btn"
              >
                ◀ ก่อนหน้า
              </button>
              <span>หน้า {page} / {totalPages}</span>
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
        <div>
          <h3 style={{ marginTop: 0 }}>รายการที่เลือกไว้</h3>

          <div className="selected-list">
            {selected.map((item, index) => (
              <div key={`${item.id}-${index}`} className="selected-row">
                <div className="selected-name">
                  <strong>{item.name}</strong>{' '}
                  {item.nameeng && (
                    <span className="item-nameeng">
                      {item.nameeng}
                    </span>
                  )}{' '}
                  <span className="item-meta">
                    ({item.category || 'ไม่มีหมวดหมู่'})
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={item.amount}
                  onChange={(e) =>
                    updateAmount(index, e.target.value)
                  }
                  style={{ width: 80 }}
                />
                <span className="item-meta">กรัม</span>
                <button type="button" onClick={() => removeItem(index)}>
                  ลบ
                </button>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>ผลรวมคุณค่าทางโภชนาการ</h3>
          <p className="muted">
            ปรับปริมาณกรัมของแต่ละวัตถุดิบด้านบน ผลรวมจะอัพเดตอัตโนมัติ
          </p>

          {NUTRIENT_GROUPS.map((group) => (
            <div key={group.title} style={{ marginTop: 12 }}>
              <h4 style={{ margin: '4px 0 8px' }}>{group.title}</h4>
              <div className="nutrient-grid">
                {group.keys.map((n) => (
                  <div key={n.key} className="nutrient-cell">
                    <div className="nutrient-label">{n.label}</div>
                    <div className="nutrient-value">
                      {totals[n.key] != null ? totals[n.key] : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button
              className="primary-btn"
              type="button"
              onClick={handleExport}
            >
              Export เป็น Excel
            </button>

            <button
              className="save-recipe-btn"
              type="button"
              onClick={() => setShowSaveModal(true)}
              disabled={selected.length === 0}
            >
              💾 บันทึกสูตร
            </button>
          </div>
        </div>
      </div>

      {/* Modal บันทึกสูตร */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              <label>
                ชื่อสูตร *
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="เช่น ก๋วยเตี๋ยวสุโขทัยเสริมโปรตีน"
                />
              </label>

              <label>
                รายละเอียด (ถ้ามี)
                <textarea
                  value={recipeDescription}
                  onChange={(e) => setRecipeDescription(e.target.value)}
                  placeholder="เช่น สูตรทดลองครั้งที่ 1"
                  rows={3}
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <span>🌐 แชร์เป็นสาธารณะ (ให้คนอื่นเห็นและใช้ได้)</span>
              </label>

              <div className="recipe-preview">
                <h4>รายการวัตถุดิบ ({selected.length} รายการ)</h4>
                <ul>
                  {selected.slice(0, 5).map((item, i) => (
                    <li key={i}>{item.name} - {item.amount} กรัม</li>
                  ))}
                  {selected.length > 5 && <li>...และอีก {selected.length - 5} รายการ</li>}
                </ul>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="cancel-btn"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={saving}
                  className="primary-btn"
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึกสูตร'}
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
