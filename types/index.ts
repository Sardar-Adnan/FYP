export type UserRole = 'patient' | 'caregiver';

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