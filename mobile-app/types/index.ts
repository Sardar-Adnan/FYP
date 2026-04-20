export type UserRole = 'elderly' | 'caregiver';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;

  // Fields specific to Elderly Patients
  age?: number;
  gender?: 'male' | 'female';
  height?: number;  // in cm
  weight?: number;  // in kg
  phone?: string;
  address?: string;

  // Metadata
  created_at?: string;
}

export interface CaregiverLink {
  id: string;
  caregiver_id: string;
  patient_id: string | null;
  patient_email: string;
  status: 'pending' | 'active' | 'rejected';
  is_primary: boolean;
  created_at: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  dosage: string;
  instructions: string;
  image_url: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface MedicationSchedule {
  id: string;
  med_id: string;
  reminder_time: string; // "08:00"
  days_of_week: number[]; // 0=Sunday, 6=Saturday
}

export interface MedicationLog {
  id: string;
  patient_id: string;
  med_id: string;
  schedule_id: string;
  status: 'taken' | 'skipped' | 'missed' | 'not taken' | 'pending';
  scheduled_at: string; // Full ISO timestamp
  taken_at: string | null;
}

export type NotificationType =
  | 'medication_missed'
  | 'medication_skipped'
  | 'abnormal_vitals'
  | 'no_daily_vitals'
  | 'fall_detected'
  | 'medication_added';

export interface CaregiverNotification {
  id: string;
  caregiver_id: string;
  patient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface FallEvent {
  id: string;
  patient_id: string;
  latitude: number | null;
  longitude: number | null;
  caregiver_notified: boolean;
  response: 'no_response' | 'cancelled' | 'dispatched';
  created_at: string;
}

export interface VitalsRecord {
  id: string;
  user_id: string;
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  health_risk?: number;
  risk_label?: 'low' | 'moderate' | 'high';
  recorded_at: string;
}