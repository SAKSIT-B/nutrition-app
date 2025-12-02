// src/pages/StatisticsAnalysis.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

const StatisticsAnalysis = () => {
  const { showToast } = useToast();
  
  // State สำหรับข้อมูล
  const [experimentName, setExperimentName] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [results, setResults] = useState(null);
  const [dataGroups, setDataGroups] = useState([
    { id: 1, name: 'กลุ่มที่ 1', data: '', results: null }
  ]);

  // ฟังก์ชันคำนวณสถิติ
  const calculateStats = (numbers) => {
    if (!numbers || numbers.length === 0) return null;

    const n = numbers.length;
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    // Variance และ SD (Sample)
    const squaredDiffs = numbers.map(x => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / (n - 1);
    const sd = Math.sqrt(variance);
    
    // Standard Error
    const se = sd / Math.sqrt(n);
    
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = max - min;
    
    // Median
    const sorted = [...numbers].sort((a, b) => a - b);
    const median = n % 2 === 0 
      ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
      : sorted[Math.floor(n/2)];

    return {
      n,
      sum: sum.toFixed(4),
      mean: mean.toFixed(4),
      variance: variance.toFixed(4),
      sd: sd.toFixed(4),
      se: se.toFixed(4),
      min: min.toFixed(4),
      max: max.toFixed(4),
      range: range.toFixed(4),
      median: median.toFixed(4),
      rawData: numbers
    };
  };

  // แปลง input เป็น array ตัวเลข
  const parseInput = (input) => {
    if (!input.trim()) return [];
    
    // รองรับทั้ง comma, space, newline, tab
    const numbers = input
      .split(/[,\s\n\t]+/)
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(s => parseFloat(s))
      .filter(n => !isNaN(n));
    
    return numbers;
  };

  // วิเคราะห์ข้อมูลกลุ่มเดียว
  const analyzeSimple = () => {
    const numbers = parseInput(rawInput);
    
    if (numbers.length < 2) {
      showToast('กรุณาป้อนข้อมูลอย่างน้อย 2 ค่า', 'error');
      return;
    }

    const stats = calculateStats(numbers);
    setResults(stats);
    showToast('วิเคราะห์ข้อมูลเรียบร้อย', 'success');
  };

  // เพิ่มกลุ่มข้อมูล
  const addGroup = () => {
    const newId = dataGroups.length + 1;
    setDataGroups([
      ...dataGroups,
      { id: newId, name: `กลุ่มที่ ${newId}`, data: '', results: null }
    ]);
  };

  // ลบกลุ่มข้อมูล
  const removeGroup = (id) => {
    if (dataGroups.length <= 1) {
      showToast('ต้องมีอย่างน้อย 1 กลุ่ม', 'error');
      return;
    }
    setDataGroups(dataGroups.filter(g => g.id !== id));
  };

  // อัพเดทกลุ่มข้อมูล
  const updateGroup = (id, field, value) => {
    setDataGroups(dataGroups.map(g => 
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  // วิเคราะห์หลายกลุ่ม
  const analyzeGroups = () => {
    let hasError = false;
    
    const updatedGroups = dataGroups.map(group => {
      const numbers = parseInput(group.data);
      
      if (numbers.length < 2) {
        hasError = true;
        return { ...group, results: null };
      }
      
      return { ...group, results: calculateStats(numbers) };
    });

    if (hasError) {
      showToast('บางกลุ่มมีข้อมูลไม่ครบ (ต้องมีอย่างน้อย 2 ค่า)', 'error');
    }

    setDataGroups(updatedGroups);
    showToast('วิเคราะห์ข้อมูลเรียบร้อย', 'success');
  };

  // ล้างข้อมูลทั้งหมด
  const clearAll = () => {
    setExperimentName('');
    setRawInput('');
    setResults(null);
    setDataGroups([{ id: 1, name: 'กลุ่มที่ 1', data: '', results: null }]);
    showToast('ล้างข้อมูลเรียบร้อย', 'info');
  };

  // Export Excel สำหรับข้อมูลกลุ่มเดียว
  const exportSimpleExcel = () => {
    if (!results) {
      showToast('ไม่มีข้อมูลให้ส่งออก', 'error');
      return;
    }

    const wsData = [
      ['การวิเคราะห์ข้อมูลทางสถิติเบื้องต้น'],
      [''],
      ['ชื่อการทดลอง', experimentName || '-'],
      ['วันที่วิเคราะห์', new Date().toLocaleDateString('th-TH')],
      [''],
      ['ผลการวิเคราะห์'],
      ['รายการ', 'ค่า'],
      ['จำนวนข้อมูล (n)', results.n],
      ['ผลรวม (Sum)', results.sum],
      ['ค่าเฉลี่ย (Mean)', results.mean],
      ['มัธยฐาน (Median)', results.median],
      ['ความแปรปรวน (Variance)', results.variance],
      ['ส่วนเบี่ยงเบนมาตรฐาน (SD)', results.sd],
      ['ความคลาดเคลื่อนมาตรฐาน (SE)', results.se],
      ['ค่าต่ำสุด (Min)', results.min],
      ['ค่าสูงสุด (Max)', results.max],
      ['พิสัย (Range)', results.range],
      [''],
      ['ข้อมูลดิบ'],
      ...results.rawData.map((d, i) => [i + 1, d])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ผลวิเคราะห์');
    
    const fileName = `สถิติ_${experimentName || 'ข้อมูล'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ส่งออกไฟล์ Excel เรียบร้อย', 'success');
  };

  // Export Excel สำหรับหลายกลุ่ม
  const exportGroupsExcel = () => {
    const groupsWithResults = dataGroups.filter(g => g.results);
    
    if (groupsWithResults.length === 0) {
      showToast('ไม่มีข้อมูลให้ส่งออก', 'error');
      return;
    }

    // สร้างตารางสรุป
    const summaryData = [
      ['การวิเคราะห์ข้อมูลทางสถิติเบื้องต้น - เปรียบเทียบหลายกลุ่ม'],
      [''],
      ['ชื่อการทดลอง', experimentName || '-'],
      ['วันที่วิเคราะห์', new Date().toLocaleDateString('th-TH')],
      [''],
      ['ตารางสรุปผล'],
      ['กลุ่ม', 'n', 'Mean', 'SD', 'SE', 'Min', 'Max', 'Median'],
      ...groupsWithResults.map(g => [
        g.name,
        g.results.n,
        g.results.mean,
        g.results.sd,
        g.results.se,
        g.results.min,
        g.results.max,
        g.results.median
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปผล');

    // เพิ่ม sheet สำหรับแต่ละกลุ่ม
    groupsWithResults.forEach(g => {
      const groupData = [
        [g.name],
        [''],
        ['รายการ', 'ค่า'],
        ['จำนวนข้อมูล (n)', g.results.n],
        ['ค่าเฉลี่ย (Mean)', g.results.mean],
        ['ส่วนเบี่ยงเบนมาตรฐาน (SD)', g.results.sd],
        ['ความคลาดเคลื่อนมาตรฐาน (SE)', g.results.se],
        ['ค่าต่ำสุด (Min)', g.results.min],
        ['ค่าสูงสุด (Max)', g.results.max],
        ['มัธยฐาน (Median)', g.results.median],
        [''],
        ['ข้อมูลดิบ'],
        ...g.results.rawData.map((d, i) => [i + 1, d])
      ];
      const groupWs = XLSX.utils.aoa_to_sheet(groupData);
      XLSX.utils.book_append_sheet(wb, groupWs, g.name.slice(0, 31));
    });

    const fileName = `สถิติเปรียบเทียบ_${experimentName || 'ข้อมูล'}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ส่งออกไฟล์ Excel เรียบร้อย', 'success');
  };

  // State สำหรับ Tab
  const [activeTab, setActiveTab] = useState('simple'); // 'simple' หรือ 'groups'

  return (
    <div className="card stats-page">
      {/* Header */}
      <div className="stats-header">
        <div className="stats-header-info">
          <h2 className="page-title">
            <span className="title-icon">📊</span>
            วิเคราะห์ข้อมูลทางสถิติ
          </h2>
          <p className="card-subtitle">
            คำนวณค่าสถิติพื้นฐาน: Mean, SD, SE, Min, Max, Median
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="stats-tabs">
        <button 
          className={`stats-tab ${activeTab === 'simple' ? 'active' : ''}`}
          onClick={() => setActiveTab('simple')}
        >
          📝 วิเคราะห์กลุ่มเดียว
        </button>
        <button 
          className={`stats-tab ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          📊 เปรียบเทียบหลายกลุ่ม
        </button>
      </div>

      {/* ชื่อการทดลอง */}
      <div className="stats-experiment-name">
        <label>ชื่อการทดลอง / ชื่อข้อมูล</label>
        <input
          type="text"
          value={experimentName}
          onChange={(e) => setExperimentName(e.target.value)}
          placeholder="เช่น ประเมินความชอบก๋วยเตี๋ยวสูตร A"
        />
      </div>

      {/* Tab Content: กลุ่มเดียว */}
      {activeTab === 'simple' && (
        <div className="stats-simple-mode">
          <div className="stats-input-section">
            <label>ป้อนข้อมูลตัวเลข (คั่นด้วย , หรือ เว้นวรรค หรือ Enter)</label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="เช่น 7, 8, 6, 7, 8, 9, 7, 8, 7, 6&#10;หรือ&#10;7&#10;8&#10;6&#10;7"
              rows={6}
            />
            <div className="stats-input-hint">
              จำนวนข้อมูลที่ป้อน: {parseInput(rawInput).length} ค่า
            </div>
          </div>

          <div className="stats-actions">
            <button className="stats-btn primary" onClick={analyzeSimple}>
              🔬 วิเคราะห์ข้อมูล
            </button>
            <button className="stats-btn secondary" onClick={() => { setRawInput(''); setResults(null); }}>
              🔄 ล้างข้อมูล
            </button>
          </div>

          {/* ผลลัพธ์กลุ่มเดียว */}
          {results && (
            <div className="stats-results">
              <h3>📈 ผลการวิเคราะห์</h3>
              
              <div className="stats-results-grid">
                <div className="stats-result-item">
                  <span className="result-label">จำนวนข้อมูล (n)</span>
                  <span className="result-value">{results.n}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">ผลรวม (Sum)</span>
                  <span className="result-value">{results.sum}</span>
                </div>
                <div className="stats-result-item highlight">
                  <span className="result-label">ค่าเฉลี่ย (Mean)</span>
                  <span className="result-value">{results.mean}</span>
                </div>
                <div className="stats-result-item highlight">
                  <span className="result-label">ส่วนเบี่ยงเบนมาตรฐาน (SD)</span>
                  <span className="result-value">{results.sd}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">ความคลาดเคลื่อนมาตรฐาน (SE)</span>
                  <span className="result-value">{results.se}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">ความแปรปรวน (Variance)</span>
                  <span className="result-value">{results.variance}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">ค่าต่ำสุด (Min)</span>
                  <span className="result-value">{results.min}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">ค่าสูงสุด (Max)</span>
                  <span className="result-value">{results.max}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">พิสัย (Range)</span>
                  <span className="result-value">{results.range}</span>
                </div>
                <div className="stats-result-item">
                  <span className="result-label">มัธยฐาน (Median)</span>
                  <span className="result-value">{results.median}</span>
                </div>
              </div>

              <div className="stats-export">
                <button className="stats-btn export" onClick={exportSimpleExcel}>
                  📥 ส่งออก Excel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: หลายกลุ่ม */}
      {activeTab === 'groups' && (
        <div className="stats-groups-mode">
          <div className="stats-groups-list">
            {dataGroups.map((group, index) => (
              <div key={group.id} className="stats-group-card">
                <div className="stats-group-header">
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                    className="stats-group-name"
                    placeholder="ชื่อกลุ่ม"
                  />
                  {dataGroups.length > 1 && (
                    <button 
                      className="stats-group-remove"
                      onClick={() => removeGroup(group.id)}
                    >
                      ✕
                    </button>
                  )}
                </div>
                
                <textarea
                  value={group.data}
                  onChange={(e) => updateGroup(group.id, 'data', e.target.value)}
                  placeholder="ป้อนข้อมูลตัวเลข..."
                  rows={4}
                />
                
                <div className="stats-group-count">
                  จำนวน: {parseInput(group.data).length} ค่า
                </div>

                {/* ผลลัพธ์ของกลุ่ม */}
                {group.results && (
                  <div className="stats-group-results">
                    <div className="mini-result">
                      <span>Mean:</span> <strong>{group.results.mean}</strong>
                    </div>
                    <div className="mini-result">
                      <span>SD:</span> <strong>{group.results.sd}</strong>
                    </div>
                    <div className="mini-result">
                      <span>n:</span> <strong>{group.results.n}</strong>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="stats-btn add-group" onClick={addGroup}>
            ➕ เพิ่มกลุ่ม
          </button>

          <div className="stats-actions">
            <button className="stats-btn primary" onClick={analyzeGroups}>
              🔬 วิเคราะห์ทุกกลุ่ม
            </button>
            <button className="stats-btn secondary" onClick={clearAll}>
              🔄 ล้างทั้งหมด
            </button>
          </div>

          {/* ตารางสรุปผลเปรียบเทียบ */}
          {dataGroups.some(g => g.results) && (
            <div className="stats-comparison-table">
              <h3>📋 ตารางสรุปผลเปรียบเทียบ</h3>
              
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>กลุ่ม</th>
                      <th>n</th>
                      <th>Mean</th>
                      <th>SD</th>
                      <th>SE</th>
                      <th>Min</th>
                      <th>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataGroups.filter(g => g.results).map(group => (
                      <tr key={group.id}>
                        <td>{group.name}</td>
                        <td>{group.results.n}</td>
                        <td><strong>{group.results.mean}</strong></td>
                        <td>{group.results.sd}</td>
                        <td>{group.results.se}</td>
                        <td>{group.results.min}</td>
                        <td>{group.results.max}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="stats-export">
                <button className="stats-btn export" onClick={exportGroupsExcel}>
                  📥 ส่งออก Excel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* คำอธิบาย */}
      <div className="stats-info">
        <h4>📚 คำอธิบายค่าสถิติ</h4>
        <div className="stats-info-grid">
          <div className="info-item">
            <strong>Mean (ค่าเฉลี่ย)</strong>
            <p>ผลรวมของข้อมูลทั้งหมดหารด้วยจำนวนข้อมูล</p>
          </div>
          <div className="info-item">
            <strong>SD (ส่วนเบี่ยงเบนมาตรฐาน)</strong>
            <p>วัดการกระจายของข้อมูลรอบค่าเฉลี่ย (Sample SD)</p>
          </div>
          <div className="info-item">
            <strong>SE (ความคลาดเคลื่อนมาตรฐาน)</strong>
            <p>SD หารด้วยรากที่สองของ n แสดงความแม่นยำของค่าเฉลี่ย</p>
          </div>
          <div className="info-item">
            <strong>Median (มัธยฐาน)</strong>
            <p>ค่ากลางเมื่อเรียงข้อมูลจากน้อยไปมาก</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsAnalysis;
