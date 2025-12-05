// src/pages/ShelfLifeCalculator.jsx
// เครื่องมือคำนวณอายุการเก็บรักษาผลิตภัณฑ์อาหาร

import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query as firestoreQuery, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

// ค่าคงที่
const GAS_CONSTANT = 8.314; // J/(mol·K)

// Helper Functions (ประกาศก่อน Component)
const getAwCategory = (aw) => {
  if (aw < 0.3) return { name: 'แห้งมาก', color: '#10b981', organisms: 'ไม่มีจุลินทรีย์เจริญ' };
  if (aw < 0.5) return { name: 'แห้ง', color: '#22c55e', organisms: 'ออสโมฟิลิกยีสต์บางชนิด' };
  if (aw < 0.6) return { name: 'กึ่งแห้ง', color: '#84cc16', organisms: 'ยีสต์และราบางชนิด' };
  if (aw < 0.7) return { name: 'ชื้นเล็กน้อย', color: '#eab308', organisms: 'ราส่วนใหญ่' };
  if (aw < 0.85) return { name: 'ชื้นปานกลาง', color: '#f97316', organisms: 'ยีสต์และแบคทีเรียหลายชนิด' };
  if (aw < 0.95) return { name: 'ชื้นมาก', color: '#ef4444', organisms: 'แบคทีเรียก่อโรคส่วนใหญ่' };
  return { name: 'เปียก', color: '#dc2626', organisms: 'จุลินทรีย์ทุกชนิด' };
};

const getRiskColor = (level) => {
  const colors = {
    'very-low': '#10b981',
    'low': '#22c55e',
    'medium': '#eab308',
    'high': '#f97316',
    'very-high': '#ef4444',
  };
  return colors[level] || '#6b7280';
};

const getRiskLabel = (level) => {
  const labels = {
    'very-low': 'ต่ำมาก',
    'low': 'ต่ำ',
    'medium': 'ปานกลาง',
    'high': 'สูง',
    'very-high': 'สูงมาก',
  };
  return labels[level] || 'ไม่ทราบ';
};

