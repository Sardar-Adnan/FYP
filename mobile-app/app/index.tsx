import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Redirect, usePathname, router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function Index() {
  const { session, loading, user } = useAuth();
  const pathname = usePathname();

  // Only act on root path to avoid interference with nested routes
  if (pathname !== '/') return null;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 20 }}>Checking session...</Text>
      </View>
    );
  }

  // 2. If NOT logged in, send to Welcome
  if (!session) {
    return <Redirect href="/auth/welcome" />;
  }

  // 3. If Logged in but NO Profile -> STOP THE LOOP
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Account Setup Issue</Text>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>
          We found your login session, but your user profile seems to be missing.
          This might happen if the sign-up process was interrupted.
        </Text>
        <Button
          title="Logout & Try Again"
          onPress={async () => {
            try {
              // By using scope: 'local', we ensure it purges local state even if network request fails
              await supabase.auth.signOut({ scope: 'local' });
            } catch (e) {
              console.error("Sign out error", e);
            } finally {
              router.replace('/auth/welcome');
            }
          }}
        />
      </View>
    );
  }

  // 4. Role based redirects
  if (user.role === 'elderly') {
    return <Redirect href="/elderly/dashboard" />;
  }

  if (user.role === 'caregiver') {
    return <Redirect href="/caregiver/dashboard" />;
  }

  return null;
}