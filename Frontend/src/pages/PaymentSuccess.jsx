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
      if (!sessionId) {
        setState('failed');
        return;
      }
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');

        // 1. Verify payment session
        const res = await fetch(`${API_URL}/api/payments/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not verify payment');

        // 2. Update subscription plan in local storage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.subscription_plan = data.plan;
        localStorage.setItem('user', JSON.stringify(user));

        // 3. Fetch fresh user data (includes enterprise_setup_completed, organization_id)
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!meRes.ok) throw new Error('Failed to fetch user');

        const freshUser = await meRes.json();
        localStorage.setItem('user', JSON.stringify(freshUser));

        setState('success');
        addToast(`Payment verified. You are now on the ${data.plan} plan.`, 'success');

        // 4. Redirect based on plan and setup status
        // Only enterprise users with a freshly purchased enterprise plan and not yet setup go to setup
        if (data.plan === 'enterprise' && 
            freshUser.subscription_plan === 'enterprise' && 
            !freshUser.enterprise_setup_completed) {
          console.log('Enterprise first purchase → redirect to setup');
          window.location.href = '/enterprise/setup';
        } 
        else if (freshUser.organization_id) {
          console.log('Enterprise existing member → dashboard');
          window.location.href = '/enterprise/dashboard';
        } 
        else {
          console.log('Regular user → billing');
          window.location.href = '/billing';
        }
      } catch (err) {
        console.error(err);
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
      </div>
    </div>
  );
}