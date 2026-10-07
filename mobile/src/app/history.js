// frontend/src/pages/HistoryPage.jsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import RatingModal from '../components/RatingModal';
import { EmptyState, LoadingState } from '../components/ui';
import { colors, fonts, formatDate, radius } from '../theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, historyId: null, itemName: '' });

  const fetchHistories = async () => {
    try {
      const { data } = await client.get('/api/history');
      setHistories(data || []); // null while there's no history yet
    } catch (err) {
      console.error('Failed to fetch histories:', err);
    } finally {
      setLoading(false);
    }
  };

  // Every time the screen shows, so an item bought meanwhile appears
  useFocusEffect(
    useCallback(() => {
      fetchHistories();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistories();
    setRefreshing(false);
  };

  const openReview = (historyId, itemName) => {
    setReviewModal({ isOpen: true, historyId, itemName });
  };

  const closeReview = () => setReviewModal({ isOpen: false, historyId: null, itemName: '' });

  const submitReview = async (reviewForm) => {
    const { historyId } = reviewModal;
    closeReview();
    if (!historyId) return;

    try {
      await client.post(`/api/history/${historyId}/review`, reviewForm);
      fetchHistories(); // show the new review
    } catch (err) {
      console.error('Failed to submit review:', err);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Lịch Sử Mua Đồ</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {loading ? (
          <LoadingState />
        ) : histories.length === 0 ? (
          <EmptyState icon="📭" text="Chưa có lịch sử mua đồ nàooo" />
        ) : (
          <View style={styles.list}>
            {histories.map((history) => (
              <View key={history.id} style={styles.card}>
                {/* .history-card::before, the accent stripe */}
                <View style={styles.stripe} />
                <View style={styles.cardHeader}>
                  <Text style={styles.itemName}>{history.item_name}</Text>
                  <Text style={styles.date}>{history.time ? formatDate(history.time) : 'Không xác định'}</Text>
                </View>

                {history.score !== null ? (
                  <View style={styles.review}>
                    <Text style={styles.stars}>
                      {'★'.repeat(history.score)}
                      {'☆'.repeat(5 - history.score)}
                    </Text>
                    {!!history.content && <Text style={styles.reviewContent}>{`"${history.content}"`}</Text>}
                  </View>
                ) : (
                  <Pressable style={styles.addReviewBtn} onPress={() => openReview(history.id, history.item_name)}>
                    <Text style={styles.addReviewText}>⭐ Đánh giá ngay</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {reviewModal.isOpen && (
        <RatingModal itemName={reviewModal.itemName} onCancel={closeReview} onSubmit={submitReview} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  // The web header is dark navy behind a blur
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(21, 25, 41, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  backBtnText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  // The web fills this with an accent gradient; React Native text can't take one without extra libraries
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.accent2 },
  container: { padding: 16, paddingTop: 20, paddingBottom: 80 },
  list: { gap: 20 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 24,
    gap: 12,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: colors.accent, opacity: 0.6 },
  cardHeader: { gap: 4 },
  itemName: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  date: { fontFamily: fonts.regular, fontSize: 13.6, color: colors.textMuted },
  review: { borderRadius: 12, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  stars: { color: '#fbbf24', fontSize: 17.6, marginBottom: 4 },
  reviewContent: { fontFamily: fonts.regular, fontStyle: 'italic', fontSize: 15, color: colors.textMuted },
  addReviewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  addReviewText: { fontFamily: fonts.semibold, fontSize: 14.4, color: colors.accent },
});
