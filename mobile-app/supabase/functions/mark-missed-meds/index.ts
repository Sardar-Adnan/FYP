
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Hello from mark-missed-meds!")

Deno.serve(async (req) => {
  try {
    // 1. Initialize Supabase Client
    // NOTE: These are automatically injected by Supabase Edge Runtime.
    // Do NOT hardcode them here.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Get Current Time details
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0(Sun) - 6(Sat)
    // Format "YYYY-MM-DD"
    const todayStr = now.toISOString().split('T')[0];

    console.log(`Checking missed meds for day index: ${dayOfWeek} at ${now.toISOString()}`);

    // 3. Fetch all active medications schedules for today
    // We need: schedule_id, med_id, patient_id, reminder_time
    // Note: This query assumes valid JSON in days_of_week or array column.
    // Since days_of_week is integer array:
    const { data: schedules, error: schedError } = await supabase
      .from('medication_schedules')
      .select(`
        id,
        med_id,
        reminder_time,
        days_of_week,
        medications (
            patient_id,
            is_active
        )
      `)
      .eq('medications.is_active', true)
      // We can't easily filter days_of_week array overlap in loose JS client without specific PG operators
      // typically .contains('days_of_week', [dayOfWeek]) for array column.
      .contains('days_of_week', [dayOfWeek]);

    if (schedError) throw schedError;

    console.log(`Found ${schedules?.length || 0} potential schedules for today.`);

    const updates = [];

    // 4. Iterate and check logic
    for (const sched of (schedules || [])) {
      // Parse time
      const [h, m] = sched.reminder_time.split(':').map(Number);
      const schedTime = new Date();
      schedTime.setHours(h, m, 0, 0); // Today at HH:MM

      // Timeout time = Scheduled + 1 Hour
      const timeoutTime = new Date(schedTime.getTime() + 60 * 60 * 1000);

      // Only process if NOW > TimeoutTime
      if (now > timeoutTime) {
        // Check if log exists
        const { data: logs, error: logError } = await supabase
          .from('medication_logs')
          .select('id')
          .eq('schedule_id', sched.id)
          .gte('scheduled_at', `${todayStr}T00:00:00`)
          .lte('scheduled_at', `${todayStr}T23:59:59`);

        if (logError) {
          console.error("Log fetch error", logError);
          continue;
        }

        // If no log found, insert 'not taken'
        if (!logs || logs.length === 0) {
          console.log(`Marking as NOT TAKEN: Med ${sched.med_id} Sched ${sched.id}`);

          // We construct the scheduled_at strictly to match format
          const scheduledAtISO = `${todayStr}T${sched.reminder_time}:00`; // HH:MM:00

          updates.push({
            patient_id: sched.medications.patient_id,
            med_id: sched.med_id,
            schedule_id: sched.id,
            status: 'not taken',
            scheduled_at: scheduledAtISO,
            taken_at: null
          });
        }
      }
    }

    // 5. Batch Insert
    if (updates.length > 0) {
      const { error: insertError } = await supabase
        .from('medication_logs')
        .insert(updates);

      if (insertError) throw insertError;
      console.log(`Successfully marked ${updates.length} medications as not taken.`);
    } else {
      console.log("No missed medications found to update.");
    }

    return new Response(
      JSON.stringify({ success: true, updated: updates.length }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    console.error(err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
