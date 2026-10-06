import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from '../auth';
import { Spinner } from '../components/ui';
import { colors } from '../theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return (
    <AuthProvider>
      <Routes fontsReady={fontsLoaded || !!fontError} />
    </AuthProvider>
  );
}

function Routes({ fontsReady }) {
  const { isAuth, checking } = useAuth();

  // The web app's "🎀 Checking..." screen while /api/me answers
  if (checking || !fontsReady) {
    return (
      <View style={styles.checking}>
        <StatusBar style="light" />
        <Spinner size="large" />
        <Text style={styles.checkingText}>🎀 Checking...</Text>
      </View>
    );
  }

  // Like the web's ProtectedRoute: logged out, every screen but login sends you
  // to login; logged in, login sends you to the list
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={isAuth}>
          <Stack.Screen name="index" />
          <Stack.Screen name="add" />
          <Stack.Screen name="question" />
          <Stack.Screen name="history" />
          <Stack.Screen name="partner/[inviteID]" />
        </Stack.Protected>
        <Stack.Protected guard={!isAuth}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  checking: { flex: 1, backgroundColor: colors.splash, alignItems: 'center', justifyContent: 'center', gap: 16 },
  checkingText: { color: colors.accent2, fontSize: 16 },
});
