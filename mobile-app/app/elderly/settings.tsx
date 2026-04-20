import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { InputField } from '@/components/ui/InputField';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');

  // Track changes
  const [hasChanges, setHasChanges] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || '');

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
        setPhone(profile.phone || '');
        setAge(profile.age ? String(profile.age) : '');
        setGender(profile.gender || '');
        setHeight(profile.height ? String(profile.height) : '');
        setWeight(profile.weight ? String(profile.weight) : '');
        setAddress(profile.address || '');
      }
      setHasChanges(false);
    } catch (error) {
      console.error('[Settings] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const handleFieldChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    setHasChanges(true);
  };

  const handleGenderChange = (val: 'male' | 'female') => {
    setGender(val);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required', 'Full name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update users table
      const { error: dbError } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          age: age ? parseInt(age) : null,
          gender: gender || null,
          height: height ? parseInt(height) : null,
          weight: weight ? parseInt(weight) : null,
          address: address.trim(),
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      // Update auth metadata (for dashboard greeting)
      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          age: age ? parseInt(age) : null,
        },
      });

      setHasChanges(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error: any) {
      console.error('[Settings] Save error:', error);
      Alert.alert('Error', error.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'We will send a password reset link to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) throw error;
              Alert.alert('Email Sent', 'Check your inbox for the password reset link.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send reset email.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/welcome');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Ionicons name="arrow-back" size={28} color="#FFF" onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="arrow-back" size={28} color="#FFF" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Settings</Text>
        {hasChanges ? (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.saveBtn}>Save</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Profile Section */}
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.sectionCard}>
            <InputField
              label="Full Name"
              icon="person-outline"
              placeholder="Your name"
              value={fullName}
              onChangeText={handleFieldChange(setFullName)}
            />
            <InputField
              label="Phone"
              icon="call-outline"
              placeholder="Phone number"
              value={phone}
              onChangeText={handleFieldChange(setPhone)}
              keyboardType="phone-pad"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <InputField
                  label="Age"
                  icon="calendar-outline"
                  placeholder="65"
                  value={age}
                  onChangeText={handleFieldChange(setAge)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <InputField
                  label="Email"
                  icon="mail-outline"
                  placeholder=""
                  value={email}
                  editable={false}
                  style={{ color: Colors.textSecondary }}
                />
              </View>
            </View>

            {/* Gender Selection */}
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
                onPress={() => handleGenderChange('male')}
              >
                <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
                onPress={() => handleGenderChange('female')}
              >
                <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <InputField
                  label="Height (cm)"
                  icon="resize-outline"
                  placeholder="165"
                  value={height}
                  onChangeText={handleFieldChange(setHeight)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <InputField
                  label="Weight (kg)"
                  icon="fitness-outline"
                  placeholder="70"
                  value={weight}
                  onChangeText={handleFieldChange(setWeight)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <InputField
              label="Home Address"
              icon="home-outline"
              placeholder="123 Main St, City"
              value={address}
              onChangeText={handleFieldChange(setAddress)}
            />
          </View>

          {/* Account Section */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
              <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="key-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              </View>
              <Text style={[styles.menuText, { color: Colors.danger }]}>Log Out</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>OldCare App v1.0.0</Text>
            <Text style={styles.appInfoText}>Final Year Project</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#FFF',
  },
  saveBtn: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#FFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 8,
    marginLeft: 8,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  genderButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  genderText: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textSecondary,
  },
  genderTextActive: {
    color: Colors.primary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: Colors.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  appInfoText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
});
