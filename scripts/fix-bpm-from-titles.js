const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixBPMFromTitles() {
  console.log('🎵 EXTRACTING REAL BPM FROM TRACK TITLES\n');
  
  // Get all tracks
  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('id, title, bpm');

  if (error) {
    console.error('❌ Error fetching tracks:', error);
    return;
  }

  console.log(`📋 Found ${tracks.length} tracks to process\n`);

  let updatedCount = 0;
  let unchangedCount = 0;

  for (const track of tracks) {
    // Extract BPM from title using multiple patterns
    const bpmPatterns = [
      /_(\d{2,3})_?BPM/i,           // "_140_BPM" or "_140BPM"
      /_(\d{2,3})\s*BPM/i,          // "_140 BPM"
      /(\d{2,3})\s*BPM/i,           // "140 BPM"
      /-\s*(\d{2,3})\s*$/,          // "Track - 140"
      /_(\d{2,3})\s*$/,             // "Track_140"
    ];

    let extractedBPM = null;

    for (const pattern of bpmPatterns) {
      const match = track.title.match(pattern);
      if (match) {
        const bpm = parseInt(match[1]);
        if (bpm >= 60 && bpm <= 200) { // Valid BPM range
          extractedBPM = bpm;
          break;
        }
      }
    }

    if (extractedBPM && extractedBPM !== track.bpm) {
      // Update the BPM
      const { error: updateError } = await supabase
        .from('ip_tracks')
        .update({ bpm: extractedBPM })
        .eq('id', track.id);

      if (updateError) {
        console.error(`❌ Failed to update ${track.title}:`, updateError);
      } else {
        console.log(`✅ Updated "${track.title}": ${track.bpm} → ${extractedBPM} BPM`);
        updatedCount++;
      }
    } else if (extractedBPM === track.bpm) {
      console.log(`✓ "${track.title}": BPM already correct (${track.bpm})`);
      unchangedCount++;
    } else {
      console.log(`⚠️ "${track.title}": No BPM found in title (keeping ${track.bpm})`);
      unchangedCount++;
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`Updated: ${updatedCount} tracks`);
  console.log(`Unchanged: ${unchangedCount} tracks`);
  console.log(`\n🎉 BPM extraction complete!`);
}

fixBPMFromTitles().catch(console.error); 