import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import "../styles/PartnerPage.css";
import "../styles/MainPage.css"; // Reuse header styles

// Every way a link can fail, keyed by the code the user service sends back
const OUTCOMES = {
  success: {
    variant: "success",
    icon: "👫",
    title: "Bạn là người ấy của đây hãaaa",
    subtext: (email) => (
      <>Giờ thì bạn đã có thể xem và mua đồ cùng với <strong>{email}</strong> rồi nhaa!</>
    ),
    cta: "Bắt đầu mua sắm thôii",
  },
  already_linked: {
    variant: "success",
    icon: "💕",
    title: "Hai bạn là người ấy của nhau rùi mà",
    subtext: (email) => <>Người ấy của bạn vẫn là <strong>{email}</strong> nhaa</>,
    cta: "Về Trang Chủ",
  },
  already_partnered: {
    variant: "already-partner",
    icon: "💔",
    title: "Bạn có người ấy rùi nha",
    subtext: (email) =>
      email ? <>Mỗi người chỉ có một người ấy thui, của bạn là <strong>{email}</strong> đó</> : "Mỗi người chỉ có một người ấy thui",
    cta: "Quay Về Trang Chủ",
  },
  partner_taken: {
    variant: "already-partner",
    icon: "🥀",
    title: "Ôi hoa có chủ rùiii",
    cta: "Quay Về Trang Chủ",
  },
  self_link: {
    variant: "already-partner",
    icon: "🪞",
    title: "Hong tự làm người ấy của mình được đâuu",
    cta: "Quay Về Trang Chủ",
  },
  invite_not_found: {
    variant: "error",
    icon: "🔗",
    title: "Link này hong còn dùng được nữa rùi",
    cta: "Quay Về Trang Chủ",
  },
};

export default function PartnerPage({ setIsAuth }) {
  const { inviteID } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    const linkPartner = async () => {
      try {
        // Someone who already has a partner cannot take another one, so say that
        // outright instead of firing a request that can only be refused
        const { data: me } = await client.get("/api/me");
        if (me?.partner_id) {
          setPartnerEmail(me.partner?.email || "");
          setStatus("already_partnered");
          return;
        }
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        // Not fatal, let the link request below decide
      }

      try {
        const { data } = await client.post(`/api/partner/add/${inviteID}`);
        setPartnerEmail(data.partner_email);
        setStatus(data.already_linked ? "already_linked" : "success");
      } catch (err) {
        const code = err.response?.data?.code;
        if (err.response?.status === 401) {
          // Interceptor might handle this, but just in case
          navigate("/login");
        } else if (OUTCOMES[code]) {
          setStatus(code);
        } else {
          setStatus("error");
          setMessage(err.response?.data?.error || "Có lỗi xảy ra rùiii");
        }
      }
    };

    if (inviteID) {
      linkPartner();
    }
  }, [inviteID, navigate]);

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Đang kiểm tra...</p>
        </div>
      );
    }

    const outcome = OUTCOMES[status];
    if (!outcome) {
      return (
        <div className="status-card error">
          <div className="status-icon">⚠️</div>
          <h2 className="status-message">{message}</h2>
          <button className="home-btn" onClick={() => navigate("/")}>
            Quay Về Trang Chủ
          </button>
        </div>
      );
    }

    return (
      <div className={`status-card ${outcome.variant}`}>
        {status === "success" && (
          <div className="welcome-banner">🎊 Chào mừng 🎊</div>
        )}
        <div className="status-icon">{outcome.icon}</div>
        <h2 className="status-message">{outcome.title}</h2>
        {outcome.subtext && (
          <p className="welcome-subtext">{outcome.subtext(partnerEmail)}</p>
        )}
        <div className="action-group">
          <button className="home-btn" onClick={() => navigate("/")}>
            {outcome.cta}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="partner-page">
      <header className="main-header">
        <div className="header-left">
          <h1 className="main-title" onClick={() => navigate("/")} style={{ cursor: 'pointer' }}>
            Em Iu<span className="accent"> Muốn Gìiiiii</span>
          </h1>
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

      <div className="partner-content-container">
        {renderContent()}
      </div>
    </div>
  );
}
