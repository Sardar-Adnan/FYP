import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Colors } from '@/constants/Colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <AuthWrapper>
      <View style={styles.content}>
        <Logo />

        <Text style={styles.headline}>
          Welcome to your personal health companion.
        </Text>
        <Text style={styles.subheadline}>
          Please choose your role to get started with monitoring and safety.
        </Text>

        <View style={styles.buttons}>
          <Button 
            title="I am an Elderly Person" 
            size="large"
            onPress={() => router.push('/auth/sign-up-elderly')}
            style={{ marginBottom: 16 }}
          />
          <Button 
            title="I am a Caregiver" 
            size="large"
            variant="outline"
            onPress={() => router.push('/auth/sign-up-caregiver')}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.loginText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingTop: 10,
  },
  headline: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  buttons: {
    width: '100%',
    marginBottom: 30,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondary,
  },
  loginText: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    color: Colors.primary,
  },
});