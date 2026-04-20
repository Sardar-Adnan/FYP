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

  async function checkConnection() {
    try {

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://www.google.com', { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);



      const sbController = new AbortController();
      const sbId = setTimeout(() => sbController.abort(), 5000);
      const sbRes = await fetch('https://rpcyfnfdtmwffzinvdpp.supabase.co', { method: 'HEAD', signal: sbController.signal });
      clearTimeout(sbId);


      return true;
    } catch (e: any) {
      console.error("Connectivity check failed:", e);
      Alert.alert("Connection Check Failed", "Failed to reach: " + (e.message || "Unknown error"));
      return false;
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    const isConnected = await checkConnection();
    if (!isConnected) {
      setLoading(false);
      Alert.alert('Connection Error', 'Unable to reach the internet. Please check your connection.');
      return;
    }

    try {


      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("Login error:", error);
        setLoading(false);
        Alert.alert('Login Failed', error.message);
        return;
      }



      // Poll until AuthProvider picks up the session and loads the profile
      // This avoids the race condition where index.tsx sees session but no user
      let attempts = 0;
      const maxAttempts = 20; // 20 * 300ms = 6 seconds max

      const waitForProfile = () => new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          attempts++;
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile?.role) {
              clearInterval(interval);


              if (profile.role === 'elderly') {
                router.replace('/elderly/dashboard');
              } else if (profile.role === 'caregiver') {
                router.replace('/caregiver/dashboard');
              } else {
                router.replace('/');
              }
              resolve();
              return;
            }
          }

          if (attempts >= maxAttempts) {
            clearInterval(interval);
            console.warn("Profile polling timed out, falling back to index...");
            router.replace('/');
            resolve();
          }
        }, 300);
      });

      await waitForProfile();

    } catch (err: any) {
      console.error("Login error:", err);
      setLoading(false);
      Alert.alert('Unexpected Error', err.message || 'An error occurred during login.');
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