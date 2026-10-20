import { useState } from "react";
import { t } from "../i18n";
import "../styles/HistoryPage.css"; // .modal-title and .review-form live there

// The "Em iu đánh giáaa" form for one purchase: a 1-5 score and a few words.
// Rendered only while open, so every opening starts from a fresh form.
export default function RatingModal({ itemName, cancelLabel = t("common.cancel"), onCancel, onSubmit }) {
  const [form, setForm] = useState({ score: 5, content: "" });

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="modal-title">{t("rating.title")}</h2>
        <p className="modal-text">
          {t("rating.text", { item: <strong>{itemName}</strong> })}
        </p>

        <div className="review-form">
          <label>
            {t("rating.score")}
            <input
              type="number"
              min="1"
              max="5"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: parseInt(e.target.value) || 5 })}
            />
          </label>
          <label>
            {t("rating.feeling")}
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={3}
              placeholder={t("rating.placeholder")}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className="modal-btn confirm" onClick={() => onSubmit(form)}>
            {t("rating.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
