const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Generate alpha invite code in format: MIXMI-ABC123
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomPart = Array.from({ length: 6 }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
  return `MIXMI-${randomPart}`;
}

async function populateAllInviteCodes() {
  console.log('🎫 POPULATING ALL NULL INVITE CODES + GENERATING EXTRAS\n');
  
  try {
    // Step 1: Get all alpha users with NULL invite codes
    const { data: usersWithoutCodes, error: fetchError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, invite_code')
      .is('invite_code', null)
      .order('created_at');
    
    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
      return;
    }
    
    console.log(`👥 Found ${usersWithoutCodes.length} users without invite codes`);
    
    // Step 2: Get existing codes to avoid duplicates
    const { data: existingUsers } = await supabase
      .from('alpha_users')
      .select('invite_code')
      .not('invite_code', 'is', null);
    
    const existingCodes = new Set(existingUsers?.map(u => u.invite_code) || []);
    console.log(`🔍 Found ${existingCodes.size} existing codes to avoid duplicates`);
    
    // Step 3: Generate unique codes for users + extras
    const totalCodesNeeded = Math.max(50, usersWithoutCodes.length + 10); // At least 50, or users + 10 extras
    const allNewCodes = [];
    
    while (allNewCodes.length < totalCodesNeeded) {
      const code = generateInviteCode();
      if (!existingCodes.has(code) && !allNewCodes.includes(code)) {
        allNewCodes.push(code);
      }
    }
    
    console.log(`🎯 Generated ${allNewCodes.length} unique invite codes`);
    
    // Step 4: Assign codes to users
    const userUpdates = [];
    for (let i = 0; i < usersWithoutCodes.length; i++) {
      const user = usersWithoutCodes[i];
      const code = allNewCodes[i];
      
      userUpdates.push({
        wallet_address: user.wallet_address,
        invite_code: code,
        artist_name: user.artist_name
      });
    }
    
    // Step 5: Apply updates to database
    console.log('\n📝 APPLYING UPDATES TO DATABASE...\n');
    
    for (const update of userUpdates) {
      const { error: updateError } = await supabase
        .from('alpha_users')
        .update({ invite_code: update.invite_code })
        .eq('wallet_address', update.wallet_address);
      
      if (updateError) {
        console.error(`❌ Error updating ${update.wallet_address}:`, updateError);
      } else {
        console.log(`✅ ${update.artist_name || 'User'}: ${update.invite_code}`);
        console.log(`   Wallet: ${update.wallet_address.substring(0, 8)}...`);
      }
    }
    
    // Step 6: Show extra codes for future users
    const extraCodes = allNewCodes.slice(usersWithoutCodes.length);
    
    console.log('\n🎁 EXTRA INVITE CODES FOR FUTURE USERS:');
    extraCodes.forEach((code, i) => {
      console.log(`${i + 1}. ${code}`);
    });
    
    // Step 7: Final verification
    const { data: finalUsers, error: finalError } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, invite_code')
      .order('created_at');
    
    if (finalError) {
      console.error('❌ Error fetching final results:', finalError);
      return;
    }
    
    console.log('\n🎯 FINAL ALPHA USER STATUS:');
    finalUsers.forEach(user => {
      console.log(`  ${user.artist_name || 'User'}: ${user.invite_code || 'NO CODE'}`);
      console.log(`    ${user.wallet_address.substring(0, 8)}...`);
    });
    
    const usersWithCodes = finalUsers.filter(u => u.invite_code).length;
    const totalUsers = finalUsers.length;
    
    console.log(`\n✅ COMPLETE: ${usersWithCodes}/${totalUsers} users have invite codes`);
    console.log(`🎁 Extra codes generated: ${extraCodes.length}`);
    console.log('\n🔐 Alpha invite code system is now fully populated!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

populateAllInviteCodes();