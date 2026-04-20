/**
 * Emergency Dispatch Service
 * 
 * Handles the full emergency flow when a fall timeout occurs:
 * 1. Get GPS location via expo-location
 * 2. Get ALL linked caregivers from Supabase
 * 3. POST data to n8n webhook (triggers SMS to ALL + Voice Call to primary)
 * 4. Log the event to Supabase fall_events table
 * 
 * SMS → sent to ALL caregivers with Google Maps link
 * Voice Call → sent to PRIMARY (first) caregiver, mentions SMS was sent
 */

import { EmergencyConfig } from '@/constants/config';
import { supabase } from '@/lib/supabase';

// expo-location is loaded lazily to avoid crashes in Expo Go
let Location: typeof import('expo-location') | null = null;

// === TYPES ===
export interface CaregiverInfo {
    full_name: string;
    email: string;
    phone: string;
}

export interface EmergencyPayload {
    patient_id: string;
    patient_name: string;
    patient_phone: string;
    latitude: number;
    longitude: number;
    maps_link: string;
    caregivers: CaregiverInfo[];
    primary_caregiver_phone: string;
    primary_caregiver_name: string;
    timestamp: string;
    event_type: 'fall_timeout' | 'sos_manual';
}

export interface EmergencyResult {
    success: boolean;
    webhookSent: boolean;
    eventLogged: boolean;
    location: { latitude: number; longitude: number } | null;
    caregiversFound: number;
    error?: string;
}

// === GPS LOCATION ===

/**
 * Get current GPS location with permission handling.
 * Returns null if permissions denied or location unavailable.
 */
async function getLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        // Lazy-load expo-location to avoid crash in Expo Go
        if (!Location) {
            Location = require('expo-location');
        }

        const { status } = await Location!.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('[Emergency] Location permission denied');
            return null;
        }

        // Try to get a fast cached location first
        let location = await Location!.getLastKnownPositionAsync();
        
        // If no cached location, wait max 10 seconds for a fresh one
        if (!location) {
            console.log('[Emergency] No cached GPS found, attempting fresh fix with 10s timeout...');
            
            // Create a timeout promise
            const timeoutPromise = new Promise<null>((resolve) => 
                setTimeout(() => resolve(null), EmergencyConfig.LOCATION_TIMEOUT)
            );

            // Race the location request against the timeout
            location = await Promise.race([
                Location!.getCurrentPositionAsync({
                    accuracy: Location!.Accuracy.Balanced,
                }),
                timeoutPromise
            ]) as any;

            if (!location) {
                console.warn('[Emergency] GPS acquisition timed out, continuing without location.');
            }
        }

        return {
            latitude: location?.coords.latitude || 0,
            longitude: location?.coords.longitude || 0,
        };
    } catch (error) {
        console.error('[Emergency] Failed to get location:', error);
        return null;
    }
}

// === CAREGIVER LOOKUP ===

/**
 * Get ALL linked caregivers for the current patient.
 * Queries caregiver_patient_links (status=active) joined with users table.
 * Returns an array of all active caregivers, with the primary one first.
 */
async function getAllCaregivers(patientId: string): Promise<CaregiverInfo[]> {
    try {
        const { data, error } = await supabase
            .from('caregiver_patient_links')
            .select(`
                is_primary,
                caregiver:users!caregiver_patient_links_caregiver_id_fkey (
                    full_name,
                    email,
                    phone
                )
            `)
            .eq('patient_id', patientId)
            .eq('status', 'active');

        if (error || !data || data.length === 0) {
            console.warn('[Emergency] No active caregivers found:', error?.message);
            return [];
        }

        const caregivers: CaregiverInfo[] = data.map((row: any) => ({
            full_name: row.caregiver?.full_name || 'Caregiver',
            email: row.caregiver?.email || '',
            phone: row.caregiver?.phone || '',
        }));

        // Sort so the primary caregiver is first
        // The primary caregiver is the one with is_primary = true
        const sortedData = [...data].sort((a: any, b: any) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return 0;
        });

        const sortedCaregivers: CaregiverInfo[] = sortedData.map((row: any) => ({
            full_name: row.caregiver?.full_name || 'Caregiver',
            email: row.caregiver?.email || '',
            phone: row.caregiver?.phone || '',
        }));

        const primary = sortedData[0] as any;
        const primaryName = primary?.is_primary
            ? (primary.caregiver?.full_name || 'Unknown')
            : 'first linked (no primary set)';

        return sortedCaregivers;
    } catch (error) {
        console.error('[Emergency] Failed to get caregivers:', error);
        return [];
    }
}

