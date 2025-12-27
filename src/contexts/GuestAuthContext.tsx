import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GuestUser {
  id: string;
  email: string;
  full_name: string | null;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
}

interface GuestAuthContextType {
  guest: GuestUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, shareCode: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const GuestAuthContext = createContext<GuestAuthContextType | undefined>(undefined);

const GUEST_SESSION_KEY = 'guest_session';

export const GuestAuthProvider = ({ children }: { children: ReactNode }) => {
  const [guest, setGuest] = useState<GuestUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem(GUEST_SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setGuest(parsed);
      } catch {
        localStorage.removeItem(GUEST_SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);


  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      // Use edge function for robust sign-in (consistent password hashing)
      const { data, error } = await supabase.functions.invoke('guest-signin', {
        body: { email, password }
      });

      if (error) {
        console.error('Guest sign-in function error:', error);
        return { error: error.message || 'Failed to sign in' };
      }

      if (!data.success) {
        return { error: data.error || 'Invalid email or password' };
      }

      const guestUser: GuestUser = data.guest;
      setGuest(guestUser);
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
      
      return { error: null };
    } catch (e) {
      console.error('Guest sign in error:', e);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    shareCode: string
  ): Promise<{ error: string | null }> => {
    try {
      // Use edge function for robust registration (bypasses RLS)
      const { data, error } = await supabase.functions.invoke('guest-register', {
        body: { email, password, fullName, shareCode }
      });

      if (error) {
        console.error('Guest registration function error:', error);
        return { error: error.message || 'Failed to create account' };
      }

      if (!data.success) {
        if (data.needsSignIn) {
          return { error: data.message };
        }
        return { error: data.error || 'Failed to create account' };
      }

      const guestUser: GuestUser = data.guest;
      setGuest(guestUser);
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(guestUser));
      
      return { error: null };
    } catch (e) {
      console.error('Guest sign up error:', e);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = () => {
    setGuest(null);
    localStorage.removeItem(GUEST_SESSION_KEY);
  };

  return (
    <GuestAuthContext.Provider value={{
      guest,
      loading,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </GuestAuthContext.Provider>
  );
};

export const useGuestAuth = () => {
  const context = useContext(GuestAuthContext);
  if (context === undefined) {
    throw new Error('useGuestAuth must be used within a GuestAuthProvider');
  }
  return context;
};
