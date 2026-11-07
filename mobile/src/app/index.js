// frontend/src/pages/MainPage.jsx
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { WEB_URL } from '../api/config';
import { useAuth } from '../auth';
import { dateLocale, t, useLanguage } from '../i18n';
import { RatingForm } from '../components/RatingModal';
import ScheduleModal from '../components/ScheduleModal';
import { byTime, formatWhen, relativeWhen } from '../schedule';
import { AppHeader, EmptyState, LoadingState, ModalCard } from '../components/ui';
import { colors, fonts, radius } from '../theme';

const ITEM_TYPES = ['clothes', 'food_and_drink', 'restaurant', 'others'];
const typeLabel = (type) => (ITEM_TYPES.includes(type) ? t(`types.${type}`) : type);

const TYPE_COLOR = '#cb1d7a';

// How far left a card must be swiped before letting go marks it bought
const SWIPE_TRIGGER = 100;

// What the backend sends as the history ID when it couldn't record the purchase
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

// How long the search box has to sit still before the server is asked
const SEARCH_DEBOUNCE_MS = 300;

// Item times are shown in Vietnam time, like the rest of the app. It is UTC+7
// all year (no daylight saving), so its calendar day is the UTC day 7 hours on.
const VN_TIME = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (date) => new Date(new Date(date).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10); // '2026-11-07'

// 'Today', 'Yesterday', or 'Saturday, November 1'
function dayLabel(day) {
  if (day === dayOf(Date.now())) return t('main.today');
  if (day === dayOf(Date.now() - DAY_MS)) return t('main.yesterday');
  const [year, month, date] = day.split('-').map(Number);
  // Noon UTC is the same calendar day in Vietnam
  return new Date(Date.UTC(year, month - 1, date, 12)).toLocaleDateString(dateLocale(), {
    timeZone: VN_TIME,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(year !== new Date().getFullYear() && { year: 'numeric' }),
  });
}

// The list as a conversation, newest on top: a separator whenever the day changes,
// and for each bubble whether it opens or closes a run of one person's items, so
// a run sits close together with the avatar on its last bubble
// (mirrors chatRows in the web app's MainPage)
function chatRows(items) {
  const rows = [];
  items.forEach((item, i) => {
    const day = dayOf(item.created_at);
    const prev = items[i - 1];
    const next = items[i + 1];
    const newDay = !prev || dayOf(prev.created_at) !== day;
    if (newDay) rows.push({ kind: 'day', key: `day-${day}`, label: dayLabel(day) });
    rows.push({
      kind: 'item',
      key: item.id,
      item,
      runStart: newDay || prev.owner !== item.owner,
      runEnd: !next || next.owner !== item.owner || dayOf(next.created_at) !== day,
    });
  });
  return rows;
}

function subInfo(item) {
  if (item.item_type === 'clothes') {
    return [item.size, item.color, item.brand].filter(Boolean).join(' · ');
  }
  if (item.item_type === 'food_and_drink') {
    const toppings = item.toppings?.length ? t('main.toppings', { toppings: item.toppings.join(', ') }) : null;
    return [item.size, item.sugar && t('main.sugar', { sugar: item.sugar }), toppings].filter(Boolean).join(' · ');
  }
  if (item.item_type === 'restaurant') {
    // The picked date shows as its own chip, so "pick_date" isn't printed here
    const timeToEat = item.time_to_eat === 'auto_schedule' ? t('add.autoSchedule') : null;
    return [item.main_food, item.cuisine_type, item.address, timeToEat].filter(Boolean).join(' · ');
  }
  if (item.item_type === 'others') {
    return item.category || '';
  }
  return '';
}

