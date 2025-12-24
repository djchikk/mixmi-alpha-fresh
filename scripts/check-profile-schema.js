const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking profile-related schema...\n');

  // Check for sections table
  console.log('1️⃣ Looking for profile sections tables...');
  const tables = ['user_profile_sections', 'profile_sections', 'user_sections'];
  
  for (const tableName of tables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (!error) {
      console.log('✅ Found table:', tableName);
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      console.log('   Total records:', count);
    } else if (error.code === '42P01') {
      console.log('❌ Table does not exist:', tableName);
    } else {
      console.log('⚠️  Error checking', tableName + ':', error.message);
    }
  }

  // Check what profile sections exist
  console.log('\n2️⃣ Checking existing sections (if table exists)...');
  const { data: sections, error: sectionsError } = await supabase
    .from('user_profile_sections')
    .select('wallet_address, section_type, is_visible')
    .limit(10);

  if (!sectionsError && sections) {
    console.log('✅ Sample sections:');
    sections.forEach(s => {
      console.log('   ', s.wallet_address.substring(0, 20) + '...:', s.section_type, s.is_visible ? '(visible)' : '(hidden)');
    });
  }

  // Check a working profile to see what sections they have
  console.log('\n3️⃣ Checking sections for Radio Paradise Test...');
  const { data: radioSections } = await supabase
    .from('user_profile_sections')
    .select('*')
    .eq('wallet_address', 'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y');

  if (radioSections && radioSections.length > 0) {
    console.log('✅ Radio Paradise has', radioSections.length, 'sections:');
    radioSections.forEach(s => {
      console.log('   -', s.section_type, '(order:', s.display_order + ', visible:', s.is_visible + ')');
    });
  } else {
    console.log('⚠️  Radio Paradise has NO sections');
  }
}

checkSchema();
