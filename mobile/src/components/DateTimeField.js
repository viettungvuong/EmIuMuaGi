// A day and time to pick (an item's deadline / time to buy on the Add screen): a
// field that opens the phone's own picker, with × to clear it. iOS shows the
// picker in a sheet; Android asks for the day, then the time.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { dateLocale, t } from '../i18n';
import { formatAt } from '../schedule';
import { colors, fonts, radius } from '../theme';

// A fresh pick starts on the next full hour
function nextHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

const withTime = (day, time) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes());

export default function DateTimeField({ icon, value, placeholder, onChange, style, pickedStyle, textStyle }) {
  const [draft, setDraft] = useState(null); // iOS: the time in the open sheet

  const open = () => {
    const start = value || nextHour();
    if (Platform.OS !== 'android') {
      setDraft(start);
      return;
    }
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      minimumDate: new Date(),
      onValueChange: (_, day) =>
        DateTimePickerAndroid.open({
          value: start,
          mode: 'time',
          is24Hour: true,
          onValueChange: (__, time) => onChange(withTime(day, time)),
        }),
    });
  };

  const done = () => {
    onChange(draft);
    setDraft(null);
  };

  return (
    <>
      <Pressable style={[style, styles.field, value && pickedStyle]} onPress={open}>
        <Text style={[textStyle, styles.text, !value && { color: colors.textMuted }]} numberOfLines={1}>
          {icon} {value ? formatAt(value) : placeholder}
        </Text>
        {value && (
          <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityLabel={t('common.remove')}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        )}
      </Pressable>

      {draft && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDraft(null)}>
          <Pressable style={styles.overlay} onPress={() => setDraft(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="inline"
                minimumDate={new Date()}
                locale={dateLocale()}
                accentColor={colors.accent}
                themeVariant="light"
                onValueChange={(_, d) => setDraft(d)}
              />
              <View style={styles.buttons}>
                <Pressable style={styles.button} onPress={() => setDraft(null)}>
                  <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.doneButton]} onPress={done}>
                  <Text style={styles.doneText}>{t('common.done')}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  text: { flexShrink: 1 },
  clear: { fontSize: 20, lineHeight: 22, color: colors.textMuted },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  doneButton: { backgroundColor: colors.accent },
  cancelText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  doneText: { fontFamily: fonts.semibold, fontSize: 15, color: '#fff' },
});
