#!/usr/bin/env node

/**
 * Compare IP Splits: January 4 Backup vs Current Database
 *
 * This script compares the ip_tracks split data between the backup and current state
 * to identify what changed and help debug the mysterious split modifications.
 *
 * Usage:
 *   node scripts/compare-splits.js
 *
 * Prerequisites:
 *   - Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Or export current data to scripts/current-ip-tracks.json first
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const BACKUP_PATH = path.join(__dirname, '../backups/2026-01-04/ip_tracks.json');

// Split fields to compare
const SPLIT_FIELDS = [
  'composition_split_1_wallet', 'composition_split_1_percentage',
  'composition_split_2_wallet', 'composition_split_2_percentage',
  'composition_split_3_wallet', 'composition_split_3_percentage',
  'composition_split_4_wallet', 'composition_split_4_percentage',
  'composition_split_5_wallet', 'composition_split_5_percentage',
  'composition_split_6_wallet', 'composition_split_6_percentage',
  'composition_split_7_wallet', 'composition_split_7_percentage',
  'production_split_1_wallet', 'production_split_1_percentage',
  'production_split_2_wallet', 'production_split_2_percentage',
  'production_split_3_wallet', 'production_split_3_percentage',
  'production_split_4_wallet', 'production_split_4_percentage',
  'production_split_5_wallet', 'production_split_5_percentage',
  'production_split_6_wallet', 'production_split_6_percentage',
  'production_split_7_wallet', 'production_split_7_percentage',
  'primary_uploader_wallet'
];

async function fetchCurrentTracks() {
  const { createClient } = require('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.log('   Export current data manually from Supabase and save to:');
    console.log('   scripts/current-ip-tracks.json');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📡 Fetching current tracks from Supabase...');
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('*')
    .eq('is_deleted', false);

  if (error) {
    console.error('❌ Error fetching tracks:', error);
    return null;
  }

  console.log(`✅ Fetched ${data.length} tracks from database`);
  return data;
}

function loadBackup() {
  console.log('📂 Loading January 4 backup...');

  if (!fs.existsSync(BACKUP_PATH)) {
    console.error('❌ Backup file not found:', BACKUP_PATH);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  console.log(`✅ Loaded ${data.length} tracks from backup`);
  return data;
}

function compareTracks(backupTracks, currentTracks) {
  const backupMap = new Map(backupTracks.map(t => [t.id, t]));
  const currentMap = new Map(currentTracks.map(t => [t.id, t]));

  const changes = [];
  const newTracks = [];
  const deletedTracks = [];

  // Find changed and deleted tracks
  for (const [id, backupTrack] of backupMap) {
    const currentTrack = currentMap.get(id);

    if (!currentTrack) {
      deletedTracks.push(backupTrack);
      continue;
    }

    // Compare split fields
    const trackChanges = {
      id,
      title: backupTrack.title,
      artist: backupTrack.artist,
      fieldChanges: []
    };

    for (const field of SPLIT_FIELDS) {
      const oldVal = backupTrack[field];
      const newVal = currentTrack[field];

      // Normalize nulls and empty strings for comparison
      const normalizedOld = oldVal === '' ? null : oldVal;
      const normalizedNew = newVal === '' ? null : newVal;

      if (normalizedOld !== normalizedNew) {
        trackChanges.fieldChanges.push({
          field,
          oldValue: oldVal,
          newValue: newVal
        });
      }
    }

    if (trackChanges.fieldChanges.length > 0) {
      changes.push(trackChanges);
    }
  }

  // Find new tracks (in current but not in backup)
  for (const [id, currentTrack] of currentMap) {
    if (!backupMap.has(id)) {
      newTracks.push(currentTrack);
    }
  }

  return { changes, newTracks, deletedTracks };
}

function analyzePatterns(changes) {
  const walletChanges = {};
  const percentageChanges = {};

  for (const change of changes) {
    for (const fc of change.fieldChanges) {
      if (fc.field.includes('wallet')) {
        const key = `${fc.oldValue} → ${fc.newValue}`;
        walletChanges[key] = (walletChanges[key] || 0) + 1;
      }
      if (fc.field.includes('percentage')) {
        const key = `${fc.oldValue} → ${fc.newValue}`;
        percentageChanges[key] = (percentageChanges[key] || 0) + 1;
      }
    }
  }

  return { walletChanges, percentageChanges };
}

function printReport(results) {
  const { changes, newTracks, deletedTracks } = results;

  console.log('\n' + '='.repeat(80));
  console.log('                    IP SPLITS COMPARISON REPORT');
  console.log('                    January 4, 2026 → Current');
  console.log('='.repeat(80) + '\n');

  // Summary
  console.log('📊 SUMMARY');
  console.log('-'.repeat(40));
  console.log(`   Tracks with split changes: ${changes.length}`);
  console.log(`   New tracks since backup:   ${newTracks.length}`);
  console.log(`   Deleted tracks:            ${deletedTracks.length}`);
  console.log('');

  if (changes.length === 0) {
    console.log('✅ No split changes detected!');
    return;
  }

  // Pattern analysis
  const patterns = analyzePatterns(changes);

  console.log('🔍 WALLET CHANGE PATTERNS');
  console.log('-'.repeat(40));
  const sortedWalletChanges = Object.entries(patterns.walletChanges)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [pattern, count] of sortedWalletChanges) {
    console.log(`   ${count}x: ${pattern}`);
  }
  console.log('');

  console.log('📈 PERCENTAGE CHANGE PATTERNS');
  console.log('-'.repeat(40));
  const sortedPctChanges = Object.entries(patterns.percentageChanges)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [pattern, count] of sortedPctChanges) {
    console.log(`   ${count}x: ${pattern}`);
  }
  console.log('');

  // Detailed changes (first 10)
  console.log('📝 DETAILED CHANGES (first 10 tracks)');
  console.log('-'.repeat(40));

  for (const change of changes.slice(0, 10)) {
    console.log(`\n🎵 "${change.title}" by ${change.artist}`);
    console.log(`   ID: ${change.id}`);

    for (const fc of change.fieldChanges) {
      const oldDisplay = fc.oldValue === null ? '(null)' : fc.oldValue;
      const newDisplay = fc.newValue === null ? '(null)' : fc.newValue;
      console.log(`   ${fc.field}:`);
      console.log(`      OLD: ${oldDisplay}`);
      console.log(`      NEW: ${newDisplay}`);
    }
  }

  if (changes.length > 10) {
    console.log(`\n   ... and ${changes.length - 10} more tracks with changes`);
  }

  // New tracks with splits
  const newTracksWithSplits = newTracks.filter(t =>
    t.composition_split_2_wallet || t.production_split_2_wallet
  );

  if (newTracksWithSplits.length > 0) {
    console.log('\n🆕 NEW TRACKS WITH COLLABORATOR SPLITS');
    console.log('-'.repeat(40));

    for (const track of newTracksWithSplits.slice(0, 5)) {
      console.log(`\n   "${track.title}" by ${track.artist}`);
      console.log(`   Created: ${track.created_at}`);
      console.log(`   Primary wallet: ${track.primary_uploader_wallet}`);
      if (track.composition_split_2_wallet) {
        console.log(`   Comp split 2: ${track.composition_split_2_wallet} (${track.composition_split_2_percentage}%)`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🔄 IP Splits Comparison Tool\n');

  // Load backup
  const backupTracks = loadBackup();
  if (!backupTracks) {
    process.exit(1);
  }

  // Try to load current data from file first, then fetch from Supabase
  let currentTracks;
  const currentFilePath = path.join(__dirname, 'current-ip-tracks.json');

  if (fs.existsSync(currentFilePath)) {
    console.log('📂 Loading current tracks from local file...');
    currentTracks = JSON.parse(fs.readFileSync(currentFilePath, 'utf8'));
    console.log(`✅ Loaded ${currentTracks.length} tracks from file`);
  } else {
    currentTracks = await fetchCurrentTracks();

    if (!currentTracks) {
      console.log('\n💡 TIP: Export current ip_tracks from Supabase Table Editor');
      console.log('   and save as: scripts/current-ip-tracks.json');
      process.exit(1);
    }

    // Save current data for future reference
    fs.writeFileSync(currentFilePath, JSON.stringify(currentTracks, null, 2));
    console.log(`💾 Saved current data to ${currentFilePath}`);
  }

  // Compare
  console.log('\n🔍 Comparing splits...');
  const results = compareTracks(backupTracks, currentTracks);

  // Print report
  printReport(results);

  // Save detailed results to file
  const reportPath = path.join(__dirname, 'splits-comparison-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
}

main().catch(console.error);
