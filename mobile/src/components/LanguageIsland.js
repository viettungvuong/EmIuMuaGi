// frontend/src/components/LanguageIsland.jsx: the small flag switch floating
// above the sign in / sign up card
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGES, useLanguage } from '../i18n';
import { colors, fonts } from '../theme';

export function LanguageIsland() {
  const { language, changeLanguage } = useLanguage();

  return (
    <View style={styles.island} accessibilityRole="radiogroup" accessibilityLabel="Language / Ngôn ngữ">
      {LANGUAGES.map(({ code, flag, name }) => {
        const active = code === language;
        return (
          <Pressable
            key={code}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => changeLanguage(code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={name}
            hitSlop={4}
          >
            <Text style={styles.flag}>{flag}</Text>
            <Text style={[styles.code, active && { color: '#fff' }]}>{code.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  island: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    boxShadow: '0 6px 20px rgba(236, 72, 153, 0.12)',
  },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  btnActive: { backgroundColor: colors.accent },
  flag: { fontSize: 17 },
  code: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0.5, color: colors.textMuted },
});
