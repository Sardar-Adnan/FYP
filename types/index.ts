export type UserRole = 'elderly' | 'caregiver';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;

  // Fields specific to Elderly Patients
  age?: number;
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
  created_at: string;
}

export interface AuthResponse {
  user: UserProfile | null;
  session: any | null;
  error?: string;
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
  status: 'taken' | 'skipped' | 'missed' | 'pending';
  scheduled_at: string; // Full ISO timestamp
  taken_at: string | null;
}