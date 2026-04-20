import { FallDetectionProvider } from '@/context/FallDetectionContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function ElderlyStackLayout() {
    return (
        <FallDetectionProvider>
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="medication-add" />
                <Stack.Screen name="medication-edit" />
                <Stack.Screen name="medication-history" />
                <Stack.Screen name="medication-manage" />
                <Stack.Screen name="fall-detection-debug" />
            </Stack>
        </FallDetectionProvider>
    );
}
