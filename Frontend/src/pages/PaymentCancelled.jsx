import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'

export default function PaymentCancelled() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
      <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 460 }}>
        <AlertCircle size={48} style={{ margin: '0 auto 18px', color: '#d97706' }} />
        <h2>Checkout cancelled</h2>
        <p style={{ color: 'var(--text3)' }}>
          No payment was captured. You can restart checkout any time from billing.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <Link to="/plans" className="btn btn-primary">View plans</Link>
          <Link to="/billing" className="btn btn-secondary">Back to billing</Link>
        </div>
      </div>
    </div>
  )
}
