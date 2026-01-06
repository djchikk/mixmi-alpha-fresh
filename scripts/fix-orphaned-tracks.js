/**
 * Fix orphaned tracks for blah-poodle
 * Clears pack_id and pack_position for tracks whose parent pack is deleted
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PACK_ID = 'd59cae0f-59c3-436a-ac95-3c750a1de61a';

async function fix() {
  console.log('\n=== FIXING ORPHANED TRACKS ===\n');

  // 1. Show what we're fixing
  const { data: orphans } = await supabase
    .from('ip_tracks')
    .select('id, title, pack_id, pack_position')
    .eq('pack_id', PACK_ID);

  console.log('Orphaned tracks to fix:', orphans?.length || 0);
  if (orphans) {
    orphans.forEach(t => console.log(' -', t.title, '(pack_position:', t.pack_position + ')'));
  }

  // 2. Clear the pack_id and pack_position
  console.log('\nClearing pack_id and pack_position...');
  const { error } = await supabase
    .from('ip_tracks')
    .update({ pack_id: null, pack_position: null })
    .eq('pack_id', PACK_ID);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 3. Verify
  const { data: after } = await supabase
    .from('ip_tracks')
    .select('id, title, pack_id, pack_position')
    .in('id', orphans.map(t => t.id));

  console.log('\nAfter fix:');
  after.forEach(t => console.log(' -', t.title, '| pack_id:', t.pack_id, '| pack_position:', t.pack_position));

  console.log('\n✅ Done! Tracks should now appear in My Work tab.');
}

fix().catch(console.error);
