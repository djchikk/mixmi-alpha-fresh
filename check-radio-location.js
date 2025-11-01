const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRadioParadise() {
  const { data, error } = await supabase
    .from('ip_tracks')
    .select('id, title, content_type, location_lat, location_lng, primary_location, locations')
    .ilike('title', '%radio paradise%')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Radio Paradise location data:');
  console.log(JSON.stringify(data, null, 2));
}

checkRadioParadise();
