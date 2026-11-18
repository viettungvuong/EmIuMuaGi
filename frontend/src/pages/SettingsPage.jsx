import { useEffect, useState } from "react";
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

  // Someone who signs in with Google or Facebook may have no password: they set
  // one instead of changing it, and delete the account without one
  const [me, setMe] = useState(null);
  const hasPassword = me?.has_password ?? true;
  useEffect(() => {
    client.get("/api/me").then(({ data }) => setMe(data), (err) => console.error("Failed to fetch user data:", err));
  }, []);

  const [deletePassword, setDeletePassword] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Gone for good on the server (items, dates, the partner link too). A full
  // page load to /login drops everything the app still holds about the session.
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await client.delete("/api/me", { data: { password: deletePassword } });
      localStorage.removeItem("username");
      window.location.href = "/login";
    } catch (err) {
      setConfirmDelete(false);
      setDeleteError(
        err.response?.data?.error ? serverText(err.response.data.error) : t("common.somethingWrong")
      );
      setDeleting(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if ((hasPassword && !oldPassword.trim()) || !newPassword.trim()) {
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

    if (hasPassword && oldPassword === newPassword) {
      setError(t("settings.passwordSameAsOld"));
      return;
    }

    setLoading(true);
    try {
      await client.post("/api/auth/change-password", {
        oldPassword,
        newPassword,
      });

      setSuccess(hasPassword ? t("settings.passwordChanged") : t("settings.passwordSet"));
      setMe((m) => m && { ...m, has_password: true });
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
          <h2 className="settings-section-label">
            {hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
          </h2>
          <form className="password-change-card" onSubmit={handlePasswordChange}>
            {!hasPassword && <p className="delete-account-info">{t("settings.setPasswordInfo", { name: me.id })}</p>}
            {error && <div className="password-form-error">{error}</div>}
            {success && <div className="password-form-success">{success}</div>}

            {hasPassword && (
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
            )}

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
              disabled={loading || (hasPassword && !oldPassword) || !newPassword || !confirmPassword}
            >
              {loading ? <span className="spinner" /> : hasPassword ? t("settings.updatePasswordBtn") : t("settings.setPasswordBtn")}
            </button>
          </form>
        </section>

        {/* Delete Account Section */}
        <section className="settings-section">
          <h2 className="settings-section-label danger">{t("settings.deleteAccount")}</h2>
          <form
            className="password-change-card delete-account-card"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
          >
            <p className="delete-account-info">{t("settings.deleteAccountInfo")}</p>
            {deleteError && <div className="password-form-error">{deleteError}</div>}

            {hasPassword && (
              <div className="password-input-group">
                <label className="password-label" htmlFor="deletePassword">
                  {t("settings.deleteAccountPassword")}
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="deletePassword"
                    type={showDelete ? "text" : "password"}
                    className="password-input"
                    placeholder={t("settings.oldPasswordPlaceholder")}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowDelete(!showDelete)}
                    aria-label={showDelete ? "Hide password" : "Show password"}
                  >
                    {showDelete ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="password-submit-btn delete-account-btn" disabled={hasPassword && !deletePassword}>
              {t("settings.deleteAccountBtn")}
            </button>
          </form>
        </section>
      </div>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t("settings.deleteAccountConfirmTitle")}</h3>
            <p className="delete-account-confirm">{t("settings.deleteAccountConfirm")}</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                {t("common.cancel")}
              </button>
              <button className="modal-btn danger" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? <span className="spinner" /> : t("settings.deleteAccountYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
