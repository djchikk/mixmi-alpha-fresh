/**
 * Diagnostic Script: IP Tracks Wallet Address Analysis
 *
 * This script analyzes the ip_tracks table to identify data quality issues
 * with wallet addresses and provides recommendations for fixes.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function diagnoseTrackWallets() {
  console.log('🔍 Starting IP Tracks Wallet Diagnosis...\n');

  try {
    // Fetch all tracks (excluding deleted)
    const { data: tracks, error } = await supabase
      .from('ip_tracks')
      .select('id, title, artist, primary_uploader_wallet, uploader_address, composition_split_1_wallet, production_split_1_wallet, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching tracks:', error);
      return;
    }

    console.log(`📊 Total active tracks: ${tracks.length}\n`);

    // Analysis categories
    const missingPrimary = [];
    const hasUploaderAddress = [];
    const hasCompositionWallet = [];
    const hasProductionWallet = [];
    const fullyPopulated = [];
    const noWalletInfo = [];

    // Analyze each track
    tracks.forEach(track => {
      if (track.primary_uploader_wallet) {
        fullyPopulated.push(track);
      } else {
        missingPrimary.push(track);

        // Check fallback options
        if (track.uploader_address) {
          hasUploaderAddress.push(track);
        }
        if (track.composition_split_1_wallet) {
          hasCompositionWallet.push(track);
        }
        if (track.production_split_1_wallet) {
          hasProductionWallet.push(track);
        }
        if (!track.uploader_address && !track.composition_split_1_wallet && !track.production_split_1_wallet) {
          noWalletInfo.push(track);
        }
      }
    });

    // Report results
    console.log('═══════════════════════════════════════════════════════');
    console.log('                    SUMMARY REPORT                      ');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`✅ Tracks with primary_uploader_wallet: ${fullyPopulated.length}/${tracks.length}`);
    console.log(`⚠️  Tracks missing primary_uploader_wallet: ${missingPrimary.length}/${tracks.length}\n`);

    if (missingPrimary.length > 0) {
      console.log('─────────────────────────────────────────────────────────');
      console.log('MISSING PRIMARY_UPLOADER_WALLET - Breakdown:\n');

      console.log(`  Can use uploader_address as fallback: ${hasUploaderAddress.length}`);
      console.log(`  Can use composition_split_1_wallet as fallback: ${hasCompositionWallet.length}`);
      console.log(`  Can use production_split_1_wallet as fallback: ${hasProductionWallet.length}`);
      console.log(`  ❌ No wallet information at all: ${noWalletInfo.length}\n`);

      console.log('─────────────────────────────────────────────────────────');
      console.log('DETAILED LIST OF PROBLEMATIC TRACKS:\n');

      missingPrimary.forEach((track, index) => {
        console.log(`${index + 1}. "${track.title}" by ${track.artist}`);
        console.log(`   ID: ${track.id}`);
        console.log(`   Created: ${new Date(track.created_at).toLocaleDateString()}`);
        console.log(`   primary_uploader_wallet: ${track.primary_uploader_wallet || '❌ NULL'}`);
        console.log(`   uploader_address: ${track.uploader_address || '❌ NULL'}`);
        console.log(`   composition_split_1_wallet: ${track.composition_split_1_wallet || '❌ NULL'}`);
        console.log(`   production_split_1_wallet: ${track.production_split_1_wallet || '❌ NULL'}`);

        // Recommendation
        let recommendation = '   ';
        if (track.uploader_address) {
          recommendation += `✅ RECOMMENDED FIX: Use uploader_address (${track.uploader_address.slice(0, 8)}...)`;
        } else if (track.composition_split_1_wallet) {
          recommendation += `✅ RECOMMENDED FIX: Use composition_split_1_wallet (${track.composition_split_1_wallet.slice(0, 8)}...)`;
        } else if (track.production_split_1_wallet) {
          recommendation += `⚠️  FALLBACK FIX: Use production_split_1_wallet (${track.production_split_1_wallet.slice(0, 8)}...)`;
        } else {
          recommendation += `❌ CANNOT AUTO-FIX: No wallet information available - manual intervention needed`;
        }
        console.log(recommendation);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('                  RECOMMENDATIONS                       ');
    console.log('═══════════════════════════════════════════════════════\n');

    if (missingPrimary.length === 0) {
      console.log('🎉 All tracks have primary_uploader_wallet set! No action needed.\n');
    } else {
      const fixableCount = missingPrimary.length - noWalletInfo.length;
      console.log(`📝 ${fixableCount} tracks can be auto-fixed using fallback wallet fields`);
      console.log(`⚠️  ${noWalletInfo.length} tracks need manual review (no wallet info)\n`);

      if (fixableCount > 0) {
        console.log('Next step: Run the migration script to auto-fix tracks with fallback data:');
        console.log('  node scripts/fix-missing-primary-wallets.js\n');
      }

      if (noWalletInfo.length > 0) {
        console.log('For tracks with no wallet info:');
        console.log('  1. Check with artists to determine correct wallet');
        console.log('  2. Consider deleting test/demo tracks');
        console.log('  3. Or manually assign to a default wallet\n');
      }
    }

    // Artist name analysis
    console.log('─────────────────────────────────────────────────────────');
    console.log('ARTIST NAME ANALYSIS:\n');

    const artistMap = new Map();
    tracks.forEach(track => {
      if (track.primary_uploader_wallet) {
        if (!artistMap.has(track.primary_uploader_wallet)) {
          artistMap.set(track.primary_uploader_wallet, new Set());
        }
        artistMap.get(track.primary_uploader_wallet).add(track.artist);
      }
    });

    const walletsWithMultipleNames = [];
    artistMap.forEach((names, wallet) => {
      if (names.size > 1) {
        walletsWithMultipleNames.push({ wallet, names: Array.from(names) });
      }
    });

    if (walletsWithMultipleNames.length > 0) {
      console.log(`⚠️  ${walletsWithMultipleNames.length} wallets use multiple artist names:\n`);
      walletsWithMultipleNames.forEach(({ wallet, names }) => {
        console.log(`  ${wallet.slice(0, 8)}... uses: ${names.join(', ')}`);
      });
      console.log('\nℹ️  This is OK - artists can use different project names for different tracks.');
    } else {
      console.log('✅ Each wallet consistently uses one artist name.');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the diagnosis
diagnoseTrackWallets();
