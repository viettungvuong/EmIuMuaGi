// frontend/src/pages/AuthPage.jsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { useAuth } from '../auth';
import { LanguageIsland } from '../components/LanguageIsland';
import { Spinner } from '../components/ui';
import { serverText, t, useLanguage } from '../i18n';
import { colors, fonts } from '../theme';

// Mistakes the user fixes right here (a wrong or expired code, a taken username
// or email), shown larger so they aren't missed. As the server words them.
const BIG_ERRORS = ['Invalid or expired OTP', 'Username or Email already exists'];

export default function LoginScreen() {
  useLanguage(); // redraw in a newly picked language
  const { signIn, expired, clearExpired } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'signup', or 'verify' (entering the emailed OTP)
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(expired ? t('auth.sessionExpired') : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    clearExpired();
    if (!username || !password || (mode === 'signup' && !email)) {
      setError(t('auth.fillAll')); // the web form's `required` does this
      return;
    }
    if (mode === 'verify' && otp.length !== 6) {
      setError(t('auth.otpLength')); // the web input's `pattern` does this
      return;
    }
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await client.post('/api/auth/login', { username, password });
        if (response.data.success || response.status === 200) {
          await signIn(username); // the layout then shows the list
        }
      } else if (mode === 'signup') {
        // This only emails a code; the account is created once the code is entered
        const response = await client.post('/api/auth/signup', { username, email, password });
        if (response.status === 201 || response.data.success) {
          setOtp('');
          setMode('verify');
        }
      } else {
        const response = await client.post('/api/auth/signup/verify', { username, email, password, otp });
        if (response.status === 201 || response.data.success) {
          setMode('login');
          setError(t('auth.signupSuccess'));
          setPassword('');
          setOtp('');
        }
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(serverText(err.response.data.error));
      } else if (err.response?.data?.message) {
        setError(serverText(err.response.data.message));
      } else if (mode === 'verify') {
        setError(t('auth.verifyFailed'));
      } else {
        setError(mode === 'login' ? t('auth.loginFailed') : t('auth.signupFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  // A new code, for when the first one never arrived or has expired
  const resendOtp = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await client.post('/api/auth/signup', { username, email, password });
      setOtp('');
      setError(t('auth.codeResent'));
    } catch (err) {
      setError(serverText(err.response?.data?.error) || t('auth.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Back to the signup form, still filled in, e.g. to fix a mistyped email
  const backToSignup = () => {
    setMode('signup');
    setError('');
    setOtp('');
  };

  // Success notes share the error line, in green
  const success = error === t('auth.signupSuccess') || error === t('auth.codeResent');
  const big = BIG_ERRORS.some((message) => error === serverText(message));
  const inputStyle = (value) => [styles.input, error && !success && !value && styles.inputError];

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LanguageIsland />
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.brandIcon}>🎀</Text>
              <Text style={styles.title}>EmIuMuaGi</Text>
              <Text style={styles.subtitle}>
                {mode === 'verify' ? (
                  t('auth.verifySubtitle', { email: <Text style={styles.subtitleEmail}>{email}</Text> })
                ) : mode === 'login' ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
              </Text>
            </View>

            {mode !== 'verify' && (
              <View style={styles.tabs}>
                {[
                  ['login', t('auth.login')],
                  ['signup', t('auth.signup')],
                ].map(([value, label]) => (
                  <Pressable key={value} style={[styles.tab, mode === value && styles.tabActive]} onPress={() => setMode(value)}>
                    <Text style={[styles.tabText, mode === value && styles.tabTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.form}>
              {mode === 'verify' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.otp')}</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="••••••"
                    placeholderTextColor={colors.textMuted}
                    value={otp}
                    onChangeText={(text) => setOtp(text.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoFocus
                    onSubmitEditing={handleSubmit}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('auth.username')}</Text>
                    <TextInput
                      style={inputStyle(username)}
                      placeholder={t('auth.usernamePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {mode === 'signup' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>{t('auth.email')}</Text>
                      <TextInput
                        style={inputStyle(email)}
                        placeholder="email@example.com"
                        placeholderTextColor={colors.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('auth.password')}</Text>
                    <TextInput
                      style={inputStyle(password)}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </>
              )}

              {!!error && (
                <Text style={[styles.error, big && styles.errorBig, success && { color: colors.success }]}>
                  {error}
                </Text>
              )}

              <Pressable style={[styles.submit, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner color="#fff" />
                    <Text style={styles.submitText}>{t('auth.processing')}</Text>
                  </>
                ) : (
                  <Text style={styles.submitText}>
                    {mode === 'login' ? t('auth.login') : mode === 'signup' ? t('auth.signup') : t('auth.confirm')}
                  </Text>
                )}
              </Pressable>
            </View>

            {mode === 'verify' ? (
              <>
                <Text style={styles.footer}>
                  {t('auth.noCode')}{' '}
                  <Text style={styles.link} onPress={resendOtp}>
                    {t('auth.resend')}
                  </Text>
                </Text>
                <Text style={[styles.footer, styles.footerSecond]}>
                  {t('auth.wrongEmail')}{' '}
                  <Text style={styles.link} onPress={backToSignup}>
                    {t('auth.goBack')}
                  </Text>
                </Text>
              </>
            ) : (
              <Text style={styles.footer}>
                {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
                <Text style={styles.link} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                  {mode === 'login' ? t('auth.signupNow') : t('auth.loginLink')}
                </Text>
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  brandIcon: { fontSize: 48, marginBottom: 16 },
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.text, marginBottom: 8, letterSpacing: -0.75 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  subtitleEmail: { fontFamily: fonts.semibold, color: colors.text },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface2, padding: 4, borderRadius: 12, marginBottom: 32 },
  tab: { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  tabTextActive: { color: colors.accent },
  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginLeft: 4 },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  // One box for the whole code, so pasting it or letting iOS fill it in works
  otpInput: { textAlign: 'center', fontFamily: fonts.bold, fontSize: 24, letterSpacing: 12 },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, marginTop: -4 },
  errorBig: { fontFamily: fonts.semibold, fontSize: 17 },
  submit: {
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
  },
  submitText: { color: '#fff', fontFamily: fonts.bold, fontSize: 16 },
  footer: { marginTop: 24, textAlign: 'center', fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  footerSecond: { marginTop: 8 },
  link: { color: colors.accent, fontFamily: fonts.semibold },
});
