import { createClient, SupabaseClient } from '@supabase/supabase-js'

// TEMPORARY: Disable Supabase for testing TrackCard functionality
const DISABLE_SUPABASE = false;

// Singleton pattern with lazy initialization - fixes HMR/timing issues
class SupabaseService {
  private static instance: SupabaseService;
  private adminClient: SupabaseClient | null = null;
  private regularClient: SupabaseClient | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  private ensureInitialized() {
    if (this.initialized) return;

    if (DISABLE_SUPABASE) {
      console.log('🔧 Supabase DISABLED for testing');
      this.initialized = true;
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Supabase Environment:', {
        url: supabaseUrl ? 'Loaded ✅' : 'Missing ❌',
        anonKey: supabaseAnonKey ? 'Loaded ✅' : 'Missing ❌',
        serviceKey: supabaseServiceKey ? 'Loaded ✅' : 'Missing ❌'
      })
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('⚠️ Supabase environment variables not found');
      return;
    }

    // Initialize regular client
    try {
      this.regularClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false, // Important for server-side
          autoRefreshToken: false,
        },
      });
      console.log('✅ Supabase regular client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize regular client:', error);
    }

    // Initialize admin client if service key exists
    if (supabaseServiceKey) {
      try {
        this.adminClient = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        console.log('✅ Supabase admin client initialized');
      } catch (error) {
        console.error('❌ Failed to initialize admin client:', error);
      }
    }

    this.initialized = true;
  }

  getAdmin() {
    this.ensureInitialized();
    return this.adminClient;
  }

  getClient() {
    this.ensureInitialized();
    return this.regularClient;
  }

  // Check if Supabase is available
  isAvailable(): boolean {
    if (DISABLE_SUPABASE) return false;
    this.ensureInitialized();
    return this.adminClient !== null || this.regularClient !== null;
  }
}

// Helper function to check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return SupabaseService.getInstance().isAvailable();
}

// Helper function to check if service role is configured
export const isServiceRoleConfigured = () => {
  return SupabaseService.getInstance().getAdmin() !== null;
}

// Helper function to get configuration errors
export const getSupabaseConfigErrors = () => {
  const errors = []
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) errors.push('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!supabaseAnonKey) errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  if (!supabaseServiceKey) errors.push('SUPABASE_SERVICE_ROLE_KEY is not set')
  return errors
}

// Export singleton instance methods
export const getSupabaseAdmin = () => SupabaseService.getInstance().getAdmin();
export const getSupabaseClient = () => SupabaseService.getInstance().getClient();
export const isSupabaseAvailable = () => SupabaseService.getInstance().isAvailable();

// Legacy exports for backward compatibility
export const supabase = SupabaseService.getInstance().getClient();
export const supabaseAdmin = SupabaseService.getInstance().getAdmin(); 