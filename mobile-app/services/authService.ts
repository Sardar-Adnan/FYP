import { supabase } from '@/lib/supabase';

export const AuthService = {
  /**
   * Verifies if a patient account exists with the given email.
   * Used during Caregiver Signup to ensure they link to a real person.
   * * @param email The email address of the elderly patient
   * @returns The patient's User ID if found, otherwise null.
   */
  async verifyPatientEmail(email: string) {
    // Check if user exists in public table with elderly role
    const { data, error } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('email', email)
      .eq('role', 'elderly')
      .single();

    if (error) {
      console.error('Patient email verification failed:', error.message);
    }

    return data?.id;
  },

  /**
   * Signs out the current user and clears the session.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }
};