import { supabase } from '@/lib/supabase';

export const AuthService = {
  /**
   * Verifies if a patient account exists with the given email.
   * Used during Caregiver Signup to ensure they link to a real person.
   * * @param email The email address of the elderly patient
   * @returns The patient's User ID if found, otherwise null.
   */
  async verifyPatientEmail(email: string) {
    console.log("SEARCHING FOR:", email); // <--- DEBUG 1: What are we typing?

    // 1. Check if user exists in public table
    const { data, error } = await supabase
      .from('users')
      .select('id, role, email') // <--- DEBUG 2: Fetch email to compare
      .eq('email', email)
      .eq('role', 'elderly')
      .single();

    if (error) {
      console.log("SEARCH FAILED. Supabase said:", error.message);
      // DEBUG 3: If it fails, let's see what is actually in the table
      const { data: allUsers } = await supabase.from('users').select('email');
      console.log("EMAILS ACTUALLY IN DB:", JSON.stringify(allUsers));
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