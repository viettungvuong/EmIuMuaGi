import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/AddPage.css';

const ITEM_TYPES = [
  { value: 'clothes',       label: '👕 Quần Áo' },
  { value: 'food_and_drink', label: '🧋 Đồ Ăn & Uống' },
  { value: 'others',        label: '📦 Khác' },
];

export default function AddPage() {
  const [itemType, setItemType] = useState('clothes');
  const [form, setForm] = useState({
    item_name: '', quantity: 1, shop_name: '', buy_url: '',
    // clothes
    size: '', color: '', brand: '',
    // food_and_drink
    sugar: '', notes: '', toppings: '',
    // others
    category: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) { setError('Vui lòng nhập tên.'); return; }
    setLoading(true);
    setError('');

    // Build payload — only include relevant subtype fields
    const base = {
      item_type: itemType,
      item_name: form.item_name.trim(),
      quantity: Number(form.quantity) || 1,
      shop_name: form.shop_name.trim() || null,
      buy_url: form.buy_url.trim() || null,
    };

    const subtypeFields =
      itemType === 'clothes'
        ? { size: form.size || null, color: form.color || null, brand: form.brand || null }
        : itemType === 'food_and_drink'
        ? {
            sugar: form.sugar || null,
            notes: form.notes || null,
            toppings: form.toppings ? form.toppings.split(',').map((t) => t.trim()).filter(Boolean) : null,
          }
        : { category: form.category || null };

    try {
      await client.post('/api/items', { ...base, ...subtypeFields });
      navigate('/');
    } catch {
      setError('Thêm mục thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-page">
      <div className="add-card">
        <button className="back-btn" onClick={() => navigate('/')}>← Quay Lại</button>
        <h1 className="add-title">Thêm Mục Mới</h1>

        <form onSubmit={handleSubmit} className="add-form">

          {/* Type selector */}
          <div className="type-tabs">
            {ITEM_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`type-tab ${itemType === t.value ? 'active' : ''}`}
                onClick={() => setItemType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Common fields */}
          <div className="field-group">
            <label className="field-label" htmlFor="item-name">Tên *</label>
            <input id="item-name" type="text" className={`field-input ${error && !form.item_name.trim() ? 'input-error' : ''}`}
              placeholder="Tên mục…" value={form.item_name} onChange={set('item_name')} autoFocus />
          </div>

          <div className="field-row">
            <div className="field-group">
              <label className="field-label" htmlFor="item-qty">Số lượng</label>
              <input id="item-qty" type="number" min="1" className="field-input"
                value={form.quantity} onChange={set('quantity')} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="item-shop">Cửa hàng</label>
              <input id="item-shop" type="text" className="field-input"
                placeholder="Tên cửa hàng…" value={form.shop_name} onChange={set('shop_name')} />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="item-url">Link mua hàng</label>
            <input id="item-url" type="url" className="field-input"
              placeholder="https://…" value={form.buy_url} onChange={set('buy_url')} />
          </div>

          {/* Clothes fields */}
          {itemType === 'clothes' && (
            <div className="field-row">
              <div className="field-group">
                <label className="field-label">Size</label>
                <input type="text" className="field-input" placeholder="S, M, L…"
                  value={form.size} onChange={set('size')} />
              </div>
              <div className="field-group">
                <label className="field-label">Màu sắc</label>
                <input type="text" className="field-input" placeholder="Xanh, Đỏ…"
                  value={form.color} onChange={set('color')} />
              </div>
              <div className="field-group">
                <label className="field-label">Thương hiệu</label>
                <input type="text" className="field-input" placeholder="Nike, Zara…"
                  value={form.brand} onChange={set('brand')} />
              </div>
            </div>
          )}

          {/* Food & Drink fields */}
          {itemType === 'food_and_drink' && (
            <>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label">Size</label>
                  <input type="text" className="field-input" placeholder="S, M, L…"
                    value={form.size} onChange={set('size')} />
                </div>
                <div className="field-group">
                  <label className="field-label">Đường</label>
                  <input type="text" className="field-input" placeholder="50%, 100%…"
                    value={form.sugar} onChange={set('sugar')} />
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Topping <span className="field-hint">(phân cách bằng dấu phẩy)</span></label>
                <input type="text" className="field-input" placeholder="boba, thạch, kem…"
                  value={form.toppings} onChange={set('toppings')} />
              </div>
              <div className="field-group">
                <label className="field-label">Ghi chú</label>
                <textarea className="field-input field-textarea" placeholder="Ít đá, không đường…"
                  value={form.notes} onChange={set('notes')} rows={3} />
              </div>
            </>
          )}

          {/* Others fields */}
          {itemType === 'others' && (
            <div className="field-group">
              <label className="field-label">Danh mục</label>
              <input type="text" className="field-input" placeholder="Nhập danh mục…"
                value={form.category} onChange={set('category')} />
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="add-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : '✓ Thêm Mục'}
          </button>
        </form>
      </div>
    </div>
  );
}
