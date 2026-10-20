// frontend/src/pages/SettingsPage.jsx: pick the app's language
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LANGUAGES, t, useLanguage } from '../i18n';
import { colors, fonts, radius } from '../theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { language, changeLanguage } = useLanguage();

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.backBtnText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
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
      </ScrollView>
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
  container: { padding: 16, paddingTop: 24 },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 12,
    marginLeft: 4,
  },
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
});
