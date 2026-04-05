import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import client from './api/client';
import AuthPage from './pages/AuthPage';
import MainPage from './pages/MainPage';
import AddPage from './pages/AddPage';
import QuestionPage from './pages/QuestionPage';
import HistoryPage from './pages/HistoryPage';

import PartnerPage from './pages/PartnerPage';

function ProtectedRoute({ isAuth, loading, children }) {
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0d0f1a' }}>
      <div className="loading-spinner">🎀 Checking...</div>
    </div>
  );
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      try {
        await client.get("/api/me");
        setIsAuth(true);
      } catch (err) {
        setIsAuth(false);
      } finally {
        setLoading(false);
      }
    };
    verifySession();
  }, []);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route 
          path="/login" 
          element={isAuth ? <Navigate to="/" replace /> : <AuthPage setIsAuth={setIsAuth} />} 
        />
        <Route
          path="/"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <MainPage setIsAuth={setIsAuth} />
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
        <Route
          path="/partner/:inviteID"
          element={
            <ProtectedRoute isAuth={isAuth} loading={loading}>
              <PartnerPage setIsAuth={setIsAuth} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
