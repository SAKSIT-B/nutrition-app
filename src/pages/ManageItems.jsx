import React, { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../contexts/ToastContext'
import { NUTRIENT_FIELDS } from './nutritionFields'

const emptyItem = {
  name: '',
  category: '',
  nutrients: {},
}

const ManageItems = () => {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyItem)
  const [loading, setLoading] = useState(false)

  const loadItems = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, 'items'), orderBy('name'))
      const snap = await getDocs(q)
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
      showToast('โหลดข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const setNutrient = (id, value) => {
    const num = Number(value) || 0
    setForm((prev) => ({
      ...prev,
      nutrients: { ...(prev.nutrients || {}), [id]: num },
    }))
  }

  const startNew = () => {
    setEditingId(null)
    setForm(emptyItem)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      category: item.category || '',
      nutrients: item.nutrients || {},
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) {
      showToast('กรุณากรอกชื่อรายการ', 'error')
      return
    }

    try {
      setLoading(true)
      if (editingId) {
        await updateDoc(doc(db, 'items', editingId), form)
        showToast('แก้ไขข้อมูลสำเร็จ', 'success')
      } else {
        await addDoc(collection(db, 'items'), form)
        showToast('เพิ่มรายการสำเร็จ', 'success')
      }
      startNew()
      loadItems()
    } catch (err) {
      console.error(err)
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('ต้องการลบรายการนี้ใช่หรือไม่?')) return
    try {
      await deleteDoc(doc(db, 'items', id))
      showToast('ลบรายการสำเร็จ', 'success')
      loadItems()
    } catch (err) {
      console.error(err)
      showToast('ลบรายการไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="card">
      <h2>การเพิ่มและแก้ไขรายการวัตถุดิบ / เมนู</h2>
      <p className="card-subtitle">
        ข้อมูลที่กรอกทุกค่าเป็นต่อ 100 กรัม ตามหน่วยที่กำหนด
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            ชื่อวัตถุดิบ / เมนู (แสดงในตัวคำนวณ)
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            หมวด / ประเภท
            <input
              type="text"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            />
          </label>
        </div>

        <div className="form-row">
          <h3>ค่าคุณค่าทางโภชนาการ (ต่อ 100 กรัม)</h3>
        </div>

        <div className="nutrient-grid">
          {NUTRIENT_FIELDS.map((field) => (
            <div key={field.id} className="nutrient-cell">
              <label className="nutrient-label">
                {field.label} [{field.unit}]
              </label>
              <input
                type="number"
                step="0.01"
                value={form.nutrients?.[field.id] ?? ''}
                onChange={(e) => setNutrient(field.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}
          </button>
          {editingId && (
            <button type="button" onClick={startNew}>
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>
      </form>

      <hr style={{ margin: '24px 0' }} />

      <h3>รายการทั้งหมด</h3>
      {loading && <div>กำลังโหลด...</div>}
      <div className="item-list">
        {items.map((item) => (
          <div key={item.id} className="item-row">
            <div>
              <div className="item-name">{item.name}</div>
              <div className="item-meta">{item.category || '-'}</div>
            </div>
            <div className="item-actions">
              <button onClick={() => startEdit(item)}>แก้ไข</button>
              <button onClick={() => handleDelete(item.id)}>ลบ</button>
            </div>
          </div>
        ))}
        {!items.length && <div>ยังไม่มีข้อมูล</div>}
      </div>
    </div>
  )
}

export default ManageItems
