/**
 * Compare persona structures
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compare() {
  console.log('\n=== PERSONA COMPARISON ===\n');

  const usernames = ['judy-alpha', 'maurice-alpha', 'merlin-alpha', 'blah-poodle'];

  for (const username of usernames) {
    const { data: persona } = await supabase
      .from('personas')
      .select('username, wallet_address, sui_address')
      .eq('username', username)
      .single();

    if (persona) {
      console.log(`@${persona.username}:`);
      console.log(`  wallet_address: ${persona.wallet_address || 'NULL'}`);
      console.log(`  sui_address: ${persona.sui_address || 'NULL'}`);

      // Check tracks
      const address = persona.wallet_address || persona.sui_address;
      if (address) {
        const { data: tracks } = await supabase
          .from('ip_tracks')
          .select('id, title')
          .eq('primary_uploader_wallet', address);
        console.log(`  tracks found: ${tracks?.length || 0}`);
      }
      console.log('');
    } else {
      console.log(`@${username}: NOT FOUND\n`);
    }
  }
}

compare().catch(console.error);
