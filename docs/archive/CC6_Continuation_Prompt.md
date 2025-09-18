# CC#6 Continuation Prompt
**For Next Claude Code Instance**

## 🎯 **Context & Mission**

You are CC#6 working on the Mixmi Alpha Uploader project. Your team includes a human and multiple Claude instances (CC#5 was the previous project manager). You've been analyzing Stacks wallet authentication implementation and domain deployment strategy for the music upload platform.

## 📋 **Current Status**

### **Environment Issue**
- Original environment broke during development
- Code is being moved to a fresh folder with new dependencies
- Previous comprehensive analysis completed (see `CC6_Stacks_Wallet_Authentication_Analysis.md`)

### **Project State**
- **Mixmi Alpha Uploader** is a Next.js music content upload platform
- **3D Globe visualization** with 17ms loading time (performance optimized)
- **Multi-step upload form** with enhanced UI (recently updated by team)
- **Alpha whitelist authentication** currently working
- **Ready for production domain deployment** to `mixmi.app/alpha`

### **Key Recent Discoveries**
1. **@stacks/connect v8.1.7** already installed - production-ready for wallet auth
2. **Critical security issues** identified that need fixing before domain deployment
3. **Form enhancements** completed by team with new styling and functionality
4. **Domain strategy decided** - `mixmi.app/alpha` path-based (not subdomain)

## 🔧 **Immediate Next Steps**

When you continue, you should:

### **1. Security Audit & Fixes**
**Priority: CRITICAL - Do before domain deployment**
```typescript
// Fix these insecure RLS policies:
// CURRENT: CREATE POLICY "Anyone can insert profiles" FOR INSERT WITH CHECK (true);
// NEEDED: CREATE POLICY "Wallet owners only" FOR INSERT WITH CHECK (auth.jwt() ->> 'wallet_address' = wallet_address);
```

### **2. Domain Deployment Preparation**
- Verify Next.js routing configuration for `/alpha` path
- Ensure all environment variables are production-ready
- Test wallet authentication flow with real domain

### **3. Wallet Authentication Enhancement**
- Implement dual-mode auth (alpha whitelist + real wallet connect)
- Add signature verification for production users
- Maintain backward compatibility

## 📁 **Critical Files to Examine**

```bash
# Main upload modal (recently updated with new UI)
components/modals/IPTrackModal.tsx

# Current authentication system
contexts/AuthContext.tsx
lib/auth/alpha-auth.ts
app/api/auth/alpha-check/route.ts

# Database security
setup-supabase-storage-minimal.sql  # Contains insecure policies

# Project configuration
package.json  # Contains @stacks/connect v8.1.7
tailwind.config.js  # Design system
CLAUDE.md  # Full project documentation
```

## 🎯 **Approach & Tone**

- **Be concise and direct** (user prefers minimal responses)
- **Focus on actionable next steps** rather than lengthy explanations
- **Use TodoWrite tool** to track progress systematically
- **Prioritize security fixes** before deployment features
- **Maintain collaborative team spirit** with human and other Claude instances

## ⚡ **Key Technical Context**

### **Current Architecture:**
- **Next.js 14** with App Router and TypeScript
- **Supabase** database with RLS (needs security fixes)
- **@stacks/connect v8.1.7** for wallet authentication
- **Three.js** for 3D globe (17ms loading, no performance issues)
- **Tailwind CSS** with custom design system

### **Security Vulnerabilities Identified:**
- Wide-open RLS policies allowing any user CRUD operations
- Service role key potentially exposed client-side
- Public storage buckets for private user content
- Missing request rate limiting

### **Performance Status:**
- ✅ Globe optimization complete (1,882x improvement achieved)
- ✅ Image system overhaul complete (clean URLs vs base64)
- ✅ Location accuracy fix complete (exact coordinates preserved)

## 🚀 **Success Metrics**

You'll know you're on track when:
1. **Security issues resolved** - RLS policies, service role isolation, private buckets
2. **Domain deployment successful** - `mixmi.app/alpha` working with real wallet auth
3. **User experience enhanced** - Smooth upload flow with professional UI
4. **Team collaboration effective** - Clear communication with human and other Claudes

## 💬 **Communication Style**

- **Answer questions directly** (2-4 lines max unless asked for detail)
- **Use TodoWrite tool proactively** for task management
- **Provide code examples** when implementing solutions
- **Flag critical issues immediately** (security, breaking changes)

## 📝 **Reference Materials**

- Full analysis in `CC6_Stacks_Wallet_Authentication_Analysis.md`
- Project documentation in `CLAUDE.md`
- Recent form updates visible in `IPTrackModal.tsx`
- Package dependencies in `package.json`

---

**Ready to continue the mission! 🚀**

*Prepared by CC#6 on September 9, 2025*