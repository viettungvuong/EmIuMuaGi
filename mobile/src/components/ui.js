// Building blocks shared by several screens, styled after the web app's CSS
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

export function Spinner({ size = 'small', color = colors.accent }) {
  return <ActivityIndicator size={size} color={color} />;
}

export function LoadingState({ text = 'Đang tải…' }) {
  return (
    <View style={styles.state}>
      <Spinner size="large" />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <View style={styles.state}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

// .modal-overlay + .modal-content
export function ModalCard({ visible, onRequestClose, width = 340, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { width }]}>{children}</View>
      </View>
    </Modal>
  );
}

// .add-submit-btn / .question-submit-btn: accent → accent-2 gradient
export function GradientButton({ title, onPress, disabled, loading, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={[style, (disabled || loading) && { opacity: 0.45 }]}>
      <LinearGradient
        colors={[colors.accent, colors.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientButton}
      >
        {loading ? <Spinner color="#fff" /> : <Text style={styles.gradientButtonText}>{title}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

// The web uses a native <select>; phones get a field that opens a list
export function Select({ value, options, placeholder, onChange, style, textStyle }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable style={[style, styles.selectField]} onPress={() => setOpen(true)}>
        <Text style={[textStyle, !selected && { color: colors.textMuted }]}>{selected ? selected.label : placeholder}</Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.modalCard, styles.selectList]}>
            {[{ value: '', label: placeholder }, ...options].map((o) => (
              <Pressable
                key={o.value}
                style={[styles.selectOption, o.value === value && styles.selectOptionActive]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.selectOptionText, !o.value && { color: colors.textMuted }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// .main-header, shared by the main and partner screens
export function AppHeader({ username, count, onTitlePress, onHistory, onLogout }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle} onPress={onTitlePress}>
          Em Iu<Text style={{ color: colors.accent }}> Muốn Gìiiiii</Text>
        </Text>
        {count !== undefined && <Text style={styles.itemCount}>{count} mục</Text>}
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.welcome} numberOfLines={1}>
          Chào, {username || 'bạn'} 👋
        </Text>
        <View style={styles.headerButtons}>
          <Pressable style={styles.historyBtn} onPress={onHistory}>
            <Text style={styles.historyBtnText}>Lịch Sử</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Đăng Xuất</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 80, paddingHorizontal: 20 },
  stateText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16, textAlign: 'center' },
  emptyIcon: { fontSize: 48 },

  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    maxWidth: '90%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 32,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
  },

  gradientButton: {
    minHeight: 50,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    boxShadow: '0 4px 20px rgba(236, 72, 153, 0.35)',
  },
  gradientButtonText: { color: '#fff', fontSize: 16, fontFamily: fonts.semibold },

  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectChevron: { color: colors.textMuted, fontSize: 14 },
  selectList: { width: 300, padding: 8 },
  selectOption: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.sm },
  selectOptionActive: { backgroundColor: colors.surface2 },
  selectOptionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },

  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
    boxShadow: '0 1px 4px rgba(236, 72, 153, 0.05)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.6, color: colors.text },
  itemCount: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  welcome: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  headerButtons: { flexDirection: 'row', gap: 8 },
  historyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.2)',
    borderRadius: radius.sm,
  },
  historyBtnText: { fontFamily: fonts.semibold, fontSize: 13.6, color: colors.accent },
  logoutBtn: { paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm },
  logoutBtnText: { fontFamily: fonts.regular, fontSize: 13.6, color: colors.textMuted },
});
