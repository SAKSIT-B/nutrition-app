// src/components/Login.jsx
// หน้า Login พร้อมข้อมูล Security

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const { login, register, logoutReason, clearLogoutReason, SESSION_TIMEOUT_HOURS } = useAuth();
  const navigate = useNavigate();

  // แสดง error จาก logout reason
  useEffect(() => {
    if (logoutReason && logoutReason !== 'manual') {
      switch (logoutReason) {
        case 'session_expired':
          setError(`Session หมดอายุ (เกิน ${SESSION_TIMEOUT_HOURS} ชั่วโมง)`);
          break;
        case 'another_device':
          setError('มีการเข้าสู่ระบบจากอุปกรณ์อื่น');
          break;
        default:
          break;
      }
      clearLogoutReason();
    }
  }, [logoutReason, clearLogoutReason, SESSION_TIMEOUT_HOURS]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      
      if (isRegister) {
        result = await register(email, password);
      } else {
        result = await login(email, password);
      }

      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🍽️ Nutrition App</h1>
          <p>{isRegister ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <span className="label-icon">📧</span>
              อีเมล
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <span className="label-icon">🔒</span>
              รหัสผ่าน
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          <button 
            type="submit" 
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                กำลังดำเนินการ...
              </>
            ) : (
              isRegister ? '🚀 สร้างบัญชี' : '🔑 เข้าสู่ระบบ'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}
            <button 
              type="button"
              className="switch-mode-btn"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
            >
              {isRegister ? 'เข้าสู่ระบบ' : 'สร้างบัญชีใหม่'}
            </button>
          </p>
        </div>

        {/* Security Info */}
        <div className="login-security-info">
          <h4>🔐 ความปลอดภัย</h4>
          <ul>
            <li>⏰ Session หมดอายุใน {SESSION_TIMEOUT_HOURS} ชั่วโมง</li>
            <li>📱 Login ได้เพียง 1 อุปกรณ์เท่านั้น</li>
            <li>🔄 Login ซ้อนจะถูก Logout อัตโนมัติ</li>
            <li>🗑️ ปิด Browser = ต้อง Login ใหม่</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
