// frontend/src/components/ScheduleModal.jsx
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import client from '../api/client';
import { dateLocale, serverText, t } from '../i18n';
import { relativeWhen, startOfDay } from '../schedule';
import { colors, fonts, radius } from '../theme';
import { GradientButton } from './ui';

// Quick picks for the time of day, in minutes after midnight
const MEALS = [
  { key: 'breakfast', icon: '🌅', minutes: 8 * 60 },
  { key: 'lunch', icon: '☀️', minutes: 12 * 60 },
  { key: 'dinner', icon: '🌙', minutes: 19 * 60 },
];
const STEP_MINUTES = 15;

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a, b) => dayKey(a) === dayKey(b);

// Six weeks, Monday first, around the month `month` falls in, so the grid
// keeps its height from one month to the next
function monthGrid(month) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i));
}

// The web's CSS pulse on the next date: a ring that grows and fades, on repeat
function Pulse({ color = colors.accent }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={styles.pulse}>
      <Animated.View
        style={[
          styles.pulseRing,
          { backgroundColor: color },
          {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          },
        ]}
      />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

// The calendar popup. With a restaurant it books a date there; without one
// (the Restaurant tab's banner) it only shows what's planned. With onPick (the
// Add screen, before the restaurant exists) it hands the chosen time back instead
// of booking; initialWhen reopens it on the time picked before.
// `schedules` are the couple's dates, oldest first.
export default function ScheduleModal({ visible, restaurant, schedules, currentUser, partnerName, onCreated, onDeleted, onPick, initialWhen, onClose }) {
  const now = new Date();
  const next = schedules.find((s) => new Date(s.scheduled_at) >= now);
  const canBook = Boolean(restaurant || onPick);

  const [month, setMonth] = useState(() => startOfDay(initialWhen || now));
  const [selected, setSelected] = useState(() => startOfDay(initialWhen || now));
  const [minutes, setMinutes] = useState(() => (initialWhen ? initialWhen.getHours() * 60 + initialWhen.getMinutes() : 19 * 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of schedules) {
      const key = dayKey(new Date(s.scheduled_at));
      map.set(key, [...(map.get(key) || []), s]);
    }
    return map;
  }, [schedules]);

  const isMine = (s) => s.username === currentUser;
  const whoColor = (s) => (isMine(s) ? colors.accent : colors.partner);

  const when = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), Math.floor(minutes / 60), minutes % 60);
  const isPast = when < now;
  const dayEntries = byDay.get(dayKey(selected)) || [];

  const shiftMonth = (by) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const pick = (day) => {
    setSelected(day);
    if (day.getMonth() !== month.getMonth()) setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
    setError('');
  };
  const step = (by) => setMinutes((m) => (m + by + 24 * 60) % (24 * 60));

  const book = async () => {
    if (onPick) {
      onPick(when);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = await client.post('/api/schedules', {
        restaurant_id: restaurant.id,
        scheduled_at: when.toISOString(),
      });
      onCreated(data);
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t('schedule.failed'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    setError('');
    try {
      await client.delete(`/api/schedules/${id}`);
      onDeleted(id);
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t('common.somethingWrong'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Taps inside the card stay there instead of closing it */}
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <Text style={styles.title}>📅 {t('schedule.title')}</Text>
              <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel={t('schedule.close')} hitSlop={6}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            {restaurant && (
              <View style={styles.restaurant}>
                <Text style={styles.restaurantIcon}>🍜</Text>
                <View style={styles.restaurantInfo}>
                  <Text style={styles.strong} numberOfLines={1}>{restaurant.item_name}</Text>
                  {!!restaurant.address && <Text style={styles.muted} numberOfLines={1}>{restaurant.address}</Text>}
                </View>
              </View>
            )}

            {next && (
              <Pressable style={styles.next} onPress={() => pick(startOfDay(new Date(next.scheduled_at)))}>
                <Pulse color={whoColor(next)} />
                <View style={styles.nextText}>
                  <Text style={styles.smallLabel}>{t('schedule.next')}</Text>
                  <Text style={styles.strong} numberOfLines={1}>{next.restaurant_name}</Text>
                </View>
                <Text style={styles.nextWhen}>{relativeWhen(new Date(next.scheduled_at), now)}</Text>
              </Pressable>
            )}

            <View>
              <View style={styles.calNav}>
                <Pressable style={styles.navBtn} onPress={() => shiftMonth(-1)} accessibilityLabel={t('schedule.prevMonth')}>
                  <Text style={styles.navText}>‹</Text>
                </Pressable>
                <Text style={styles.month}>{month.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })}</Text>
                <Pressable style={styles.navBtn} onPress={() => shiftMonth(1)} accessibilityLabel={t('schedule.nextMonth')}>
                  <Text style={styles.navText}>›</Text>
                </Pressable>
              </View>

              <View style={styles.grid}>
                {t('schedule.weekdays').split(' ').map((name) => (
                  <Text key={name} style={[styles.cell, styles.weekday]}>{name}</Text>
                ))}
                {monthGrid(month).map((day) => {
                  const entries = byDay.get(dayKey(day)) || [];
                  const isSelected = sameDay(day, selected);
                  const outside = day.getMonth() !== month.getMonth();
                  const past = day < startOfDay(now);
                  return (
                    <Pressable key={dayKey(day)} style={styles.cell} onPress={() => pick(day)}>
                      <View
                        style={[
                          styles.day,
                          entries.length > 0 && styles.dayWithDates,
                          sameDay(day, now) && styles.dayToday,
                          isSelected && styles.daySelected,
                          outside && { opacity: 0.35 },
                        ]}
                      >
                        <Text style={[styles.dayNum, past && styles.dayNumPast, isSelected && { color: '#fff' }]}>{day.getDate()}</Text>
                        <View style={styles.dots}>
                          {entries.slice(0, 3).map((s) => (
                            <View key={s.id} style={[styles.dot, { backgroundColor: isSelected ? '#fff' : whoColor(s) }]} />
                          ))}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                  <Text style={styles.legendText}>{t('schedule.you')}</Text>
                </View>
                {!!partnerName && (
                  <View style={styles.legendItem}>
                    <View style={[styles.dot, { backgroundColor: colors.partner }]} />
                    <Text style={styles.legendText}>{partnerName}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.agenda}>
              <Text style={styles.agendaDay}>
                {sameDay(selected, now) && `${t('schedule.today')} · `}
                {selected.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {dayEntries.length === 0 ? (
                <Text style={styles.agendaEmpty}>{t('schedule.empty')}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {dayEntries.map((s) => {
                    const at = new Date(s.scheduled_at);
                    const isThis = restaurant && s.restaurant_id === restaurant.id;
                    const detail = [s.main_food, s.address].filter(Boolean).join(' · ');
                    return (
                      <View
                        key={s.id}
                        style={[
                          styles.agendaItem,
                          { borderLeftColor: whoColor(s) },
                          isThis && { borderColor: colors.accent },
                          at < now && { opacity: 0.55 },
                        ]}
                      >
                        <Text style={styles.agendaTime}>{hhmm(at.getHours() * 60 + at.getMinutes())}</Text>
                        <View style={styles.agendaInfo}>
                          <Text style={styles.strong} numberOfLines={1}>{s.restaurant_name}</Text>
                          {!!detail && <Text style={styles.muted} numberOfLines={1}>{detail}</Text>}
                        </View>
                        <Text style={[styles.who, isMine(s) ? styles.whoMe : styles.whoPartner]}>
                          {isMine(s) ? t('schedule.you') : s.username}
                        </Text>
                        {isMine(s) && (
                          <Pressable onPress={() => cancel(s.id)} accessibilityLabel={t('schedule.cancel')} hitSlop={8}>
                            <Text style={styles.cancelText}>×</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {canBook && (
              <View style={{ gap: 8 }}>
                <Text style={styles.smallLabel}>{t('schedule.time')}</Text>
                <View style={styles.mealRow}>
                  {MEALS.map((meal) => (
                    <Pressable
                      key={meal.key}
                      style={[styles.mealChip, minutes === meal.minutes && styles.mealChipActive]}
                      onPress={() => setMinutes(meal.minutes)}
                    >
                      <Text style={[styles.mealText, minutes === meal.minutes && { color: colors.text }]}>
                        {meal.icon} {t(`schedule.${meal.key}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => step(-STEP_MINUTES)} accessibilityLabel={t('schedule.earlier')}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.timeValue}>{hhmm(minutes)}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => step(STEP_MINUTES)} accessibilityLabel={t('schedule.later')}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            {canBook && (
              <GradientButton
                title={
                  isPast
                    ? t('schedule.past')
                    : t(onPick ? 'schedule.pick' : 'schedule.book', {
                        time: hhmm(minutes),
                        date: selected.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'numeric' }),
                      })
                }
                onPress={book}
                disabled={isPast}
                loading={saving}
              />
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  content: { padding: 18, gap: 16 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.3, color: colors.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 19, lineHeight: 21, color: colors.textMuted },

  strong: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  muted: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  smallLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },

  restaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
  },
  restaurantIcon: { fontSize: 26 },
  restaurantInfo: { flex: 1 },

  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  nextText: { flex: 1 },
  nextWhen: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  pulse: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  pulseDot: { width: 10, height: 10, borderRadius: 5 },

  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { fontSize: 20, lineHeight: 22, color: colors.text },
  month: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textTransform: 'capitalize' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  weekday: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, paddingBottom: 4 },
  day: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayWithDates: { backgroundColor: 'rgba(236, 72, 153, 0.12)' },
  dayToday: { borderColor: colors.accent },
  daySelected: { backgroundColor: colors.accent, borderColor: colors.accent, boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)' },
  dayNum: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  dayNumPast: { fontFamily: fonts.regular, color: colors.textMuted },
  dots: { flexDirection: 'row', gap: 3, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  legend: { flexDirection: 'row', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },

  agenda: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  agendaDay: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text, marginBottom: 10, textTransform: 'capitalize' },
  agendaEmpty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    borderLeftWidth: 4,
  },
  agendaTime: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  agendaInfo: { flex: 1 },
  who: { fontFamily: fonts.semibold, fontSize: 11, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20, overflow: 'hidden' },
  whoMe: { color: colors.accent, backgroundColor: 'rgba(236, 72, 153, 0.12)' },
  whoPartner: { color: colors.partner, backgroundColor: 'rgba(139, 92, 246, 0.12)' },
  cancelText: { fontSize: 19, color: colors.textMuted, paddingHorizontal: 2 },

  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mealChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  mealChipActive: { borderColor: colors.accent, backgroundColor: 'rgba(236, 72, 153, 0.14)' },
  mealText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  stepper: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  stepBtn: { width: 38, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  stepText: { fontSize: 17, color: colors.text },
  timeValue: { minWidth: 64, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },

  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center' },
});
