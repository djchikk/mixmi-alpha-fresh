#!/usr/bin/env node

/**
 * Enable Default Sticker Visibility
 * Makes stickers visible by default for all profiles
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function enableDefaultSticker() {
  console.log('🌼 Enabling default sticker visibility for all profiles...\n');

  // Create Supabase client with service role key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('❌ Missing environment variables:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', !!serviceRoleKey);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // First, get all profiles that need updating
    const { data: profilesToUpdate, error: fetchError } = await supabase
      .from('user_profiles')
      .select('wallet_address, sticker_id, sticker_visible')
      .or('sticker_visible.is.null,sticker_visible.eq.false,sticker_id.is.null,sticker_id.eq.');

    if (fetchError) {
      console.log('❌ Error fetching profiles:', fetchError);
      process.exit(1);
    }

    console.log(`📊 Found ${profilesToUpdate?.length || 0} profiles that need updating\n`);

    if (profilesToUpdate && profilesToUpdate.length > 0) {
      // Update each profile to enable sticker
      for (const profile of profilesToUpdate) {
        const updates = {};

        if (!profile.sticker_id || profile.sticker_id === '') {
          updates.sticker_id = 'daisy-blue';
        }

        if (profile.sticker_visible !== true) {
          updates.sticker_visible = true;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('wallet_address', profile.wallet_address);

          if (updateError) {
            console.log(`❌ Error updating ${profile.wallet_address}:`, updateError);
          } else {
            console.log(`✅ Updated ${profile.wallet_address.substring(0, 12)}...`);
          }
        }
      }
    } else {
      console.log('✅ All profiles already have stickers enabled!\n');
    }

    // Verify the changes by checking profiles
    const { data: profiles, error: checkError } = await supabase
      .from('user_profiles')
      .select('wallet_address, sticker_id, sticker_visible')
      .limit(10);

    if (checkError) {
      console.log('❌ Error checking profiles:', checkError);
    } else {
      console.log('✅ Migration completed!\n');
      console.log('📋 Sample profiles:');
      profiles?.forEach((profile, i) => {
        const visibleIcon = profile.sticker_visible ? '✅' : '❌';
        console.log(`  ${i + 1}. ${profile.wallet_address.substring(0, 12)}... - Sticker: ${profile.sticker_id} ${visibleIcon}`);
      });
    }

    // Count total profiles with stickers visible
    const { count, error: countError } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('sticker_visible', true);

    if (!countError) {
      console.log(`\n🎉 ${count} profiles now have stickers visible!`);
    }

  } catch (err) {
    console.log('❌ Script error:', err);
    process.exit(1);
  }
}

enableDefaultSticker();