const ShelfLifeCalculator = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // State หลัก
  const [activeTab, setActiveTab] = useState('q10');
  const [savedTests, setSavedTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [testName, setTestName] = useState('');

  // ===== Q10 Method State =====
  const [q10Data, setQ10Data] = useState({
    knownShelfLife: 30,
    knownTemp: 35,
    targetTemp: 25,
    q10Value: 2,
  });

  // ===== Arrhenius Method State =====
  const [arrheniusData, setArrheniusData] = useState({
    testPoints: [
      { temp: 45, shelfLife: 7 },
      { temp: 35, shelfLife: 21 },
      { temp: 25, shelfLife: 60 },
    ],
    targetTemp: 25,
  });

  // ===== Water Activity State =====
  const [waterActivityData, setWaterActivityData] = useState({
    aw: 0.45,
    pH: 5.5,
    temperature: 25,
    preservatives: false,
    packaging: 'vacuum',
    productType: 'dried',
  });

  // ===== ดึงข้อมูลการทดสอบที่บันทึกไว้ =====
  useEffect(() => {
    const fetchSavedTests = async () => {
      try {
        const q = firestoreQuery(collection(db, 'shelfLifeTests'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const testsData = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setSavedTests(testsData);
      } catch (error) {
        console.error('Error fetching tests:', error);
      }
    };
    fetchSavedTests();
  }, []);

  // ===== Q10 Calculation =====
  const q10Result = useMemo(() => {
    const { knownShelfLife, knownTemp, targetTemp, q10Value } = q10Data;
    const tempDiff = knownTemp - targetTemp;
    const predictedShelfLife = knownShelfLife * Math.pow(q10Value, tempDiff / 10);
    
    return {
      predictedDays: Math.round(predictedShelfLife),
      predictedWeeks: (predictedShelfLife / 7).toFixed(1),
      predictedMonths: (predictedShelfLife / 30).toFixed(1),
      factor: Math.pow(q10Value, tempDiff / 10).toFixed(2),
    };
  }, [q10Data]);

  // ===== Arrhenius Calculation =====
  const arrheniusResult = useMemo(() => {
    const { testPoints, targetTemp } = arrheniusData;
    
    if (testPoints.length < 2) {
      return { predictedDays: 0, Ea: 0, A: 0, rSquared: 0, graphData: [], testPoints: [] };
    }

    // แปลงข้อมูลสำหรับ Linear Regression
    const points = testPoints.map(pt => ({
      x: 1 / (pt.temp + 273.15),
      y: Math.log(1 / pt.shelfLife),
      temp: pt.temp,
      shelfLife: pt.shelfLife,
    }));

    // Linear Regression
    const n = points.length;
    const sumX = points.reduce((acc, pt) => acc + pt.x, 0);
    const sumY = points.reduce((acc, pt) => acc + pt.y, 0);
    const sumXY = points.reduce((acc, pt) => acc + pt.x * pt.y, 0);
    const sumX2 = points.reduce((acc, pt) => acc + pt.x * pt.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // คำนวณ Ea และ A
    const Ea = -slope * GAS_CONSTANT / 1000;
    const A = Math.exp(intercept);

    // คำนวณ R²
    const yMean = sumY / n;
    const ssTotal = points.reduce((acc, pt) => acc + Math.pow(pt.y - yMean, 2), 0);
    const ssResidual = points.reduce((acc, pt) => {
      const yPred = intercept + slope * pt.x;
      return acc + Math.pow(pt.y - yPred, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // ทำนายอายุที่อุณหภูมิเป้าหมาย
    const targetTempK = targetTemp + 273.15;
    const kTarget = A * Math.exp(-Ea * 1000 / (GAS_CONSTANT * targetTempK));
    const predictedShelfLife = kTarget > 0 ? 1 / kTarget : 0;

    // สร้างข้อมูลสำหรับกราฟ
    const graphData = [];
    for (let temp = 5; temp <= 50; temp += 5) {
      const tempK = temp + 273.15;
      const k = A * Math.exp(-Ea * 1000 / (GAS_CONSTANT * tempK));
      const sl = k > 0 ? 1 / k : 0;
      graphData.push({ temp: temp, shelfLife: Math.min(sl, 365) });
    }

    return {
      predictedDays: Math.round(predictedShelfLife),
      predictedWeeks: (predictedShelfLife / 7).toFixed(1),
      predictedMonths: (predictedShelfLife / 30).toFixed(1),
      Ea: Ea.toFixed(2),
      A: A.toExponential(2),
      rSquared: rSquared.toFixed(4),
      graphData: graphData,
      testPoints: points,
    };
  }, [arrheniusData]);

  // ===== Water Activity Assessment =====
  const waterActivityResult = useMemo(() => {
    const { aw, pH, temperature, preservatives, packaging, productType } = waterActivityData;
    
    let baseShelfLife = 0;
    let riskLevel = 'low';
    const riskFactors = [];
    const recommendations = [];

    // ประเมินจาก aw
    if (aw < 0.3) {
      baseShelfLife = 365;
      riskLevel = 'very-low';
    } else if (aw < 0.5) {
      baseShelfLife = 180;
      riskLevel = 'low';
    } else if (aw < 0.6) {
      baseShelfLife = 90;
      riskLevel = 'low';
    } else if (aw < 0.7) {
      baseShelfLife = 30;
      riskLevel = 'medium';
      riskFactors.push('aw อยู่ในช่วงที่ยีสต์และราสามารถเจริญได้');
    } else if (aw < 0.85) {
      baseShelfLife = 14;
      riskLevel = 'high';
      riskFactors.push('aw อยู่ในช่วงที่แบคทีเรียหลายชนิดเจริญได้');
    } else {
      baseShelfLife = 7;
      riskLevel = 'very-high';
      riskFactors.push('aw สูง เสี่ยงต่อการเจริญของจุลินทรีย์ทุกชนิด');
    }

    // ปรับตาม pH
    if (pH < 4.6) {
      baseShelfLife *= 1.5;
      recommendations.push('pH ต่ำช่วยยับยั้งจุลินทรีย์ก่อโรค');
    } else if (pH > 6.5) {
      baseShelfLife *= 0.7;
      riskFactors.push('pH สูง เอื้อต่อการเจริญของแบคทีเรีย');
    }

    // ปรับตามอุณหภูมิเก็บ
    if (temperature <= 4) {
      baseShelfLife *= 2;
      recommendations.push('เก็บที่อุณหภูมิต่ำช่วยยืดอายุได้');
    } else if (temperature >= 30) {
      baseShelfLife *= 0.5;
      riskFactors.push('อุณหภูมิสูงเร่งการเสื่อมสภาพ');
    }

    // ปรับตามการใช้สารกันเสีย
    if (preservatives) {
      baseShelfLife *= 1.3;
      recommendations.push('สารกันเสียช่วยยืดอายุการเก็บ');
    }

    // ปรับตามบรรจุภัณฑ์
    const packagingFactors = {
      'normal': 1,
      'vacuum': 1.5,
      'modified-atmosphere': 1.8,
      'nitrogen': 2,
    };
    baseShelfLife *= packagingFactors[packaging] || 1;

    // ปรับตามประเภทผลิตภัณฑ์
    const productFactors = {
      'fresh': 0.5,
      'semi-dried': 1,
      'dried': 1.5,
      'frozen': 3,
    };
    baseShelfLife *= productFactors[productType] || 1;

    // Recommendations
    if (aw > 0.6) {
      recommendations.push('ควรลด aw ให้ต่ำกว่า 0.6 เพื่อยืดอายุการเก็บ');
    }
    if (packaging === 'normal') {
      recommendations.push('ควรใช้บรรจุภัณฑ์สุญญากาศหรือ MAP เพื่อยืดอายุ');
    }
    if (temperature > 25 && productType !== 'frozen') {
      recommendations.push('ควรเก็บรักษาที่อุณหภูมิต่ำกว่า 25°C');
    }

    return {
      predictedDays: Math.round(baseShelfLife),
      predictedWeeks: (baseShelfLife / 7).toFixed(1),
      predictedMonths: (baseShelfLife / 30).toFixed(1),
      riskLevel: riskLevel,
      riskFactors: riskFactors,
      recommendations: recommendations,
      awCategory: getAwCategory(aw),
    };
  }, [waterActivityData]);

  // ===== Arrhenius Test Points Management =====
  const addTestPoint = () => {
    setArrheniusData(prev => ({
      ...prev,
      testPoints: [...prev.testPoints, { temp: 30, shelfLife: 30 }]
    }));
  };

  const removeTestPoint = (index) => {
    setArrheniusData(prev => ({
      ...prev,
      testPoints: prev.testPoints.filter((_, idx) => idx !== index)
    }));
  };

  const updateTestPoint = (index, field, value) => {
    setArrheniusData(prev => ({
      ...prev,
      testPoints: prev.testPoints.map((pt, idx) => 
        idx === index ? { ...pt, [field]: parseFloat(value) || 0 } : pt
      )
    }));
  };

  // ===== Save Test =====
  const handleSaveTest = async () => {
    if (!testName.trim()) {
      showToast('กรุณากรอกชื่อการทดสอบ', 'error');
      return;
    }

    setLoading(true);
    try {
      let result, method, data;

      if (activeTab === 'q10') {
        result = q10Result;
        method = 'Q10';
        data = q10Data;
      } else if (activeTab === 'arrhenius') {
        result = arrheniusResult;
        method = 'Arrhenius';
        data = arrheniusData;
      } else {
        result = waterActivityResult;
        method = 'Water Activity';
        data = waterActivityData;
      }

      await addDoc(collection(db, 'shelfLifeTests'), {
        name: testName.trim(),
        method: method,
        data: data,
        result: {
          predictedDays: result.predictedDays,
          predictedMonths: result.predictedMonths,
        },
        createdAt: new Date(),
        createdBy: user?.uid || 'anonymous',
      });

      showToast('บันทึกการทดสอบสำเร็จ', 'success');
      setShowSaveModal(false);
      setTestName('');

      // Refresh list
      const q = firestoreQuery(collection(db, 'shelfLifeTests'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const testsData = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setSavedTests(testsData);
    } catch (error) {
      console.error('Error saving test:', error);
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ===== Delete Test =====
  const handleDeleteTest = async (testId) => {
    if (!window.confirm('ต้องการลบการทดสอบนี้?')) return;

    try {
      await deleteDoc(doc(db, 'shelfLifeTests', testId));
      setSavedTests(prev => prev.filter(t => t.id !== testId));
      showToast('ลบการทดสอบสำเร็จ', 'success');
    } catch (error) {
      console.error('Error deleting test:', error);
      showToast('เกิดข้อผิดพลาดในการลบ', 'error');
    }
  };

  // ===== Current Result =====
  const currentResult = activeTab === 'q10' ? q10Result : 
                        activeTab === 'arrhenius' ? arrheniusResult : 
                        waterActivityResult;

  return (
    <div className="shelf-life-calculator">
      {/* Header */}
      <div className="shelf-header">
        <div className="shelf-header-content">
          <h1 className="shelf-title">
            <span className="shelf-title-icon">⏱️</span>
            Shelf Life Calculator
          </h1>
          <p className="shelf-subtitle">
            เครื่องมือคำนวณอายุการเก็บรักษาผลิตภัณฑ์อาหาร
          </p>
        </div>
        <button 
          className="shelf-save-btn"
          onClick={() => setShowSaveModal(true)}
        >
          <span>💾</span> บันทึกผล
        </button>
      </div>

      {/* Method Tabs */}
      <div className="shelf-tabs">
        <button
          className={`shelf-tab ${activeTab === 'q10' ? 'active' : ''}`}
          onClick={() => setActiveTab('q10')}
        >
          <span className="tab-icon">🌡️</span>
          <span className="tab-label">Q10 Method</span>
          <span className="tab-desc">ง่าย รวดเร็ว</span>
        </button>
        <button
          className={`shelf-tab ${activeTab === 'arrhenius' ? 'active' : ''}`}
          onClick={() => setActiveTab('arrhenius')}
        >
          <span className="tab-icon">📈</span>
          <span className="tab-label">Arrhenius</span>
          <span className="tab-desc">แม่นยำสูง</span>
        </button>
        <button
          className={`shelf-tab ${activeTab === 'water-activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('water-activity')}
        >
          <span className="tab-icon">💧</span>
          <span className="tab-label">Water Activity</span>
          <span className="tab-desc">ประเมินความเสี่ยง</span>
        </button>
      </div>

      <div className="shelf-content">
        {/* ===== Q10 Method ===== */}
        {activeTab === 'q10' && (
          <div className="shelf-method q10-method">
            <div className="method-info">
              <h3>📖 Q10 Method</h3>
              <p>
                วิธีประเมินอายุการเก็บจากความสัมพันธ์ระหว่างอุณหภูมิและอัตราการเสื่อมสภาพ
                โดย Q10 คืออัตราส่วนของอัตราการเกิดปฏิกิริยาเมื่ออุณหภูมิเพิ่มขึ้น 10°C
              </p>
            </div>

            <div className="method-form">
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <span className="label-icon">📅</span>
                    อายุการเก็บที่ทราบ (วัน)
                  </label>
                  <input
                    type="number"
                    value={q10Data.knownShelfLife}
                    onChange={(e) => setQ10Data(prev => ({ ...prev, knownShelfLife: parseFloat(e.target.value) || 0 }))}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>
                    <span className="label-icon">🌡️</span>
                    อุณหภูมิทดสอบ (°C)
                  </label>
                  <input
                    type="number"
                    value={q10Data.knownTemp}
                    onChange={(e) => setQ10Data(prev => ({ ...prev, knownTemp: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <span className="label-icon">🎯</span>
                    อุณหภูมิเป้าหมาย (°C)
                  </label>
                  <input
                    type="number"
                    value={q10Data.targetTemp}
                    onChange={(e) => setQ10Data(prev => ({ ...prev, targetTemp: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <span className="label-icon">📊</span>
                    ค่า Q10
                  </label>
                  <select
                    value={q10Data.q10Value}
                    onChange={(e) => setQ10Data(prev => ({ ...prev, q10Value: parseFloat(e.target.value) }))}
                  >
                    <option value="1.5">1.5 (ปฏิกิริยาช้า)</option>
                    <option value="2">2.0 (ทั่วไป)</option>
                    <option value="2.5">2.5 (ปฏิกิริยาปานกลาง)</option>
                    <option value="3">3.0 (ปฏิกิริยาเร็ว)</option>
                    <option value="4">4.0 (ปฏิกิริยาเร็วมาก)</option>
                  </select>
                  <p className="form-hint">
                    Q10 = 2-3 สำหรับอาหารทั่วไป, 3-4 สำหรับอาหารที่ไวต่อความร้อน
                  </p>
                </div>
              </div>
            </div>

            {/* Q10 Formula Display */}
            <div className="formula-display">
              <h4>สูตรคำนวณ</h4>
              <div className="formula">
                t₂ = t₁ × Q10<sup>(T₁-T₂)/10</sup>
              </div>
              <div className="formula-values">
                <span>{q10Result.predictedDays} = {q10Data.knownShelfLife} × {q10Data.q10Value}<sup>({q10Data.knownTemp}-{q10Data.targetTemp})/10</sup></span>
              </div>
            </div>
          </div>
        )}

        {/* ===== Arrhenius Method ===== */}
        {activeTab === 'arrhenius' && (
          <div className="shelf-method arrhenius-method">
            <div className="method-info">
              <h3>📖 Arrhenius Equation</h3>
              <p>
                วิธีทำนายอายุการเก็บจากข้อมูล Accelerated Shelf Life Test (ASLT)
                โดยใช้ความสัมพันธ์ระหว่างอุณหภูมิกับอัตราการเสื่อมสภาพ
              </p>
            </div>

            <div className="method-form">
              <div className="test-points-header">
                <h4>ข้อมูลการทดสอบ ASLT</h4>
                <button className="add-point-btn" onClick={addTestPoint}>
                  <span>➕</span> เพิ่มจุดทดสอบ
                </button>
              </div>

              <div className="test-points-list">
                {arrheniusData.testPoints.map((point, index) => (
                  <div key={index} className="test-point-row">
                    <span className="point-number">#{index + 1}</span>
                    <div className="point-inputs">
                      <div className="point-input">
                        <label>อุณหภูมิ (°C)</label>
                        <input
                          type="number"
                          value={point.temp}
                          onChange={(e) => updateTestPoint(index, 'temp', e.target.value)}
                        />
                      </div>
                      <div className="point-input">
                        <label>อายุการเก็บ (วัน)</label>
                        <input
                          type="number"
                          value={point.shelfLife}
                          onChange={(e) => updateTestPoint(index, 'shelfLife', e.target.value)}
                        />
                      </div>
                    </div>
                    {arrheniusData.testPoints.length > 2 && (
                      <button 
                        className="remove-point-btn"
                        onClick={() => removeTestPoint(index)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-group target-temp">
                <label>
                  <span className="label-icon">🎯</span>
                  อุณหภูมิที่ต้องการทำนาย (°C)
                </label>
                <input
                  type="number"
                  value={arrheniusData.targetTemp}
                  onChange={(e) => setArrheniusData(prev => ({ ...prev, targetTemp: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Arrhenius Results */}
            <div className="arrhenius-results">
              <div className="arrhenius-params">
                <div className="param-card">
                  <span className="param-label">Activation Energy (Ea)</span>
                  <span className="param-value">{arrheniusResult.Ea} kJ/mol</span>
                </div>
                <div className="param-card">
                  <span className="param-label">Pre-exponential Factor (A)</span>
                  <span className="param-value">{arrheniusResult.A}</span>
                </div>
                <div className="param-card">
                  <span className="param-label">R²</span>
                  <span className="param-value">{arrheniusResult.rSquared}</span>
                </div>
              </div>

              {/* Simple Graph */}
              {arrheniusResult.graphData && arrheniusResult.graphData.length > 0 && (
                <div className="arrhenius-graph">
                  <h4>📊 กราฟความสัมพันธ์อุณหภูมิ-อายุการเก็บ</h4>
                  <div className="graph-container">
                    <div className="graph-y-axis">
                      <span>อายุ (วัน)</span>
                    </div>
                    <div className="graph-area">
                      {arrheniusResult.graphData.map((point, idx) => (
                        <div 
                          key={idx}
                          className="graph-bar"
                          style={{ 
                            height: `${Math.min(point.shelfLife / 365 * 100, 100)}%`,
                            left: `${(point.temp - 5) / 45 * 100}%`
                          }}
                          title={`${point.temp}°C: ${Math.round(point.shelfLife)} วัน`}
                        >
                          <span className="bar-value">{Math.round(point.shelfLife)}</span>
                        </div>
                      ))}
                      {/* Test Points */}
                      {arrheniusResult.testPoints && arrheniusResult.testPoints.map((point, idx) => (
                        <div 
                          key={`test-${idx}`}
                          className="graph-point"
                          style={{ 
                            bottom: `${Math.min(point.shelfLife / 365 * 100, 100)}%`,
                            left: `${(point.temp - 5) / 45 * 100}%`
                          }}
                          title={`ข้อมูลทดสอบ: ${point.temp}°C = ${point.shelfLife} วัน`}
                        />
                      ))}
                    </div>
                    <div className="graph-x-axis">
                      <span>5°C</span>
                      <span>15°C</span>
                      <span>25°C</span>
                      <span>35°C</span>
                      <span>45°C</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Water Activity Method ===== */}
        {activeTab === 'water-activity' && (
          <div className="shelf-method water-activity-method">
            <div className="method-info">
              <h3>📖 Water Activity Assessment</h3>
              <p>
                ประเมินอายุการเก็บและความเสี่ยงจากการเจริญของจุลินทรีย์
                โดยพิจารณาจาก aw, pH, อุณหภูมิ และปัจจัยอื่นๆ
              </p>
            </div>

            <div className="method-form">
              <div className="form-row">
                <div className="form-group">
                  <label>
                    <span className="label-icon">💧</span>
                    Water Activity (aw)
                  </label>
                  <input
                    type="number"
                    value={waterActivityData.aw}
                    onChange={(e) => setWaterActivityData(prev => ({ ...prev, aw: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <div 
                    className="aw-indicator"
                    style={{ backgroundColor: waterActivityResult.awCategory.color }}
                  >
                    {waterActivityResult.awCategory.name}
                  </div>
                </div>
                <div className="form-group">
                  <label>
                    <span className="label-icon">🧪</span>
                    pH
                  </label>
                  <input
                    type="number"
                    value={waterActivityData.pH}
                    onChange={(e) => setWaterActivityData(prev => ({ ...prev, pH: parseFloat(e.target.value) || 0 }))}
                    min="0"
                    max="14"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <span className="label-icon">🌡️</span>
                    อุณหภูมิเก็บรักษา (°C)
                  </label>
                  <input
                    type="number"
                    value={waterActivityData.temperature}
                    onChange={(e) => setWaterActivityData(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <span className="label-icon">📦</span>
                    ประเภทบรรจุภัณฑ์
                  </label>
                  <select
                    value={waterActivityData.packaging}
                    onChange={(e) => setWaterActivityData(prev => ({ ...prev, packaging: e.target.value }))}
                  >
                    <option value="normal">บรรจุภัณฑ์ปกติ</option>
                    <option value="vacuum">สุญญากาศ (Vacuum)</option>
                    <option value="modified-atmosphere">MAP</option>
                    <option value="nitrogen">บรรจุไนโตรเจน</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <span className="label-icon">🍽️</span>
                    ประเภทผลิตภัณฑ์
                  </label>
                  <select
                    value={waterActivityData.productType}
                    onChange={(e) => setWaterActivityData(prev => ({ ...prev, productType: e.target.value }))}
                  >
                    <option value="fresh">สด (Fresh)</option>
                    <option value="semi-dried">กึ่งแห้ง (Semi-dried)</option>
                    <option value="dried">แห้ง (Dried)</option>
                    <option value="frozen">แช่แข็ง (Frozen)</option>
                  </select>
                </div>
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={waterActivityData.preservatives}
                      onChange={(e) => setWaterActivityData(prev => ({ ...prev, preservatives: e.target.checked }))}
                    />
                    <span>ใช้สารกันเสีย</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Water Activity Scale */}
            <div className="aw-scale">
              <h4>📊 มาตรวัด Water Activity</h4>
              <div className="scale-bar">
                <div className="scale-gradient"></div>
                <div 
                  className="scale-pointer"
                  style={{ left: `${waterActivityData.aw * 100}%` }}
                >
                  <span>{waterActivityData.aw}</span>
                </div>
                <div className="scale-labels">
                  <span>0.0</span>
                  <span>0.3</span>
                  <span>0.5</span>
                  <span>0.6</span>
                  <span>0.7</span>
                  <span>0.85</span>
                  <span>1.0</span>
                </div>
                <div className="scale-zones">
                  <span className="zone zone-safe">ปลอดภัย</span>
                  <span className="zone zone-mold">รา/ยีสต์</span>
                  <span className="zone zone-bacteria">แบคทีเรีย</span>
                </div>
              </div>
              <p className="scale-note">
                <strong>จุลินทรีย์ที่อาจเจริญได้:</strong> {waterActivityResult.awCategory.organisms}
              </p>
            </div>

            {/* Risk Assessment */}
            <div className="risk-assessment">
              <h4>⚠️ การประเมินความเสี่ยง</h4>
              <div 
                className="risk-level"
                style={{ backgroundColor: getRiskColor(waterActivityResult.riskLevel) }}
              >
                ความเสี่ยง: {getRiskLabel(waterActivityResult.riskLevel)}
              </div>
              
              {waterActivityResult.riskFactors && waterActivityResult.riskFactors.length > 0 && (
                <div className="risk-factors">
                  <h5>🔴 ปัจจัยเสี่ยง:</h5>
                  <ul>
                    {waterActivityResult.riskFactors.map((factor, idx) => (
                      <li key={idx}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {waterActivityResult.recommendations && waterActivityResult.recommendations.length > 0 && (
                <div className="recommendations">
                  <h5>💡 คำแนะนำ:</h5>
                  <ul>
                    {waterActivityResult.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Result Card ===== */}
        <div className="shelf-result-card">
          <div className="result-header">
            <span className="result-icon">📅</span>
            <h3>ผลการคำนวณอายุการเก็บรักษา</h3>
          </div>
          <div className="result-values">
            <div className="result-main">
              <span className="result-number">{currentResult.predictedDays}</span>
              <span className="result-unit">วัน</span>
            </div>
            <div className="result-secondary">
              <div className="result-item">
                <span className="item-value">{currentResult.predictedWeeks}</span>
                <span className="item-label">สัปดาห์</span>
              </div>
              <div className="result-item">
                <span className="item-value">{currentResult.predictedMonths}</span>
                <span className="item-label">เดือน</span>
              </div>
            </div>
          </div>
          {activeTab === 'q10' && (
            <div className="result-note">
              ตัวคูณ: ×{q10Result.factor}
            </div>
          )}
        </div>
      </div>

      {/* ===== Saved Tests ===== */}
      {savedTests.length > 0 && (
        <div className="saved-tests-section">
          <h3>📋 ประวัติการทดสอบ</h3>
          <div className="saved-tests-list">
            {savedTests.slice(0, 5).map(test => (
              <div key={test.id} className="saved-test-card">
                <div className="test-info">
                  <span className="test-name">{test.name}</span>
                  <span className="test-method">{test.method}</span>
                </div>
                <div className="test-result">
                  <span className="test-days">{test.result?.predictedDays} วัน</span>
                </div>
                <button 
                  className="test-delete-btn"
                  onClick={() => handleDeleteTest(test.id)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Save Modal ===== */}
      {showSaveModal && (
        <div className="shelf-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="shelf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shelf-modal-header">
              <h3>💾 บันทึกผลการทดสอบ</h3>
              <button className="modal-close" onClick={() => setShowSaveModal(false)}>✕</button>
            </div>
            <div className="shelf-modal-body">
              <div className="form-group">
                <label>ชื่อการทดสอบ</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="เช่น ก๋วยเตี๋ยวสุโขทัย Batch 1"
                  autoFocus
                />
              </div>
              <div className="save-preview">
                <div className="preview-item">
                  <span>วิธีการ:</span>
                  <span>{activeTab === 'q10' ? 'Q10 Method' : activeTab === 'arrhenius' ? 'Arrhenius' : 'Water Activity'}</span>
                </div>
                <div className="preview-item">
                  <span>อายุการเก็บ:</span>
                  <span className="preview-result">{currentResult.predictedDays} วัน</span>
                </div>
              </div>
            </div>
            <div className="shelf-modal-footer">
              <button className="btn-cancel" onClick={() => setShowSaveModal(false)}>
                ยกเลิก
              </button>
              <button 
                className="btn-save" 
                onClick={handleSaveTest}
                disabled={loading}
              >
                {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShelfLifeCalculator;
