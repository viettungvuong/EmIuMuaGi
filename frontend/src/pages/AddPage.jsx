import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import '../styles/AddPage.css';

const ITEM_TYPES = [
  { value: 'clothes',       label: '👕 Quần Áo' },
  { value: 'food_and_drink', label: '🧋 Đồ Ăn & Uống' },
  { value: 'restaurant',    label: '🍜 Nhà Hàng' },
  { value: 'others',        label: '📦 Khác' },
];

// How long the link has to stay unchanged before it is sent to the parser
const PARSE_DEBOUNCE_MS = 500;

// crypto.randomUUID only exists on https/localhost, so fall back for LAN testing
const newUuid = () =>
  crypto.randomUUID?.() ??
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));

// Same origin as the REST calls, just over ws(s)
const parseSocketUrl = (uuid) =>
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/parse/ws/${uuid}`;

// A TikTok video or share link: the server looks up where it was filmed
const isTikTokLink = (url) => {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') return pathname.length > 1;
    return (host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /\/video\/\d+|^\/t\/\w/.test(pathname);
  } catch {
    return false;
  }
};

function sendLink(ws, seqRef, url) {
  seqRef.current += 1;
  ws.send(JSON.stringify({ seq: seqRef.current, url }));
}

export default function AddPage() {
  // Made up front: names the parser channel now, saved as the item's uuid later
  const [itemUuid] = useState(newUuid);
  const [itemType, setItemType] = useState('clothes');
  const [form, setForm] = useState({
    item_name: '', quantity: 1, shop_name: '', buy_url: '',
    // clothes
    size: '', color: '', brand: '',
    // food_and_drink
    sugar: '', notes: '', toppings: '',
    // restaurant
    main_food: '', cuisine_type: '', address: '', time_to_eat: '',
    // others
    category: '',
  });
  const [mediaFiles, setMediaFiles] = useState([]); // { file, preview, type }
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const socketRef = useRef(null);
  const seqRef = useRef(0);         // seq of the latest link sent, older answers are ignored
  const latestUrlRef = useRef('');  // link waiting for the socket to open
  const lastSentRef = useRef('');   // so a pasted link isn't sent again by the debounce
  const autoRef = useRef({});       // field -> value the parser last filled in
  const [lookingUp, setLookingUp] = useState(false); // a TikTok lookup is on its way

  // Fill fields from a parser answer, leaving alone anything the user typed themselves
  const autofill = useCallback((values) => {
    // Snapshot taken outside the updater, which React may run twice
    const filledBefore = { ...autoRef.current };
    setForm((f) => {
      const next = { ...f };
      for (const [field, value] of Object.entries(values)) {
        if (value && (!f[field] || f[field] === filledBefore[field])) next[field] = value;
      }
      return next;
    });
    for (const [field, value] of Object.entries(values)) {
      if (value) autoRef.current[field] = value;
    }
  }, []);

  const queueLink = useCallback((url) => {
    if (url === lastSentRef.current) return;
    latestUrlRef.current = url;
    const ws = socketRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return; // onopen sends it
    lastSentRef.current = url;
    setLookingUp(isTikTokLink(url));
    sendLink(ws, seqRef, url);
  }, []);

  // One long-lived parser channel for this item, closed when the page is left
  useEffect(() => {
    const ws = new WebSocket(parseSocketUrl(itemUuid));
    socketRef.current = ws;

    ws.onopen = () => {
      if (latestUrlRef.current) queueLink(latestUrlRef.current);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.seq !== seqRef.current) return;
      setLookingUp(false);

      const r = msg.result;
      if (!r) return;
      // "link" answers carry item_name, "tiktok" ones a place
      autofill({
        item_name: r.item_name ?? r.place_name,
        address: r.address,
        cuisine_type: r.place_type,
      });
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [itemUuid, queueLink, autofill]);

  // Once the user stops typing the link, send it down the channel
  useEffect(() => {
    const url = form.buy_url.trim();
    if (!url) return;

    const timer = setTimeout(() => queueLink(url), PARSE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.buy_url, queueLink]);

  const onLinkChange = (e) => {
    setForm((f) => ({ ...f, buy_url: e.target.value }));
    if (!e.target.value.trim()) {
      // Link cleared: ignore whatever answer is still on its way
      seqRef.current += 1;
      latestUrlRef.current = '';
      lastSentRef.current = '';
      setLookingUp(false);
    }
  };

  // A TikTok link pasted into the empty field goes out at once, no debounce
  const onLinkPaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim();
    if (!form.buy_url.trim() && isTikTokLink(pasted)) queueLink(pasted);
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addFiles = useCallback((files) => {
    const accepted = Array.from(files).filter((f) =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    const newEntries = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));
    setMediaFiles((prev) => [...prev, ...newEntries]);
  }, []);

  const removeMedia = (index) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) { setError('Vui lòng nhập tên.'); return; }
    setLoading(true);
    setError('');

    const base = {
      uuid: itemUuid,
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
        : itemType === 'restaurant'
        ? {
            main_food: form.main_food || null,
            cuisine_type: form.cuisine_type || null,
            address: form.address || null,
            time_to_eat: form.time_to_eat || null,
          }
        : { category: form.category || null };

    try {
      // 1. Create the item
      const itemRes = await client.post('/api/items', { ...base, ...subtypeFields });
      const itemId = itemRes.data.id;

      // The item exists now, so its parser channel is done
      socketRef.current?.close();

      // 2. Upload media files if any
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        mediaFiles.forEach((m) => formData.append('files', m.file));

        const uploadRes = await client.post(`/api/items/${itemId}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const taskIds = uploadRes.data.task_ids || [];
        
        // 3. Polling mechanism
        if (taskIds.length > 0) {
          const pendingTasks = new Set(taskIds);

          while (pendingTasks.size > 0) {
            // Wait 1.5 seconds before polling again
            await new Promise((resolve) => setTimeout(resolve, 1500));

            for (const taskId of pendingTasks) {
              try {
                const statusRes = await client.get(`/api/items/${itemId}/tasks/${taskId}`);
                const { status } = statusRes.data;
                
                if (status === 'completed' || status === 'failed') {
                  pendingTasks.delete(taskId);
                }
              } catch (err) {
                // If it returns 404, it might have been already cleared or failed, so we evict it
                if (err.response?.status === 404) {
                  pendingTasks.delete(taskId);
                }
              }
            }
          }
        }
      }

      navigate('/');
    } catch {
      setError('Thêm mục hoặc tải lên thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-page">
      <div className="add-card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button className="back-btn" onClick={() => navigate('/')}>← Quay Lại</button>
          <button className="back-btn" style={{ color: 'var(--accent)' }} onClick={() => navigate('/question')}>Hỏi Đáp →</button>
        </div>
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

          {/* Common fields — link first so details can be parsed from it */}
          <div className="field-group">
            <label className="field-label" htmlFor="item-url">
              Link {lookingUp && <span className="field-hint">(đang lấy địa chỉ từ TikTok…)</span>}
            </label>
            <input id="item-url" type="url" className="field-input"
              placeholder={itemType === 'restaurant' ? 'Link TikTok, Google Maps…' : 'https://…'}
              value={form.buy_url} onChange={onLinkChange} onPaste={onLinkPaste} autoFocus />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="item-name">Tên *</label>
            <input id="item-name" type="text" className={`field-input ${error && !form.item_name.trim() ? 'input-error' : ''}`}
              placeholder={itemType === 'restaurant' ? 'Tên nhà hàng…' : 'Tên mục…'}
              value={form.item_name} onChange={set('item_name')} />
          </div>

          {/* Restaurants skip quantity / shop */}
          {itemType !== 'restaurant' && (
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
          )}

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

          {/* Restaurant fields */}
          {itemType === 'restaurant' && (
            <>
              <div className="field-group">
                <label className="field-label">Món chính</label>
                <input type="text" className="field-input" placeholder="Phở, bún bò…"
                  value={form.main_food} onChange={set('main_food')} />
              </div>
              <div className="field-group">
                <label className="field-label">Loại ẩm thực</label>
                <input type="text" className="field-input" placeholder="Việt, Nhật, Hàn…"
                  value={form.cuisine_type} onChange={set('cuisine_type')} />
              </div>
              <div className="field-group">
                <label className="field-label">Địa chỉ</label>
                <input type="text" className="field-input" placeholder="Số nhà, đường, quận…"
                  value={form.address} onChange={set('address')} />
              </div>
              <div className="field-group">
                <label className="field-label">Thời gian ăn</label>
                <select className="field-input" value={form.time_to_eat} onChange={set('time_to_eat')}>
                  <option value="">Chọn cách hẹn giờ…</option>
                  <option value="pick_date">Chọn ngày</option>
                  <option value="auto_schedule">Tự động lên lịch</option>
                </select>
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

          {/* ── Media Upload ── */}
          <div className="field-group">
            <label className="field-label">Ảnh &amp; Video</label>

            <div
              className={`media-drop-zone ${dragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="media-drop-icon">📎</span>
              <span className="media-drop-text">
                Kéo thả hoặc <strong>bấm để chọn</strong>
              </span>
              <span className="media-drop-hint">Hỗ trợ: JPG, PNG, GIF, MP4, MOV…</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => addFiles(e.target.files)}
            />

            {/* Previews */}
            {mediaFiles.length > 0 && (
              <div className="media-preview-grid">
                {mediaFiles.map((m, i) => (
                  <div key={i} className="media-preview-item">
                    {m.type === 'image' ? (
                      <img src={m.preview} alt={`preview-${i}`} className="media-thumb" />
                    ) : (
                      <video src={m.preview} className="media-thumb" controls={false} muted />
                    )}
                    <button
                      type="button"
                      className="media-remove-btn"
                      onClick={(e) => { e.stopPropagation(); removeMedia(i); }}
                      title="Xóa"
                    >
                      ×
                    </button>
                    {m.type === 'video' && <span className="media-video-badge">▶</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className="add-submit-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : '✓ Thêm Mục'}
          </button>
        </form>
      </div>
    </div>
  );
}
