import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native'; // Removed Alert if not used
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

export default function CaregiverDashboard() {
  const router = useRouter();
  const [patientName, setPatientName] = useState('Loading...');

  useEffect(() => {
    // Moved function INSIDE useEffect to fix dependency warning
    async function fetchPatientDetails() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get the link to find the patient ID
        const { data: linkData } = await supabase
          .from('caregiver_patient_links')
          .select('patient_id')
          .eq('caregiver_id', user.id)
          .eq('status', 'active')
          .single();

        if (linkData?.patient_id) {
          // 2. Get the patient's name
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', linkData.patient_id)
            .single();
          
          if (profileData) setPatientName(profileData.full_name);
        } else {
          // If no active link found, redirect to pending
          router.replace('/caregiver/pending');
        }
      } catch (error) {
        console.log(error);
      }
    }

    fetchPatientDetails();
  }, []); // Dependency array is now correctly empty because function is inside

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Monitoring</Text>
            <Text style={styles.patientName}>{patientName}</Text>
          </View>
          <Button 
            title="Log Out" 
            size="default" 
            variant="outline" 
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/auth/welcome');
            }} 
            style={{ width: 100 }}
          />
        </View>

        {/* Status Cards */}
        <View style={styles.grid}>
          {/* Now passing array styles works because we fixed Card.tsx */}
          <Card style={[styles.statusCard, { borderColor: Colors.secondary }]}>
            <Text style={styles.cardLabel}>Status</Text>
            <Text style={[styles.cardValue, { color: Colors.secondary }]}>Normal</Text>
          </Card>
          
          <Card style={[styles.statusCard, { borderColor: Colors.primary }]}>
            <Text style={styles.cardLabel}>Last Update</Text>
            <Text style={[styles.cardValue, { color: Colors.primary }]}>Just now</Text>
          </Card>
        </View>

        {/* Vitals Section */}
        <Text style={styles.sectionTitle}>Recent Vitals</Text>
        
        <Card>
          <View style={styles.vitalRow}>
            <Text style={{ fontSize: 24 }}>❤️</Text>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.vitalLabel}>Heart Rate</Text>
              <Text style={styles.vitalValue}>-- bpm</Text>
            </View>
          </View>
        </Card>

        <Card>
          <View style={styles.vitalRow}>
            <Text style={{ fontSize: 24 }}>🩸</Text>
            <View style={{ marginLeft: 16 }}>
              <Text style={styles.vitalLabel}>Blood Pressure</Text>
              <Text style={styles.vitalValue}>-- / -- mmHg</Text>
            </View>
          </View>
        </Card>

        {/* Alerts Section */}
        <Text style={styles.sectionTitle}>Recent Alerts</Text>
        <Card style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA' }}>
          <Text style={{ color: Colors.danger, fontWeight: 'bold' }}>No active alerts</Text>
          <Text style={{ color: Colors.textSecondary, marginTop: 4 }}>Everything looks good.</Text>
        </Card>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statusCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 4,
  },
  cardLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  vitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
});