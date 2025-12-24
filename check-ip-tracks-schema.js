const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  // Try to query with isrc field to see if it exists
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, isrc')
    .limit(1);

  if (error) {
    console.log('❌ Error querying isrc field:', error.message);
    console.log('This confirms ISRC field is missing from ip_tracks table');
  } else {
    console.log('✅ ISRC field exists in ip_tracks table');
    console.log('Sample data:', data);
  }
}

checkSchema();
