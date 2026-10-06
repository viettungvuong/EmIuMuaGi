// frontend/src/pages/QuestionPage.jsx (also not wired to the backend yet)
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientButton } from '../components/ui';
import { colors, fonts, radius } from '../theme';

export default function QuestionScreen() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = () => {
    if (!question.trim()) return;

    setLoading(true);
    // TODO: Connect to backend API when available, like the web page
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setQuestion('');
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <Text style={styles.backBtnText}>← Quay Lại</Text>
            </Pressable>
            <Text style={styles.title}>Hỏi Đáp</Text>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Câu hỏi của bạn</Text>
                <TextInput
                  style={styles.textarea}
                  placeholder="Nhập câu hỏi tại đây..."
                  placeholderTextColor={colors.textMuted}
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  autoFocus
                />
              </View>

              {success && <Text style={styles.success}>Đã gửi câu hỏi thành công!</Text>}

              <GradientButton
                title="Gửi Câu Hỏi"
                onPress={handleSubmit}
                loading={loading}
                disabled={!question.trim()}
                style={{ marginTop: 8 }}
              />
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
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    marginBottom: 24,
  },
  backBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  // White like the Add title: the web's dark text is unreadable on this dark card
  title: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, color: '#fff', marginBottom: 32 },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.9 },
  textarea: {
    minHeight: 110,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  success: { color: colors.success, fontFamily: fonts.regular, fontSize: 14.4 },
});
