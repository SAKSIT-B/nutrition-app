// src/App.jsx
// ตัวอย่างการเพิ่ม Routes สำหรับหน้าใหม่

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NutritionCalculator from './pages/NutritionCalculator'
import ThaiRDICalculator from './pages/ThaiRDICalculator'
import SavedRecipes from './pages/SavedRecipes'
import CompareRecipes from './pages/CompareRecipes'  // เพิ่มใหม่
import ManageItems from './pages/ManageItems'
import AdminConsole from './pages/AdminConsole'

// Components
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="nutrition" replace />} />
                <Route path="nutrition" element={<NutritionCalculator />} />
                <Route path="thai-rdi" element={<ThaiRDICalculator />} />
                <Route path="recipes" element={<SavedRecipes />} />
                <Route path="compare" element={<CompareRecipes />} />  {/* เพิ่มใหม่ */}
                <Route path="manage-items" element={<ManageItems />} />
                <Route path="admin" element={<AdminConsole />} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
