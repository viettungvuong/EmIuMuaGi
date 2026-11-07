// Date helpers for meal dates (schedules), shared by the calendar popup and the
// main page; mirrored in the mobile app's src/schedule.js
import { dateLocale, t } from "./i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Oldest first, like the server sends them
export const byTime = (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at);

// "Sat, 8/11, 19:00"
export const formatAt = (date) =>
  new Date(date).toLocaleString(dateLocale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatWhen = (schedule) => formatAt(schedule.scheduled_at);

// "now", "in 3h", "tomorrow", "in 4 days"
export function relativeWhen(date, now = new Date()) {
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
  if (days === 0) {
    const hours = Math.round((date - now) / (60 * 60 * 1000));
    return hours >= 1 ? t("schedule.inHours", { n: hours }) : t("schedule.now");
  }
  return days === 1 ? t("schedule.tomorrow") : t("schedule.inDays", { n: days });
}
