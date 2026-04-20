import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Alert, AppState, Linking, Platform } from 'react-native';

// Key used to store upcoming med events for the background service polling
export const MED_EVENTS_STORAGE_KEY = '@upcoming_med_events';

export async function playAlertSound() {
    try {
        // Set audio mode so sound plays even in background / silent mode
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true, // Required for background service playback
            shouldDuckAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
            require('../assets/sounds/medication_alert.wav')
        );
        await sound.playAsync();
        // Unload after playback to free memory
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync();
            }
        });
    } catch (error: any) {
        // Gracefully handle background audio focus failures —
        // the notification channel sound will still play via Android OS
        if (error?.code === 'ERR_AUDIO_AUDIOMODE' || 
            error?.message?.includes('AudioFocusNotAcquiredException')) {
            console.warn('[NOTIF] ⚠️ Cannot play sound in background (audio focus denied). Notification channel sound will handle it.');
        } else {
            console.error('[NOTIF] Error playing sound:', error);
        }
    }
}

// Current channel version — bump this if you need to change sound/importance
const CHANNEL_ID = 'medication-reminders-v6';

export { CHANNEL_ID };

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        // Delete ALL old channels to force recreation with correct sound
        const oldChannels = [
            'medication-reminders',
            'medication-reminders-v2',
            'medication-reminders-v3',
            'medication-reminders-v4',
            'medication-reminders-v5',
        ];
        for (const ch of oldChannels) {
            try { await Notifications.deleteNotificationChannelAsync(ch); } catch (e) { /* Ignore */ }
        }

        // Create new channel with custom sound
        const channelResult = await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Medication Reminders',
            description: 'Reminders to take your medications on time',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'medication_alert', // Must match res/raw/medication_alert.wav (no extension)
            enableVibrate: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
        });
        console.log('[CHANNEL] Created channel:', JSON.stringify(channelResult, null, 2));

        // Verify the channel actually has the correct sound
        const verify = await Notifications.getNotificationChannelAsync(CHANNEL_ID);
        console.log('[CHANNEL] Verified sound:', verify?.sound);
        console.log('[CHANNEL] Verified importance:', verify?.importance);
    }

    // Request notification permission (Android 13+ requires POST_NOTIFICATIONS)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        Alert.alert(
            'Notification Permission Required',
            'Without notification permission, medication reminders will not appear. Please enable notifications in Settings.',
            [
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
        return false;
    }

    console.log('[NOTIF] Notification permission granted');
    return true;
}

// Helper to get next 7 days dates for specific weekdays
function getUpcomingDates(days: number[], hour: number, minute: number): Date[] {
    const dates: Date[] = [];
    const now = new Date();

    // Check next 7 days to ensure weekly medications always get scheduled
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        d.setHours(hour, minute, 0, 0);

        // JS day: 0=Sun, 6=Sat
        const dayIndex = d.getDay();

        // Ensure type match: database may return strings like ["3"] but dayIndex is number
        const numericDays = days.map(d => Number(d));

        if (numericDays.includes(dayIndex)) {
            // If today, only schedule if time is still in the future
            if (i === 0 && d <= now) continue;
            dates.push(d);
        }
    }
    return dates;
}


// Helper to group medications by time
function groupSchedulesByTime(schedules: any[]) {
    const groups: { [key: string]: any[] } = {};
    schedules.forEach(s => {
        const key = `${s.days_of_week.join(',')}-${s.reminder_time}`; // Simple grouping key
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });
    return groups;
}

/**
 * Check if exact alarm permission is granted on Android 12+.
 * Shows alert and redirects to settings if not granted.
 */
