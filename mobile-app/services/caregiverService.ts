/**
 * Caregiver Service
 *
 * Central service for all caregiver-side data fetching and mutations.
 * All queries respect RLS — caregivers can only access linked patient data.
 */

import { supabase } from '@/lib/supabase';
import {
  CaregiverNotification,
  FallEvent,
  Medication,
  MedicationLog,
  MedicationSchedule,
  UserProfile,
  VitalsRecord,
} from '@/types';

// ─── Patient Profile ─────────────────────────────────────────

/** Get the caregiver's linked patient profile */
export async function getLinkedPatient(): Promise<{
  patientId: string;
  patient: UserProfile;
} | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: link } = await supabase
    .from('caregiver_patient_links')
    .select('patient_id')
    .eq('caregiver_id', user.id)
    .eq('status', 'active')
    .single();

  if (!link?.patient_id) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', link.patient_id)
    .single();

  if (!profile) return null;

  return { patientId: link.patient_id, patient: profile as UserProfile };
}

// ─── Vitals ──────────────────────────────────────────────────

/** Fetch patient vitals for last N days */
export async function getPatientVitals(
  patientId: string,
  days: number = 7
): Promise<VitalsRecord[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('vitals')
    .select('*')
    .eq('user_id', patientId)
    .gte('recorded_at', since.toISOString())
    .order('recorded_at', { ascending: true });

  if (error) {
    console.error('[CaregiverService] Failed to fetch vitals:', error);
    return [];
  }
  return (data || []) as VitalsRecord[];
}

// ─── Medications ─────────────────────────────────────────────

/** Fetch active medications for the patient */
export async function getPatientMedications(
  patientId: string
): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[CaregiverService] Failed to fetch medications:', error);
    return [];
  }
  return (data || []) as Medication[];
}

/** Fetch medication schedules for given medication IDs */
export async function getMedicationSchedules(
  medIds: string[]
): Promise<MedicationSchedule[]> {
  if (medIds.length === 0) return [];

  const { data, error } = await supabase
    .from('medication_schedules')
    .select('*')
    .in('med_id', medIds);

  if (error) {
    console.error('[CaregiverService] Failed to fetch schedules:', error);
    return [];
  }
  return (data || []) as MedicationSchedule[];
}

/** Fetch medication logs for a date range */
export async function getMedicationLogs(
  patientId: string,
  startDate: string,
  endDate: string
): Promise<MedicationLog[]> {
  const { data, error } = await supabase
    .from('medication_logs')
    .select('*')
    .eq('patient_id', patientId)
    .gte('scheduled_at', startDate)
    .lte('scheduled_at', endDate)
    .order('scheduled_at', { ascending: false });

  if (error) {
    console.error('[CaregiverService] Failed to fetch logs:', error);
    return [];
  }
  return (data || []) as MedicationLog[];
}

/** Add a medication for the linked patient (caregiver action) */
export async function addMedicationForPatient(
  patientId: string,
  name: string,
  dosage: string,
  instructions: string,
  imageUrl: string | null,
  reminderTimes: string[], // ["08:00", "20:00"]
  daysOfWeek: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insert medication
    const { data: med, error: medError } = await supabase
      .from('medications')
      .insert({
        patient_id: patientId,
        name,
        dosage,
        instructions,
        image_url: imageUrl,
        is_active: true,
      })
      .select()
      .single();

    if (medError) throw medError;

    // 2. Insert schedules
    const scheduleInserts = reminderTimes.map((time) => ({
      med_id: med.id,
      reminder_time: time,
      days_of_week: daysOfWeek,
    }));

    const { error: schedError } = await supabase
      .from('medication_schedules')
      .insert(scheduleInserts);

    if (schedError) throw schedError;

    // 3. Notify all caregivers + patient
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const caregiverName = user?.user_metadata?.full_name || 'A caregiver';

    // Get all linked caregivers to notify them
    const { data: links } = await supabase
      .from('caregiver_patient_links')
      .select('caregiver_id')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .neq('caregiver_id', user?.id); // Don't notify the one who added it

    // Notify other caregivers
    if (links && links.length > 0) {
      const notifications = links.map((l) => ({
        caregiver_id: l.caregiver_id,
        patient_id: patientId,
        type: 'medication_added',
        title: 'New Medication Added',
        message: `${caregiverName} added ${name} (${dosage}) for the patient.`,
        data: { med_id: med.id, added_by: user?.id },
      }));

      await supabase.from('caregiver_notifications').insert(notifications);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[CaregiverService] Failed to add medication:', error);
    return { success: false, error: error.message };
  }
}

// ─── Fall Events ─────────────────────────────────────────────

