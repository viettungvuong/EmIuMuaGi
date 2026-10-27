import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import RatingModal from "../components/RatingModal";
import { dateLocale, t } from "../i18n";
import "../styles/MainPage.css";

const ITEM_TYPES = ["clothes", "food_and_drink", "restaurant", "others"];

const TYPE_COLOR = "#cb1d7aff";

// What the backend sends as the history ID when it couldn't record the purchase
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function ItemSubInfo({ item }) {
  if (item.item_type === "clothes") {
    const parts = [item.size, item.color, item.brand].filter(Boolean);
    return parts.length ? (
      <p className="item-subinfo">{parts.join(" · ")}</p>
    ) : null;
  }
  if (item.item_type === "food_and_drink") {
    const parts = [item.size, item.sugar && t("main.sugar", { sugar: item.sugar })].filter(
      Boolean,
    );
    const toppingStr = item.toppings?.length
      ? t("main.toppings", { toppings: item.toppings.join(", ") })
      : null;
    return parts.length || toppingStr ? (
      <p className="item-subinfo">
        {[...parts, toppingStr].filter(Boolean).join(" · ")}
      </p>
    ) : null;
  }
  if (item.item_type === "restaurant") {
    const parts = [
      item.main_food,
      item.cuisine_type,
      item.address,
      item.time_to_eat,
    ].filter(Boolean);
    return parts.length ? (
      <p className="item-subinfo">{parts.join(" · ")}</p>
    ) : null;
  }
  if (item.item_type === "others" && item.category) {
    return <p className="item-subinfo">{item.category}</p>;
  }
  return null;
}

export default function MainPage({ setIsAuth }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hideBought, setHideBought] = useState(false);
  const [userData, setUserData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, itemId: null });
  // The purchase just made, while its rating form is open: { historyId, name }
  const [ratingPurchase, setRatingPurchase] = useState(null);
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
      // Ask for a rating while it's fresh. Ratings belong to the purchase (its
      // history entry), which the backend just created; "Để sau" leaves it for
      // the history page.
      const historyId = data.additional?.HistoryID;
      if (historyId && historyId !== NIL_UUID) {
        setRatingPurchase({ historyId, name: data.item_name });
      }
    } catch (err) {
      console.error("Failed to mark item as bought:", err);
    }
  };

  const submitRating = async (form) => {
    const { historyId } = ratingPurchase;
    setRatingPurchase(null);

    try {
      await client.post(`/api/history/${historyId}/review`, form);
    } catch (err) {
      console.error("Failed to rate purchase:", err);
    }
  };

  const cancelBuy = () => {
    setConfirmModal({ isOpen: false, itemId: null });
  };

  const handleLogout = async () => {
    try {
      await client.post("/api/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("username");
      if (setIsAuth) setIsAuth(false);
      navigate("/login");
    }
  };

  const currentUser = userData?.id || localStorage.getItem("username");

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
            {t("common.titleStart")}<span className="accent">{t("common.titleAccent")}</span>
          </h1>
          <span className="item-count">{t("common.itemCount", { count: items.length })}</span>
        </div>
        <div className="header-right">
          <span className="user-welcome">
            {t("common.hello", { name: localStorage.getItem("username") || t("common.you") })}
          </span>
          <button className="history-link-btn" onClick={() => navigate("/history")}>
            {t("common.history")}
          </button>
          <button className="history-link-btn" onClick={() => navigate("/settings")}>
            {t("common.settings")}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            {t("common.logout")}
          </button>
        </div>
      </header>

      <div className="items-container">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>{t("common.loading")}</p>
          </div>
        ) : (
          <div className="items-content">
            <div className="partner-section">
              {userData?.partner ? (
                <div className="partner-info-card">
                  <div className="partner-avatar">🤝</div>
                  <div className="partner-details">
                    <span className="partner-label">{t("main.partnerLabel")}</span>
                    <span className="partner-name">{userData.partner.id}</span>
                    <span className="partner-email">{userData.partner.email}</span>
                  </div>
                </div>
              ) : (
                <div className="invite-link-card">
                  <div className="invite-icon">🔗</div>
                  <div className="invite-details">
                    <span className="invite-label">{t("main.inviteLabel")}</span>
                    <div className="invite-input-wrapper">
                      <input 
                        type="text" 
                        readOnly 
                        className="invite-url-display" 
                        value={`${window.location.origin}/partner/${userData?.invite_link || ''}`}
                        onClick={(e) => e.target.select()}
                      />
                      <button className="copy-btn" onClick={copyInviteLink}>
                        {copySuccess ? t("main.copied") : t("main.copy")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {items.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🧐</span>
                <p className="empty-text">{t("main.empty")}</p>
              </div>
            ) : (
              <>
                <div className="controls-section">
              <input
                type="text"
                className="search-bar"
                placeholder={t("main.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="filter-options">
                <div className="filter-tabs">
                  <button
                    className={`filter-tab ${filterType === "all" ? "active" : ""}`}
                    onClick={() => setFilterType("all")}
                  >
                    {t("types.all")}
                  </button>
                  {ITEM_TYPES.map((type) => (
                    <button
                      key={type}
                      className={`filter-tab ${filterType === type ? "active" : ""}`}
                      onClick={() => setFilterType(type)}
                    >
                      {t(`types.${type}`)}
                    </button>
                  ))}
                </div>
                <label className="hide-bought-toggle">
                  <input
                    type="checkbox"
                    checked={hideBought}
                    onChange={(e) => setHideBought(e.target.checked)}
                  />
                  <span>{t("main.hideBought")}</span>
                </label>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">😅</span>
                <p className="empty-text">{t("main.noMatch")}</p>
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
                            {ITEM_TYPES.includes(item.item_type) ? t(`types.${item.item_type}`) : item.item_type}
                          </span>
                        </div>
                        <ItemSubInfo item={item} />
                        <div className="item-meta">
                          {item.owner && item.owner !== currentUser && (
                            <span className="item-owner">
                              💌 {item.owner}
                            </span>
                          )}
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
                                  dateLocale(),
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
                            🔗 {item.item_type === "restaurant" ? t("main.viewRestaurant") : t("main.viewProduct")}
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
                            aria-label={t("main.boughtLabel")}
                          >
                            {t("main.bought")}
                          </button>
                        )}
                        {item.owner === currentUser && (
                          <button
                            className="delete-btn"
                            onClick={() => handleDelete(item.id)}
                            aria-label={t("main.deleteLabel")}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </div>
    )}
  </div>

      <button
        className="fab"
        onClick={() => navigate("/add")}
        aria-label={t("main.addLabel")}
      >
        +
      </button>

      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p className="modal-text">{t("main.confirmBuy")}</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={cancelBuy}>{t("main.notYet")}</button>
              <button className="modal-btn confirm" onClick={confirmBuy}>{t("main.yesBought")}</button>
            </div>
          </div>
        </div>
      )}

      {ratingPurchase && (
        <RatingModal
          itemName={ratingPurchase.name}
          cancelLabel={t("common.later")}
          onCancel={() => setRatingPurchase(null)}
          onSubmit={submitRating}
        />
      )}
    </div>
  );
}
