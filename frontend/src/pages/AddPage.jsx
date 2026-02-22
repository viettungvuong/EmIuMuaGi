import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/AddPage.css';

export default function AddPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await client.post('/api/items', { name: name.trim(), description: description.trim() });
      navigate('/');
    } catch {
      setError('Failed to add item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-page">
      <div className="add-card">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h1 className="add-title">Add New Item</h1>
        <form onSubmit={handleSubmit} className="add-form">
          <div className="field-group">
            <label className="field-label" htmlFor="item-name">Name *</label>
            <input
              id="item-name"
              type="text"
              className={`field-input ${error && !name.trim() ? 'input-error' : ''}`}
              placeholder="Item name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="item-desc">Description</label>
            <textarea
              id="item-desc"
              className="field-input field-textarea"
              placeholder="Optional description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="add-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : '✓ Add Item'}
          </button>
        </form>
      </div>
    </div>
  );
}
