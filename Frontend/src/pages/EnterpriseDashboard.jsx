import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Users, FolderKanban, ScanLine, PlusCircle, ExternalLink } from 'lucide-react';
import { useToast } from '../components/Toast';
import '../components/Layout.css';
import './Dashboard.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadDashboard = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/enterprise/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 403) {
        if (!syncing) {
          setSyncing(true);
          const syncRes = await fetch(`${API_URL}/api/enterprise/sync`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (syncRes.ok) {
            const meRes = await fetch(`${API_URL}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (meRes.ok) {
              const freshUser = await meRes.json();
              localStorage.setItem('user', JSON.stringify(freshUser));
            }
            loadDashboard();
            return;
          } else {
            addToast('Could not sync enterprise organization', 'error');
            navigate('/billing');
          }
        }
        return;
      }
      if (!res.ok) throw new Error('Failed to load dashboard');
      const json = await res.json();
      setData(json);

      // Fetch projects (optional)
      const projectsRes = await fetch(`${API_URL}/api/enterprise/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData);
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load enterprise dashboard', 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const copyInviteCode = () => {
    if (data?.invite_code) {
      navigator.clipboard.writeText(data.invite_code);
      addToast('Invite code copied!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="card">
          <div className="card-body">Loading enterprise dashboard...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard">
        <div className="card">
          <div className="card-body">
            Error loading dashboard. <a href="/billing">Go to billing</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Enterprise Dashboard</h1>
        <p className="page-subtitle">{data.organization_name}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon--blue">
            <ScanLine size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="stat-value">{data.scans_count}</div>
            <div className="stat-label">Total Scans</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon--green">
            <FolderKanban size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="stat-value">{data.projects_count}</div>
            <div className="stat-label">Projects</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon--purple">
            <Users size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div className="stat-value">{data.member_count}</div>
            <div className="stat-label">Team Members</div>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="action-card" onClick={() => navigate('/sast')}>
          <div className="action-icon action-icon--blue">
            <PlusCircle size={20} strokeWidth={1.75} />
          </div>
          <div className="action-content">
            <h3>New SAST Scan</h3>
            <p>Start a source code analysis</p>
          </div>
          <ExternalLink size={16} className="action-arrow" />
        </button>
        <button className="action-card" onClick={() => navigate('/dast')}>
          <div className="action-icon action-icon--purple">
            <PlusCircle size={20} strokeWidth={1.75} />
          </div>
          <div className="action-content">
            <h3>New DAST Scan</h3>
            <p>Run a dynamic web scan</p>
          </div>
          <ExternalLink size={16} className="action-arrow" />
        </button>
      </div>

      {data.is_owner && data.invite_code && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header">
            <span className="card-title">Invite Team Members</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: '1.2rem', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px' }}>
                {data.invite_code}
              </code>
              <button onClick={copyInviteCode} className="btn btn-secondary btn-sm">
                <Copy size={14} /> Copy Code
              </button>
            </div>
            <p style={{ marginTop: 12, color: 'var(--text3)' }}>
              Share this code with your developers. They can join by going to <strong>/enterprise/join</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">Team Members</span>
          {data.is_owner && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/enterprise/join')}>
              + Invite Member
            </button>
          )}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="scan-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td className="scan-name">{member.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <span className={`badge ${member.is_owner ? 'badge-info' : 'badge-secondary'}`}>
                      {member.is_owner ? 'Owner' : 'Member'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {projects.length > 0 && (
        <div className="card" style={{ marginTop: '24px' }}>
          <div className="card-header">
            <span className="card-title">Projects</span>
            {data.is_owner && (
              <button className="btn btn-primary btn-sm" onClick={() => alert('Create project – add endpoint')}>
                New Project
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="scan-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Last Scan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="scan-name">{project.name}</td>
                    <td>{project.description || '—'}</td>
                    <td className="scan-time">{project.last_scan_date || 'Never'}</td>
                    <td>
                      <span className="badge badge-info">{project.scan_status || 'Pending'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}