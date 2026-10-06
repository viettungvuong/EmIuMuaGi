// frontend/src/pages/AddPage.jsx
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { WS_URL } from '../api/config';
import { GradientButton, Select } from '../components/ui';
import { colors, fonts, radius } from '../theme';

const ITEM_TYPES = [
  { value: 'clothes', label: '👕 Quần Áo' },
  { value: 'food_and_drink', label: '🧋 Đồ Ăn & Uống' },
  { value: 'restaurant', label: '🍜 Nhà Hàng' },
  { value: 'others', label: '📦 Khác' },
];

const TIME_TO_EAT_OPTIONS = [
  { value: 'pick_date', label: 'Chọn ngày' },
  { value: 'auto_schedule', label: 'Tự động lên lịch' },
];

// How long the link has to stay unchanged before it is sent to the parser
const PARSE_DEBOUNCE_MS = 500;

// A TikTok video or share link: the server looks up where it was filmed
const isTikTokLink = (url) => {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    if (host === 'vt.tiktok.com' || host === 'vm.tiktok.com') return pathname.length > 1;
    return (host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /\/video\/\d+|^\/t\/\w/.test(pathname);
  } catch {
    return false;
  }
};

// A Google Maps place or share link: the server reads the address off the page
// (mirrors is_maps_link in the ai-service)
const isMapsLink = (url) => {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    const host = hostname.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    if (host === 'maps.app.goo.gl') return pathname.length > 1;
    if (host === 'goo.gl') return pathname.startsWith('/maps');
    if (!/^(www\.|maps\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)) return false;
    return host.startsWith('maps.') || pathname.startsWith('/maps');
  } catch {
    return false;
  }
};

// Links the server takes a few seconds to answer for: where the answer comes from
const slowLinkSource = (url) => (isTikTokLink(url) ? 'TikTok' : isMapsLink(url) ? 'Google Maps' : null);

function sendLink(ws, seqRef, url) {
  seqRef.current += 1;
  ws.send(JSON.stringify({ seq: seqRef.current, url }));
}

