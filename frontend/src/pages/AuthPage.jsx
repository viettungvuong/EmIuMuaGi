import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import LanguageIsland from '../components/LanguageIsland';
import { serverText, t, useLanguage } from '../i18n';
import '../styles/AuthPage.css';

// Mistakes the user fixes right here (a wrong or expired code, a taken username
// or email), shown larger so they aren't missed. As the server words them.
const BIG_ERRORS = ['Invalid or expired OTP', 'Username or Email already exists'];

export default function AuthPage({ setIsAuth }) {
  useLanguage(); // redraw when the island switches language
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
      setError(t('auth.sessionExpired'));
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
          setError(t('auth.signupSuccess'));
          // Clear sensitive fields
          setPassword('');
          setOtp('');
        }
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(serverText(err.response.data.error));
      } else if (err.response?.data?.message) {
        setError(serverText(err.response.data.message));
      } else if (mode === 'verify') {
        setError(t('auth.verifyFailed'));
      } else {
        setError(mode === 'login' ? t('auth.loginFailed') : t('auth.signupFailed'));
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
      setError(t('auth.codeResent'));
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t('auth.resendFailed'));
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

  // Success notes share the error line, in green
  const success = error === t('auth.signupSuccess') || error === t('auth.codeResent');
  const big = BIG_ERRORS.some((message) => error === serverText(message));

  return (
    <div className="auth-page">
      <LanguageIsland />
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-icon">🎀</div>
          <h1 className="auth-title">{t('auth.appName')}</h1>
          <p className="auth-subtitle">
            {mode === 'verify' ? (
              t('auth.verifySubtitle', { email: <strong>{email}</strong> })
            ) : mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
          </p>
        </div>

        {mode !== 'verify' && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              {t('auth.login')}
            </button>
            <button
              className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              {t('auth.signup')}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'verify' ? (
            <div className="input-group">
              <span className="input-label">{t('auth.otp')}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="auth-input otp-input"
                placeholder="••••••"
                pattern="[0-9]{6}"
                title={t('auth.otpTitle')}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
                required
              />
            </div>
          ) : (
            <>
              <div className="input-group">
                <span className="input-label">{t('auth.username')}</span>
                <input
                  type="text"
                  className={`auth-input ${error && !username ? 'input-error' : ''}`}
                  placeholder={t('auth.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              {mode === 'signup' && (
                <div className="input-group">
                  <span className="input-label">{t('auth.email')}</span>
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
                <span className="input-label">{t('auth.password')}</span>
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

          {error && <p className={`error-msg ${success ? 'success-msg' : ''} ${big ? 'error-msg-big' : ''}`} style={success ? {color: '#10b981'} : {}}>{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                {t('auth.processing')}
              </>
            ) : (
              mode === 'login' ? t('auth.login') : mode === 'signup' ? t('auth.signup') : t('auth.confirm')
            )}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'verify' ? (
            <>
              <p>{t('auth.noCode')} <span className="auth-link" onClick={resendOtp}>{t('auth.resend')}</span></p>
              <p>{t('auth.wrongEmail')} <span className="auth-link" onClick={backToSignup}>{t('auth.goBack')}</span></p>
            </>
          ) : mode === 'login' ? (
            <p>{t('auth.noAccount')} <span className="auth-link" onClick={toggleMode}>{t('auth.signupNow')}</span></p>
          ) : (
            <p>{t('auth.haveAccount')} <span className="auth-link" onClick={toggleMode}>{t('auth.loginLink')}</span></p>
          )}
        </div>
      </div>
    </div>
  );
}
