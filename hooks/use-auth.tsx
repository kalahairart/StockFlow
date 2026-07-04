import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  setMockRole: (role: 'admin' | 'operator') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
  setMockRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockRole, setMockRoleState] = useState<'admin' | 'operator' | null>(null);

  const isAdmin = mockRole 
    ? mockRole === 'admin' 
    : user?.email === 'candrarusmanndoko@gmail.com' || user?.email?.includes('admin') || user?.user_metadata?.role === 'admin' || false;

  const setMockRole = (role: 'admin' | 'operator') => {
    setMockRoleState(role);
    if (user) {
      const updatedUser = {
        ...user,
        user_metadata: {
          ...user.user_metadata,
          role: role
        }
      };
      setUser(updatedUser);
      localStorage.setItem('stockflow_active_user', JSON.stringify(updatedUser));
    }
  };

  useEffect(() => {
    if (user) {
      const syncUserSession = async () => {
        try {
          const profileData = {
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown Operator',
            role: isAdmin ? 'admin' : 'operator',
            created_at: user.created_at || new Date().toISOString(),
            last_active: new Date().toISOString()
          };

          // Try to sync with Supabase (will succeed if users table is created, or fail silently if not yet created)
          try {
            const { error } = await supabase
              .from('users')
              .upsert(profileData, { onConflict: 'id' });

            if (error) {
              console.warn("User sync directly to database failed:", error.message);
            }
          } catch (dbErr) {
            console.warn("DB write error during user sync:", dbErr);
          }

          // Maintain the localStorage user list so pages have a guaranteed fallback
          let localUsers = [];
          const localUsersStr = localStorage.getItem('stockflow_local_users');
          if (localUsersStr) {
            try {
              localUsers = JSON.parse(localUsersStr);
            } catch (_) {
              localUsers = [];
            }
          }

          if (!Array.isArray(localUsers) || localUsers.length === 0) {
            // Seed default users if empty
            localUsers = [
              {
                id: '474a93dc-2432-4298-9fa5-95e3ef85fc7b',
                email: 'admin@obsidian.com',
                full_name: 'Candra Rusmanndoko',
                role: 'admin',
                created_at: '2026-05-16T13:00:00Z',
                last_active: new Date().toISOString()
              },
              {
                id: 'a0b1c2d3-e4f5-5678-90ab-cdef01234567',
                email: 'operator@mesh.com',
                full_name: 'Standard Operator',
                role: 'operator',
                created_at: '2026-05-17T14:20:00Z',
                last_active: new Date().toISOString()
              }
            ];
          }

          // Insert or update current user in the local roster list
          const existingIndex = localUsers.findIndex((u: any) => u.id === profileData.id || u.email === profileData.email);
          if (existingIndex > -1) {
            localUsers[existingIndex] = { ...localUsers[existingIndex], ...profileData };
          } else {
            localUsers.push(profileData);
          }

          // Save back to local storage
          localStorage.setItem('stockflow_local_users', JSON.stringify(localUsers));
        } catch (e) {
          console.warn("User sync caching failed:", e);
        }
      };
      syncUserSession();
    }
  }, [user, isAdmin]);

  useEffect(() => {
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
          if (session?.user?.user_metadata?.role) {
            setMockRoleState(session.user.user_metadata.role);
          }
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.user_metadata?.role) {
        setMockRoleState(session.user.user_metadata.role);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMockRoleState(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, isAdmin, setMockRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
