// src/pages/CompareRecipes.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// รายการสารอาหารที่ต้องการเปรียบเทียบ
const COMPARE_NUTRIENTS = [
  { key: 'energy', label: 'พลังงาน', unit: 'kcal', group: 'main' },
  { key: 'protein', label: 'โปรตีน', unit: 'g', group: 'main' },
  { key: 'fat', label: 'ไขมัน', unit: 'g', group: 'main' },
  { key: 'carb', label: 'คาร์โบไฮเดรต', unit: 'g', group: 'main' },
  { key: 'fibre', label: 'ใยอาหาร', unit: 'g', group: 'main' },
  { key: 'sugar', label: 'น้ำตาล', unit: 'g', group: 'main' },
  { key: 'sodium', label: 'โซเดียม', unit: 'mg', group: 'mineral' },
  { key: 'calcium', label: 'แคลเซียม', unit: 'mg', group: 'mineral' },
  { key: 'iron', label: 'เหล็ก', unit: 'mg', group: 'mineral' },
  { key: 'phosphorus', label: 'ฟอสฟอรัส', unit: 'mg', group: 'mineral' },
  { key: 'zinc', label: 'สังกะสี', unit: 'mg', group: 'mineral' },
  { key: 'vitaminA', label: 'วิตามิน A', unit: 'µg', group: 'vitamin' },
  { key: 'vitaminC', label: 'วิตามิน C', unit: 'mg', group: 'vitamin' },
  { key: 'vitaminE', label: 'วิตามิน E', unit: 'mg', group: 'vitamin' },
  { key: 'thiamin', label: 'วิตามิน B1', unit: 'mg', group: 'vitamin' },
  { key: 'riboflavin', label: 'วิตามิน B2', unit: 'mg', group: 'vitamin' },
  { key: 'niacin', label: 'ไนอะซิน', unit: 'mg', group: 'vitamin' },
];

const CompareRecipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [highlightMode, setHighlightMode] = useState('high'); // 'high', 'low', 'none'

  const { user } = useAuth();
  const { showToast } = useToast();

  // โหลดสูตรแบบ Realtime
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'recipes'),
      (snapshot) => {
        let docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        
        // เรียงตาม createdAt
        docs.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });

        setRecipes(docs);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        showToast('โหลดสูตรไม่สำเร็จ', 'error');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // กรองสูตรที่แสดงในรายการเลือก
  const availableRecipes = useMemo(() => {
    let result = recipes.filter(
      (r) => r.isPublic || r.createdBy?.uid === user?.uid
    );

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          (r.name || '').toLowerCase().includes(q) ||
          (r.createdBy?.displayName || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [recipes, search, user]);

  // สูตรที่ถูกเลือก
  const selectedRecipes = useMemo(() => {
    return selectedIds
      .map((id) => recipes.find((r) => r.id === id))
      .filter(Boolean);
  }, [selectedIds, recipes]);

  // เลือก/ยกเลิกสูตร
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 4) {
        showToast('เลือกได้สูงสุด 4 สูตร', 'error');
        return prev;
      }
      return [...prev, id];
    });
  };

  // ล้างการเลือกทั้งหมด
  const clearSelection = () => {
    setSelectedIds([]);
  };

  // หาค่าสูงสุด/ต่ำสุดของแต่ละ nutrient
  const getMinMax = (key) => {
    const values = selectedRecipes
      .map((r) => Number(r.totalNutrients?.[key]) || 0)
      .filter((v) => v > 0);
    
    if (values.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  // ตรวจสอบว่าค่านี้เป็น min หรือ max
  const getCellClass = (key, value) => {
    if (highlightMode === 'none' || selectedRecipes.length < 2) return '';
    
    const numValue = Number(value) || 0;
    if (numValue === 0) return '';
    
    const { min, max } = getMinMax(key);
    
    if (highlightMode === 'high' && numValue === max && max > min) {
      return 'highlight-high';
    }
    if (highlightMode === 'low' && numValue === min && min < max) {
      return 'highlight-low';
    }
    
    return '';
  };

  // Export เป็น Excel
  const handleExport = () => {
    if (selectedRecipes.length < 2) {
      showToast('กรุณาเลือกอย่างน้อย 2 สูตร', 'error');
      return;
    }

    const rows = [];
    
    // Header row
    rows.push(['สารอาหาร', 'หน่วย', ...selectedRecipes.map((r) => r.name)]);
    
    // Data rows
    COMPARE_NUTRIENTS.forEach((nutrient) => {
      const row = [nutrient.label, nutrient.unit];
      selectedRecipes.forEach((recipe) => {
        row.push(Number(recipe.totalNutrients?.[nutrient.key]) || 0);
      });
      rows.push(row);
    });

    // สรุปวัตถุดิบ
    rows.push([]);
    rows.push(['จำนวนวัตถุดิบ', 'รายการ', ...selectedRecipes.map((r) => r.items?.length || 0)]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // กำหนดความกว้างคอลัมน์
    ws['!cols'] = [
      { wch: 15 },
      { wch: 8 },
      ...selectedRecipes.map(() => ({ wch: 20 })),
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Compare');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([wbout], { type: 'application/octet-stream' }),
      `compare-recipes-${Date.now()}.xlsx`
    );
    showToast('Export สำเร็จ', 'success');
  };

  // จัดกลุ่ม nutrients
  const groupedNutrients = useMemo(() => {
    return {
      main: COMPARE_NUTRIENTS.filter((n) => n.group === 'main'),
      mineral: COMPARE_NUTRIENTS.filter((n) => n.group === 'mineral'),
      vitamin: COMPARE_NUTRIENTS.filter((n) => n.group === 'vitamin'),
    };
  }, []);

  return (
    <div className="card">
      <h2 className="page-title">📊 เปรียบเทียบสูตร</h2>
      <p className="card-subtitle">เลือกสูตร 2-4 ตัวเพื่อเปรียบเทียบคุณค่าทางโภชนาการ</p>

      <div className="compare-layout">
        {/* ซ้าย: เลือกสูตร */}
        <div className="compare-sidebar">
          <div className="compare-sidebar-header">
            <h3>เลือกสูตร ({selectedIds.length}/4)</h3>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="clear-btn"
              >
                ล้างทั้งหมด
              </button>
            )}
          </div>

          <div className="search-row">
            <input
              type="search"
              placeholder="ค้นหาสูตร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nutrition-search-input"
            />
          </div>

          <div className="compare-recipe-list">
            {loading ? (
              <div className="loading-text">กำลังโหลด...</div>
            ) : availableRecipes.length === 0 ? (
              <div className="empty-text">ไม่พบสูตร</div>
            ) : (
              availableRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={`compare-recipe-item ${
                    selectedIds.includes(recipe.id) ? 'selected' : ''
                  }`}
                  onClick={() => toggleSelect(recipe.id)}
                >
                  <div className="compare-recipe-checkbox">
                    {selectedIds.includes(recipe.id) ? '✓' : ''}
                  </div>
                  <div className="compare-recipe-info">
                    <div className="compare-recipe-name">{recipe.name}</div>
                    <div className="compare-recipe-meta">
                      <span>{recipe.items?.length || 0} วัตถุดิบ</span>
                      <span>•</span>
                      <span>{recipe.totalNutrients?.energy || 0} kcal</span>
                      {recipe.isPublic && <span className="public-badge">🌐</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ขวา: ตารางเปรียบเทียบ */}
        <div className="compare-main">
          {selectedRecipes.length < 2 ? (
            <div className="compare-placeholder">
              <div className="placeholder-icon">📊</div>
              <div className="placeholder-text">
                เลือกอย่างน้อย 2 สูตรจากรายการด้านซ้าย<br />
                เพื่อเริ่มเปรียบเทียบ
              </div>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="compare-controls">
                <div className="highlight-toggle">
                  <span>ไฮไลท์:</span>
                  <button
                    type="button"
                    className={`toggle-btn ${highlightMode === 'high' ? 'active' : ''}`}
                    onClick={() => setHighlightMode('high')}
                  >
                    🔼 ค่าสูงสุด
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${highlightMode === 'low' ? 'active' : ''}`}
                    onClick={() => setHighlightMode('low')}
                  >
                    🔽 ค่าต่ำสุด
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${highlightMode === 'none' ? 'active' : ''}`}
                    onClick={() => setHighlightMode('none')}
                  >
                    ไม่ไฮไลท์
                  </button>
                </div>
                <button
                  type="button"
                  className="export-btn"
                  onClick={handleExport}
                >
                  📥 Export Excel
                </button>
              </div>

              {/* ตารางเปรียบเทียบ */}
              <div className="compare-table-wrapper">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th className="nutrient-col">สารอาหาร</th>
                      <th className="unit-col">หน่วย</th>
                      {selectedRecipes.map((recipe) => (
                        <th key={recipe.id} className="recipe-col">
                          <div className="recipe-header">
                            <span className="recipe-name">{recipe.name}</span>
                            <button
                              type="button"
                              className="remove-recipe-btn"
                              onClick={() => toggleSelect(recipe.id)}
                              title="นำออก"
                            >
                              ✕
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* สารอาหารหลัก */}
                    <tr className="group-header">
                      <td colSpan={2 + selectedRecipes.length}>
                        🍽️ สารอาหารหลัก
                      </td>
                    </tr>
                    {groupedNutrients.main.map((nutrient) => (
                      <tr key={nutrient.key}>
                        <td className="nutrient-col">{nutrient.label}</td>
                        <td className="unit-col">{nutrient.unit}</td>
                        {selectedRecipes.map((recipe) => {
                          const value = Number(recipe.totalNutrients?.[nutrient.key]) || 0;
                          return (
                            <td
                              key={recipe.id}
                              className={`value-col ${getCellClass(nutrient.key, value)}`}
                            >
                              {value.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* แร่ธาตุ */}
                    <tr className="group-header">
                      <td colSpan={2 + selectedRecipes.length}>
                        💎 แร่ธาตุ
                      </td>
                    </tr>
                    {groupedNutrients.mineral.map((nutrient) => (
                      <tr key={nutrient.key}>
                        <td className="nutrient-col">{nutrient.label}</td>
                        <td className="unit-col">{nutrient.unit}</td>
                        {selectedRecipes.map((recipe) => {
                          const value = Number(recipe.totalNutrients?.[nutrient.key]) || 0;
                          return (
                            <td
                              key={recipe.id}
                              className={`value-col ${getCellClass(nutrient.key, value)}`}
                            >
                              {value.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* วิตามิน */}
                    <tr className="group-header">
                      <td colSpan={2 + selectedRecipes.length}>
                        💊 วิตามิน
                      </td>
                    </tr>
                    {groupedNutrients.vitamin.map((nutrient) => (
                      <tr key={nutrient.key}>
                        <td className="nutrient-col">{nutrient.label}</td>
                        <td className="unit-col">{nutrient.unit}</td>
                        {selectedRecipes.map((recipe) => {
                          const value = Number(recipe.totalNutrients?.[nutrient.key]) || 0;
                          return (
                            <td
                              key={recipe.id}
                              className={`value-col ${getCellClass(nutrient.key, value)}`}
                            >
                              {value.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* สรุป */}
                    <tr className="group-header">
                      <td colSpan={2 + selectedRecipes.length}>
                        📋 สรุป
                      </td>
                    </tr>
                    <tr>
                      <td className="nutrient-col">จำนวนวัตถุดิบ</td>
                      <td className="unit-col">รายการ</td>
                      {selectedRecipes.map((recipe) => (
                        <td key={recipe.id} className="value-col">
                          {recipe.items?.length || 0}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="compare-legend">
                {highlightMode === 'high' && (
                  <span className="legend-item">
                    <span className="legend-color high"></span>
                    ค่าสูงสุด
                  </span>
                )}
                {highlightMode === 'low' && (
                  <span className="legend-item">
                    <span className="legend-color low"></span>
                    ค่าต่ำสุด
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompareRecipes;
