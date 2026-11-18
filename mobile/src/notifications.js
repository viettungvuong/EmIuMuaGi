// "You have a date today" reminders on the morning of each meal date, as local
// notifications (expo-notifications, set up in app.json). The phone schedules
// them from the couple's dates each time the list screen loads them, so a date
// the partner booked is reminded once this phone has seen it.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { dateLocale, t } from './i18n';

const CHANNEL_ID = 'dates';
const MORNING_HOUR = 9;
const HOUR_MS = 60 * 60 * 1000;
// iOS keeps at most 64 pending notifications per app
const MAX_REMINDERS = 30;

// Shown even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const timeOf = (d) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

// 9:00 on the day of `first` (that day's earliest date), or an hour before a
// breakfast date, but never the evening before
function remindAt(first) {
  const day = startOfDay(first);
  const morning = new Date(day.getTime() + MORNING_HOUR * HOUR_MS);
  const hourBefore = new Date(first.getTime() - HOUR_MS);
  return new Date(Math.max(day, Math.min(morning, hourBefore)));
}

// Asks only the first time; Android 13+ needs the channel to exist before it can ask
async function allowed() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('schedule.reminderChannel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function sync(schedules) {
  if (Platform.OS === 'web') return; // a browser can't schedule them
  const now = new Date();
  const days = new Map(); // day → its upcoming dates, earliest first
  for (const s of schedules) {
    const at = new Date(s.scheduled_at);
    if (at <= now) continue;
    const day = startOfDay(at).getTime();
    if (!days.has(day)) days.set(day, []);
    days.get(day).push({ at, name: s.restaurant_name });
  }
  const reminders = [...days.values()]
    .map((dates) => ({ dates, at: remindAt(dates[0].at) }))
    .filter((r) => r.at > now)
    .slice(0, MAX_REMINDERS);

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!reminders.length || !(await allowed())) return;
    for (const { dates, at } of reminders) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('schedule.reminderTitle'),
          body: dates.map((d) => `${timeOf(d.at)} · ${d.name}`).join('\n'),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL_ID },
      });
    }
  } catch (err) {
    console.error('Failed to schedule date reminders:', err);
  }
}

// One sync at a time, so two quick ones can't interleave and double a reminder
let queue = Promise.resolve();

// Replaces the reminders with one per upcoming day that has a date. `schedules`
// is the couple's dates from /api/schedules.
export function syncDateReminders(schedules) {
  queue = queue.then(() => sync(schedules));
  return queue;
}

// On logging out: the next person on this phone shouldn't get them
export function clearDateReminders() {
  return syncDateReminders([]);
}