// === WEBHOOK POST ===

/**
 * Send emergency data to n8n webhook.
 */
async function sendWebhook(payload: EmergencyPayload): Promise<boolean> {
    try {

        
        const response = await fetch(EmergencyConfig.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            return true;
        } else {
            console.error('[Emergency] Webhook failed:', response.status, await response.text());
            return false;
        }
    } catch (error) {
        console.error('[Emergency] Webhook error:', error);
        return false;
    }
}

// === LOG TO SUPABASE ===

/**
 * Log the fall event to the fall_events table.
 */
async function logFallEvent(
    patientId: string,
    latitude: number | null,
    longitude: number | null,
    caregiverNotified: boolean,
    response: 'no_response' | 'cancelled' | 'dispatched'
): Promise<boolean> {
    try {
        const { error } = await supabase.from('fall_events').insert({
            patient_id: patientId,
            latitude: latitude,
            longitude: longitude,
            caregiver_notified: caregiverNotified,
            response: response,
        });

        if (error) {
            console.error('[Emergency] Failed to log event:', error.message);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Emergency] Log error:', error);
        return false;
    }
}

// === MAIN DISPATCH FUNCTION ===

/**
 * Full emergency dispatch flow.
 * Called when the 30-second countdown expires.
 * 
 * Steps:
 * 1. Get current user from Supabase auth
 * 2. Get GPS location
 * 3. Get ALL linked caregivers
 * 4. POST to n8n webhook:
 *    - n8n sends SMS to ALL caregivers (with Google Maps link)
 *    - n8n makes voice call to PRIMARY caregiver (mentions SMS link)
 * 5. Log event to Supabase
 */
export async function dispatchEmergency(
    eventType: 'fall_timeout' | 'sos_manual' = 'fall_timeout'
): Promise<EmergencyResult> {


    const result: EmergencyResult = {
        success: false,
        webhookSent: false,
        eventLogged: false,
        location: null,
        caregiversFound: 0,
    };

    try {
        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            result.error = 'No authenticated user';
            console.error('[Emergency]', result.error);
            return result;
        }

        // 2. Get GPS location (don't block on failure)
        const location = await getLocation();
        result.location = location;

        // 3. Get ALL linked caregivers
        const caregivers = await getAllCaregivers(user.id);
        result.caregiversFound = caregivers.length;

        if (caregivers.length === 0) {
            console.warn('[Emergency] No caregivers linked — webhook will still fire');
        }

        // 4. Build Google Maps link
        const lat = location?.latitude || 0;
        const lng = location?.longitude || 0;
        const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;

        // 5. Build payload — primary caregiver is the first one
        const primaryCaregiver = caregivers[0] || { full_name: 'Unknown', email: '', phone: '' };

        const payload: EmergencyPayload = {
            patient_id: user.id,
            patient_name: user.user_metadata?.full_name || 'Unknown Patient',
            patient_phone: user.user_metadata?.phone || '',
            latitude: lat,
            longitude: lng,
            maps_link: mapsLink,
            caregivers: caregivers,
            primary_caregiver_phone: primaryCaregiver.phone,
            primary_caregiver_name: primaryCaregiver.full_name,
            timestamp: new Date().toISOString(),
            event_type: eventType,
        };

        // 6. Send webhook to n8n
        result.webhookSent = await sendWebhook(payload);

        // 7. Log to Supabase
        result.eventLogged = await logFallEvent(
            user.id,
            location?.latitude || null,
            location?.longitude || null,
            result.webhookSent,
            'dispatched'
        );

        result.success = result.webhookSent;

        if (result.success) {

        } else {
            console.warn('[Emergency] ⚠️ Dispatch completed with issues');
        }

        return result;
    } catch (error: any) {
        result.error = error.message || 'Unknown error';
        console.error('[Emergency] Fatal error:', error);
        return result;
    }
}

/**
 * Log a "cancelled" fall event (user pressed "I'm OK").
 */
export async function logFallCancelled(): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await logFallEvent(user.id, null, null, false, 'cancelled');

    } catch (error) {
        console.error('[Emergency] Failed to log cancellation:', error);
    }
}
