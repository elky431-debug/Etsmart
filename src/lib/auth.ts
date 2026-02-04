import { supabase, isSupabaseConfigured } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string;
}

// Helper to check if Supabase is configured before use
function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  }
}

// Sign up with email and password
export async function signUp(email: string, password: string, fullName?: string) {
  ensureSupabaseConfigured();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      // Disable email verification requirement
      // User will be automatically logged in after signup
    },
  });

  if (error) throw error;

  // User profile will be created automatically by the database trigger
  // If trigger is not set up, we create it manually as fallback (non-blocking)
  if (data.user) {
    // Small delay to let trigger execute first
    setTimeout(async () => {
      try {
        await supabase
          .from('users')
          .insert({
            id: data.user!.id,
            email: data.user!.email!,
            full_name: fullName,
          })
          .select()
          .single();
      } catch (err: any) {
        // Silently ignore - trigger likely already created it or user exists
        // This is not critical for user signup
      }
    }, 300);
  }

  return { user: data.user, session: data.session };
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
  ensureSupabaseConfigured();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return { user: data.user, session: data.session };
}

// Sign out
export async function signOut() {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Get current user
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get current session
export async function getSession() {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void) {
  if (!isSupabaseConfigured()) {
    // Return a mock subscription that does nothing
    // Call callback immediately with null to indicate no user
    callback(null);
    return {
      data: { subscription: { unsubscribe: () => {} } }
    };
  }
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// Sign in with Google (OAuth)
export async function signInWithGoogle() {
  ensureSupabaseConfigured();
  // Use client-side callback page instead of server route
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback';
  
  console.log('🔵 Starting Google OAuth flow');
  console.log('Redirect to:', redirectTo);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error('❌ Error starting OAuth flow:', error);
    throw error;
  }
  
  console.log('✅ OAuth flow started, redirecting to:', data.url);
  // The redirect happens automatically via data.url
  return data;
}

// Reset password
export async function resetPassword(email: string) {
  ensureSupabaseConfigured();
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : '/reset-password';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) throw error;
}

// Update password
export async function updatePassword(newPassword: string) {
  ensureSupabaseConfigured();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

