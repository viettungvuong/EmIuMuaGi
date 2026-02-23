import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import PasswordPage from './pages/PasswordPage';
import MainPage from './pages/MainPage';
import AddPage from './pages/AddPage';

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('authenticated') === 'true';
  return isAuth ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/login" element={<PasswordPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <AddPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
