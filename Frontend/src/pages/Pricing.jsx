import { useMemo, useState } from 'react'
import { Check, ArrowRight, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import './Pricing.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const CYCLES = ['monthly', 'annual']
const PRICING = {
  free: { monthly: 0, annual: 0 },
  standard: { monthly: 19, annual: 170 },
  premium: { monthly: 49, annual: 440 },
  enterprise: { monthly: 200, annual: 1800 },
}
const PLAN_META = [
  {
    key: 'free',
    name: 'Free',
    desc: 'Try the platform and start scanning instantly.',
    featureList: ['5 scans/month', 'Basic reports', 'Starter AI checks', 'Community support'],
  },
  {
    key: 'standard',
    name: 'Standard',
    desc: 'For individual professionals shipping weekly.',
    featureList: ['100 scans/month', 'Full report export', 'Advanced AI review', 'Priority support'],
    popular: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    desc: 'For high-volume security workflows and teams.',
    featureList: ['500 scans/month', 'Team collaboration', 'Premium AI intelligence', 'Compliance exports'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    desc: 'Unlimited scale for large teams and organizations.',
    featureList: ['Unlimited scans', 'Team management', 'SAML/SSO', '24/7 enterprise support', 'Compliance exports', 'VPC options'],
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [loading, setLoading] = useState(null)
  const token = localStorage.getItem('token')
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [])
  const currentPlan = user?.subscription_plan || 'free'

  const handlePlanAction = async (plan) => {
    if (!token) {
      if (plan === 'free') navigate('/register')
      else navigate('/login')
      return
    }
    if (plan === 'free') return

    setLoading(plan)
    try {
      const response = await fetch(`${API_URL}/api/payments/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan, billing_cycle: billingCycle })
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        addToast('Failed to create checkout session', 'error')
      }
    } catch {
      addToast('Could not connect to server', 'error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="pricing-page">
      <div className="page-header" style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto 48px' }}>
        <h1 className="page-title">Security subscriptions built for serious teams</h1>
        <p className="page-subtitle">Start free, scale to premium, and grow to enterprise when your team is ready.</p>
        <div className="billing-toggle" style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
          {CYCLES.map((cycle) => (
            <button
              key={cycle}
              className={`btn btn-sm ${billingCycle === cycle ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setBillingCycle(cycle)}
            >
              {cycle}
            </button>
          ))}
        </div>
      </div>

      <div className="pricing-grid">
        {PLAN_META.map((plan) => (
          <div key={plan.key} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
            {plan.popular && <div className="popular-badge">Most Popular</div>}
            <div className="pricing-card-header">
              <h3>{plan.name}</h3>
              <div className="price">
                <span className="amount">${PRICING[plan.key][billingCycle]}</span>
                <span className="period">/{billingCycle}</span>
              </div>
              <p className="description">{plan.desc}</p>
            </div>
            <div className="pricing-card-features">
              {plan.featureList.map((feature, i) => (
                <div key={i} className="feature">
                  <Check size={16} /> <span>{feature}</span>
                </div>
              ))}
            </div>
            <button
              className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePlanAction(plan.key)}
              disabled={loading === plan.key || (currentPlan === plan.key && !!token)}
            >
              {loading === plan.key
                ? 'Redirecting...'
                : !token
                  ? (plan.key === 'free' ? 'Start Free' : 'Sign in to Continue')
                  : currentPlan === plan.key
                    ? 'Current Plan'
                    : plan.key === 'free' ? 'Free Forever' : 'Continue'}
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Feature Comparison</h3>
          <table className="scan-table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Free</th>
                <th>Standard</th>
                <th>Premium</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Scans/month</td><td>5</td><td>100</td><td>500</td><td>Unlimited</td></tr>
              <tr><td>AI Tools</td><td>Basic</td><td>Advanced</td><td>Premium</td><td>Premium</td></tr>
              <tr><td>Report Export</td><td>No</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
              <tr><td>Team Features</td><td>No</td><td>Basic</td><td>Advanced</td><td>Full</td></tr>
              <tr><td>SSO/SAML</td><td>No</td><td>No</td><td>No</td><td>Yes</td></tr>
              <tr><td>Support</td><td>Community</td><td>Priority</td><td>Priority</td><td>24/7</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="faq-section" style={{ marginTop: 20 }}>
        <h3>Frequently Asked Questions</h3>
        <div className="faq-grid">
          <div className="faq-item">
            <strong>Can I start for free and upgrade later?</strong>
            <p>Yes. Free users can upgrade from dashboard or pricing at any time.</p>
          </div>
          <div className="faq-item">
            <strong>What payment methods are supported?</strong>
            <p>Stripe card payments are supported for all plans.</p>
          </div>
          <div className="faq-item">
            <strong>What does Enterprise include?</strong>
            <p>Unlimited scans, team management, SSO, compliance exports, VPC options, and 24/7 dedicated support.</p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-body" style={{ textAlign: 'center' }}>
          <ShieldCheck size={18} style={{ marginBottom: 6 }} />
          <p style={{ margin: 0 }}>Secure payments by Stripe. Subscription terms and renewal details are shown before checkout.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => handlePlanAction('standard')}>
            Start Now <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}