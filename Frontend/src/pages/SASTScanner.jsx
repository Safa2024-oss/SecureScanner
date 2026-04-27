import { useState, useRef, useEffect } from 'react'
import { Upload, FolderOpen, GitBranch, CheckCircle2, ChevronDown, ChevronUp, Code2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import '../components/Layout.css'
import './Scanner.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 }
const sevColors = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' }
const formatConfidenceBucket = (bucket) => {
  if (!bucket) return null
  return String(bucket).replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

export default function SASTScanner() {
  const { addToast } = useToast()
  const [tab, setTab] = useState('upload')
  const [files, setFiles] = useState([])
  const [gitUrl, setGitUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter] = useState('all')
  const [plan, setPlan] = useState('free')
  const fileRef = useRef()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    setPlan(user.subscription_plan || 'free')
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(dropped)
  }

  const handleFiles = (e) => setFiles(Array.from(e.target.files))

  const startScan = async () => {
    setScanning(true)
    setResults(null)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress(p => p >= 90 ? 90 : p + 10)
    }, 300)

    try {
      const token = localStorage.getItem('token')

      if (tab === 'upload' && files.length > 0) {
        const formData = new FormData()
        files.forEach(file => formData.append('files', file))

        const response = await fetch(`${API_URL}/api/scan/sast`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        })

        clearInterval(interval)
        setProgress(100)

        if (!response.ok) {
          const err = await response.json()
          addToast(err.detail || 'Scan failed', 'error')
          return
        }

        const data = await response.json()
        setResults(data.vulnerabilities)
        addToast(`Scan complete — found ${data.vulnerabilities?.length || 0} issues`, 'success')

      } else if (tab === 'git' && gitUrl) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)

        const response = await fetch(`${API_URL}/api/scan/git`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ repo_url: gitUrl }),
          signal: controller.signal
        })

        clearTimeout(timeout)
        clearInterval(interval)
        setProgress(100)

        if (!response.ok) {
          const err = await response.json()
          addToast(err.detail || 'Scan failed', 'error')
          return
        }

        const data = await response.json()
        setResults(data.vulnerabilities)
        addToast(`Scan complete — found ${data.vulnerabilities?.length || 0} issues`, 'success')
      }

    } catch (error) {
      clearInterval(interval)
      if (error.name === 'AbortError') {
        addToast('Scan timed out. Try a smaller repository.', 'warning')
      } else {
        addToast('Could not connect to backend.', 'error')
      }
    } finally {
      setScanning(false)
    }
  }

  const downloadReport = async () => {
    if (plan === 'free') {
      addToast('PDF export is available on Standard and above plans.', 'warning')
      return
    }
    if (!results || results.length === 0) {
      addToast('No results to export', 'warning')
      return
    }
    try {
      const response = await fetch(`${API_URL}/api/scan/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type: 'SAST',
          target: files[0]?.name || 'scan',
          total: results.length,
          critical: results.filter(v => v.severity === 'critical').length,
          high: results.filter(v => v.severity === 'high').length,
          medium: results.filter(v => v.severity === 'medium').length,
          low: results.filter(v => v.severity === 'low').length,
          vulnerabilities: results
        })
      })

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'securescan-report.pdf'
      a.click()
      window.URL.revokeObjectURL(url)
      addToast('Report downloaded', 'success')
    } catch {
      addToast('Could not generate report', 'error')
    }
  }

  const filtered = results
    ? (filter === 'all' ? results : results.filter(r => r.severity === filter)).sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity])
    : []

  const counts = results ? {
    critical: results.filter(r => r.severity === 'critical').length,
    high: results.filter(r => r.severity === 'high').length,
    medium: results.filter(r => r.severity === 'medium').length,
    low: results.filter(r => r.severity === 'low').length,
  } : null

  return (
    <div className="scanner-page">
      <div className="page-header">
        <h1 className="page-title">Code Scanner</h1>
        <p className="page-subtitle">Static Application Security Testing (SAST)</p>
      </div>

      {!results && !scanning && (
        <div className="card scan-setup">
          <div className="card-body">
            <div className="tabs">
              <button className={`tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
                <Upload size={15} /> Upload Files
              </button>
              <button className={`tab ${tab === 'git' ? 'active' : ''}`} onClick={() => setTab('git')}>
                <GitBranch size={15} /> Git Repository
              </button>
            </div>

            {tab === 'upload' ? (
              <div
                className="dropzone"
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
              >
                <input ref={fileRef} type="file" multiple hidden onChange={handleFiles} />
                <FolderOpen size={32} strokeWidth={1.25} />
                <h3>Drop your project folder here</h3>
                <p>Supports multiple files — .py, .js, .ts, .java, .php, .zip and more</p>
                {files.length > 0 && (
                  <div className="file-pills">
                    {files.slice(0, 5).map((f, i) => (
                      <span key={i} className="file-pill">{f.name}</span>
                    ))}
                    {files.length > 5 && <span className="file-pill">+{files.length - 5} more</span>}
                  </div>
                )}
              </div>
            ) : (
              <div className="git-input-area">
                <div className="input-group">
                  <label className="input-label">Repository URL</label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://github.com/username/repo"
                    value={gitUrl}
                    onChange={e => setGitUrl(e.target.value)}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                  Supports public GitHub and GitLab repositories
                </p>
              </div>
            )}

            <div className="scan-actions">
              <button
                className="btn btn-primary"
                disabled={tab === 'upload' ? files.length === 0 : !gitUrl}
                onClick={startScan}
              >
                <Code2 size={16} /> Start SAST Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <div className="card">
          <div className="card-body scanning-state">
            <div className="scan-anim">
              <div className="scan-ring" />
              <Code2 size={22} strokeWidth={1.5} />
            </div>
            <h3>Analyzing your code...</h3>
            <p>Parsing files and applying security rules</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <span className="progress-pct">{Math.min(Math.round(progress), 100)}%</span>
          </div>
        </div>
      )}

      {results && (
        <>
          <div className="results-header">
            <div className="severity-summary">
              {Object.entries(counts).map(([sev, count]) => (
                <div key={sev} className={`sev-chip sev-chip--${sev} ${filter === sev ? 'selected' : ''}`} onClick={() => setFilter(filter === sev ? 'all' : sev)}>
                  <span className="sev-count">{count}</span>
                  <span className="sev-label">{sev}</span>
                </div>
              ))}
            </div>
            <div className="results-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => { setResults(null); setFiles([]); setProgress(0) }}>
                New Scan
              </button>
              <button className="btn btn-primary btn-sm" onClick={downloadReport} disabled={plan === 'free'}>
                {plan === 'free' ? 'Upgrade to Export' : 'Export Report'}
              </button>
            </div>
          </div>

          {Object.entries(
            filtered.reduce((groups, vuln) => {
              const file = vuln.file || vuln.endpoint || 'Unknown'
              const shortFile = file.split(/[\\/]/).pop()
              if (!groups[shortFile]) groups[shortFile] = []
              groups[shortFile].push(vuln)
              return groups
            }, {})
          ).map(([filename, vulns]) => (
            <div key={filename} className="file-group">
              <div className="file-group-header">
                <Code2 size={14} />
                <span>{filename}</span>
                <span className="file-group-count">{vulns.length} issue{vulns.length > 1 ? 's' : ''}</span>
              </div>
              <div className="vuln-list-wrap">
                {vulns.map((v, i) => (
                  <div key={i} className="vuln-item card">
                    <div className="vuln-summary" onClick={() => setExpanded(expanded === `${filename}-${i}` ? null : `${filename}-${i}`)}>
                      <span className={`badge ${sevColors[v.severity]}`}>{v.severity}</span>
                      <span className="vuln-type">{v.type}</span>
                      <span className="vuln-file">line <span className="vuln-line">{v.line}</span></span>
                      {v.confidence !== undefined && (
                        <span className={`ai-badge ai-badge--${v.ai_verdict?.toLowerCase()}`}>
                          AI {v.confidence}% · {v.ai_verdict}
                          {formatConfidenceBucket(v.confidence_bucket) ? ` · ${formatConfidenceBucket(v.confidence_bucket)}` : ''}
                        </span>
                      )}
                      <span className="vuln-toggle">
                        {expanded === `${filename}-${i}` ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    </div>
                    {expanded === `${filename}-${i}` && (
                      <div className="vuln-detail">
                        <div className="vuln-section">
                          <h4>Description</h4>
                          <p>{v.description}</p>
                        </div>
                        {v.code && (
                          <div className="vuln-code">
                            <code>{v.code}</code>
                          </div>
                        )}
                        <div className="vuln-section vuln-fix">
                          <CheckCircle2 size={14} />
                          <p>{v.fix}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
