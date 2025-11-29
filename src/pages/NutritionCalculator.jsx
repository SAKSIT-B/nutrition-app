import React, { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { NUTRIENT_FIELDS } from './nutritionFields'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { useToast } from '../contexts/ToastContext'

const NutritionCalculator = () => {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([]) // {id, name, amount, nutrients}

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const q = query(collection(db, 'items'), orderBy('name'))
        const snap = await getDocs(q)
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setItems(list)
      } catch (err) {
        console.error(err)
        showToast('โหลดข้อมูลวัตถุดิบไม่สำเร็จ', 'error')
      }
    }
    fetchItems()
  }, [showToast])

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase()
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        (i.category || '').toLowerCase().includes(term)
    )
  }, [items, search])

  const addItem = (item) => {
    setSelected((prev) => [
      ...prev,
      { id: item.id + '-' + Date.now(), name: item.name, amount: 100, nutrients: item.nutrients || {} },
    ])
  }

  const updateAmount = (id, value) => {
    const v = Number(value) || 0
    setSelected((prev) => prev.map((it) => (it.id === id ? { ...it, amount: v } : it)))
  }

  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((it) => it.id !== id))
  }

  const totals = useMemo(() => {
    const result = {}
    for (const field of NUTRIENT_FIELDS) {
      result[field.id] = 0
    }
    for (const item of selected) {
      const factor = item.amount / 100
      for (const field of NUTRIENT_FIELDS) {
        const base = Number(item.nutrients?.[field.id] || 0)
        result[field.id] += base * factor
      }
    }
    return result
  }, [selected])

  const exportExcel = () => {
    if (!selected.length) {
      showToast('ยังไม่มีรายการสำหรับ export', 'info')
      return
    }

    const rows = selected.map((item) => {
      const row = {
        ชื่อเมนู_หรือวัตถุดิบ: item.name,
        ปริมาณกรัม: item.amount,
      }
      for (const field of NUTRIENT_FIELDS) {
        row[`${field.label} [${field.unit}]`] =
          ((Number(item.nutrients?.[field.id] || 0) * item.amount) / 100).toFixed(2)
      }
      return row
    })

    // แถวรวม
    const totalRow = {
      ชื่อเมนู_หรือวัตถุดิบ: 'รวมทั้งหมด',
      ปริมาณกรัม: selected.reduce((s, i) => s + i.amount, 0),
    }
    for (const field of NUTRIENT_FIELDS) {
      totalRow[`${field.label} [${field.unit}]`] = totals[field.id].toFixed(2)
    }
    rows.push(totalRow)

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Nutrition')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, 'nutrition-calculation.xlsx')
    showToast('Export เป็น Excel สำเร็จ', 'success')
  }

  return (
    <div className="card">
      <h2>การคำนวณคุณค่าทางโภชนาการ</h2>
      <p className="card-subtitle">
        หน่วยข้อมูลโภชนาการเป็นต่อ 100 กรัม (kcal, mg, µg, g) ตามรายการที่ Admin/Mod กรอกไว้
      </p>

      <div className="search-row">
        <input
          type="text"
          placeholder="ค้นหาชื่อวัตถุดิบ / เมนู / หมวด..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="calculator-layout">
        <div className="calculator-left">
          <h3>รายการวัตถุดิบ / เมนู</h3>
          <div className="item-list">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                className="item-row"
                onClick={() => addItem(item)}
              >
                <div>
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">{item.category || '-'}</div>
                </div>
                <span className="item-add">เพิ่ม</span>
              </button>
            ))}
            {!filteredItems.length && <div>ไม่พบรายการ</div>}
          </div>
        </div>

        <div className="calculator-right">
          <h3>รายการที่เลือกไว้</h3>
          {selected.length === 0 && <div>ยังไม่มีรายการ</div>}

          {selected.map((item) => (
            <div key={item.id} className="selected-row">
              <div className="selected-name">{item.name}</div>
              <input
                type="number"
                min="0"
                value={item.amount}
                onChange={(e) => updateAmount(item.id, e.target.value)}
              />
              <span>กรัม</span>
              <button onClick={() => removeSelected(item.id)}>ลบ</button>
            </div>
          ))}

          {selected.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>ผลรวมคุณค่าทางโภชนาการ</h3>
              <div className="nutrient-grid">
                {NUTRIENT_FIELDS.map((field) => (
                  <div key={field.id} className="nutrient-cell">
                    <div className="nutrient-label">
                      {field.label} [{field.unit}]
                    </div>
                    <div className="nutrient-value">
                      {totals[field.id].toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <button className="primary-btn" onClick={exportExcel}>
                Export เป็น Excel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default NutritionCalculator
