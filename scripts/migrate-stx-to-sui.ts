/**
 * Migrate Stacks Wallets to SUI Addresses
 *
 * This script migrates ip_tracks.primary_uploader_wallet from STX to SUI addresses.
 *
 * Run with: npx ts-node scripts/migrate-stx-to-sui.ts
 *
 * Options:
 *   --dry-run    Show what would be done without making changes (default)
 *   --execute    Actually perform the migration
 *   --delete-orphans  Delete tracks with no SUI mapping (requires --execute)
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const DELETE_ORPHANS = args.includes('--delete-orphans');

interface WalletMapping {
  stxWallet: string;
  suiAddress: string | null;
  source: string;
  trackCount: number;
  tracks: { id: string; title: string }[];
}

/**
 * Build wallet mappings from various sources
 */
async function buildWalletMappings(): Promise<Map<string, WalletMapping>> {
  const mappings = new Map<string, WalletMapping>();

  // Get all STX wallets from tracks
  const { data: stxTracks } = await supabase
    .from('ip_tracks')
    .select('id, title, primary_uploader_wallet')
    .or('primary_uploader_wallet.like.SP%,primary_uploader_wallet.like.ST%');

  if (!stxTracks) return mappings;

  // Group by wallet
  const tracksByWallet = new Map<string, { id: string; title: string }[]>();
  stxTracks.forEach(t => {
    const w = t.primary_uploader_wallet;
    const existing = tracksByWallet.get(w) || [];
    existing.push({ id: t.id, title: t.title });
    tracksByWallet.set(w, existing);
  });

  // For each STX wallet, try to find SUI mapping
  for (const [stxWallet, tracks] of tracksByWallet) {
    let suiAddress: string | null = null;
    let source = 'none';

    // Method 1: Check user_profiles for direct sui_address
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('sui_address, account_id')
      .eq('wallet_address', stxWallet)
      .maybeSingle();

    if (profile?.sui_address) {
      suiAddress = profile.sui_address;
      source = 'user_profiles.sui_address';
    }

    // Method 2: Check personas via account_id
    if (!suiAddress && profile?.account_id) {
      const { data: personas } = await supabase
        .from('personas')
        .select('sui_address, is_default')
        .eq('account_id', profile.account_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (personas && personas.length > 0) {
        const withSui = personas.find(p => p.sui_address);
        if (withSui) {
          suiAddress = withSui.sui_address;
          source = 'personas.sui_address';
        }
      }
    }

    // Method 3: Check alpha_users -> zklogin_users chain
    if (!suiAddress) {
      const { data: alphaUser } = await supabase
        .from('alpha_users')
        .select('invite_code')
        .eq('wallet_address', stxWallet)
        .maybeSingle();

      if (alphaUser?.invite_code) {
        const { data: zkUser } = await supabase
          .from('zklogin_users')
          .select('sui_address')
          .eq('invite_code', alphaUser.invite_code)
          .maybeSingle();

        if (zkUser?.sui_address) {
          suiAddress = zkUser.sui_address;
          source = 'alpha_users -> zklogin_users';
        }
      }
    }

    mappings.set(stxWallet, {
      stxWallet,
      suiAddress,
      source,
      trackCount: tracks.length,
      tracks
    });
  }

  return mappings;
}

/**
 * Main migration function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('STX to SUI Wallet Migration');
  console.log('='.repeat(60));
  console.log('');
  console.log('Mode:', DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE');
  if (DELETE_ORPHANS) console.log('Will delete orphaned tracks');
  console.log('');

  // Build mappings
  console.log('Building wallet mappings...\n');
  const mappings = await buildWalletMappings();

  // Categorize
  const canMigrate: WalletMapping[] = [];
  const orphaned: WalletMapping[] = [];

  for (const mapping of mappings.values()) {
    if (mapping.suiAddress) {
      canMigrate.push(mapping);
    } else {
      orphaned.push(mapping);
    }
  }

  // Report
  console.log('=== MIGRATION SUMMARY ===\n');

  console.log('CAN MIGRATE (' + canMigrate.reduce((sum, m) => sum + m.trackCount, 0) + ' tracks):');
  canMigrate.forEach(m => {
    console.log('  ' + m.stxWallet.slice(0, 20) + '... -> ' + m.suiAddress!.slice(0, 20) + '...');
    console.log('    ' + m.trackCount + ' tracks via ' + m.source);
  });
  console.log('');

  console.log('ORPHANED - NO SUI MAPPING (' + orphaned.reduce((sum, m) => sum + m.trackCount, 0) + ' tracks):');
  orphaned.forEach(m => {
    console.log('  ' + m.stxWallet.slice(0, 30) + '... (' + m.trackCount + ' tracks)');
    m.tracks.slice(0, 3).forEach(t => {
      console.log('    - ' + t.title.slice(0, 40));
    });
    if (m.tracks.length > 3) console.log('    ... and ' + (m.tracks.length - 3) + ' more');
  });
  console.log('');

  if (DRY_RUN) {
    console.log('='.repeat(60));
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('Run with --execute to perform migration');
    console.log('='.repeat(60));
    return;
  }

  // Execute migration
  console.log('=== EXECUTING MIGRATION ===\n');

  let migratedCount = 0;
  let deletedCount = 0;
  let errorCount = 0;

  // Migrate tracks with SUI mappings
  for (const mapping of canMigrate) {
    console.log('Migrating ' + mapping.trackCount + ' tracks from ' + mapping.stxWallet.slice(0, 20) + '...');

    const { error } = await supabase
      .from('ip_tracks')
      .update({ primary_uploader_wallet: mapping.suiAddress })
      .eq('primary_uploader_wallet', mapping.stxWallet);

    if (error) {
      console.log('  ERROR: ' + error.message);
      errorCount += mapping.trackCount;
    } else {
      console.log('  SUCCESS: Migrated to ' + mapping.suiAddress!.slice(0, 20) + '...');
      migratedCount += mapping.trackCount;
    }
  }

  // Handle orphaned tracks
  if (DELETE_ORPHANS && orphaned.length > 0) {
    console.log('\nDeleting orphaned tracks...');

    for (const mapping of orphaned) {
      console.log('Deleting ' + mapping.trackCount + ' tracks from ' + mapping.stxWallet.slice(0, 20) + '...');

      const { error } = await supabase
        .from('ip_tracks')
        .delete()
        .eq('primary_uploader_wallet', mapping.stxWallet);

      if (error) {
        console.log('  ERROR: ' + error.message);
        errorCount += mapping.trackCount;
      } else {
        console.log('  SUCCESS: Deleted');
        deletedCount += mapping.trackCount;
      }
    }
  }

  // Final report
  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION COMPLETE');
  console.log('  Migrated: ' + migratedCount + ' tracks');
  console.log('  Deleted:  ' + deletedCount + ' tracks');
  console.log('  Errors:   ' + errorCount + ' tracks');
  if (orphaned.length > 0 && !DELETE_ORPHANS) {
    console.log('  Orphaned: ' + orphaned.reduce((sum, m) => sum + m.trackCount, 0) + ' tracks (run with --delete-orphans to remove)');
  }
  console.log('='.repeat(60));
}

// Run
main().catch(console.error);
