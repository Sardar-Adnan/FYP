import React from 'react';
import { 
  View, 
  StyleSheet, 
  StatusBar, 
  Platform, 
  KeyboardAvoidingView,
  ViewStyle 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  bg?: string;
  style?: ViewStyle;
}

export function ScreenWrapper({ 
  children, 
  bg = Colors.background, 
  style 
}: ScreenWrapperProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={bg} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.content, style]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24, // Consistent padding for all screens
  },
});