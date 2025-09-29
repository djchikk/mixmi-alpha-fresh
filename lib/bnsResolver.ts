/**
 * BNS (Bitcoin Name Service) Resolver
 * Fetches BNS names associated with Stacks wallet addresses
 * Updated for 2025 API endpoints
 */

interface BNSName {
  name: string;
  namespace: string;
  fullName: string; // e.g., "sandy.btc"
}

interface BNSNameDetails {
  address?: string;
  decoded?: string;
  isBnsx?: boolean;
  wrapper?: string;
  zonefileRecords?: any;
}

interface BNSAddressResponse {
  names?: string[];
}

export class BNSResolver {
  // Primary BNS Hub API (2025)
  private static readonly BNS_HUB_API = 'https://api.bns.xyz';
  // Fallback to Hiro API for blockchain data
  private static readonly HIRO_API = 'https://api.hiro.so';

  /**
   * Get all BNS names owned by a wallet address
   */
  static async getNamesForAddress(walletAddress: string): Promise<BNSName[]> {
    try {
      // Use the BNS Hub API (2025)
      console.log('Fetching BNS names for:', walletAddress);
      const response = await fetch(
        `${this.BNS_HUB_API}/api/addresses/stacks/${walletAddress}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.log('BNS Hub API failed, trying fallback...');
        // Try the v1 compatibility endpoint
        const fallbackResponse = await fetch(
          `${this.BNS_HUB_API}/v1/addresses/stacks/${walletAddress}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (!fallbackResponse.ok) {
          console.log('No BNS names found for address:', walletAddress);
          return [];
        }

        const fallbackData = await fallbackResponse.json();
        console.log('Fallback API response:', fallbackData);

        // The v1 endpoint returns a single name
        if (fallbackData.names && Array.isArray(fallbackData.names)) {
          return fallbackData.names.map((nameStr: string) => {
            const parts = nameStr.split('.');
            return {
              name: parts[0],
              namespace: parts[1] || 'btc',
              fullName: nameStr
            };
          });
        } else if (typeof fallbackData === 'string') {
          const parts = fallbackData.split('.');
          return [{
            name: parts[0],
            namespace: parts[1] || 'btc',
            fullName: fallbackData
          }];
        }
        return [];
      }

      const data: BNSAddressResponse = await response.json();
      console.log('BNS Hub API response:', data);

      // Transform the response to our BNSName format
      const names: BNSName[] = [];
      if (data.names && Array.isArray(data.names)) {
        for (const nameStr of data.names) {
          // BNS names come in format "name.namespace"
          const parts = nameStr.split('.');
          if (parts.length === 2) {
            names.push({
              name: parts[0],
              namespace: parts[1],
              fullName: nameStr
            });
          }
        }
      }

      return names;
    } catch (error) {
      console.error('Error fetching BNS names:', error);
      return [];
    }
  }

  /**
   * Get the primary BNS name for a wallet (usually the .btc one)
   */
  static async getPrimaryBNSName(walletAddress: string): Promise<string | null> {
    try {
      const names = await this.getNamesForAddress(walletAddress);

      // Prioritize .btc names
      const btcName = names.find(n => n.namespace === 'btc');
      if (btcName) {
        return btcName.fullName;
      }

      // Fall back to .id names
      const idName = names.find(n => n.namespace === 'id');
      if (idName) {
        return idName.fullName;
      }

      // Return first name if any
      return names.length > 0 ? names[0].fullName : null;
    } catch (error) {
      console.error('Error getting primary BNS name:', error);
      return null;
    }
  }

  /**
   * Verify that a BNS name belongs to a specific wallet address
   */
  static async verifyBNSOwnership(bnsName: string, walletAddress: string): Promise<boolean> {
    try {
      console.log('Verifying BNS ownership:', { bnsName, walletAddress });

      // Basic format validation first
      if (!bnsName.includes('.')) {
        console.log('Invalid BNS format - missing dot');
        return false;
      }

      const parts = bnsName.split('.');
      if (parts.length !== 2) {
        console.log('Invalid BNS format - wrong number of parts');
        return false;
      }

      const [name, namespace] = parts;

      // Only allow .btc and .id namespaces
      if (namespace !== 'btc' && namespace !== 'id') {
        console.log('Invalid namespace - only .btc and .id allowed');
        return false;
      }

      // Name must be valid (alphanumeric and hyphens)
      if (!/^[a-z0-9-]+$/.test(name)) {
        console.log('Invalid name format');
        return false;
      }

      // Method 1: Check via name details using BNS Hub API
      try {
        const nameResponse = await fetch(
          `${this.BNS_HUB_API}/api/names/${bnsName}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (nameResponse.ok) {
          const nameData: BNSNameDetails = await nameResponse.json();
          console.log('BNS name details:', nameData);

          // Check if the address matches
          if (nameData.address === walletAddress) {
            console.log('✅ BNS ownership verified via name lookup');
            return true;
          }
        }
      } catch (nameError) {
        console.log('Name lookup failed, trying address lookup...');
      }

      // Method 2: Check via address ownership
      try {
        const addressResponse = await fetch(
          `${this.BNS_HUB_API}/api/addresses/stacks/${walletAddress}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (addressResponse.ok) {
          const addressData: BNSAddressResponse = await addressResponse.json();
          console.log('Address BNS names:', addressData);

          // Check if the BNS name is in the list of names owned by this address
          if (addressData.names?.includes(bnsName)) {
            console.log('✅ BNS ownership verified via address lookup');
            return true;
          }
        }
      } catch (addressError) {
        console.log('Address lookup also failed');
      }

      console.log('❌ BNS ownership could not be verified');
      return false;
    } catch (error) {
      console.error('Error verifying BNS ownership:', error);
      return false;
    }
  }

  /**
   * Resolve a BNS name to a wallet address
   */
  static async resolveToAddress(bnsName: string): Promise<string | null> {
    try {
      // Validate format
      const parts = bnsName.split('.');
      if (parts.length !== 2) {
        return null;
      }

      // Use BNS Hub API to resolve name to address
      const response = await fetch(
        `${this.BNS_HUB_API}/api/names/${bnsName}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.log('Failed to resolve BNS name:', bnsName);
        return null;
      }

      const data: BNSNameDetails = await response.json();
      console.log('Resolved BNS name:', data);

      // Return the owner's address
      return data.address || null;
    } catch (error) {
      console.error('Error resolving BNS name:', error);
      return null;
    }
  }
}

export default BNSResolver;