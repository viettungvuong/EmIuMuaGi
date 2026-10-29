import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { LANGUAGES, setLanguage, t, useLanguage, serverText } from "../i18n";
import "../styles/SettingsPage.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const current = useLanguage();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!oldPassword.trim() || !newPassword.trim()) {
      setError(t("settings.passwordMismatch"));
      return;
    }

    if (newPassword.length < 6) {
      setError(t("auth.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("settings.passwordMismatch"));
      return;
    }

    if (oldPassword === newPassword) {
      setError(t("settings.passwordSameAsOld"));
      return;
    }

    setLoading(true);
    try {
      await client.post("/api/auth/change-password", {
        oldPassword,
        newPassword,
      });

      setSuccess(t("settings.passwordChanged"));
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err.response?.data?.error) {
        setError(serverText(err.response.data.error));
      } else if (err.response?.data?.message) {
        setError(serverText(err.response.data.message));
      } else {
        setError(t("common.somethingWrong"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          {t("common.back")}
        </button>
        <h1 className="settings-title">{t("settings.title")}</h1>
      </header>

      <div className="settings-container">
        {/* Language Section */}
        <section className="settings-section">
          <h2 className="settings-section-label">{t("settings.language")}</h2>
          <div
            className="language-options"
            role="radiogroup"
            aria-label={t("settings.language")}
          >
            {LANGUAGES.map(({ code, flag, name }) => {
              const active = code === current;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`language-option ${active ? "active" : ""}`}
                  onClick={() => setLanguage(code)}
                >
                  <span className="language-flag">{flag}</span>
                  <span className="language-name">{name}</span>
                  {active && <span className="language-check">✓</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Change Password Section */}
        <section className="settings-section">
          <h2 className="settings-section-label">{t("settings.changePassword")}</h2>
          <form className="password-change-card" onSubmit={handlePasswordChange}>
            {error && <div className="password-form-error">{error}</div>}
            {success && <div className="password-form-success">{success}</div>}

            <div className="password-input-group">
              <label className="password-label" htmlFor="oldPassword">
                {t("settings.oldPassword")}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="oldPassword"
                  type={showOld ? "text" : "password"}
                  className="password-input"
                  placeholder={t("settings.oldPasswordPlaceholder")}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowOld(!showOld)}
                  aria-label={showOld ? "Hide password" : "Show password"}
                >
                  {showOld ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="password-input-group">
              <label className="password-label" htmlFor="newPassword">
                {t("settings.newPassword")}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="newPassword"
                  type={showNew ? "text" : "password"}
                  className="password-input"
                  placeholder={t("settings.newPasswordPlaceholder")}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="password-input-group">
              <label className="password-label" htmlFor="confirmPassword">
                {t("settings.confirmPassword")}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  className="password-input"
                  placeholder={t("settings.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="password-submit-btn"
              disabled={loading || !oldPassword || !newPassword || !confirmPassword}
            >
              {loading ? <span className="spinner" /> : t("settings.updatePasswordBtn")}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