export default function MainScreen() {
  useLanguage(); // redraw in a newly picked language
  const router = useRouter();
  const { username, signOut } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The list's controls, applied by the server (GET /api/items?type=&q=&hide_bought=)
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [search, setSearch] = useState(''); // searchQuery once typing pauses
  const [hideBought, setHideBought] = useState(false);
  const [who, setWho] = useState('all'); // whose items: 'all', 'me' or 'partner'
  const [userData, setUserData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmItemId, setConfirmItemId] = useState(null);
  const [buying, setBuying] = useState(false);
  // The purchase just made, while its rating form is open: { historyId, name }
  const [ratingPurchase, setRatingPurchase] = useState(null);
  // The couple's meal dates, oldest first, and the calendar popup while open:
  // { restaurant } to book one, { restaurant: null } to just look
  const [schedules, setSchedules] = useState([]);
  const [calendar, setCalendar] = useState(null);
  // Only with a partner linked: after unlinking, "partner's items" would always be empty
  const whoFilter = userData?.partner ? who : 'all';
  const requestRef = useRef(0); // only the latest list request's answer is shown

  const fetchItems = useCallback(async () => {
    const request = ++requestRef.current;
    const params = {};
    if (filterType !== 'all') params.type = filterType;
    if (search) params.q = search;
    if (hideBought) params.hide_bought = true;
    if (whoFilter !== 'all') params.who = whoFilter;

    try {
      const { data } = await client.get('/api/items', { params });
      if (request !== requestRef.current) return; // the controls changed meanwhile
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [filterType, search, hideBought, whoFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchUserData = async () => {
    try {
      const { data } = await client.get('/api/me');
      setUserData(data);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data } = await client.get('/api/schedules');
      setSchedules(data);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  // Every time the screen shows, so a newly added item appears on returning from
  // Add; the list also reloads whenever its controls change
  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchSchedules();
    }, []),
  );
  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchItems(), fetchUserData(), fetchSchedules()]);
    setRefreshing(false);
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSchedules((prev) => prev.filter((s) => s.restaurant_id !== id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const confirmBuy = async () => {
    const id = confirmItemId;
    if (!id || buying) return;
    setBuying(true);

    try {
      const { data } = await client.patch(`/api/items/${id}/bought`);
      // With "hide bought" on, the server would no longer list it
      setItems((prev) => (hideBought ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? data : i))));
      // The dialog stays open and turns into the rating form. Ratings belong to
      // the purchase (its history entry), which the backend just created;
      // "Để sau" leaves it for the history screen.
      const historyId = data.additional?.HistoryID;
      if (historyId && historyId !== NIL_UUID) {
        setRatingPurchase({ historyId, name: data.item_name });
      }
    } catch (err) {
      console.error('Failed to mark item as bought:', err);
    } finally {
      setConfirmItemId(null);
      setBuying(false);
    }
  };

  const submitRating = async (form) => {
    const { historyId } = ratingPurchase;
    setRatingPurchase(null);

    try {
      await client.post(`/api/history/${historyId}/review`, form);
    } catch (err) {
      console.error('Failed to rate purchase:', err);
    }
  };

  const currentUser = userData?.id || username;

  // Upcoming dates: the very next one, and each restaurant's next one
  const now = new Date();
  const upcoming = schedules.filter((s) => new Date(s.scheduled_at) >= now);
  const nextDate = upcoming[0];
  const inviteLink = `${WEB_URL}/partner/${userData?.invite_link || ''}`;

  const copyInviteLink = async () => {
    if (!userData?.invite_link) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // An empty answer to a filtered list means "no match", not "nothing added yet"
  const filtering = filterType !== 'all' || Boolean(search) || hideBought || whoFilter !== 'all';

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <AppHeader
        username={username}
        count={items.length}
        onHistory={() => router.push('/history')}
        onSettings={() => router.push('/settings')}
        onLogout={signOut}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {loading ? (
          <LoadingState />
        ) : (
          <>
            <View style={styles.partnerSection}>
              {userData?.partner ? (
                <View style={[styles.partnerCard, styles.partnerInfoCard]}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.avatarEmoji}>🤝</Text>
                  </View>
                  <View style={styles.partnerDetails}>
                    <Text style={styles.partnerLabel}>{t('main.partnerLabel')}</Text>
                    <Text style={styles.partnerName}>{userData.partner.id}</Text>
                    <Text style={styles.partnerEmail}>{userData.partner.email}</Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.partnerCard, styles.inviteCard]}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.avatarEmoji}>🔗</Text>
                  </View>
                  <View style={styles.inviteDetails}>
                    <Text style={styles.partnerLabel}>{t('main.inviteLabel')}</Text>
                    <View style={styles.inviteRow}>
                      <Text style={styles.inviteUrl} numberOfLines={1} selectable>
                        {inviteLink}
                      </Text>
                      <Pressable style={styles.copyBtn} onPress={copyInviteLink}>
                        <Text style={styles.copyBtnText}>{copySuccess ? t('main.copied') : t('main.copy')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {items.length === 0 && !filtering ? (
              <EmptyState icon="🧐" text={t('main.empty')} />
            ) : (
              <>
                <View style={styles.controls}>
                  <TextInput
                    style={styles.search}
                    placeholder={t('main.searchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {/* Whose items, once there's a partner to tell apart */}
                  {!!userData?.partner && (
                    <View style={styles.whoFilter} accessibilityRole="radiogroup" accessibilityLabel={t('main.whoseItems')}>
                      {[
                        ['all', '💞', t('main.both'), styles.whoFilterAll],
                        ['me', '🙋', t('main.mine'), styles.whoFilterMe],
                        ['partner', '💜', t('main.partners', { name: userData.partner.id }), styles.whoFilterPartner],
                      ].map(([value, icon, label, activeStyle]) => (
                        <Pressable
                          key={value}
                          style={[styles.whoFilterBtn, who === value && activeStyle]}
                          onPress={() => setWho(value)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: who === value }}
                        >
                          <Text style={[styles.whoFilterText, who === value && { color: '#fff' }]} numberOfLines={1}>
                            {icon} {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
                    {[['all', t('types.all')], ...ITEM_TYPES.map((type) => [type, typeLabel(type)])].map(([type, label]) => (
                      <Pressable
                        key={type}
                        style={[styles.filterTab, filterType === type && styles.filterTabActive]}
                        onPress={() => setFilterType(type)}
                      >
                        <Text style={[styles.filterTabText, filterType === type && { color: colors.text }]}>{label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable style={styles.hideBought} onPress={() => setHideBought((v) => !v)}>
                    <View style={[styles.checkbox, hideBought && styles.checkboxOn]}>
                      {hideBought && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.hideBoughtText}>{t('main.hideBought')}</Text>
                  </Pressable>
                </View>

                {filterType === 'restaurant' && (
                  <Pressable style={styles.dateBanner} onPress={() => setCalendar({ restaurant: null })}>
                    <Text style={styles.dateBannerIcon}>📅</Text>
                    <View style={styles.dateBannerText}>
                      {nextDate ? (
                        <>
                          <Text style={styles.dateBannerLabel}>{t('schedule.next')}</Text>
                          <Text style={styles.itemName} numberOfLines={1}>{nextDate.restaurant_name}</Text>
                          <Text style={styles.dateBannerWhen}>
                            {formatWhen(nextDate)} · {relativeWhen(new Date(nextDate.scheduled_at), now)}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.subInfo}>{t('schedule.noneYet')}</Text>
                      )}
                    </View>
                    <Text style={styles.dateBannerCta}>{t('schedule.calendar')} ›</Text>
                  </Pressable>
                )}

                {items.length === 0 ? (
                  <EmptyState icon="😅" text={t('main.noMatch')} />
                ) : (
                  <View>
                    {chatRows(items).map((row) =>
                      row.kind === 'day' ? (
                        <View key={row.key} style={styles.chatDay}>
                          <View style={styles.chatDayLine} />
                          <Text style={styles.chatDayText}>{row.label}</Text>
                          <View style={styles.chatDayLine} />
                        </View>
                      ) : (
                        <ChatBubble
                          key={row.key}
                          item={row.item}
                          mine={row.item.owner === currentUser}
                          runStart={row.runStart}
                          runEnd={row.runEnd}
                          nextDate={row.item.item_type === 'restaurant' ? upcoming.find((s) => s.restaurant_id === row.item.id) : null}
                          onSchedule={() => setCalendar({ restaurant: row.item })}
                          onBuy={() => setConfirmItemId(row.item.id)}
                          onDelete={() => handleDelete(row.item.id)}
                        />
                      ),
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/add')} accessibilityLabel={t('main.addLabel')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Mounted only while open, so each opening starts on today */}
      {calendar && (
        <ScheduleModal
          visible
          restaurant={calendar.restaurant}
          schedules={schedules}
          currentUser={currentUser}
          partnerName={userData?.partner?.id}
          onCreated={(schedule) => {
            setSchedules((prev) => [...prev, schedule].sort(byTime));
            setCalendar(null);
          }}
          onDeleted={(id) => setSchedules((prev) => prev.filter((s) => s.id !== id))}
          onClose={() => setCalendar(null)}
        />
      )}

      {/* One dialog: "did you buy it?", then the rating form */}
      <ModalCard
        visible={confirmItemId !== null || ratingPurchase !== null}
        onRequestClose={() => (ratingPurchase ? setRatingPurchase(null) : setConfirmItemId(null))}
        width={ratingPurchase ? 400 : 340}
      >
        {ratingPurchase ? (
          <RatingForm
            itemName={ratingPurchase.name}
            cancelLabel={t('common.later')}
            onCancel={() => setRatingPurchase(null)}
            onSubmit={submitRating}
          />
        ) : (
          <>
            <Text style={styles.modalText}>{t('main.confirmBuy')}</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setConfirmItemId(null)}>
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>{t('main.notYet')}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalConfirm, buying && { opacity: 0.6 }]} onPress={confirmBuy} disabled={buying}>
                <Text style={[styles.modalBtnText, { color: colors.success }]}>{t('main.yesBought')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ModalCard>
    </SafeAreaView>
  );
}

// One item as a chat message: yours on the right, your partner's on the left
// with their initial, closing a run of their items (MainPage's ChatBubble on the web)
function ChatBubble({ item, mine, runStart, runEnd, nextDate, onSchedule, onBuy, onDelete }) {
  const info = subInfo(item);
  const time = new Date(item.created_at).toLocaleTimeString(dateLocale(), { timeZone: VN_TIME, hour: '2-digit', minute: '2-digit' });
  const showActions = !item.bought || item.item_type === 'restaurant' || mine;

  // Swipe left to buy: the bubble slides over a green strip, and letting go past
  // SWIPE_TRIGGER opens the same "did you buy it?" dialog as the button
  // (onBuy is kept from the first render: it only opens the dialog for this item's id)
  const [translateX] = useState(() => new Animated.Value(0));
  const [swipe] = useState(() => {
    const springBack = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    return PanResponder.create({
      // Only clearly horizontal, leftward drags, so the list still scrolls
      onMoveShouldSetPanResponder: (_, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => translateX.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_TRIGGER) onBuy();
        springBack();
      },
      onPanResponderTerminate: springBack,
    });
  });
  const actionOpacity = translateX.interpolate({ inputRange: [-SWIPE_TRIGGER, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  // A run sits together: flatter corners on the sender's side, a tail on its last bubble
  const side = mine ? 'Right' : 'Left';
  const corners = {
    [`borderTop${side}Radius`]: runStart ? 20 : 8,
    [`borderBottom${side}Radius`]: runEnd ? 4 : 8,
  };
  const Surface = mine ? LinearGradient : View;
  const surfaceProps = mine ? { colors: ['#fdd3e5', '#fde7f1'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } : {};

  const bubble = (
    <Surface {...surfaceProps} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, corners, item.bought && { opacity: 0.6 }]}>
      <View style={styles.bubbleHeader}>
        <View
          style={[styles.who, item.wanted_by === 1 ? styles.whoBoy : styles.whoGirl]}
          accessibilityLabel={t(`wantedBy.${item.wanted_by === 1 ? 'boy' : 'girl'}`)}
        >
          <Text style={styles.whoIcon}>{item.wanted_by === 1 ? '👦' : '👧'}</Text>
        </View>
        <Text style={[styles.itemName, item.bought && styles.itemNameBought]}>{item.item_name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeLabel(item.item_type)}</Text>
        </View>
      </View>

      {!!info && <Text style={styles.subInfo}>{info}</Text>}

      {(!!item.shop_name || item.quantity > 1 || !!nextDate) && (
        <View style={styles.meta}>
          {!!item.shop_name && <Text style={styles.metaText}>🏪 {item.shop_name}</Text>}
          {item.quantity > 1 && <Text style={styles.metaAccent}>x{item.quantity}</Text>}
          {!!nextDate && <Text style={styles.nextDateChip}>📅 {formatWhen(nextDate)}</Text>}
        </View>
      )}

      {!!item.buy_url && (
        <Text style={styles.itemLink} onPress={() => Linking.openURL(item.buy_url)}>
          🔗 {item.item_type === 'restaurant' ? t('main.viewRestaurant') : t('main.viewProduct')}
        </Text>
      )}

      {showActions && (
        <View style={styles.bubbleActions}>
          {!item.bought && (
            <Pressable style={styles.buyBtn} onPress={onBuy} accessibilityLabel={t('main.boughtLabel')}>
              <Text style={styles.buyBtnText}>{t('main.bought')}</Text>
            </Pressable>
          )}
          {item.item_type === 'restaurant' && (
            <Pressable style={styles.scheduleBtn} onPress={onSchedule} accessibilityLabel={t('schedule.button')}>
              <Text style={styles.scheduleBtnText}>📅 {t('schedule.button')}</Text>
            </Pressable>
          )}
          {mine && (
            <Pressable style={styles.deleteBtn} onPress={onDelete} accessibilityLabel={t('main.deleteLabel')}>
              <Text style={styles.deleteBtnText}>🗑</Text>
            </Pressable>
          )}
        </View>
      )}
    </Surface>
  );

  return (
    <View style={[styles.chatRow, mine && styles.chatRowMine, runStart && styles.chatRowRunStart]}>
      {!mine && (
        <View style={[styles.chatAvatar, runEnd && styles.chatAvatarShown]} accessibilityLabel={item.owner}>
          {runEnd && <Text style={styles.chatAvatarText}>{item.owner.charAt(0).toUpperCase()}</Text>}
        </View>
      )}
      <View style={[styles.bubbleCol, mine && { alignItems: 'flex-end' }]}>
        {item.bought ? (
          bubble
        ) : (
          <View>
            <Animated.View style={[styles.swipeAction, { opacity: actionOpacity }]}>
              <Text style={styles.swipeActionText}>✓</Text>
            </Animated.View>
            <Animated.View style={{ transform: [{ translateX }] }} {...swipe.panHandlers}>
              {bubble}
            </Animated.View>
          </View>
        )}
        <View style={styles.bubbleFoot}>
          <Text style={styles.bubbleFootText}>{time}</Text>
          {item.bought && <Text style={[styles.bubbleFootText, styles.bubbleBought]}>{t('main.boughtStatus')}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, paddingTop: 24, paddingBottom: 120 },

  partnerSection: { marginBottom: 24 },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  partnerInfoCard: { borderColor: 'rgba(236, 72, 153, 0.2)' },
  inviteCard: { borderColor: 'rgba(236, 72, 153, 0.4)', borderStyle: 'dashed' },
  partnerAvatar: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarEmoji: { fontSize: 22 },
  partnerDetails: { gap: 2, flexShrink: 1 },
  inviteDetails: { gap: 2, flex: 1 },
  partnerLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  partnerName: { fontFamily: fonts.bold, fontSize: 17.6, color: colors.text },
  partnerEmail: { fontFamily: fonts.regular, fontSize: 12.8, color: colors.textMuted },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  inviteUrl: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: colors.textMuted,
    fontSize: 13.6,
    fontFamily: 'monospace',
  },
  copyBtn: { paddingVertical: 6, paddingHorizontal: 16, backgroundColor: colors.accent, borderRadius: 8, justifyContent: 'center' },
  copyBtnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 13.6 },

  controls: { gap: 16, marginBottom: 24 },
  search: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  // Whose items: both, yours (pink) or your partner's (violet), like the chat sides
  whoFilter: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  whoFilterBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 20 },
  whoFilterAll: { backgroundColor: colors.accent2 },
  whoFilterMe: { backgroundColor: colors.accent },
  whoFilterPartner: { backgroundColor: colors.partner },
  whoFilterText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  filterTabs: { gap: 8, paddingBottom: 4 },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: colors.accent,
    boxShadow: '0 2px 10px rgba(236, 72, 153, 0.2)',
  },
  filterTabText: { fontFamily: fonts.semibold, fontSize: 13.6, color: colors.textMuted },
  hideBought: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#fff', fontSize: 11, lineHeight: 13, fontFamily: fonts.bold },
  hideBoughtText: { fontFamily: fonts.regular, fontSize: 13.6, color: colors.textMuted },

  // The list as a conversation: your items on the right, your partner's on the left
  chatDay: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 6 },
  chatDayLine: { flex: 1, height: 1, backgroundColor: colors.border },
  chatDayText: {
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  chatRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4 },
  chatRowMine: { justifyContent: 'flex-end' },
  chatRowRunStart: { marginTop: 14 },
  // The partner's initial, on the last bubble of their run, level with the bubble above its time
  chatAvatar: { width: 30, height: 30, borderRadius: 15, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  chatAvatarShown: { backgroundColor: colors.partner, boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)' },
  chatAvatarText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  bubbleCol: { maxWidth: '82%', flexShrink: 1 },
  bubble: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, gap: 4 },
  bubbleMine: { borderColor: 'rgba(236, 72, 153, 0.25)' },
  bubbleTheirs: { backgroundColor: colors.surface, borderColor: colors.border },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  bubbleActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  // Time under the bubble, and a "read receipt" once bought
  bubbleFoot: { flexDirection: 'row', gap: 8, marginTop: 4, marginHorizontal: 6 },
  bubbleFootText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  bubbleBought: { fontFamily: fonts.semibold, color: colors.success },
  swipeAction: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 18,
    backgroundColor: colors.success,
    borderRadius: 20,
  },
  swipeActionText: { fontFamily: fonts.bold, fontSize: 18, color: '#fff' },
  // Who wants it: pink for her, blue for him
  who: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  whoGirl: { backgroundColor: 'rgba(236, 72, 153, 0.12)', borderColor: 'rgba(236, 72, 153, 0.35)' },
  whoBoy: { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.35)' },
  whoIcon: { fontSize: 16, lineHeight: 20 },
  itemName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, flexShrink: 1 },
  itemNameBought: { textDecorationLine: 'line-through', color: colors.textMuted },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: TYPE_COLOR + '22',
    borderColor: TYPE_COLOR + '55',
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 11.2, color: TYPE_COLOR, textTransform: 'uppercase', letterSpacing: 0.56 },
  subInfo: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  metaText: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  metaAccent: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent2 },
  itemLink: { marginTop: 6, fontFamily: fonts.regular, fontSize: 12.5, color: colors.accent2 },
  buyBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  buyBtnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#2f552f' },
  scheduleBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  scheduleBtnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent },
  nextDateChip: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    color: colors.accent,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingVertical: 1,
    paddingHorizontal: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  // The Restaurant tab's next date, opens the calendar
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  dateBannerIcon: { fontSize: 28 },
  dateBannerText: { flex: 1, gap: 1 },
  dateBannerLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  dateBannerWhen: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.accent },
  dateBannerCta: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginLeft: 'auto' },
  deleteBtnText: { fontSize: 17.6, color: colors.textMuted },

  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 28px rgba(236, 72, 153, 0.45)',
  },
  fabText: { color: '#fff', fontSize: 29, lineHeight: 32 },

  modalText: { fontFamily: fonts.semibold, fontSize: 17.6, color: colors.text, textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  modalCancel: { backgroundColor: colors.surface2, borderColor: colors.border },
  modalConfirm: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.4)' },
  modalBtnText: { fontFamily: fonts.semibold, fontSize: 15 },
});
