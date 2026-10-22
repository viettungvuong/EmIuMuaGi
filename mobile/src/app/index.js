// frontend/src/pages/MainPage.jsx
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { t, useLanguage } from '../i18n';
import { RatingForm } from '../components/RatingModal';
import { AppHeader, EmptyState, LoadingState, ModalCard } from '../components/ui';
import { colors, fonts, formatDate, radius } from '../theme';

const ITEM_TYPES = ['clothes', 'food_and_drink', 'restaurant', 'others'];
const typeLabel = (type) => (ITEM_TYPES.includes(type) ? t(`types.${type}`) : type);

const TYPE_COLOR = '#cb1d7a';

// How far left a card must be swiped before letting go marks it bought
const SWIPE_TRIGGER = 100;

// What the backend sends as the history ID when it couldn't record the purchase
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function subInfo(item) {
  if (item.item_type === 'clothes') {
    return [item.size, item.color, item.brand].filter(Boolean).join(' · ');
  }
  if (item.item_type === 'food_and_drink') {
    const toppings = item.toppings?.length ? t('main.toppings', { toppings: item.toppings.join(', ') }) : null;
    return [item.size, item.sugar && t('main.sugar', { sugar: item.sugar }), toppings].filter(Boolean).join(' · ');
  }
  if (item.item_type === 'restaurant') {
    return [item.main_food, item.cuisine_type, item.address, item.time_to_eat].filter(Boolean).join(' · ');
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
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideBought, setHideBought] = useState(false);
  const [userData, setUserData] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [confirmItemId, setConfirmItemId] = useState(null);
  const [buying, setBuying] = useState(false);
  // The purchase just made, while its rating form is open: { historyId, name }
  const [ratingPurchase, setRatingPurchase] = useState(null);

  const fetchItems = async () => {
    try {
      const { data } = await client.get('/api/items');
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data } = await client.get('/api/me');
      setUserData(data);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  // Every time the screen shows, so a newly added item appears on returning from Add
  useFocusEffect(
    useCallback(() => {
      fetchItems();
      fetchUserData();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchItems(), fetchUserData()]);
    setRefreshing(false);
  };

  const handleDelete = async (id) => {
    try {
      await client.delete(`/api/items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
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
      setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
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
  const inviteLink = `${WEB_URL}/partner/${userData?.invite_link || ''}`;

  const copyInviteLink = async () => {
    if (!userData?.invite_link) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const filteredItems = items
    .filter((item) => {
      const matchesFilter = filterType === 'all' || item.item_type === filterType;
      const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesHide = hideBought ? !item.bought : true;
      return matchesFilter && matchesSearch && matchesHide;
    })
    // Not bought first, then newest first
    .sort((a, b) => (a.bought === b.bought ? new Date(b.created_at) - new Date(a.created_at) : a.bought ? 1 : -1));

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

            {items.length === 0 ? (
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

                {filteredItems.length === 0 ? (
                  <EmptyState icon="😅" text={t('main.noMatch')} />
                ) : (
                  <View style={styles.list}>
                    {filteredItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        currentUser={currentUser}
                        onBuy={() => setConfirmItemId(item.id)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    ))}
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

function ItemCard({ item, currentUser, onBuy, onDelete }) {
  const info = subInfo(item);

  // Swipe left to buy: the card slides over a green strip, and letting go past
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

  if (item.bought) return <CardBody item={item} info={info} currentUser={currentUser} onBuy={onBuy} onDelete={onDelete} />;

  return (
    <View>
      <Animated.View style={[styles.swipeAction, { opacity: actionOpacity }]}>
        <Text style={styles.swipeActionText}>✓ {t('main.bought')}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...swipe.panHandlers}>
        <CardBody item={item} info={info} currentUser={currentUser} onBuy={onBuy} onDelete={onDelete} />
      </Animated.View>
    </View>
  );
}

function CardBody({ item, info, currentUser, onBuy, onDelete }) {
  return (
    <View style={[styles.card, item.bought && { opacity: 0.6 }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.itemName, item.bought && styles.itemNameBought]}>{item.item_name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeLabel(item.item_type)}</Text>
        </View>
      </View>

      {!!info && <Text style={styles.subInfo}>{info}</Text>}

      <View style={styles.meta}>
        {item.owner && item.owner !== currentUser && <Text style={styles.metaAccent}>💌 {item.owner}</Text>}
        {!!item.shop_name && <Text style={styles.metaText}>🏪 {item.shop_name}</Text>}
        {item.quantity > 1 && <Text style={styles.metaAccent}>x{item.quantity}</Text>}
        <Text style={styles.metaText}>{formatDate(item.created_at)}</Text>
      </View>

      {!!item.buy_url && (
        <Text style={styles.itemLink} onPress={() => Linking.openURL(item.buy_url)}>
          🔗 {item.item_type === 'restaurant' ? t('main.viewRestaurant') : t('main.viewProduct')}
        </Text>
      )}

      <View style={styles.actions}>
        {item.bought ? (
          <View style={styles.boughtBadge}>
            <Text style={styles.boughtBadgeText}>✓</Text>
          </View>
        ) : (
          <Pressable style={styles.buyBtn} onPress={onBuy} accessibilityLabel={t('main.boughtLabel')}>
            <Text style={styles.buyBtnText}>{t('main.bought')}</Text>
          </Pressable>
        )}
        {item.owner === currentUser && (
          <Pressable style={styles.deleteBtn} onPress={onDelete} accessibilityLabel={t('main.deleteLabel')}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </Pressable>
        )}
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

  list: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 4,
  },
  swipeAction: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
    backgroundColor: colors.success,
    borderRadius: radius.lg,
  },
  swipeActionText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  itemName: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, flexShrink: 1 },
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
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  buyBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buyBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: '#2f552f' },
  boughtBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  boughtBadgeText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.success },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
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
