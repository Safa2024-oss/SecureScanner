import { useEffect, useMemo, useState } from 'react'
import { CreditCard, CalendarClock, Receipt, ShieldCheck, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { useToast } from '../components/Toast'
import '../components/Layout.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function formatMoney(cents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
}

export default function Billing() {
  const { addToast } = useToast()
  const [subscription, setSubscription] = useState(null)
  const [usage, setUsage] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }), [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, usageRes, invRes] = await Promise.all([
          fetch(`${API_URL}/api/payments/subscription`, { headers: authHeaders }),
          fetch(`${API_URL}/api/payments/usage`, { headers: authHeaders }),
          fetch(`${API_URL}/api/payments/invoices?limit=30`, { headers: authHeaders }),
        ])
        const subData = await subRes.json()
        const usageData = await usageRes.json()
        const invData = await invRes.json()
        setSubscription(subData)
        setUsage(usageData)
        setInvoices(invData.data || [])
      } catch {
        addToast('Could not load billing data', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [authHeaders, addToast])

  const openPortal = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_URL}/api/payments/portal-session`, { method: 'POST', headers: authHeaders })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else addToast(data.detail || 'Billing portal unavailable', 'warning')
    } catch {
      addToast('Could not open billing portal', 'error')
    } finally {
      setBusy(false)
    }
  }

  const cancelAtPeriodEnd = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${API_URL}/api/payments/cancel-subscription`, { method: 'POST', headers: authHeaders })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      addToast(data.message || 'Subscription will end at period close', 'success')
      setSubscription(prev => ({ ...prev, cancel_at_period_end: true }))
    } catch (err) {
      addToast(err.message || 'Could not cancel subscription', 'error')
    } finally {
      setBusy(false)
    }
  }

  const usagePct = usage?.scans_limit ? Math.min(100, Math.round((usage.scans_used / usage.scans_limit) * 100)) : 0

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Billing & Subscription</h1>
        <p className="page-subtitle">Manage your plan, invoices, payment status, and usage.</p>
      </div>

      {loading ? <div className="card"><div className="card-body">Loading billing data...</div></div> : (
        <>
          {(subscription?.status === 'trial' || subscription?.status === 'pending_payment') && (
            <div className="card" style={{ borderColor: 'var(--warning)' }}>
              <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={16} />
                <div>
                  <strong>Status: {subscription?.status}</strong>
                  <p style={{ margin: 0, color: 'var(--text3)' }}>
                    Keep billing up to date to avoid service interruption.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card card">
              <div className="stat-icon stat-icon--blue"><CreditCard size={18} /></div>
              <div>
                <div className="stat-value">{(subscription?.plan || 'free').toUpperCase()}</div>
                <div className="stat-label">Current Plan</div>
              </div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon stat-icon--purple"><CalendarClock size={18} /></div>
              <div>
                <div className="stat-value">{subscription?.billing_cycle || 'monthly'}</div>
                <div className="stat-label">Billing Cycle</div>
              </div>
            </div>
            <div className="stat-card card">
              <div className="stat-icon stat-icon--green"><ShieldCheck size={18} /></div>
              <div>
                <div className="stat-value">{subscription?.status || 'active'}</div>
                <div className="stat-label">Subscription Status</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">Usage Progress</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Scans used this month</span>
                <strong>{usage?.scans_used || 0} / {usage?.scans_limit || 0}</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${usagePct}%` }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.location.assign('/plans')}>Upgrade Plan</button>
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={openPortal}>
                  Manage Payment Method <ArrowUpRight size={14} />
                </button>
                {subscription?.plan !== 'free' && (
                  <button className="btn btn-secondary btn-sm" disabled={busy || subscription?.cancel_at_period_end} onClick={cancelAtPeriodEnd}>
                    {subscription?.cancel_at_period_end ? 'Cancellation Scheduled' : 'Cancel at Period End'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <span className="card-title">Invoice History</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {invoices.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <Receipt size={22} />
                  <p>No invoices yet.</p>
                </div>
              ) : (
                <table className="scan-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.invoice_id}>
                        <td>{inv.invoice_id?.slice(-10)}</td>
                        <td><span className="badge badge-info">{inv.status || 'pending'}</span></td>
                        <td>{formatMoney(inv.amount_paid || inv.amount_due, inv.currency)}</td>
                        <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '-'}</td>
                        <td>
                          {inv.invoice_pdf
                            ? <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">Download</a>
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
