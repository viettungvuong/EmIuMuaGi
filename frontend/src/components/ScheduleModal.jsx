import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { dateLocale, serverText, t } from "../i18n";
import { relativeWhen, startOfDay } from "../schedule";
import "../styles/ScheduleModal.css";

// Quick picks for the time of day, in minutes after midnight
const MEALS = [
  { key: "breakfast", icon: "🌅", minutes: 8 * 60 },
  { key: "lunch", icon: "☀️", minutes: 12 * 60 },
  { key: "dinner", icon: "🌙", minutes: 19 * 60 },
];
const STEP_MINUTES = 15;

const pad = (n) => String(n).padStart(2, "0");
const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a, b) => dayKey(a) === dayKey(b);

// Six weeks, Monday first, around the month `month` falls in, so the grid
// keeps its height from one month to the next
function monthGrid(month) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
}

// The calendar popup. With a restaurant it books a date there; without one
// (the Restaurant tab's banner) it only shows what's planned. With onPick (the
// Add page, before the restaurant exists) it hands the chosen time back instead
// of booking; initialWhen reopens it on the time picked before.
// `schedules` are the couple's dates, oldest first.
export default function ScheduleModal({ restaurant, schedules, currentUser, partnerName, onCreated, onDeleted, onPick, initialWhen, onClose }) {
  const now = new Date();
  const next = schedules.find((s) => new Date(s.scheduled_at) >= now);
  const canBook = Boolean(restaurant || onPick);

  const [month, setMonth] = useState(() => startOfDay(initialWhen || now));
  const [selected, setSelected] = useState(() => startOfDay(initialWhen || now));
  const [minutes, setMinutes] = useState(() => (initialWhen ? initialWhen.getHours() * 60 + initialWhen.getMinutes() : 19 * 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of schedules) {
      const key = dayKey(new Date(s.scheduled_at));
      map.set(key, [...(map.get(key) || []), s]);
    }
    return map;
  }, [schedules]);

  const who = (s) => (s.username === currentUser ? "me" : "partner");
  const whoName = (s) => (s.username === currentUser ? t("schedule.you") : s.username);

  const when = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), Math.floor(minutes / 60), minutes % 60);
  const isPast = when < now;
  const dayEntries = byDay.get(dayKey(selected)) || [];

  const shiftMonth = (by) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const pick = (day) => {
    setSelected(day);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setError("");
  };
  const step = (by) => setMinutes((m) => (m + by + 24 * 60) % (24 * 60));

  const book = async () => {
    if (onPick) {
      onPick(when);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await client.post("/api/schedules", {
        restaurant_id: restaurant.id,
        scheduled_at: when.toISOString(),
      });
      onCreated(data);
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t("schedule.failed"));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    setError("");
    try {
      await client.delete(`/api/schedules/${id}`);
      onDeleted(id);
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t("common.somethingWrong"));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content schedule-modal" role="dialog" aria-label={t("schedule.title")} onClick={(e) => e.stopPropagation()}>
        <div className="schedule-head">
          <h2 className="schedule-title">📅 {t("schedule.title")}</h2>
          <button type="button" className="schedule-close" onClick={onClose} aria-label={t("schedule.close")}>×</button>
        </div>

        {restaurant && (
          <div className="schedule-restaurant">
            <span className="schedule-restaurant-icon">🍜</span>
            <div className="schedule-restaurant-info">
              <strong>{restaurant.item_name}</strong>
              {restaurant.address && <span>{restaurant.address}</span>}
            </div>
          </div>
        )}

        {next && (
          <button type="button" className="schedule-next" onClick={() => pick(startOfDay(new Date(next.scheduled_at)))}>
            <span className="schedule-next-pulse" />
            <span className="schedule-next-text">
              <span className="schedule-next-label">{t("schedule.next")}</span>
              <strong>{next.restaurant_name}</strong>
            </span>
            <span className="schedule-next-when">{relativeWhen(new Date(next.scheduled_at), now)}</span>
          </button>
        )}

        <div className="cal">
          <div className="cal-nav">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label={t("schedule.prevMonth")}>‹</button>
            <span className="cal-month">{month.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label={t("schedule.nextMonth")}>›</button>
          </div>

          <div className="cal-grid">
            {t("schedule.weekdays").split(" ").map((name) => (
              <span key={name} className="cal-weekday">{name}</span>
            ))}
            {monthGrid(month).map((day) => {
              const entries = byDay.get(dayKey(day)) || [];
              const classes = [
                "cal-day",
                day.getMonth() !== month.getMonth() && "outside",
                day < startOfDay(now) && "past",
                sameDay(day, now) && "today",
                sameDay(day, selected) && "selected",
                entries.length > 0 && "has-dates",
                next && sameDay(day, new Date(next.scheduled_at)) && "next",
              ].filter(Boolean).join(" ");
              return (
                <button type="button" key={dayKey(day)} className={classes} onClick={() => pick(day)}>
                  <span className="cal-num">{day.getDate()}</span>
                  <span className="cal-dots">
                    {entries.slice(0, 3).map((s) => (
                      <i key={s.id} className={`cal-dot ${who(s)}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="cal-legend">
            <span><i className="cal-dot me" /> {t("schedule.you")}</span>
            {partnerName && <span><i className="cal-dot partner" /> {partnerName}</span>}
          </div>
        </div>

        <div className="agenda">
          <p className="agenda-day">
            {sameDay(selected, now) && `${t("schedule.today")} · `}
            {selected.toLocaleDateString(dateLocale(), { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {dayEntries.length === 0 ? (
            <p className="agenda-empty">{t("schedule.empty")}</p>
          ) : (
            <ul className="agenda-list">
              {dayEntries.map((s) => {
                const at = new Date(s.scheduled_at);
                const isThis = restaurant && s.restaurant_id === restaurant.id;
                return (
                  <li key={s.id} className={`agenda-item ${who(s)} ${isThis ? "this" : ""} ${at < now ? "done" : ""}`}>
                    <span className="agenda-time">{hhmm(at.getHours() * 60 + at.getMinutes())}</span>
                    <span className="agenda-info">
                      <strong>{s.restaurant_name}</strong>
                      {(s.main_food || s.address) && <span>{[s.main_food, s.address].filter(Boolean).join(" · ")}</span>}
                    </span>
                    <span className={`agenda-who ${who(s)}`}>{whoName(s)}</span>
                    {s.username === currentUser && (
                      <button type="button" className="agenda-cancel" onClick={() => cancel(s.id)} aria-label={t("schedule.cancel")} title={t("schedule.cancel")}>×</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {canBook && (
          <div className="booking">
            <span className="booking-label">{t("schedule.time")}</span>
            <div className="booking-row">
              <div className="meal-chips">
                {MEALS.map((meal) => (
                  <button
                    key={meal.key}
                    className={`meal-chip ${minutes === meal.minutes ? "active" : ""}`}
                    onClick={() => setMinutes(meal.minutes)}
                  >
                    {meal.icon} {t(`schedule.${meal.key}`)}
                  </button>
                ))}
              </div>
              <div className="time-stepper">
                <button type="button" onClick={() => step(-STEP_MINUTES)} aria-label={t("schedule.earlier")}>−</button>
                <span className="time-value">{hhmm(minutes)}</span>
                <button type="button" onClick={() => step(STEP_MINUTES)} aria-label={t("schedule.later")}>+</button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="error-msg schedule-error">{error}</p>}

        {canBook && (
          <button type="button" className="book-btn" disabled={isPast || saving} onClick={book}>
            {saving ? (
              <span className="spinner" />
            ) : isPast ? (
              t("schedule.past")
            ) : (
              t(onPick ? "schedule.pick" : "schedule.book", {
                time: hhmm(minutes),
                date: selected.toLocaleDateString(dateLocale(), { day: "numeric", month: "numeric" }),
              })
            )}
          </button>
        )}
      </div>
    </div>
  );
}
