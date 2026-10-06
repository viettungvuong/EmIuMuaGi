// frontend/src/pages/HistoryPage.jsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { EmptyState, LoadingState, ModalCard } from '../components/ui';
import { colors, fonts, formatDate, radius } from '../theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, historyId: null, itemName: '' });
  const [reviewForm, setReviewForm] = useState({ score: 5, content: '' });

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
    setReviewForm({ score: 5, content: '' });
  };

  const closeReview = () => setReviewModal({ isOpen: false, historyId: null, itemName: '' });

  const submitReview = async () => {
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

      <ModalCard visible={reviewModal.isOpen} onRequestClose={closeReview} width={400}>
        <Text style={styles.modalTitle}>Em iu đánh giáaa</Text>
        <Text style={styles.modalText}>
          Viết vài dòng cảm nhận về <Text style={{ fontFamily: fonts.bold }}>{reviewModal.itemName}</Text> luôn để em biết
          nhaaa!
        </Text>

        <View style={styles.reviewForm}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Chấm điểm (1-5 sao):</Text>
            {/* The web takes a typed 1-5; on a phone the stars are tapped */}
            <View style={styles.starPicker}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setReviewForm((f) => ({ ...f, score: n }))} hitSlop={6}>
                  <Text style={styles.starPick}>{n <= reviewForm.score ? '★' : '☆'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Cảm nhận của em:</Text>
            <TextInput
              style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={reviewForm.content}
              onChangeText={(content) => setReviewForm((f) => ({ ...f, content }))}
              placeholder="Quá chuẩn lun..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>
        </View>

        <View style={styles.modalActions}>
          <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={closeReview}>
            <Text style={[styles.modalBtnText, { color: colors.text }]}>Hủy</Text>
          </Pressable>
          <Pressable style={[styles.modalBtn, styles.modalConfirm]} onPress={submitReview}>
            <Text style={[styles.modalBtnText, { color: '#fff' }]}>Gửi Đánh Giá</Text>
          </Pressable>
        </View>
      </ModalCard>
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

  modalTitle: { fontFamily: fonts.bold, fontSize: 22.4, color: colors.text, textAlign: 'center', marginBottom: 12 },
  modalText: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  reviewForm: { gap: 20, marginBottom: 24 },
  formField: { gap: 8 },
  formLabel: { fontFamily: fonts.semibold, fontSize: 14.4, color: colors.text },
  starPicker: { flexDirection: 'row', gap: 8 },
  starPick: { fontSize: 30, color: '#fbbf24' },
  formInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  modalCancel: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  modalConfirm: { backgroundColor: colors.accent },
  modalBtnText: { fontFamily: fonts.bold, fontSize: 15 },
});
