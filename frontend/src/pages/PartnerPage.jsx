import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import "../styles/PartnerPage.css";
import "../styles/MainPage.css"; // Reuse header styles

export default function PartnerPage() {
  const { inviteID } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, success, already_has_partner, error
  const [partnerEmail, setPartnerEmail] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("authenticated");
    navigate("/login");
  };

  useEffect(() => {
    const linkPartner = async () => {
      try {
        const { data } = await client.post(`/api/partner/add/${inviteID}`);
        setPartnerEmail(data.partner_email);
        setStatus("success");
      } catch (err) {
        if (err.response?.status === 409) {
          setStatus("already_has_partner");
        } else if (err.response?.status === 401) {
           // Interceptor might handle this, but just in case
           navigate("/login");
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

    if (status === "success") {
      return (
        <div className="status-card success">
          <div className="welcome-banner">🎊 Chào mừng 🎊</div>
          <div className="status-icon">👫</div>
          <h2 className="status-message">Bạn là người ấy của đây hãaaaa</h2>
          <p className="welcome-subtext">
            Giờ thì bạn đã có thể xem và mua đồ cùng với <strong>{partnerEmail}</strong> rồi nhaa!
          </p>
          <div className="action-group">
            <button className="home-btn" onClick={() => navigate("/")}>
              Bắt đầu mua sắm thôii
            </button>
          </div>
        </div>
      );
    }

    if (status === "already_has_partner") {
      return (
        <div className="status-card already-partner">
          <div className="status-icon">🥀</div>
          <h2 className="status-message">Ôi hoa có chủ rùiii</h2>
          <button className="home-btn" onClick={() => navigate("/")}>
            Quay Về Trang Chủ
          </button>
        </div>
      );
    }

    return (
      <div className="status-card error">
        <div className="status-icon">⚠️</div>
        <h2 className="status-message">{message}</h2>
        <button className="home-btn" onClick={() => navigate("/")}>
          Quay Về Trang Chủ
        </button>
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
