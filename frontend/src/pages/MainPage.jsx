import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/MainPage.css';

const TYPE_LABELS = {
  clothes: 'Quần Áo',
  food_and_drink: 'Đồ Ăn & Uống',
  others: 'Khác',
};

const TYPE_COLORS = {
  clothes: '#7c3aed',
  food_and_drink: '#0891b2',
  others: '#6b7280',
};

function ItemSubInfo({ item }) {
  if (item.item_type === 'clothes') {
    const parts = [item.size, item.color, item.brand].filter(Boolean);
    return parts.length ? <p className="item-subinfo">{parts.join(' · ')}</p> : null;
  }
  if (item.item_type === 'food_and_drink') {
    const parts = [item.size, item.sugar && `Đường: ${item.sugar}`].filter(Boolean);
    const toppingStr = item.toppings?.length ? `Topping: ${item.toppings.join(', ')}` : null;
    return (parts.length || toppingStr) ? (
      <p className="item-subinfo">{[...parts, toppingStr].filter(Boolean).join(' · ')}</p>
    ) : null;
  }
  if (item.item_type === 'others' && item.category) {
    return <p className="item-subinfo">{item.category}</p>;
  }
  return null;
}

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
          <h1 className="main-title">Em Iu<span className="accent"> Muốn Gìiiiii</span></h1>
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
            <span className="empty-icon">🧐</span>
            <p className="empty-text">Bà xã chưa mún mua gì hỏooooo</p>
          </div>
        ) : (
          <ul className="items-list">
            {items.map((item) => (
              <li key={item.id} className="item-card">
                <div className="item-info">
                  <div className="item-header-row">
                    <h3 className="item-name">{item.item_name}</h3>
                    <span
                      className="item-type-badge"
                      style={{ background: TYPE_COLORS[item.item_type] + '22', color: TYPE_COLORS[item.item_type], borderColor: TYPE_COLORS[item.item_type] + '55' }}
                    >
                      {TYPE_LABELS[item.item_type] ?? item.item_type}
                    </span>
                  </div>
                  <ItemSubInfo item={item} />
                  <div className="item-meta">
                    {item.shop_name && <span className="item-shop">🏪 {item.shop_name}</span>}
                    {item.quantity > 1 && <span className="item-qty">x{item.quantity}</span>}
                    <span className="item-date">
                      {new Date(item.created_at).toLocaleDateString('vi-VN', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </div>
                  {item.buy_url && (
                    <a className="item-link" href={item.buy_url} target="_blank" rel="noreferrer">
                      🔗 Xem sản phẩm
                    </a>
                  )}
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
