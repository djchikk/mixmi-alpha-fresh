/**
 * Debug script to investigate blah-poodle tracks
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUI_ADDRESS = '0xfe239f612919d85697306c3f41ff17b601e6fd64cbbfede144a776863c3b1b1b';
const STX_ADDRESS = 'SP1QCBHBAMKG7EBJXXE0JMW8C45FQFB424E7S6JT1';

async function debug() {
  console.log('\n=== BLAH-POODLE TRACK DEBUG ===\n');

  // 1. Check persona
  console.log('1. Checking persona @blah-poodle...');
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('username', 'blah-poodle')
    .single();

  console.log('Persona:', persona ? {
    username: persona.username,
    wallet_address: persona.wallet_address,
    sui_address: persona.sui_address
  } : 'NOT FOUND');

  // 2. Search by exact SUI address
  console.log('\n2. Searching ip_tracks by SUI address...');
  const { data: suiTracks, error: suiError } = await supabase
    .from('ip_tracks')
    .select('id, title, primary_uploader_wallet, uploader_address, deleted_at, content_type, is_deleted, pack_id, pack_position')
    .eq('primary_uploader_wallet', SUI_ADDRESS);

  console.log('SUI address query result:', { count: suiTracks?.length, error: suiError?.message });
  if (suiTracks?.length > 0) {
    suiTracks.forEach(t => {
      console.log(' -', t.title);
      console.log('   content_type:', t.content_type);
      console.log('   is_deleted:', t.is_deleted);
      console.log('   deleted_at:', t.deleted_at);
      console.log('   pack_id:', t.pack_id || 'null');
      console.log('   pack_position:', t.pack_position);
      const isChildItem = t.pack_id && t.pack_position !== undefined && t.pack_position >= 1;
      console.log('   isChildItem?:', isChildItem, '(would be filtered out of dashboard)');
    });
  }

  // 3. Search by STX address (in case migration didn't work)
  console.log('\n3. Searching ip_tracks by STX address...');
  const { data: stxTracks, error: stxError } = await supabase
    .from('ip_tracks')
    .select('id, title, primary_uploader_wallet, uploader_address, deleted_at')
    .eq('primary_uploader_wallet', STX_ADDRESS);

  console.log('STX address query result:', { count: stxTracks?.length, error: stxError?.message });
  if (stxTracks?.length > 0) {
    stxTracks.forEach(t => console.log(' -', t.title));
  }

  // 4. Search by known track titles
  console.log('\n4. Searching by known track titles...');
  const titles = [
    'LANDR-B Funky 2015 - 2 alt WAV 2-Medium-Balanced',
    'B Funky 2024',
    "F'ing Baby (Knocked Up)"
  ];

  for (const title of titles) {
    const { data: track } = await supabase
      .from('ip_tracks')
      .select('id, title, primary_uploader_wallet, uploader_address, deleted_at')
      .eq('title', title)
      .single();

    if (track) {
      console.log(`\n  "${title}":`);
      console.log('    primary_uploader_wallet:', track.primary_uploader_wallet);
      console.log('    uploader_address:', track.uploader_address);
      console.log('    deleted_at:', track.deleted_at);
      console.log('    wallet matches SUI?', track.primary_uploader_wallet === SUI_ADDRESS);
    } else {
      console.log(`\n  "${title}": NOT FOUND`);
    }
  }

  // 5. Check uploader_address field
  console.log('\n5. Searching by uploader_address = SUI...');
  const { data: uploaderTracks } = await supabase
    .from('ip_tracks')
    .select('id, title, primary_uploader_wallet')
    .eq('uploader_address', SUI_ADDRESS);

  console.log('uploader_address matches:', uploaderTracks?.length || 0);

  // 6. ILIKE search in case of case sensitivity
  console.log('\n6. Case-insensitive search...');
  const { data: ilikeTracks, error: ilikeError } = await supabase
    .from('ip_tracks')
    .select('id, title, primary_uploader_wallet')
    .ilike('primary_uploader_wallet', SUI_ADDRESS);

  console.log('ILIKE result:', { count: ilikeTracks?.length, error: ilikeError?.message });

  // 7. Check if the pack container exists
  console.log('\n7. Checking pack container d59cae0f-59c3-436a-ac95-3c750a1de61a...');
  const packId = 'd59cae0f-59c3-436a-ac95-3c750a1de61a';
  const { data: packContainer, error: packError } = await supabase
    .from('ip_tracks')
    .select('id, title, content_type, primary_uploader_wallet, pack_position, is_deleted')
    .eq('id', packId)
    .single();

  if (packContainer) {
    console.log('Pack container found:');
    console.log('  title:', packContainer.title);
    console.log('  content_type:', packContainer.content_type);
    console.log('  wallet:', packContainer.primary_uploader_wallet);
    console.log('  pack_position:', packContainer.pack_position);
    console.log('  is_deleted:', packContainer.is_deleted);
    console.log('  was migrated to SUI?:', packContainer.primary_uploader_wallet === SUI_ADDRESS);
  } else {
    console.log('Pack container NOT FOUND or error:', packError?.message);
    console.log('This means child tracks are orphaned and should have pack_id cleared!');
  }
}

debug().catch(console.error);
