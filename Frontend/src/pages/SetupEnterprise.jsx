import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import '../components/Layout.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function SetupEnterprise() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_email: '',
    website: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      addToast('Company name is required', 'error');
      return;
    }
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/enterprise/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Setup failed');
      
      // Update local storage user with setup_completed flag
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.enterprise_setup_completed = true;
      localStorage.setItem('user', JSON.stringify(user));
      
      addToast('Enterprise setup complete!', 'success');
      navigate('/enterprise/dashboard');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard" style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Enterprise Setup</span>
        </div>
        <div className="card-body">
          <p style={{ marginBottom: '1rem', color: 'var(--text3)' }}>
            Please provide your company details to complete the setup.
          </p>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label>Company Name *</label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className="input"
                required
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Contact Email (optional)</label>
              <input
                type="email"
                name="contact_email"
                value={formData.contact_email}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>Website (optional)</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="input"
                placeholder="https://example.com"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}