/**
 * Check and update notes field for video clips
 * This script will:
 * 1. Find the specific video by ID
 * 2. Show current notes value
 * 3. Update notes if needed
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAndUpdateVideoNotes() {
  const videoId = '251bd750-e405-423d-b48c-56937d23c334'; // From console log

  console.log('🔍 Checking video record...\n');

  // Fetch the video record
  const { data: video, error: fetchError } = await supabase
    .from('ip_tracks')
    .select('id, title, notes, content_type, video_url, audio_url')
    .eq('id', videoId)
    .single();

  if (fetchError) {
    console.error('❌ Error fetching video:', fetchError);
    return;
  }

  console.log('📹 Video found:');
  console.log('  Title:', video.title);
  console.log('  Content Type:', video.content_type);
  console.log('  Notes:', video.notes || '(empty)');
  console.log('  Video URL:', video.video_url ? '✅ Present' : '❌ Missing');
  console.log('  Audio URL:', video.audio_url ? '✅ Present' : '❌ Missing');
  console.log('');

  // Check if notes field exists and has content
  if (!video.notes || video.notes.trim() === '') {
    console.log('⚠️  Notes field is empty or null');
    console.log('');
    console.log('Would you like to add test notes? Update this script with:');
    console.log('');
    console.log('const testNotes = "Your kinetic text goes here";');
    console.log('');
    console.log('Then uncomment the update section below.');
    console.log('');

    // UNCOMMENT THIS SECTION TO UPDATE NOTES:
    /*
    const testNotes = "Breaking news from the underground vibes flowing through the city streets rhythms colliding with the night";

    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({ notes: testNotes })
      .eq('id', videoId);

    if (updateError) {
      console.error('❌ Error updating notes:', updateError);
    } else {
      console.log('✅ Notes updated successfully!');
      console.log('New notes:', testNotes);
    }
    */
  } else {
    console.log('✅ Notes field has content:');
    console.log('  "' + video.notes + '"');
    console.log('');
    console.log('Notes are present in database but not showing in app.');
    console.log('This suggests a TypeScript or query issue.');
  }

  // Also check if video_url and audio_url need to be populated
  if (!video.video_url && video.content_type === 'video_clip') {
    console.log('');
    console.log('⚠️  Video URL is missing for video_clip content type');
    console.log('This needs to be fixed in the upload process.');
  }

  if (!video.audio_url && video.content_type === 'video_clip') {
    console.log('');
    console.log('⚠️  Audio URL is missing for video_clip content type');
    console.log('For video clips, audio_url should point to the same MP4 file.');
  }
}

checkAndUpdateVideoNotes()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
