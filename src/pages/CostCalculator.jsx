// src/pages/CostCalculator.jsx
// หน้าคำนวณต้นทุนสูตรอาหาร

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// Animation keyframes จะอยู่ใน CSS

const CostCalculator = () => {
  const { showToast } = useToast();
  
  // State
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [prices, setPrices] = useState({}); // { itemId: pricePerKg }
  const [profitMargin, setProfitMargin] = useState(30);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecipeList, setShowRecipeList] = useState(false);
  const [animateTotal, setAnimateTotal] = useState(false);

  // ดึงข้อมูลสูตรอาหาร
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const q = query(collection(db, 'recipes'), orderBy('name'));
        const snapshot = await getDocs(q);
        const recipesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRecipes(recipesData);
      } catch (error) {
        console.error('Error fetching recipes:', error);
        showToast('เกิดข้อผิดพลาดในการโหลดสูตร', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, [showToast]);

  // กรองสูตรตาม search
  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return recipes;
    return recipes.filter(r => 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recipes, searchTerm]);

  // คำนวณต้นทุนแต่ละวัตถุดิบ
  const calculateItemCost = (item) => {
    const pricePerKg = prices[item.id] || 0;
    const pricePerGram = pricePerKg / 1000;
    const amount = item.amount || 0;
    return pricePerGram * amount;
  };

  // คำนวณต้นทุนรวม
  const totalCost = useMemo(() => {
    if (!selectedRecipe?.items) return 0;
    return selectedRecipe.items.reduce((sum, item) => {
      return sum + calculateItemCost(item);
    }, 0);
  }, [selectedRecipe, prices]);

  // น้ำหนักรวม
  const totalWeight = useMemo(() => {
    if (!selectedRecipe?.items) return 0;
    return selectedRecipe.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [selectedRecipe]);

  // ต้นทุนต่อ 100 กรัม
  const costPer100g = useMemo(() => {
    if (totalWeight === 0) return 0;
    return (totalCost / totalWeight) * 100;
  }, [totalCost, totalWeight]);

  // ราคาขายแนะนำ
  const suggestedPrice = useMemo(() => {
    return totalCost * (1 + profitMargin / 100);
  }, [totalCost, profitMargin]);

  // อัพเดทราคา
  const handlePriceChange = (itemId, value) => {
    const numValue = parseFloat(value) || 0;
    setPrices(prev => ({
      ...prev,
      [itemId]: numValue
    }));
    
    // Trigger animation
    setAnimateTotal(true);
    setTimeout(() => setAnimateTotal(false), 300);
  };

  // เลือกสูตร
  const handleSelectRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeList(false);
    setSearchTerm('');
    // Reset prices
    setPrices({});
  };

  // Export Excel
  const handleExportExcel = () => {
    if (!selectedRecipe) {
      showToast('กรุณาเลือกสูตรอาหารก่อน', 'warning');
      return;
    }

    const data = selectedRecipe.items.map(item => ({
      'วัตถุดิบ': item.name,
      'ปริมาณ (กรัม)': item.amount,
      'ราคา (บาท/กก.)': prices[item.id] || 0,
      'ราคา (บาท/กรัม)': ((prices[item.id] || 0) / 1000).toFixed(4),
      'ต้นทุน (บาท)': calculateItemCost(item).toFixed(2)
    }));

    // เพิ่มแถวสรุป
    data.push({});
    data.push({
      'วัตถุดิบ': 'รวมทั้งหมด',
      'ปริมาณ (กรัม)': totalWeight,
      'ราคา (บาท/กก.)': '',
      'ราคา (บาท/กรัม)': '',
      'ต้นทุน (บาท)': totalCost.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': 'ต้นทุน/100กรัม',
      'ปริมาณ (กรัม)': '',
      'ราคา (บาท/กก.)': '',
      'ราคา (บาท/กรัม)': '',
      'ต้นทุน (บาท)': costPer100g.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': `ราคาขายแนะนำ (+${profitMargin}%)`,
      'ปริมาณ (กรัม)': '',
      'ราคา (บาท/กก.)': '',
      'ราคา (บาท/กรัม)': '',
      'ต้นทุน (บาท)': suggestedPrice.toFixed(2)
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ต้นทุน');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `ต้นทุน_${selectedRecipe.name}_${new Date().toLocaleDateString('th-TH')}.xlsx`);
    
    showToast('Export สำเร็จ!', 'success');
  };

  // ตั้งราคาทั้งหมด
  const handleSetAllPrices = (defaultPrice) => {
    if (!selectedRecipe?.items) return;
    
    const newPrices = {};
    selectedRecipe.items.forEach(item => {
      newPrices[item.id] = defaultPrice;
    });
    setPrices(newPrices);
    showToast(`ตั้งราคาทั้งหมดเป็น ${defaultPrice} บาท/กก.`, 'success');
  };

  // นับจำนวนที่กรอกราคาแล้ว
  const filledPricesCount = useMemo(() => {
    if (!selectedRecipe?.items) return 0;
    return selectedRecipe.items.filter(item => prices[item.id] > 0).length;
  }, [selectedRecipe, prices]);

  if (loading) {
    return (
      <div className="cost-loading">
        <div className="cost-loading-spinner"></div>
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="cost-calculator">
      {/* Header */}
      <div className="cost-header">
        <div className="cost-header-content">
          <h1 className="cost-title">
            <span className="cost-title-icon">💰</span>
            คำนวณต้นทุนสูตรอาหาร
          </h1>
          <p className="cost-subtitle">
            กรอกราคาวัตถุดิบเพื่อคำนวณต้นทุนการผลิต
          </p>
        </div>
        {selectedRecipe && (
          <button className="cost-export-btn" onClick={handleExportExcel}>
            <span>📥</span> Export Excel
          </button>
        )}
      </div>

      {/* Recipe Selector */}
      <div className="cost-recipe-selector">
        <label className="cost-label">
          <span className="cost-label-icon">📦</span>
          เลือกสูตรอาหาร
        </label>
        
        <div className="cost-dropdown-wrapper">
          <button 
            className={`cost-dropdown-trigger ${showRecipeList ? 'active' : ''}`}
            onClick={() => setShowRecipeList(!showRecipeList)}
          >
            {selectedRecipe ? (
              <span className="cost-selected-recipe">
                <span className="recipe-icon">📖</span>
                {selectedRecipe.name}
                <span className="recipe-items-count">
                  ({selectedRecipe.items?.length || 0} รายการ)
                </span>
              </span>
            ) : (
              <span className="cost-placeholder">-- เลือกสูตรอาหาร --</span>
            )}
            <span className={`dropdown-arrow ${showRecipeList ? 'open' : ''}`}>▼</span>
          </button>

          {showRecipeList && (
            <div className="cost-dropdown-menu">
              <div className="cost-search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="ค้นหาสูตร..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="cost-recipe-list">
                {filteredRecipes.length > 0 ? (
                  filteredRecipes.map(recipe => (
                    <button
                      key={recipe.id}
                      className={`cost-recipe-item ${selectedRecipe?.id === recipe.id ? 'selected' : ''}`}
                      onClick={() => handleSelectRecipe(recipe)}
                    >
                      <span className="recipe-item-icon">📖</span>
                      <span className="recipe-item-name">{recipe.name}</span>
                      <span className="recipe-item-count">
                        {recipe.items?.length || 0} รายการ
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="cost-no-recipes">
                    <span>😕</span>
                    <p>ไม่พบสูตรอาหาร</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recipe Content */}
      {selectedRecipe ? (
        <>
          {/* Quick Actions */}
          <div className="cost-quick-actions">
            <span className="quick-actions-label">ตั้งราคาเริ่มต้น:</span>
            <div className="quick-actions-btns">
              {[50, 100, 150, 200].map(price => (
                <button
                  key={price}
                  className="quick-price-btn"
                  onClick={() => handleSetAllPrices(price)}
                >
                  ฿{price}/กก.
                </button>
              ))}
            </div>
            <span className="filled-count">
              กรอกแล้ว {filledPricesCount}/{selectedRecipe.items?.length || 0}
            </span>
          </div>

          {/* Items Table */}
          <div className="cost-table-wrapper">
            <table className="cost-table">
              <thead>
                <tr>
                  <th className="th-item">วัตถุดิบ</th>
                  <th className="th-amount">ปริมาณ</th>
                  <th className="th-price">ราคา (บาท/กก.)</th>
                  <th className="th-price-gram">บาท/กรัม</th>
                  <th className="th-cost">ต้นทุน</th>
                </tr>
              </thead>
              <tbody>
                {selectedRecipe.items?.map((item, index) => {
                  const itemCost = calculateItemCost(item);
                  const pricePerGram = (prices[item.id] || 0) / 1000;
                  const hasPrice = prices[item.id] > 0;

                  return (
                    <tr 
                      key={item.id || index} 
                      className={`cost-row ${hasPrice ? 'has-price' : ''}`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="td-item">
                        <span className="item-icon">🥗</span>
                        <span className="item-name">{item.name}</span>
                      </td>
                      <td className="td-amount">
                        <span className="amount-value">{item.amount}</span>
                        <span className="amount-unit">g</span>
                      </td>
                      <td className="td-price">
                        <div className="price-input-wrapper">
                          <span className="price-symbol">฿</span>
                          <input
                            type="number"
                            className="price-input"
                            value={prices[item.id] || ''}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            placeholder="0"
                            min="0"
                            step="1"
                          />
                        </div>
                      </td>
                      <td className="td-price-gram">
                        <span className={`price-gram ${pricePerGram > 0 ? 'active' : ''}`}>
                          ฿{pricePerGram.toFixed(4)}
                        </span>
                      </td>
                      <td className="td-cost">
                        <span className={`cost-value ${itemCost > 0 ? 'active' : ''}`}>
                          ฿{itemCost.toFixed(2)}
                        </span>
                        {itemCost > 0 && <span className="cost-sparkle">✨</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          <div className="cost-summary">
            <div className={`summary-card total ${animateTotal ? 'animate' : ''}`}>
              <div className="summary-icon">💵</div>
              <div className="summary-content">
                <span className="summary-label">ต้นทุนรวม</span>
                <span className="summary-value">
                  ฿{totalCost.toFixed(2)}
                </span>
              </div>
              <div className="summary-weight">
                น้ำหนักรวม: {totalWeight.toLocaleString()} กรัม
              </div>
            </div>

            <div className="summary-card per-unit">
              <div className="summary-icon">📊</div>
              <div className="summary-content">
                <span className="summary-label">ต้นทุน/100 กรัม</span>
                <span className="summary-value">
                  ฿{costPer100g.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="summary-card profit">
              <div className="summary-icon">💡</div>
              <div className="summary-content">
                <span className="summary-label">ราคาขายแนะนำ</span>
                <span className="summary-value profit-value">
                  ฿{suggestedPrice.toFixed(2)}
                </span>
              </div>
              <div className="profit-margin-control">
                <label>กำไร:</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(parseInt(e.target.value))}
                />
                <span className="profit-percent">+{profitMargin}%</span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="cost-tips">
            <div className="tip-icon">💡</div>
            <div className="tip-content">
              <strong>เคล็ดลับ:</strong> กรอกราคาวัตถุดิบเป็น <u>บาท/กิโลกรัม</u> 
              ระบบจะคำนวณเป็นบาท/กรัมให้อัตโนมัติ
            </div>
          </div>
        </>
      ) : (
        /* Empty State */
        <div className="cost-empty-state">
          <div className="empty-illustration">
            <span className="empty-icon">📦</span>
            <div className="empty-circles">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <h3>เลือกสูตรอาหารเพื่อเริ่มคำนวณ</h3>
          <p>เลือกสูตรจากรายการด้านบน แล้วกรอกราคาวัตถุดิบ</p>
          
          {recipes.length === 0 && (
            <div className="empty-no-recipes">
              <p>⚠️ ยังไม่มีสูตรอาหาร</p>
              <a href="/dashboard/nutrition" className="create-recipe-link">
                สร้างสูตรอาหารใหม่ →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CostCalculator;
