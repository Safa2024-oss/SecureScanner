import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { ShieldCheck, CheckCircle2, XCircle, Mail } from 'lucide-react'
import './Auth.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const navigate = useNavigate()
  const hasVerifiedRef = useRef(false)
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const verifyToken = useCallback(async () => {
    if (hasVerifiedRef.current) return
    hasVerifiedRef.current = true

    if (!token) {
      setStatus('error')
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/verify?token=${token}`)
      if (res.ok) {
        setStatus('success')
      } else {
        const data = await res.json()
        setStatus(data.detail || 'error')
      }
    } catch {
      setStatus('error')
    }
  }, [token])

  useEffect(() => {
    verifyToken()
  }, [verifyToken])

  const handleResend = async () => {
    if (!email) return
    setResending(true)
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
        <div className="auth-card" style={{ textAlign: 'center', maxWidth: 420 }}>
          {status === 'verifying' && (
            <>
              <div className="verify-spinner" style={{ marginBottom: 20 }}>
                <div className="spinner" style={{ borderTopColor: 'var(--accent)', borderColor: 'var(--border2)', margin: '0 auto' }} />
              </div>
              <h2 style={{ fontSize: '20px', marginBottom: 8 }}>Verifying your email...</h2>
              <p style={{ color: 'var(--text3)', fontSize: '14px' }}>Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '20px', marginBottom: 8 }}>Email verified!</h2>
              <p style={{ color: 'var(--text3)', fontSize: '14px', marginBottom: 24 }}>
                Your account is now active. You can sign in.
              </p>
              <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%' }}>
                Go to Login
              </Link>
            </>
          )}

          {(status === 'error' || status === 'Invalid verification token' || status === 'Token expired. Please register again.') && (
            <>
              <XCircle size={48} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '20px', marginBottom: 8 }}>Verification Failed</h2>
              <p style={{ color: 'var(--text3)', fontSize: '14px', marginBottom: 8 }}>
                {status === 'error' ? 'This link is invalid or has expired.' : status}
              </p>
              {email && !resent && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: '12px', marginBottom: '8px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={handleResend}
                  disabled={resending}
                >
                  <Mail size={16} />
                  {resending ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
              {resent && (
                <p style={{ color: 'var(--success)', fontSize: '13px', marginBottom: '12px' }}>
                  ✓ Verification email sent! Check your inbox.
                </p>
              )}
              <Link to="/login" className="btn btn-secondary" style={{ marginTop: '8px', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
