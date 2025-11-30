// src/pages/ThaiRDICalculator.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';
import html2canvas from 'html2canvas';

// ค่า Thai RDI ตามประกาศกระทรวงสาธารณสุข ฉบับที่ 445 (2024)
const THAI_RDI = {
  energy: { value: 2000, unit: 'kcal', label: 'พลังงาน', labelEng: 'Energy' },
  protein: { value: 60, unit: 'g', label: 'โปรตีน', labelEng: 'Protein' },
  fat: { value: 65, unit: 'g', label: 'ไขมันทั้งหมด', labelEng: 'Total Fat' },
  saturatedFat: { value: 20, unit: 'g', label: 'ไขมันอิ่มตัว', labelEng: 'Saturated Fat' },
  carb: { value: 300, unit: 'g', label: 'คาร์โบไฮเดรต', labelEng: 'Carbohydrate' },
  fibre: { value: 25, unit: 'g', label: 'ใยอาหาร', labelEng: 'Dietary Fibre' },
  sugar: { value: 65, unit: 'g', label: 'น้ำตาล', labelEng: 'Sugars' },
  sodium: { value: 2300, unit: 'mg', label: 'โซเดียม', labelEng: 'Sodium' },
  calcium: { value: 800, unit: 'mg', label: 'แคลเซียม', labelEng: 'Calcium' },
  iron: { value: 15, unit: 'mg', label: 'เหล็ก', labelEng: 'Iron' },
  phosphorus: { value: 800, unit: 'mg', label: 'ฟอสฟอรัส', labelEng: 'Phosphorus' },
  magnesium: { value: 350, unit: 'mg', label: 'แมกนีเซียม', labelEng: 'Magnesium' },
  zinc: { value: 15, unit: 'mg', label: 'สังกะสี', labelEng: 'Zinc' },
  potassium: { value: 3500, unit: 'mg', label: 'โพแทสเซียม', labelEng: 'Potassium' },
  vitaminA: { value: 800, unit: 'µg RE', label: 'วิตามิน A', labelEng: 'Vitamin A' },
  vitaminC: { value: 100, unit: 'mg', label: 'วิตามิน C', labelEng: 'Vitamin C' },
  vitaminE: { value: 15, unit: 'mg', label: 'วิตามิน E', labelEng: 'Vitamin E' },
  thiamin: { value: 1.2, unit: 'mg', label: 'วิตามิน B1', labelEng: 'Thiamin (B1)' },
  riboflavin: { value: 1.4, unit: 'mg', label: 'วิตามิน B2', labelEng: 'Riboflavin (B2)' },
  niacin: { value: 16, unit: 'mg', label: 'วิตามิน B3', labelEng: 'Niacin (B3)' },
};

