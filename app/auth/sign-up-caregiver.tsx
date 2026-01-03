import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { AuthService } from '@/services/authService';
import { Colors } from '@/constants/Colors';

export default function SignUpCaregiverScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [patientEmail, setPatientEmail] = useState('');

  async function handleSignUp() {
    if (!name || !email || !password || !patientEmail) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const patientId = await AuthService.verifyPatientEmail(patientEmail.trim().toLowerCase());

      if (!patientId) {
        Alert.alert('Verification Failed', 'No elderly patient found with that email address.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            role: 'caregiver',
            full_name: name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      const { error: linkError } = await supabase
        .from('caregiver_patient_links')
        .insert({
          caregiver_id: authData.user.id,
          patient_email: patientEmail.trim().toLowerCase(),
          patient_id: patientId, 
          status: 'pending' 
        });

      if (linkError) console.error("Link Creation Failed:", linkError);

      Alert.alert('Success', 'Account created! Please log in.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);

    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthWrapper 
      title="Caregiver Sign Up" 
      subtitle="Connect with your patient to start monitoring."
    >
      <View style={styles.form}>
        <InputField 
          label="Your Full Name" 
          icon="person-outline" 
          placeholder="Jane Doe"
          value={name} 
          onChangeText={setName} 
        />
        <InputField 
          label="Your Email" 
          icon="mail-outline" 
          placeholder="jane@care.com"
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
        />
        <InputField 
          label="Password" 
          icon="lock-closed-outline" 
          placeholder="Min 6 characters"
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>LINK PATIENT</Text>
          <View style={styles.line} />
        </View>
        
        <InputField 
          label="Patient's Email" 
          icon="heart-outline" 
          placeholder="patient@example.com"
          value={patientEmail} 
          onChangeText={setPatientEmail} 
          autoCapitalize="none"
        />
      </View>

      <Button 
        title="Verify & Register" 
        onPress={handleSignUp} 
        isLoading={loading} 
        size="large" 
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Have an account? </Text>
        <TouchableOpacity onPress={() => router.replace('/auth/login')}>
          <Text style={styles.linkText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 30 },
  divider: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 24 
  },
  line: { 
    flex: 1, 
    height: 1, 
    backgroundColor: Colors.border 
  },
  dividerText: { 
    marginHorizontal: 10, 
    color: Colors.textSecondary, 
    fontSize: 12, 
    fontFamily: 'Poppins-SemiBold' 
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: Colors.textSecondary,
    fontFamily: 'Poppins-Regular',
  },
  linkText: {
    color: Colors.primary,
    fontFamily: 'Poppins-Bold',
  },
});