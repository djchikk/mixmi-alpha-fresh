# Wallet Whitelist System 🔐
## *Alpha User Authentication for Mixmi Uploader*

---

## 🎯 **System Overview**

The **Alpha User Whitelist System** provides secure, simple authentication for approved content creators without the complexity of JWT tokens or user creation flows.

### **Core Concept**
- ✅ **Approved wallets only** - Pre-vetted alpha users can upload content
- ✅ **Simple paste-and-go** - User pastes wallet address, system validates instantly  
- ✅ **Server-side security** - Whitelist validation uses service role key
- ✅ **No account creation** - Eliminates user registration failures and complexity

---

## 🏗️ **Architecture**

### **Database Table: `alpha_users`**
```sql
CREATE TABLE alpha_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  approved boolean DEFAULT true,
  notes text
);
```

### **Authentication Flow** 🔄
```typescript
1. User visits alpha uploader
2. Pastes STX wallet address in form  
3. System calls /api/alpha-auth with wallet address
4. Server-side API checks alpha_users whitelist table
5. If approved → upload proceeds with wallet attribution
6. If rejected → clear error message displayed
```

### **API Endpoint: `/api/alpha-auth`** 📡
```typescript
// Server-side validation endpoint
export async function POST(request: Request) {
  const { walletAddress } = await request.json();
  
  // Use service role key for secure database access
  const { data, error } = await supabaseAdmin
    .from('alpha_users')
    .select('wallet_address, approved')
    .eq('wallet_address', walletAddress)
    .eq('approved', true)
    .single();
    
  if (data) {
    return NextResponse.json({ approved: true });
  } else {
    return NextResponse.json({ approved: false });
  }
}
```

---

## 🔧 **Implementation Files**

### **Core Authentication Logic**
- **`lib/auth/alpha-auth.ts`** - Whitelist authentication class
- **`app/api/alpha-auth/route.ts`** - Server-side validation API endpoint  
- **`contexts/AuthContext.tsx`** - Simplified auth context (no complex JWT)

### **Database Scripts**
- **`scripts/create-alpha-users-table.sql`** - Create whitelist table
- **Database setup** - Pre-load approved alpha user wallet addresses

---

## 👤 **Alpha User Management**

### **Adding New Alpha Users**
```sql
-- Add approved alpha user to whitelist
INSERT INTO alpha_users (wallet_address, notes) 
VALUES ('SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 'Test user - approved for alpha testing');
```

### **Current Test Wallet**
- **Address**: `SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7`
- **Status**: Pre-approved in alpha_users table
- **Usage**: Available for testing upload functionality

### **Wallet Address Format**
- **Length**: 41-42 characters (SP mainnet addresses)
- **Format**: Starts with "SP" followed by alphanumeric characters
- **Validation**: Server-side format checking + whitelist lookup

---

## ⚡ **Benefits Over Previous System**

### **Before: Complex JWT Authentication** ❌
- User creation flows that could fail
- JWT token management complexity  
- Session handling and persistence issues
- Multiple failure points in auth chain
- Page hanging/loading problems

### **After: Simple Whitelist System** ✅
- **Single API call** - Instant validation
- **No user creation** - Eliminates registration failures  
- **Clear feedback** - Approved/rejected status immediately  
- **Reliable flow** - No hanging or session issues
- **Scalable** - Easy to add new alpha users

---

## 🔒 **Security Considerations**

### **Server-Side Validation**
- ✅ **Service role key** used for database access
- ✅ **Whitelist only** - No unauthorized uploads possible
- ✅ **Input validation** - Wallet address format checking
- ✅ **Clear rejection** - Non-approved addresses get clear error

### **Alpha User Privacy**
- **Minimal data** - Only wallet address + approval status stored
- **No personal info** - No emails, names, or profile data required
- **Blockchain native** - Works with existing Stacks wallet ecosystem

---

## 🧪 **Testing & Development**

### **Local Development**
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`
2. Run database scripts to create `alpha_users` table
3. Add test wallet to whitelist for development
4. Test upload flow with approved wallet address

### **Adding Alpha Users for Testing**
```sql
-- Add additional test users
INSERT INTO alpha_users (wallet_address, notes) VALUES 
  ('SP1234567890ABCDEF...', 'Content creator - approved alpha'),
  ('SP9876543210FEDCBA...', 'Producer - approved alpha'),
  ('SPABCDEF1234567890...', 'Artist collective - approved alpha');
```

---

## 🚀 **Production Deployment**

### **Pre-Deployment Checklist**
- ✅ Create `alpha_users` table in production Supabase
- ✅ Add approved alpha user wallet addresses  
- ✅ Verify service role key is configured
- ✅ Test authentication flow with real wallet addresses
- ✅ Ensure proper error messaging for rejected addresses

### **Scaling Considerations**
- **Easy expansion** - Add new users with simple SQL INSERT
- **Approval workflow** - Can add admin interface for user management
- **Usage tracking** - Can add analytics on approved user activity
- **Migration path** - Can evolve to full user system when ready

---

## 📋 **Troubleshooting**

### **Common Issues & Solutions**

#### **"Service key missing" error**
```
Problem: SUPABASE_SERVICE_ROLE_KEY not configured
Solution: Add to .env.local and restart dev server
```

#### **Wallet not approved**  
```
Problem: Valid wallet format but not in whitelist
Solution: Add wallet to alpha_users table
```

#### **API endpoint not responding**
```
Problem: /api/alpha-auth route not working
Solution: Check Next.js API routes are working, verify service key
```

---

## 💡 **Future Enhancements**

### **Admin Interface (Optional)**
- Web UI for managing alpha user whitelist
- Approval/rejection workflow for new applications
- Usage analytics and upload tracking

### **Enhanced Validation (Optional)**  
- Stacks blockchain verification of wallet ownership
- Integration with Stacks profiles for creator info
- Automatic wallet validation via blockchain queries

### **Migration Path (Future)**
- Seamless upgrade to full user account system
- Preserve existing alpha user content and attribution
- Maintain backward compatibility with whitelist approach

---

**This whitelist system eliminates authentication complexity while maintaining security and providing a smooth user experience for approved alpha content creators.** ✅

*Created: September 2025 during the Epic Committee of Claudes Session* 🎤🔍🧠