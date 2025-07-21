import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase client with custom auth options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,         // Persist session in storage
    storageKey: 'auth-storage',   // Key for localStorage
    autoRefreshToken: true,       // Automatically refresh tokens
    detectSessionInUrl: true      // Detect session from URL (OAuth)
  }
});

// Listen for authentication state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' && typeof window !== 'undefined') {
    // Clear stored session data on sign out
    localStorage.removeItem('auth-storage');
    // Redirect to login page if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  } else if (event === 'TOKEN_REFRESHED') {
    // Log token refresh event
    console.log('Token has been refreshed');
  }
});

// Helper function to check if the current session is valid
export const checkSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('Error checking session:', error);
    return null;
  }
};