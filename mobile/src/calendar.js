// The couple's meal dates in the phone's own Calendar app, in a calendar of the
// app's own ("EmIuMuaGi"), each with an alert an hour before. Kept in step with
// /api/schedules whenever the list screen loads them: a new date (booked by
// either of the couple) is added, a cancelled one removed. Logging out deletes
// the calendar, and its events with it.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { t } from './i18n';
import { colors } from './theme';

const STORE_KEY = 'deviceCalendar'; // { calendarId, events: { [scheduleId]: eventId } }
const CALENDAR_TITLE = 'EmIuMuaGi';
const MEAL_MS = 90 * 60 * 1000; // how long an event lasts
const ALERT_MINUTES = 60;

async function loadState() {
  try {
    return JSON.parse(await AsyncStorage.getItem(STORE_KEY)) ?? { events: {} };
  } catch {
    return { events: {} };
  }
}

const saveState = (state) => AsyncStorage.setItem(STORE_KEY, JSON.stringify(state));

// Full access, not iOS's write-only: cancelled dates have to come out again
async function allowed() {
  const current = await Calendar.getCalendarPermissions();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Calendar.requestCalendarPermissions()).granted;
}

// The app's calendar, made the first time and again if it was deleted in the
// Calendar app (its events went with it, so they're all added again)
async function ownCalendar(state) {
  if (state.calendarId) {
    try {
      return await Calendar.ExpoCalendar.get(state.calendarId);
    } catch {
      // gone
    }
  }

  const details = { title: CALENDAR_TITLE, color: colors.accent, entityType: Calendar.EntityTypes.EVENT };
  if (Platform.OS === 'ios') {
    // Next to the user's own calendars (iCloud or on the phone)
    const { source } = Calendar.getDefaultCalendarSync();
    details.sourceId = source.id;
    details.source = source;
  } else {
    details.source = { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL };
    details.name = CALENDAR_TITLE;
    details.ownerAccount = 'personal';
    details.accessLevel = Calendar.CalendarAccessLevel.OWNER;
  }
  const calendar = await Calendar.createCalendar(details);
  state.calendarId = calendar.id;
  state.events = {};
  return calendar;
}

function timeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

async function sync(schedules) {
  if (Platform.OS === 'web') return;
  const state = await loadState();
  const now = Date.now();
  const listed = new Set(schedules.map((s) => String(s.id)));
  // Dates still to come that aren't in the calendar yet. One the user deleted
  // there stays deleted: it's still in state.events.
  const toAdd = (s) => !state.events[s.id] && new Date(s.scheduled_at).getTime() + MEAL_MS > now;
  const toRemove = Object.keys(state.events).filter((id) => !listed.has(id));

  // Nothing to change: no need to ask for the calendar yet
  if (!schedules.some(toAdd) && !toRemove.length) return;
  if (!(await allowed())) return;
  const calendar = await ownCalendar(state);

  // Saved even if one fails half way, so what did go in isn't added twice
  try {
    for (const id of toRemove) {
      try {
        const event = await Calendar.ExpoCalendarEvent.get(state.events[id]);
        await event.delete();
      } catch {
        // already deleted in the Calendar app
      }
      delete state.events[id];
    }

    // Checked again: ownCalendar may have just made a new, empty calendar
    for (const s of schedules.filter(toAdd)) {
      const start = new Date(s.scheduled_at);
      const event = await calendar.createEvent({
        title: `🍽️ ${s.restaurant_name}`,
        startDate: start,
        endDate: new Date(start.getTime() + MEAL_MS),
        location: s.address || undefined,
        notes: [s.main_food, t('calendar.bookedBy', { name: s.username })].filter(Boolean).join('\n'),
        alarms: [{ relativeOffset: -ALERT_MINUTES }],
        timeZone: timeZone(),
      });
      state.events[s.id] = event.id;
    }
  } finally {
    await saveState(state);
  }
}

async function clear() {
  if (Platform.OS === 'web') return;
  const state = await loadState();
  await AsyncStorage.removeItem(STORE_KEY);
  if (!state.calendarId) return;
  const { granted } = await Calendar.getCalendarPermissions();
  if (!granted) return;
  try {
    const calendar = await Calendar.ExpoCalendar.get(state.calendarId);
    await calendar.delete();
  } catch {
    // already deleted in the Calendar app
  }
}

// One at a time, so two quick syncs can't add the same date twice
let queue = Promise.resolve();
const enqueue = (task) => {
  queue = queue.then(task).catch((err) => console.error('Failed to update the phone calendar:', err));
  return queue;
};

// `schedules` is the couple's dates from /api/schedules
export const syncDeviceCalendar = (schedules) => enqueue(() => sync(schedules));

// On logging out: the next person on this phone shouldn't see them
export const clearDeviceCalendar = () => enqueue(clear);
