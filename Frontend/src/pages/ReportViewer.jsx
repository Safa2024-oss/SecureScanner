import { useState, useEffect } from 'react'
import { FileText, Download, Calendar, Code2, Globe, ChevronRight, CheckCircle2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import '../components/Layout.css'
import './ReportViewer.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const sevColors = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}` })
const formatConfidenceBucket = (bucket) => {
  if (!bucket) return null
  return String(bucket).replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

function RiskScore({ c, h, m, l }) {
  const score = c * 40 + h * 15 + m * 5 + l
  if (score === 0) return <span className="risk-score risk-score--safe">Safe</span>
  if (score < 30) return <span className="risk-score risk-score--low">Low</span>
  if (score < 80) return <span className="risk-score risk-score--medium">Medium</span>
  if (score < 150) return <span className="risk-score risk-score--high">High</span>
  return <span className="risk-score risk-score--critical">Critical</span>
}

export default function ReportViewer() {
  const { addToast } = useToast()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [plan, setPlan] = useState('free')

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        setPlan(user.subscription_plan || 'free')
        const res = await fetch(`${API_URL}/api/history/?page=1&limit=50`, {
          headers: authHeader()
        })
        const data = await res.json()
        // Handle both old array and new paginated format
        const scans = Array.isArray(data) ? data : (data.data || [])
        setReports(scans)
      } catch {
        addToast('Could not load reports', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [])

  const downloadReport = async (report) => {
    if (plan === 'free') {
      addToast('PDF export is a paid feature. Upgrade from billing.', 'warning')
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/history/${report.id}/full`, {
        headers: authHeader()
      })
      const full = await res.json()

      const response = await fetch(`${API_URL}/api/scan/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader()
        },
        body: JSON.stringify(full.results)
      })

      if (!response.ok) {
        addToast('Failed to generate report', 'error')
        return
      }

      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `securescan-${report.target}-report.pdf`
      link.click()
      addToast('Report downloaded', 'success')
    } catch {
      addToast('Could not generate report', 'error')
    }
  }

  const report = selected != null ? reports.find(r => r.id === selected) : null

  if (report) {
    return (
      <div className="report-detail-page">
        <div className="report-detail-header">
          <button className="back-btn" onClick={() => setSelected(null)}>
            ← All Reports
          </button>
          <div className="report-detail-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => downloadReport(report)}>
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`report-type-icon ${report.type === 'SAST' ? 'blue' : 'purple'}`}>
              {report.type === 'SAST' ? <Code2 size={16} /> : <Globe size={16} />}
            </div>
            <div>
              <h1 className="page-title" style={{ fontFamily: 'var(--mono)', fontSize: 17 }}>{report.target}</h1>
              <p className="page-subtitle">{report.type} Scan — {report.date}</p>
            </div>
          </div>
        </div>

        <div className="detail-stats">
          {[
            { label: 'Critical', val: report.critical, cls: 'danger' },
            { label: 'High', val: report.high, cls: 'high' },
            { label: 'Medium', val: report.medium, cls: 'warning' },
            { label: 'Low', val: report.low, cls: 'success' },
          ].map(({ label, val, cls }) => (
            <div key={label} className={`detail-stat detail-stat--${cls}`}>
              <span className="detail-stat-val">{val}</span>
              <span className="detail-stat-label">{label}</span>
            </div>
          ))}
          <div className="detail-stat detail-stat--neutral">
            <span className="detail-stat-val">
              <RiskScore c={report.critical} h={report.high} m={report.medium} l={report.low} />
            </span>
            <span className="detail-stat-label">Risk Level</span>
          </div>
        </div>

        <ReportDetail id={report.id} />
      </div>
    )
  }

  return (
    <div className="report-list-page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">All scan results and generated reports</p>
      </div>

      {loading ? (
        <div className="empty-state card"><p>Loading...</p></div>
      ) : reports.length === 0 ? (
        <div className="empty-state card">
          <FileText size={32} />
          <h3>No reports yet</h3>
          <p>Run a scan to generate your first report</p>
        </div>
      ) : (
        <div className="report-list">
          {reports.map(r => (
            <div key={r.id} className="report-card card" onClick={() => setSelected(r.id)}>
              <div className="report-card-left">
                <div className={`report-type-icon ${r.type === 'SAST' ? 'blue' : 'purple'}`}>
                  {r.type === 'SAST' ? <Code2 size={16} strokeWidth={1.75} /> : <Globe size={16} strokeWidth={1.75} />}
                </div>
                <div className="report-card-info">
                  <span className="report-card-name">{r.target}</span>
                  <div className="report-card-meta">
                    <span>{r.type}</span>
                    <span>·</span>
                    <Calendar size={12} />
                    <span>{r.date}</span>
                    <span>·</span>
                    <span>{r.total} findings</span>
                  </div>
                </div>
              </div>
              <div className="report-card-right">
                <div className="report-badges">
                  {r.critical > 0 && <span className="badge badge-critical">{r.critical} critical</span>}
                  {r.high > 0 && <span className="badge badge-high">{r.high} high</span>}
                  {r.medium > 0 && <span className="badge badge-medium">{r.medium} medium</span>}
                </div>
                <RiskScore c={r.critical} h={r.high} m={r.medium} l={r.low} />
                <ChevronRight size={16} className="report-arrow" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportDetail({ id }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API_URL}/api/history/${id}/full`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        const json = await res.json()
        setData(json)
      } catch {
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    fetch_()
  }, [id])

  if (loading) return <div className="empty-state"><p>Loading vulnerabilities...</p></div>
  if (!data) return <div className="empty-state"><p>Could not load details.</p></div>

  const vulns = data.results?.vulnerabilities || []

  return (
    <div className="card">
      <div className="card-header" style={{ paddingBottom: 16 }}>
        <span className="card-title">Vulnerabilities ({vulns.length})</span>
      </div>
      <div style={{ padding: '0 0 8px' }}>
        {vulns.length === 0 ? (
          <div className="empty-state"><p>No vulnerabilities found</p></div>
        ) : (
          vulns.map((v, i) => (
            <div key={i}>
              <div
                className="detail-vuln-row"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <span className={`badge ${sevColors[v.severity]}`}>{v.severity}</span>
                <span className="detail-vuln-type">{v.type}</span>
                <span className="detail-vuln-file">{v.file || v.endpoint || ''}</span>
                {v.confidence !== undefined && (
                  <span className={`ai-badge ai-badge--${v.ai_verdict?.toLowerCase()}`}>
                    AI {v.confidence}% · {v.ai_verdict}
                    {formatConfidenceBucket(v.confidence_bucket) ? ` · ${formatConfidenceBucket(v.confidence_bucket)}` : ''}
                  </span>
                )}
                <span className="detail-vuln-fix"><CheckCircle2 size={12} /> {v.fix}</span>
              </div>
              {expanded === i && (
                <div className="vuln-detail" style={{ margin: '0 0 8px', borderRadius: 0 }}>
                  <div className="vuln-section">
                    <h4>Description</h4>
                    <p>{v.description}</p>
                  </div>
                  {(v.code || v.response) && (
                    <div className="vuln-code">
                      <code>{v.code || v.response}</code>
                    </div>
                  )}
                  <div className="vuln-section vuln-fix">
                    <CheckCircle2 size={14} />
                    <p>{v.fix}</p>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
