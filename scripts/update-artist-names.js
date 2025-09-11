#!/usr/bin/env node

/**
 * Update Artist Names Script
 * Updates the artist_name field in alpha_users table with real artist names
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Artist name mapping from the screenshots
const artistMapping = {
  // Screenshot 1
  'SP147S6FW15JR29P6VBWZV3SNE07PEEVQA92NZEJ8': 'Kieran',
  'SP2RBH8M98VGM7681MB6E6CYBFFZDRFN9CKX9KH1X': 'Merlin',
  'SP1N01Q5K7GCH0SHTW925CEG14TYTZV78T48AT85T': 'Rey',
  'SP24MT36A0N8ED2CXETKNXP1S025579DJF0PDF1C4': 'Reuben',
  'SP3PPZB7X3AFPY43PX2CCNBET32VAARB9JDW9ZS92': 'Paul',
  'SPGWYS54FXZF0VYHM16SSA3D6AM88PBJQQY8FPMT': 'Julie',
  'SPRT2Z40Q2FK174QN1QC9QW0QYH9T049EQ9TKZYR': 'Muneeb',
  'SPGQGPV1AKP95Y67WKFH71WRTJ3PW09EKQVXGH2R': 'Sophie',
  'SP3ZZHMBZ1MSFB9M7G6AEC1R4397MH6S621JB43ZX': 'Los de Abajo',
  'SP2ZTDRRBC8SN8MBWX0D2HTHWN3ZS8GEYD36F4AP9': 'Judy',

  // Screenshot 2
  'SPE4W85G1ND7Z8QXMSYQY9VEH6VYTQSJJ4CZDS41': 'Maurice',
  'SPJSP6H1JHG8J7RCBGHJ09NRESW5803MTGFKVB3Z': 'Joshua Muinde',
  'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE': 'djchikk.btc',
  'SP1E6PXS0GBA4AVY6CGNNCJBNHHKN619C34X1ERTH': 'Walter',
  'SP10XGWDN9F154ZRKZZ81CJ55JHMZS1XV3YC764K9': 'Tula',
  'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ': 'lunardrive.btc',
  'SP3NTV9YZB680GB8TFWPSYGNSRMA55G1AP2PVRKBN': 'dj Pinkbunny',
  'SP39092SFE6HSGWMKK3Q60NCC1E62Q58N7RP50E9': 'STARLA',
  'SP224F1G4TDRWZEX7X5HHVM8A7J3D46E42SZZA53T': 'Patricia Locke Foundation',
  'SP2QK37Y7B8FWFGXVV0K0DNZTQYT9AJKD69542EE3': 'b-funky.mixmi.app',
  'SP3PQKG52FBX6VEE0NQN3Z16EY01Y6EH5VM0FDYA0': 'kyawango.btc',
  'SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A': 'oranges.mixmi.app',

  // Screenshot 3
  'SPB32YD0DXZSCJ02BGHYSHH8DA1E2R2XG6J24M00': 'tulahooverjones.btc',
  'SP1878AH1PKZ9ABSZ4WYNFAE37Y1833G02P3RTHA5': 'Sam Godden',
  'SPGFWAXYE99908WM1CD83KREPMHQXCH548VJRPFG': 'Charles Pierre',
  'SP3GVQS357YEVMF7GY2Y2HA6T605M6HYDAA1QC6MC': 'Sam Minkler',
  'SP0EM3CHWZ5RQ0DENK27Q139C8MX3DPEGD6G8D7K': 'Doug Goodfeather',
  'SP1QCBHBAMKG7EBJXXE0JMW8C45FQFB424E7S6JT1': 'blahpoodle.btc',
  'SP37D6RYVV3KVT2CP41GQC62PBYGN42WHE88FAGYG': 's_h_',
  'SP3YXETJCM777DYZMARH1T7P55X0Q58696BBXJ462': 'sandyhoover.mixmi.app',
  'SP3P08QBCVS8K93MDV8YVZ9H3009AC5B8TA67WG0N': 'sandyhoover.btc',
  'SP2NDVP0JKVV5WYJG6H8J1RH9AH1ZJ7TK3W5AV9V5': 'Ed Walksnice',
  'SP6G14FHNRZATMMY5XSQ7QYJN23EW8Y5EPZZTB30': 'Kevin Locke',
  'SP40B83FW5K5A4B4P1CRZTN4T16683VWYTBKBNGQ': 'Xavi',

  // Screenshot 4
  'SP4E88F8W50TVZ5XB1PGZ9RQZFE8BPRPH8GEXF35': 'Phil Lane',
  'SP3C91FTY3PJSXPBCR211EMC3Q4Y7S7AN4TJXH1EG': 'Franklin Khan',
  'SP2XG5DZ1A69WSE6QPTRAA1M2HKG862JZSKVSDSR9': 'Keith Hughes',
  'SP28R338B9AHEEE9AM0THVSM4XZX1C4TM24V6QJYN': 'Rob Giebitz',
  'SP3HYFYA7PMG3N3NP94ZNX060PYP13PX525JNEHPV': 'Transglobal Underground',
  'SPZVYC493E1G5Y3ZZJA0AJ3QEFZCN3D503DJ00WN': 'Dillon',
  'SP47Z9KT7W3VTJK2287G2BW0BRACVN9Z700J28XC': 'Aaron Kenya',
  'SP1W2HTDEVV0B10J8F62SWRBGCT49VRKJG3W84GGF': 'Joshua Homnick',
  'SP12F82ZV5D8YJF432RRZGV534P6F9FY2DRQ0FX2R': 'Bear Erikson'
};

async function updateArtistNames() {
  console.log('🎨 Updating artist names in alpha_users table...');
  
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

  console.log(`🔍 Found ${Object.keys(artistMapping).length} artist mappings to update`);

  let successCount = 0;
  let errorCount = 0;

  // Update each artist name
  for (const [walletAddress, artistName] of Object.entries(artistMapping)) {
    try {
      const { data, error } = await supabase
        .from('alpha_users')
        .update({ artist_name: artistName })
        .eq('wallet_address', walletAddress)
        .select();

      if (error) {
        console.log(`❌ Error updating ${walletAddress}: ${error.message}`);
        errorCount++;
      } else if (data && data.length > 0) {
        console.log(`✅ Updated: ${walletAddress} → ${artistName}`);
        successCount++;
      } else {
        console.log(`⚠️  No record found for: ${walletAddress}`);
      }
    } catch (err) {
      console.log(`❌ Exception updating ${walletAddress}: ${err}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Update Summary:`);
  console.log(`   ✅ Successful updates: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total attempted: ${Object.keys(artistMapping).length}`);

  // Show updated list
  console.log('\n🎭 Fetching updated alpha users list...');
  const { data: updatedUsers, error: listError } = await supabase
    .from('alpha_users')
    .select('wallet_address, artist_name, approved')
    .order('artist_name', { ascending: true })
    .limit(20);

  if (!listError && updatedUsers) {
    console.log('\n📋 Updated alpha users (showing first 20):');
    updatedUsers.forEach((user, i) => {
      const status = user.approved ? '✅' : '❌';
      console.log(`  ${i + 1}. ${status} ${user.artist_name} (${user.wallet_address.substring(0, 8)}...)`);
    });
  }

  console.log('\n🎉 Artist name updates complete!');
}

updateArtistNames();