import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { validateEmail } from '@/utils/validation';
import { Colors } from '@/constants/Colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email) {
      Alert.alert('Error', 'Please enter your email.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Invalid email format.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      router.push({
        pathname: '/auth/reset-password-confirm',
        params: { email: email }
      });
    }
  }

  return (
    <AuthWrapper 
      title="Forgot Password?" 
      subtitle="Don't worry! Enter your email and we'll send you a code."
    >
      <View style={styles.form}>
        <InputField
          label="Email Address"
          icon="mail-outline"
          placeholder="john@example.com"
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
        style={styles.backBtn}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>Back to Login</Text>
      </TouchableOpacity>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 24, marginTop: 10 },
  backBtn: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: Colors.textSecondary,
    fontFamily: 'Poppins-SemiBold',
  },
});