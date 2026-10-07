// The "Em iu đánh giáaa" form for one purchase: a 1-5 score and a few words.
// Rendered only while open, so every opening starts from a fresh form.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../theme';
import { ModalCard } from './ui';

export default function RatingModal(props) {
  return (
    <ModalCard visible onRequestClose={props.onCancel} width={400}>
      <RatingForm {...props} />
    </ModalCard>
  );
}

// The form alone, for a dialog that's already open (the main list's buy dialog
// turns into it: iOS won't open a second dialog while the first is closing)
export function RatingForm({ itemName, cancelLabel = 'Hủy', onCancel, onSubmit }) {
  const [form, setForm] = useState({ score: 5, content: '' });

  return (
    <>
      <Text style={styles.title}>Em iu đánh giáaa</Text>
      <Text style={styles.text}>
        Viết vài dòng cảm nhận về <Text style={{ fontFamily: fonts.bold }}>{itemName}</Text> luôn để em biết nhaaa!
      </Text>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Chấm điểm (1-5 sao):</Text>
          {/* The web takes a typed 1-5; on a phone the stars are tapped */}
          <View style={styles.starPicker}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setForm((f) => ({ ...f, score: n }))} hitSlop={6} accessibilityLabel={`${n} sao`}>
                <Text style={styles.star}>{n <= form.score ? '★' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Cảm nhận của em:</Text>
          <TextInput
            style={styles.input}
            value={form.content}
            onChangeText={(content) => setForm((f) => ({ ...f, content }))}
            placeholder="Quá chuẩn lun..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
          <Text style={[styles.btnText, { color: colors.text }]}>{cancelLabel}</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.confirm]} onPress={() => onSubmit(form)}>
          <Text style={[styles.btnText, { color: '#fff' }]}>Gửi Đánh Giá</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 22.4, color: colors.text, textAlign: 'center', marginBottom: 12 },
  text: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  form: { gap: 20, marginBottom: 24 },
  field: { gap: 8 },
  label: { fontFamily: fonts.semibold, fontSize: 14.4, color: colors.text },
  starPicker: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 30, color: '#fbbf24' },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  confirm: { backgroundColor: colors.accent },
  btnText: { fontFamily: fonts.bold, fontSize: 15 },
});
