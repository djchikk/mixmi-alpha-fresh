import { supabase, supabaseAdmin, getSupabaseAdmin } from './supabase';
import type { ProfileData, SpotlightItem, MediaItem, ShopItem, GalleryItem } from '@/types';

// Database service functions for profile management
export class SupabaseProfileService {

  /**
   * Create a new profile with default sections
   */
  static async createNewProfile(walletAddress: string, profileData?: {
    name?: string;
    title?: string;
    bio?: string;
    socialLinks?: { [key: string]: string };
    sticker?: { id: string; visible: boolean };
    showWalletAddress?: boolean;
  }) {
    try {
      // First create the user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: `${walletAddress}@temp.mixmi.com`,
        password: 'temp-password-123',
        email_confirm: true
      });

      if (authError) {
        console.error('Auth creation error:', authError);
        return { success: false, error: authError.message };
      }

      const userId = authData.user.id;

             // Create profile with existing schema + new columns
       const { data: profile, error: profileError } = await supabaseAdmin
         .from('profiles')
         .insert({
           id: userId,
           username: `user_${userId.slice(0, 8)}`,
           display_name: profileData?.name || 'New User',
           bio: profileData?.bio || '',
           tagline: profileData?.title || '',
           sticker_id: profileData?.sticker?.id || null,
           sticker_visible: profileData?.sticker?.visible ?? true,
           show_wallet_address: profileData?.showWalletAddress ?? true,
           social_links: profileData?.socialLinks || {}
         })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        return { success: false, error: profileError.message };
      }

      // Create wallet auth entry
      const { error: walletError } = await supabaseAdmin
        .from('wallet_auth')
        .insert({
          user_id: userId,
          wallet_address: walletAddress,
          chain: 'stacks',
          is_primary: true,
          verified_at: new Date().toISOString()
        });

      if (walletError) {
        console.error('Wallet auth error:', walletError);
        return { success: false, error: walletError.message };
      }

             // Create default sections
       const defaultSections = [
         { user_id: userId, section_type: 'spotlight', title: 'Spotlight', display_order: 1, is_visible: true, config: [] },
         { user_id: userId, section_type: 'media', title: 'Media', display_order: 2, is_visible: true, config: [] },
         { user_id: userId, section_type: 'shop', title: 'Shop', display_order: 3, is_visible: true, config: [] },
         { user_id: userId, section_type: 'gallery', title: 'Gallery', display_order: 4, is_visible: true, config: [] }
       ];

      const { error: sectionsError } = await supabaseAdmin
        .from('profile_sections')
        .insert(defaultSections);

      if (sectionsError) {
        console.error('Sections creation error:', sectionsError);
        return { success: false, error: sectionsError.message };
      }

             // Create social links if provided
       if (profileData?.socialLinks) {
         const socialLinksData = Object.entries(profileData.socialLinks).map(([platform, url], index) => ({
           user_id: userId,
           title: `Follow me on ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
           url: url,
           icon: platform,  // ✅ Correct column name
           display_order: index,
           is_active: true
         }));

         const { error: linksError } = await supabaseAdmin
           .from('profile_links')
           .insert(socialLinksData);

         if (linksError) {
           console.error('Social links creation error:', linksError);
           return { success: false, error: linksError.message };
         }
       }

      return {
        success: true,
        userId,
        profile
      };

    } catch (error) {
      console.error('Profile creation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Load complete profile data from database
   */
  static async loadProfileData(userId: string) {
    try {
             // Load profile data
       const { data: profile, error: profileError } = await supabaseAdmin
         .from('profiles')
         .select('*')
         .eq('id', userId)
         .single();

      if (profileError) {
        console.error('Profile load error:', profileError);
        return { success: false, error: profileError.message };
      }

      // Load social links
      const { data: socialLinks, error: linksError } = await supabaseAdmin
        .from('profile_links')
        .select('*')
        .eq('user_id', userId);

      if (linksError) {
        console.error('Social links load error:', linksError);
        return { success: false, error: linksError.message };
      }

      // Load sections
      const { data: sections, error: sectionsError } = await supabaseAdmin
        .from('profile_sections')
        .select('*')
        .eq('user_id', userId);

      if (sectionsError) {
        console.error('Sections load error:', sectionsError);
        return { success: false, error: sectionsError.message };
      }

      // Transform to ProfileData format
      const profileData = this.transformDatabaseToProfileData({
        profile,
        socialLinks,
        sections
      });

      return {
        success: true,
        data: profileData
      };

    } catch (error) {
      console.error('Profile load failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save complete profile data to database
   */
  static async saveProfileData(userId: string, profileData: ProfileData) {
    try {
      const client = getSupabaseAdmin()
      if (!client) {
        console.log('🔄 Supabase not available, skipping cloud sync (localStorage-only mode)')
        return { success: true, message: 'Saved locally only - cloud storage not available' }
      }

      // Update profile with existing schema + new columns
      const { error: profileError } = await client
        .from('profiles')
        .update({
          display_name: profileData.name,
          bio: profileData.bio,
          tagline: profileData.title,
          sticker_id: profileData.sticker?.id || null,
          sticker_visible: profileData.sticker?.visible ?? true,
          show_wallet_address: profileData.showWalletAddress ?? true,
          social_links: {} // Keep empty, actual social links go in profile_links table
        })
        .eq('id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
        return { success: false, error: profileError.message };
      }

      // Update social links
      if (profileData.socialLinks) {
        // Delete existing links
        await client
          .from('profile_links')
          .delete()
          .eq('user_id', userId);

        // Insert new links
        const socialLinksData = profileData.socialLinks
          .filter(link => link.url && link.url.trim() !== '')
          .map((link, index) => ({
            user_id: userId,
            title: `Follow me on ${link.platform.charAt(0).toUpperCase() + link.platform.slice(1)}`,
            url: link.url,
            icon: link.platform,  // ✅ Correct column name
            display_order: index,
            is_active: true
          }));

        if (socialLinksData.length > 0) {
          const { error: linksError } = await client
            .from('profile_links')
            .insert(socialLinksData);

           if (linksError) {
             console.error('Social links update error:', linksError);
             return { success: false, error: linksError.message };
           }
         }
       }

      return { success: true };

    } catch (error) {
      console.error('Profile save failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Save section items (spotlight, media, shop, gallery)
   */
  static async saveSectionItems(
    userId: string, 
    sectionType: 'spotlight' | 'media' | 'shop' | 'gallery',
    items: SpotlightItem[] | MediaItem[] | ShopItem[] | GalleryItem[]
  ) {
    try {
      const client = getSupabaseAdmin()
      if (!client) {
        console.log(`🔄 Supabase not available, skipping ${sectionType} cloud sync (localStorage-only mode)`)
        return { success: true, message: 'Saved locally only - cloud storage not available' }
      }

      console.log(`Saving ${sectionType} items for user ${userId}:`, items);

      const { error } = await client
        .from('profile_sections')
        .update({ config: items })
        .eq('user_id', userId)
        .eq('section_type', sectionType);

      if (error) {
        console.error(`Error saving ${sectionType} items:`, error);
        return { success: false, error: error.message };
      }

      console.log(`Successfully saved ${items.length} ${sectionType} items to config`);
      return { success: true };

    } catch (error) {
      console.error(`Failed to save ${sectionType} items:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Transform database data back to ProfileData format
   */
  static transformDatabaseToProfileData(data: {
    profile: any;
    socialLinks: any[];
    sections: any[];
  }): ProfileData {
    const { profile, socialLinks, sections } = data;

    // Transform social links array to the format expected by existing types
    const socialLinksArray = socialLinks.map(link => ({
      platform: link.icon,  // ✅ Map icon back to platform
      url: link.url
    }));

    return {
      id: profile.id || '',
      name: profile.display_name || '',
      title: profile.tagline || '',
      bio: profile.bio || '',
      image: profile.avatar_url || '/placeholders/profile/profile-image.jpeg',
      socialLinks: socialLinksArray,
      sectionVisibility: {
        spotlight: true,
        media: true,
        shop: true,
        gallery: true,
        sticker: true
      },
      sectionTitles: {
        spotlight: 'SPOTLIGHT',
        media: 'MEDIA',
        shop: 'SHOP',
        gallery: 'GALLERY',
        sticker: 'STICKER'
      },
      showWalletAddress: profile.show_wallet_address ?? true,
      showBtcAddress: false,
      sticker: {
        id: profile.sticker_id || 'daisy-blue',
        visible: profile.sticker_visible ?? true
      }
    };
  }
}

// Export convenience functions
export const createNewProfile = SupabaseProfileService.createNewProfile.bind(SupabaseProfileService);
export const loadProfileData = SupabaseProfileService.loadProfileData.bind(SupabaseProfileService);
export const saveProfileData = SupabaseProfileService.saveProfileData.bind(SupabaseProfileService);
export const saveSectionItems = SupabaseProfileService.saveSectionItems.bind(SupabaseProfileService); 