const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Wallet mapping from testnet to mainnet (from our previous migration)
const walletMapping = {
  // Lunar Drive
  'STZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6M9NPFDPX': 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ',
  
  // DJ Chikk 
  'STB32YD0DXZSCJ02BGHYSHH8DA1E2R2XG67WX4R6': 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE',
  
  // Rey
  'ST2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKX9R9VY': 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
  
  // Other testnet addresses found in the data
  'STGWYS54FXZF0VYHM16SSA3D6AM88PBJQP7YT96N': 'SP2Z05ZXG8ZRD48XMSEGCTT7Q1PNZJPY88X7C4SM9', // Alternative Lunar Drive
  'ST2ZTDRRBC8SN8MBWX0D2HTHWN3ZS8GEYD1E6WM0H': 'SP2ZTDRRBC8SN8MBWX0D2HTHWN3ZS8GEYD36F4AP9', // Judy
  'STRT2Z40Q2FK174QN1QC9QW0QYH9T049EMPW0C5Q': 'SPRT2Z40Q2FK174QN1QC9QW0QYH9T049EQ9TKZYR', // Muneeb
  'ST2RBH8M98VGM7681MB6E6CYBFFZDRFN9CJ13H8XT': 'SP2RBH8M98VGM7681MB6E6CYBFFZDRFN9CKX9KH1X', // Merlin
  
  // Additional mappings for other testnet addresses
  'STGFWAXYE99908WM1CD83KREPMHQXCH54AYJ2HWQ': 'SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A', // CJHP/CP
  'ST39092SFE6HSGWMKK3Q60NCC1E62Q58N7RP50E9': 'SP39092SFE6HSGWMKK3Q60NCC1E62Q58N7RP50E9', // STARLA
  'ST6G14FHNRZATMMY5XSQ7QYJN23EW8Y5EQCVBC9K': 'SP6G14FHNRZATMMY5XSQ7QYJN23EW8Y5EQCVBC9K', // Kevin Locke
  'ST1QCBHBAMKG7EBJXXE0JMW8C45FQFB424FY184BV': 'SP1QCBHBAMKG7EBJXXE0JMW8C45FQFB424FY184BV', // Blah Poodle
};

async function fixAttributionWallets() {
  console.log('🔧 FIXING ATTRIBUTION WALLETS: TESTNET → MAINNET\n');
  
  // Get all tracks with attribution wallets
  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('id, title, artist, composition_split_1_wallet, production_split_1_wallet, composition_split_2_wallet, production_split_2_wallet, composition_split_3_wallet, production_split_3_wallet');

  if (error) {
    console.error('❌ Error fetching tracks:', error);
    return;
  }

  console.log(`📋 Found ${tracks.length} tracks to process\n`);

  let updatedCount = 0;
  let unchangedCount = 0;

  for (const track of tracks) {
    let needsUpdate = false;
    const updates = {};

    // Check and map composition wallets
    ['composition_split_1_wallet', 'composition_split_2_wallet', 'composition_split_3_wallet'].forEach(field => {
      const currentWallet = track[field];
      if (currentWallet && walletMapping[currentWallet]) {
        updates[field] = walletMapping[currentWallet];
        needsUpdate = true;
      }
    });

    // Check and map production wallets  
    ['production_split_1_wallet', 'production_split_2_wallet', 'production_split_3_wallet'].forEach(field => {
      const currentWallet = track[field];
      if (currentWallet && walletMapping[currentWallet]) {
        updates[field] = walletMapping[currentWallet];
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      // Update the track
      const { error: updateError } = await supabase
        .from('ip_tracks')
        .update(updates)
        .eq('id', track.id);

      if (updateError) {
        console.error(`❌ Failed to update "${track.title}":`, updateError);
      } else {
        console.log(`✅ Updated "${track.title}" by ${track.artist}`);
        Object.entries(updates).forEach(([field, newWallet]) => {
          const oldWallet = track[field];
          console.log(`   ${field}: ${oldWallet.slice(0, 8)}... → ${newWallet.slice(0, 8)}...`);
        });
        updatedCount++;
      }
    } else {
      // Check if any wallets are still testnet (ST)
      const hasTestnetWallets = [
        track.composition_split_1_wallet,
        track.composition_split_2_wallet, 
        track.composition_split_3_wallet,
        track.production_split_1_wallet,
        track.production_split_2_wallet,
        track.production_split_3_wallet
      ].some(wallet => wallet && wallet.startsWith('ST'));

      if (hasTestnetWallets) {
        console.log(`⚠️ "${track.title}": Has unmapped testnet wallets`);
      } else {
        console.log(`✓ "${track.title}": Already using mainnet wallets`);
      }
      unchangedCount++;
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`Updated: ${updatedCount} tracks`);
  console.log(`Unchanged: ${unchangedCount} tracks`);
  console.log(`\n🎉 Attribution wallet migration complete!`);
  console.log(`💡 TrackCards should now show proper mainnet attribution!`);
}

fixAttributionWallets().catch(console.error); 