export async function checkExactAlarmPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    // Android 12+ (API 31+) requires explicit permission
    // The canScheduleExactAlarms property is Android-specific and not in TypeScript types
    const permissions = await Notifications.getPermissionsAsync() as any;
    const canScheduleExactAlarms = permissions.canScheduleExactAlarms;
    
    if (canScheduleExactAlarms === false) {
        Alert.alert(
            'Permission Required',
            'To receive medication reminders at the exact scheduled time, please enable "Alarms & Reminders" permission in Settings.',
            [
                { 
                    text: 'Open Settings', 
                    onPress: async () => {
                        try {
                            // Try to use expo-intent-launcher if available (requires rebuild)
                            const IntentLauncher = await import('expo-intent-launcher');
                            await IntentLauncher.startActivityAsync(
                                IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM
                            );
                        } catch (e) {
                            // Fallback: open general app settings
                            Linking.openSettings();
                        }
                    }
                },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
        return false;
    }
    return true;
}

export async function resyncNotifications() {
    console.log('[RESYNC] ▶ Starting resyncNotifications...');

    // Check notification permission
    const notifPermission = await registerForPushNotificationsAsync();
    if (!notifPermission) {
        console.error('[RESYNC] ❌ Notification permission denied — aborting');
        return;
    }

    // Check exact alarm permission (Android 12+)
    const alarmPermission = await checkExactAlarmPermission();
    if (!alarmPermission) {
        console.warn('[RESYNC] ⚠️ Exact alarm permission not granted. Continuing anyway...');
    }

    try {
        // 1. Cancel All Existing
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('[RESYNC] 🗑️ Cancelled all existing scheduled notifications');

        // 2. Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!user) {
            console.error('[RESYNC] ❌ No user logged in — aborting');
            return;
        }
        console.log(`[RESYNC] 👤 User: ${user.id} (${user.email})`);

        // 3. Fetch active medications for this user
        const { data: meds, error: medsError } = await supabase
            .from('medications')
            .select('id, name')
            .eq('patient_id', user.id)
            .eq('is_active', true);

        if (medsError) {
            console.error('[RESYNC] ❌ Failed to fetch medications:', medsError.message);
            return;
        }

        console.log(`[RESYNC] 💊 Active medications found: ${meds?.length ?? 0}`);
        meds?.forEach(m => console.log(`[RESYNC]   - ${m.name} (${m.id})`));

        if (!meds || meds.length === 0) {
            console.warn('[RESYNC] ⚠️ No active medications — nothing to schedule');
            return;
        }

        // 4. Fetch schedules for those medications
        const medIds = meds.map(m => m.id);
        const medNameMap = Object.fromEntries(meds.map(m => [m.id, m.name]));

        const { data: schedules, error: schedError } = await supabase
            .from('medication_schedules')
            .select('*')
            .in('med_id', medIds);

        if (schedError) {
            console.error('[RESYNC] ❌ Failed to fetch schedules:', schedError.message);
            return;
        }

        console.log(`[RESYNC] ⏰ Schedules found: ${schedules?.length ?? 0}`);
        schedules?.forEach(s => {
            const name = medNameMap[s.med_id] || s.med_id;
            console.log(`[RESYNC]   - ${name}: time=${s.reminder_time} days=[${s.days_of_week}]`);
        });

        if (!schedules || schedules.length === 0) {
            console.warn('[RESYNC] ⚠️ No schedules found for active meds — nothing to schedule');
            return;
        }

        // 5. Group schedules by time slot
        const eventBucket: { [dateStr: string]: { time: Date, meds: { id: string, name: string, scheduleId: string }[] } } = {};

        let totalScheduled = 0;
        for (const s of schedules) {
            const [h, m] = s.reminder_time.split(':').map(Number);
            const days = s.days_of_week;
            const numericDays = days.map((d: any) => Number(d));
            const medName = medNameMap[s.med_id] || s.med_id;
            const dates = getUpcomingDates(numericDays, h, m);

            console.log(`[RESYNC] 📅 ${medName} @ ${s.reminder_time} days=[${numericDays}] → ${dates.length} upcoming date(s)`);
            if (dates.length === 0) {
                const now = new Date();
                console.warn(`[RESYNC]   ⚠️ No future dates found. Today is day ${now.getDay()} (${now.toLocaleDateString()}), time now is ${now.toLocaleTimeString()}`);
            }

            for (const d of dates) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hour = String(d.getHours()).padStart(2, '0');
                const minute = String(d.getMinutes()).padStart(2, '0');
                
                const key = `${year}-${month}-${day}-${hour}-${minute}`; 

                if (!eventBucket[key]) {
                    eventBucket[key] = { time: d, meds: [] };
                }
                eventBucket[key].meds.push({
                    id: s.med_id, 
                    name: medNameMap[s.med_id] || 'Unknown',
                    scheduleId: s.id
                });
            }
        }

        // 4. Schedule Follow-Up Notifications
        // NOTE: The MAIN reminder is now fired by the native FallDetectionForegroundService
        // via 10-second polling (much more precise than scheduled notifications).
        // We only schedule the 30min warning and 45min auto-miss here.
        for (const [timeKey, event] of Object.entries(eventBucket)) {
            const names = event.meds.map(m => m.name).join(', ');
            const medIds = event.meds.map(m => m.id);
            const count = event.meds.length;
            const body = count === 1
                ? `It's time to take your ${names}`
                : `It's time to take ${count} medications: ${names}`;

            const baseId = `group-${timeKey}`; // Unique per time slot

            // B. Individual Warnings (Keep separate to allow individual 'Taken' cancelling)
            // We schedule these separately so we can cancel "Aspirin Warning" if Aspirin is taken,
            // without killing "Vitamin C Warning".
            for (const med of event.meds) {
                const medBaseId = `${med.id}-${timeKey}`; // Legacy ID format for individual cancelling

                // +30 Min Warning
                await Notifications.scheduleNotificationAsync({
                    identifier: `${medBaseId}-30m`,
                    content: {
                        title: '⚠️ No Response Submitted',
                        body: `You haven't marked ${med.name} as taken yet.`,
                        sound: 'medication_alert.wav',
                        data: { medId: med.id, scheduleId: med.scheduleId, type: 'warning', scheduledAt: event.time.toISOString() },
                        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
                    },
                    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(event.time.getTime() + 30 * 60000) },
                });

                // +45 Min Final
                await Notifications.scheduleNotificationAsync({
                    identifier: `${medBaseId}-45m`,
                    content: {
                        title: '❌ Medication Auto-Submitted',
                        body: `We've marked ${med.name} as missed for safety.`,
                        sound: 'medication_alert.wav',
                        data: { medId: med.id, scheduleId: med.scheduleId, type: 'auto', scheduledAt: event.time.toISOString() },
                        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
                    },
                    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(event.time.getTime() + 45 * 60000) },
                });
            }
            totalScheduled++; // One main slot scheduled
        }

        console.log(`[RESYNC] ✅ Done. Notification time slots processed: ${totalScheduled}`);
        const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`[RESYNC] 📬 Verified count in system queue: ${allScheduled.length}`);

        // ── Save event queue to AsyncStorage + native SharedPreferences ──
        const storageEvents = Object.entries(eventBucket).map(([key, event]) => ({
            key,
            timeMs: event.time.getTime(),
            timeISO: event.time.toISOString(),
            meds: event.meds,
            body: event.meds.length === 1
                ? `It's time to take your ${event.meds[0].name}`
                : `It's time to take ${event.meds.length} medications: ${event.meds.map(m => m.name).join(', ')}`,
            fired: false,
        })).sort((a, b) => a.timeMs - b.timeMs);

        const eventsJsonStr = JSON.stringify(storageEvents);
        await AsyncStorage.setItem(MED_EVENTS_STORAGE_KEY, eventsJsonStr);

        // Sync to native SharedPreferences for the foreground service
        try {
            const { NativeFallDetection } = require('@/services/NativeFallDetection');
            NativeFallDetection.setMedicationEvents(eventsJsonStr);
            console.log(`[RESYNC] 💾 Synced ${storageEvents.length} events to native service`);
        } catch (e) {
            console.warn('[RESYNC] ⚠️ Could not sync to native service (not available)');
        }
        console.log(`[RESYNC] 💾 Saved ${storageEvents.length} events to AsyncStorage`);

    } catch (e: any) {
        console.error('[RESYNC] ❌ Resync failed with error:', e?.message || e);
    }
}

