import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/alpha-users
 * Fetch all alpha users (requires admin code in header)
 */
export async function GET(request: NextRequest) {
  const adminCode = request.headers.get('x-admin-code');

  if (adminCode !== ADMIN_CODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('alpha_users')
      .select('invite_code, wallet_address, sui_migration_notes, created_at, artist_name, email, notes')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching alpha_users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/alpha-users
 * Update alpha user notes
 */
export async function PUT(request: NextRequest) {
  try {
    const { invite_code, sui_migration_notes, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!invite_code) {
      return NextResponse.json({ error: 'invite_code is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('alpha_users')
      .update({ sui_migration_notes: sui_migration_notes || null })
      .eq('invite_code', invite_code);

    if (error) {
      console.error('Error updating alpha_user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/alpha-users
 * Delete an alpha user
 */
export async function DELETE(request: NextRequest) {
  try {
    const { invite_code, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!invite_code) {
      return NextResponse.json({ error: 'invite_code is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('alpha_users')
      .delete()
      .eq('invite_code', invite_code);

    if (error) {
      console.error('Error deleting alpha_user:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
