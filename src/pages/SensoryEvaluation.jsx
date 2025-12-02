// src/pages/SensoryEvaluation.jsx
// วิเคราะห์ทางประสาทสัมผัส พร้อม One-Way ANOVA และ Duncan's MRT

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';

// หัวข้อประเมินมาตรฐาน
const DEFAULT_ATTRIBUTES = [
  { id: 'color', name: 'สี (Color)', enabled: true },
  { id: 'odor', name: 'กลิ่น (Odor)', enabled: true },
  { id: 'taste', name: 'รสชาติ (Taste)', enabled: true },
  { id: 'texture', name: 'เนื้อสัมผัส (Texture)', enabled: true },
  { id: 'overall', name: 'ความชอบโดยรวม (Overall Liking)', enabled: true },
];

const SensoryEvaluation = () => {
  const { showToast } = useToast();

  // State หลัก
  const [experimentName, setExperimentName] = useState('');
  const [numSamples, setNumSamples] = useState(3);
  const [sampleNames, setSampleNames] = useState(['สูตร A', 'สูตร B', 'สูตร C']);
  const [attributes, setAttributes] = useState(DEFAULT_ATTRIBUTES);
  const [data, setData] = useState({}); // { 'สูตร A': { 'color': [7,8,6,...], 'odor': [...] } }
  const [results, setResults] = useState(null);
  const [significanceLevel, setSignificanceLevel] = useState(0.05);

  // อัพเดทจำนวนสูตร
  const handleNumSamplesChange = (num) => {
    const n = Math.max(2, Math.min(10, parseInt(num) || 2));
    setNumSamples(n);
    
    const newNames = [...sampleNames];
    while (newNames.length < n) {
      newNames.push(`สูตร ${String.fromCharCode(65 + newNames.length)}`);
    }
    setSampleNames(newNames.slice(0, n));
  };

  // อัพเดทชื่อสูตร
  const handleSampleNameChange = (index, name) => {
    const newNames = [...sampleNames];
    newNames[index] = name;
    setSampleNames(newNames);
  };

  // Toggle หัวข้อประเมิน
  const toggleAttribute = (id) => {
    setAttributes(attributes.map(attr =>
      attr.id === id ? { ...attr, enabled: !attr.enabled } : attr
    ));
  };

  // เพิ่มหัวข้อใหม่
  const [newAttribute, setNewAttribute] = useState('');
  const addAttribute = () => {
    if (!newAttribute.trim()) return;
    const id = `custom_${Date.now()}`;
    setAttributes([...attributes, { id, name: newAttribute.trim(), enabled: true }]);
    setNewAttribute('');
  };

  // ลบหัวข้อ custom
  const removeAttribute = (id) => {
    if (!id.startsWith('custom_')) return;
    setAttributes(attributes.filter(attr => attr.id !== id));
  };

  // อัพเดทข้อมูล
  const handleDataChange = (sampleName, attrId, value) => {
    setData(prev => ({
      ...prev,
      [sampleName]: {
        ...(prev[sampleName] || {}),
        [attrId]: value
      }
    }));
  };

  // แปลง input เป็น array ตัวเลข
  const parseInput = (input) => {
    if (!input || !input.trim()) return [];
    return input
      .split(/[,\s\n\t]+/)
      .map(s => s.trim())
      .filter(s => s !== '')
      .map(s => parseFloat(s))
      .filter(n => !isNaN(n));
  };

  // คำนวณสถิติพื้นฐาน
  const calculateBasicStats = (numbers) => {
    if (!numbers || numbers.length === 0) return null;
    const n = numbers.length;
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
    const sd = Math.sqrt(variance);
    const se = sd / Math.sqrt(n);
    return { n, sum, mean, sd, se, variance };
  };

  // One-Way ANOVA
  const calculateANOVA = (groups) => {
    // groups = [[data1], [data2], [data3], ...]
    const k = groups.length; // จำนวนกลุ่ม
    const allData = groups.flat();
    const N = allData.length; // จำนวนข้อมูลทั้งหมด
    
    if (N === 0 || k < 2) return null;

    // Grand mean
    const grandMean = allData.reduce((a, b) => a + b, 0) / N;

    // Group means and sizes
    const groupStats = groups.map(g => ({
      n: g.length,
      mean: g.reduce((a, b) => a + b, 0) / g.length,
      data: g
    }));

    // SSB (Sum of Squares Between groups)
    const SSB = groupStats.reduce((acc, g) => 
      acc + g.n * Math.pow(g.mean - grandMean, 2), 0
    );

    // SSW (Sum of Squares Within groups)
    const SSW = groupStats.reduce((acc, g) => 
      acc + g.data.reduce((a, val) => a + Math.pow(val - g.mean, 2), 0), 0
    );

    // SST (Total Sum of Squares)
    const SST = SSB + SSW;

    // Degrees of freedom
    const dfB = k - 1;
    const dfW = N - k;
    const dfT = N - 1;

    // Mean Squares
    const MSB = SSB / dfB;
    const MSW = SSW / dfW;

    // F-statistic
    const F = MSB / MSW;

    // p-value (approximation using F-distribution)
    const pValue = calculatePValue(F, dfB, dfW);

    return {
      SSB, SSW, SST,
      dfB, dfW, dfT,
      MSB, MSW,
      F,
      pValue,
      significant: pValue < significanceLevel
    };
  };

  // คำนวณ p-value จาก F-distribution (approximation)
  const calculatePValue = (F, df1, df2) => {
    // ใช้ approximation formula
    if (F <= 0) return 1;
    
    const x = df2 / (df2 + df1 * F);
    const a = df2 / 2;
    const b = df1 / 2;
    
    // Beta incomplete function approximation
    const betaInc = incompleteBeta(x, a, b);
    return betaInc;
  };

  // Incomplete Beta Function (approximation)
  const incompleteBeta = (x, a, b) => {
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // Simple approximation using continued fraction
    const maxIterations = 200;
    const epsilon = 1e-10;
    
    let result = 0;
    let term = 1;
    
    for (let n = 0; n < maxIterations; n++) {
      if (n === 0) {
        term = Math.pow(x, a) * Math.pow(1 - x, b) / a;
        term *= gamma(a + b) / (gamma(a) * gamma(b));
      } else {
        term *= (a + b + n - 1) * x / (a + n);
      }
      result += term;
      if (Math.abs(term) < epsilon) break;
    }
    
    return Math.min(1, Math.max(0, result));
  };

  // Gamma function (Stirling's approximation)
  const gamma = (z) => {
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    z -= 1;
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    let x = c[0];
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (z + i);
    }
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  };

  // Duncan's Multiple Range Test
  const calculateDuncan = (groups, groupNames, MSW, dfW) => {
    const k = groups.length;
    
    // คำนวณ mean และ n ของแต่ละกลุ่ม
    const groupStats = groups.map((g, i) => ({
      name: groupNames[i],
      n: g.length,
      mean: g.reduce((a, b) => a + b, 0) / g.length,
      data: g
    }));

    // เรียงตาม mean จากมากไปน้อย
    groupStats.sort((a, b) => b.mean - a.mean);

    // Harmonic mean of sample sizes
    const nHarmonic = k / groupStats.reduce((acc, g) => acc + 1 / g.n, 0);

    // Standard error
    const SE = Math.sqrt(MSW / nHarmonic);

    // Duncan's critical values (approximation for α = 0.05)
    // ค่า q สำหรับ Duncan's test (simplified)
    const getDuncanQ = (p, df) => {
      // Approximation of Duncan's q values
      const qTable = {
        2: 2.77, 3: 2.92, 4: 3.02, 5: 3.09,
        6: 3.15, 7: 3.19, 8: 3.23, 9: 3.26, 10: 3.29
      };
      return qTable[Math.min(p, 10)] || 2.77;
    };

    // กำหนดกลุ่มตัวอักษร
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const groupLetters = new Array(k).fill('');
    let currentLetter = 0;

    for (let i = 0; i < k; i++) {
      if (groupLetters[i] === '') {
        groupLetters[i] = letters[currentLetter];
      }

      for (let j = i + 1; j < k; j++) {
        const p = j - i + 1; // range
        const q = getDuncanQ(p, dfW);
        const criticalDiff = q * SE;
        const actualDiff = Math.abs(groupStats[i].mean - groupStats[j].mean);

        if (actualDiff < criticalDiff) {
          // ไม่แตกต่างกัน - ใช้ตัวอักษรเดียวกัน
          if (groupLetters[j] === '') {
            groupLetters[j] = groupLetters[i];
          } else if (!groupLetters[j].includes(groupLetters[i])) {
            groupLetters[j] += groupLetters[i];
          }
        }
      }
    }

    // ถ้ายังมีช่องว่าง ให้ใส่ตัวอักษรใหม่
    for (let i = 0; i < k; i++) {
      if (groupLetters[i] === '') {
        currentLetter++;
        groupLetters[i] = letters[currentLetter];
      }
    }

    // จัดเรียงตัวอักษรใหม่ให้ถูกต้อง
    const usedLetters = new Set();
    const finalLetters = new Array(k).fill('');
    let letterIndex = 0;

    for (let i = 0; i < k; i++) {
      let needNewLetter = true;
      
      // เช็คว่าควรได้ตัวอักษรเดียวกับกลุ่มก่อนหน้าไหม
      for (let j = 0; j < i; j++) {
        const p = i - j + 1;
        const q = getDuncanQ(p, dfW);
        const criticalDiff = q * SE;
        const actualDiff = Math.abs(groupStats[j].mean - groupStats[i].mean);
        
        if (actualDiff < criticalDiff) {
          // ไม่แตกต่าง - ใช้ตัวอักษรร่วมกัน
          if (!finalLetters[i].includes(finalLetters[j][0])) {
            finalLetters[i] += finalLetters[j][0];
          }
          needNewLetter = false;
        }
      }
      
      if (needNewLetter && finalLetters[i] === '') {
        finalLetters[i] = letters[letterIndex];
        letterIndex++;
      } else if (finalLetters[i] === '') {
        finalLetters[i] = letters[letterIndex];
        letterIndex++;
      }
    }

    // สร้างผลลัพธ์
    return groupStats.map((g, i) => ({
      ...g,
      letter: finalLetters[i] || letters[i],
      se: SE
    }));
  };

  // วิเคราะห์ข้อมูลทั้งหมด
  const analyzeAll = () => {
    const enabledAttrs = attributes.filter(a => a.enabled);
    
    if (enabledAttrs.length === 0) {
      showToast('กรุณาเลือกหัวข้อประเมินอย่างน้อย 1 หัวข้อ', 'error');
      return;
    }

    const analysisResults = {};
    let hasData = false;

    enabledAttrs.forEach(attr => {
      const groups = [];
      const groupNames = [];
      let minN = Infinity;

      sampleNames.slice(0, numSamples).forEach(sample => {
        const rawData = data[sample]?.[attr.id] || '';
        const numbers = parseInput(rawData);
        
        if (numbers.length >= 2) {
          groups.push(numbers);
          groupNames.push(sample);
          minN = Math.min(minN, numbers.length);
          hasData = true;
        }
      });

      if (groups.length >= 2) {
        // สถิติพื้นฐาน
        const basicStats = groups.map((g, i) => ({
          name: groupNames[i],
          ...calculateBasicStats(g)
        }));

        // ANOVA
        const anova = calculateANOVA(groups);

        // Duncan's test (ถ้า ANOVA significant)
        let duncan = null;
        if (anova && anova.significant) {
          duncan = calculateDuncan(groups, groupNames, anova.MSW, anova.dfW);
        }

        analysisResults[attr.id] = {
          attributeName: attr.name,
          basicStats,
          anova,
          duncan,
          groupNames
        };
      }
    });

    if (!hasData) {
      showToast('กรุณาป้อนข้อมูลอย่างน้อย 2 สูตร และ 2 ค่าต่อสูตร', 'error');
      return;
    }

    setResults(analysisResults);
    showToast('วิเคราะห์ข้อมูลเรียบร้อย', 'success');
  };

  // ล้างข้อมูล
  const clearAll = () => {
    setData({});
    setResults(null);
    setExperimentName('');
    showToast('ล้างข้อมูลเรียบร้อย', 'info');
  };

  // Export Excel
  const exportExcel = () => {
    if (!results) {
      showToast('ไม่มีผลวิเคราะห์', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: สรุปผล
    const summaryData = [
      ['การวิเคราะห์ทางประสาทสัมผัส (Sensory Evaluation)'],
      [''],
      ['ชื่อการทดลอง', experimentName || '-'],
      ['วันที่วิเคราะห์', new Date().toLocaleDateString('th-TH')],
      ['ระดับนัยสำคัญ (α)', significanceLevel],
      [''],
      ['ตารางสรุป Mean ± SD'],
      ['หัวข้อ', ...sampleNames.slice(0, numSamples), 'F-value', 'p-value', 'ผล'],
    ];

    Object.values(results).forEach(r => {
      const row = [r.attributeName];
      r.basicStats.forEach(s => {
        row.push(`${s.mean.toFixed(2)} ± ${s.sd.toFixed(2)}`);
      });
      if (r.anova) {
        row.push(r.anova.F.toFixed(4));
        row.push(r.anova.pValue.toFixed(4));
        row.push(r.anova.significant ? 'แตกต่าง*' : 'ไม่แตกต่าง');
      }
      summaryData.push(row);
    });

    summaryData.push(['']);
    summaryData.push(['* มีนัยสำคัญทางสถิติที่ระดับ ' + significanceLevel]);

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'สรุปผล');

    // Sheet 2: ANOVA Details
    const anovaData = [
      ['ผลการวิเคราะห์ ANOVA'],
      [''],
    ];

    Object.values(results).forEach(r => {
      if (r.anova) {
        anovaData.push([r.attributeName]);
        anovaData.push(['Source', 'SS', 'df', 'MS', 'F', 'p-value']);
        anovaData.push([
          'Between Groups',
          r.anova.SSB.toFixed(4),
          r.anova.dfB,
          r.anova.MSB.toFixed(4),
          r.anova.F.toFixed(4),
          r.anova.pValue.toFixed(4)
        ]);
        anovaData.push([
          'Within Groups',
          r.anova.SSW.toFixed(4),
          r.anova.dfW,
          r.anova.MSW.toFixed(4),
          '',
          ''
        ]);
        anovaData.push([
          'Total',
          r.anova.SST.toFixed(4),
          r.anova.dfT,
          '',
          '',
          ''
        ]);
        anovaData.push(['']);
      }
    });

    const ws2 = XLSX.utils.aoa_to_sheet(anovaData);
    XLSX.utils.book_append_sheet(wb, ws2, 'ANOVA');

    // Sheet 3: Duncan's Test
    const duncanData = [
      ["Duncan's Multiple Range Test"],
      [''],
    ];

    Object.values(results).forEach(r => {
      if (r.duncan) {
        duncanData.push([r.attributeName]);
        duncanData.push(['สูตร', 'Mean', 'กลุ่ม']);
        r.duncan.forEach(d => {
          duncanData.push([d.name, d.mean.toFixed(2), d.letter]);
        });
        duncanData.push(['']);
        duncanData.push(['* ตัวอักษรเดียวกันหมายถึงไม่แตกต่างกันทางสถิติ']);
        duncanData.push(['']);
      }
    });

    const ws3 = XLSX.utils.aoa_to_sheet(duncanData);
    XLSX.utils.book_append_sheet(wb, ws3, "Duncan's Test");

    const fileName = `Sensory_${experimentName || 'Analysis'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast('ส่งออก Excel เรียบร้อย', 'success');
  };

  // Import Excel
  const importExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // พยายามอ่านข้อมูล
        // Format: Row 1 = Headers (Sample names)
        // Row 2+ = Attribute name, data1, data2, data3...
        
        if (jsonData.length < 2) {
          showToast('ไฟล์ไม่มีข้อมูลเพียงพอ', 'error');
          return;
        }

        const headers = jsonData[0];
        const samples = headers.slice(1).filter(h => h);
        
        if (samples.length < 2) {
          showToast('ต้องมีอย่างน้อย 2 สูตร', 'error');
          return;
        }

        setNumSamples(samples.length);
        setSampleNames(samples);

        const newData = {};
        samples.forEach(s => { newData[s] = {}; });

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const attrName = row[0];
          if (!attrName) continue;

          // หา attribute ที่ตรงกัน หรือสร้างใหม่
          let attr = attributes.find(a => 
            a.name.toLowerCase().includes(attrName.toLowerCase()) ||
            attrName.toLowerCase().includes(a.id)
          );

          if (!attr) {
            const newId = `imported_${i}`;
            attr = { id: newId, name: attrName, enabled: true };
            setAttributes(prev => [...prev, attr]);
          }

          samples.forEach((sample, j) => {
            const cellData = row[j + 1];
            if (cellData !== undefined && cellData !== '') {
              newData[sample][attr.id] = String(cellData);
            }
          });
        }

        setData(newData);
        showToast('นำเข้าข้อมูลเรียบร้อย', 'success');
      } catch (error) {
        console.error(error);
        showToast('เกิดข้อผิดพลาดในการอ่านไฟล์', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // นับจำนวนข้อมูล
  const getDataCount = (sampleName, attrId) => {
    const rawData = data[sampleName]?.[attrId] || '';
    return parseInput(rawData).length;
  };

  return (
    <div className="card sensory-page">
      {/* Header */}
      <div className="sensory-header">
        <div className="sensory-header-info">
          <h2 className="page-title">
            <span className="title-icon">🧪</span>
            วิเคราะห์ทางประสาทสัมผัส
          </h2>
          <p className="card-subtitle">
            Sensory Evaluation with One-Way ANOVA & Duncan's Multiple Range Test
          </p>
        </div>
      </div>

      {/* การตั้งค่า */}
      <div className="sensory-settings">
        <div className="settings-row">
          <div className="setting-item">
            <label>ชื่อการทดลอง</label>
            <input
              type="text"
              value={experimentName}
              onChange={(e) => setExperimentName(e.target.value)}
              placeholder="เช่น ทดสอบความชอบก๋วยเตี๋ยวสุโขทัย"
            />
          </div>
          
          <div className="setting-item small">
            <label>จำนวนสูตร</label>
            <input
              type="number"
              min="2"
              max="10"
              value={numSamples}
              onChange={(e) => handleNumSamplesChange(e.target.value)}
            />
          </div>

          <div className="setting-item small">
            <label>ระดับนัยสำคัญ (α)</label>
            <select 
              value={significanceLevel} 
              onChange={(e) => setSignificanceLevel(parseFloat(e.target.value))}
            >
              <option value={0.05}>0.05</option>
              <option value={0.01}>0.01</option>
              <option value={0.10}>0.10</option>
            </select>
          </div>
        </div>

        {/* ชื่อสูตร */}
        <div className="sample-names">
          <label>ชื่อสูตร/ตัวอย่าง</label>
          <div className="sample-name-inputs">
            {sampleNames.slice(0, numSamples).map((name, i) => (
              <input
                key={i}
                type="text"
                value={name}
                onChange={(e) => handleSampleNameChange(i, e.target.value)}
                placeholder={`สูตร ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* หัวข้อประเมิน */}
      <div className="sensory-attributes">
        <label>หัวข้อประเมิน</label>
        <div className="attribute-list">
          {attributes.map(attr => (
            <div key={attr.id} className={`attribute-tag ${attr.enabled ? 'active' : ''}`}>
              <label>
                <input
                  type="checkbox"
                  checked={attr.enabled}
                  onChange={() => toggleAttribute(attr.id)}
                />
                {attr.name}
              </label>
              {attr.id.startsWith('custom_') && (
                <button 
                  className="remove-attr"
                  onClick={() => removeAttribute(attr.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        
        <div className="add-attribute">
          <input
            type="text"
            value={newAttribute}
            onChange={(e) => setNewAttribute(e.target.value)}
            placeholder="เพิ่มหัวข้อใหม่..."
            onKeyPress={(e) => e.key === 'Enter' && addAttribute()}
          />
          <button onClick={addAttribute}>➕ เพิ่ม</button>
        </div>
      </div>

      {/* ป้อนข้อมูล */}
      <div className="sensory-data-input">
        <div className="data-header">
          <h3>📝 ป้อนข้อมูลคะแนน</h3>
          <div className="data-actions">
            <label className="import-btn">
              📥 Import Excel
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={importExcel}
                hidden
              />
            </label>
          </div>
        </div>

        <p className="data-hint">
          ป้อนคะแนนคั่นด้วย , หรือ เว้นวรรค (เช่น 7, 8, 6, 7, 8, 9)
        </p>

        <div className="data-grid">
          {attributes.filter(a => a.enabled).map(attr => (
            <div key={attr.id} className="data-row">
              <div className="data-row-header">
                <span className="attr-name">{attr.name}</span>
              </div>
              <div className="data-row-inputs">
                {sampleNames.slice(0, numSamples).map((sample, i) => (
                  <div key={i} className="data-cell">
                    <div className="cell-header">
                      <span>{sample}</span>
                      <span className="data-count">
                        n={getDataCount(sample, attr.id)}
                      </span>
                    </div>
                    <textarea
                      value={data[sample]?.[attr.id] || ''}
                      onChange={(e) => handleDataChange(sample, attr.id, e.target.value)}
                      placeholder="7, 8, 6, 7..."
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ปุ่มวิเคราะห์ */}
      <div className="sensory-actions">
        <button className="sensory-btn primary" onClick={analyzeAll}>
          🔬 วิเคราะห์ ANOVA & Duncan
        </button>
        <button className="sensory-btn secondary" onClick={clearAll}>
          🔄 ล้างข้อมูล
        </button>
      </div>

      {/* ผลลัพธ์ */}
      {results && (
        <div className="sensory-results">
          <div className="results-header">
            <h3>📊 ผลการวิเคราะห์</h3>
            <button className="sensory-btn export" onClick={exportExcel}>
              📥 Export Excel
            </button>
          </div>

          {/* ตารางสรุป Mean ± SD */}
          <div className="result-section">
            <h4>ตารางสรุป Mean ± SD</h4>
            <div className="table-wrapper">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>หัวข้อ</th>
                    {sampleNames.slice(0, numSamples).map((s, i) => (
                      <th key={i}>{s}</th>
                    ))}
                    <th>F-value</th>
                    <th>p-value</th>
                    <th>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(results).map((r, i) => (
                    <tr key={i}>
                      <td className="attr-cell">{r.attributeName}</td>
                      {r.basicStats.map((s, j) => (
                        <td key={j} className="mean-cell">
                          {s.mean.toFixed(2)} ± {s.sd.toFixed(2)}
                          <span className="n-label">(n={s.n})</span>
                        </td>
                      ))}
                      <td className="stat-cell">{r.anova?.F.toFixed(2) || '-'}</td>
                      <td className="stat-cell">
                        {r.anova?.pValue.toFixed(4) || '-'}
                        {r.anova?.pValue < 0.01 && '**'}
                        {r.anova?.pValue >= 0.01 && r.anova?.pValue < 0.05 && '*'}
                      </td>
                      <td className={`result-cell ${r.anova?.significant ? 'significant' : ''}`}>
                        {r.anova?.significant ? '✓ แตกต่าง' : '✗ ไม่แตกต่าง'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">* p &lt; 0.05, ** p &lt; 0.01</p>
          </div>

          {/* Duncan's Test Results */}
          {Object.values(results).some(r => r.duncan) && (
            <div className="result-section">
              <h4>ผล Duncan's Multiple Range Test</h4>
              <p className="duncan-note">
                (เฉพาะหัวข้อที่มีความแตกต่างอย่างมีนัยสำคัญ)
              </p>
              
              <div className="duncan-results">
                {Object.values(results).filter(r => r.duncan).map((r, i) => (
                  <div key={i} className="duncan-card">
                    <h5>{r.attributeName}</h5>
                    <table className="duncan-table">
                      <thead>
                        <tr>
                          <th>ลำดับ</th>
                          <th>สูตร</th>
                          <th>Mean</th>
                          <th>กลุ่ม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.duncan.map((d, j) => (
                          <tr key={j}>
                            <td>{j + 1}</td>
                            <td>{d.name}</td>
                            <td>{d.mean.toFixed(2)}</td>
                            <td className="letter-cell">{d.letter}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="duncan-legend">
                      * ตัวอักษรเดียวกัน = ไม่แตกต่างกันทางสถิติที่ระดับ {significanceLevel}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ANOVA Table */}
          <div className="result-section collapsible">
            <details>
              <summary>📋 ตาราง ANOVA แบบละเอียด</summary>
              <div className="anova-details">
                {Object.values(results).map((r, i) => (
                  r.anova && (
                    <div key={i} className="anova-card">
                      <h5>{r.attributeName}</h5>
                      <table className="anova-table">
                        <thead>
                          <tr>
                            <th>Source</th>
                            <th>SS</th>
                            <th>df</th>
                            <th>MS</th>
                            <th>F</th>
                            <th>p-value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Between Groups</td>
                            <td>{r.anova.SSB.toFixed(4)}</td>
                            <td>{r.anova.dfB}</td>
                            <td>{r.anova.MSB.toFixed(4)}</td>
                            <td>{r.anova.F.toFixed(4)}</td>
                            <td>{r.anova.pValue.toFixed(4)}</td>
                          </tr>
                          <tr>
                            <td>Within Groups</td>
                            <td>{r.anova.SSW.toFixed(4)}</td>
                            <td>{r.anova.dfW}</td>
                            <td>{r.anova.MSW.toFixed(4)}</td>
                            <td>-</td>
                            <td>-</td>
                          </tr>
                          <tr className="total-row">
                            <td>Total</td>
                            <td>{r.anova.SST.toFixed(4)}</td>
                            <td>{r.anova.dfT}</td>
                            <td>-</td>
                            <td>-</td>
                            <td>-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* คำอธิบาย */}
      <div className="sensory-info">
        <h4>📚 คำอธิบาย</h4>
        <div className="info-grid">
          <div className="info-item">
            <strong>One-Way ANOVA</strong>
            <p>ใช้ทดสอบว่าค่าเฉลี่ยของกลุ่มตั้งแต่ 3 กลุ่มขึ้นไปแตกต่างกันหรือไม่</p>
          </div>
          <div className="info-item">
            <strong>Duncan's MRT</strong>
            <p>ใช้เปรียบเทียบรายคู่หลัง ANOVA เพื่อบอกว่าคู่ไหนแตกต่างกัน</p>
          </div>
          <div className="info-item">
            <strong>p-value</strong>
            <p>ถ้า p &lt; α แสดงว่ามีความแตกต่างอย่างมีนัยสำคัญ</p>
          </div>
          <div className="info-item">
            <strong>กลุ่มตัวอักษร</strong>
            <p>สูตรที่มีตัวอักษรเดียวกันไม่แตกต่างกันทางสถิติ</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensoryEvaluation;