/** Fetch fall events for the patient */
export async function getFallEvents(
  patientId: string
): Promise<FallEvent[]> {
  const { data, error } = await supabase
    .from('fall_events')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[CaregiverService] Failed to fetch fall events:', error);
    return [];
  }
  return (data || []) as FallEvent[];
}

// ─── Notifications ───────────────────────────────────────────

/** Fetch caregiver notifications */
export async function getNotifications(): Promise<CaregiverNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('caregiver_notifications')
    .select('*')
    .eq('caregiver_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[CaregiverService] Failed to fetch notifications:', error);
    return [];
  }
  return (data || []) as CaregiverNotification[];
}

/** Get unread notification count */
export async function getUnreadCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('caregiver_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('caregiver_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

/** Mark a notification as read */
export async function markNotificationRead(
  notificationId: string
): Promise<void> {
  await supabase
    .from('caregiver_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

/** Mark all notifications as read */
export async function markAllNotificationsRead(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('caregiver_notifications')
    .update({ is_read: true })
    .eq('caregiver_id', user.id)
    .eq('is_read', false);
}

// ─── Caregiver Links ─────────────────────────────────────────

/** Get all caregivers linked to a patient (for elderly's Care screen) */
export async function getCaregiverLinks(patientId: string): Promise<
  Array<{
    id: string;
    caregiver_id: string;
    is_primary: boolean;
    caregiver: { full_name: string; email: string; phone: string };
  }>
> {
  const { data, error } = await supabase
    .from('caregiver_patient_links')
    .select(
      `
      id,
      caregiver_id,
      is_primary,
      caregiver:users!caregiver_patient_links_caregiver_id_fkey (
        full_name,
        email,
        phone
      )
    `
    )
    .eq('patient_id', patientId)
    .eq('status', 'active');

  if (error) {
    console.error('[CaregiverService] Failed to fetch links:', error);
    return [];
  }
  return (data || []) as any;
}

/** Set a caregiver as primary (elderly action) */
export async function setPrimaryCaregiverId(
  patientId: string,
  caregiverLinkId: string
): Promise<boolean> {
  try {
    // 1. Clear all primary flags for this patient
    await supabase
      .from('caregiver_patient_links')
      .update({ is_primary: false })
      .eq('patient_id', patientId)
      .eq('status', 'active');

    // 2. Set the chosen one as primary
    const { error } = await supabase
      .from('caregiver_patient_links')
      .update({ is_primary: true })
      .eq('id', caregiverLinkId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[CaregiverService] Failed to set primary:', error);
    return false;
  }
}

// ─── Notification Generation ─────────────────────────────────

/**
 * Check conditions and generate in-app notifications.
 * Called when the caregiver opens the dashboard.
 * Deduplicates per-event to avoid duplicate notifications.
 */
export async function generateNotifications(patientId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;



  const todayStr = new Date().toISOString().split('T')[0];

  // Helper: check if notification already exists for today by type
  const existsForToday = async (type: string): Promise<boolean> => {
    const { count, error } = await supabase
      .from('caregiver_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('caregiver_id', user.id)
      .eq('patient_id', patientId)
      .eq('type', type)
      .gte('created_at', `${todayStr}T00:00:00`);
    if (error) console.warn('[NotifGen] Dedup check error:', error.message);
    return (count || 0) > 0;
  };

  // Helper: check if notification exists for a specific event ID
  const existsForEvent = async (type: string, eventKey: string, eventId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('caregiver_notifications')
      .select('id')
      .eq('caregiver_id', user.id)
      .eq('type', type)
      .limit(100);

    if (error) {
      console.warn('[NotifGen] Event dedup error:', error.message);
      return false;
    }

    // If no notifications of this type exist at all, it's new
    if (!data || data.length === 0) return false;

    // Check in the data column — we need to refetch with data column
    const { data: withData } = await supabase
      .from('caregiver_notifications')
      .select('id, data')
      .eq('caregiver_id', user.id)
      .eq('type', type);

    if (!withData) return false;

    return withData.some((n: any) => n.data && n.data[eventKey] === eventId);
  };

  // ─── 1. Medication missed/skipped in last 24h ───
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Fetch logs WITHOUT the join to avoid RLS issues
    const { data: missedLogs, error: logsErr } = await supabase
      .from('medication_logs')
      .select('id, med_id, status, scheduled_at')
      .eq('patient_id', patientId)
      .in('status', ['skipped', 'missed', 'not taken'])
      .gte('scheduled_at', yesterday.toISOString());

    if (logsErr) {
      console.warn('[NotifGen] Failed to fetch missed medication logs:', logsErr.message);
    }



    if (missedLogs && missedLogs.length > 0) {
      // Fetch medication names separately (caregiver has SELECT on medications)
      const medIds = [...new Set(missedLogs.map((l) => l.med_id))];
      const { data: meds } = await supabase
        .from('medications')
        .select('id, name')
        .in('id', medIds);

      const medNameMap: Record<string, string> = {};
      (meds || []).forEach((m: any) => { medNameMap[m.id] = m.name; });

      for (const log of missedLogs) {
        const alreadyNotified = await existsForEvent(
          log.status === 'skipped' ? 'medication_skipped' : 'medication_missed',
          'log_id',
          log.id
        );

        if (!alreadyNotified) {
          const medName = medNameMap[log.med_id] || 'Unknown medication';
          const type = log.status === 'skipped' ? 'medication_skipped' : 'medication_missed';
          const title = log.status === 'skipped' ? 'Medication Skipped' : 'Medication Missed';
          const time = new Date(log.scheduled_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          const { error: insertErr } = await supabase.from('caregiver_notifications').insert({
            caregiver_id: user.id,
            patient_id: patientId,
            type,
            title,
            message: `${medName} was ${log.status} at ${time}.`,
            data: { log_id: log.id, med_name: medName },
          });

          if (insertErr) {
            console.error('[NotifGen] Failed to insert med notification:', insertErr.message);
          } else {

          }
        }
      }
    }
  } catch (e: any) {
    console.error('[NotifGen] Medication notification error:', e.message);
  }

  // ─── 2. Abnormal vitals (latest reading today) ───
  try {
    if (!(await existsForToday('abnormal_vitals'))) {
      const { data: latestVitals } = await supabase
        .from('vitals')
        .select('*')
        .eq('user_id', patientId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (latestVitals) {
        const isAbnormal =
          latestVitals.risk_label === 'high' ||
          latestVitals.risk_label === 'moderate';
        const recordedToday = latestVitals.recorded_at?.startsWith(todayStr);

        if (isAbnormal && recordedToday) {
          const { error } = await supabase.from('caregiver_notifications').insert({
            caregiver_id: user.id,
            patient_id: patientId,
            type: 'abnormal_vitals',
            title: 'Abnormal Vitals Detected',
            message: `Heart Rate: ${latestVitals.heart_rate} bpm, BP: ${latestVitals.systolic_bp}/${latestVitals.diastolic_bp} mmHg — Risk: ${latestVitals.risk_label?.toUpperCase()}.`,
            data: {
              vitals_id: latestVitals.id,
              risk_label: latestVitals.risk_label,
            },
          });
          if (error) console.error('[NotifGen] Vitals insert error:', error.message);
        }
      }
    }
  } catch (e: any) {
    console.error('[NotifGen] Vitals notification error:', e.message);
  }

  // ─── 3. No daily vitals check (after 6 PM) ───
  try {
    if (!(await existsForToday('no_daily_vitals'))) {
      const now = new Date();
      if (now.getHours() >= 18) {
        const { count: todayVitalsCount } = await supabase
          .from('vitals')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', patientId)
          .gte('recorded_at', `${todayStr}T00:00:00`);

        if ((todayVitalsCount || 0) === 0) {
          const { error } = await supabase.from('caregiver_notifications').insert({
            caregiver_id: user.id,
            patient_id: patientId,
            type: 'no_daily_vitals',
            title: 'No Vitals Recorded Today',
            message: 'The patient has not measured their vitals today. Consider checking on them.',
            data: {},
          });
          if (error) console.error('[NotifGen] No vitals insert error:', error.message);
        }
      }
    }
  } catch (e: any) {
    console.error('[NotifGen] No vitals notification error:', e.message);
  }

  // ─── 4. Fall events — dedup PER FALL, not per day ───
  try {
    const { data: recentFalls, error: fallErr } = await supabase
      .from('fall_events')
      .select('*')
      .eq('patient_id', patientId)
      .eq('response', 'dispatched')
      .order('created_at', { ascending: false })
      .limit(10);

    if (fallErr) {
      console.warn('[NotifGen] Failed to fetch falls:', fallErr.message);
    }



    if (recentFalls && recentFalls.length > 0) {
      for (const fall of recentFalls) {
        const alreadyNotified = await existsForEvent('fall_detected', 'fall_id', fall.id);

        if (!alreadyNotified) {
          const { error } = await supabase.from('caregiver_notifications').insert({
            caregiver_id: user.id,
            patient_id: patientId,
            type: 'fall_detected',
            title: '🚨 Fall Detected',
            message: `A fall was detected at ${new Date(fall.created_at).toLocaleTimeString()}. Emergency dispatch was triggered.`,
            data: { fall_id: fall.id },
          });
          if (error) console.error('[NotifGen] Fall insert error:', error.message);
        }
      }
    }
  } catch (e: any) {
    console.error('[NotifGen] Fall notification error:', e.message);
  }


}
