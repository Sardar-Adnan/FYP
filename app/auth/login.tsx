import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { InputField } from '@/components/ui/InputField';
import { Button } from '@/components/ui/Button';
import { SocialBlock } from '@/components/ui/SocialBlock';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message);
    else router.replace('/'); 
  }

  return (
    <AuthWrapper 
      title="Welcome Back!" 
      subtitle="Please enter your details to sign in."
    >
      <View style={styles.form}>
        <InputField
          label="Email"
          icon="mail-outline"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
        <InputField
          label="Password"
          icon="lock-closed-outline"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        {/* Forgot Password Link */}
        <TouchableOpacity 
          style={styles.forgotBtn}
          onPress={() => router.push('/auth/forgot-password')}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <Button 
        title="Log In" 
        onPress={handleLogin} 
        isLoading={loading} 
        size="large"
      />

      {/* The Social Login Visuals */}
      <SocialBlock />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Dont have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/auth/welcome')}>
          <Text style={styles.signupText}>Sign up</Text>
        </TouchableOpacity>
      </View>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 24 },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 20,
  },
  forgotText: {
    color: Colors.primary,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#94A3B8',
    fontFamily: 'Poppins-Regular',
  },
  signupText: {
    color: Colors.primary,
    fontFamily: 'Poppins-Bold',
  },
});