import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Code2, 
  Globe, 
  FileText, 
  LogOut, 
  ShieldCheck, 
  ChevronRight,
  Settings,
  CreditCard,
  Users
} from 'lucide-react'
import './Layout.css'
import { useState, useEffect } from 'react'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const [planLabel, setPlanLabel] = useState(
    user?.role === 'admin' ? 'ADMIN' : (user?.subscription_plan || 'FREE').toUpperCase()
  )

  
  useEffect(() => {
    const checkUserUpdate = () => {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser)
        // If user has organization_id but current component doesn't know it, reload the page
        if (parsedUser.organization_id && !user?.organization_id) {
          window.location.reload()
        }
      }
    }
    checkUserUpdate()
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') return
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/payments/subscription`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.plan) setPlanLabel(data.plan.toUpperCase())
      })
      .catch(() => {})
  }, [user])

  
  const nav = [
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Settings, label: 'Admin' }] : []),
    // Dashboard link: point to enterprise dashboard if user belongs to an enterprise, otherwise normal dashboard
    { to: user?.organization_id ? '/enterprise/dashboard' : '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/sast', icon: Code2, label: 'Code Scanner' },
    { to: '/dast', icon: Globe, label: 'URL Scanner' },
    { to: '/report', icon: FileText, label: 'Reports' },
    ...(user?.role !== 'admin' ? [{ to: '/billing', icon: CreditCard, label: 'Billing' }] : [])
  ]


  if (user && !user.organization_id && user.role !== 'admin') {
    nav.push({ to: '/enterprise/join', icon: Users, label: 'Join Enterprise' })
  }

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldCheck size={22} strokeWidth={2} />
          <span>SecureScan</span>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-label">Menu</p>
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={17} strokeWidth={1.75} />
              <span>{label}</span>
              <ChevronRight size={14} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.charAt(0)}</div>
            <div className="user-meta">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
              <span className="badge badge-info" style={{ marginTop: 4, width: 'fit-content' }}>
                {planLabel}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}