import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function PendingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Function to check if the patient has approved the request
  async function checkStatus() {
    setChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('caregiver_patient_links')
        .select('status')
        .eq('caregiver_id', user.id)
        .single();

      if (data?.status === 'active') {
        Alert.alert('Approved!', 'Your request has been approved.');
        router.replace('/caregiver/dashboard');
      } else if (data?.status === 'rejected') {
        Alert.alert('Request Rejected', 'The patient has rejected your connection request.');
      } else {
        Alert.alert('Still Pending', 'The patient has not approved your request yet. Please ask them to check their app.');
      }
    } catch (e) {
      console.log(e);
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth/welcome');
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={{ fontSize: 60 }}>⏳</Text>
        </View>

        <Text style={styles.title}>Approval Pending</Text>
        <Text style={styles.subtitle}>
          We have sent a request to the elderly person account. They must approve it before you can access their health data.
        </Text>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>What to do next?</Text>
          <Text style={styles.infoText}>
            1. Ask the patient to open their Old Care App.{'\n'}
            2. They should see a prompt to approve you.{'\n'}
            3. Once they click Approve, tap Refresh Status below.
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button 
            title="Refresh Status" 
            onPress={checkStatus} 
            isLoading={checking} 
            style={{ marginBottom: 16 }}
          />
          
          <Button 
            title="Log Out" 
            variant="outline" 
            onPress={handleLogout} 
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#FEF3C7', // Light yellow
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    marginBottom: 40,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: Colors.textPrimary,
  },
  infoText: {
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    width: '100%',
  },
});