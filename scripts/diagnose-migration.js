/**
 * Diagnose Migration Issues
 * Run with: node scripts/diagnose-migration.js [persona-username]
 *
 * Shows persona info and their tracks to help debug migration issues
 */

const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnosePersona(username) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DIAGNOSING: @${username}`);
  console.log('='.repeat(60));

  // 1. Find persona
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('*')
    .eq('username', username.toLowerCase())
    .eq('is_active', true)
    .single();

  if (personaError || !persona) {
    console.log(`\n❌ Persona @${username} not found`);
    return;
  }

  console.log('\n📋 PERSONA INFO:');
  console.log(`   Username:       @${persona.username}`);
  console.log(`   Display Name:   ${persona.display_name || '(none)'}`);
  console.log(`   STX Wallet:     ${persona.wallet_address || '❌ NOT SET'}`);
  console.log(`   SUI Address:    ${persona.sui_address || '❌ NOT SET'}`);
  console.log(`   Account ID:     ${persona.account_id}`);

  // 2. Check what's needed for migration
  console.log('\n🔍 MIGRATION STATUS:');
  if (!persona.wallet_address) {
    console.log('   ❌ Missing STX wallet - Use Form 8 to link one');
  }
  if (!persona.sui_address) {
    console.log('   ❌ Missing SUI address - Use Form 7 to generate one');
  }
  if (persona.wallet_address && persona.sui_address) {
    console.log('   ✅ Ready for migration (has both STX and SUI)');
  }

  // 3. Find tracks by STX wallet
  if (persona.wallet_address) {
    const { data: stxTracks } = await supabase
      .from('ip_tracks')
      .select('id, title, content_type, primary_uploader_wallet, created_at')
      .eq('primary_uploader_wallet', persona.wallet_address)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    console.log(`\n📀 TRACKS WITH STX WALLET (${stxTracks?.length || 0}):`);
    if (stxTracks && stxTracks.length > 0) {
      stxTracks.forEach(t => {
        console.log(`   • ${t.title} (${t.content_type})`);
      });
    } else {
      console.log('   (none)');
    }
  }

  // 4. Find tracks by SUI address
  if (persona.sui_address) {
    const { data: suiTracks } = await supabase
      .from('ip_tracks')
      .select('id, title, content_type, primary_uploader_wallet, created_at')
      .eq('primary_uploader_wallet', persona.sui_address)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    console.log(`\n📀 TRACKS WITH SUI ADDRESS (${suiTracks?.length || 0}):`);
    if (suiTracks && suiTracks.length > 0) {
      suiTracks.forEach(t => {
        console.log(`   • ${t.title} (${t.content_type})`);
      });
    } else {
      console.log('   (none)');
    }
  }

  // 5. Look for tracks that might belong to this user but with unknown wallets
  // Check user_profiles for any linked wallets
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('wallet_address, display_name, username')
    .eq('account_id', persona.account_id);

  if (profiles && profiles.length > 0) {
    console.log(`\n👤 LINKED USER PROFILES (same account):`);
    for (const profile of profiles) {
      console.log(`   • ${profile.wallet_address?.slice(0, 16)}... (${profile.display_name || profile.username || 'unnamed'})`);

      // Check for tracks under this wallet
      const { data: profileTracks } = await supabase
        .from('ip_tracks')
        .select('id, title')
        .eq('primary_uploader_wallet', profile.wallet_address)
        .is('deleted_at', null);

      if (profileTracks && profileTracks.length > 0) {
        console.log(`     → ${profileTracks.length} tracks: ${profileTracks.map(t => t.title).join(', ')}`);
      }
    }
  }
}

async function findTrackByTitle(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SEARCHING FOR TRACK: "${title}"`);
  console.log('='.repeat(60));

  const { data: tracks } = await supabase
    .from('ip_tracks')
    .select('*')
    .ilike('title', `%${title}%`)
    .is('deleted_at', null);

  if (!tracks || tracks.length === 0) {
    console.log('\n❌ No tracks found matching that title');
    return;
  }

  for (const track of tracks) {
    console.log(`\n📀 TRACK: ${track.title}`);
    console.log(`   Artist:         ${track.artist || '(none)'}`);
    console.log(`   Type:           ${track.content_type}`);
    console.log(`   Uploader:       ${track.primary_uploader_wallet}`);
    console.log(`   Created:        ${track.created_at}`);

    // Find who this wallet belongs to
    const wallet = track.primary_uploader_wallet;

    // Check personas
    const { data: persona } = await supabase
      .from('personas')
      .select('username, display_name, wallet_address, sui_address')
      .or(`wallet_address.eq.${wallet},sui_address.eq.${wallet}`)
      .eq('is_active', true)
      .single();

    if (persona) {
      console.log(`   Belongs to:     @${persona.username} (${persona.display_name || 'no display name'})`);
    } else {
      // Check user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, display_name, wallet_address')
        .eq('wallet_address', wallet)
        .single();

      if (profile) {
        console.log(`   Belongs to:     ${profile.display_name || profile.username || 'Unknown'} (user_profile, not persona)`);
      } else {
        console.log(`   Belongs to:     ❓ UNKNOWN - wallet not linked to any persona or profile`);
      }
    }
  }
}

async function listAllPersonasWithTracks() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('ALL PERSONAS WITH MIGRATION STATUS');
  console.log('='.repeat(60));

  const { data: personas } = await supabase
    .from('personas')
    .select('username, display_name, wallet_address, sui_address')
    .eq('is_active', true)
    .order('username');

  for (const p of personas) {
    const hasStx = !!p.wallet_address;
    const hasSui = !!p.sui_address;

    // Count STX tracks
    let stxCount = 0;
    if (hasStx) {
      const { count } = await supabase
        .from('ip_tracks')
        .select('*', { count: 'exact', head: true })
        .eq('primary_uploader_wallet', p.wallet_address)
        .is('deleted_at', null);
      stxCount = count || 0;
    }

    // Count SUI tracks
    let suiCount = 0;
    if (hasSui) {
      const { count } = await supabase
        .from('ip_tracks')
        .select('*', { count: 'exact', head: true })
        .eq('primary_uploader_wallet', p.sui_address)
        .is('deleted_at', null);
      suiCount = count || 0;
    }

    const status = hasStx && hasSui ? '✅' : '⚠️';
    const needsMigration = stxCount > 0 && hasSui;

    console.log(`\n${status} @${p.username} (${p.display_name || 'no name'})`);
    console.log(`   STX: ${hasStx ? p.wallet_address?.slice(0, 12) + '...' : '❌ none'} → ${stxCount} tracks`);
    console.log(`   SUI: ${hasSui ? p.sui_address?.slice(0, 12) + '...' : '❌ none'} → ${suiCount} tracks`);
    if (needsMigration) {
      console.log(`   🔄 NEEDS MIGRATION: ${stxCount} tracks to move from STX to SUI`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Show all personas
    await listAllPersonasWithTracks();
  } else if (args[0] === '--track') {
    // Search for a track
    await findTrackByTitle(args.slice(1).join(' '));
  } else {
    // Diagnose specific persona
    await diagnosePersona(args[0]);
  }

  console.log('\n');
}

main().catch(console.error);
