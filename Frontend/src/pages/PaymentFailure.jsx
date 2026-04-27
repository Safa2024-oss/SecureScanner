import { Link } from 'react-router-dom'
import { XCircle } from 'lucide-react'

export default function PaymentFailure() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 460 }}>
        <XCircle size={48} style={{ margin: '0 auto 18px', color: '#dc2626' }} />
        <h2>Payment failed</h2>
        <p style={{ color: 'var(--text3)' }}>
          Your payment could not be processed. Verify card details and retry checkout.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <Link to="/plans" className="btn btn-primary">Retry checkout</Link>
          <Link to="/billing" className="btn btn-secondary">Go to billing</Link>
        </div>
      </div>
    </div>
  )
}
