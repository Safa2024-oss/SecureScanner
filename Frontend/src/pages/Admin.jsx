import { useState, useEffect } from 'react'
import { Users, ShieldAlert, BarChart3, Trash2, RefreshCw, Search, Ban, UserCheck, UserPlus, AlertTriangle } from 'lucide-react'
import { useToast } from '../components/Toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import '../components/Layout.css'
import './Admin.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5']
const SEVERITY_COLORS = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#059669' }
const SCAN_TYPE_COLORS = { SAST: '#6366f1', DAST: '#8b5cf6', Git: '#059669' }

// ── Custom legend rendered as pills below each donut ──────
function PieLegend({ data, colorMap, fallbackColors }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 8 }}>
      {data.map((entry, i) => {
        const color = colorMap?.[entry.name.toLowerCase()] || fallbackColors[i % fallbackColors.length]
        return (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {entry.name} <strong>({entry.value})</strong>
          </div>
        )
      })}
    </div>
  )
}

export default function Admin() {
  const { addToast } = useToast()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [scans, setScans] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [confirmAction, setConfirmAction] = useState(null)

  const token = localStorage.getItem('token')
  const headers = { 'Authorization': `Bearer ${token}` }

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [statsRes, usersRes, scansRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/users?page=1&limit=100`, { headers }),
        fetch(`${API_URL}/api/admin/scans?page=1&limit=100`, { headers }),
      ])
      setStats(await statsRes.json())

      const usersData = await usersRes.json()
      setUsers(Array.isArray(usersData) ? usersData : (usersData.data || []))

      const scansData = await scansRes.json()
      setScans(Array.isArray(scansData) ? scansData : (scansData.data || []))
    } catch {
      addToast('Failed to load admin data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const updateUser = async (userId, data, userName) => {
    try {
      await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      addToast(`User ${userName} updated`, 'success')
      fetchAll()
    } catch {
      addToast('Failed to update user', 'error')
    }
  }

  const deleteUser = async (userId, userName) => {
    try {
      await fetch(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE', headers })
      addToast(`User ${userName} deleted`, 'success')
      fetchAll()
    } catch {
      addToast('Failed to delete user', 'error')
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const userPlan = (u.subscription_plan || 'free').toLowerCase()
    const matchesPlan = planFilter === 'all' || userPlan === planFilter
    return matchesSearch && matchesPlan
  })

  // ── CHART DATA ────────────────────────────────────────────
  const vulnTypeChartData = stats?.top_vulnerability_types?.map(v => ({
    name: v.type.length > 22 ? v.type.slice(0, 22) + '…' : v.type,
    count: v.count,
    full: v.type
  })) || []

  const scanTypeData = scans.reduce((acc, scan) => {
    const type = scan.type || 'Unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})
  const scanTypeChartData = Object.entries(scanTypeData).map(([name, value]) => ({ name, value }))

  const severityData = scans.reduce((acc, scan) => {
    acc.critical += scan.critical || 0
    acc.high += scan.high || 0
    acc.medium += scan.medium || 0
    acc.low += scan.low || 0
    return acc
  }, { critical: 0, high: 0, medium: 0, low: 0 })
  const severityChartData = Object.entries(severityData)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))

  const roleData = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {})
  const roleChartData = Object.entries(roleData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value
  }))

  const statusData = users.reduce((acc, u) => {
    const s = u.status || 'active'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const statusChartData = Object.entries(statusData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), value
  }))

  return (
    <div className="admin-page">

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="confirm-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="var(--danger)" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Confirm Action</h3>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6, marginBottom: 24 }}>
              {confirmAction.type === 'delete'
                ? `Are you sure you want to delete "${confirmAction.userName}"? This will also remove all their scans. This action cannot be undone.`
                : `Are you sure you want to ${confirmAction.type === 'ban' ? 'ban' : confirmAction.type === 'unban' ? 'unban' : confirmAction.type === 'promote' ? 'promote' : 'demote'} "${confirmAction.userName}"?`
              }
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                className="btn btn-sm"
                style={{ background: confirmAction.type === 'delete' ? 'var(--danger)' : 'var(--accent)', color: 'white' }}
                onClick={() => {
                  if (confirmAction.type === 'delete') deleteUser(confirmAction.userId, confirmAction.userName)
                  else if (confirmAction.type === 'ban') updateUser(confirmAction.userId, { status: 'banned' }, confirmAction.userName)
                  else if (confirmAction.type === 'unban') updateUser(confirmAction.userId, { status: 'active' }, confirmAction.userName)
                  else if (confirmAction.type === 'promote') updateUser(confirmAction.userId, { role: 'admin' }, confirmAction.userName)
                  else if (confirmAction.type === 'demote') updateUser(confirmAction.userId, { role: 'user' }, confirmAction.userName)
                  setConfirmAction(null)
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Admin Panel</h1>
          <p className="page-subtitle">Manage users, monitor scans and platform activity</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'users',    label: `Users (${users.length})`, icon: Users },
          { key: 'scans',    label: `Scans (${scans.length})`, icon: ShieldAlert },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`admin-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: 24, minHeight: 80, background: 'var(--bg2)', animation: 'pulse 1.5s infinite' }}>
              <div style={{ width: 60, height: 24, background: 'var(--border)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ── OVERVIEW TAB ─────────────────────────────── */}
          {tab === 'overview' && stats && (
            <div className="admin-overview">

              {/* Stat cards */}
              <div className="admin-stats">
                {[
                  { label: 'Total Users',            value: stats.total_users,           color: 'blue'   },
                  { label: 'Total Scans',             value: stats.total_scans,           color: 'purple' },
                  { label: 'Vulnerabilities Found',   value: stats.total_vulnerabilities, color: 'red'    },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`admin-stat-card admin-stat--${color}`}>
                    <div className="admin-stat-value">{value}</div>
                    <div className="admin-stat-label">{label}</div>
                  </div>
                ))}
              </div>

              {/* ── 3-column donut charts ── */}
              <div className="charts-grid">

                {/* Severity Distribution */}
                <div className="card chart-card">
                  <div className="card-header">
                    <span className="card-title">Severity Distribution</span>
                  </div>
                  <div className="chart-body">
                    {severityChartData.length > 0 ? (
                      <>
                        {/* Fixed width+height on PieChart — no ResponsiveContainer for donuts */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <PieChart width={220} height={220}>
                            <Pie
                              data={severityChartData}
                              cx={110}
                              cy={110}
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {severityChartData.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={SEVERITY_COLORS[entry.name.toLowerCase()] || CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val) => [val, 'Findings']}
                              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: 'var(--shadow)' }}
                            />
                          </PieChart>
                        </div>
                        <PieLegend data={severityChartData} colorMap={SEVERITY_COLORS} fallbackColors={CHART_COLORS} />
                      </>
                    ) : (
                      <div className="empty-chart"><p>No severity data yet</p></div>
                    )}
                  </div>
                </div>

                {/* Scan Types */}
                <div className="card chart-card">
                  <div className="card-header">
                    <span className="card-title">Scan Types</span>
                  </div>
                  <div className="chart-body">
                    {scanTypeChartData.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <PieChart width={220} height={220}>
                            <Pie
                              data={scanTypeChartData}
                              cx={110}
                              cy={110}
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {scanTypeChartData.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={SCAN_TYPE_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val) => [val, 'Scans']}
                              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: 'var(--shadow)' }}
                            />
                          </PieChart>
                        </div>
                        <PieLegend data={scanTypeChartData} colorMap={SCAN_TYPE_COLORS} fallbackColors={CHART_COLORS} />
                      </>
                    ) : (
                      <div className="empty-chart"><p>No scan data yet</p></div>
                    )}
                  </div>
                </div>

                {/* Users by Role */}
                <div className="card chart-card">
                  <div className="card-header">
                    <span className="card-title">Users by Role</span>
                  </div>
                  <div className="chart-body">
                    {roleChartData.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <PieChart width={220} height={220}>
                            <Pie
                              data={roleChartData}
                              cx={110}
                              cy={110}
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                              stroke="none"
                            >
                              {roleChartData.map((entry, i) => (
                                <Cell
                                  key={i}
                                  fill={entry.name === 'Admin' ? '#dc2626' : '#6366f1'}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(val) => [val, 'Users']}
                              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: 'var(--shadow)' }}
                            />
                          </PieChart>
                        </div>
                        <PieLegend
                          data={roleChartData}
                          colorMap={{ admin: '#dc2626', user: '#6366f1' }}
                          fallbackColors={CHART_COLORS}
                        />
                      </>
                    ) : (
                      <div className="empty-chart"><p>No role data yet</p></div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Full-width bar chart ── */}
              <div className="card chart-card-full">
                <div className="card-header">
                  <span className="card-title">Top Vulnerability Types</span>
                </div>
                <div className="chart-body">
                  {vulnTypeChartData.length > 0 ? (
                    /* Explicit height wrapper — ResponsiveContainer needs a real pixel height from its parent */
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={vulnTypeChartData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: 'var(--text3)' }}
                          angle={-35}
                          textAnchor="end"
                          height={70}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--text3)' }}
                          allowDecimals={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: 'none', boxShadow: 'var(--shadow)' }}
                          formatter={(val, name, props) => [val, props.payload.full || 'Count']}
                          labelStyle={{ fontWeight: 600, fontSize: 13 }}
                        />
                        <Bar
                          dataKey="count"
                          fill="url(#barGradient)"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={56}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="empty-chart"><p>No vulnerability data yet</p></div>
                  )}
                </div>
              </div>

              {/* ── User status table ── */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">User Status Breakdown</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <table className="scan-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusChartData.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                            No user data
                          </td>
                        </tr>
                      ) : (
                        statusChartData.map(s => (
                          <tr key={s.name}>
                            <td>
                              <span className={`badge ${s.name === 'Active' ? 'badge-success' : s.name === 'Banned' ? 'badge-critical' : 'badge-info'}`}>
                                {s.name}
                              </span>
                            </td>
                            <td><span className="badge badge-info">{s.value}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS TAB ─────────────────────────────────── */}
          {tab === 'users' && (
            <div>
              <div className="admin-search">
                <Search size={15} />
                <input
                  className="input"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 36 }}
                />
                <select
                  className="input"
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  style={{ maxWidth: 170 }}
                >
                  <option value="all">All plans</option>
                  <option value="free">Free</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="university">University</option>
                </select>
              </div>

              <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                  {filteredUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                      <Users size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <p>{search ? 'No users match your search' : 'No users found'}</p>
                    </div>
                  ) : (
                    <table className="scan-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Plan</th>
                          <th>Status</th>
                          <th>Scans</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(user => (
                          <tr key={user.id}>
                            <td style={{ fontWeight: 500 }}>{user.name}</td>
                            <td style={{ color: 'var(--text3)', fontSize: 13 }}>{user.email}</td>
                            <td>
                              <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-low'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>
                              {user.role === 'admin' ? (
                                <span className="badge badge-info">ADMIN ACCESS</span>
                              ) : (
                                <select
                                  className="input"
                                  value={user.subscription_plan || 'free'}
                                  style={{ minWidth: 130, padding: '6px 8px', fontSize: 12 }}
                                  onChange={(e) => updateUser(user.id, { subscription_plan: e.target.value }, user.name)}
                                >
                                  <option value="free">Free</option>
                                  <option value="standard">Standard</option>
                                  <option value="premium">Premium</option>
                                  <option value="enterprise">Enterprise</option>
                                  <option value="university">University</option>
                                </select>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${user.status === 'banned' ? 'badge-critical' : 'badge-success'}`}>
                                {user.status || 'active'}
                              </span>
                            </td>
                            <td><span className="badge badge-info">{user.scan_count}</span></td>
                            <td style={{ color: 'var(--text3)', fontSize: 13 }}>{user.created_at}</td>
                            <td>
                              {user.email !== 'admin@securescan.local' && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    title={user.status === 'banned' ? 'Unban user' : 'Ban user'}
                                    onClick={() => setConfirmAction({
                                      type: user.status === 'banned' ? 'unban' : 'ban',
                                      userId: user.id, userName: user.name
                                    })}
                                  >
                                    {user.status === 'banned' ? <UserCheck size={13} /> : <Ban size={13} />}
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                                    onClick={() => setConfirmAction({
                                      type: user.role === 'admin' ? 'demote' : 'promote',
                                      userId: user.id, userName: user.name
                                    })}
                                  >
                                    {user.role === 'admin' ? <Ban size={13} /> : <UserPlus size={13} />}
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid #fecaca' }}
                                    title="Delete user"
                                    onClick={() => setConfirmAction({
                                      type: 'delete', userId: user.id, userName: user.name
                                    })}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SCANS TAB ─────────────────────────────────── */}
          {tab === 'scans' && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {scans.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                    <ShieldAlert size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p>No scans found</p>
                  </div>
                ) : (
                  <table className="scan-table">
                    <thead>
                      <tr>
                        <th>Scan ID</th>
                        <th>User</th>
                        <th>Target</th>
                        <th>Type</th>
                        <th>Critical</th>
                        <th>High</th>
                        <th>Total</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map(scan => (
                        <tr key={scan.id}>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                            {scan.id.slice(-8)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                              <span style={{ fontWeight: 500 }}>{scan.user_name || 'Unknown'}</span>
                              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{scan.user_email || scan.user_id}</span>
                            </div>
                          </td>
                          <td className="scan-name">{scan.target}</td>
                          <td><span className="badge badge-info">{scan.type}</span></td>
                          <td>
                            {scan.critical > 0
                              ? <span className="badge badge-critical">{scan.critical}</span>
                              : <span className="count-zero">—</span>}
                          </td>
                          <td>
                            {scan.high > 0
                              ? <span className="badge badge-high">{scan.high}</span>
                              : <span className="count-zero">—</span>}
                          </td>
                          <td><span className="badge badge-info">{scan.total}</span></td>
                          <td className="scan-time">{scan.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </>
      )}
    </div>
  )
}