// src/pages/NutritionCalculator.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

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
      { key: 'thiamin', label: 'Thiamin [mg]' },
      { key: 'riboflavin', label: 'Riboflavin [mg]' },
      { key: 'niacin', label: 'Niacin [mg]' },
      { key: 'vitaminC', label: 'Vitamin C [mg]' },
      { key: 'vitaminE', label: 'Vitamin E [mg]' },
    ],
  },
];

const NutritionCalculator = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [baseAmount, setBaseAmount] = useState(100); // กี่กรัมที่ต้องการคำนวณ
  const { showToast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'items'));
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);
      } catch (e) {
        console.error(e);
        showToast('โหลดข้อมูลวัตถุดิบไม่สำเร็จ', 'error');
      }
    };
    load();
  }, [showToast]);

  const addItem = (item) => {
    setSelected((prev) => [
      ...prev,
      {
        id: item.id,
        name: item.name,
        nameeng: item.nameeng,
        category: item.category || '',
        amount: 100, // เริ่มต้นที่ 100 กรัม
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

  // รวมค่าสารอาหารตามปริมาณที่กรอก
  const totals = useMemo(() => {
    const result = {};
    NUTRIENT_GROUPS.forEach((g) =>
      g.keys.forEach((n) => {
        result[n.key] = 0;
      }),
    );

    selected.forEach((item) => {
      const ratio = item.amount / 100; // ข้อมูลพื้นฐานต่อ 100 กรัม
      const nutrients = item.nutrients || {};
      Object.keys(result).forEach((key) => {
        const raw = Number(nutrients[key]) || 0;
        result[key] += raw * ratio;
      });
    });

    // ปัดทศนิยม 2 ตำแหน่ง
    Object.keys(result).forEach((k) => {
      result[k] = Number(result[k].toFixed(2));
    });

    return result;
  }, [selected]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const name = (i.name || '').toLowerCase();
      const nameeng = (i.nameeng || '').toLowerCase();
      const cat = (i.category || '').toLowerCase();
      return name.includes(q) || nameeng.includes(q) || cat.includes(q);
    });
  }, [items, search]);

  const handleExport = () => {
    if (!selected.length) {
      showToast('ยังไม่มีรายการที่เลือก', 'error');
      return;
    }

    // แถวที่ 1: ชื่อเมนู/วัตถุดิบ
    // แถวที่ 2: ปริมาณ (กรัม)
    // แถวที่ 3 เป็นต้นไป: สารอาหารแต่ละตัว
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
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), 'nutrition.xlsx');
    showToast('Export Excel สำเร็จ', 'success');
  };

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

      <div className="calculator-layout">
        {/* ซ้าย: รายการวัตถุดิบ / เมนู */}
        <div className="item-list">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="item-row"
              onClick={() => addItem(item)}
            >
              <div className="item-name">{item.name}</div>
              <div className="item-nameeng">{item.nameeng}</div>
              <div className="item-meta">
                {item.category || 'ไม่มีหมวดหมู่กำหนด'}
              </div>
              <div className="item-add">เพิ่ม</div>
            </button>
          ))}
          {!filteredItems.length && (
            <div style={{ padding: '8px 10px', fontSize: '0.85rem' }}>
              ไม่พบข้อมูลที่ตรงกับคำค้นหา
            </div>
          )}
        </div>

        {/* ขวา: รายการที่เลือก + ผลรวม */}
        <div>
          <h3 style={{ marginTop: 0 }}>รายการที่เลือกไว้</h3>

          {selected.map((item, index) => (
            <div key={`${item.id}-${index}`} className="selected-row">
              <div className="selected-name">
                <strong>{item.name}</strong>{' '}
                <strong>{item.nameeng}</strong>{' '}
                <span className="item-meta">
                  ({item.category || 'ไม่มีหมวดหมู่'})
                </span>
              </div>
              <input
                type="number"
                min="0"
                value={item.amount}
                onChange={(e) => updateAmount(index, e.target.value)}
                style={{ width: 80 }}
              />
              <span className="item-meta">กรัม</span>
              <button type="button" onClick={() => removeItem(index)}>
                ลบ
              </button>
            </div>
          ))}

          {/* ผลรวมแบบแยก 3 กลุ่ม */}
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

          <button className="primary-btn" type="button" onClick={handleExport}>
            Export เป็น Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default NutritionCalculator;



