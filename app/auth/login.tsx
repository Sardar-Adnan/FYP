import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { Button } from '@/components/ui/Button';
import { InputField } from '@/components/ui/InputField';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

    try {
      console.log("Logging in...");

      // Wrap in timeout (Supabase client bug on React Native)
      const loginPromise = supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Login timeout')), 10000)
      );

      const result = await Promise.race([loginPromise, timeoutPromise]) as any;
      const error = result?.error;

      if (error) {
        console.error("Login error:", error);
        setLoading(false);
        Alert.alert('Login Failed', error.message);
        return;
      }

      console.log("Login successful, waiting for redirect...");

      // Fallback: if redirect doesn't happen in 3 seconds, do it manually
      setTimeout(() => {
        console.log("Redirect didn't happen automatically, forcing navigation to root...");
        router.replace('/');
      }, 3000);

    } catch (err: any) {
      console.error("Login error or timeout:", err);

      if (err.message === 'Login timeout') {
        console.log("Login timed out, but checking if session was created...");

        // Wait 2 seconds for AsyncStorage session to sync
        setTimeout(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              console.log("Session found! Login was successful.");
              router.replace('/');
            } else {
              console.log("No session found after timeout.");
              setLoading(false);
              Alert.alert(
                'Login Timeout',
                'Login is taking longer than expected. Please check your internet connection.',
                [{ text: 'OK' }]
              );
            }
          } catch (sessionError) {
            console.error("Session check failed:", sessionError);
            setLoading(false);
            Alert.alert('Error', 'Login failed due to a connection issue.');
          }
        }, 2000);
      } else {
        setLoading(false);
        Alert.alert('Unexpected Error', err.message || 'An error occurred during login.');
      }
    }
  }

  return (
    <AuthWrapper title="Welcome Back" subtitle="Sign in to continue">
      <View style={styles.form}>
        <InputField
          label="Email"
          icon="mail-outline"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          autoCapitalize="none"
        />
        <InputField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />

        <TouchableOpacity
          onPress={() => router.push('/auth/forgot-password')}
          style={styles.forgotButton}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <Button
        title="Login"
        onPress={handleLogin}
        isLoading={loading}
        size="large"
      />

      <TouchableOpacity
        style={styles.footerButton}
        onPress={() => router.push('/auth/welcome')}
      >
        <Text style={styles.footerText}>
          Don&apos;t have an account? <Text style={styles.highlight}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  form: { marginBottom: 24 },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 10,
  },
  forgotText: {
    color: Colors.primary,
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  footerButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: Colors.textSecondary,
    fontFamily: 'Poppins-Regular',
  },
  highlight: {
    color: Colors.primary,
    fontFamily: 'Poppins-SemiBold',
  },
});