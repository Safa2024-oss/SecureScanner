import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Copy, Users, FolderKanban, ScanLine, PlusCircle, ExternalLink, Mail, X, Trash2, RefreshCw, 
  Eye, ChevronRight, UserPlus, FileText
} from 'lucide-react';
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
  

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showScansModal, setShowScansModal] = useState(false);
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [assigningMembers, setAssigningMembers] = useState(false);
  
 
  const [scansData, setScansData] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [projectScans, setProjectScans] = useState([]);
  const [loadingProjectScans, setLoadingProjectScans] = useState(false);
  const [memberScans, setMemberScans] = useState([]);
  const [loadingMemberScans, setLoadingMemberScans] = useState(false);

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

  const loadAllScans = async () => {
    setLoadingScans(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/scans?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const scans = await res.json();
        setScansData(scans);
        setShowScansModal(true);
      } else {
        addToast('Failed to load scans', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load scans', 'error');
    } finally {
      setLoadingScans(false);
    }
  };

  const loadProjectScans = async (project) => {
    setLoadingProjectScans(true);
    setSelectedProject(project);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/projects/${project.id}/scans?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const scans = await res.json();
        setProjectScans(scans);
        setShowProjectDetailsModal(true);
      } else {
        addToast('Failed to load project scans', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load project scans', 'error');
    } finally {
      setLoadingProjectScans(false);
    }
  };

  const loadMemberScans = async (member) => {
    setLoadingMemberScans(true);
    setSelectedMember(member);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/members/${member.user_id}/scans?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const scans = await res.json();
        setMemberScans(scans);
        setShowMemberDetailsModal(true);
      } else {
        addToast('Failed to load member scans', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to load member scans', 'error');
    } finally {
      setLoadingMemberScans(false);
    }
  };

  const copyInviteCode = () => {
    if (data?.invite_code) {
      navigator.clipboard.writeText(data.invite_code);
      addToast('Invite code copied!', 'success');
    }
  };

  const regenerateInviteCode = async () => {
    setRegeneratingCode(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/invite-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('New invite code generated!', 'success');
        loadDashboard();
      } else {
        addToast('Failed to generate new code', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setRegeneratingCode(false);
    }
  };

  const sendEmailInvite = async () => {
    if (!inviteEmail.trim()) {
      addToast('Please enter an email address', 'error');
      return;
    }
    setInviting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail })
      });
      if (res.ok) {
        addToast(`Invitation sent to ${inviteEmail}`, 'success');
        setInviteEmail('');
        setShowInviteModal(false);
      } else {
        const error = await res.json();
        addToast(error.detail || 'Failed to send invite', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setInviting(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      addToast('Project name is required', 'error');
      return;
    }
    setCreatingProject(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDesc
        })
      });
      if (res.ok) {
        addToast('Project created successfully!', 'success');
        setShowCreateProjectModal(false);
        setNewProjectName('');
        setNewProjectDesc('');
        loadDashboard();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to create project', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  const removeMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from the organization?`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast(`${memberName} removed from organization`, 'success');
        loadDashboard();
      } else {
        addToast('Failed to remove member', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    }
  };

  const openAssignModal = async (project) => {
    setSelectedProject(project);
    setSelectedMembers([]);
    
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/enterprise/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const members = await res.json();
        setAvailableMembers(members.filter(m => !m.is_owner));
        setShowAssignModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveAssignments = async () => {
    setAssigningMembers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/projects/${selectedProject.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_ids: selectedMembers })
      });
      if (res.ok) {
        addToast('Members assigned successfully!', 'success');
        setShowAssignModal(false);
        loadDashboard();
      } else {
        addToast('Failed to assign members', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    } finally {
      setAssigningMembers(false);
    }
  };

  const toggleMember = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const scrollToProjects = () => {
    document.getElementById('projects-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMembers = () => {
    document.getElementById('team-members-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const SeverityBadge = ({ critical, high, medium, low }) => (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {critical > 0 && <span className="badge badge-critical">{critical}</span>}
      {high > 0 && <span className="badge badge-high">{high}</span>}
      {medium > 0 && <span className="badge badge-medium">{medium}</span>}
      {low > 0 && <span className="badge badge-low">{low}</span>}
    </div>
  );

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
      {}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invite Team Member</h3>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Enter the email address of the person you want to invite. They will receive an email with a magic link to join your enterprise.</p>
              <input
                type="email"
                className="input"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ marginTop: 16 }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={sendEmailInvite} disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showCreateProjectModal && (
        <div className="modal-overlay" onClick={() => setShowCreateProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button className="modal-close" onClick={() => setShowCreateProjectModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <label>Project Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Mobile App Security"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
              <div>
                <label>Description (optional)</label>
                <textarea
                  className="input"
                  placeholder="What is this project about?"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreateProjectModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={createProject} disabled={creatingProject}>
                {creatingProject ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showAssignModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Assign Members to "{selectedProject.name}"</h3>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text3)' }}>Select which team members can access this project.</p>
              {availableMembers.length === 0 ? (
                <p style={{ color: 'var(--text3)' }}>No members available to assign.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availableMembers.map(member => (
                    <label key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedMembers.includes(member.user_id)} onChange={() => toggleMember(member.user_id)} />
                      <strong>{member.name}</strong> <span style={{ color: 'var(--text3)', fontSize: '12px' }}>({member.email})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveAssignments} disabled={assigningMembers}>
                {assigningMembers ? 'Assigning...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showScansModal && (
        <div className="modal-overlay" onClick={() => setShowScansModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h3>All Scans</h3>
              <button className="modal-close" onClick={() => setShowScansModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingScans ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Loading scans...</div>
              ) : scansData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
                  <FileText size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p>No scans yet</p>
                </div>
              ) : (
                <table className="scan-table">
                  <thead>
                    <tr><th>Date</th><th>User</th><th>Type</th><th>Target</th><th>Project</th><th>Findings</th></tr>
                  </thead>
                  <tbody>
                    {scansData.map(scan => (
                      <tr key={scan.id}>
                        <td className="scan-time">{new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>{scan.user_name}</td>
                        <td><span className="badge badge-info">{scan.type}</span></td>
                        <td className="scan-name">{scan.target?.substring(0, 50)}</td>
                        <td>{scan.project_name || '—'}</td>
                        <td><SeverityBadge critical={scan.critical} high={scan.high} medium={scan.medium} low={scan.low} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowScansModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {}
      {showProjectDetailsModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowProjectDetailsModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h3>Project: {selectedProject.name}</h3>
              <button className="modal-close" onClick={() => setShowProjectDetailsModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <p><strong>Description:</strong> {selectedProject.description || 'No description'}</p>
                <p><strong>Status:</strong> <span className="badge badge-info">{selectedProject.scan_status || 'Pending'}</span></p>
                <p><strong>Last Scan:</strong> {selectedProject.last_scan_date || 'Never'}</p>
              </div>
              <h4>Scan History</h4>
              {loadingProjectScans ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading scans...</div>
              ) : projectScans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No scans for this project yet.</div>
              ) : (
                <table className="scan-table">
                  <thead><tr><th>Date</th><th>User</th><th>Type</th><th>Target</th><th>Findings</th></tr></thead>
                  <tbody>
                    {projectScans.map(scan => (
                      <tr key={scan.id}>
                        <td className="scan-time">{new Date(scan.created_at).toLocaleDateString()}</td>
                        <td>{scan.user_name}</td>
                        <td><span className="badge badge-info">{scan.type}</span></td>
                        <td className="scan-name">{scan.target?.substring(0, 50)}</td>
                        <td><SeverityBadge critical={scan.critical} high={scan.high} medium={scan.medium} low={scan.low} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowProjectDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {}
      {showMemberDetailsModal && selectedMember && (
        <div className="modal-overlay" onClick={() => setShowMemberDetailsModal(false)}>
          <div className="modal-content wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <div className="modal-header">
              <h3>Member: {selectedMember.name}</h3>
              <button className="modal-close" onClick={() => setShowMemberDetailsModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <p><strong>Email:</strong> {selectedMember.email}</p>
                <p><strong>Role:</strong> <span className="badge badge-info">{selectedMember.is_owner ? 'Owner' : 'Member'}</span></p>
              </div>
              <h4>Scan History</h4>
              {loadingMemberScans ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading scans...</div>
              ) : memberScans.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No scans by this member yet.</div>
              ) : (
                <table className="scan-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Target</th><th>Project</th><th>Findings</th></tr></thead>
                  <tbody>
                    {memberScans.map(scan => (
                      <tr key={scan.id}>
                        <td className="scan-time">{new Date(scan.created_at).toLocaleDateString()}</td>
                        <td><span className="badge badge-info">{scan.type}</span></td>
                        <td className="scan-name">{scan.target?.substring(0, 50)}</td>
                        <td>{scan.project_name || '—'}</td>
                        <td><SeverityBadge critical={scan.critical} high={scan.high} medium={scan.medium} low={scan.low} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMemberDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {}
      <div className="page-header">
        <h1 className="page-title">Enterprise Dashboard</h1>
        <p className="page-subtitle">{data.organization_name}</p>
      </div>

      {}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={loadAllScans}>
          <div className="stat-icon stat-icon--blue"><ScanLine size={18} strokeWidth={1.75} /></div>
          <div><div className="stat-value">{data.scans_count}</div><div className="stat-label">Total Scans</div></div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text3)' }} />
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={scrollToProjects}>
          <div className="stat-icon stat-icon--green"><FolderKanban size={18} strokeWidth={1.75} /></div>
          <div><div className="stat-value">{data.projects_count}</div><div className="stat-label">Projects</div></div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text3)' }} />
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={scrollToMembers}>
          <div className="stat-icon stat-icon--purple"><Users size={18} strokeWidth={1.75} /></div>
          <div><div className="stat-value">{data.member_count}</div><div className="stat-label">Team Members</div></div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text3)' }} />
        </div>
      </div>

      <div className="quick-actions">
        <button className="action-card" onClick={() => navigate('/sast')}>
          <div className="action-icon action-icon--blue"><PlusCircle size={20} strokeWidth={1.75} /></div>
          <div className="action-content"><h3>New SAST Scan</h3><p>Start a source code analysis</p></div>
          <ExternalLink size={16} className="action-arrow" />
        </button>
        <button className="action-card" onClick={() => navigate('/dast')}>
          <div className="action-icon action-icon--purple"><PlusCircle size={20} strokeWidth={1.75} /></div>
          <div className="action-content"><h3>New DAST Scan</h3><p>Run a dynamic web scan</p></div>
          <ExternalLink size={16} className="action-arrow" />
        </button>
      </div>

      {}
      {data.is_owner && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="card-header"><span className="card-title">Invite Team Members</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => setShowInviteModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={14} /> Invite by Email
              </button>
              {data.invite_code && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>Invite code:</span>
                  <code style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', fontSize: 13 }}>{data.invite_code}</code>
                  <button onClick={copyInviteCode} className="btn btn-secondary btn-sm"><Copy size={14} /> Copy</button>
                  <button onClick={regenerateInviteCode} className="btn btn-secondary btn-sm" disabled={regeneratingCode}><RefreshCw size={14} /> Regenerate</button>
                </div>
              )}
            </div>
            <p style={{ marginTop: 12, color: 'var(--text3)', fontSize: 13 }}>Invited members will receive an email with a magic link to join your organization.</p>
          </div>
        </div>
      )}

      {}
      <div className="card" id="team-members-section">
        <div className="card-header">
          <span className="card-title">Team Members</span>
          {data.is_owner && <button className="btn btn-primary btn-sm" onClick={() => setShowInviteModal(true)}><UserPlus size={14} /> Invite Member</button>}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="scan-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Scans</th>{data.is_owner && <th>Actions</th>}</tr></thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.user_id}>
                  <td className="scan-name" style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => loadMemberScans(member)}>
                    {member.name} <Eye size={12} style={{ display: 'inline', marginLeft: 6 }} />
                  </td>
                  <td>{member.email}</td>
                  <td><span className={`badge ${member.is_owner ? 'badge-info' : 'badge-secondary'}`}>{member.is_owner ? 'Owner' : 'Member'}</span></td>
                  <td><span className="badge badge-info">View scans</span></td>
                  {data.is_owner && !member.is_owner && (
                    <td><button className="btn btn-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', border: '1px solid #fecaca' }} onClick={() => removeMember(member.user_id, member.name)}><Trash2 size={14} /> Remove</button></td>
                  )}
                  {data.is_owner && member.is_owner && <td>—</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="card" style={{ marginTop: '24px' }} id="projects-section">
        <div className="card-header">
          <span className="card-title">Projects</span>
          {data.is_owner && <button className="btn btn-primary btn-sm" onClick={() => setShowCreateProjectModal(true)}>+ New Project</button>}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {projects.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
              <FolderKanban size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No projects yet.</p>
              {data.is_owner && <button className="btn btn-primary btn-sm" onClick={() => setShowCreateProjectModal(true)} style={{ marginTop: 8 }}>Create your first project</button>}
            </div>
          ) : (
            <table className="scan-table">
              <thead><tr><th>Name</th><th>Description</th><th>Last Scan</th><th>Status</th><th>Scans</th>{data.is_owner && <th>Actions</th>}</tr></thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="scan-name" style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => loadProjectScans(project)}>
                      {project.name} <Eye size={12} style={{ display: 'inline', marginLeft: 6 }} />
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.description || '—'}</td>
                    <td className="scan-time">{project.last_scan_date || 'Never'}</td>
                    <td><span className="badge badge-info">{project.scan_status || 'Pending'}</span></td>
                    <td><span className="badge badge-info">View scans</span></td>
                    {data.is_owner && (
                      <td><button className="btn btn-secondary btn-sm" onClick={() => openAssignModal(project)}><Users size={14} /> Assign</button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {}
      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        }
        .modal-content.wide {
          max-width: 900px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }
        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
        }
        .modal-body {
          padding: 20px;
        }
        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        textarea.input {
          resize: vertical;
          min-height: 80px;
        }
      `}</style>
    </div>
  );
}