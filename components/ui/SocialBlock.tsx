import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export function SocialBlock() {
  return (
    <View style={styles.container}>
      {/* The Divider */}
      <View style={styles.dividerContainer}>
        <View style={styles.line} />
        <Text style={styles.orText}>Or continue with</Text>
        <View style={styles.line} />
      </View>

      {/* The Buttons */}
      <View style={styles.row}>
        <TouchableOpacity 
          style={styles.socialBtn} 
          onPress={() => Alert.alert("Coming Soon", "Google Login coming in next update")}
        >
          <Ionicons name="logo-google" size={24} color="#DB4437" />
          <Text style={styles.btnText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.socialBtn}
          onPress={() => Alert.alert("Coming Soon", "Apple Login coming in next update")}
        >
          <Ionicons name="logo-apple" size={24} color="#000" />
          <Text style={styles.btnText}>Apple</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    marginBottom: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    marginHorizontal: 16,
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 30, // Pill shape
    paddingVertical: 12,
    gap: 8,
  },
  btnText: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
  }
});