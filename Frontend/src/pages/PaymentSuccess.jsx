import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { useToast } from '../components/Toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [state, setState] = useState('verifying')
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    const verify = async () => {
      if (!sessionId) {
        setState('failed')
        return
      }
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API_URL}/api/payments/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Could not verify payment')

        const user = JSON.parse(localStorage.getItem('user') || '{}')
        user.subscription_plan = data.plan
        localStorage.setItem('user', JSON.stringify(user))
        setState('success')
        addToast('Payment verified. Subscription is active.', 'success')
        setTimeout(() => navigate('/billing'), 1600)
      } catch (err) {
        setState('failed')
        addToast(err.message || 'Could not verify payment', 'error')
      }
    }
    verify()
  }, [sessionId, navigate, addToast])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <CheckCircle size={48} style={{ margin: '0 auto 24px', color: '#059669' }} />
        <h2>{state === 'failed' ? 'Payment Verification Failed' : 'Payment Successful'}</h2>
        <p>
          {state === 'verifying' && 'Verifying your subscription...'}
          {state === 'success' && 'Your account has been upgraded. Redirecting to billing...'}
          {state === 'failed' && 'Please open billing and retry from invoice/payment management.'}
        </p>
      </div>
    </div>
  )
}