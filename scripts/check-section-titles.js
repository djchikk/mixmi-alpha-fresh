const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTitles() {
  console.log('🔍 Checking section titles from working profiles...\n');

  const { data: sections } = await supabase
    .from('user_profile_sections')
    .select('section_type, title, display_order')
    .limit(20);

  if (sections) {
    const bySectionType = {};
    sections.forEach(s => {
      if (!bySectionType[s.section_type]) {
        bySectionType[s.section_type] = s.title;
      }
    });

    console.log('Default titles by section type:');
    for (const [type, title] of Object.entries(bySectionType)) {
      console.log('  ' + type + ': "' + title + '"');
    }
  }
}

checkTitles();
