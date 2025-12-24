/**
 * BNS (Bitcoin Name Service) Resolver
 * Fetches BNS names associated with Stacks wallet addresses
 */

interface BNSName {
  name: string;
  namespace: string;
  fullName: string; // e.g., "sandy.btc"
}

export class BNSResolver {
  private static readonly BNS_API_BASE = 'https://api.hiro.so';

  /**
   * Get all BNS names owned by a wallet address
   */
  static async getNamesForAddress(walletAddress: string): Promise<BNSName[]> {
    try {
      // Using Hiro API to fetch BNS names
      const response = await fetch(
        `${this.BNS_API_BASE}/names/v1/address/${walletAddress}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.log('No BNS names found for address:', walletAddress);
        return [];
      }

      const data = await response.json();

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
      // Parse the BNS name
      const parts = bnsName.split('.');
      if (parts.length !== 2) {
        return false;
      }

      const [name, namespace] = parts;

      // Look up the owner of this BNS name
      const response = await fetch(
        `${this.BNS_API_BASE}/v1/names/${namespace}/${name}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Check if the address matches
      return data.address === walletAddress;
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
      const parts = bnsName.split('.');
      if (parts.length !== 2) {
        return null;
      }

      const [name, namespace] = parts;

      const response = await fetch(
        `${this.BNS_API_BASE}/v1/names/${namespace}/${name}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.address || null;
    } catch (error) {
      console.error('Error resolving BNS name:', error);
      return null;
    }
  }
}

export default BNSResolver;