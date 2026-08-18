'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'operator' | 'user' | 'engineering';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEngineering: boolean;
  userRole: UserRole;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  isEngineering: false,
  userRole: 'operator',
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbProfile, setDbProfile] = useState<{ role?: string; full_name?: string } | null>(null);

  // Fetch actual profile from Supabase 'profiles' table whenever user changes
  useEffect(() => {
    async function fetchDatabaseProfile() {
      if (!user) {
        setDbProfile(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (!error && data) {
          setDbProfile(data);
        } else {
          // If not found by ID, try by email
          if (user.email) {
            const { data: emailData, error: emailErr } = await supabase
              .from('profiles')
              .select('role, full_name')
              .eq('email', user.email)
              .maybeSingle();
            if (!emailErr && emailData) {
              setDbProfile(emailData);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch profile from Supabase DB:', err);
      }
    }

    fetchDatabaseProfile();
  }, [user]);

  const rawRole: string = (dbProfile?.role || user?.user_metadata?.role || '').toLowerCase();
  const isAdmin = user?.email === 'candrarusmanndoko@gmail.com' || user?.email?.includes('admin') || rawRole === 'admin' || false;
  const isEngineering = rawRole === 'engineering';
  const userRole: UserRole = isAdmin ? 'admin' : (isEngineering ? 'engineering' : 'operator');

  useEffect(() => {
    if (user) {
      const syncUserSession = async () => {
        try {
          await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: user.id,
              email: user.email,
              full_name: dbProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0],
              role: isAdmin ? 'admin' : (isEngineering ? 'engineering' : 'operator'),
            }),
          });
        } catch (e) {
          console.warn("User sync caching failed:", e);
        }
      };
      syncUserSession();
    }
  }, [user, isAdmin, isEngineering, dbProfile]);

  useEffect(() => {
    // Check active sessions and sets the user
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Auth session error:", error.message);
          
          const errMsg = error.message.toLowerCase();
          const isStaleSession = 
            errMsg.includes('refresh token') || 
            errMsg.includes('invalid_grant') || 
            errMsg.includes('not found') ||
            errMsg.includes('session');

          if (isStaleSession) {
            try {
              await supabase.auth.signOut();
            } catch (signOutError) {
              console.warn("signOut error during session recovery:", signOutError);
            }
            
            // Defensively scrub local storage to prevent any stuck invalid token scenarios
            if (typeof window !== 'undefined') {
              try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                  const key = window.localStorage.key(i);
                  if (key && (key.startsWith('sb-') || key.includes('auth-token'))) {
                    keysToRemove.push(key);
                  }
                }
                keysToRemove.forEach(k => window.localStorage.removeItem(k));
              } catch (lsError) {
                console.error("Failed to clear localStorage keys:", lsError);
              }
            }
            setUser(null);
          }
        } else {
          setUser(session?.user ?? null);
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, isAdmin, isEngineering, userRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
