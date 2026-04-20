import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

export default function ResetPasswordConfirm() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword() {
    if (!code || !newPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    const emailStr = Array.isArray(email) ? email[0] : email;
    setLoading(true);

    try {


      // Exchange the OTP code for a session
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailStr,
        token: code,
        type: 'recovery',
      });

      if (error) {
        console.error("OTP verification failed:", error);
        throw error;
      }



      // CRITICAL: Use a Promise.race to timeout the updateUser call
      const updatePromise = supabase.auth.updateUser({ password: newPassword });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Update timeout')), 8000)
      );

      try {
        await Promise.race([updatePromise, timeoutPromise]);

      } catch (timeoutError: any) {
        if (timeoutError.message === 'Update timeout') {
          console.warn("updateUser timed out, but password may have been changed. Proceeding...");
          // Continue anyway - the password might have been updated server-side
        } else {
          throw timeoutError;
        }
      }


      setLoading(false);

      // Navigate immediately without blocking Alert
      router.push('/auth/login');

    } catch (error: any) {
      console.error("Password reset error:", error);
      setLoading(false);
      Alert.alert('Error', error.message || 'Failed to reset password');
    }
  }

  return (
    <AuthWrapper title="Set New Password" subtitle="Enter code & new password">
      <View style={styles.form}>
        <InputField
          label="Verification Code"
          icon="keypad-outline"
          placeholder="123456"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
        />
        <InputField
          label="New Password"
          icon="lock-closed-outline"
          placeholder="Min 6 characters"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
      </View>
      <Button
        title="Update Password"
        onPress={handleUpdatePassword}
        isLoading={loading}
        size="large"
      />
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 30, marginTop: 10 },
});