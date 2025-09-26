# Certificate System - Production TODO

## Current Status
✅ Certificate generation working
✅ PDFs generating correctly  
✅ Storage bucket configured
✅ Database table created
✅ Certificates displaying in Vault

## Security Issues to Fix Before Production

### 1. RLS Policies Need Refinement
**Current Issue**: Any authenticated user can create certificates for any wallet address

**Fix Required**:
- Implement proper wallet ownership validation in RLS policies
- Match certificate wallet_address with authenticated user's wallet
- See `scripts/production-certificates-rls.sql` for template

### 2. Authentication Bridge Integration
**Current Issue**: The RLS policies don't properly validate against the Stacks wallet auth system

**Fix Required**:
- Update `SupabaseAuthBridge` to set wallet context for RLS
- Use `set_config()` to pass wallet address to RLS policies
- Validate wallet ownership in INSERT/UPDATE/DELETE policies

### 3. Add Certificate Validation
**Current Issue**: No validation that the track belongs to the certificate creator

**Fix Required**:
- Verify track ownership before generating certificate
- Add check that `track.primary_uploader_wallet === walletAddress`

## Nice-to-Have Improvements

### 1. Remix Depth on Certificates
- Add remix depth information to generated PDFs
- Show "Generation X Remix" badge
- Include source track attribution

### 2. Bulk Certificate Generation
- Add ability to generate certificates for existing tracks
- Useful for migrating old data

### 3. Certificate Verification Page
- Public page to verify certificate authenticity
- Use certificate number or QR code
- Show full certificate details

### 4. Certificate Styles
- Different designs for different license types
- Special design for remixes vs originals
- Customizable branding

## Implementation Priority
1. 🔴 Fix RLS security (CRITICAL before production)
2. 🟡 Add validation checks (IMPORTANT)
3. 🟢 Add remix depth info (NICE TO HAVE)
4. 🟢 Other improvements (FUTURE)

## Testing Checklist
- [ ] Test certificate generation with multiple wallets
- [ ] Verify users can only see their own certificates
- [ ] Test certificate download functionality
- [ ] Verify PDF generation with various special characters
- [ ] Test with remixes to ensure proper attribution