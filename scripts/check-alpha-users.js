const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAlphaUsers() {
  console.log('🔍 CHECKING ALPHA USERS TABLE STRUCTURE\n');
  
  try {
    // Get all alpha users to see current structure
    const { data: users, error } = await supabase
      .from('alpha_users')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📊 Current alpha_users table structure:');
    if (users && users.length > 0) {
      console.log('📋 Fields in alpha_users:');
      Object.keys(users[0]).forEach(field => {
        console.log(`  • ${field}`);
      });
      
      console.log(`\n👥 Total alpha users: ${users.length}`);
      console.log('\n📝 Sample data:');
      users.forEach((user, i) => {
        console.log(`  ${i+1}. ${user.wallet_address?.substring(0, 8)}... (${user.created_at?.substring(0, 10)})`);
      });
    } else {
      console.log('No users found');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAlphaUsers();