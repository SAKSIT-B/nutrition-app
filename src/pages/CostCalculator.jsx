// src/pages/CostCalculator.jsx
// หน้าคำนวณต้นทุนสูตรอาหาร - ปรับปรุงใหม่

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from '../contexts/ToastContext';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const CostCalculator = () => {
  const { showToast } = useToast();
  
  // State
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [items, setItems] = useState([]); // รายการวัตถุดิบที่แก้ไขได้
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecipeList, setShowRecipeList] = useState(false);
  
  // ค่าใช้จ่ายเพิ่มเติมและกำไร
  const [profitMargin, setProfitMargin] = useState(30);
  const [additionalCosts, setAdditionalCosts] = useState([
    { id: 1, name: 'ค่าแรงงาน', amount: 0 },
    { id: 2, name: 'ค่าบรรจุภัณฑ์', amount: 0 },
    { id: 3, name: 'ค่าขนส่ง', amount: 0 },
  ]);
  const [showAddCost, setShowAddCost] = useState(false);
  const [newCostName, setNewCostName] = useState('');

  // Modal เพิ่มวัตถุดิบใหม่
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    amount: '',
    pricePerKg: ''
  });

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
  }, []);

  // กรองสูตรตาม search
  const filteredRecipes = useMemo(() => {
    if (!searchTerm) return recipes;
    return recipes.filter(r => 
      r.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recipes, searchTerm]);

  // คำนวณต้นทุนวัตถุดิบรวม
  const totalIngredientCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const pricePerGram = (item.pricePerKg || 0) / 1000;
      return sum + (pricePerGram * (item.amount || 0));
    }, 0);
  }, [items]);

  // คำนวณค่าใช้จ่ายเพิ่มเติมรวม
  const totalAdditionalCost = useMemo(() => {
    return additionalCosts.reduce((sum, cost) => sum + (cost.amount || 0), 0);
  }, [additionalCosts]);

  // ต้นทุนรวมทั้งหมด
  const totalCost = useMemo(() => {
    return totalIngredientCost + totalAdditionalCost;
  }, [totalIngredientCost, totalAdditionalCost]);

  // น้ำหนักรวม
  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  }, [items]);

  // ต้นทุนต่อ 100 กรัม
  const costPer100g = useMemo(() => {
    if (totalWeight === 0) return 0;
    return (totalCost / totalWeight) * 100;
  }, [totalCost, totalWeight]);

  // กำไรเป็นบาท
  const profitAmount = useMemo(() => {
    return totalCost * (profitMargin / 100);
  }, [totalCost, profitMargin]);

  // ราคาขายแนะนำ
  const suggestedPrice = useMemo(() => {
    return totalCost + profitAmount;
  }, [totalCost, profitAmount]);

  // เลือกสูตร
  const handleSelectRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowRecipeList(false);
    setSearchTerm('');
    
    // แปลงข้อมูลสูตรเป็น items ที่แก้ไขได้
    const newItems = (recipe.items || []).map((item, index) => ({
      id: item.id || `item-${index}`,
      name: item.name || '',
      amount: item.amount || 0,
      pricePerKg: 0,
      isFromRecipe: true
    }));
    setItems(newItems);
  };

  // อัพเดทราคาวัตถุดิบ
  const handlePriceChange = (itemId, value) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, pricePerKg: parseFloat(value) || 0 } : item
    ));
  };

  // อัพเดทปริมาณวัตถุดิบ
  const handleAmountChange = (itemId, value) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, amount: parseFloat(value) || 0 } : item
    ));
  };

  // ลบวัตถุดิบ
  const handleRemoveItem = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // เพิ่มวัตถุดิบใหม่
  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      showToast('กรุณาระบุชื่อวัตถุดิบ', 'warning');
      return;
    }

    const newItemData = {
      id: `custom-${Date.now()}`,
      name: newItem.name.trim(),
      amount: parseFloat(newItem.amount) || 0,
      pricePerKg: parseFloat(newItem.pricePerKg) || 0,
      isFromRecipe: false,
      isCustom: true
    };

    setItems(prev => [...prev, newItemData]);
    setNewItem({ name: '', amount: '', pricePerKg: '' });
    setShowAddItem(false);
    showToast('เพิ่มวัตถุดิบสำเร็จ', 'success');
  };

  // อัพเดทค่าใช้จ่ายเพิ่มเติม
  const handleAdditionalCostChange = (costId, value) => {
    setAdditionalCosts(prev => prev.map(cost =>
      cost.id === costId ? { ...cost, amount: parseFloat(value) || 0 } : cost
    ));
  };

  // เพิ่มค่าใช้จ่ายเพิ่มเติม
  const handleAddAdditionalCost = () => {
    if (!newCostName.trim()) return;
    
    setAdditionalCosts(prev => [
      ...prev,
      { id: Date.now(), name: newCostName.trim(), amount: 0 }
    ]);
    setNewCostName('');
    setShowAddCost(false);
  };

  // ลบค่าใช้จ่ายเพิ่มเติม
  const handleRemoveAdditionalCost = (costId) => {
    setAdditionalCosts(prev => prev.filter(cost => cost.id !== costId));
  };

  // ตั้งราคาทั้งหมด
  const handleSetAllPrices = (defaultPrice) => {
    setItems(prev => prev.map(item => ({ ...item, pricePerKg: defaultPrice })));
    showToast(`ตั้งราคาทั้งหมดเป็น ${defaultPrice} บาท/กก.`, 'success');
  };

  // Export Excel
  const handleExportExcel = () => {
    if (items.length === 0) {
      showToast('ไม่มีข้อมูลให้ Export', 'warning');
      return;
    }

    const data = items.map(item => {
      const pricePerGram = (item.pricePerKg || 0) / 1000;
      const cost = pricePerGram * (item.amount || 0);
      return {
        'วัตถุดิบ': item.name,
        'ปริมาณ (กรัม)': item.amount,
        'ราคา (บาท/กก.)': item.pricePerKg || 0,
        'ราคา (บาท/กรัม)': pricePerGram.toFixed(4),
        'ต้นทุน (บาท)': cost.toFixed(2)
      };
    });

    // เพิ่มค่าใช้จ่ายเพิ่มเติม
    data.push({});
    data.push({ 'วัตถุดิบ': '--- ค่าใช้จ่ายเพิ่มเติม ---' });
    additionalCosts.forEach(cost => {
      if (cost.amount > 0) {
        data.push({
          'วัตถุดิบ': cost.name,
          'ต้นทุน (บาท)': cost.amount.toFixed(2)
        });
      }
    });

    // เพิ่มแถวสรุป
    data.push({});
    data.push({
      'วัตถุดิบ': 'ต้นทุนวัตถุดิบรวม',
      'ปริมาณ (กรัม)': totalWeight,
      'ต้นทุน (บาท)': totalIngredientCost.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': 'ค่าใช้จ่ายเพิ่มเติมรวม',
      'ต้นทุน (บาท)': totalAdditionalCost.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': 'ต้นทุนรวมทั้งหมด',
      'ต้นทุน (บาท)': totalCost.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': 'ต้นทุน/100 กรัม',
      'ต้นทุน (บาท)': costPer100g.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': `กำไร (${profitMargin}%)`,
      'ต้นทุน (บาท)': profitAmount.toFixed(2)
    });
    data.push({
      'วัตถุดิบ': 'ราคาขายแนะนำ',
      'ต้นทุน (บาท)': suggestedPrice.toFixed(2)
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ต้นทุน');
    
    const fileName = selectedRecipe 
      ? `ต้นทุน_${selectedRecipe.name}_${new Date().toLocaleDateString('th-TH')}.xlsx`
      : `ต้นทุน_${new Date().toLocaleDateString('th-TH')}.xlsx`;
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, fileName);
    
    showToast('Export สำเร็จ!', 'success');
  };

  // รีเซ็ตทั้งหมด
  const handleReset = () => {
    if (window.confirm('ต้องการล้างข้อมูลทั้งหมดหรือไม่?')) {
      setSelectedRecipe(null);
      setItems([]);
      setProfitMargin(30);
      setAdditionalCosts([
        { id: 1, name: 'ค่าแรงงาน', amount: 0 },
        { id: 2, name: 'ค่าบรรจุภัณฑ์', amount: 0 },
        { id: 3, name: 'ค่าขนส่ง', amount: 0 },
      ]);
    }
  };

  // นับจำนวนที่กรอกราคาแล้ว
  const filledPricesCount = useMemo(() => {
    return items.filter(item => item.pricePerKg > 0).length;
  }, [items]);

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
        <div className="cost-header-actions">
          {items.length > 0 && (
            <>
              <button className="cost-reset-btn" onClick={handleReset}>
                🔄 รีเซ็ต
              </button>
              <button className="cost-export-btn" onClick={handleExportExcel}>
                📥 Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="cost-main-layout">
        {/* Left Column - Recipe & Items */}
        <div className="cost-left-column">
          {/* Recipe Selector */}
          <div className="cost-card">
            <div className="cost-card-header">
              <h3>📦 เลือกสูตรอาหาร</h3>
            </div>
            <div className="cost-card-body">
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

              <div className="cost-or-divider">
                <span>หรือ</span>
              </div>

              <button 
                className="cost-add-manual-btn"
                onClick={() => {
                  setSelectedRecipe(null);
                  setShowAddItem(true);
                }}
              >
                ✏️ เพิ่มวัตถุดิบเอง (ไม่ใช้สูตร)
              </button>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="cost-card">
              <div className="cost-card-header">
                <h3>🥗 รายการวัตถุดิบ</h3>
                <div className="cost-card-actions">
                  <span className="filled-badge">
                    กรอกแล้ว {filledPricesCount}/{items.length}
                  </span>
                  <button 
                    className="cost-add-item-btn"
                    onClick={() => setShowAddItem(true)}
                  >
                    ➕ เพิ่ม
                  </button>
                </div>
              </div>

              {/* Quick Price Buttons */}
              <div className="cost-quick-prices">
                <span>ตั้งราคาเริ่มต้น:</span>
                {[50, 100, 150, 200, 300].map(price => (
                  <button
                    key={price}
                    className="quick-price-btn"
                    onClick={() => handleSetAllPrices(price)}
                  >
                    ฿{price}
                  </button>
                ))}
              </div>

              <div className="cost-card-body">
                <div className="cost-items-list">
                  {items.map((item, index) => {
                    const pricePerGram = (item.pricePerKg || 0) / 1000;
                    const itemCost = pricePerGram * (item.amount || 0);
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`cost-item ${item.isCustom ? 'custom' : ''} ${item.pricePerKg > 0 ? 'has-price' : ''}`}
                      >
                        <div className="cost-item-header">
                          <span className="cost-item-name">
                            {item.isCustom && <span className="custom-badge">เพิ่มเอง</span>}
                            {item.name}
                          </span>
                          <button 
                            className="cost-item-remove"
                            onClick={() => handleRemoveItem(item.id)}
                            title="ลบรายการ"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="cost-item-inputs">
                          <div className="cost-input-group">
                            <label>ปริมาณ (g)</label>
                            <input
                              type="number"
                              value={item.amount || ''}
                              onChange={(e) => handleAmountChange(item.id, e.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          
                          <div className="cost-input-group">
                            <label>ราคา (บาท/กก.)</label>
                            <input
                              type="number"
                              value={item.pricePerKg || ''}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </div>
                          
                          <div className="cost-item-result">
                            <span className="result-label">ต้นทุน</span>
                            <span className={`result-value ${itemCost > 0 ? 'active' : ''}`}>
                              ฿{itemCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {items.length === 0 && (
            <div className="cost-empty-state">
              <div className="empty-illustration">
                <span className="empty-icon">📦</span>
              </div>
              <h3>เริ่มต้นคำนวณต้นทุน</h3>
              <p>เลือกสูตรจากด้านบน หรือเพิ่มวัตถุดิบเอง</p>
            </div>
          )}
        </div>

        {/* Right Column - Summary & Additional Costs */}
        <div className="cost-right-column">
          {/* Additional Costs */}
          <div className="cost-card">
            <div className="cost-card-header">
              <h3>📋 ค่าใช้จ่ายเพิ่มเติม</h3>
              <button 
                className="cost-add-cost-btn"
                onClick={() => setShowAddCost(true)}
              >
                ➕
              </button>
            </div>
            <div className="cost-card-body">
              <div className="additional-costs-list">
                {additionalCosts.map(cost => (
                  <div key={cost.id} className="additional-cost-item">
                    <span className="additional-cost-name">{cost.name}</span>
                    <div className="additional-cost-input">
                      <span className="currency">฿</span>
                      <input
                        type="number"
                        value={cost.amount || ''}
                        onChange={(e) => handleAdditionalCostChange(cost.id, e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                      <button 
                        className="additional-cost-remove"
                        onClick={() => handleRemoveAdditionalCost(cost.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {showAddCost && (
                <div className="add-cost-form">
                  <input
                    type="text"
                    value={newCostName}
                    onChange={(e) => setNewCostName(e.target.value)}
                    placeholder="ชื่อค่าใช้จ่าย"
                    autoFocus
                  />
                  <button className="btn-confirm" onClick={handleAddAdditionalCost}>
                    ✓
                  </button>
                  <button className="btn-cancel" onClick={() => {
                    setShowAddCost(false);
                    setNewCostName('');
                  }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Profit Margin */}
          <div className="cost-card">
            <div className="cost-card-header">
              <h3>💹 กำไรที่ต้องการ</h3>
            </div>
            <div className="cost-card-body">
              <div className="profit-control">
                <div className="profit-slider-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={profitMargin}
                    onChange={(e) => setProfitMargin(parseInt(e.target.value))}
                    className="profit-slider"
                  />
                  <div className="profit-value-display">
                    <input
                      type="number"
                      value={profitMargin}
                      onChange={(e) => setProfitMargin(parseInt(e.target.value) || 0)}
                      min="0"
                      max="500"
                    />
                    <span>%</span>
                  </div>
                </div>
                <div className="profit-amount">
                  กำไร: <strong>฿{profitAmount.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="cost-card summary-card">
            <div className="cost-card-header">
              <h3>📊 สรุปต้นทุน</h3>
            </div>
            <div className="cost-card-body">
              <div className="summary-rows">
                <div className="summary-row">
                  <span>ต้นทุนวัตถุดิบ</span>
                  <span className="summary-value">฿{totalIngredientCost.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>ค่าใช้จ่ายเพิ่มเติม</span>
                  <span className="summary-value">฿{totalAdditionalCost.toFixed(2)}</span>
                </div>
                <div className="summary-row divider"></div>
                <div className="summary-row total">
                  <span>💵 ต้นทุนรวม</span>
                  <span className="summary-value">฿{totalCost.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>📦 น้ำหนักรวม</span>
                  <span className="summary-value">{totalWeight.toLocaleString()} g</span>
                </div>
                <div className="summary-row">
                  <span>📊 ต้นทุน/100g</span>
                  <span className="summary-value">฿{costPer100g.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>💹 กำไร ({profitMargin}%)</span>
                  <span className="summary-value profit">+฿{profitAmount.toFixed(2)}</span>
                </div>
                <div className="summary-row divider"></div>
                <div className="summary-row final">
                  <span>🏷️ ราคาขายแนะนำ</span>
                  <span className="summary-value final-price">฿{suggestedPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="cost-tips">
            <div className="tip-icon">💡</div>
            <div className="tip-content">
              <strong>เคล็ดลับ:</strong> กรอกราคาวัตถุดิบเป็น <u>บาท/กิโลกรัม</u> 
              ระบบจะคำนวณเป็นต้นทุนให้อัตโนมัติ
            </div>
          </div>
        </div>
      </div>

      {/* Modal เพิ่มวัตถุดิบ */}
      {showAddItem && (
        <div className="cost-modal-overlay" onClick={() => setShowAddItem(false)}>
          <div className="cost-modal" onClick={e => e.stopPropagation()}>
            <div className="cost-modal-header">
              <h3>➕ เพิ่มวัตถุดิบใหม่</h3>
              <button className="modal-close" onClick={() => setShowAddItem(false)}>✕</button>
            </div>
            <div className="cost-modal-body">
              <div className="form-group">
                <label>ชื่อวัตถุดิบ *</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  placeholder="เช่น แป้งสาลี, น้ำตาล"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ปริมาณที่ใช้ (กรัม)</label>
                  <input
                    type="number"
                    value={newItem.amount}
                    onChange={(e) => setNewItem({...newItem, amount: e.target.value})}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>ราคา (บาท/กก.)</label>
                  <input
                    type="number"
                    value={newItem.pricePerKg}
                    onChange={(e) => setNewItem({...newItem, pricePerKg: e.target.value})}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              {newItem.amount && newItem.pricePerKg && (
                <div className="preview-cost">
                  ต้นทุน: <strong>฿{((parseFloat(newItem.pricePerKg) / 1000) * parseFloat(newItem.amount)).toFixed(2)}</strong>
                </div>
              )}
            </div>
            <div className="cost-modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddItem(false)}>
                ยกเลิก
              </button>
              <button className="btn-save" onClick={handleAddItem}>
                ➕ เพิ่มวัตถุดิบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostCalculator;
