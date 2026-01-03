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
      }}
    >
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: 'Care Dashboard',
          headerLeft: () => null, // Hide back button on dashboard
        }} 
      />
      <Stack.Screen 
        name="pending" 
        options={{ 
          title: 'Verification Pending',
          headerLeft: () => null, // Hide back button so they can't escape
        }} 
      />
    </Stack>
  );
}