// Deprecated: Wraps resync for legacy calls
export async function scheduleMedicationReminder(
    medId: string, medName: string, hours: number, minutes: number, days: number[]
) {
    return resyncNotifications();
}


export async function logAllScheduledNotifications() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const nowLocal = new Date().toLocaleString();

    // Alert the count and top 3 for quick check
    let msg = `Device Time: ${nowLocal}\nTotal Scheduled: ${scheduled.length}\n`;
    scheduled.slice(0, 3).forEach((n, i) => {
        const trigger = n.trigger as any;
        const date = trigger.date ? new Date(trigger.date).toLocaleTimeString() : 'N/A';
        // Check for Android channelId in the request object directly or implementation-specific location
        const channel = (n.content as any).channelId || 'Default (Not Found)';
        msg += `\n[${i}] ${date}: ${n.content.body}\n(Ch: ${channel})`;
    });

    if (scheduled.length > 3) msg += `\n...and ${scheduled.length - 3} more.`;

    // Also console log for full details
    console.log("=== ALL SCHEDULED NOTIFICATIONS ===");
    console.log(`Device Now: ${nowLocal}`);
    console.log(`Total Count: ${scheduled.length}`);
    scheduled.forEach((n, i) => {
        const trigger = n.trigger as any;
        const date = trigger.date ? new Date(trigger.date).toLocaleString() : 'N/A';
        console.log(`[${i}] Time: ${date} | Body: ${n.content.body} | Channel: ${(n.content as any).channelId}`);
    });
    console.log("===================================");

    alert(msg);
}

