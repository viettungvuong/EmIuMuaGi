import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import client from './api/client';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import AddPage from './pages/AddPage';
import QuestionPage from './pages/QuestionPage';
import HistoryPage from './pages/HistoryPage';

function ProtectedRoute({ isAuth, loading, children }) {
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#fff5f7' }}>
      <div className="loading-spinner">🎀 Checking...</div>
    </div>
  );
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await client.get('/api/me');
        if (response.status === 200) {
          setIsAuth(true);
        }
      } catch (err) {
        setIsAuth(false);
        console.log("No valid session found.");
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<AuthPage setIsAuth={setIsAuth} />} />
        <Route
          path="/"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <AddPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/question"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <QuestionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
