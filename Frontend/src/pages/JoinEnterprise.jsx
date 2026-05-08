import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import '../components/Layout.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function JoinEnterprise() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      addToast('Please enter an invite code', 'error');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/enterprise/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: code.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid code');
      
      // Refresh user data from server to get updated organization_id
      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (meRes.ok) {
        const freshUser = await meRes.json();
        localStorage.setItem('user', JSON.stringify(freshUser));
      }
      
      addToast('Successfully joined the enterprise!', 'success');
      // Force reload to refresh sidebar/layout if needed
      window.location.href = '/enterprise/dashboard';
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard" style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Join an Enterprise</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label>Invite Code</label>
              <input
                type="text"
                className="input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste the invite code here"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Joining...' : 'Join'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}