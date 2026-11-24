// One import per weight: importing from the package root would bundle all 18 Poppins files.
import { Poppins_300Light } from '@expo-google-fonts/poppins/300Light';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockGate } from '@/components/lock/LockGate';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RecordsProvider } from '@/context/RecordsContext';
import { StockProvider } from '@/context/StockContext';
import { colors } from '@/theme';

// Keep the native splash screen up until the fonts and the saved session are ready, so the first frame is never half-drawn.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // A font error is not fatal: the system font is used instead rather than leaving the app stuck on the splash screen.
  const ready = (fontsLoaded || fontError !== null) && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink }, animation: 'fade' }}>
      {/* The app: only for a signed-in user. Everyone else is sent to the login screen. */}
      <Stack.Protected guard={user !== null} redirectTo="/login">
        <Stack.Screen name="index" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="stock" />
        <Stack.Screen name="record" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/* The login screen: only for someone who is signed out. */}
      <Stack.Protected guard={user === null} redirectTo="/">
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RecordsProvider>
          <StockProvider>
            <StatusBar style="light" />
            <LockGate>
              <RootNavigator />
            </LockGate>
          </StockProvider>
        </RecordsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
