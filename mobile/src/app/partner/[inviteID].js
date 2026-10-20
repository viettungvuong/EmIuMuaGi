// frontend/src/pages/PartnerPage.jsx — opened from an invite link
// (https://<web app>/partner/<id> in a browser, or emiumuagi://partner/<id> in the app)
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import client from '../../api/client';
import { useAuth } from '../../auth';
import { AppHeader, LoadingState } from '../../components/ui';
import { serverText, t, useLanguage } from '../../i18n';
import { colors, fonts } from '../../theme';

const Bold = ({ children }) => <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{children}</Text>;

// Every way a link can fail, keyed by the code the user service sends back.
// title/text/cta are keys into locales/*.json; {email} in the text shows in bold.
const OUTCOMES = {
  success: { variant: 'success', icon: '👫', title: 'partner.successTitle', text: 'partner.successText', cta: 'partner.successCta' },
  already_linked: { variant: 'success', icon: '💕', title: 'partner.linkedTitle', text: 'partner.linkedText', cta: 'common.home' },
  already_partnered: {
    variant: 'already-partner',
    icon: '💔',
    title: 'partner.partneredTitle',
    text: 'partner.partneredText',
    textNoEmail: 'partner.partneredTextNoEmail',
    cta: 'common.goHome',
  },
  partner_taken: { variant: 'already-partner', icon: '🥀', title: 'partner.takenTitle', cta: 'common.goHome' },
  self_link: { variant: 'already-partner', icon: '🪞', title: 'partner.selfTitle', cta: 'common.goHome' },
  invite_not_found: { variant: 'error', icon: '🔗', title: 'partner.inviteGoneTitle', cta: 'common.goHome' },
};

function subtext(outcome, email) {
  if (!email && outcome.textNoEmail) return t(outcome.textNoEmail);
  return t(outcome.text, { email: <Bold>{email}</Bold> });
}

const CARD_BORDER = { success: colors.accent, 'already-partner': '#555', error: 'rgba(255, 77, 109, 0.3)' };

export default function PartnerScreen() {
  useLanguage(); // redraw in a newly picked language
  const { inviteID } = useLocalSearchParams();
  const router = useRouter();
  const { username, signOut } = useAuth();
  const [status, setStatus] = useState('loading');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const linkPartner = async () => {
      try {
        // Someone who already has a partner cannot take another one, so say that
        // outright instead of firing a request that can only be refused
        const { data: me } = await client.get('/api/me');
        if (me?.partner_id) {
          setPartnerEmail(me.partner?.email || '');
          setStatus('already_partnered');
          return;
        }
      } catch {
        // Not fatal, let the link request below decide (a dead session is handled by the client)
      }

      try {
        const { data } = await client.post(`/api/partner/add/${inviteID}`);
        setPartnerEmail(data.partner_email);
        setStatus(data.already_linked ? 'already_linked' : 'success');
      } catch (err) {
        const code = err.response?.data?.code;
        if (OUTCOMES[code]) {
          setStatus(code);
        } else {
          setStatus('error');
          setMessage(serverText(err.response?.data?.error) || t('common.somethingWrong'));
        }
      }
    };

    if (inviteID) linkPartner();
  }, [inviteID]);

  const goHome = () => router.replace('/');
  const outcome = OUTCOMES[status];

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <AppHeader username={username} onTitlePress={goHome} onHistory={() => router.push('/history')} onLogout={signOut} />

      <ScrollView contentContainerStyle={styles.container}>
        {status === 'loading' ? (
          <LoadingState text={t('common.checking')} />
        ) : (
          <View style={[styles.card, { borderColor: CARD_BORDER[outcome?.variant ?? 'error'] }]}>
            {status === 'success' && <Text style={styles.banner}>{t('partner.welcome')}</Text>}
            <Text style={styles.icon}>{outcome?.icon ?? '⚠️'}</Text>
            <Text style={[styles.message, outcome?.variant === 'already-partner' && { color: '#aaa' }]}>
              {outcome ? t(outcome.title) : message}
            </Text>
            {outcome?.text && <Text style={styles.subtext}>{subtext(outcome, partnerEmail)}</Text>}
            <Pressable style={styles.homeBtn} onPress={goHome}>
              <Text style={styles.homeBtnText}>{t(outcome?.cta ?? 'common.goHome')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 48 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15)',
  },
  banner: { color: colors.accent, fontFamily: fonts.bold, textTransform: 'uppercase', letterSpacing: 1.4, fontSize: 14.4, marginBottom: 24 },
  icon: { fontSize: 64, marginBottom: 24 },
  // The web uses white here (on a white card); dark text keeps it readable
  message: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, textAlign: 'center', marginBottom: 16 },
  subtext: { fontFamily: fonts.regular, fontSize: 17.6, lineHeight: 28, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  homeBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    backgroundColor: colors.accent,
    borderRadius: 14,
    boxShadow: '0 4px 20px rgba(236, 72, 153, 0.3)',
  },
  homeBtnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 17.6 },
});
