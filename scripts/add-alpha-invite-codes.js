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

async function addInviteCodeColumn() {
  console.log('🔐 ADDING ALPHA INVITE CODE SYSTEM\n');
  
  try {
    // Step 1: Add invite_code column to alpha_users table
    console.log('📝 Adding invite_code column to alpha_users table...');
    
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE alpha_users 
        ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE;
      `
    });
    
    if (columnError) {
      console.error('❌ Error adding column:', columnError);
      return;
    }
    
    console.log('✅ invite_code column added successfully');
    
    // Step 2: Get all existing alpha users without invite codes
    const { data: users, error: fetchError } = await supabase
      .from('alpha_users')
      .select('id, wallet_address, invite_code')
      .is('invite_code', null);
    
    if (fetchError) {
      console.error('❌ Error fetching users:', fetchError);
      return;
    }
    
    console.log(`\n📊 Found ${users.length} users without invite codes`);
    
    // Step 3: Generate and assign invite codes
    for (const user of users) {
      let inviteCode;
      let isUnique = false;
      let attempts = 0;
      
      // Ensure unique invite code
      while (!isUnique && attempts < 10) {
        inviteCode = generateInviteCode();
        
        // Check if code already exists
        const { data: existing } = await supabase
          .from('alpha_users')
          .select('id')
          .eq('invite_code', inviteCode)
          .single();
        
        isUnique = !existing;
        attempts++;
      }
      
      if (!isUnique) {
        console.error(`❌ Could not generate unique code for user ${user.id}`);
        continue;
      }
      
      // Update user with invite code
      const { error: updateError } = await supabase
        .from('alpha_users')
        .update({ invite_code: inviteCode })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`❌ Error updating user ${user.id}:`, updateError);
      } else {
        console.log(`✅ ${user.wallet_address.substring(0, 8)}... → ${inviteCode}`);
      }
    }
    
    // Step 4: Show final results
    const { data: finalUsers, error: finalError } = await supabase
      .from('alpha_users')
      .select('wallet_address, invite_code')
      .order('created_at');
    
    if (finalError) {
      console.error('❌ Error fetching final results:', finalError);
      return;
    }
    
    console.log('\n🎯 FINAL ALPHA USER STATUS:');
    finalUsers.forEach(user => {
      console.log(`  ${user.wallet_address.substring(0, 8)}... → ${user.invite_code || 'NO CODE'}`);
    });
    
    console.log('\n✅ Alpha invite code system setup complete!');
    console.log('📝 Next steps:');
    console.log('  1. Update auth form to accept invite codes');
    console.log('  2. Maintain backward compatibility for wallet addresses');
    console.log('  3. Test dual authentication system');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

addInviteCodeColumn();