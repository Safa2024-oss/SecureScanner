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
import JoinEnterprise from './pages/JoinEnterprise'
import EnterpriseDashboard from './pages/EnterpriseDashboard'
import SetupEnterprise from './pages/SetupEnterprise'   
import AcceptInvite from './pages/AcceptInvite'

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const handleStorageChange = () => {
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const getStartPage = () => {
    if (!user) return '/login'
    if (user.organization_id) return '/enterprise/dashboard'
    if (user.role === 'admin') return '/admin'
    return '/dashboard'
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!user ? <Login onLogin={handleLogin} /> : <Navigate to={getStartPage()} replace />} />
        <Route path="/register" element={!user ? <Register onRegister={handleLogin} /> : <Navigate to={getStartPage()} replace />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancelled" element={<PaymentCancelled />} />
        <Route path="/payment/failure" element={<PaymentFailure />} />
        <Route path="/pricing" element={<Pricing />} />
    
        <Route path="/enterprise/join" element={<JoinEnterprise />} />
        <Route path="/enterprise/setup" element={<SetupEnterprise />} />   {/* <-- add this */}
        <Route path="/enterprise/accept-invite" element={<AcceptInvite />} />
        {/* Protected routes with layout */}
        <Route path="/" element={user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}>
          <Route index element={<Navigate to={getStartPage()} replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="enterprise/dashboard" element={<EnterpriseDashboard />} />
          <Route path="sast" element={<SASTScanner />} />
          <Route path="dast" element={<DASTScanner />} />
          <Route path="report" element={<ReportViewer />} />
          <Route path="billing" element={<Billing />} />
          <Route path="plans" element={<Pricing />} />
          <Route path="plan-switch" element={<PlanSwitch />} />
          <Route path="admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/dashboard" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}