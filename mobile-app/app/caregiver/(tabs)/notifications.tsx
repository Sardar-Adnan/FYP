import { Card } from '@/components/ui/Card';
import { ScreenWrapper } from '@/components/ui/ScreenWrapper';
import { Colors } from '@/constants/Colors';
import {
  generateNotifications,
  getLinkedPatient,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/caregiverService';
import { CaregiverNotification } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CaregiverNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<CaregiverNotification[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Generate any new notifications first
      const linked = await getLinkedPatient();
      if (linked) {
        await generateNotifications(linked.patientId);
      }

      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('[CaregiverNotifications] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const getNotifConfig = (type: string) => {
    switch (type) {
      case 'medication_missed':
        return {
          icon: 'close-circle' as const,
          color: '#EF4444',
          bgColor: '#FEE2E2',
        };
      case 'medication_skipped':
        return {
          icon: 'play-skip-forward' as const,
          color: '#F59E0B',
          bgColor: '#FEF3C7',
        };
      case 'abnormal_vitals':
        return {
          icon: 'warning' as const,
          color: '#EF4444',
          bgColor: '#FEE2E2',
        };
      case 'no_daily_vitals':
        return {
          icon: 'pulse-outline' as const,
          color: '#F59E0B',
          bgColor: '#FEF3C7',
        };
      case 'fall_detected':
        return {
          icon: 'alert-circle' as const,
          color: '#DC2626',
          bgColor: '#FEE2E2',
        };
      case 'medication_added':
        return {
          icon: 'medkit' as const,
          color: Colors.primary,
          bgColor: '#F0FDFA',
        };
      default:
        return {
          icon: 'notifications' as const,
          color: Colors.textSecondary,
          bgColor: '#F1F5F9',
        };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
          <View>
            <Text style={styles.title}>Alerts</Text>
            {unreadCount > 0 && (
              <Text style={styles.subtitle}>
                {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
            >
              <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No notifications yet.</Text>
            <Text style={styles.emptySubtext}>
              Alerts will appear here when something needs your attention.
            </Text>
          </View>
        ) : (
          notifications.map((notif) => {
            const config = getNotifConfig(notif.type);
            return (
              <TouchableOpacity
                key={notif.id}
                onPress={() => !notif.is_read && handleMarkRead(notif.id)}
                activeOpacity={0.7}
              >
                <Card
                  style={[
                    styles.notifCard,
                    !notif.is_read && styles.notifCardUnread,
                  ]}
                >
                  <View style={styles.notifRow}>
                    <View
                      style={[
                        styles.notifIcon,
                        { backgroundColor: config.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={config.icon}
                        size={20}
                        color={config.color}
                      />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTopRow}>
                        <Text
                          style={[
                            styles.notifTitle,
                            !notif.is_read && styles.notifTitleUnread,
                          ]}
                        >
                          {notif.title}
                        </Text>
                        {!notif.is_read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifTime}>
                        {formatTimeAgo(notif.created_at)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255,255,255,0.7)',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  markAllText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 40,
  },
  notifCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notifCardUnread: {
    backgroundColor: '#F8FFFE',
    borderColor: '#99F6E4',
    borderWidth: 1,
  },
  notifRow: {
    flexDirection: 'row',
    gap: 12,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
    flex: 1,
  },
  notifTitleUnread: {
    fontFamily: 'Poppins-Bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notifMessage: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#94A3B8',
    marginTop: 6,
  },
});
