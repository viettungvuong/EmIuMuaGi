import { useState } from "react";
import "../styles/HistoryPage.css"; // .modal-title and .review-form live there

// The "Em iu đánh giáaa" form for one purchase: a 1-5 score and a few words.
// Rendered only while open, so every opening starts from a fresh form.
export default function RatingModal({ itemName, cancelLabel = "Hủy", onCancel, onSubmit }) {
  const [form, setForm] = useState({ score: 5, content: "" });

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">Em iu đánh giáaa</h2>
        <p className="modal-text">
          Viết vài dòng cảm nhận về <strong>{itemName}</strong> luôn để em biết nhaaa!
        </p>

        <div className="review-form">
          <label>
            Chấm điểm (1-5 sao):
            <input
              type="number"
              min="1"
              max="5"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: parseInt(e.target.value) || 5 })}
            />
          </label>
          <label>
            Cảm nhận của em:
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={3}
              placeholder="Quá chuẩn lun..."
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="modal-btn confirm" onClick={() => onSubmit(form)}>
            Gửi Đánh Giá
          </button>
        </div>
      </div>
    </div>
  );
}
