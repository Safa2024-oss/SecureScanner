import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying');
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    const accept = async () => {
      if (!token) {
        setStatus('invalid');
        return;
      }
      try {
        const authToken = localStorage.getItem('token');
        if (!authToken) {
          // Store invite token and redirect to login
          localStorage.setItem('pendingInviteToken', token);
          navigate('/login');
          return;
        }
        
        const res = await fetch(`${API_URL}/api/enterprise/invite/accept/${token}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (res.ok) {
          setStatus('success');
          addToast('You have joined the enterprise!', 'success');
          setTimeout(() => navigate('/enterprise/dashboard'), 2000);
        } else {
          const error = await res.json();
          setStatus('failed');
          addToast(error.detail || 'Failed to accept invitation', 'error');
        }
      } catch {
        setStatus('failed');
        addToast('Network error', 'error');
      }
    };
    accept();
  }, [token, navigate, addToast]);

  // Check for pending invite after login (if redirected)
  useEffect(() => {
    const pendingToken = localStorage.getItem('pendingInviteToken');
    if (pendingToken && localStorage.getItem('token')) {
      localStorage.removeItem('pendingInviteToken');
      navigate(`/enterprise/accept-invite?token=${pendingToken}`);
    }
  }, [navigate]);

  return (
    <div className="dashboard" style={{ maxWidth: '500px', margin: '2rem auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        {status === 'verifying' && (
          <>
            <div style={{ marginBottom: '16px' }}>⏳</div>
            <h2>Verifying invitation...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 16px' }} />
            <h2>Successfully Joined!</h2>
            <p style={{ color: 'var(--text3)' }}>Redirecting to dashboard...</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
            <h2>Invalid Invitation</h2>
            <p style={{ color: 'var(--text3)', marginBottom: '24px' }}>
              The link may have expired or already been used.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Go to Login
            </button>
          </>
        )}
        {status === 'invalid' && (
          <>
            <XCircle size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
            <h2>No Invitation Token</h2>
            <p style={{ color: 'var(--text3)' }}>Invalid invitation link.</p>
          </>
        )}
      </div>
    </div>
  );
}