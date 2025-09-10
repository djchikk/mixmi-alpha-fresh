#!/usr/bin/env node

/**
 * Wallet Address Migration Script
 * Updates testnet (ST) addresses to mainnet (SP) addresses
 * Adds BNS identity data (main_wallet_name, account_name, account_order, bns_name)
 */

const fs = require('fs');
const path = require('path');

// Read the wallet mapping CSV
const csvPath = path.join(__dirname, '..', 'docs', 'mixmi Test Net Wallets 2025 no seed.csv');
const ipTracksCsvPath = path.join(__dirname, '..', 'docs', 'ip_tracks_rows.csv');

console.log('🔍 Reading wallet mapping data...');

// Parse CSV function
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    if (!line.trim()) return null;
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] ? values[index].trim() : '';
    });
    return row;
  }).filter(row => row && row['Main Net Account'] && row['Test Net Account']);
}

try {
  // Read wallet mapping CSV
  const walletCsvContent = fs.readFileSync(csvPath, 'utf-8');
  const walletMappings = parseCSV(walletCsvContent);
  
  console.log(`✅ Found ${walletMappings.length} wallet mappings`);
  
  // Create mapping objects
  const testnetToMainnet = {};
  const walletIdentityData = {};
  
  walletMappings.forEach(row => {
    const testnet = row['Test Net Account'];
    const mainnet = row['Main Net Account'];
    const accountName = row['Account name and order in Wallet'];
    const mainWalletName = row['Main Wallet Name'];
    const notes = row['Notes'];
    
    if (testnet && mainnet) {
      testnetToMainnet[testnet] = mainnet;
      
      // Extract BNS name and account order
      let bnsName = '';
      let accountOrder = null;
      
      if (accountName) {
        // Parse formats like "lunardrive.btc — #3" or "djchikk.mixmi.app — #5"
        const match = accountName.match(/(.+?)\s*—\s*#(\d+)/);
        if (match) {
          bnsName = match[1].trim();
          accountOrder = parseInt(match[2]);
        } else {
          bnsName = accountName;
        }
      }
      
      walletIdentityData[mainnet] = {
        main_wallet_name: mainWalletName || '',
        account_name: accountName || '',
        account_order: accountOrder,
        bns_name: bnsName,
        notes: notes || ''
      };
    }
  });
  
  console.log('\n🎯 Testnet → Mainnet Mappings:');
  Object.entries(testnetToMainnet).forEach(([testnet, mainnet]) => {
    const identity = walletIdentityData[mainnet];
    console.log(`  ${testnet} → ${mainnet} (${identity.bns_name || 'Unknown'})`);
  });
  
  // Read IP tracks CSV to see what we need to update
  if (fs.existsSync(ipTracksCsvPath)) {
    const ipTracksCsvContent = fs.readFileSync(ipTracksCsvPath, 'utf-8');
    const ipTracks = parseCSV(ipTracksCsvContent);
    
    console.log('\n📊 IP Tracks Address Analysis:');
    const addressCounts = {};
    
    ipTracks.forEach(track => {
      const uploaderAddress = track.uploader_address || track.created_by;
      if (uploaderAddress) {
        addressCounts[uploaderAddress] = (addressCounts[uploaderAddress] || 0) + 1;
      }
    });
    
    let mainnetReady = 0;
    let needsUpdate = 0;
    
    Object.entries(addressCounts).forEach(([address, count]) => {
      if (address.startsWith('SP')) {
        mainnetReady += count;
        console.log(`  ✅ ${address}: ${count} tracks (MAINNET - ready!)`);
      } else if (address.startsWith('ST')) {
        const mainnetAddress = testnetToMainnet[address];
        if (mainnetAddress) {
          needsUpdate += count;
          const identity = walletIdentityData[mainnetAddress];
          console.log(`  🔄 ${address}: ${count} tracks → ${mainnetAddress} (${identity.bns_name})`);
        } else {
          console.log(`  ❌ ${address}: ${count} tracks (NO MAPPING FOUND)`);
        }
      }
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`  • ${mainnetReady} tracks already on mainnet`);
    console.log(`  • ${needsUpdate} tracks need testnet → mainnet update`);
    
    // Generate SQL update statements
    console.log('\n🔧 SQL Update Statements:');
    console.log('-- Add new columns for BNS identity data');
    console.log(`
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS main_wallet_name TEXT;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS account_order INTEGER;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS bns_name TEXT;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS tell_us_more TEXT;
`);
    
    console.log('-- Update testnet addresses to mainnet');
    Object.entries(testnetToMainnet).forEach(([testnet, mainnet]) => {
      const identity = walletIdentityData[mainnet];
      console.log(`
-- Update ${identity.bns_name || testnet}
UPDATE ip_tracks SET 
  uploader_address = '${mainnet}',
  main_wallet_name = '${identity.main_wallet_name}',
  account_name = '${identity.account_name}',
  account_order = ${identity.account_order || 'NULL'},
  bns_name = '${identity.bns_name}'
WHERE uploader_address = '${testnet}';`);
    });
    
    // Also update composition and production addresses
    console.log('\n-- Update composition and production split addresses');
    Object.entries(testnetToMainnet).forEach(([testnet, mainnet]) => {
      console.log(`
-- Update composition splits for ${testnet} → ${mainnet}
UPDATE ip_tracks SET composition_address1 = '${mainnet}' WHERE composition_address1 = '${testnet}';
UPDATE ip_tracks SET composition_address2 = '${mainnet}' WHERE composition_address2 = '${testnet}';
UPDATE ip_tracks SET composition_address3 = '${mainnet}' WHERE composition_address3 = '${testnet}';

-- Update production splits for ${testnet} → ${mainnet}
UPDATE ip_tracks SET production_address1 = '${mainnet}' WHERE production_address1 = '${testnet}';
UPDATE ip_tracks SET production_address2 = '${mainnet}' WHERE production_address2 = '${testnet}';
UPDATE ip_tracks SET production_address3 = '${mainnet}' WHERE production_address3 = '${testnet}';`);
    });
    
  } else {
    console.log('\n⚠️  IP tracks CSV not found, skipping analysis');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('\n🎉 Migration script completed successfully!');
console.log('\n📋 Next Steps:');
console.log('1. Review the SQL statements above');
console.log('2. Run the ALTER TABLE statements to add new columns');
console.log('3. Run the UPDATE statements to migrate addresses');
console.log('4. Test the updated creator stores');
console.log('5. Migrate audio/cover files to proper mainnet structure'); 