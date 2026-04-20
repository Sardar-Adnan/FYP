import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/providers/AuthProvider';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

// ─── MUST be registered at app start, before any notification arrives ───────
// shouldPlaySound is FALSE because we play our custom WAV manually
// via playAlertSound() in the listener below. If we set true here,
// Android would play the default "ding" sound instead of our custom one.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});


SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Play custom sound when a notification is received while app is in foreground
  // SKIP if the background service already played it (fromBackground flag)
  useEffect(() => {


    const receivedListener = Notifications.addNotificationReceivedListener(async (notification) => {
      const title = notification.request.content.title || 'No title';
      const data = notification.request.content.data || {};


      // If the background service fired this, it already played the sound
      if (data.fromBackground) {

        return;
      }

      // For all other notifications (native scheduled, fall detection, etc.)

      try {
        const { playAlertSound } = await import('@/utils/notifications');
        await playAlertSound();

      } catch (e) {
        console.error('[NOTIF] ❌ Failed to play alert sound:', e);
      }
    });



    return () => {
      receivedListener.remove();
    };
  }, []);

  // Handle notification action buttons (Taken / Skip)
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data || {};
      const { medId } = data;
      const notificationDate = response.notification.date; // timestamp

      if (actionId === 'TAKEN' || actionId === 'SKIP') {
        const status = actionId === 'TAKEN' ? 'taken' : 'skipped';
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Use scheduleId from notification data (added in notifications.ts)
        const scheduleId = data.scheduleId;
        if (!scheduleId) {
          console.error('Missing scheduleId in notification data');
          return;
        }

        // Insert Log
        await supabase.from('medication_logs').insert({
          patient_id: user.id,
          med_id: medId,
          schedule_id: scheduleId,
          status: status,
          scheduled_at: new Date(notificationDate * 1000).toISOString(),
          taken_at: status === 'taken' ? new Date().toISOString() : null
        });
      }
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  if (!fontsLoaded) return null;


  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F8FAFC' }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="elderly" />
        <Stack.Screen name="caregiver" />
      </Stack>
    </AuthProvider>
  );
}