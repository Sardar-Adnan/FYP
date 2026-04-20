import { Colors } from '@/constants/Colors';
import { Stack } from 'expo-router';
import React from 'react';

export default function CaregiverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: Colors.background },
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="pending"
        options={{
          title: 'Verification Pending',
          headerShown: true,
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="medication-add"
        options={{
          title: 'Add Medication',
          headerShown: false,
        }}
      />
    </Stack>
  );
}