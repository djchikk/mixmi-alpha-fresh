# BNS API Update Required

## Issue
As of September 2025, the Hiro API endpoints for BNS verification are returning 404 errors.

## Attempted Endpoints (All returning 404):
- `https://api.hiro.so/v1/names/{namespace}/{name}`
- `https://api.hiro.so/v2/names/{name}`
- `https://api.hiro.so/extended/v1/address/{address}/names`
- `https://stacks-node-api.mainnet.stacks.co/v1/addresses/stacks/{address}/names`

## Current Workaround
The `bnsResolver.ts` file currently validates BNS name format but **does not verify on-chain ownership**.
This is a security risk that must be fixed before production.

## TODO
1. Find the correct 2025 BNS API endpoints
2. Update the `verifyBNSOwnership` method to use proper on-chain verification
3. Test with real BNS names to ensure ownership is properly verified

## Possible Solutions
- Check Stacks/Hiro documentation for updated API endpoints
- Use Stacks.js library for direct blockchain queries
- Contact Hiro support for current API documentation
- Use a BNS indexer service if available

## Security Note
**IMPORTANT**: The current implementation only validates format, not ownership.
This means users could potentially claim BNS names they don't own.
This MUST be fixed before production deployment.