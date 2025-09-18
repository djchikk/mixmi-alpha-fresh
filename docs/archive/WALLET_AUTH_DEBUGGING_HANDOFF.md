# WALLET AUTHENTICATION DEBUGGING HANDOFF

## 🚨 **CRITICAL ISSUE: Wallet Authentication Failures**

**Error Pattern:**
```
🚨 Supabase session error: AuthApiError: User from sub claim in JWT does not exist
🚨 Wallet session creation failed: Failed to set Supabase session
💥 Save failed: User from sub claim in JWT does not exist
```

## 🔍 **PROBLEM ANALYSIS**

### **What's Happening:**
1. **User enters wallet address** in form (e.g., `SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A`)
2. **System tries to authenticate** with that wallet
3. **JWT creation succeeds** (user creation works)
4. **Session creation fails** (user lookup fails)
5. **Upload fails** with "User from sub claim in JWT does not exist"

### **Inconsistent Behavior:**
- ✅ **Some wallets work** consistently (`SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7`)
- ❌ **New wallets fail** even though user creation logs show success
- 🤔 **Same wallet** can work sometimes, fail other times
- 🔄 **Intermittent issues** suggest timing or cache problems

## 🏗️ **AUTHENTICATION ARCHITECTURE**

### **Current System Flow:**
```typescript
// 1. Form submission
handleSubmit() → 

// 2. Determine wallet address  
const effectiveWalletAddress = formData.uploader_wallet_override || walletAddress;

// 3. Create wallet session
const authSession = await SupabaseAuthBridge.createWalletSession(effectiveWalletAddress);

// 4. Use authenticated client
authSession.supabase.from('ip_tracks').insert(data)
```

### **Authentication Bridge Process:**
```typescript
// supabase-auth-bridge.ts
1. Generate UUID from wallet address
2. Check if user exists in Supabase auth
3. Create user if doesn't exist  
4. Generate JWT token
5. Set Supabase session with JWT
6. Return authenticated client
```

## 🐛 **SUSPECTED ROOT CAUSES**

### **1. Development Mock System Interference**
**Evidence:** User mentioned "hard-wired login during testing"

**Possible Issues:**
- Mock authentication overriding real wallet addresses
- Development shortcuts interfering with production auth flow
- Cached authentication states from previous testing

**Investigation Needed:**
```typescript
// Check for hardcoded wallet addresses in:
- AuthContext 
- ProfileContext
- Environment variables
- localStorage overrides
- Development-only auth bypasses
```

### **2. User Creation vs Session Creation Timing**
**Evidence:** User creation logs show success, but session creation fails

**Possible Race Condition:**
```typescript
// User creation succeeds:
✅ User already exists in Supabase

// But session creation fails immediately after:
❌ User from sub claim in JWT does not exist
```

**Timing Issue:** User might exist in auth.users but not be fully propagated when session creation runs.

### **3. Wallet Address Format Issues**
**Evidence:** `SP2...` vs `SP3...` wallets behave differently

**Different Behaviors:**
- `SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7` ✅ Always works
- `SP2ZTDRRBC8SN8MBWX0D2HTHWN3ZS8GEYD36F4AP9` ✅ Worked multiple times  
- `SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A` ❌ Always fails

**Investigation:** Are `SP3...` addresses handled differently from `SP2...`?

### **4. Database Cleanup Side Effects**
**Evidence:** Authentication issues appeared during/after database migration work

**Recent Changes:**
- Database reset and migration scripts
- RLS (Row Level Security) policy changes
- User table modifications
- Service role permissions changes

## 🔧 **FILES TO INVESTIGATE**

### **Authentication System:**
```
lib/auth/supabase-auth-bridge.ts     # Main authentication logic
contexts/AuthContext.tsx             # Auth state management  
contexts/ProfileContext.tsx          # Profile/wallet management
app/api/auth/create-session.ts       # JWT creation endpoint
```

