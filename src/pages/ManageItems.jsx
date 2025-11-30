// src/pages/ManageItems.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';

const EMPTY_NUTRIENTS = {
  energy: '',
  water: '',
  protein: '',
  fat: '',
  carb: '',
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
};

const ManageItems = () => {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchAll, setSearchAll] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    nutrients: { ...EMPTY_NUTRIENTS },
  });

  const { showToast } = useToast();

  const loadItems = async () => {
    try {
      const snap = await getDocs(collection(db, 'items'));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(docs);
    } catch (e) {
      console.error(e);
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      description: item.description || '',
      category: item.category || '',
      nutrients: { ...EMPTY_NUTRIENTS, ...(item.nutrients || {}) },
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      description: '',
      category: '',
      nutrients: { ...EMPTY_NUTRIENTS },
    });
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNutrientChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      nutrients: { ...prev.nutrients, [field]: value },
    }));
  };

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
        await updateDoc(ref, form);
        showToast('อัพเดทข้อมูลสำเร็จ', 'success');
      } else {
        await addDoc(collection(db, 'items'), form);
        showToast('เพิ่มข้อมูลสำเร็จ', 'success');
      }
      resetForm();
      await loadItems();
    } catch (e) {
      console.error(e);
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`ต้องการลบ "${item.name}" ใช่ไหม?`)) return;
    try {
      await deleteDoc(doc(db, 'items', item.id));
      showToast('ลบข้อมูลสำเร็จ', 'success');
      await loadItems();
    } catch (e) {
      console.error(e);
      showToast('ลบข้อมูลไม่สำเร็จ', 'error');
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchAll.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || desc.includes(q);
    });
  }, [items, searchAll]);

  return (
    <div className="card">
      <h2 className="page-title">การเพิ่มและแก้ไขรายการวัตถุดิบ / เมนู</h2>
      <p className="card-subtitle">
        ข้อมูลคุณค่าทางโภชนาการต่อ 100 กรัม ตามหน่วยที่กำหนด
      </p>

      {/* ฟอร์มกรอกข้อมูล */}
      <form onSubmit={handleSubmit} className="form-grid manage-form">
        <div className="form-row">
          <label>
            ชื่อวัตถุดิบ / เมนู (แสดงในตัวคำนวณ)
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="เช่น ก๋วยเตี๋ยว เส้นจันทน์ แห้ง"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            หมวด / ประเภท
            <input
              type="text"
              value={form.category}
              onChange={(e) => handleChange('category', e.target.value)}
              placeholder="เช่น ธัญพืชและผลิตภัณฑ์ / อาหารจานเดียว"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            ข้อมูลเพิ่มเติม / หมายเหตุ (ถ้ามี)
            <input
              type="text"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="ข้อมูลที่มา, วิธีปรุง, ยี่ห้อ ฯลฯ"
            />
          </label>
        </div>

        <hr style={{ margin: '12px 0', borderColor: 'var(--border)' }} />

        <h3 style={{ margin: '0 0 8px' }}>
          ค่าคุณค่าทางโภชนาการ (ต่อ 100 กรัม)
        </h3>

        {/* ทำเป็น grid 2 แถว 4–5 คอลัมน์ เพื่อให้อ่านง่าย */}
        <div className="nutrient-form-grid">
          {/* Main nutrients */}
          <div className="nutrient-group">
            <div className="nutrient-group-title">กลุ่มที่ 1 สารอาหารหลัก</div>
            <div className="nutrient-group-grid">
              <label>
                Energy [kcal]
                <input
                  type="number"
                  value={form.nutrients.energy}
                  onChange={(e) =>
                    handleNutrientChange('energy', e.target.value)
                  }
                />
              </label>
              <label>
                Water [g]
                <input
                  type="number"
                  value={form.nutrients.water}
                  onChange={(e) =>
                    handleNutrientChange('water', e.target.value)
                  }
                />
              </label>
              <label>
                Protein [g]
                <input
                  type="number"
                  value={form.nutrients.protein}
                  onChange={(e) =>
                    handleNutrientChange('protein', e.target.value)
                  }
                />
              </label>
              <label>
                Fat [g]
                <input
                  type="number"
                  value={form.nutrients.fat}
                  onChange={(e) => handleNutrientChange('fat', e.target.value)}
                />
              </label>
              <label>
                Carbohydrate total [g]
                <input
                  type="number"
                  value={form.nutrients.carb}
                  onChange={(e) => handleNutrientChange('carb', e.target.value)}
                />
              </label>
              <label>
                Ash [g]
                <input
                  type="number"
                  value={form.nutrients.ash}
                  onChange={(e) => handleNutrientChange('ash', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Minerals */}
          <div className="nutrient-group">
            <div className="nutrient-group-title">กลุ่มที่ 2 แร่ธาตุ</div>
            <div className="nutrient-group-grid">
              <label>
                Calcium [mg]
                <input
                  type="number"
                  value={form.nutrients.calcium}
                  onChange={(e) =>
                    handleNutrientChange('calcium', e.target.value)
                  }
                />
              </label>
              <label>
                Phosphorus [mg]
                <input
                  type="number"
                  value={form.nutrients.phosphorus}
                  onChange={(e) =>
                    handleNutrientChange('phosphorus', e.target.value)
                  }
                />
              </label>
              <label>
                Magnesium [mg]
                <input
                  type="number"
                  value={form.nutrients.magnesium}
                  onChange={(e) =>
                    handleNutrientChange('magnesium', e.target.value)
                  }
                />
              </label>
              <label>
                Sodium [mg]
                <input
                  type="number"
                  value={form.nutrients.sodium}
                  onChange={(e) =>
                    handleNutrientChange('sodium', e.target.value)
                  }
                />
              </label>
              <label>
                Potassium [mg]
                <input
                  type="number"
                  value={form.nutrients.potassium}
                  onChange={(e) =>
                    handleNutrientChange('potassium', e.target.value)
                  }
                />
              </label>
              <label>
                Iron [mg]
                <input
                  type="number"
                  value={form.nutrients.iron}
                  onChange={(e) =>
                    handleNutrientChange('iron', e.target.value)
                  }
                />
              </label>
              <label>
                Copper [mg]
                <input
                  type="number"
                  value={form.nutrients.copper}
                  onChange={(e) =>
                    handleNutrientChange('copper', e.target.value)
                  }
                />
              </label>
              <label>
                Zinc [mg]
                <input
                  type="number"
                  value={form.nutrients.zinc}
                  onChange={(e) =>
                    handleNutrientChange('zinc', e.target.value)
                  }
                />
              </label>
              <label>
                Iodine [µg]
                <input
                  type="number"
                  value={form.nutrients.iodine}
                  onChange={(e) =>
                    handleNutrientChange('iodine', e.target.value)
                  }
                />
              </label>
            </div>
          </div>

          {/* Vitamins */}
          <div className="nutrient-group">
            <div className="nutrient-group-title">กลุ่มที่ 3 วิตามิน</div>
            <div className="nutrient-group-grid">
              <label>
                Betacarotene [µg]
                <input
                  type="number"
                  value={form.nutrients.betacarotene}
                  onChange={(e) =>
                    handleNutrientChange('betacarotene', e.target.value)
                  }
                />
              </label>
              <label>
                Retinol [µg]
                <input
                  type="number"
                  value={form.nutrients.retinol}
                  onChange={(e) =>
                    handleNutrientChange('retinol', e.target.value)
                  }
                />
              </label>
              <label>
                Total Vitamin A (RAE) [µg]
                <input
                  type="number"
                  value={form.nutrients.vitaminA}
                  onChange={(e) =>
                    handleNutrientChange('vitaminA', e.target.value)
                  }
                />
              </label>
              <label>
                Thiamin [mg]
                <input
                  type="number"
                  value={form.nutrients.thiamin}
                  onChange={(e) =>
                    handleNutrientChange('thiamin', e.target.value)
                  }
                />
              </label>
              <label>
                Riboflavin [mg]
                <input
                  type="number"
                  value={form.nutrients.riboflavin}
                  onChange={(e) =>
                    handleNutrientChange('riboflavin', e.target.value)
                  }
                />
              </label>
              <label>
                Niacin [mg]
                <input
                  type="number"
                  value={form.nutrients.niacin}
                  onChange={(e) =>
                    handleNutrientChange('niacin', e.target.value)
                  }
                />
              </label>
              <label>
                Vitamin C [mg]
                <input
                  type="number"
                  value={form.nutrients.vitaminC}
                  onChange={(e) =>
                    handleNutrientChange('vitaminC', e.target.value)
                  }
                />
              </label>
              <label>
                Vitamin E [mg]
                <input
                  type="number"
                  value={form.nutrients.vitaminE}
                  onChange={(e) =>
                    handleNutrientChange('vitaminE', e.target.value)
                  }
                />
              </label>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>
      </form>

      <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />

      {/* ช่องค้นหาจากรายการทั้งหมด */}
      <div className="search-row">
        <input
          type="search"
          placeholder="ค้นหารายการทั้งหมดตามชื่อ / หมวด / หมายเหตุ..."
          value={searchAll}
          onChange={(e) => setSearchAll(e.target.value)}
          className="nutrition-search-input"
        />
      </div>

      <h3 style={{ marginTop: 12 }}>รายการทั้งหมด</h3>
      <div className="item-list">
        {filteredItems.map((item) => (
          <div key={item.id} className="item-row">
            <div className="item-name">{item.name}</div>
            <div className="item-meta">
              {item.category || 'ไม่มีหมวดหมู่'}{' '}
              {item.description ? `• ${item.description}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => startEdit(item)}>
                แก้ไข
              </button>
              <button type="button" onClick={() => handleDelete(item)}>
                ลบ
              </button>
            </div>
          </div>
        ))}
        {!filteredItems.length && (
          <div style={{ padding: '8px 10px', fontSize: '0.85rem' }}>
            ไม่มีข้อมูล
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageItems;

