const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function enableStickers() {
  const testWallets = [
    'SPKQMCRPHYAA50JXGR0QECY7AV09ZABGBAFASYHC', // Rinse FM
    'SP3XPBQ0D5VBRDX40RWTG2ABCN54D94W6DPHS7B8Y'  // Radio Paradise
  ];

  console.log('🎨 Enabling stickers for test wallets...\n');

  for (const wallet of testWallets) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ sticker_visible: true })
      .eq('wallet_address', wallet)
      .select('wallet_address, sticker_visible, sticker_id');

    if (error) {
      console.error('❌ Error for', wallet.substring(0, 25) + '...:', error);
    } else {
      console.log('✅', wallet.substring(0, 25) + '...');
      console.log('   sticker_visible:', data[0].sticker_visible);
      console.log('   sticker_id:', data[0].sticker_id || '(none set yet)');
      console.log('');
    }
  }
}

enableStickers();
