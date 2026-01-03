




import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// ⚠️ REPLACE WITH YOUR ACTUAL KEYS
const supabaseUrl = 'https://rpcyfnfdtmwffzinvdpp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwY3lmbmZkdG13ZmZ6aW52ZHBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjk0ODcsImV4cCI6MjA3OTg0NTQ4N30.uIwVZmJU6Yymw3_cvTIIf7kXKQtxMSbF3q2O-asd6kw';

// Helper to prevent "window is not defined" error during server-side rendering
const CustomStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve(null);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return Promise.resolve();
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: CustomStorage, // Use our safe wrapper instead of direct AsyncStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});