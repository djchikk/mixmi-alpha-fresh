import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';

/**
 * Generate a deterministic avatar from a wallet address
 * Same wallet address will always produce the same avatar
 */
export function generateAvatar(walletAddress: string): string {
  const avatar = createAvatar(shapes, {
    seed: walletAddress,
    size: 128,
    // Customize colors to match Mixmi theme
    backgroundColor: ['101726'], // Dark background like your app
  });

  return avatar.toDataUri();
}

/**
 * Get the first letter for a text-based placeholder
 * Priority: display name > username > wallet address
 */
export function getInitial(
  displayName?: string | null,
  username?: string | null,
  walletAddress?: string | null
): string {
  if (displayName && displayName.length > 0) {
    return displayName[0].toUpperCase();
  }
  if (username && username.length > 0) {
    return username[0].toUpperCase();
  }
  if (walletAddress && walletAddress.length > 0) {
    return walletAddress[0].toUpperCase();
  }
  return '?';
}
