import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, Eye, EyeOff, Check, X } from 'lucide-react'
import './Auth.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const strength = password.length === 0 ? 0 :
    password.length < 8 ? 1 :
    /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10 ? 3 :
    password.length >= 8 ? 2 : 1

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.detail || 'Reset failed')
        return
      }

      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)

    } catch {
      setError('Could not connect to server.')
    } finally {
      setLoading(false)
    }
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
          {['Upload code or Git repo', 'Scan any live web app', 'Clear, actionable reports'].map(f => (
            <div key={f} className="auth-feature-item">
              <div className="auth-feature-dot" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card" style={{ maxWidth: 420 }}>
          <div className="auth-card-header">
            <div style={{ marginBottom: 16 }}>
              <ShieldCheck size={32} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <h2>Reset your password</h2>
            <p>Choose a new password for your account</p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Check size={24} color="var(--success)" />
              </div>
              <p style={{ color: 'var(--success)', fontWeight: 600, fontSize: '15px', marginBottom: 8 }}>
                Password reset successfully!
              </p>
              <p style={{ color: 'var(--text3)', fontSize: '13px' }}>
                Redirecting to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="auth-error">{error}</div>}

              <div className="input-group">
                <label className="input-label">New password</label>
                <div className="input-wrap">
                  <input
                    className="input"
                    type={show ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="input-toggle" onClick={() => setShow(!show)}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="password-strength" style={{ marginTop: 8 }}>
                    <div className="strength-bars" style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 4, borderRadius: 2,
                          background: i <= strength
                            ? strength === 1 ? 'var(--danger)' : strength === 2 ? 'var(--warning)' : 'var(--success)'
                            : 'var(--border2)'
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: '12px', color: strength === 1 ? 'var(--danger)' : strength === 2 ? 'var(--warning)' : 'var(--success)' }}>
                      {strength === 1 ? 'Weak' : strength === 2 ? 'Fair' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">Confirm password</label>
                <div className="input-wrap">
                  <input
                    className="input"
                    type="password"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                  {confirm.length > 0 && (
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                      {confirm === password
                        ? <Check size={16} color="var(--success)" />
                        : <X size={16} color="var(--danger)" />
                      }
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : <>Reset password <ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          <p className="auth-switch" style={{ textAlign: 'center' }}>
            Remember your password? <Link to="/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
