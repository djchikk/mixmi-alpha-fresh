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
      // Try the extended API endpoint for BNS names
      const response = await fetch(
        `${this.BNS_API_BASE}/extended/v1/address/${walletAddress}/names`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.log('Trying alternative endpoint for address:', walletAddress);
        // Try alternative endpoint
        const altResponse = await fetch(
          `https://stacks-node-api.mainnet.stacks.co/v1/addresses/stacks/${walletAddress}/names`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );

        if (!altResponse.ok) {
          console.log('No BNS names found for address:', walletAddress);
          return [];
        }

        const altData = await altResponse.json();
        console.log('Alternative API response:', altData);

        // Parse the alternative response format
        if (altData.names && Array.isArray(altData.names)) {
          return altData.names.map((nameStr: string) => {
            const parts = nameStr.split('.');
            return {
              name: parts[0],
              namespace: parts[1] || 'btc',
              fullName: nameStr
            };
          });
        }
        return [];
      }

      const data = await response.json();
      console.log('BNS API response:', data);

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

      // For now, let's use a simpler approach:
      // Check if this BNS name is in the list of names owned by this wallet
      const ownedNames = await this.getNamesForAddress(walletAddress);
      console.log('Names owned by wallet:', ownedNames);

      // Check if the provided BNS name is in the list
      const isOwned = ownedNames.some(n => n.fullName === bnsName);

      if (!isOwned) {
        // Also check with different formatting (sandy-h vs sandy_h)
        const normalizedBnsName = bnsName.replace(/-/g, '_');
        const isOwnedNormalized = ownedNames.some(n =>
          n.fullName === normalizedBnsName ||
          n.fullName.replace(/-/g, '_') === normalizedBnsName
        );

        if (isOwnedNormalized) {
          console.log('BNS name matched with normalized format');
          return true;
        }
      }

      console.log('BNS ownership check result:', isOwned);
      return isOwned;
    } catch (error) {
      console.error('Error verifying BNS ownership:', error);
      // If we can't verify, for safety return false
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