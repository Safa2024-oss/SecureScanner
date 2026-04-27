import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import '../components/Layout.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function QuoteRequest() {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    plan_type: 'enterprise',
    company_name: '',
    contact_name: '',
    email: '',
    seats: 50,
    message: '',
  })

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const endpoint = token ? '/api/payments/quote-request' : '/api/payments/quote-request/public'
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to submit request')
      addToast('Quote request submitted. Sales team will contact you.', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Enterprise / University Quote</h1>
        <p className="page-subtitle">Tell us your needs and we will craft a custom plan.</p>
      </div>
      <div className="card" style={{ maxWidth: 760 }}>
        <form className="card-body" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Building2 size={16} /> <strong>Contact Sales</strong>
          </div>
          <label className="input-label">Plan type</label>
          <select className="input" value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })}>
            <option value="enterprise">Enterprise</option>
            <option value="university">University</option>
          </select>
          <label className="input-label">Organization</label>
          <input className="input" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <label className="input-label">Contact name</label>
          <input className="input" required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
          <label className="input-label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="input-label">Estimated seats</label>
          <input className="input" type="number" min={1} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
          <label className="input-label">Message</label>
          <textarea className="input" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Request Quote'}
          </button>
        </form>
      </div>
    </div>
  )
}