### **Development Overrides:**
```
.env.local                          # Environment variables
hooks/useAuth.ts                    # Auth hooks
components/auth/                    # Auth components
```

### **Database & RLS:**
```
scripts/fix-ip-tracks-rls.sql       # Recent RLS changes
scripts/archive-and-reset-ip-tracks.sql  # Database migration
```

## 🧪 **DEBUGGING STEPS**

### **1. Authentication Flow Analysis**
```typescript
// Add detailed logging in supabase-auth-bridge.ts:
console.log('🔍 WALLET AUTH DEBUG:', {
  walletAddress,
  generatedUUID,
  userExistsCheck,
  userCreationResult,
  jwtGenerationResult,
  sessionCreationResult
});
```

### **2. Mock System Detection**
```typescript
// Search codebase for:
- "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7" (hardcoded references)
- "mock" + "wallet" 
- "override" + "auth"
- Development environment checks
```

### **3. User Table Investigation**
```sql
-- Check Supabase auth.users table:
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE id IN (
  'c7e7cd44-c407-128b-938d-a06255098447',  -- SP2J6ZY... (working)
  'f8fbf37e-32fc-f265-d87a-c82d2e6fc0b5'   -- SP2ZTDR... (working)
);

-- Check for SP3 wallet UUID:
-- Generate UUID for SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A and search
```

### **4. Wallet Format Testing**
Test different wallet formats:
- `SP1...` addresses
- `SP2...` addresses  
- `SP3...` addresses
- Invalid formats

## 🚀 **QUICK FIXES TO TRY**

### **1. Force User Creation**
```typescript
// In supabase-auth-bridge.ts, add retry logic:
if (sessionResult.error?.message?.includes('does not exist')) {
  console.log('🔄 User missing, forcing recreation...');
  await forceCreateUser(walletAddress);
  // Retry session creation
}
```

### **2. Authentication Cleanup**
```typescript
// Clear all auth state before new wallet:
localStorage.clear();
await supabase.auth.signOut();
// Then try authentication
```

### **3. Hardcoded Wallet Check**
```typescript
// Add logging to detect mock overrides:
console.log('🔍 WALLET SOURCES:', {
  formWallet: formData.uploader_wallet_override,
  contextWallet: walletAddress,
  effectiveWallet: effectiveWalletAddress,
  anyMockOverrides: /* check for hardcoded values */
});
```

## 📊 **WORKING WALLET ADDRESSES**

### **Confirmed Working (Use for Testing):**
```
SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7  ✅ Mock/dev wallet
SP2ZTDRRBC8SN8MBWX0D2HTHWN3ZS8GEYD36F4AP9  ✅ User wallet (worked multiple times)
```

### **Problem Wallets:**
```
SP3SJDS5QQY4J18VKAHBK1E5ZN7N4A1CSYT6GYQ5A  ❌ Always fails
[Any other SP3... addresses]           ❌ Suspected format issue
```

## 🎯 **SUCCESS CRITERIA**

### **Immediate Goals:**
1. **Any wallet address** should work consistently
2. **No authentication failures** during upload
3. **User creation** and **session creation** both succeed
4. **Clear error messages** if wallet format is invalid

### **Long-term Goals:**
1. **Remove development dependencies** on hardcoded wallets
2. **Robust wallet validation** with clear error messages
3. **Automatic user creation** for any valid Stacks wallet
4. **Production-ready authentication** flow

## 🤝 **HANDOFF INSTRUCTIONS**

### **For Next Claude Session:**
1. **Start with working wallet** (`SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7`) to test loop pack features
2. **Debug authentication separately** from loop pack implementation
3. **Use detailed logging** to trace authentication flow
4. **Check for mock/development overrides** in codebase

### **Current Workaround:**
Use confirmed working wallet addresses for all testing until authentication system is debugged and fixed.

### **Priority:**
Authentication debugging is **important but separate** from loop pack implementation. Can be tackled in parallel or after core features are complete.

---

**🔧 This authentication issue shouldn't block loop pack development - use working wallets for testing!**