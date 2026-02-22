import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/MainPage.css';

export default function MainPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchItems = async () => {
    try {
      const { data } = await client.get('/api/items');
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authenticated');
    navigate('/login');
  };

  return (
    <div className="main-page">
      <header className="main-header">
        <div className="header-left">
          <h1 className="main-title">Danh Sách<span className="accent"> Của Tôi</span></h1>
          <span className="item-count">{items.length} mục</span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Đăng Xuất</button>
      </header>

      <div className="items-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Đang tải…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p className="empty-text">Chưa có mục nào. Hãy thêm mục đầu tiên!</p>
          </div>
        ) : (
          <ul className="items-list">
            {items.map((item) => (
              <li key={item.id} className="item-card">
                <div className="item-info">
                  <h3 className="item-name">{item.name}</h3>
                  {item.description && (
                    <p className="item-description">{item.description}</p>
                  )}
                  <span className="item-date">
                    {new Date(item.created_at).toLocaleDateString('vi-VN', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(item.id)}
                  aria-label="Xóa mục"
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="fab" onClick={() => navigate('/add')} aria-label="Thêm mục mới">
        +
      </button>
    </div>
  );
}
