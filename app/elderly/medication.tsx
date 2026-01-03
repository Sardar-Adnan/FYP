import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

// Custom Tab Bar Button for the SOS
const CustomSOSButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    style={{
      top: -30, // Move it up to overlap
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow,
    }}
    onPress={onPress}
  >
    <View
      style={{
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: Colors.danger, // Red color
        borderWidth: 4,
        borderColor: '#FFFFFF', // White border to separate from blue bar
      }}
    >
      {children}
    </View>
  </TouchableOpacity>
);

export default function ElderlyLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFFFFF', // White for active
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)', // Faded white for inactive
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          
          backgroundColor: Colors.primary, // Blue theme
          borderRadius: 15, // Rounded corners for the floating bar
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          ...styles.shadow,
        },
        tabBarLabelStyle: {
          fontFamily: 'Poppins-SemiBold',
          fontSize: 10,
          marginBottom: 5,
        },
      }}
    >
      {/* 1. Home Screen */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={24} color={color} />
          ),
        }}
      />

      {/* 2. Vitals Screen */}
      <Tabs.Screen
        name="vitals"
        options={{
          title: 'Vitals',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse" size={24} color={color} />
          ),
        }}
      />

      {/* 3. The Central SOS Button (Fake Screen) */}
      <Tabs.Screen
        name="sos-action" 
        options={{
          title: '',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="alert" size={35} color="#FFFFFF" />
          ),
          tabBarButton: (props) => (
            <CustomSOSButton {...props} onPress={() => alert('SOS Triggered!')} />
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault(); // Prevent navigation, just trigger action
          },
        })}
      />

      {/* 4. Medication Screen */}
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Meds',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="medkit" size={24} color={color} />
          ),
        }}
      />

      {/* 5. Care & Safety Screen */}
      <Tabs.Screen
        name="care"
        options={{
          title: 'Care',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000', // IOS
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    elevation: 5, // Android
  },
});