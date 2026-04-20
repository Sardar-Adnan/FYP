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
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
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
      Alert.alert('Invalid Phone', 'Phone number must be in E.164 international format (e.g., +923001234567).');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Auth User
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: 'elderly',
            full_name: name,
            age: parseInt(age),
            phone: phone,
          },
        },
      });

      if (authError) throw authError;
      if (!user) throw new Error("No user created");

      // 2. Upsert into Public 'users' table
      const { error: dbError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: email.trim(),
          role: 'elderly',
          full_name: name,
          age: parseInt(age),
          gender: gender || null,
          height: height ? parseInt(height) : null,
          weight: weight ? parseInt(weight) : null,
          phone: phone,
          address: address
        });

      if (dbError) {
        console.error("FULL DATABASE ERROR:", JSON.stringify(dbError, null, 2));
        throw new Error(dbError.message);
      }

      Alert.alert('Success', 'Account created! Logging you in...', [
        { text: 'OK', onPress: () => router.replace('/elderly/dashboard') } // FIXED PATH
      ]);

    } catch (error: any) {
      console.error("Signup failed:", error.message);
      Alert.alert('Signup Failed', error.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
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

        {/* Gender Selection */}
        <Text style={styles.fieldLabel}>Gender (Optional)</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
            onPress={() => setGender('male')}
          >
            <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
            onPress={() => setGender('female')}
          >
            <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
          </TouchableOpacity>
        </View>

        {/* Height & Weight */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <InputField
              label="Height (cm)"
              icon="resize-outline"
              placeholder="165"
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <InputField
              label="Weight (kg)"
              icon="fitness-outline"
              placeholder="70"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
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
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  genderButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  genderText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
  },
  genderTextActive: {
    color: Colors.primary,
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