export async function cancelRemindersForDose(medId: string, scheduledDateStr: string) {
    // Reconstruct the IDs we created
    // The scheduledDateStr comes from the DB log "scheduled_at" or the item logic
    // It should match the ISO string used in creation.
    // However, ISO strings might vary by ms or timezone if not careful.
    // We generated ID using: date.toISOString().
    // We need to ensure we reconstruct exactly.

    // Strategy: Cancel anything vaguely matching that time?
    // Or just robust ID matching.

    // NOTE: If date formats differ (e.g. from DB vs generated), this is brittle.
    // Better: Fetch all notifications, filter by data.medId and data.scheduledAt ~ close match.

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const targetDate = new Date(scheduledDateStr).getTime();

    for (const n of scheduled) {
        if (n.content.data?.medId === medId) {
            const notifDateStr = n.content.data?.scheduledAt;
            if (notifDateStr) {
                const notifTime = new Date(notifDateStr as string).getTime();
                // If within 1 minute match (safe buffer)
                if (Math.abs(notifTime - targetDate) < 60000) {
                    await Notifications.cancelScheduledNotificationAsync(n.identifier);
                    console.log('Cancelled notification:', n.identifier);
                }
            }
        }
    }
}

/**
 * COMPREHENSIVE DEBUG FUNCTION
 * Call this to diagnose exactly where notification scheduling fails
 */
