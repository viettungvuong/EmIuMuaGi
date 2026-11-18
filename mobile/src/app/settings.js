// frontend/src/pages/SettingsPage.jsx: pick the app's language, change the
// password, delete the account
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { useAuth } from '../auth';
import { ModalCard, Spinner } from '../components/ui';
import { LANGUAGES, serverText, t, useLanguage } from '../i18n';
import { colors, fonts, radius } from '../theme';

// .password-input-wrapper: the input with its show/hide button
function PasswordField({ label, placeholder, value, onChangeText, textContentType }) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
        />
        <Pressable
          style={styles.toggle}
          onPress={() => setShown(!shown)}
          accessibilityLabel={shown ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.toggleText}>{shown ? '🙈' : '👁️'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Someone who signs in with Google, Apple or Facebook may have no password:
  // they set one instead of changing it, and delete the account without one
  const [me, setMe] = useState(null);
  const hasPassword = me?.has_password ?? true;
  useEffect(() => {
    client.get('/api/me').then(({ data }) => setMe(data), (err) => console.error('Failed to fetch user data:', err));
  }, []);

  const { signOut } = useAuth();
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Gone for good on the server (items, dates, the partner link too); then the
  // same local sign-out as the header's button, which lands on the login screen
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await client.delete('/api/me', { data: { password: deletePassword } });
      setConfirmDelete(false);
      await signOut();
    } catch (err) {
      setConfirmDelete(false);
      setDeleteError(err.response?.data?.error ? serverText(err.response.data.error) : t('common.somethingWrong'));
    } finally {
      setDeleting(false);
    }
  };

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');

    if ((hasPassword && !oldPassword.trim()) || !newPassword.trim()) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }
    if (hasPassword && oldPassword === newPassword) {
      setError(t('settings.passwordSameAsOld'));
      return;
    }

    setLoading(true);
    try {
      await client.post('/api/auth/change-password', { oldPassword, newPassword });
      setSuccess(hasPassword ? t('settings.passwordChanged') : t('settings.passwordSet'));
      setMe((m) => m && { ...m, has_password: true });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.response?.data?.error) {
        setError(serverText(err.response.data.error));
      } else if (err.response?.data?.message) {
        setError(serverText(err.response.data.message));
      } else {
        setError(t('common.somethingWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = (!hasPassword || !!oldPassword) && !!newPassword && !!confirmPassword;

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {LANGUAGES.map(({ code, flag, name }) => {
              const active = code === language;
              return (
                <Pressable
                  key={code}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => changeLanguage(code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.flag}>{flag}</Text>
                  <Text style={[styles.optionText, active && { color: colors.accent }]}>{name}</Text>
                  {active && <Text style={styles.check}>✓</Text>}
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, styles.sectionGap]}>
            {hasPassword ? t('settings.changePassword') : t('settings.setPassword')}
          </Text>
          <View style={styles.card}>
            {!hasPassword && <Text style={styles.cardNote}>{t('settings.setPasswordInfo', { name: me.id })}</Text>}
            {!!error && <Text style={[styles.message, styles.messageError]}>{error}</Text>}
            {!!success && <Text style={[styles.message, styles.messageSuccess]}>{success}</Text>}

            {hasPassword && (
              <PasswordField
                label={t('settings.oldPassword')}
                placeholder={t('settings.oldPasswordPlaceholder')}
                value={oldPassword}
                onChangeText={setOldPassword}
                textContentType="password"
              />
            )}
            <PasswordField
              label={t('settings.newPassword')}
              placeholder={t('settings.newPasswordPlaceholder')}
              value={newPassword}
              onChangeText={setNewPassword}
              textContentType="newPassword"
            />
            <PasswordField
              label={t('settings.confirmPassword')}
              placeholder={t('settings.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              textContentType="newPassword"
            />

            <Pressable
              style={[styles.submit, (loading || !canSubmit) && { opacity: 0.6 }]}
              onPress={handlePasswordChange}
              disabled={loading || !canSubmit}
            >
              {loading ? (
                <Spinner color="#fff" />
              ) : (
                <Text style={styles.submitText}>{hasPassword ? t('settings.updatePasswordBtn') : t('settings.setPasswordBtn')}</Text>
              )}
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, styles.sectionGap, { color: colors.danger }]}>{t('settings.deleteAccount')}</Text>
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.cardNote}>{t('settings.deleteAccountInfo')}</Text>
            {!!deleteError && <Text style={[styles.message, styles.messageError]}>{deleteError}</Text>}
            {hasPassword && (
              <PasswordField
                label={t('settings.deleteAccountPassword')}
                placeholder={t('settings.oldPasswordPlaceholder')}
                value={deletePassword}
                onChangeText={setDeletePassword}
                textContentType="password"
              />
            )}
            <Pressable
              style={[styles.submit, styles.deleteBtn, hasPassword && !deletePassword && { opacity: 0.6 }]}
              onPress={() => setConfirmDelete(true)}
              disabled={hasPassword && !deletePassword}
            >
              <Text style={styles.submitText}>{t('settings.deleteAccountBtn')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ModalCard visible={confirmDelete} onRequestClose={() => !deleting && setConfirmDelete(false)}>
        <Text style={styles.modalTitle}>{t('settings.deleteAccountConfirmTitle')}</Text>
        <Text style={styles.modalText}>{t('settings.deleteAccountConfirm')}</Text>
        <View style={styles.modalActions}>
          <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setConfirmDelete(false)} disabled={deleting}>
            <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable style={[styles.modalBtn, styles.modalDelete, deleting && { opacity: 0.6 }]} onPress={handleDeleteAccount} disabled={deleting}>
            {deleting ? <Spinner color={colors.danger} /> : <Text style={[styles.modalBtnText, { color: colors.danger }]}>{t('settings.deleteAccountYes')}</Text>}
          </Pressable>
        </View>
      </ModalCard>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  // Same header as the history screen
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
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.accent2 },
  container: { padding: 16, paddingTop: 24, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionGap: { marginTop: 32 },
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: 'rgba(236, 72, 153, 0.06)' },
  flag: { fontSize: 30 },
  optionText: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  check: { fontFamily: fonts.bold, fontSize: 18, color: colors.accent },
  // .password-change-card
  card: {
    gap: 16,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  message: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.sm,
    fontSize: 14,
    overflow: 'hidden',
  },
  messageError: {
    backgroundColor: 'rgba(255, 77, 109, 0.1)',
    borderColor: 'rgba(255, 77, 109, 0.3)',
    color: colors.danger,
    fontFamily: fonts.medium,
  },
  messageSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    color: colors.success,
    fontFamily: fonts.semibold,
  },
  inputGroup: { gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginLeft: 4 },
  inputWrapper: { justifyContent: 'center' },
  input: {
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 48,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  toggle: { position: 'absolute', right: 6, padding: 8 },
  toggleText: { fontSize: 17 },
  submit: {
    marginTop: 8,
    padding: 13,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  dangerCard: { borderColor: 'rgba(255, 77, 109, 0.35)' },
  cardNote: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  deleteBtn: { marginTop: 0, backgroundColor: colors.danger },
  // The main screen's "did you buy it?" dialog, with a red confirm
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center', marginBottom: 8 },
  modalText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  modalCancel: { backgroundColor: colors.surface2, borderColor: colors.border },
  modalDelete: { backgroundColor: 'rgba(255, 77, 109, 0.12)', borderColor: 'rgba(255, 77, 109, 0.4)' },
  modalBtnText: { fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center' },
});
