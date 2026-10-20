import { useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { serverText, t } from "../i18n";
import "../styles/SearchPage.css";

// Expects GET /api/search?q=... to answer with a list of
// { name, price, shop_name, image_url, url } (the backend isn't built yet)
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(""); // the query the results belong to
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await client.get("/api/search", { params: { q } });
      setResults(data || []);
      setSearched(q);
    } catch (err) {
      setResults([]);
      setError(serverText(err.response?.data?.error) || t("search.failed"));
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) =>
    typeof price === "number" ? price.toLocaleString("vi-VN") + " ₫" : price;

  return (
    <div className="search-page">
      <header className="search-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ←
        </button>
        <h1 className="search-title">{t("search.title")}</h1>
      </header>

      <div className="search-container">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            className="search-input"
            type="search"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
            {loading ? <span className="spinner" /> : t("search.button")}
          </button>
        </form>

        {error && <p className="error-msg">{error}</p>}

        {!loading && !error && searched && results.length === 0 && (
          <div className="search-empty">
            <span>🔍</span>
            <p>{t("search.noResults", { query: searched })}</p>
          </div>
        )}

        {!searched && !loading && !error && (
          <div className="search-empty">
            <span>🛍️</span>
            <p>{t("search.start")}</p>
          </div>
        )}

        <ul className="search-results">
          {results.map((r, i) => (
            <li key={r.url || i} className="search-result">
              {r.image_url ? (
                <img className="result-image" src={r.image_url} alt="" loading="lazy" />
              ) : (
                <div className="result-image placeholder">🎁</div>
              )}
              <div className="result-info">
                <h3 className="result-name">{r.name}</h3>
                {r.price != null && <p className="result-price">{formatPrice(r.price)}</p>}
                {r.shop_name && <p className="result-shop">{r.shop_name}</p>}
              </div>
              {r.url && (
                <a className="result-link" href={r.url} target="_blank" rel="noopener noreferrer">
                  {t("search.view")}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
