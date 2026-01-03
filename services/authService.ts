import { supabase } from '@/lib/supabase';

export const AuthService = {
  /**
   * Verifies if a patient account exists with the given email.
   * Used during Caregiver Signup to ensure they link to a real person.
   * * @param email The email address of the elderly patient
   * @returns The patient's User ID if found, otherwise null.
   */
  async verifyPatientEmail(email: string): Promise<string | null> {
  console.log("Checking for patient email:", email); // <--- Add this log

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, email') // Select more fields to debug
      .eq('email', email) // Ensure exact match
      .eq('role', 'patient')
      .single();

    if (error) {
      console.error("Supabase Error:", error); // <--- Add this log
      return null;
    }
    
    console.log("Found Patient:", data); // <--- Add this log
    return data.id;
  } catch (error) {
    console.error('Error verifying patient email:', error);
    return null;
  }
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