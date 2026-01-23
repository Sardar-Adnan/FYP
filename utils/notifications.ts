import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
        // Create a NEW channel for the custom sound to take effect
        await Notifications.setNotificationChannelAsync('medication-reminders-custom', {
            name: 'Medication Reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'medication_alert.wav', // Custom sound file
        });

        // Android 13+ requires explicit permission
        if (Platform.Version >= 33) {
            const { PermissionsAndroid } = require('react-native');
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                return false;
            }
        }
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return false;
    }
    return true;
}

// Helper to get next 7 days dates for specific weekdays
function getUpcomingDates(days: number[], hour: number, minute: number): Date[] {
    const dates: Date[] = [];
    const now = new Date();

    // Check next 7 days
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        d.setHours(hour, minute, 0, 0);

        // Supabase/JS day: 0=Sun, 6=Sat
        const dayIndex = d.getDay();

        if (days.includes(dayIndex)) {
            // If today, only schedule if time is in future
            if (i === 0 && d <= now) continue;
            dates.push(d);
        }
    }
    return dates;
}

export async function scheduleMedicationReminder(
    medId: string,
    medName: string,
    hours: number,
    minutes: number,
    days: number[]
) {
    const permission = await registerForPushNotificationsAsync();
    if (!permission) return;

    // 1. Cancel existing future notifications for this med to allow "rescheduling"
    // (We do this by tag/category if possible, or just simplistic generic cancel for now)
    // For this implementation, we will rely on unique IDs to overwrite or native handling.

    const upcomingDates = getUpcomingDates(days, hours, minutes);

    for (const date of upcomingDates) {
        const baseId = `${medId}-${date.toISOString()}`;

        // 1. Main Reminder (Time T)
        await Notifications.scheduleNotificationAsync({
            identifier: `${baseId}-main`,
            content: {
                title: 'Medication Reminder',
                body: `It's time to take your ${medName}`,
                sound: 'medication_alert.wav',
                data: { medId, type: 'main', scheduledAt: date.toISOString() },
                categoryIdentifier: 'MEDICATION_ACTION',
                ...(Platform.OS === 'android' ? { channelId: 'medication-reminders-custom' } : {}),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: date },
        });

        // 2. +30 Min Warning (Time T+30m)
        const date30 = new Date(date.getTime() + 30 * 60000);
        await Notifications.scheduleNotificationAsync({
            identifier: `${baseId}-30m`,
            content: {
                title: 'No Response Submitted',
                body: `You haven't marked ${medName} as taken yet.`,
                sound: 'medication_alert.wav',
                data: { medId, type: 'warning', scheduledAt: date.toISOString() },
                ...(Platform.OS === 'android' ? { channelId: 'medication-reminders-custom' } : {}),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: date30 },
        });

        // 3. +45 Min Final (Time T+45m)
        const date45 = new Date(date.getTime() + 45 * 60000);
        await Notifications.scheduleNotificationAsync({
            identifier: `${baseId}-45m`,
            content: {
                title: 'Medication Auto-Submitted',
                body: `We've marked ${medName} as missed for safety.`,
                sound: 'medication_alert.wav',
                data: { medId, type: 'auto', scheduledAt: date.toISOString() },
                ...(Platform.OS === 'android' ? { channelId: 'medication-reminders-custom' } : {}),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: date45 },
        });
    }
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
