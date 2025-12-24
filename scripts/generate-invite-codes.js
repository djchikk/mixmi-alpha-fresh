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

async function generateInviteCodes() {
  console.log('🎫 GENERATING ALPHA INVITE CODES\n');
  
  try {
    // Get all alpha users
    const { data: users, error } = await supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, invite_code')
      .order('created_at');
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    console.log(`👥 Found ${users.length} alpha users`);
    
    // Generate codes for users without them
    const updates = [];
    
    for (const user of users) {
      if (!user.invite_code) {
        let inviteCode;
        let isUnique = false;
        let attempts = 0;
        
        // Ensure unique invite code
        while (!isUnique && attempts < 10) {
          inviteCode = generateInviteCode();
          
          // Check if code already exists in our updates or database
          const existsInUpdates = updates.some(u => u.invite_code === inviteCode);
          const { data: existing } = await supabase
            .from('alpha_users')
            .select('wallet_address')
            .eq('invite_code', inviteCode)
            .single();
          
          isUnique = !existsInUpdates && !existing;
          attempts++;
        }
        
        if (isUnique) {
          updates.push({
            wallet_address: user.wallet_address,
            invite_code: inviteCode,
            artist_name: user.artist_name
          });
        }
      }
    }
    
    console.log('\n🎯 GENERATED INVITE CODES:');
    updates.forEach(update => {
      console.log(`  ${update.artist_name || 'User'}: ${update.invite_code}`);
      console.log(`    Wallet: ${update.wallet_address.substring(0, 8)}...`);
    });
    
    console.log('\n📝 To apply these codes to the database:');
    console.log('1. Go to Supabase dashboard → alpha_users table');
    console.log('2. Add column: invite_code (VARCHAR, UNIQUE)');
    console.log('3. Manually update each user with their code above');
    
    console.log('\n🔐 SECURITY BENEFITS:');
    console.log('✅ No wallet addresses in UI forms');
    console.log('✅ User-friendly invite codes (MIXMI-ABC123)');
    console.log('✅ Backward compatibility maintained');
    console.log('✅ Easy to share and remember');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

generateInviteCodes();