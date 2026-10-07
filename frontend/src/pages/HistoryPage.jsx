import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import RatingModal from "../components/RatingModal";
import "../styles/HistoryPage.css";

export default function HistoryPage() {
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    historyId: null,
    itemName: "",
  });
  const navigate = useNavigate();

  const fetchHistories = async () => {
    try {
      const { data } = await client.get("/api/history");
      // The API returns an array, but if it's currently null/undefined, default to []
      setHistories(data || []);
    } catch (err) {
      console.error("Failed to fetch histories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistories();
  }, []);

  const handleReview = (historyId, itemName) => {
    setReviewModal({ isOpen: true, historyId, itemName });
  };

  const submitReview = async (reviewForm) => {
    const { historyId } = reviewModal;
    setReviewModal({ isOpen: false, historyId: null, itemName: "" });
    if (!historyId) return;

    try {
      await client.post(`/api/history/${historyId}/review`, reviewForm);
      fetchHistories(); // Refresh to show the new review
    } catch (err) {
      console.error("Failed to submit review:", err);
    }
  };

  const cancelReview = () => {
    setReviewModal({ isOpen: false, historyId: null, itemName: "" });
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="history-header-left">
          <button className="back-btn" onClick={() => navigate("/")}>
            ←
          </button>
          <h1 className="history-title">Lịch Sử Mua Đồ</h1>
        </div>
      </header>

      <div className="history-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Đang tải…</p>
          </div>
        ) : histories.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <p className="empty-text">Chưa có lịch sử mua đồ nàooo</p>
          </div>
        ) : (
          <ul className="history-list">
            {histories.map((history) => (
              <li key={history.id} className="history-card">
                <div className="history-info">
                  <div className="history-header-card">
                    <h3 className="history-item-name">{history.item_name}</h3>
                    <p className="history-date">
                      {history.time
                        ? new Date(history.time).toLocaleString("vi-VN", {
                            timeZone: "Asia/Ho_Chi_Minh",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Không xác định"}
                    </p>
                  </div>

                  {history.score !== null ? (
                    <div className="history-review">
                      <div className="review-stars">
                        {"★".repeat(history.score)}
                        {"☆".repeat(5 - history.score)}
                      </div>
                      {history.content && (
                        <p className="review-content">"{history.content}"</p>
                      )}
                    </div>
                  ) : (
                    <button
                      className="add-review-btn"
                      onClick={() => handleReview(history.id, history.item_name)}
                    >
                      ⭐ Đánh giá ngay
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reviewModal.isOpen && (
        <RatingModal itemName={reviewModal.itemName} onCancel={cancelReview} onSubmit={submitReview} />
      )}
    </div>
  );
}
