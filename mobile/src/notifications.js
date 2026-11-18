// Notifications at 0:00, 9:00 and 17:00: the dates coming up, what the partner
// added, and what's still not bought 3 days / a week on.
//
// The server sends them (item-service internal/notify.go) to this phone's Expo
// push token, which needs the EAS project id and, on Android, Firebase (see
// app.config.js). Until push works on this phone, the phone schedules the same
// digest itself from what it last loaded: the dates and the reminders, but not
// news of new items, which only the server knows in time. Never both, so
// nothing arrives twice.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import client from './api/client';
import { dateLocale, t } from './i18n';

const CHANNEL_ID = 'digest'; // the server sends to this one too (internal/push.go)
const OLD_CHANNEL_ID = 'dates'; // the morning date reminders of 1.0.2

// The phone's digest, as the server's
const DIGEST_HOURS = [0, 9, 17];
const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_AFTER_DAYS = [3, 7];
const MAX_DIGESTS = 40; // iOS keeps at most 64 pending notifications per app
const MAX_LISTED = 3; // names on a line before the rest become "+N"

// Shown even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Asks only the first time; Android 13+ needs the channel to exist before it can ask
async function allowed() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('notifications.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.deleteNotificationChannelAsync(OLD_CHANNEL_ID);
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

let registered = null; // the token the server has, to take back on logging out

async function register(language) {
  if (!(await allowed())) return;
  if (!projectId) {
    console.warn('No EAS project id (EXPO_PUBLIC_EAS_PROJECT_ID): the phone schedules its own notifications');
    return;
  }
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await client.put('/api/notifications/token', { token, language });
    registered = token;
    // The server sends everything now: drop what the phone had scheduled
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('No push notifications, the phone schedules its own:', err?.message ?? err);
  }
}

async function unregister() {
  const token = registered;
  registered = null;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (token) await client.delete('/api/notifications/token', { data: { token } });
}

// The first digest time at or after t / at or before t
function slotFrom(t) {
  for (let day = 0; day <= 1; day++) {
    for (const h of DIGEST_HOURS) {
      const slot = new Date(t.getFullYear(), t.getMonth(), t.getDate() + day, h);
      if (slot >= t) return slot;
    }
  }
}
function slotUntil(t) {
  for (let day = 0; day <= 1; day++) {
    for (const h of [...DIGEST_HOURS].reverse()) {
      const slot = new Date(t.getFullYear(), t.getMonth(), t.getDate() - day, h);
      if (slot <= t) return slot;
    }
  }
}

const sameDay = (a, b) => a.toDateString() === b.toDateString();
const timeOf = (d) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

function dayOf(date, slot) {
  if (sameDay(date, slot)) return t('notifications.today');
  if (sameDay(date, new Date(slot.getFullYear(), slot.getMonth(), slot.getDate() + 1))) return t('notifications.tomorrow');
  return date.toLocaleDateString(dateLocale(), { day: '2-digit', month: '2-digit' });
}

const listNames = (names) =>
  names.length <= MAX_LISTED ? names.join(', ') : `${names.slice(0, MAX_LISTED).join(', ')} +${names.length - MAX_LISTED}`;

function render(slot, { dates, reminders }) {
  const lines = [];
  dates.slice(0, MAX_LISTED).forEach((d) => lines.push(`📅 ${dayOf(d.at, slot)} ${timeOf(d.at)} · ${d.name}`));
  if (dates.length > MAX_LISTED) lines.push(`📅 +${dates.length - MAX_LISTED}`);
  if (reminders.length) {
    const names = reminders.map((r) => `${r.name} (${t(r.week ? 'notifications.week' : 'notifications.days')})`);
    lines.push(t('notifications.notBought', { items: listNames(names) }));
  }
  const title =
    dates.length && reminders.length
      ? t('notifications.mixedTitle')
      : t(dates.length ? 'notifications.datesTitle' : 'notifications.remindTitle');
  return { title, body: lines.join('\n') };
}

// The digests to come, from the couple's dates and the items not bought yet
function plan({ me, partner, schedules, items }) {
  const now = new Date();
  const slots = new Map(); // time → { dates, reminders }
  const at = (slot) => {
    const key = slot.getTime();
    if (!slots.has(key)) slots.set(key, { dates: [], reminders: [] });
    return slots.get(key);
  };

  // Each date comes up in the two digests before it
  for (const s of schedules) {
    const date = new Date(s.scheduled_at);
    if (date <= now) continue;
    const last = slotUntil(date);
    for (const slot of [slotUntil(new Date(last - 1)), last]) {
      if (slot > now) at(slot).dates.push({ at: date, name: s.restaurant_name });
    }
  }

  // For whoever is to buy it: the owner's partner, or the owner on their own
  for (const item of items) {
    const toBuy = partner ? item.owner === partner : item.owner === me;
    if (!toBuy || item.bought) continue;
    for (const days of REMIND_AFTER_DAYS) {
      const slot = slotFrom(new Date(new Date(item.created_at).getTime() + days * DAY_MS));
      if (slot > now) at(slot).reminders.push({ name: item.item_name, week: days === 7 });
    }
  }

  return [...slots.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, MAX_DIGESTS)
    .map(([time, news]) => ({ slot: new Date(time), news }));
}

async function scheduleOwn({ me, partner, schedules }) {
  if (registered) return; // the server sends them
  const { data: items } = await client.get('/api/items', { params: { hide_bought: true } });
  const digests = plan({ me, partner, schedules, items });

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!digests.length || !(await allowed())) return;
  for (const { slot, news } of digests) {
    await Notifications.scheduleNotificationAsync({
      content: render(slot, news),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot, channelId: CHANNEL_ID },
    });
  }
}

// One at a time, so a logout can't overtake the registration it undoes, and
// the phone's own digest knows whether push works
let queue = Promise.resolve();
const enqueue = (task, what) => {
  queue = queue.then(task).catch((err) => console.error(`Failed to ${what}:`, err));
  return queue;
};

// On every launch while logged in, on logging in and on changing language
export function registerForPush(language) {
  if (Platform.OS === 'web') return Promise.resolve(); // a browser gets none
  return enqueue(() => register(language), 'register for push notifications');
}

// Whenever the list screen has loaded the dates and who the partner is.
// `user` is /api/me, `schedules` is /api/schedules.
export function syncPhoneDigest(user, schedules) {
  if (Platform.OS === 'web' || !user) return Promise.resolve();
  const args = { me: user.id, partner: user.partner_id ?? null, schedules };
  return enqueue(() => scheduleOwn(args), 'schedule notifications');
}

// On logging out, while the session still works: the next person on this phone
// shouldn't get them
export function unregisterPush() {
  if (Platform.OS === 'web') return Promise.resolve();
  return enqueue(unregister, 'stop notifications');
}
