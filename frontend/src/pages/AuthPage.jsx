import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import '../styles/AuthPage.css';

export default function AuthPage({ setIsAuth }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if redirected due to expired session
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') !== null) {
      setError('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      // Remove the query parameter from the address bar
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await client.post('/api/auth/login', { username, password });
        if (response.data.success || response.status === 200) {
          localStorage.setItem('username', username);
          setIsAuth(true); // Notify App component
          navigate('/');
        }
      } else {
        const response = await client.post('/api/auth/signup', { username, email, password });
        if (response.status === 201 || response.data.success) {
          setMode('login');
          setError('Đăng ký thành công! Hãy đăng nhập.');
          // Clear sensitive fields
          setPassword('');
        }
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(mode === 'login' ? 'Đăng nhập thất bại. Kiểm tra lại tài khoản.' : 'Đăng ký thất bại. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-icon">🎀</div>
          <h1 className="auth-title">EmIuMuaGi</h1>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Em ấy bắt mua đồ hỏoo' : 'Tạo tài khoản mới để bắt đầu.'}
          </p>
        </div>

        <div className="auth-tabs">
          <button 
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Đăng Nhập
          </button>
          <button 
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            Đăng Ký
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <span className="input-label">Tên đăng nhập</span>
            <input
              type="text"
              className={`auth-input ${error && !username ? 'input-error' : ''}`}
              placeholder="Username…"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="input-group">
              <span className="input-label">Email</span>
              <input
                type="email"
                className={`auth-input ${error && !email ? 'input-error' : ''}`}
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <span className="input-label">Mật khẩu</span>
            <input
              type="password"
              className={`auth-input ${error && !password ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className={`error-msg ${error.includes('thành công') ? 'success-msg' : ''}`} style={error.includes('thành công') ? {color: '#10b981'} : {}}>{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Đang xử lý...
              </>
            ) : (
              mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' ? (
            <p>Chưa có tài khoản? <span className="auth-link" onClick={toggleMode}>Đăng ký ngay</span></p>
          ) : (
            <p>Đã có tài khoản? <span className="auth-link" onClick={toggleMode}>Đăng nhập</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
