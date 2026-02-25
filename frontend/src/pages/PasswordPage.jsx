import CryptoJS from 'crypto-js';
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
      const aesKey = import.meta.env.VITE_AES_KEY;
      const aesIv = import.meta.env.VITE_AES_IV;

      const key = CryptoJS.enc.Utf8.parse(aesKey);
      const iv = CryptoJS.enc.Utf8.parse(aesIv);

      const encryptedPassword = CryptoJS.AES.encrypt(password, key, {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
      }).toString();

      await client.post('/api/auth/login', { password: encryptedPassword });
      localStorage.setItem('authenticated', 'true');
      navigate('/');
    } catch {
      setError('Mật khẩu không đúng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-page">
      <div className="password-card">
        <div className="lock-icon">🔒</div>
        <h1 className="password-title">Truy Cập Bảo Mật</h1>
        <p className="password-subtitle">Nhập mật khẩu để tiếp tục</p>
        <form onSubmit={handleSubmit} className="password-form">
          <div className="input-wrapper">
            <input
              type="password"
              className={`password-input ${error ? 'input-error' : ''}`}
              placeholder="Nhập mật khẩu…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="submit-btn" disabled={loading || !password}>
            {loading ? <span className="spinner" /> : 'Mở Khóa'}
          </button>
        </form>
      </div>
    </div>
  );
}
