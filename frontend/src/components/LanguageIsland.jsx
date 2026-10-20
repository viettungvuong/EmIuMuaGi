import { LANGUAGES, setLanguage, useLanguage } from "../i18n";
import "../styles/LanguageIsland.css";

// The small flag switch floating above the sign in / sign up card
export default function LanguageIsland() {
  const language = useLanguage();

  return (
    <div className="lang-island" role="radiogroup" aria-label="Language / Ngôn ngữ">
      {LANGUAGES.map(({ code, flag, name }) => (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={code === language}
          aria-label={name}
          title={name}
          className={`lang-island-btn ${code === language ? "active" : ""}`}
          onClick={() => setLanguage(code)}
        >
          <span className="lang-island-flag">{flag}</span>
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
