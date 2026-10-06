// frontend/src/pages/AuthPage.jsx
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../api/client';
import { useAuth } from '../auth';
import { Spinner } from '../components/ui';
import { colors, fonts } from '../theme';

export default function LoginScreen() {
  const { signIn, expired, clearExpired } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(expired ? 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.' : '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    clearExpired();
    if (!username || !password || (mode === 'signup' && !email)) {
      setError('Vui lòng điền đầy đủ thông tin.'); // the web form's `required` does this
      return;
    }
    setLoading(true);

    try {
      if (mode === 'login') {
        const response = await client.post('/api/auth/login', { username, password });
        if (response.data.success || response.status === 200) {
          await signIn(username); // the layout then shows the list
        }
      } else {
        const response = await client.post('/api/auth/signup', { username, email, password });
        if (response.status === 201 || response.data.success) {
          setMode('login');
          setError('Đăng ký thành công! Hãy đăng nhập.');
          setPassword('');
        }
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(mode === 'login' ? 'Đăng nhập thất bại. Kiểm tra lại tài khoản.' : 'Đăng ký thất bại. Vui lòng thử lại.');
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

  const success = error.includes('thành công');
  const inputStyle = (value) => [styles.input, error && !success && !value && styles.inputError];

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.brandIcon}>🎀</Text>
              <Text style={styles.title}>EmIuMuaGi</Text>
              <Text style={styles.subtitle}>
                {mode === 'login' ? 'Em ấy bắt mua đồ hỏoo' : 'Tạo tài khoản mới để bắt đầu.'}
              </Text>
            </View>

            <View style={styles.tabs}>
              {[
                ['login', 'Đăng Nhập'],
                ['signup', 'Đăng Ký'],
              ].map(([value, label]) => (
                <Pressable key={value} style={[styles.tab, mode === value && styles.tabActive]} onPress={() => setMode(value)}>
                  <Text style={[styles.tabText, mode === value && styles.tabTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tên đăng nhập</Text>
                <TextInput
                  style={inputStyle(username)}
                  placeholder="Username…"
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {mode === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
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
                <Text style={styles.label}>Mật khẩu</Text>
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

              {!!error && <Text style={[styles.error, success && { color: colors.success }]}>{error}</Text>}

              <Pressable style={[styles.submit, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner color="#fff" />
                    <Text style={styles.submitText}>Đang xử lý...</Text>
                  </>
                ) : (
                  <Text style={styles.submitText}>{mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.footer}>
              {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
              <Text style={styles.link} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
              </Text>
            </Text>
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
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted },
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
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, marginTop: -4 },
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
  link: { color: colors.accent, fontFamily: fonts.semibold },
});
