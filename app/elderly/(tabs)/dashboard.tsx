import React, { useEffect, useState, useCallback } from 'react'; // <--- 1. Import useCallback
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SOSButton } from '@/components/ui/SOSButton'; 
import { SectionHeader } from '@/components/ui/SectionHeader';

export default function ElderlyDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('Friend');
  const [loading, setLoading] = useState(false);
  
  const [requests, setRequests] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // 2. Wrap helper functions in useCallback
  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.user_metadata?.full_name) {
      setUserName(user.user_metadata.full_name.split(' ')[0]);
    }
  }, []);

  const checkPendingRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return;

    const { data, error } = await supabase
      .from('caregiver_patient_links')
      .select(`
        id, 
        caregiver_id, 
        caregiver:users!caregiver_patient_links_caregiver_id_fkey (
          full_name,
          email,
          phone
        )
      `)
      .eq('patient_email', user.email)
      .eq('status', 'pending');

    if (error) {
      console.log("Error fetching requests:", error);
    } else {
      setRequests(data || []);
    }
  }, []);

  // 3. Wrap the main fetchData in useCallback and add dependencies
  const fetchData = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
    await checkPendingRequests();
    setLoading(false);
  }, [fetchProfile, checkPendingRequests]); // <--- Safe dependencies

  // 4. Now we can safely add fetchData to useEffect
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleApprove(requestId: string) {
    setApprovingId(requestId);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setApprovingId(null); return; }

    const { error } = await supabase
      .from('caregiver_patient_links')
      .update({ status: 'active', patient_id: user.id })
      .eq('id', requestId);

    setApprovingId(null);

    if (!error) {
      Alert.alert('Success', 'Linked with caregiver!');
      checkPendingRequests(); // This works fine
    } else {
      Alert.alert('Error', error.message);
    }
  }

  async function handleIgnore(requestId: string) {
    Alert.alert("Ignored", "Request hidden for now.");
    setRequests(current => current.filter(r => r.id !== requestId));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth/welcome');
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.headerBackground}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.date}>{new Date().toDateString()}</Text>
            <Text style={styles.greeting}>Hello, {userName}!</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.profileBtn}>
            <Text style={{ fontSize: 20 }}>👴</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sosContainer}>
          <SOSButton onPress={() => Alert.alert('SOS', 'Calling emergency contacts...')} />
        </View>
      </View>

      <View style={styles.bodyCard}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        >
          
          {requests.length > 0 && requests.map((req, index) => (
            <Card key={index} style={styles.alertCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[styles.iconBox, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="notifications" size={24} color={Colors.primary} />
                </View>
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.alertTitle}>New Request</Text>
                  <Text style={styles.alertText}>
                    <Text style={{ fontFamily: 'Poppins-Bold' }}>
                      {req.caregiver?.full_name || req.caregiver?.email || 'A Caregiver'}
                    </Text> wants to link.
                  </Text>
                </View>
              </View>
              <View style={styles.alertActions}>
                <Button 
                  title="Accept" 
                  onPress={() => handleApprove(req.id)} 
                  size="default" 
                  isLoading={approvingId === req.id} 
                  style={{ flex: 1, marginRight: 8 }} 
                />
                <Button 
                  title="Ignore" 
                  variant="outline" 
                  onPress={() => handleIgnore(req.id)} 
                  style={{ flex: 1 }} 
                />
              </View>
            </Card>
          ))}

          <SectionHeader title="Today's Health" />
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: '#FEF2F2' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#FECACA' }]}>
                <Ionicons name="heart" size={24} color={Colors.danger} />
              </View>
              <Text style={styles.statValue}>--</Text>
              <Text style={styles.statLabel}>Heart Rate</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
              <View style={[styles.iconCircle, { backgroundColor: '#BFDBFE' }]}>
                <Ionicons name="water" size={24} color={Colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: Colors.primary }]}>--/--</Text>
              <Text style={styles.statLabel}>Blood Pressure</Text>
            </View>
          </View>

          <SectionHeader title="Quick Actions" />
          <View style={styles.grid}>
            <IconButton 
              label="Log Vitals" 
              icon="pulse" 
              color={Colors.secondary}
              onPress={() => router.push('/elderly/vitals' as any)}
            />
            <IconButton 
              label="Medicines" 
              icon="medkit" 
              color="#F59E0B"
              onPress={() => Alert.alert('Coming Soon')} 
            />
            <IconButton 
              label="Contacts" 
              icon="call" 
              color={Colors.primary}
              onPress={() => Alert.alert('Coming Soon')} 
            />
            <IconButton 
              label="Settings" 
              icon="settings" 
              color="#64748B"
              onPress={() => Alert.alert('Coming Soon')} 
            />
          </View>

        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  headerBackground: {
    height: '38%',
    paddingTop: 60,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  date: {
    color: '#E0F2FE',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Bold',
    fontSize: 26,
  },
  profileBtn: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sosContainer: {
    marginTop: 10,
  },
  bodyCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 30,
    marginTop: -20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  alertCard: {
    marginBottom: 24,
    borderWidth: 1, 
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  alertText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    flexWrap: 'wrap',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});