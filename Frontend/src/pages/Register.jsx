import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, Eye, EyeOff, Mail, Check, X, Sparkles, Zap, FileCheck } from 'lucide-react'
import './Auth.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function Register({ onRegister }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const strength = form.password.length === 0 ? 0 :
    form.password.length < 8 ? 1 :
    /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && form.password.length >= 10 ? 3 :
    form.password.length >= 8 ? 2 : 1

  const strengthLabel = strength === 1 ? 'Weak' : strength === 2 ? 'Fair' : 'Strong'
  const strengthColor = strength === 1 ? '#dc2626' : strength === 2 ? '#d97706' : '#059669'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.detail || 'Registration failed')
        setLoading(false)
        return
      }

      setSuccess(true)

    } catch {
      setError('Could not connect to server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <Zap size={16} />, text: 'Free security scanning' },
    { icon: <Sparkles size={16} />, text: 'AI-powered analysis' },
    { icon: <FileCheck size={16} />, text: 'PDF report generation' },
  ]

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <div className="auth-brand">
            <ShieldCheck size={24} strokeWidth={2} />
            <span>SecureScan</span>
          </div>
          <div className="auth-tagline">
            <h1>Security scanning<br />made accessible.</h1>
            <p>Get started in minutes. Analyze your code and web apps for vulnerabilities automatically.</p>
          </div>
          <div className="auth-features">
            {features.map((f, i) => (
              <div key={i} className="auth-feature-item">
                <div className="auth-feature-dot" />
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-card" style={{ textAlign: 'center', maxWidth: 440, animation: 'fadeInScale 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #eef2ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 4px 14px rgba(99,102,241,0.2)' }}>
              <Mail size={30} color="#4f46e5" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 8 }}>Check your inbox</h2>
            <p style={{ color: 'var(--text3)', fontSize: '14px', marginBottom: 8, lineHeight: 1.6 }}>
              We sent a verification link to <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{form.email}</strong>
            </p>
            <p style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: 28, lineHeight: 1.5 }}>
              Click the link in the email to verify your account, then you can sign in.
            </p>
            <button
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%', padding: '12px' }}
              onClick={() => navigate('/login')}
            >
              Go to Login <ArrowRight size={16} />
            </button>
            <p style={{ fontSize: '12px', color: 'var(--text3)', marginTop: 16 }}>
              Didn't receive the email? <button onClick={() => navigate('/login')} style={{ color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Try again</button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <ShieldCheck size={24} strokeWidth={2} />
          <span>SecureScan</span>
        </div>
        <div className="auth-tagline">
          <h1>Security scanning<br />made accessible.</h1>
          <p>Get started in minutes. Analyze your code and web apps for vulnerabilities automatically.</p>
        </div>
        <div className="auth-features">
          {features.map((f, i) => (
            <div key={i} className="auth-feature-item">
              <div className="auth-feature-dot" />
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>Create account</h2>
            <p>Start scanning for free — no credit card required</p>
          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label className="input-label">Full name</label>
              <input
                className="input"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Email address</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-wrap">
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={8}
                />
                <button type="button" className="input-toggle" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= strength ? strengthColor : '#e5e7eb',
                        transition: 'background 0.3s ease'
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {strength === 3 ? <Check size={12} color={strengthColor} /> : <X size={12} color={strengthColor} />}
                    <span style={{ fontSize: '12px', color: strengthColor, fontWeight: 600 }}>
                      {strengthLabel} password
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
