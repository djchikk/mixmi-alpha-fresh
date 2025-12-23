import { NextRequest, NextResponse } from 'next/server'
import { 
  createNewProfile, 
  loadProfileData, 
  saveProfileData, 
  saveSectionItems 
} from '@/lib/supabase-profile'
import { placeholderProfile, placeholderSpotlightItems } from '@/lib/placeholderData'

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()

    switch (action) {
      case 'createProfile':
        const createResult = await createNewProfile(data.walletAddress, data.profileData)
        return NextResponse.json(createResult)

      case 'loadProfile':
        // Temporarily disable this to fix the sync error
        return NextResponse.json({ success: false, error: 'Load profile temporarily disabled' })
        // const loadResult = await loadProfileData(data.userId)
        // return NextResponse.json(loadResult)

      case 'saveProfile':
        const saveResult = await saveProfileData(data.profileData)
        return NextResponse.json(saveResult)

      case 'saveSectionItems':
        const saveItemsResult = await saveSectionItems(data.userId, data.sectionType, data.items)
        return NextResponse.json(saveItemsResult)

      case 'testWithPlaceholder':
        // Create profile with placeholder data
        const uniqueWalletAddress = `test-wallet-${Date.now()}`;
        
        // Transform social links array to object for the new API
        const socialLinksObj: { [key: string]: string } = {};
        placeholderProfile.socialLinks.forEach(link => {
          socialLinksObj[link.platform] = link.url;
        });
        
        const placeholderResult = await createNewProfile(uniqueWalletAddress, {
          name: placeholderProfile.name,
          title: placeholderProfile.title,
          bio: placeholderProfile.bio,
          socialLinks: socialLinksObj,
          sticker: placeholderProfile.sticker,
          showWalletAddress: placeholderProfile.showWalletAddress
        });
        
        if (placeholderResult.success && placeholderResult.userId) {
          // Import all placeholder data
          const { 
            placeholderMediaItems, 
            placeholderShopItems, 
            placeholderGalleryItems 
          } = await import('@/lib/placeholderData');
          
          // Save complete profile data (including social links and sticker)
          const completeProfileData = {
            ...placeholderProfile,
            id: placeholderResult.userId, // Use the actual user ID from the database
          };
          
          const profileSaveResult = await saveProfileData(placeholderResult.userId, completeProfileData);
          
          // Save all section items
          const results = await Promise.all([
            saveSectionItems(placeholderResult.userId, 'spotlight', placeholderSpotlightItems),
            saveSectionItems(placeholderResult.userId, 'media', placeholderMediaItems),
            saveSectionItems(placeholderResult.userId, 'shop', placeholderShopItems),
            saveSectionItems(placeholderResult.userId, 'gallery', placeholderGalleryItems)
          ]);
          
          const [spotlightResult, mediaResult, shopResult, galleryResult] = results;
          
          return NextResponse.json({
            success: true,
            userId: placeholderResult.userId,
            profileCreated: true,
            profileDataSaved: profileSaveResult.success,
            profileDataError: profileSaveResult.error,
            results: {
              spotlight: { saved: spotlightResult.success, error: spotlightResult.error },
              media: { saved: mediaResult.success, error: mediaResult.error },
              shop: { saved: shopResult.success, error: shopResult.error },
              gallery: { saved: galleryResult.success, error: galleryResult.error }
            }
          })
        } else {
          return NextResponse.json(placeholderResult)
        }

      case 'testLoadAllSections':
        // Test loading all section data for a user
        try {
          const userId = data.userId;
          if (!userId) {
            return NextResponse.json({
              success: false,
              error: 'User ID is required'
            });
          }

          // Load profile data
          const profileResult = await loadProfileData(userId);
          
          // Load all section items directly
          const { supabaseAdmin } = await import('@/lib/supabase');
          const { data: sections, error: sectionsError } = await supabaseAdmin
            .from('profile_sections')
            .select('section_type, config')
            .eq('user_id', userId);

          if (sectionsError) {
            return NextResponse.json({
              success: false,
              error: `Failed to load sections: ${sectionsError.message}`
            });
          }

          // Organize sections by type
          const sectionData: Record<string, any> = {};
          sections?.forEach(section => {
            sectionData[section.section_type] = section.config?.items || [];
          });

          return NextResponse.json({
            success: true,
            userId,
            profile: profileResult.data,
            sections: sectionData,
            sectionCounts: {
              spotlight: sectionData.spotlight?.length || 0,
              media: sectionData.media?.length || 0,
              shop: sectionData.shop?.length || 0,
              gallery: sectionData.gallery?.length || 0
            }
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Load sections test error: ${error}`
          });
        }

      case 'testWalletAuth':
        // Test wallet_auth table structure
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          
          // Try different possible column names
          const testUserId = 'test-user-id-123';
          const testWallet = 'test-wallet-address';
          
          // Try inserting with common column name variations
          const attempts = [
            { user_id: testUserId, wallet_address: testWallet },
            { user_id: testUserId, stacks_address: testWallet },
            { user_id: testUserId, address: testWallet },
            { user_id: testUserId, wallet: testWallet }
          ];
          
          const results = [];
          
          for (const attempt of attempts) {
            try {
              const { error } = await supabaseAdmin
                .from('wallet_auth')
                .insert(attempt);
              
              results.push({
                attempt,
                success: !error,
                error: error?.message
              });
              
              // If successful, clean up
              if (!error) {
                await supabaseAdmin
                  .from('wallet_auth')
                  .delete()
                  .eq('user_id', testUserId);
              }
            } catch (e) {
              results.push({
                attempt,
                success: false,
                error: `${e}`
              });
            }
          }
          
          return NextResponse.json({
            success: true,
            results
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Wallet auth test error: ${error}`
          });
        }

      case 'checkSchema':
        // Test database schema by querying tables
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          
          // Check what columns exist in wallet_auth table
          const { data: walletAuthData, error: walletError } = await supabaseAdmin
            .from('wallet_auth')
            .select('*')
            .limit(1);
          
          // Check what columns exist in profiles table  
          const { data: profilesData, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .limit(1);
            
          // Check what columns exist in profile_links table
          const { data: profileLinksData, error: profileLinksError } = await supabaseAdmin
            .from('profile_links')
            .select('*')
            .limit(1);
            
          // Check what columns exist in profile_sections table
          const { data: profileSectionsData, error: profileSectionsError } = await supabaseAdmin
            .from('profile_sections')
            .select('*')
            .limit(1);
            
          return NextResponse.json({
            success: true,
            walletAuth: {
              error: walletError?.message,
              sampleData: walletAuthData
            },
            profiles: {
              error: profilesError?.message,
              sampleData: profilesData
            },
            profileLinks: {
              error: profileLinksError?.message,
              sampleData: profileLinksData
            },
            profileSections: {
              error: profileSectionsError?.message,
              sampleData: profileSectionsData
            }
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Schema check error: ${error}`
          })
        }

      case 'checkAllRecords':
        // Check all database records to debug the placeholder image issue
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          
          // Get all profiles
          const { data: allProfiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('*');
          
          // Get all wallet auth records
          const { data: allWalletAuth, error: walletError } = await supabaseAdmin
            .from('wallet_auth')
            .select('*');
            
          // Get all profile links
          const { data: allProfileLinks, error: profileLinksError } = await supabaseAdmin
            .from('profile_links')
            .select('*');
            
          // Get all profile sections with their config data
          const { data: allProfileSections, error: profileSectionsError } = await supabaseAdmin
            .from('profile_sections')
            .select('*');
            
          return NextResponse.json({
            success: true,
            recordCounts: {
              profiles: allProfiles?.length || 0,
              walletAuth: allWalletAuth?.length || 0,
              profileLinks: allProfileLinks?.length || 0,
              profileSections: allProfileSections?.length || 0
            },
            profiles: allProfiles || [],
            walletAuth: allWalletAuth || [],
            profileLinks: allProfileLinks || [],
            profileSections: allProfileSections || [],
            errors: {
              profiles: profilesError?.message,
              walletAuth: walletError?.message,
              profileLinks: profileLinksError?.message,
              profileSections: profileSectionsError?.message
            }
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Records check error: ${error}`
          })
        }

      case 'deleteAllTestRecords':
        // Delete all test records (use with caution!)
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          
          // Delete all profiles (this will cascade to other tables if foreign keys are set up properly)
          const { error: profilesDeleteError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .neq('id', 'keep-this-id'); // Delete all except a non-existent ID (delete all)
            
          // Also manually delete from other tables to be sure
          const { error: sectionsDeleteError } = await supabaseAdmin
            .from('profile_sections')
            .delete()
            .neq('user_id', 'keep-this-id');
            
          const { error: linksDeleteError } = await supabaseAdmin
            .from('profile_links')
            .delete()
            .neq('user_id', 'keep-this-id');
            
          const { error: walletDeleteError } = await supabaseAdmin
            .from('wallet_auth')
            .delete()
            .neq('user_id', 'keep-this-id');
            
          return NextResponse.json({
            success: true,
            message: 'All test records deleted',
            errors: {
              profiles: profilesDeleteError?.message,
              sections: sectionsDeleteError?.message,
              links: linksDeleteError?.message,
              wallet: walletDeleteError?.message
            }
          })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Delete records error: ${error}`
          })
        }

      case 'checkConfig':
        // Test if Supabase is configured properly
        const { getSupabaseConfigErrors, isServiceRoleConfigured } = await import('@/lib/supabase')
        const configErrors = getSupabaseConfigErrors()
        const serviceRoleOk = isServiceRoleConfigured()
        
        return NextResponse.json({
          success: configErrors.length === 0 && serviceRoleOk,
          errors: configErrors,
          serviceRoleConfigured: serviceRoleOk
        })

      case 'listTables':
        // List all tables in the database
        try {
          const { supabaseAdmin } = await import('@/lib/supabase')
          
          // Query the information schema to get table names
          const { data, error } = await supabaseAdmin
            .rpc('get_table_names'); // This might not work, let's try a different approach
          
          if (error) {
            // Try alternative approach - query a few known table patterns
            const tableTests = [
              'profiles',
              'profile_sections', 
              'section_items',
              'section_data',
              'items',
              'content',
              'profile_content',
              'profile_items',
              'profile_links',
              'wallet_auth'
            ];
            
            const results = [];
            for (const table of tableTests) {
              try {
                const { error: testError } = await supabaseAdmin
                  .from(table)
                  .select('*')
                  .limit(1);
                
                results.push({
                  table,
                  exists: !testError,
                  error: testError?.message
                });
              } catch (e) {
                results.push({
                  table,
                  exists: false,
                  error: `${e}`
                });
              }
            }
            
            return NextResponse.json({
              success: true,
              method: 'table_test',
              results
            });
          }
          
          return NextResponse.json({
            success: true,
            method: 'rpc',
            tables: data
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Table listing error: ${error}`
          });
        }

      default:
        return NextResponse.json(
          { success: false, error: { message: 'Invalid action' } },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { success: false, error: { message: `Server error: ${error}` } },
      { status: 500 }
    )
  }
} 