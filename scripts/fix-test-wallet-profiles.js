const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixProfiles() {
  const testWallets = [
    {
      wallet: 'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC',
      name: 'Radio Pack Test',
      username: 'radiotestpack'
    },
    {
      wallet: 'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y',
      name: 'Radio Paradise Test',
      username: 'radioparadisetest'
    }
  ];

  const defaultSections = [
    { section_type: 'spotlight', title: 'Spotlight', display_order: 1, is_visible: true, config: [] },
    { section_type: 'media', title: 'Media', display_order: 2, is_visible: true, config: [] },
    { section_type: 'shop', title: 'Shop', display_order: 3, is_visible: true, config: [] },
    { section_type: 'gallery', title: 'Gallery', display_order: 4, is_visible: true, config: [] }
  ];

  for (const test of testWallets) {
    console.log('\n🔧 Processing:', test.name);
    console.log('   Wallet:', test.wallet);

    // Step 1: Ensure user_profiles record exists
    console.log('\n1️⃣  Checking user_profiles...');
    const { data: existing } = await supabase
      .from('user_profiles')
      .select('wallet_address')
      .eq('wallet_address', test.wallet)
      .single();

    if (!existing) {
      console.log('   Creating user_profiles record...');
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: test.wallet,
          username: test.username,
          display_name: test.name,
          bio: 'Test account for radio station features',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('   ❌ Error creating profile:', profileError);
        continue;
      }
      console.log('   ✅ Profile created');
    } else {
      console.log('   ✅ Profile already exists');
    }

    // Step 2: Check existing sections
    console.log('\n2️⃣  Checking sections...');
    const { data: existingSections } = await supabase
      .from('user_profile_sections')
      .select('section_type')
      .eq('wallet_address', test.wallet);

    console.log('   Current sections:', existingSections?.length || 0);

    // Step 3: Add missing sections
    const existingTypes = (existingSections || []).map(s => s.section_type);
    const missingSections = defaultSections.filter(
      s => !existingTypes.includes(s.section_type)
    );

    if (missingSections.length > 0) {
      console.log('   Adding', missingSections.length, 'missing sections...');

      const sectionsToInsert = missingSections.map(s => ({
        wallet_address: test.wallet,
        ...s
      }));

      const { error: sectionsError } = await supabase
        .from('user_profile_sections')
        .insert(sectionsToInsert);

      if (sectionsError) {
        console.error('   ❌ Error creating sections:', sectionsError);
      } else {
        console.log('   ✅ Added sections:', missingSections.map(s => s.section_type).join(', '));
      }
    } else {
      console.log('   ✅ All sections already exist');
    }

    // Step 4: Verify
    console.log('\n3️⃣  Verifying...');
    const { data: finalSections } = await supabase
      .from('user_profile_sections')
      .select('section_type, display_order')
      .eq('wallet_address', test.wallet)
      .order('display_order');

    if (finalSections && finalSections.length === 4) {
      console.log('   ✅ Complete! Profile has all 4 sections:');
      finalSections.forEach(s => {
        console.log('      ' + s.display_order + '. ' + s.section_type);
      });
    } else {
      console.log('   ⚠️  Warning: Profile has', finalSections?.length || 0, 'sections (expected 4)');
    }
  }

  console.log('\n\n✅ Done! Both test wallets should now have complete profiles.');
}

fixProfiles();
