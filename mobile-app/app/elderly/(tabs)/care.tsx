import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { getCaregiverLinks, getFallEvents, setPrimaryCaregiverId } from '@/services/caregiverService';
import { FallEvent } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';

interface LinkedCaregiver {
  id: string;
  caregiver_id: string;
  is_primary: boolean;
  caregiver: { full_name: string; email: string; phone: string };
}

export default function CareScreen() {
  const [loading, setLoading] = useState(true);
  const [caregivers, setCaregivers] = useState<LinkedCaregiver[]>([]);
  const [recentFalls, setRecentFalls] = useState<FallEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email || null);

      const links = await getCaregiverLinks(user.id);
      setCaregivers(links);

      const falls = await getFallEvents(user.id);
      setRecentFalls(falls.slice(0, 5)); // Latest 5
    } catch (error) {
      console.error('[CareScreen] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleSetPrimary = async (linkId: string, caregiverName: string) => {
    Alert.alert(
      'Set Primary Caregiver',
      `Set ${caregiverName} as your primary caregiver?\n\nThe primary caregiver will receive a phone call when a fall is detected. Others will only receive SMS.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSettingPrimary(linkId);
            if (userId) {
              const success = await setPrimaryCaregiverId(userId, linkId);
              if (success) {
                Alert.alert('Success', `${caregiverName} is now your primary caregiver.`);
                fetchData();
              } else {
                Alert.alert('Error', 'Failed to update. Please try again.');
              }
            }
            setSettingPrimary(null);
          },
        },
      ]
    );
  };

  const handleInviteCaregiver = async () => {
    if (!userEmail) return;
    try {
      await Share.share({
        message: `Hi! Please download OldCareApp to become my caregiver.\n\nWhen you create your Caregiver account, it will ask for my email to link us together. Please enter:\n${userEmail}`,
      });
    } catch (error) {
      console.error('Error sharing', error);
    }
  };

  const getResponseLabel = (response: string) => {
    switch (response) {
      case 'dispatched': return { text: 'Emergency', color: Colors.danger };
      case 'cancelled': return { text: 'False Alarm', color: Colors.success };
      default: return { text: response, color: Colors.textSecondary };
    }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 60, paddingBottom: 120 }}>
        <Text style={styles.title}>Care & Safety</Text>

        {/* Caregivers Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>My Caregivers</Text>
          <TouchableOpacity onPress={handleInviteCaregiver} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4 }}>
            <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
            <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.primary }}>Invite</Text>
          </TouchableOpacity>
        </View>

        {caregivers.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Ionicons name="people-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No caregivers linked yet.</Text>
            </View>
          </Card>
        ) : (
          <>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color="#0D9488" />
              <Text style={styles.infoText}>
                Tap the star to set a primary caregiver. They'll receive a phone call during falls. Others get SMS only.
              </Text>
            </View>

            {caregivers.map((cg) => (
              <Card key={cg.id} style={[styles.caregiverCard, cg.is_primary && styles.primaryCard]}>
                <View style={styles.caregiverRow}>
                  <TouchableOpacity
                    onPress={() =>
                      handleSetPrimary(cg.id, cg.caregiver?.full_name || 'Caregiver')
                    }
                    disabled={settingPrimary === cg.id}
                  >
                    {settingPrimary === cg.id ? (
                      <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                      <Ionicons
                        name={cg.is_primary ? 'star' : 'star-outline'}
                        size={24}
                        color={cg.is_primary ? '#F59E0B' : '#CBD5E1'}
                      />
                    )}
                  </TouchableOpacity>

                  <View style={styles.caregiverInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.caregiverName}>
                        {cg.caregiver?.full_name || 'Unknown'}
                      </Text>
                      {cg.is_primary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.caregiverDetail}>
                      📧 {cg.caregiver?.email || 'N/A'}
                    </Text>
                    <Text style={styles.caregiverDetail}>
                      📱 {cg.caregiver?.phone || 'N/A'}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Recent Falls */}
        <Text style={styles.sectionTitle}>Recent Fall Events</Text>

        {recentFalls.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', padding: 20 }}>
              <Ionicons name="shield-checkmark" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No fall events recorded.</Text>
            </View>
          </Card>
        ) : (
          recentFalls.map((fall) => {
            const response = getResponseLabel(fall.response);
            return (
              <Card key={fall.id} style={styles.fallCard}>
                <View style={styles.fallRow}>
                  <Ionicons
                    name={fall.response === 'dispatched' ? 'alert-circle' : 'checkmark-circle'}
                    size={20}
                    color={response.color}
                  />
                  <View style={styles.fallInfo}>
                    <Text style={styles.fallDate}>
                      {new Date(fall.created_at).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      at{' '}
                      {new Date(fall.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.fallBadge, { backgroundColor: response.color + '20' }]}>
                    <Text style={[styles.fallBadgeText, { color: response.color }]}>
                      {response.text}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#0F766E',
    lineHeight: 18,
  },
  caregiverCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  primaryCard: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  caregiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  caregiverInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  caregiverName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  },
  primaryBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    color: '#92400E',
  },
  caregiverDetail: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 8,
  },
  fallCard: { marginBottom: 8 },
  fallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fallInfo: { flex: 1 },
  fallDate: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textPrimary,
  },
  fallBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  fallBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
  },
});