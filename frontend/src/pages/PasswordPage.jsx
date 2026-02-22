import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/PasswordPage.css';

export default function PasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await client.post('/api/auth/login', { password });
      localStorage.setItem('authenticated', 'true');
      navigate('/');
    } catch {
      setError('Incorrect password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-page">
      <div className="password-card">
        <div className="lock-icon">🔒</div>
        <h1 className="password-title">Secure Access</h1>
        <p className="password-subtitle">Enter your password to continue</p>
        <form onSubmit={handleSubmit} className="password-form">
          <div className="input-wrapper">
            <input
              type="password"
              className={`password-input ${error ? 'input-error' : ''}`}
              placeholder="Enter password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="submit-btn" disabled={loading || !password}>
            {loading ? <span className="spinner" /> : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
