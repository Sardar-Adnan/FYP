import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

// Custom Floating SOS Button Component
const CustomSOSButton = ({ children, onPress }: any) => (
  <TouchableOpacity
    // Pushes the button up 30 points to overlap the bar
    style={{
      top: -30, 
      justifyContent: 'center',
      alignItems: 'center',
      ...styles.shadow,
    }}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View
      style={{
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: Colors.danger, // Red Theme
        borderWidth: 4,
        borderColor: '#F8FAFC', // Matches background to look clean
        justifyContent: 'center',
        alignItems: 'center',
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
        // Text/Icon Colors
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarStyle: {
          // Positioning
          position: 'absolute',
          bottom: 0, // Anchored to the very bottom
          left: 0,
          right: 0,
          // Appearance
          backgroundColor: Colors.primary, // Blue Theme
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 0,
         
          ...styles.shadow,
        },
        tabBarLabelStyle: {
          fontFamily: 'Poppins-SemiBold',
          fontSize: 10,
          marginBottom: 5,
        },
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />

      {/* 2. Vitals */}
      <Tabs.Screen
        name="vitals"
        options={{
          title: 'Vitals',
          tabBarIcon: ({ color }) => <Ionicons name="pulse" size={24} color={color} />,
        }}
      />

      {/* 3. SOS Button (Center) - This is the custom element */}
      <Tabs.Screen
        name="sos-action"
        options={{
          title: '', // No label
          tabBarIcon: () => <Ionicons name="alert" size={32} color="#FFFFFF" />,
          // Override the button to use our custom floating component
          tabBarButton: (props) => (
            <CustomSOSButton {...props} onPress={() => Alert.alert('SOS', 'Calling Emergency Contacts...')} />
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault(); // Stop navigation, just trigger the action
          },
        })}
      />

      {/* 4. Meds */}
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Meds',
          tabBarIcon: ({ color }) => <Ionicons name="medkit" size={24} color={color} />,
        }}
      />

      {/* 5. Care */}
      <Tabs.Screen
        name="care"
        options={{
          title: 'Care',
          tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 }, // Shadow appears on top of the bar
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
});