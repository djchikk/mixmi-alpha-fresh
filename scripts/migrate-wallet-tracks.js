/**
 * Migrate tracks from one wallet to another
 * This ONLY updates ip_tracks.primary_uploader_wallet
 * Does NOT modify personas or accounts
 *
 * Run with: node scripts/migrate-wallet-tracks.js [from-wallet] [to-wallet] [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateTracks(fromWallet, toWallet, dryRun = true) {
  console.log('\n' + '='.repeat(60));
  console.log('TRACK MIGRATION');
  console.log('='.repeat(60));
  console.log(`\nFrom: ${fromWallet}`);
  console.log(`To:   ${toWallet}`);
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚠️  LIVE (will update database)'}`);

  // Find all tracks with the source wallet
  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('id, title, artist, content_type, created_at')
    .eq('primary_uploader_wallet', fromWallet)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('\nError fetching tracks:', error.message);
    return;
  }

  console.log(`\nFound ${tracks.length} tracks to migrate:\n`);

  tracks.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.title} (${t.content_type}) - ${t.artist || 'no artist'}`);
  });

  if (dryRun) {
    console.log('\n✅ DRY RUN complete. To actually migrate, run with --execute flag:');
    console.log(`   node scripts/migrate-wallet-tracks.js "${fromWallet}" "${toWallet}" --execute`);
    return;
  }

  // Perform the migration
  console.log('\n⏳ Migrating tracks...');

  const { error: updateError, count } = await supabase
    .from('ip_tracks')
    .update({ primary_uploader_wallet: toWallet })
    .eq('primary_uploader_wallet', fromWallet)
    .is('deleted_at', null);

  if (updateError) {
    console.log('\n❌ Error migrating:', updateError.message);
    return;
  }

  console.log(`\n✅ Successfully migrated ${tracks.length} tracks!`);
  console.log(`   From: ${fromWallet.slice(0, 16)}...`);
  console.log(`   To:   ${toWallet.slice(0, 16)}...`);
}

// Parse arguments
const args = process.argv.slice(2);
const executeFlag = args.includes('--execute');
const wallets = args.filter(a => !a.startsWith('--'));

if (wallets.length < 2) {
  console.log('Usage: node scripts/migrate-wallet-tracks.js [from-wallet] [to-wallet] [--execute]');
  console.log('');
  console.log('Options:');
  console.log('  --execute    Actually perform the migration (default is dry-run)');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/migrate-wallet-tracks.js SP3WZZ... 0x9e7d... --execute');
  process.exit(1);
}

migrateTracks(wallets[0], wallets[1], !executeFlag).catch(console.error);
