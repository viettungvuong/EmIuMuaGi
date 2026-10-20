import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import '../styles/AuthPage.css';

export default function AuthPage({ setIsAuth }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup', or 'verify' (entering the emailed OTP)
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
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
      } else if (mode === 'signup') {
        // This only emails a code; the account is created once the code is entered
        const response = await client.post('/api/auth/signup', { username, email, password });
        if (response.status === 201 || response.data.success) {
          setOtp('');
          setMode('verify');
        }
      } else {
        const response = await client.post('/api/auth/signup/verify', { username, email, password, otp });
        if (response.status === 201 || response.data.success) {
          setMode('login');
          setError('Đăng ký thành công! Hãy đăng nhập.');
          // Clear sensitive fields
          setPassword('');
          setOtp('');
        }
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (mode === 'verify') {
        setError('Xác thực thất bại. Vui lòng thử lại.');
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

  // A new code, for when the first one never arrived or has expired
  const resendOtp = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await client.post('/api/auth/signup', { username, email, password });
      setOtp('');
      setError('Đã gửi lại mã thành công! Kiểm tra email nhé.');
    } catch (err) {
      setError(err.response?.data?.error || 'Không gửi lại được mã. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Back to the signup form, still filled in, e.g. to fix a mistyped email
  const backToSignup = () => {
    setMode('signup');
    setError('');
    setOtp('');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-icon">🎀</div>
          <h1 className="auth-title">EmIuMuaGi</h1>
          <p className="auth-subtitle">
            {mode === 'verify' ? (
              <>Nhập mã 6 số vừa được gửi tới <strong>{email}</strong></>
            ) : mode === 'login' ? 'Em ấy bắt mua đồ hỏoo' : 'Tạo tài khoản mới để bắt đầu.'}
          </p>
        </div>

        {mode !== 'verify' && (
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
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'verify' ? (
            <div className="input-group">
              <span className="input-label">Mã xác thực</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="auth-input otp-input"
                placeholder="••••••"
                pattern="[0-9]{6}"
                title="Mã gồm 6 chữ số"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </div>
          ) : (
            <>
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
            </>
          )}

          {error && <p className={`error-msg ${error.includes('thành công') ? 'success-msg' : ''}`} style={error.includes('thành công') ? {color: '#10b981'} : {}}>{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Đang xử lý...
              </>
            ) : (
              mode === 'login' ? 'Đăng Nhập' : mode === 'signup' ? 'Đăng Ký' : 'Xác Nhận'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'verify' ? (
            <>
              <p>Không nhận được mã? <span className="auth-link" onClick={resendOtp}>Gửi lại</span></p>
              <p>Sai email? <span className="auth-link" onClick={backToSignup}>Quay lại</span></p>
            </>
          ) : mode === 'login' ? (
            <p>Chưa có tài khoản? <span className="auth-link" onClick={toggleMode}>Đăng ký ngay</span></p>
          ) : (
            <p>Đã có tài khoản? <span className="auth-link" onClick={toggleMode}>Đăng nhập</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
