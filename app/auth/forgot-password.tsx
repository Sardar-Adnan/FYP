import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      // We don't need redirectTo here because we are using OTP code flow
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

      if (error) throw error;

      Alert.alert(
        'Check your Email',
        'We have sent you a 6-digit verification code.',
        [{
          text: 'Enter Code',
          onPress: () => {
            // Pass email to next screen so user doesn't have to retype it
            router.push({
              pathname: '/auth/reset-password-confirm',
              params: { email: email.trim() }
            });
          }
        }]
      );

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWrapper
      title="Reset Password"
      subtitle="Enter your email to receive a code."
    >
      <View style={styles.form}>
        <InputField
          label="Email"
          icon="mail-outline"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <Button
        title="Send Reset Code"
        onPress={handleReset}
        isLoading={loading}
        size="large"
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 24 },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: Colors.textSecondary,
    fontFamily: 'Poppins-Medium',
  },
});