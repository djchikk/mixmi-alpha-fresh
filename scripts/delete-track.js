/**
 * Delete a track by title
 * Run with: node scripts/delete-track.js "track title"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteTrack(title) {
  console.log(`\nSearching for track: "${title}"\n`);

  // Find the track
  const { data: track, error: findError } = await supabase
    .from('ip_tracks')
    .select('id, title, artist, primary_uploader_wallet')
    .eq('title', title)
    .is('deleted_at', null)
    .single();

  if (findError || !track) {
    console.log('Track not found or already deleted');
    console.log('Error:', findError?.message);
    return;
  }

  console.log('Found track:');
  console.log('  ID:', track.id);
  console.log('  Title:', track.title);
  console.log('  Artist:', track.artist);
  console.log('  Wallet:', track.primary_uploader_wallet?.slice(0, 16) + '...');

  // Soft delete (set deleted_at)
  const { error: deleteError } = await supabase
    .from('ip_tracks')
    .update({ deleted_at: new Date().toISOString(), is_deleted: true })
    .eq('id', track.id);

  if (deleteError) {
    console.log('\nError deleting:', deleteError.message);
  } else {
    console.log('\n✅ Track soft-deleted successfully');
  }
}

const title = process.argv.slice(2).join(' ');
if (!title) {
  console.log('Usage: node scripts/delete-track.js "track title"');
  process.exit(1);
}

deleteTrack(title).catch(console.error);
