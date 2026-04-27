import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SASTScanner from './pages/SASTScanner'
import DASTScanner from './pages/DASTScanner'
import ReportViewer from './pages/ReportViewer'
import Layout from './components/Layout'
import VerifyEmail from './pages/VerifyEmail'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import PaymentSuccess from './pages/PaymentSuccess'
import Pricing from './pages/Pricing'
import Billing from './pages/Billing'
import PaymentCancelled from './pages/PaymentCancelled'
import PaymentFailure from './pages/PaymentFailure'
import PlanSwitch from './pages/PlanSwitch'
import QuoteRequest from './pages/QuoteRequest'


export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} />} />
        <Route path="/register" element={!user ? <Register onRegister={handleLogin} /> : <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancelled" element={<PaymentCancelled />} />
        <Route path="/payment/failure" element={<PaymentFailure />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/quote" element={<QuoteRequest />} />
        <Route path="/" element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sast" element={<SASTScanner />} />
          <Route path="dast" element={<DASTScanner />} />
          <Route path="report" element={<ReportViewer />} />
          <Route path="billing" element={<Billing />} />
          <Route path="plans" element={<Pricing />} />
          <Route path="plan-switch" element={<PlanSwitch />} />
          <Route path="quote" element={<QuoteRequest />} />
          <Route
            path="admin"
            element={user?.role === 'admin' ? <Admin /> : <Navigate to="/dashboard" />}
          />
          
        </Route>
      </Routes>
    </BrowserRouter>
  )
}