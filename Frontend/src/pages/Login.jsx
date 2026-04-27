import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, ArrowRight, Mail, Sparkles, Zap, FileCheck } from 'lucide-react'
import './Auth.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unverified, setUnverified] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const navigate = useNavigate()

  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const handleResendVerification = async () => {
    setResending(true)
    setResent(false)
    try {
      await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      setResent(true)
    } catch {
      // silently fail
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 403 && data.detail?.includes('not verified')) {
          setUnverified(true)
          setError('Email not verified. Please check your inbox.')
        } else {
          setError(data.detail || 'Invalid email or password')
        }
        setLoading(false)
        return
      }

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.user)
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard')

    } catch {
      setError('Could not connect to server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <Zap size={16} />, text: 'AI-Powered Analysis' },
    { icon: <Sparkles size={16} />, text: 'Smart Vulnerability Detection' },
    { icon: <FileCheck size={16} />, text: 'Professional PDF Reports' },
  ]

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <ShieldCheck size={24} strokeWidth={2} />
          <span>SecureScan</span>
        </div>
        <div className="auth-tagline">
          <h1>Detect vulnerabilities<br />before they're exploited.</h1>
          <p>Static analysis, dynamic scanning, and AI-powered detection — all in one platform.</p>
        </div>
        <div className="auth-features">
          {features.map((f, i) => (
            <div key={i} className="auth-feature-item" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="auth-feature-dot" />
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {unverified && (
            <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1.5px solid #fde68a', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={16} color="#d97706" />
                <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                  Email not verified
                </span>
              </div>
              {resent ? (
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>✓ Sent!</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 700, background: 'none', border: 'none', cursor: resending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {resending ? 'Sending...' : 'Resend email'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label className="input-label">Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <div className="label-row">
                <label className="input-label">Password</label>
                <button
                  type="button"
                  className="auth-link-small"
                  onClick={() => setForgotMode(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-wrap">
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="input-toggle" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register" className="auth-link">Create one</Link>
          </p>
        </div>

        {/* Forgot Password Modal */}
        {forgotMode && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div className="auth-card" style={{ maxWidth: 400, width: '100%', margin: 20, animation: 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              <div className="auth-card-header">
                <h2>Reset password</h2>
                <p>Enter your email and we'll send you a reset link</p>
              </div>
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Mail size={22} color="#059669" />
                  </div>
                  <p style={{ color: '#059669', fontSize: '14px', fontWeight: 600 }}>
                    ✓ Reset link sent! Check your inbox.
                  </p>
                </div>
              ) : (
                <div className="auth-form">
                  <div className="input-group">
                    <label className="input-label">Email address</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary auth-submit"
                    onClick={async () => {
                      await fetch(`${API_URL}/api/auth/forgot-password`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: forgotEmail })
                      })
                      setForgotSent(true)
                    }}
                  >
                    Send reset link
                  </button>
                </div>
              )}
              <button
                onClick={() => { setForgotMode(false); setForgotSent(false) }}
                style={{ width: '100%', textAlign: 'center', marginTop: 12, fontSize: '13px', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '8px 0' }}
              >
                ← Back to login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
