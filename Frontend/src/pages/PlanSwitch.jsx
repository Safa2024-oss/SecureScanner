import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft } from 'lucide-react'

export default function PlanSwitch() {
  const navigate = useNavigate()
  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Switch Plan</h1>
        <p className="page-subtitle">Choose a new plan or billing cycle for your subscription.</p>
      </div>
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: 36 }}>
          <ArrowRightLeft size={26} style={{ marginBottom: 12 }} />
          <h3>Plan switching is handled from the pricing flow</h3>
          <p style={{ color: 'var(--text3)' }}>
            Select a plan and checkout will migrate your subscription safely.
          </p>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => navigate('/plans')}>Open plans</button>
          </div>
        </div>
      </div>
    </div>
  )
}
