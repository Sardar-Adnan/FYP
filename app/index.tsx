import { Colors } from '@/constants/Colors';
import { useAuth } from '@/providers/AuthProvider';
import { Redirect, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function Index() {
  const { session, loading, user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Only log if we are actually ON this screen (root)
    console.log("--- INDEX PATH DEBUG ---", pathname);

    // Only act if pathname is strictly slash "/"
    if (pathname === '/') {
      console.log("--- INDEX DEBUG ---");
      console.log("Loading:", loading);
      console.log("Session exists?", !!session);
      console.log("User Profile:", user);
    }
  }, [loading, session, user, pathname]);

  // CRITICAL FIX: If we are deep inside /auth/..., DO NOT redirect from here.
  // The 'index' route is technically a parent of all routes in expo-router 
  // if not careful, so we ensure we only act if we are at root.
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
    console.log("Redirecting to Welcome (No Session)");
    return <Redirect href="/auth/welcome" />;
  }

  // 3. If Logged in but NO Profile -> Problem!
  if (!user) {
    console.log("Redirecting to Welcome (Session exists but No Profile)");
    // Ideally we should send them to a "Complete Profile" screen, 
    // but for now, let's see if this is the issue.
    return <Redirect href="/auth/welcome" />;
  }

  // 4. Role based redirects
  if (user.role === 'elderly') {
    console.log("Redirecting to Elderly Dashboard");
    return <Redirect href="/elderly/dashboard" />;
  }

  if (user.role === 'caregiver') {
    console.log("Redirecting to Caregiver Dashboard");
    return <Redirect href="/caregiver/dashboard" />;
  }

  return null;
}