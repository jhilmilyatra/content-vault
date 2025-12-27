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
    // Check for existing session
    const storedSession = localStorage.getItem(GUEST_SESSION_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession);
        setGuest(parsed);
      } catch (e) {
        localStorage.removeItem(GUEST_SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const passwordHash = await hashPassword(password);
      
      const { data, error } = await supabase
        .from('guest_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('password_hash', passwordHash)
        .maybeSingle();

      if (error) {
        console.error('Guest login error:', error);
        return { error: 'Failed to sign in' };
      }

      if (!data) {
        return { error: 'Invalid email or password' };
      }

      if (data.is_banned) {
        return { error: `Your account has been banned: ${data.ban_reason || 'Contact support'}` };
      }

      const guestUser: GuestUser = {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        is_banned: data.is_banned,
        ban_reason: data.ban_reason,
        created_at: data.created_at,
      };

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
      // Verify the share code exists and is active
      const { data: shareData, error: shareError } = await supabase
        .from('folder_shares')
        .select('id, folder_id, member_id, is_active')
        .eq('share_code', shareCode)
        .eq('is_active', true)
        .maybeSingle();

      if (shareError || !shareData) {
        return { error: 'Invalid or expired folder share link' };
      }

      const passwordHash = await hashPassword(password);

      // Check if email already exists
      const { data: existing } = await supabase
        .from('guest_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existing) {
        // User exists, check if already has access to this folder
        const { data: existingAccess } = await supabase
          .from('guest_folder_access')
          .select('id')
          .eq('guest_id', existing.id)
          .eq('folder_share_id', shareData.id)
          .maybeSingle();

        if (existingAccess) {
          return { error: 'You already have access to this folder. Please sign in instead.' };
        }

        // Add access to existing user
        const { error: accessError } = await supabase
          .from('guest_folder_access')
          .insert({
            guest_id: existing.id,
            folder_share_id: shareData.id,
            member_id: shareData.member_id,
          });

        if (accessError) {
          console.error('Error adding folder access:', accessError);
          return { error: 'Failed to add folder access' };
        }

        return { error: 'Folder added to your account. Please sign in.' };
      }

      // Create new guest user
      const { data: newGuest, error: createError } = await supabase
        .from('guest_users')
        .insert({
          email: email.toLowerCase(),
          password_hash: passwordHash,
          full_name: fullName,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating guest:', createError);
        return { error: 'Failed to create account' };
      }

      // Add folder access
      const { error: accessError } = await supabase
        .from('guest_folder_access')
        .insert({
          guest_id: newGuest.id,
          folder_share_id: shareData.id,
          member_id: shareData.member_id,
        });

      if (accessError) {
        console.error('Error adding folder access:', accessError);
        return { error: 'Account created but failed to add folder access' };
      }

      const guestUser: GuestUser = {
        id: newGuest.id,
        email: newGuest.email,
        full_name: newGuest.full_name,
        is_banned: newGuest.is_banned,
        ban_reason: newGuest.ban_reason,
        created_at: newGuest.created_at,
      };

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
