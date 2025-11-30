// src/pages/ThaiRDICalculator.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';
import html2canvas from 'html2canvas';

// ค่า Thai RDI อ้างอิงตามประกาศกระทรวงสาธารณสุข ฉบับที่ 445 (พ.ศ. 2567)
// ฐานพลังงาน 2,000 kcal/วัน สำหรับคนไทยอายุ 6 ปีขึ้นไป
const THAI_RDI = {
  energy: 2000,
  protein: 60,
  fat: 65,
  saturatedFat: 20,
  carb: 300,
  fibre: 25,
  sugar: 65,
  sodium: 2300,
  calcium: 800,
  iron: 15,
  vitaminA: 800,
  vitaminC: 100,
  vitaminE: 15,
  thiamin: 1.2,
  riboflavin: 1.4,
  niacin: 16,
  phosphorus: 1000,
  zinc: 10,
};

const ThaiRDICalculator = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [servingSize, setServingSize] = useState(100);
  const [servingsPerContainer, setServingsPerContainer] = useState(1);
  const [labelType, setLabelType] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const labelRef = useRef(null);
  const { showToast } = useToast();

  // -----------------------------
  // โหลดข้อมูลแบบ Realtime
  // -----------------------------
  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('name'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);
      },
      (error) => {
        console.error(error);
        showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // ดึงรายการหมวด
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

  // จัดการรายการที่เลือก
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
      prev.map((s, i) => (i === index ? { ...s, amount: num } : s))
    );
  };

  // คำนวณค่าสารอาหารรวม
  const totals = useMemo(() => {
    const result = {
      energy: 0,
      protein: 0,
      fat: 0,
      saturatedFat: 0,
      carb: 0,
      fibre: 0,
      sugar: 0,
      sodium: 0,
      calcium: 0,
      iron: 0,
      vitaminA: 0,
      vitaminC: 0,
      vitaminE: 0,
      thiamin: 0,
      riboflavin: 0,
      niacin: 0,
      phosphorus: 0,
      zinc: 0,
    };

    selected.forEach((item) => {
      const ratio = item.amount / 100;
      const n = item.nutrients || {};
      result.energy += (Number(n.energy) || 0) * ratio;
      result.protein += (Number(n.protein) || 0) * ratio;
      result.fat += (Number(n.fat) || 0) * ratio;
      result.saturatedFat += (Number(n.saturatedFat) || 0) * ratio;
      result.carb += (Number(n.carb) || 0) * ratio;
      result.fibre += (Number(n.fibre) || 0) * ratio;
      result.sugar += (Number(n.sugar) || 0) * ratio;
      result.sodium += (Number(n.sodium) || 0) * ratio;
      result.calcium += (Number(n.calcium) || 0) * ratio;
      result.iron += (Number(n.iron) || 0) * ratio;
      result.vitaminA += (Number(n.vitaminA) || 0) * ratio;
      result.vitaminC += (Number(n.vitaminC) || 0) * ratio;
      result.vitaminE += (Number(n.vitaminE) || 0) * ratio;
      result.thiamin += (Number(n.thiamin) || 0) * ratio;
      result.riboflavin += (Number(n.riboflavin) || 0) * ratio;
      result.niacin += (Number(n.niacin) || 0) * ratio;
      result.phosphorus += (Number(n.phosphorus) || 0) * ratio;
      result.zinc += (Number(n.zinc) || 0) * ratio;
    });

    return result;
  }, [selected]);

  // คำนวณต่อหน่วยบริโภค
  const perServing = useMemo(() => {
    const totalWeight = selected.reduce((sum, item) => sum + item.amount, 0);
    if (totalWeight === 0) return totals;

    const ratio = servingSize / totalWeight;
    const result = {};
    Object.keys(totals).forEach((key) => {
      result[key] = Number((totals[key] * ratio).toFixed(2));
    });
    return result;
  }, [totals, servingSize, selected]);

  // คำนวณ %RDI
  const calcRDI = (value, rdi) => {
    if (!rdi || !value) return 0;
    return Math.round((value / rdi) * 100);
  };

  // กรองรายการ
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const name = (i.name || '').toLowerCase();
      const nameeng = (i.nameeng || '').toLowerCase();
      const cat = (i.category || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || nameeng.includes(q) || cat.includes(q);
      const matchCategory = categoryFilter === 'all' || i.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [items, search, categoryFilter]);

  // แบ่งหน้า
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize || 1));
  const startIndex = (page - 1) * pageSize;
  const pagedItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  // Export รูปภาพ
  const handleExport = async (format) => {
    if (!labelRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(labelRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `nutrition-label.${format}`;
      link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`);
      link.click();
      showToast(`Export ${format.toUpperCase()} สำเร็จ`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Export ไม่สำเร็จ', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card">
      <h2 className="page-title">ฉลากโภชนาการ (Thai RDI)</h2>
      <p className="card-subtitle">
        คำนวณและสร้างฉลากโภชนาการตามมาตรฐาน Thai RDI (อัพเดท Realtime)
      </p>

      <div className="rdi-calculator-layout">
        {/* ซ้าย: เลือกวัตถุดิบ */}
        <div>
          <div className="search-row">
            <input
              type="search"
              placeholder="ค้นหาวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nutrition-search-input"
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid var(--border)' }}
            >
              <option value="all">ทุกหมวด</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

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
                  {item.nameeng && <div className="item-nameeng">{item.nameeng}</div>}
                </div>
                <div className="item-add">เพิ่ม</div>
              </button>
            ))}

            {filteredItems.length > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.8rem' }}>
                <button type="button" onClick={goPrev} disabled={page === 1} className="pagination-btn">◀</button>
                <span>{page}/{totalPages}</span>
                <button type="button" onClick={goNext} disabled={page === totalPages} className="pagination-btn">▶</button>
              </div>
            )}
          </div>

          <h4 style={{ marginTop: '16px' }}>รายการที่เลือก</h4>
          {selected.length === 0 ? (
            <p className="muted">ยังไม่ได้เลือกวัตถุดิบ</p>
          ) : (
            <div className="selected-list">
              {selected.map((item, index) => (
                <div key={`${item.id}-${index}`} className="selected-row">
                  <span>{item.name}</span>
                  <input
                    type="number"
                    min="0"
                    value={item.amount}
                    onChange={(e) => updateAmount(index, e.target.value)}
                    style={{ width: 60 }}
                  />
                  <span className="item-meta">g</span>
                  <button type="button" onClick={() => removeItem(index)}>ลบ</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              หนึ่งหน่วยบริโภค (กรัม)
              <input
                type="number"
                min="1"
                value={servingSize}
                onChange={(e) => setServingSize(Number(e.target.value) || 100)}
                style={{ width: 80, marginLeft: '8px' }}
              />
            </label>
            <label style={{ display: 'block' }}>
              จำนวนหน่วยบริโภคต่อภาชนะ
              <input
                type="number"
                min="1"
                value={servingsPerContainer}
                onChange={(e) => setServingsPerContainer(Number(e.target.value) || 1)}
                style={{ width: 80, marginLeft: '8px' }}
              />
            </label>
          </div>
        </div>

        {/* ขวา: ฉลากโภชนาการ */}
        <div>
          <div className="label-type-toggle">
            <span>รูปแบบฉลาก:</span>
            <div className="toggle-buttons">
              <button
                type="button"
                className={`toggle-btn ${labelType === 'full' ? 'active' : ''}`}
                onClick={() => setLabelType('full')}
              >
                แบบเต็ม
              </button>
              <button
                type="button"
                className={`toggle-btn ${labelType === 'gda' ? 'active' : ''}`}
                onClick={() => setLabelType('gda')}
              >
                แบบ GDA
              </button>
            </div>
          </div>

          <div ref={labelRef}>
            {labelType === 'full' ? (
              <div className="nutrition-label">
                <div className="label-header">
                  <div className="label-title">ข้อมูลโภชนาการ</div>
                  <div className="label-title-en">Nutrition Information</div>
                </div>
                <div className="label-serving">
                  หนึ่งหน่วยบริโภค: {servingSize} กรัม<br />
                  จำนวนหน่วยบริโภคต่อภาชนะ: {servingsPerContainer}
                </div>
                <div className="label-divider thick"></div>
                <div className="label-row header">
                  <span>คุณค่าทางโภชนาการต่อหนึ่งหน่วยบริโภค</span>
                  <span>%Thai RDI*</span>
                </div>
                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>พลังงานทั้งหมด {perServing.energy} กิโลแคลอรี</span>
                  <span>{calcRDI(perServing.energy, THAI_RDI.energy)}%</span>
                </div>
                <div className="label-row">
                  <span>ไขมันทั้งหมด {perServing.fat} ก.</span>
                  <span>{calcRDI(perServing.fat, THAI_RDI.fat)}%</span>
                </div>
                <div className="label-row indent">
                  <span>ไขมันอิ่มตัว {perServing.saturatedFat} ก.</span>
                  <span>{calcRDI(perServing.saturatedFat, THAI_RDI.saturatedFat)}%</span>
                </div>
                <div className="label-row">
                  <span>โปรตีน {perServing.protein} ก.</span>
                  <span>{calcRDI(perServing.protein, THAI_RDI.protein)}%</span>
                </div>
                <div className="label-row">
                  <span>คาร์โบไฮเดรตทั้งหมด {perServing.carb} ก.</span>
                  <span>{calcRDI(perServing.carb, THAI_RDI.carb)}%</span>
                </div>
                <div className="label-row indent">
                  <span>ใยอาหาร {perServing.fibre} ก.</span>
                  <span>{calcRDI(perServing.fibre, THAI_RDI.fibre)}%</span>
                </div>
                <div className="label-row indent">
                  <span>น้ำตาล {perServing.sugar} ก.</span>
                  <span>{calcRDI(perServing.sugar, THAI_RDI.sugar)}%</span>
                </div>
                <div className="label-row">
                  <span>โซเดียม {perServing.sodium} มก.</span>
                  <span>{calcRDI(perServing.sodium, THAI_RDI.sodium)}%</span>
                </div>
                <div className="label-divider"></div>

                <div className="label-vitamins-grid">
                  <div className="label-vitamin">
                    <span>วิตามินเอ</span>
                    <span>{calcRDI(perServing.vitaminA, THAI_RDI.vitaminA)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>วิตามินซี</span>
                    <span>{calcRDI(perServing.vitaminC, THAI_RDI.vitaminC)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>วิตามินอี</span>
                    <span>{calcRDI(perServing.vitaminE, THAI_RDI.vitaminE)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>วิตามินบี 1</span>
                    <span>{calcRDI(perServing.thiamin, THAI_RDI.thiamin)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>วิตามินบี 2</span>
                    <span>{calcRDI(perServing.riboflavin, THAI_RDI.riboflavin)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>ไนอะซิน</span>
                    <span>{calcRDI(perServing.niacin, THAI_RDI.niacin)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>แคลเซียม</span>
                    <span>{calcRDI(perServing.calcium, THAI_RDI.calcium)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>เหล็ก</span>
                    <span>{calcRDI(perServing.iron, THAI_RDI.iron)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>ฟอสฟอรัส</span>
                    <span>{calcRDI(perServing.phosphorus, THAI_RDI.phosphorus)}%</span>
                  </div>
                  <div className="label-vitamin">
                    <span>สังกะสี</span>
                    <span>{calcRDI(perServing.zinc, THAI_RDI.zinc)}%</span>
                  </div>
                </div>

                <div className="label-footer">
                  * ร้อยละของปริมาณที่แนะนำต่อวัน (Thai RDI)<br />
                  สำหรับคนไทยอายุ 6 ปีขึ้นไป (พลังงาน 2,000 กิโลแคลอรี)
                </div>
              </div>
            ) : (
              <div className="gda-label">
                <div className="gda-header">
                  พลังงาน และสารอาหารต่อหนึ่งหน่วยบริโภค ({servingSize} กรัม)
                </div>
                <div className="gda-boxes">
                  <div className="gda-box">
                    <div className="gda-box-header">พลังงาน</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.energy}</div>
                      <div className="gda-box-unit">กิโลแคลอรี</div>
                    </div>
                    <div className="gda-box-percent">{calcRDI(perServing.energy, THAI_RDI.energy)}%</div>
                  </div>
                  <div className="gda-box">
                    <div className="gda-box-header">น้ำตาล</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.sugar}</div>
                      <div className="gda-box-unit">กรัม</div>
                    </div>
                    <div className="gda-box-percent">{calcRDI(perServing.sugar, THAI_RDI.sugar)}%</div>
                  </div>
                  <div className="gda-box">
                    <div className="gda-box-header">ไขมัน</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.fat}</div>
                      <div className="gda-box-unit">กรัม</div>
                    </div>
                    <div className="gda-box-percent">{calcRDI(perServing.fat, THAI_RDI.fat)}%</div>
                  </div>
                  <div className="gda-box">
                    <div className="gda-box-header">โซเดียม</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.sodium}</div>
                      <div className="gda-box-unit">มิลลิกรัม</div>
                    </div>
                    <div className="gda-box-percent">{calcRDI(perServing.sodium, THAI_RDI.sodium)}%</div>
                  </div>
                </div>
                <div className="gda-footer">
                  % Thai RDI ต่อวัน สำหรับคนไทยอายุ 6 ปีขึ้นไป (พลังงาน 2,000 กิโลแคลอรี)
                </div>
              </div>
            )}
          </div>

          <div className="export-buttons">
            <button
              type="button"
              className="export-btn"
              onClick={() => handleExport('png')}
              disabled={exporting || selected.length === 0}
            >
              📷 Export PNG
            </button>
            <button
              type="button"
              className="export-btn"
              onClick={() => handleExport('jpg')}
              disabled={exporting || selected.length === 0}
            >
              🖼️ Export JPG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThaiRDICalculator;
