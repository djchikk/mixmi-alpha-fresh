const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSections() {
  // Check both test wallets
  const wallets = {
    'Rinse FM': 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC',
    'Radio Paradise': 'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y'
  };

  for (const [name, wallet] of Object.entries(wallets)) {
    console.log('\n🔍 Checking sections for', name + ':', wallet);
    
    const { data, error } = await supabase
      .from('profile_sections')
      .select('*')
      .eq('wallet_address', wallet);

    if (error) {
      console.error('❌ Error:', error);
    } else if (data.length === 0) {
      console.log('⚠️  No sections found');
    } else {
      console.log('✅ Found', data.length, 'sections:');
      data.forEach(section => {
        const visibility = section.is_visible ? 'visible' : 'hidden';
        console.log('  -', section.section_type, '(' + visibility + ')');
      });
    }
  }
}

checkSections();