export async function debugNotifications(): Promise<string> {
    const logs: string[] = [];
    const log = (msg: string) => {
        console.log(`[DEBUG] ${msg}`);
        logs.push(msg);
    };

    try {
        log(`📱 Device Time: ${new Date().toLocaleString()}`);
        log(`📱 Platform: ${Platform.OS} ${Platform.Version}`);

        // Step 1: Check notification permission
        const permStatus = await Notifications.getPermissionsAsync();
        log(`\n🔑 PERMISSIONS:`);
        log(`   Status: ${permStatus.status}`);
        log(`   Granted: ${permStatus.granted}`);
        if (Platform.OS === 'android') {
            log(`   canScheduleExactAlarms: ${(permStatus as any).canScheduleExactAlarms}`);
        }

        if (permStatus.status !== 'granted') {
            log(`❌ Notification permission NOT granted!`);
            return logs.join('\n');
        }

        // Step 2: Check user
        const { data: { user } } = await supabase.auth.getUser();
        log(`\n👤 USER:`);
        if (!user) {
            log(`❌ No user logged in!`);
            return logs.join('\n');
        }
        log(`   ID: ${user.id}`);
        log(`   Email: ${user.email}`);

        // Step 3: Fetch medications
        log(`\n💊 MEDICATIONS:`);
        const { data: meds, error: medsError } = await supabase
            .from('medications')
            .select('id, name, is_active')
            .eq('patient_id', user.id);

        if (medsError) {
            log(`❌ Error fetching: ${medsError.message}`);
            return logs.join('\n');
        }

        log(`   Total in DB: ${meds?.length || 0}`);
        meds?.forEach(m => log(`   - ${m.name} (active: ${m.is_active})`));

        const activeMeds = meds?.filter(m => m.is_active) || [];
        log(`   Active meds: ${activeMeds.length}`);

        if (activeMeds.length === 0) {
            log(`⚠️ No active medications found!`);
            return logs.join('\n');
        }

        // Step 4: Fetch schedules
        log(`\n⏰ SCHEDULES:`);
        const medIds = activeMeds.map(m => m.id);
        const { data: schedules, error: schedError } = await supabase
            .from('medication_schedules')
            .select('*')
            .in('med_id', medIds);

        if (schedError) {
            log(`❌ Error fetching: ${schedError.message}`);
            return logs.join('\n');
        }

        log(`   Total schedules: ${schedules?.length || 0}`);
        schedules?.forEach(s => {
            const medName = activeMeds.find(m => m.id === s.med_id)?.name || 'Unknown';
            log(`   - ${medName}: ${s.reminder_time} on days [${s.days_of_week.join(',')}]`);
        });

        if (!schedules || schedules.length === 0) {
            log(`⚠️ No schedules found for active meds!`);
            return logs.join('\n');
        }

        // Step 5: Check upcoming dates
        log(`\n📅 UPCOMING NOTIFICATIONS:`);
        const today = new Date();
        log(`   Today is: ${today.toLocaleDateString()} (day ${today.getDay()})`);
        
        let upcomingCount = 0;
        for (const s of schedules) {
            const [h, m] = s.reminder_time.split(':').map(Number);
            const days = s.days_of_week.map(Number);
            const medName = activeMeds.find(med => med.id === s.med_id)?.name || 'Unknown';
            
            // Check next 3 days
            for (let i = 0; i < 3; i++) {
                const d = new Date();
                d.setDate(today.getDate() + i);
                d.setHours(h, m, 0, 0);
                const dayIndex = d.getDay();
                
                if (days.includes(dayIndex)) {
                    if (i === 0 && d <= today) {
                        log(`   ⏭️ ${medName} @ ${s.reminder_time} - SKIPPED (past)`);
                    } else {
                        log(`   ✅ ${medName} @ ${d.toLocaleString()}`);
                        upcomingCount++;
                    }
                }
            }
        }
        log(`   Total upcoming: ${upcomingCount}`);

        // Step 6: Check currently scheduled notifications
        log(`\n📬 CURRENTLY SCHEDULED:`);
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        log(`   Count: ${scheduled.length}`);
        scheduled.slice(0, 5).forEach((n, i) => {
            const trigger = n.trigger as any;
            const triggerDate = trigger?.date ? new Date(trigger.date).toLocaleString() : 'N/A';
            log(`   [${i}] ${triggerDate} - ${n.content.body?.substring(0, 40)}...`);
        });

        if (scheduled.length === 0 && upcomingCount > 0) {
            log(`\n⚠️ PROBLEM: Schedules exist but NO notifications scheduled!`);
            log(`   → Calling resyncNotifications() now...`);
            await resyncNotifications();
            const afterResync = await Notifications.getAllScheduledNotificationsAsync();
            log(`   After resync: ${afterResync.length} notifications`);
        }

        log(`\n✅ Debug complete!`);

    } catch (e: any) {
        log(`\n❌ ERROR: ${e.message}`);
    }

    return logs.join('\n');
}
