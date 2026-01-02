import { NextRequest, NextResponse } from 'next/server';
import { UserProfileService } from '@/lib/userProfileService';

// GET handler for simple availability checks (used by SignInModal)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const result = await UserProfileService.checkUsernameAvailability(username);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking username:', error);
    return NextResponse.json(
      { available: false, error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, currentWallet } = await request.json();

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const result = await UserProfileService.checkUsernameAvailability(username, currentWallet);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking username:', error);
    return NextResponse.json(
      { available: false, error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}