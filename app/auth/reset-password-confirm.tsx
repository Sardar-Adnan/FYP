import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';

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
    if (!emailStr) return;

    setLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: emailStr,
        token: code,
        type: 'recovery',
      });

      if (verifyError) throw new Error(verifyError.message);
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw new Error(updateError.message);
      
      Alert.alert('Success', 'Password updated! Logging you in...', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);

    } catch (error: any) {
      Alert.alert('Failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWrapper 
      title="Set New Password" 
      subtitle={`Enter the 6-digit code sent to ${email}`}
    >
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