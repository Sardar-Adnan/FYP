import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Alert, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { dispatchEmergency } from '@/services/emergencyService';

const { width } = Dimensions.get('window');
const TAB_HEIGHT = 70; // Height of the bar content
const PROTRUSION = 30; // How much the button sticks out
const ARC_WIDTH = 100; // Width of the curve

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [sosLoading, setSosLoading] = React.useState(false);
  // Total height includes safe area for bottom navigation bar
  const totalHeight = TAB_HEIGHT + insets.bottom;

  // Smooth arc path generation
  // We want a curve that starts flat, dips gently, and returns flat
  const center = width / 2;

  // Constructing a smoother path
  // 0,0 is top-left of the SVG area
  const path = `
    M 0 0
    L ${center - 60} 0
    C ${center - 40} 0, ${center - 40} 45, ${center} 45
    C ${center + 40} 45, ${center + 40} 0, ${center + 60} 0
    L ${width} 0
    L ${width} ${totalHeight}
    L 0 ${totalHeight}
    Z
  `;

  const handleSOS = () => {
    Alert.alert(
      '🚨 Emergency SOS',
      'This will immediately alert ALL your caregivers with your GPS location.\n\nYour primary caregiver will receive a phone call.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              const result = await dispatchEmergency('sos_manual');
              if (result.success) {
                Alert.alert(
                  'SOS Sent ✅',
                  `Emergency alert sent to ${result.caregiversFound} caregiver(s).\n\nHelp is on the way.`
                );
              } else {
                Alert.alert(
                  'SOS Alert',
                  result.caregiversFound === 0
                    ? 'No caregivers are linked to your account. Please ask a caregiver to connect with you first.'
                    : `Emergency dispatch encountered an issue: ${result.error || 'Please try again.'}`
                );
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to send SOS. Please call emergency services directly.');
              console.error('[SOS] Error:', error);
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.tabBarContainer, { height: totalHeight }]}>
      <Svg
        width={width}
        height={totalHeight}
        style={StyleSheet.absoluteFillObject}
      >
        <Path d={path} fill={Colors.primary} />
      </Svg>

      <View style={[styles.tabItemsContainer, { height: TAB_HEIGHT, paddingBottom: 0 }]}>
        {/* Left Side: Home and Vitals */}
        <View style={styles.groupContainer}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            // Only render specific routes on the left
            if (route.name !== 'dashboard' && route.name !== 'vitals') return null;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tabItem}
              >
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color: isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  size: 24,
                })}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Center Spacer for SOS Button */}
        <View style={{ width: ARC_WIDTH }} />

        {/* Right Side: Meds and Care */}
        <View style={styles.groupContainer}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            // Only render specific routes on the right
            if (route.name !== 'medication' && route.name !== 'care') return null;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tabItem}
              >
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color: isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
                  size: 24,
                })}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Floating SOS Button - Positioned relative to top of bar */}
      <TouchableOpacity
        style={[styles.sosButton, { top: -20 }]}
        onPress={handleSOS}
        disabled={sosLoading}
        activeOpacity={0.8}
      >
        <View style={styles.sosCircle}>
          <Ionicons name="alert" size={32} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default function ElderlyLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="vitals"
        options={{
          title: 'Vitals',
          tabBarIcon: ({ color }) => <Ionicons name="pulse" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sos-action"
        options={{
          title: '',
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
          },
        })}
      />
      <Tabs.Screen
        name="medication"
        options={{
          title: 'Meds',
          tabBarIcon: ({ color }) => <Ionicons name="medkit" size={24} color={color} />,
        }}
      />
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
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Height is dynamic now
    elevation: 0, // Remove default Android shadow to rely on SVG
    backgroundColor: 'transparent',
  },
  tabItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0, // Removed padding as groups handle spacing
  },
  groupContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    width: 60, // Fixed width for touch target
  },
  sosButton: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    // top is set inline
  },
  sosCircle: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#F8FAFC', // White/Light border to separate from blue
  },
});