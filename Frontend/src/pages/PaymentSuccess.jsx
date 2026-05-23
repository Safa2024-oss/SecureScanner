import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const [state, setState] = useState('verifying');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const verify = async () => {
      // DEBUG: Log everything
      console.log('=== PAYMENT SUCCESS PAGE DEBUG ===');
      console.log('Session ID:', sessionId);
      console.log('Current URL:', window.location.href);
      
      if (!sessionId) {
        console.error('No session_id in URL');
        setState('failed');
        return;
      }
      
      try {
        const token = localStorage.getItem('token');
        console.log('Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'null');
        
        if (!token) {
          console.error('No token found! Redirecting to login...');
          setState('failed');
          addToast('Session expired. Please log in again.', 'error');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }

        // 1. Verify payment session
        console.log('Verifying payment session...');
        const res = await fetch(`${API_URL}/api/payments/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log('Payment session response:', data);
        
        if (!res.ok) throw new Error(data.detail || 'Could not verify payment');

        // 2. Update subscription plan in local storage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        console.log('Current user from localStorage:', user);
        user.subscription_plan = data.plan;
        localStorage.setItem('user', JSON.stringify(user));

        // 3. Fetch fresh user data
        console.log('Fetching fresh user data...');
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!meRes.ok) {
          console.error('Failed to fetch user, status:', meRes.status);
          throw new Error('Failed to fetch user');
        }

        const freshUser = await meRes.json();
        console.log('Fresh user data:', freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));

        setState('success');
        addToast(`Payment verified. You are now on the ${data.plan} plan.`, 'success');

        // 4. Redirect
        console.log('Redirecting based on:', { plan: data.plan, organization_id: freshUser.organization_id, setup_completed: freshUser.enterprise_setup_completed });
        
        setTimeout(() => {
          if (data.plan === 'enterprise' && !freshUser.enterprise_setup_completed) {
            console.log('→ Redirecting to /enterprise/setup');
            window.location.href = '/enterprise/setup';
          } 
          else if (freshUser.organization_id) {
            console.log('→ Redirecting to /enterprise/dashboard');
            window.location.href = '/enterprise/dashboard';
          } 
          else {
            console.log('→ Redirecting to /dashboard');
            window.location.href = '/dashboard';
          }
        }, 1600);
        
      } catch (err) {
        console.error('Payment verification error:', err);
        setState('failed');
        addToast(err.message || 'Could not verify payment', 'error');
      }
    };

    verify();
  }, [sessionId, addToast]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <CheckCircle size={48} style={{ margin: '0 auto 24px', color: '#059669' }} />
        <h2>{state === 'failed' ? 'Payment Verification Failed' : 'Payment Successful'}</h2>
        <p>
          {state === 'verifying' && 'Verifying your subscription...'}
          {state === 'success' && 'Your account has been upgraded. Redirecting...'}
          {state === 'failed' && 'Please open billing and retry from invoice/payment management.'}
        </p>
        {state === 'failed' && (
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => window.location.href = '/login'}
            style={{ marginTop: '16px' }}
          >
            Go to Login
          </button>
        )}
      </div>
    </div>
  );
}