export default function AddScreen() {
  const router = useRouter();
  // Made up front: names the parser channel now, saved as the item's uuid later
  const [itemUuid] = useState(() => Crypto.randomUUID());
  const [itemType, setItemType] = useState('clothes');
  const [form, setForm] = useState({
    item_name: '', quantity: '1', shop_name: '', buy_url: '',
    // clothes
    size: '', color: '', brand: '',
    // food_and_drink
    sugar: '', notes: '', toppings: '',
    // restaurant
    main_food: '', cuisine_type: '', address: '', time_to_eat: '',
    // others
    category: '',
  });
  const [mediaFiles, setMediaFiles] = useState([]); // { uri, name, mimeType, type }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const seqRef = useRef(0); // seq of the latest link sent, older answers are ignored
  const latestUrlRef = useRef(''); // link waiting for the socket to open
  const lastSentRef = useRef(''); // so a pasted link isn't sent again by the debounce
  const autoRef = useRef({}); // field -> value the parser last filled in
  const [lookingUp, setLookingUp] = useState(null); // "TikTok" / "Google Maps" while a slow lookup is on its way

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Fill fields from a parser answer, leaving alone anything the user typed themselves
  const autofill = useCallback((values) => {
    // Snapshot taken outside the updater, which React may run twice
    const filledBefore = { ...autoRef.current };
    setForm((f) => {
      const next = { ...f };
      for (const [field, value] of Object.entries(values)) {
        if (value && (!f[field] || f[field] === filledBefore[field])) next[field] = value;
      }
      return next;
    });
    for (const [field, value] of Object.entries(values)) {
      if (value) autoRef.current[field] = value;
    }
  }, []);

  const queueLink = useCallback((url) => {
    if (url === lastSentRef.current) return;
    latestUrlRef.current = url;
    const ws = socketRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return; // onopen sends it
    lastSentRef.current = url;
    setLookingUp(slowLinkSource(url));
    sendLink(ws, seqRef, url);
  }, []);

  // One long-lived parser channel for this item, closed when the screen is left
  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/api/parse/ws/${itemUuid}`);
    socketRef.current = ws;

    ws.onopen = () => {
      if (latestUrlRef.current) queueLink(latestUrlRef.current);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.seq !== seqRef.current) return;
      setLookingUp(null);

      const r = msg.result;
      if (!r) return;
      // "link" answers carry item_name, "tiktok" / "maps" ones a place
      autofill({
        item_name: r.item_name ?? r.place_name,
        address: r.address,
        cuisine_type: r.place_type,
      });
    };

    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [itemUuid, queueLink, autofill]);

  // Once the user stops typing the link, send it down the channel
  useEffect(() => {
    const url = form.buy_url.trim();
    if (!url) return;

    const timer = setTimeout(() => queueLink(url), PARSE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.buy_url, queueLink]);

  const onLinkChange = (text) => {
    const wasEmpty = !form.buy_url.trim();
    setForm((f) => ({ ...f, buy_url: text }));

    if (!text.trim()) {
      // Link cleared: ignore whatever answer is still on its way
      seqRef.current += 1;
      latestUrlRef.current = '';
      lastSentRef.current = '';
      setLookingUp(null);
    } else if (wasEmpty && slowLinkSource(text.trim())) {
      // A whole TikTok / Maps link landing in the empty field at once is a paste
      // (React Native has no paste event): send it now, no debounce
      queueLink(text.trim());
    }
  };

  const set = (field) => (text) => setForm((f) => ({ ...f, [field]: text }));

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    const picked = result.assets.map((a, i) => {
      const isVideo = a.type === 'video';
      return {
        uri: a.uri,
        type: isVideo ? 'video' : 'image',
        mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: a.fileName || `${Date.now()}-${i}.${isVideo ? 'mp4' : 'jpg'}`,
      };
    });
    setMediaFiles((prev) => [...prev, ...picked]);
  };

  const removeMedia = (index) => setMediaFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!form.item_name.trim()) {
      setError('Vui lòng nhập tên.');
      return;
    }
    setLoading(true);
    setError('');

    const base = {
      uuid: itemUuid,
      item_type: itemType,
      item_name: form.item_name.trim(),
      quantity: Number(form.quantity) || 1,
      shop_name: form.shop_name.trim() || null,
      buy_url: form.buy_url.trim() || null,
    };

    const subtypeFields =
      itemType === 'clothes'
        ? { size: form.size || null, color: form.color || null, brand: form.brand || null }
        : itemType === 'food_and_drink'
        ? {
            sugar: form.sugar || null,
            notes: form.notes || null,
            toppings: form.toppings ? form.toppings.split(',').map((t) => t.trim()).filter(Boolean) : null,
          }
        : itemType === 'restaurant'
        ? {
            main_food: form.main_food || null,
            cuisine_type: form.cuisine_type || null,
            address: form.address || null,
            time_to_eat: form.time_to_eat || null,
          }
        : { category: form.category || null };

    try {
      // 1. Create the item
      const itemRes = await client.post('/api/items', { ...base, ...subtypeFields });
      const itemId = itemRes.data.id;

      // The item exists now, so its parser channel is done
      socketRef.current?.close();

      // 2. Upload media files if any
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        // React Native's FormData takes { uri, name, type } in place of a File
        mediaFiles.forEach((m) => formData.append('files', { uri: m.uri, name: m.name, type: m.mimeType }));

        const uploadRes = await client.post(`/api/items/${itemId}/files`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const taskIds = uploadRes.data.task_ids || [];

        // 3. Wait for the server to finish processing them
        if (taskIds.length > 0) {
          const pendingTasks = new Set(taskIds);

          while (pendingTasks.size > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1500));

            for (const taskId of pendingTasks) {
              try {
                const statusRes = await client.get(`/api/items/${itemId}/tasks/${taskId}`);
                const { status } = statusRes.data;
                if (status === 'completed' || status === 'failed') {
                  pendingTasks.delete(taskId);
                }
              } catch (err) {
                // A 404 means it was already cleared or failed, so stop waiting on it
                if (err.response?.status === 404) {
                  pendingTasks.delete(taskId);
                }
              }
            }
          }
        }
      }

      goHome();
    } catch {
      setError('Thêm mục hoặc tải lên thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, props = {}, hint) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label} {hint && <Text style={styles.hint}>{hint}</Text>}
      </Text>
      <TextInput
        style={[styles.input, props.multiline && styles.textarea]}
        placeholderTextColor={colors.textMuted}
        value={form[key]}
        onChangeText={set(key)}
        {...props}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Pressable style={styles.backBtn} onPress={goHome}>
                <Text style={styles.backBtnText}>← Quay Lại</Text>
              </Pressable>
              <Pressable style={styles.backBtn} onPress={() => router.push('/question')}>
                <Text style={[styles.backBtnText, { color: colors.accent }]}>Hỏi Đáp →</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>Thêm Mục Mới</Text>

            <View style={styles.form}>
              <View style={styles.typeTabs}>
                {ITEM_TYPES.map((t) => (
                  <Pressable
                    key={t.value}
                    style={[styles.typeTab, itemType === t.value && styles.typeTabActive]}
                    onPress={() => setItemType(t.value)}
                  >
                    {/* White when picked: the web's dark text vanishes on the dark tinted tab */}
                    <Text style={[styles.typeTabText, itemType === t.value && { color: '#fff' }]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Link first so details can be parsed from it */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>
                  Link {lookingUp && <Text style={styles.hint}>(đang lấy địa chỉ từ {lookingUp}…)</Text>}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={itemType === 'restaurant' ? 'Link TikTok, Google Maps…' : 'https://…'}
                  placeholderTextColor={colors.textMuted}
                  value={form.buy_url}
                  onChangeText={onLinkChange}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tên *</Text>
                <TextInput
                  style={[styles.input, error && !form.item_name.trim() && styles.inputError]}
                  placeholder={itemType === 'restaurant' ? 'Tên nhà hàng…' : 'Tên mục…'}
                  placeholderTextColor={colors.textMuted}
                  value={form.item_name}
                  onChangeText={set('item_name')}
                />
              </View>

              {/* Restaurants skip quantity / shop */}
              {itemType !== 'restaurant' && (
                <>
                  {field('Số lượng', 'quantity', { keyboardType: 'number-pad' })}
                  {field('Cửa hàng', 'shop_name', { placeholder: 'Tên cửa hàng…' })}
                </>
              )}

              {itemType === 'clothes' && (
                <>
                  {field('Size', 'size', { placeholder: 'S, M, L…' })}
                  {field('Màu sắc', 'color', { placeholder: 'Xanh, Đỏ…' })}
                  {field('Thương hiệu', 'brand', { placeholder: 'Nike, Zara…' })}
                </>
              )}

              {itemType === 'food_and_drink' && (
                <>
                  {field('Size', 'size', { placeholder: 'S, M, L…' })}
                  {field('Đường', 'sugar', { placeholder: '50%, 100%…' })}
                  {field('Topping', 'toppings', { placeholder: 'boba, thạch, kem…' }, '(phân cách bằng dấu phẩy)')}
                  {field('Ghi chú', 'notes', { placeholder: 'Ít đá, không đường…', multiline: true })}
                </>
              )}

              {itemType === 'restaurant' && (
                <>
                  {field('Món chính', 'main_food', { placeholder: 'Phở, bún bò…' })}
                  {field('Loại ẩm thực', 'cuisine_type', { placeholder: 'Việt, Nhật, Hàn…' })}
                  {field('Địa chỉ', 'address', { placeholder: 'Số nhà, đường, quận…' })}
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Thời gian ăn</Text>
                    <Select
                      value={form.time_to_eat}
                      options={TIME_TO_EAT_OPTIONS}
                      placeholder="Chọn cách hẹn giờ…"
                      onChange={set('time_to_eat')}
                      style={styles.input}
                      textStyle={styles.inputText}
                    />
                  </View>
                </>
              )}

              {itemType === 'others' && field('Danh mục', 'category', { placeholder: 'Nhập danh mục…' })}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Ảnh & Video</Text>
                <Pressable style={styles.dropZone} onPress={pickMedia}>
                  <Text style={styles.dropIcon}>📎</Text>
                  <Text style={styles.dropText}>
                    <Text style={{ color: colors.accent, fontFamily: fonts.bold }}>Bấm để chọn</Text> từ thư viện
                  </Text>
                  <Text style={styles.dropHint}>Hỗ trợ: JPG, PNG, GIF, MP4, MOV…</Text>
                </Pressable>

                {mediaFiles.length > 0 && (
                  <View style={styles.previewGrid}>
                    {mediaFiles.map((m, i) => (
                      <View key={m.uri + i} style={styles.previewItem}>
                        {m.type === 'image' ? (
                          <Image source={{ uri: m.uri }} style={styles.thumb} />
                        ) : (
                          <View style={[styles.thumb, styles.videoThumb]}>
                            <Text style={styles.videoIcon}>🎬</Text>
                          </View>
                        )}
                        <Pressable style={styles.removeBtn} onPress={() => removeMedia(i)} accessibilityLabel="Xóa">
                          <Text style={styles.removeBtnText}>×</Text>
                        </Pressable>
                        {m.type === 'video' && <Text style={styles.videoBadge}>▶</Text>}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <GradientButton title="✓ Thêm Mục" onPress={handleSubmit} loading={loading} style={{ marginTop: 8 }} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pinkPage },
  scroll: { padding: 12 },
  card: {
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 32,
    paddingHorizontal: 20,
    boxShadow: '0 4px 20px rgba(236, 72, 153, 0.08), 0 0 80px rgba(236, 72, 153, 0.1)',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  backBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, color: '#fff', marginBottom: 32 },
  form: { gap: 20 },

  typeTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  typeTab: {
    flexGrow: 1,
    flexBasis: '40%',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  typeTabActive: { borderColor: colors.accent, backgroundColor: 'rgba(236, 72, 153, 0.12)' },
  typeTabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },

  fieldGroup: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.9 },
  hint: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted, textTransform: 'none', letterSpacing: 0 },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  inputText: { color: colors.text, fontFamily: fonts.regular, fontSize: 16 },
  inputError: { borderColor: colors.danger },
  textarea: { minHeight: 110, textAlignVertical: 'top', lineHeight: 25 },

  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
  },
  dropIcon: { fontSize: 29 },
  dropText: { fontFamily: fonts.regular, fontSize: 14.7, color: colors.textMuted },
  dropHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, opacity: 0.7 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  previewItem: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: '100%', height: '100%' },
  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a2440' },
  videoIcon: { fontSize: 26 },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 16, lineHeight: 18 },
  videoBadge: {
    position: 'absolute',
    bottom: 5,
    left: 6,
    fontSize: 10.4,
    color: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 4,
    overflow: 'hidden',
  },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, marginTop: -4 },
});
