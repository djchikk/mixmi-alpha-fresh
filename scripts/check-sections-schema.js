const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking profile_sections table...\n');
  
  const { data, error } = await supabase
    .from('profile_sections')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Found', data.length, 'sample records:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkSchema();
