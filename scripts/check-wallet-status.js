const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWalletStatus() {
  console.log('🔍 CHECKING CURRENT WALLET STATUS\n');
  
  // Get sample tracks with wallet info
  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('title, artist, primary_uploader_wallet, composition_split_1_wallet, production_split_1_wallet')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('📋 CURRENT WALLET ADDRESSES IN DATABASE:\n');
  
  tracks.forEach((track, index) => {
    console.log(`${index + 1}. "${track.title}" by ${track.artist}`);
    console.log(`   Primary: ${track.primary_uploader_wallet}`);
    console.log(`   Composition: ${track.composition_split_1_wallet}`);
    console.log(`   Production: ${track.production_split_1_wallet}`);
    
    // Check if these are testnet (ST) or mainnet (SP) addresses
    const isTestnet = track.primary_uploader_wallet?.startsWith('ST');
    const isMainnet = track.primary_uploader_wallet?.startsWith('SP');
    console.log(`   Type: ${isTestnet ? '🔴 TESTNET (ST)' : isMainnet ? '🟢 MAINNET (SP)' : '❓ UNKNOWN'}`);
    console.log('');
  });

  // Get unique wallets
  console.log('🎯 UNIQUE PRIMARY UPLOADERS:');
  const { data: uniqueWallets, error: walletError } = await supabase
    .from('ip_tracks')
    .select('primary_uploader_wallet, artist')
    .order('primary_uploader_wallet');

  if (!walletError) {
    const walletMap = {};
    uniqueWallets.forEach(track => {
      if (!walletMap[track.primary_uploader_wallet]) {
        walletMap[track.primary_uploader_wallet] = new Set();
      }
      walletMap[track.primary_uploader_wallet].add(track.artist);
    });

    Object.entries(walletMap).forEach(([wallet, artists]) => {
      const isTestnet = wallet?.startsWith('ST');
      const isMainnet = wallet?.startsWith('SP');
      const typeIcon = isTestnet ? '🔴' : isMainnet ? '🟢' : '❓';
      console.log(`${typeIcon} ${wallet}`);
      console.log(`   Artists: ${Array.from(artists).join(', ')}`);
    });
  }
}

checkWalletStatus().catch(console.error); 