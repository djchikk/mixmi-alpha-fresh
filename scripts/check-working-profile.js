const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorking() {
  console.log('🔍 Finding a complete working profile...\n');

  // Get all sections
  const { data: allSections } = await supabase
    .from('user_profile_sections')
    .select('wallet_address, section_type, is_visible, display_order, config');

  if (!allSections) {
    console.log('❌ No sections found');
    return;
  }

  // Group by wallet
  const byWallet = {};
  allSections.forEach(s => {
    if (!byWallet[s.wallet_address]) {
      byWallet[s.wallet_address] = [];
    }
    byWallet[s.wallet_address].push(s);
  });

  // Find wallet with all 4 section types
  const sectionTypes = ['spotlight', 'media', 'shop', 'gallery'];
  let completeWallet = null;

  for (const [wallet, sections] of Object.entries(byWallet)) {
    const types = sections.map(s => s.section_type);
    const hasAll = sectionTypes.every(type => types.includes(type));
    if (hasAll && sections.length === 4) {
      completeWallet = wallet;
      const short = wallet.substring(0, 30);
      console.log('✅ Found complete profile:', short + '...');
      console.log('   Has all 4 default sections:\n');
      sections.sort((a, b) => a.display_order - b.display_order);
      sections.forEach(s => {
        console.log('   ' + s.display_order + '. ' + s.section_type);
        console.log('      visible:', s.is_visible);
        console.log('      config:', s.config);
        console.log('');
      });
      break;
    }
  }

  if (!completeWallet) {
    console.log('⚠️  No profile found with all 4 sections. Showing what we have...');
    console.log('\nProfiles and their section counts:');
    for (const [wallet, sections] of Object.entries(byWallet)) {
      const types = sections.map(s => s.section_type).join(', ');
      const short = wallet.substring(0, 25);
      console.log('  ' + short + '... (' + sections.length + ' sections): ' + types);
    }
  }
}

checkWorking();
