import { supabase } from './supabase';

export interface UserProfile {
  wallet_address: string;
  display_name: string;
  tagline: string;
  bio: string;
  avatar_url?: string;
  sticker_id: string;
  sticker_visible: boolean;
  show_wallet_address: boolean;
  show_btc_address: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfileLink {
  id: string;
  wallet_address: string;
  platform: string;
  url: string;
  display_order: number;
  is_active: boolean;
}

export interface ProfileSection {
  id: string;
  wallet_address: string;
  section_type: 'spotlight' | 'media' | 'shop' | 'gallery';
  title: string;
  display_order: number;
  is_visible: boolean;
  config: any[];
}

export interface ProfileData {
  profile: UserProfile | null;
  links: ProfileLink[];
  sections: ProfileSection[];
}

export class UserProfileService {

  static async getProfile(walletAddress: string): Promise<ProfileData> {
    try {
      const [profileResult, linksResult, sectionsResult] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single(),
        supabase
          .from('user_profile_links')
          .select('*')
          .eq('wallet_address', walletAddress)
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('user_profile_sections')
          .select('*')
          .eq('wallet_address', walletAddress)
          .order('display_order')
      ]);

      return {
        profile: profileResult.data,
        links: linksResult.data || [],
        sections: sectionsResult.data || []
      };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return {
        profile: null,
        links: [],
        sections: []
      };
    }
  }

  static async initializeProfile(walletAddress: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('initialize_user_profile', {
        p_wallet_address: walletAddress
      });

      if (error) {
        console.error('Error initializing profile:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error initializing profile:', error);
      return false;
    }
  }

  static async updateProfile(
    walletAddress: string,
    updates: Partial<Omit<UserProfile, 'wallet_address' | 'created_at' | 'updated_at'>>
  ): Promise<boolean> {
    try {
      console.log('Updating profile for wallet:', walletAddress, 'with updates:', updates);

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('wallet_address', walletAddress)
        .select();

      if (error) {
        console.error('Supabase error updating profile:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw new Error(`Failed to update profile: ${error.message}`);
      }

      console.log('Profile update successful:', data);
      return true;
    } catch (error) {
      console.error('Exception updating profile:', error);
      throw error; // Re-throw to let caller handle it
    }
  }

  static async updateLinks(
    walletAddress: string,
    links: Array<{ platform: string; url: string }>
  ): Promise<boolean> {
    try {
      console.log('Updating links for wallet:', walletAddress, 'with links:', links);

      // First delete existing links
      const { error: deleteError } = await supabase
        .from('user_profile_links')
        .delete()
        .eq('wallet_address', walletAddress);

      if (deleteError) {
        console.error('Error deleting existing links:', deleteError);
        throw new Error(`Failed to delete existing links: ${deleteError.message}`);
      }

      // Then insert new links if any
      if (links.length > 0) {
        const linksData = links.map((link, index) => ({
          wallet_address: walletAddress,
          platform: link.platform,
          url: link.url,
          display_order: index,
          is_active: true
        }));

        const { data, error: insertError } = await supabase
          .from('user_profile_links')
          .insert(linksData)
          .select();

        if (insertError) {
          console.error('Error inserting links:', insertError);
          throw new Error(`Failed to insert links: ${insertError.message}`);
        }

        console.log('Links inserted successfully:', data);
      }

      return true;
    } catch (error) {
      console.error('Exception updating links:', error);
      throw error; // Re-throw to let caller handle it
    }
  }

  static async updateSectionVisibility(
    walletAddress: string,
    sectionType: string,
    isVisible: boolean
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profile_sections')
        .update({ is_visible: isVisible })
        .eq('wallet_address', walletAddress)
        .eq('section_type', sectionType);

      if (error) {
        console.error('Error updating section visibility:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating section visibility:', error);
      return false;
    }
  }

  static async updateSectionConfig(
    walletAddress: string,
    sectionType: string,
    config: any[]
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profile_sections')
        .update({ config })
        .eq('wallet_address', walletAddress)
        .eq('section_type', sectionType);

      if (error) {
        console.error('Error updating section config:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating section config:', error);
      return false;
    }
  }
}

export const {
  getProfile,
  initializeProfile,
  updateProfile,
  updateLinks,
  updateSectionVisibility,
  updateSectionConfig
} = UserProfileService;