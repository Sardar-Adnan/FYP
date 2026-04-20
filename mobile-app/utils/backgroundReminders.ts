/**
 * Background Medication Reminder Checker
 * 
 * Called every 60 seconds by the BackgroundFallDetection service.
 * Reads the upcoming medication events from AsyncStorage and:
 * 1. Plays the custom alert sound via expo-av (guaranteed to work)
 * 2. Fires an immediate Heads-Up notification
 * 
 * This bypasses Android's unreliable scheduled notification sound
 * by using the always-alive Foreground Service to trigger directly.
 */

import { CHANNEL_ID, MED_EVENTS_STORAGE_KEY, playAlertSound } from '@/utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

interface StoredMedEvent {
    key: string;
    timeMs: number;
    timeISO: string;
    meds: { id: string; name: string; scheduleId: string }[];
    body: string;
    fired: boolean;
}

/**
 * Check if any medication reminders are due RIGHT NOW.
 * Called every 60 seconds from the background service loop.
 */
export async function checkMedicationReminders(): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(MED_EVENTS_STORAGE_KEY);
        if (!raw) return; // No events stored

        const events: StoredMedEvent[] = JSON.parse(raw);
        if (events.length === 0) return;

        const now = Date.now();
        let changed = false;

        for (const event of events) {
            // Skip already-fired events
            if (event.fired) continue;

            // Check if it's time (allow 90 second window so we don't miss by a few seconds)
            if (now >= event.timeMs && now - event.timeMs < 90000) {
                console.log(`[BG-MED] 🔔 Medication due NOW: ${event.body}`);

                // 1. Play the custom WAV sound directly (guaranteed to work!)
                try {
                    await playAlertSound();
                    console.log('[BG-MED] 🔊 Alert sound played successfully');
                } catch (e) {
                    console.error('[BG-MED] ❌ Failed to play sound:', e);
                }

                // 2. Fire an IMMEDIATE Heads-Up notification (visible over other apps)
                try {
                    const medIds = event.meds.map(m => m.id);
                    await Notifications.scheduleNotificationAsync({
                        identifier: `bg-med-${event.key}`,
                        content: {
                            title: '💊 Medication Reminder',
                            body: event.body,
                            data: {
                                medIds,
                                type: 'main',
                                scheduledAt: event.timeISO,
                                fromBackground: true, // Mark so _layout.tsx knows not to double-play sound
                            },
                            categoryIdentifier: 'MEDICATION_ACTION',
                            priority: Notifications.AndroidNotificationPriority.MAX,
                            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
                        },
                        trigger: null, // IMMEDIATE — fires right now
                    });
                    console.log(`[BG-MED] 📬 Heads-Up notification fired for: ${event.key}`);
                } catch (e) {
                    console.error('[BG-MED] ❌ Failed to fire notification:', e);
                }

                // Mark as fired so we don't double-alert
                event.fired = true;
                changed = true;
            }
        }

        if (changed) {
            // Clean up: remove events older than 2 hours
            const cutoff = now - 2 * 60 * 60 * 1000;
            const cleaned = events.filter(e => !e.fired || e.timeMs > cutoff);
            await AsyncStorage.setItem(MED_EVENTS_STORAGE_KEY, JSON.stringify(cleaned));
            console.log(`[BG-MED] 💾 Updated storage (${cleaned.length} events remaining)`);
        }
    } catch (e) {
        console.error('[BG-MED] ❌ Error checking medication reminders:', e);
    }
}
