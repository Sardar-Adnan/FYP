import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

type AuthContextType = {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. SAFETY TIMEOUT: Force stop loading after 5 seconds if Supabase is stuck
    // This prevents the infinite spinner on physical devices with slow networks
    const timeout = setTimeout(() => {
      if (isMounted && loading) {
        console.log("⚠️ Auth check timed out. Forcing app to load.");
        setLoading(false);
      }
    }, 5000);

    // 2. Normal Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error("Session check failed:", err);
      if (isMounted) setLoading(false);
    });

    // 3. Listen for Auth Changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      
      if (session) {
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else if (data) {
        setUser(data as UserProfile);
      }
    } catch (e) {
      console.error(e);
    } finally {
      // Always stop loading, even if profile fetch fails
      setLoading(false);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        isAdmin: user?.role === 'caregiver',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}