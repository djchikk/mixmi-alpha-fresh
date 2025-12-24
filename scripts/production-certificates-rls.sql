-- =====================================================
-- PRODUCTION-READY CERTIFICATES RLS POLICIES
-- =====================================================
-- TODO: Implement this before production deployment
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view certificates" ON certificates;
DROP POLICY IF EXISTS "Authenticated users can create certificates" ON certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can delete own certificates" ON certificates;

-- Enable RLS
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- 1. Public READ access (certificates are public documents)
CREATE POLICY "Public certificate viewing"
    ON certificates FOR SELECT
    USING (true);

-- 2. Secure INSERT - only for own wallet
-- TODO: This needs to match your auth system's wallet verification
CREATE POLICY "Users create own certificates only"
    ON certificates FOR INSERT
    TO authenticated
    WITH CHECK (
        -- This should validate that the wallet_address matches the authenticated user
        -- For now, we check that wallet_address is not null and matches a pattern
        wallet_address IS NOT NULL 
        AND wallet_address LIKE 'SP%'  -- Stacks address pattern
        -- TODO: Add proper validation against auth context
        -- Example: wallet_address = current_setting('app.current_wallet', true)
    );

-- 3. UPDATE - only own certificates
CREATE POLICY "Users update own certificates"
    ON certificates FOR UPDATE
    TO authenticated
    USING (
        wallet_address IS NOT NULL
        -- TODO: Add proper wallet ownership check
        -- AND wallet_address = current_setting('app.current_wallet', true)
    )
    WITH CHECK (
        wallet_address = OLD.wallet_address  -- Prevent changing wallet
    );

-- 4. DELETE - only own certificates  
CREATE POLICY "Users delete own certificates"
    ON certificates FOR DELETE
    TO authenticated
    USING (
        wallet_address IS NOT NULL
        -- TODO: Add proper wallet ownership check
        -- AND wallet_address = current_setting('app.current_wallet', true)
    );

-- 5. Add service role bypass for system operations
CREATE POLICY "Service role full access"
    ON certificates
    TO service_role
    USING (true)
    WITH CHECK (true);