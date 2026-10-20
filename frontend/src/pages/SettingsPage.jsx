import { useNavigate } from "react-router-dom";
import { LANGUAGES, setLanguage, t, useLanguage } from "../i18n";
import "../styles/SettingsPage.css";

// Pick the app's language. The choice is kept in localStorage ("lang").
export default function SettingsPage() {
  const navigate = useNavigate();
  const current = useLanguage();

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ←
        </button>
        <h1 className="settings-title">{t("settings.title")}</h1>
      </header>

      <div className="settings-container">
        <h2 className="settings-section-label">{t("settings.language")}</h2>
        <div className="language-options" role="radiogroup" aria-label={t("settings.language")}>
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
      </div>
    </div>
  );
}
