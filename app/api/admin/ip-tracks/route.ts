import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/ip-tracks
 * Fetch ip_tracks for admin management (requires admin code in header)
 */
export async function GET(request: NextRequest) {
  const adminCode = request.headers.get('x-admin-code');

  if (adminCode !== ADMIN_CODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('ip_tracks')
      .select('id, title, artist, content_type, primary_uploader_wallet, created_at, is_deleted, deleted_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching ip_tracks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tracks: data });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/ip-tracks
 * Hard delete a track (permanent removal)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { id, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('ip_tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting ip_track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/ip-tracks
 * Soft delete (set is_deleted = true) or restore a track
 */
export async function PUT(request: NextRequest) {
  try {
    const { id, is_deleted, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: { is_deleted: boolean; deleted_at: string | null } = {
      is_deleted: is_deleted,
      deleted_at: is_deleted ? new Date().toISOString() : null
    };

    const { error } = await supabaseAdmin
      .from('ip_tracks')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating ip_track:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