const ThaiRDICalculator = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [servingSize, setServingSize] = useState(100);
  const [servingsPerContainer, setServingsPerContainer] = useState(1);
  const [labelType, setLabelType] = useState('full');
  const [exporting, setExporting] = useState(false);
  const { showToast } = useToast();
  const labelRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'items'), orderBy('name'));
        const snap = await getDocs(q);
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

  const totals = useMemo(() => {
    const result = {};
    Object.keys(THAI_RDI).forEach((key) => {
      result[key] = 0;
    });
    selected.forEach((item) => {
      const ratio = item.amount / 100;
      const nutrients = item.nutrients || {};
      Object.keys(result).forEach((key) => {
        const raw = Number(nutrients[key]) || 0;
        result[key] += raw * ratio;
      });
    });
    return result;
  }, [selected]);

  const perServing = useMemo(() => {
    const totalWeight = selected.reduce((sum, item) => sum + item.amount, 0);
    if (totalWeight === 0) return {};
    const ratio = servingSize / totalWeight;
    const result = {};
    Object.keys(totals).forEach((key) => {
      result[key] = Number((totals[key] * ratio).toFixed(2));
    });
    return result;
  }, [totals, servingSize, selected]);

  const percentRDI = useMemo(() => {
    const result = {};
    Object.keys(THAI_RDI).forEach((key) => {
      const value = perServing[key] || 0;
      const rdi = THAI_RDI[key].value;
      result[key] = Math.round((value / rdi) * 100);
    });
    return result;
  }, [perServing]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const name = (i.name || '').toLowerCase();
      const nameeng = (i.nameeng || '').toLowerCase();
      return name.includes(q) || nameeng.includes(q);
    });
  }, [items, search]);

  const totalWeight = selected.reduce((sum, item) => sum + item.amount, 0);

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
      showToast(`บันทึกเป็น ${format.toUpperCase()} สำเร็จ`, 'success');
    } catch (e) {
      console.error(e);
      showToast('ไม่สามารถบันทึกรูปภาพได้', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="card nutrition-panel">
      <h2 className="page-title">ฉลากโภชนาการ (Thai RDI)</h2>
      <p className="card-subtitle">
        คำนวณ %Thai RDI ตามประกาศกระทรวงสาธารณสุข ฉบับที่ 445 (พ.ศ. 2567)
      </p>

      <div className="rdi-calculator-layout">
        {/* ฝั่งซ้าย */}
        <div className="rdi-left-panel">
          <h3>เลือกวัตถุดิบ / เมนู</h3>
          <div className="search-row">
            <input
              type="search"
              placeholder="ค้นหาชื่อวัตถุดิบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nutrition-search-input"
            />
          </div>

          <div className="item-list" style={{ maxHeight: '200px' }}>
            {filteredItems.slice(0, 20).map((item) => (
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
                <div className="item-add">เพิ่ม</div>
              </button>
            ))}
          </div>

          <h4 style={{ marginTop: '16px' }}>รายการที่เลือก</h4>
          {selected.length === 0 ? (
            <p className="muted">ยังไม่ได้เลือกวัตถุดิบ</p>
          ) : (
            selected.map((item, index) => (
              <div key={`${item.id}-${index}`} className="selected-row">
                <div className="selected-name">
                  <strong>{item.name}</strong>
                </div>
                <input
                  type="number"
                  min="0"
                  value={item.amount}
                  onChange={(e) => updateAmount(index, e.target.value)}
                  style={{ width: 70 }}
                />
                <span className="item-meta">g</span>
                <button type="button" onClick={() => removeItem(index)}>
                  ลบ
                </button>
              </div>
            ))
          )}

          <div className="serving-settings">
            <h4>ตั้งค่าหน่วยบริโภค</h4>
            <div className="serving-row">
              <label>
                หนึ่งหน่วยบริโภค (กรัม):
                <input
                  type="number"
                  min="1"
                  value={servingSize}
                  onChange={(e) => setServingSize(Number(e.target.value) || 1)}
                  style={{ width: 80, marginLeft: 8 }}
                />
              </label>
            </div>
            <div className="serving-row">
              <label>
                จำนวนหน่วยบริโภคต่อภาชนะ:
                <input
                  type="number"
                  min="1"
                  value={servingsPerContainer}
                  onChange={(e) =>
                    setServingsPerContainer(Number(e.target.value) || 1)
                  }
                  style={{ width: 80, marginLeft: 8 }}
                />
              </label>
            </div>
            <p className="muted">น้ำหนักรวมทั้งหมด: {totalWeight} กรัม</p>
          </div>

          <div className="label-type-toggle">
            <h4>รูปแบบฉลาก</h4>
            <div className="toggle-buttons">
              <button
                type="button"
                className={`toggle-btn ${labelType === 'full' ? 'active' : ''}`}
                onClick={() => setLabelType('full')}
              >
                แบบเต็ม (Full)
              </button>
              <button
                type="button"
                className={`toggle-btn ${labelType === 'gda' ? 'active' : ''}`}
                onClick={() => setLabelType('gda')}
              >
                แบบ GDA (ย่อ)
              </button>
            </div>
          </div>

          <div className="export-buttons">
            <h4>บันทึกเป็นรูปภาพ</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleExport('png')}
                disabled={exporting}
                className="export-btn"
              >
                {exporting ? 'กำลังบันทึก...' : 'PNG'}
              </button>
              <button
                type="button"
                onClick={() => handleExport('jpg')}
                disabled={exporting}
                className="export-btn"
              >
                {exporting ? 'กำลังบันทึก...' : 'JPG'}
              </button>
            </div>
          </div>
        </div>

        {/* ฝั่งขวา: ฉลากโภชนาการ */}
        <div className="rdi-right-panel">
          <div ref={labelRef}>
            {labelType === 'full' ? (
              <div className="nutrition-label">
                <div className="label-header">
                  <div className="label-title">ข้อมูลโภชนาการ</div>
                  <div className="label-title-eng">Nutrition Facts</div>
                </div>

                <div className="label-serving">
                  <div>หนึ่งหน่วยบริโภค: {servingSize} กรัม</div>
                  <div>จำนวนหน่วยบริโภคต่อภาชนะ: {servingsPerContainer}</div>
                </div>

                <div className="label-divider thick"></div>

                <div className="label-row header">
                  <span>คุณค่าทางโภชนาการต่อหนึ่งหน่วยบริโภค</span>
                  <span>% Thai RDI*</span>
                </div>

                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>พลังงานทั้งหมด {perServing.energy || 0} กิโลแคลอรี</span>
                  <span>{percentRDI.energy || 0}%</span>
                </div>

                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>ไขมันทั้งหมด {perServing.fat || 0} ก.</span>
                  <span>{percentRDI.fat || 0}%</span>
                </div>
                <div className="label-row indent">
                  <span>ไขมันอิ่มตัว {perServing.saturatedFat || 0} ก.</span>
                  <span>{percentRDI.saturatedFat || 0}%</span>
                </div>

                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>โปรตีน {perServing.protein || 0} ก.</span>
                  <span>{percentRDI.protein || 0}%</span>
                </div>

                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>คาร์โบไฮเดรตทั้งหมด {perServing.carb || 0} ก.</span>
                  <span>{percentRDI.carb || 0}%</span>
                </div>
                <div className="label-row indent">
                  <span>ใยอาหาร {perServing.fibre || 0} ก.</span>
                  <span>{percentRDI.fibre || 0}%</span>
                </div>
                <div className="label-row indent">
                  <span>น้ำตาล {perServing.sugar || 0} ก.</span>
                  <span>{percentRDI.sugar || 0}%</span>
                </div>

                <div className="label-divider"></div>

                <div className="label-row bold">
                  <span>โซเดียม {perServing.sodium || 0} มก.</span>
                  <span>{percentRDI.sodium || 0}%</span>
                </div>

                <div className="label-divider thick"></div>

                <div className="label-section-title">วิตามินและแร่ธาตุ</div>

                <div className="label-vitamins-grid">
                  <div className="label-vitamin-row">
                    <span>วิตามิน A</span>
                    <span>{percentRDI.vitaminA || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>วิตามิน C</span>
                    <span>{percentRDI.vitaminC || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>วิตามิน E</span>
                    <span>{percentRDI.vitaminE || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>วิตามิน B1</span>
                    <span>{percentRDI.thiamin || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>วิตามิน B2</span>
                    <span>{percentRDI.riboflavin || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>วิตามิน B3</span>
                    <span>{percentRDI.niacin || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>แคลเซียม</span>
                    <span>{percentRDI.calcium || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>เหล็ก</span>
                    <span>{percentRDI.iron || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>ฟอสฟอรัส</span>
                    <span>{percentRDI.phosphorus || 0}%</span>
                  </div>
                  <div className="label-vitamin-row">
                    <span>สังกะสี</span>
                    <span>{percentRDI.zinc || 0}%</span>
                  </div>
                </div>

                <div className="label-divider"></div>

                <div className="label-footer">
                  * ร้อยละของปริมาณสารอาหารที่แนะนำให้บริโภคต่อวัน (Thai RDI)
                  สำหรับคนไทยอายุตั้งแต่ 6 ปีขึ้นไป
                  โดยคิดจากความต้องการพลังงานวันละ 2,000 กิโลแคลอรี
                </div>
              </div>
            ) : (
              <div className="gda-label">
                <div className="gda-header">
                  <div>คุณค่าทางโภชนาการต่อ <strong>{servingSize}</strong> กรัม</div>
                  <div>ควรแบ่งกิน <strong>{servingsPerContainer}</strong> ครั้ง</div>
                </div>

                <div className="gda-boxes">
                  <div className="gda-box">
                    <div className="gda-box-header">พลังงาน</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.energy || 0}</div>
                      <div className="gda-box-unit">กิโลแคลอรี</div>
                    </div>
                    <div className="gda-box-percent">{percentRDI.energy || 0}%</div>
                  </div>

                  <div className="gda-box">
                    <div className="gda-box-header">น้ำตาล</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.sugar || 0}</div>
                      <div className="gda-box-unit">กรัม</div>
                    </div>
                    <div className="gda-box-percent">{percentRDI.sugar || 0}%</div>
                  </div>

                  <div className="gda-box">
                    <div className="gda-box-header">ไขมัน</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.fat || 0}</div>
                      <div className="gda-box-unit">กรัม</div>
                    </div>
                    <div className="gda-box-percent">{percentRDI.fat || 0}%</div>
                  </div>

                  <div className="gda-box">
                    <div className="gda-box-header">โซเดียม</div>
                    <div className="gda-box-value">
                      <div className="gda-box-number">{perServing.sodium || 0}</div>
                      <div className="gda-box-unit">มิลลิกรัม</div>
                    </div>
                    <div className="gda-box-percent">{percentRDI.sodium || 0}%</div>
                  </div>
                </div>

                <div className="gda-footer">
                  คิดเป็นร้อยละของปริมาณสูงสุดที่ควรได้รับต่อวัน
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThaiRDICalculator;
