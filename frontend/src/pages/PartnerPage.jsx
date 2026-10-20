import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { serverText, t } from "../i18n";
import "../styles/PartnerPage.css";
import "../styles/MainPage.css"; // Reuse header styles

// Every way a link can fail, keyed by the code the user service sends back.
// title/text/cta are keys into locales/*.json; {email} in the text shows in bold.
const OUTCOMES = {
  success: {
    variant: "success",
    icon: "👫",
    title: "partner.successTitle",
    text: "partner.successText",
    cta: "partner.successCta",
  },
  already_linked: {
    variant: "success",
    icon: "💕",
    title: "partner.linkedTitle",
    text: "partner.linkedText",
    cta: "common.home",
  },
  already_partnered: {
    variant: "already-partner",
    icon: "💔",
    title: "partner.partneredTitle",
    text: "partner.partneredText",
    textNoEmail: "partner.partneredTextNoEmail",
    cta: "common.goHome",
  },
  partner_taken: { variant: "already-partner", icon: "🥀", title: "partner.takenTitle", cta: "common.goHome" },
  self_link: { variant: "already-partner", icon: "🪞", title: "partner.selfTitle", cta: "common.goHome" },
  invite_not_found: { variant: "error", icon: "🔗", title: "partner.inviteGoneTitle", cta: "common.goHome" },
};

function subtext(outcome, email) {
  if (!outcome.text) return null;
  if (!email && outcome.textNoEmail) return t(outcome.textNoEmail);
  return t(outcome.text, { email: <strong>{email}</strong> });
}

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
          setMessage(serverText(err.response?.data?.error) || t("common.somethingWrong"));
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
          <p>{t("common.checking")}</p>
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
            {t("common.goHome")}
          </button>
        </div>
      );
    }

    return (
      <div className={`status-card ${outcome.variant}`}>
        {status === "success" && (
          <div className="welcome-banner">{t("partner.welcome")}</div>
        )}
        <div className="status-icon">{outcome.icon}</div>
        <h2 className="status-message">{t(outcome.title)}</h2>
        {outcome.text && (
          <p className="welcome-subtext">{subtext(outcome, partnerEmail)}</p>
        )}
        <div className="action-group">
          <button className="home-btn" onClick={() => navigate("/")}>
            {t(outcome.cta)}
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
            {t("common.titleStart")}<span className="accent">{t("common.titleAccent")}</span>
          </h1>
        </div>
        <div className="header-right">
          <span className="user-welcome">
            {t("common.hello", { name: localStorage.getItem("username") || t("common.you") })}
          </span>
          <button className="history-link-btn" onClick={() => navigate("/history")}>
            {t("common.history")}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            {t("common.logout")}
          </button>
        </div>
      </header>

      <div className="partner-content-container">
        {renderContent()}
      </div>
    </div>
  );
}
