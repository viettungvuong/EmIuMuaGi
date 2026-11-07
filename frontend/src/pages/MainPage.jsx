import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import RatingModal from "../components/RatingModal";
import ScheduleModal from "../components/ScheduleModal";
import { dateLocale, t } from "../i18n";
import { byTime, formatWhen, relativeWhen } from "../schedule";
import "../styles/MainPage.css";

const ITEM_TYPES = ["clothes", "food_and_drink", "restaurant", "others"];

const TYPE_COLOR = "#cb1d7aff";

// What the backend sends as the history ID when it couldn't record the purchase
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// How long the search box has to sit still before the server is asked
const SEARCH_DEBOUNCE_MS = 300;

// Item times are shown in Vietnam time, like the rest of the app. It is UTC+7
// all year (no daylight saving), so its calendar day is the UTC day 7 hours on.
const VN_TIME = "Asia/Ho_Chi_Minh";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (date) => new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10); // "2026-11-07"

// "Today", "Yesterday", or "Saturday, November 1"
function dayLabel(day) {
  if (day === dayOf(Date.now())) return t("main.today");
  if (day === dayOf(Date.now() - DAY_MS)) return t("main.yesterday");
  const [year, month, date] = day.split("-").map(Number);
  // Noon UTC is the same calendar day in Vietnam
  return new Date(Date.UTC(year, month - 1, date, 12)).toLocaleDateString(dateLocale(), {
    timeZone: VN_TIME,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(year !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// The list as a conversation (items come oldest first): a separator whenever the
// day changes, and for each bubble whether it opens or closes a run of one
// person's items, so a run sits close together with the avatar on its last bubble
function chatRows(items) {
  const rows = [];
  items.forEach((item, i) => {
    const day = dayOf(item.created_at);
    const prev = items[i - 1];
    const next = items[i + 1];
    const newDay = !prev || dayOf(prev.created_at) !== day;
    if (newDay) rows.push({ kind: "day", key: `day-${day}`, label: dayLabel(day) });
    rows.push({
      kind: "item",
      key: item.id,
      item,
      runStart: newDay || prev.owner !== item.owner,
      runEnd: !next || next.owner !== item.owner || dayOf(next.created_at) !== day,
    });
  });
  return rows;
}

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
      item.time_to_eat === "auto_schedule" ? t("add.autoSchedule") : null,
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

// One item as a chat message: yours on the right, your partner's on the left
// with their initial, closing a run of their items
function ChatBubble({ item, mine, runStart, runEnd, nextDate, onSchedule, onBuy, onDelete }) {
  const typeLabel = ITEM_TYPES.includes(item.item_type) ? t(`types.${item.item_type}`) : item.item_type;
  const time = new Date(item.created_at).toLocaleTimeString(dateLocale(), {
    timeZone: VN_TIME,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`chat-row ${mine ? "mine" : "theirs"} ${runStart ? "run-start" : ""} ${runEnd ? "run-end" : ""}`}>
      {!mine && (
        <span className="chat-avatar" title={item.owner}>
          {runEnd && item.owner.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="bubble-col">
        <div className={`bubble ${item.bought ? "bought" : ""}`}>
          <div className="item-header-row">
            <span
              className={`item-who ${item.wanted_by === 1 ? "boy" : "girl"}`}
              title={t(`wantedBy.${item.wanted_by === 1 ? "boy" : "girl"}`)}
            >
              {item.wanted_by === 1 ? "👦" : "👧"}
            </span>
            <h3 className="item-name">{item.item_name}</h3>
            <span
              className="item-type-badge"
              style={{ background: TYPE_COLOR + "22", color: TYPE_COLOR, borderColor: TYPE_COLOR + "55" }}
            >
              {typeLabel}
            </span>
          </div>
          <ItemSubInfo item={item} />
          {(item.shop_name || item.quantity > 1 || nextDate) && (
            <div className="item-meta">
              {item.shop_name && <span className="item-shop">🏪 {item.shop_name}</span>}
              {item.quantity > 1 && <span className="item-qty">x{item.quantity}</span>}
              {nextDate && <span className="item-next-date">📅 {formatWhen(nextDate)}</span>}
            </div>
          )}
          {item.buy_url && (
            <a className="item-link" href={item.buy_url} target="_blank" rel="noreferrer">
              🔗 {item.item_type === "restaurant" ? t("main.viewRestaurant") : t("main.viewProduct")}
            </a>
          )}
          {(!item.bought || item.item_type === "restaurant" || mine) && (
            <div className="bubble-actions">
              {!item.bought && (
                <button className="buy-btn" onClick={onBuy} aria-label={t("main.boughtLabel")}>
                  {t("main.bought")}
                </button>
              )}
              {item.item_type === "restaurant" && (
                <button className="schedule-btn" onClick={onSchedule}>
                  📅 {t("schedule.button")}
                </button>
              )}
              {mine && (
                <button className="delete-btn" onClick={onDelete} aria-label={t("main.deleteLabel")}>
                  🗑
                </button>
              )}
            </div>
          )}
        </div>
        <span className="bubble-foot">
          {time}
          {item.bought && <span className="bubble-bought">{t("main.boughtStatus")}</span>}
        </span>
      </div>
    </div>
  );
}

export default function MainPage({ setIsAuth }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // The list's controls, applied by the server (GET /api/items?type=&q=&hide_bought=)
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [search, setSearch] = useState(""); // searchQuery once typing pauses
  const [hideBought, setHideBought] = useState(false);
  const [who, setWho] = useState("all"); // whose items: "all", "me" or "partner"
  const [userData, setUserData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, itemId: null });
  // The purchase just made, while its rating form is open: { historyId, name }
  const [ratingPurchase, setRatingPurchase] = useState(null);
  // The couple's meal dates, oldest first, and the calendar popup while open:
  // { restaurant } to book one, { restaurant: null } to just look
  const [schedules, setSchedules] = useState([]);
  const [calendar, setCalendar] = useState(null);
  const navigate = useNavigate();
  // Only with a partner linked: after unlinking, "partner's items" would always be empty
  const whoFilter = userData?.partner ? who : "all";
  const requestRef = useRef(0); // only the latest list request's answer is shown
  const scrollToEndRef = useRef(false); // set when a fresh list arrives

  const fetchItems = useCallback(async () => {
    const request = ++requestRef.current;
    const params = {};
    if (filterType !== "all") params.type = filterType;
    if (search) params.q = search;
    if (hideBought) params.hide_bought = true;
    if (whoFilter !== "all") params.who = whoFilter;

    try {
      const { data } = await client.get("/api/items", { params });
      if (request !== requestRef.current) return; // the controls changed meanwhile
      scrollToEndRef.current = true;
      setItems(data);
    } catch (err) {
      console.error("Failed to fetch items:", err);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filterType, search, hideBought, whoFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Like a chat, a freshly loaded list opens on its newest message: the very
  // bottom, so the chat's padding keeps that bubble clear of the + button. The
  // partner card above can still push the list down until it loads, so keep at it.
  useEffect(() => {
    if (!scrollToEndRef.current) return;
    window.scrollTo(0, document.body.scrollHeight);
    if (userData) scrollToEndRef.current = false;
  }, [items, userData]);

  const fetchUserData = async () => {
    try {
      const { data } = await client.get("/api/me");
      setUserData(data);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data } = await client.get("/api/schedules");
      setSchedules(data);
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    }
  };

  useEffect(() => {
    fetchUserData();
    fetchSchedules();
  }, []);

  const closeCalendar = useCallback(() => setCalendar(null), []);

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSchedules((prev) => prev.filter((s) => s.restaurant_id !== id));
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
      // With "hide bought" on, the server would no longer list it
      setItems((prev) => (hideBought ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? data : i))));
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

  // Upcoming dates: the very next one, and each restaurant's next one
  const now = new Date();
  const upcoming = schedules.filter((s) => new Date(s.scheduled_at) >= now);
  const nextDate = upcoming[0];
  const nextAt = (restaurantId) => upcoming.find((s) => s.restaurant_id === restaurantId);

  // An empty answer to a filtered list means "no match", not "nothing added yet"
  const filtering = filterType !== "all" || Boolean(search) || hideBought || whoFilter !== "all";

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

  const handleRemovePartner = async () => {
    if (!window.confirm(t("main.confirmRemovePartner"))) return;
    try {
      await client.delete("/api/partner");
      await Promise.all([fetchItems(), fetchUserData(), fetchSchedules()]);
    } catch (err) {
      console.error("Failed to remove partner:", err);
      alert(err.response?.data?.error || t("errors.Could not remove your partner") || "Failed to remove partner");
    }
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
                  <button className="partner-remove-btn" onClick={handleRemovePartner}>
                    {t("main.removePartner")}
                  </button>
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

            {items.length === 0 && !filtering ? (
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
              {/* Whose items, once there's a partner to tell apart */}
              {userData?.partner && (
                <div className="who-filter" role="radiogroup" aria-label={t("main.whoseItems")}>
                  {[
                    ["all", "💞", t("main.both")],
                    ["me", "🙋", t("main.mine")],
                    ["partner", "💜", t("main.partners", { name: userData.partner.id })],
                  ].map(([value, icon, label]) => (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={who === value}
                      className={`who-filter-btn ${value} ${who === value ? "active" : ""}`}
                      onClick={() => setWho(value)}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              )}
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

            {filterType === "restaurant" && (
              <button className="date-banner" onClick={() => setCalendar({ restaurant: null })}>
                <span className="date-banner-icon">📅</span>
                <span className="date-banner-text">
                  {nextDate ? (
                    <>
                      <span className="date-banner-label">{t("schedule.next")}</span>
                      <strong>{nextDate.restaurant_name}</strong>
                      <span className="date-banner-when">
                        {formatWhen(nextDate)} · {relativeWhen(new Date(nextDate.scheduled_at), now)}
                      </span>
                    </>
                  ) : (
                    <span>{t("schedule.noneYet")}</span>
                  )}
                </span>
                <span className="date-banner-cta">{t("schedule.calendar")} ›</span>
              </button>
            )}

            {items.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">😅</span>
                <p className="empty-text">{t("main.noMatch")}</p>
              </div>
            ) : (
              <div className="chat">
                {chatRows(items).map((row) =>
                  row.kind === "day" ? (
                    <div key={row.key} className="chat-day">
                      <span>{row.label}</span>
                    </div>
                  ) : (
                    <ChatBubble
                      key={row.key}
                      item={row.item}
                      mine={row.item.owner === currentUser}
                      runStart={row.runStart}
                      runEnd={row.runEnd}
                      nextDate={row.item.item_type === "restaurant" ? nextAt(row.item.id) : null}
                      onSchedule={() => setCalendar({ restaurant: row.item })}
                      onBuy={() => handleBuy(row.item.id)}
                      onDelete={() => handleDelete(row.item.id)}
                    />
                  ),
                )}
              </div>
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

      {calendar && (
        <ScheduleModal
          restaurant={calendar.restaurant}
          schedules={schedules}
          currentUser={currentUser}
          partnerName={userData?.partner?.id}
          onCreated={(schedule) => {
            setSchedules((prev) => [...prev, schedule].sort(byTime));
            setCalendar(null);
          }}
          onDeleted={(id) => setSchedules((prev) => prev.filter((s) => s.id !== id))}
          onClose={closeCalendar}
        />
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
