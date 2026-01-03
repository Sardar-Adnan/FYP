import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword, validatePhone } from '@/utils/validation';
import { Colors } from '@/constants/Colors';

export default function SignUpElderlyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  async function handleSignUp() {
    if (!name || !email || !password || !age || !phone) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (!validatePhone(phone)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role: 'patient',
          full_name: name,
          age: parseInt(age),
          phone: phone,
          address: address,
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
    } else {
      Alert.alert('Success', 'Account created! You can now log in.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);
    }
  }

  return (
    <AuthWrapper 
      title="Create Profile" 
      subtitle="Join us to start monitoring your health."
    >
      <View style={styles.form}>
        <InputField 
          label="Full Name" 
          icon="person-outline" 
          placeholder="John Doe"
          value={name} 
          onChangeText={setName} 
        />
        <InputField 
          label="Email" 
          icon="mail-outline" 
          placeholder="john@example.com"
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none" 
          keyboardType="email-address"
        />
        <InputField 
          label="Password" 
          icon="lock-closed-outline" 
          placeholder="Min 6 characters"
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <InputField 
              label="Age" 
              icon="calendar-outline" 
              placeholder="65"
              value={age} 
              onChangeText={setAge} 
              keyboardType="numeric" 
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <InputField 
              label="Phone" 
              icon="call-outline" 
              placeholder="1234567890"
              value={phone} 
              onChangeText={setPhone} 
              keyboardType="phone-pad" 
            />
          </View>
        </View>

        <InputField 
          label="Home Address" 
          icon="home-outline" 
          placeholder="123 Main St, City"
          value={address} 
          onChangeText={setAddress} 
        />
      </View>

      <Button 
        title="Create Account" 
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
  row: { flexDirection: 'row' },
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