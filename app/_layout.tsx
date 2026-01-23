import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/providers/AuthProvider';
import { Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold, useFonts } from '@expo-google-fonts/poppins';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle Notifications
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(async response => {
      const actionId = response.actionIdentifier;
      const { medId } = response.notification.request.content.data;
      const notificationDate = response.notification.date; // timestamp

      if (actionId === 'TAKEN' || actionId === 'SKIP') {
        const status = actionId === 'TAKEN' ? 'taken' : 'skipped';
        // Need to insert into medication_logs
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Improve: Find the schedule ID properly. For now we just log it. 
        // We might not have schedule ID easily here without querying. 
        // But we have medId.
        // Let's query the active schedule for this med.

        const { data: schedules } = await supabase
          .from('medication_schedules')
          .select('id')
          .eq('med_id', medId)
          .limit(1);

        const scheduleId = schedules?.[0]?.id;
        if (!scheduleId) return;

        // Insert Log
        await supabase.from('medication_logs').insert({
          patient_id: user.id,
          med_id: medId,
          schedule_id: scheduleId,
          status: status,
          scheduled_at: new Date(notificationDate * 1000).toISOString(), // rough estimate
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