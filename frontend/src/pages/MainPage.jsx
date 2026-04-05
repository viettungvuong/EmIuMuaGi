import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import "../styles/MainPage.css";

const TYPE_LABELS = {
  clothes: "Quần Áo",
  food_and_drink: "Đồ Ăn & Uống",
  others: "Khác",
};

const TYPE_COLOR = "#cb1d7aff";

function ItemSubInfo({ item }) {
  if (item.item_type === "clothes") {
    const parts = [item.size, item.color, item.brand].filter(Boolean);
    return parts.length ? (
      <p className="item-subinfo">{parts.join(" · ")}</p>
    ) : null;
  }
  if (item.item_type === "food_and_drink") {
    const parts = [item.size, item.sugar && `Đường: ${item.sugar}`].filter(
      Boolean,
    );
    const toppingStr = item.toppings?.length
      ? `Topping: ${item.toppings.join(", ")}`
      : null;
    return parts.length || toppingStr ? (
      <p className="item-subinfo">
        {[...parts, toppingStr].filter(Boolean).join(" · ")}
      </p>
    ) : null;
  }
  if (item.item_type === "others" && item.category) {
    return <p className="item-subinfo">{item.category}</p>;
  }
  return null;
}

export default function MainPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBought, setHideBought] = useState(false);
  const [userData, setUserData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, itemId: null });
  const navigate = useNavigate();

  const fetchItems = async () => {
    try {
      const { data } = await client.get("/api/items");
      setItems(data);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data } = await client.get("/api/me");
      setUserData(data);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchUserData();
  }, []);

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleBuy = (id) => {
    setConfirmModal({ isOpen: true, itemId: id });
  };

  const confirmBuy = async () => {
    const id = confirmModal.itemId;
    setConfirmModal({ isOpen: false, itemId: null });
    if (!id) return;

    try {
      const { data } = await client.patch(`/api/items/${id}/bought`);
      setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
    } catch (err) {
      console.error("Failed to mark item as bought:", err);
    }
  };

  const cancelBuy = () => {
    setConfirmModal({ isOpen: false, itemId: null });
  };

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    navigate("/login");
  };

  const filteredItems = items.filter((item) => {
    const matchesFilter = filterType === "all" || item.item_type === filterType;
    const matchesSearch = item.item_name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesHide = hideBought ? !item.bought : true;
    return matchesFilter && matchesSearch && matchesHide;
  });

  const copyInviteLink = () => {
    if (!userData?.invite_link) return;
    const link = `${window.location.origin}/partner/${userData.invite_link}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        })
        .catch(() => {
          fallbackCopy(link);
        });
    } else {
      fallbackCopy(link);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="main-page">
      <header className="main-header">
        <div className="header-left">
          <h1 className="main-title">
            Em Iu<span className="accent"> Muốn Gìiiiii</span>
          </h1>
          <span className="item-count">{items.length} mục</span>
        </div>
        <div className="header-right">
          <span className="user-welcome">Chào, {localStorage.getItem("username") || "bạn"} 👋</span>
          <button className="history-link-btn" onClick={() => navigate("/history")}>
            Lịch Sử
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Đăng Xuất
          </button>
        </div>
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
          <div className="items-content">
            <div className="partner-section">
              {userData?.partner ? (
                <div className="partner-info-card">
                  <div className="partner-avatar">🤝</div>
                  <div className="partner-details">
                    <span className="partner-label">Người ấy của bạn:</span>
                    <span className="partner-name">{userData.partner.id}</span>
                    <span className="partner-email">{userData.partner.email}</span>
                  </div>
                </div>
              ) : (
                <div className="invite-link-card">
                  <div className="invite-icon">🔗</div>
                  <div className="invite-details">
                    <span className="invite-label">Chưa có người ấy? Gửi link này nha:</span>
                    <div className="invite-input-wrapper">
                      <input 
                        type="text" 
                        readOnly 
                        className="invite-url-display" 
                        value={`${window.location.origin}/partner/${userData?.invite_link || ''}`}
                        onClick={(e) => e.target.select()}
                      />
                      <button className="copy-btn" onClick={copyInviteLink}>
                        {copySuccess ? "✓ Đã copy" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="controls-section">
              <input
                type="text"
                className="search-bar"
                placeholder="Tìm kiếm danh sách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="filter-options">
                <div className="filter-tabs">
                  <button
                    className={`filter-tab ${filterType === "all" ? "active" : ""}`}
                    onClick={() => setFilterType("all")}
                  >
                    Tất Cả
                  </button>
                  {Object.entries(TYPE_LABELS).map(([type, label]) => (
                    <button
                      key={type}
                      className={`filter-tab ${filterType === type ? "active" : ""}`}
                      onClick={() => setFilterType(type)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="hide-bought-toggle">
                  <input
                    type="checkbox"
                    checked={hideBought}
                    onChange={(e) => setHideBought(e.target.checked)}
                  />
                  <span>Ẩn đồ đã mua</span>
                </label>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">😅</span>
                <p className="empty-text">
                  Không tìm thấy món nào phù hợp nữa...
                </p>
              </div>
            ) : (
              <ul className="items-list">
                {[...filteredItems]
                  .sort((a, b) => {
                    if (a.bought === b.bought) {
                      return new Date(b.created_at) - new Date(a.created_at);
                    }
                    return a.bought ? 1 : -1;
                  })
                  .map((item) => (
                    <li
                      key={item.id}
                      className={`item-card ${item.bought ? "bought" : ""}`}
                    >
                      <div className="item-info">
                        <div className="item-header-row">
                          <h3 className="item-name">{item.item_name}</h3>
                          <span
                            className="item-type-badge"
                            style={{
                              background: TYPE_COLOR + "22",
                              color: TYPE_COLOR,
                              borderColor: TYPE_COLOR + "55",
                            }}
                          >
                            {TYPE_LABELS[item.item_type] ?? item.item_type}
                          </span>
                        </div>
                        <ItemSubInfo item={item} />
                        <div className="item-meta">
                          {item.shop_name && (
                            <span className="item-shop">
                              🏪 {item.shop_name}
                            </span>
                          )}
                          {item.quantity > 1 && (
                            <span className="item-qty">x{item.quantity}</span>
                          )}
                          <span className="item-date">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString(
                                  "vi-VN",
                                  {
                                    timeZone: "Asia/Ho_Chi_Minh",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : ""}
                          </span>
                        </div>
                        {item.buy_url && (
                          <a
                            className="item-link"
                            href={item.buy_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            🔗 Xem sản phẩm
                          </a>
                        )}
                      </div>
                      <div className="item-actions">
                        {item.bought && (
                          <div className="bought-badge">✓</div>
                        )}
                        {!item.bought && (
                          <button
                            className="buy-btn"
                            onClick={() => handleBuy(item.id)}
                            aria-label="Đã mua mục này"
                          >
                            ✓ Anh đã mua
                          </button>
                        )}
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(item.id)}
                          aria-label="Xóa mục"
                        >
                          🗑
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <button
        className="fab"
        onClick={() => navigate("/add")}
        aria-label="Thêm mục mới"
      >
        +
      </button>

      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p className="modal-text">Có chắc anh đã mua chưaaaaaa 🧐</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={cancelBuy}>Chưa nha</button>
              <button className="modal-btn confirm" onClick={confirmBuy}>Đã mua rùii</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
