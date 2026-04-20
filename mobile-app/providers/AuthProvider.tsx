import { Timeouts } from '@/constants/config';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
    let timeout: ReturnType<typeof setTimeout>;

    const stopLoading = () => {
      if (isMounted) {
        setLoading(false);
      }
      clearTimeout(timeout);
    };

    // 1. SAFETY TIMEOUT: Force stop loading if Supabase is stuck
    // This prevents the infinite spinner on physical devices with slow networks
    timeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Auth check timed out. Forcing app to load.');
        stopLoading();
      }
    }, Timeouts.AUTH_CHECK);

    // 2. Normal Session Check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;

      if (error) {
        console.warn('Supabase session error:', error.message);
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          // Force sign out to clean up invalid state
          supabase.auth.signOut();
        }
      }

      setSession(session);

      if (session) {
        fetchProfile(session.user.id).finally(stopLoading);
      } else {
        stopLoading();
      }
    }).catch(err => {
      console.error("Session check failed:", err);
      stopLoading();
    });

    // 3. Listen for Auth Changes (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      if (_event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        stopLoading();
        return;
      }

      setSession(session);

      if (session) {
        await fetchProfile(session.user.id);
        stopLoading();
      } else {
        setUser(null);
        stopLoading();
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

        // Auto-resync notifications for elderly users on login/app start
        if (data.role === 'elderly') {
          import('@/utils/notifications').then(({ resyncNotifications }) => {
            resyncNotifications();
          });
        }
      } else {
        console.warn(`Profile fetch returned null for user ${userId}. Row might be missing or RLS blocked.`);
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