// src/App.jsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Footer from './components/Footer'  
import SessionAlert from './components/SessionAlert'

const App = () => {
  return (
    <>
      {/* Session Alert - แสดง Modal แจ้งเตือนเมื่อถูก Logout */}
      <SessionAlert />
      
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<div>ไม่พบหน้านี้</div>} />
      </Routes>
      
      {/* เครดิตด้านล่างทุกหน้า */}
      <Footer />
    </>
  )
}

export default App
