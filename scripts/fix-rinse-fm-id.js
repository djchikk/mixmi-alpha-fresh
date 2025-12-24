const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRinseFMId() {
  console.log('🔧 Fixing Rinse FM ID...\n');

  // Generate a new UUID
  const newId = crypto.randomUUID();
  console.log('📝 Generated new ID:', newId);

  // Update the record
  const { data, error } = await supabase
    .from('ip_tracks')
    .update({ id: newId })
    .eq('title', 'Rinse FM test')
    .is('id', null)
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Updated record:', data);
}

fixRinseFMId();
