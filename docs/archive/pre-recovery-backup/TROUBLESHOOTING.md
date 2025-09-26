# Troubleshooting Guide
*Quick solutions for common issues*

## 🚨 **CURRENT CRITICAL ISSUE (December 2024)**

### **Database Column Alignment Required**
```
Error: 400 Bad Request - Database column mismatch
Root Cause: Code expects database columns that don't exist in actual schema
```

**Immediate Action Required:**
1. **Run schema verification**: `scripts/check-database-schema.sql`
2. **Compare expected vs actual columns** in database
3. **Update code** to match actual database structure
4. **Test uploads** once columns are aligned

**This is the PRIMARY BLOCKER** for upload functionality. All other troubleshooting is secondary until this is resolved.

---

## 🚨 Critical Errors

### localStorage Quota Exceeded
```
Error saving spotlight to storage: QuotaExceededError: Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.
```

**Immediate Fix:**
1. Open browser DevTools → Application → Storage → Local Storage
2. Clear all entries or use the storage monitor: `http://localhost:3010/storage-monitor.html`
3. Refresh the page

**Root Cause:** Large base64 images exceeding localStorage 5-10MB limit

**Permanent Solution:** Image compression system is implemented - ensure you're on the latest branch

### React Hydration Errors
```
Error: Cannot read properties of undefined (reading 'spotlight')
Warning: Text content did not match. Server: "" Client: "actual content"
```

**Immediate Fix:**
1. Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+F5)
2. Clear localStorage and refresh

**Root Cause:** Server/client state mismatch

**Permanent Solution:** Use placeholder data for SSR, load localStorage in useEffect

### Module Import Errors
```
Module not found: Can't resolve '@/lib/supabase-admin'
Attempted import error: 'STORAGE_KEYS' is not exported from '@/lib/storage'
```

**Immediate Fix:**
1. Check import paths are correct
2. Verify exports in target files
3. Restart dev server: `pkill -f "next dev" && npm run dev`

**Common Fixes:**
- `@/lib/storage` → `@/types` for STORAGE_KEYS
- Remove unused imports
- Check file exists at specified path

## 🔧 Development Issues

### Server Won't Start (Port in Use)
```
Error: listen EADDRINUSE: address already in use :::3010
```

**Fix:**
```bash
pkill -f "next dev"
npm run dev
```

### Build Cache Issues
```
[webpack.cache.PackFileCacheStrategy] Caching failed for pack
```

**Fix:**
```bash
rm -rf .next
npm run dev
```

### Environment Variables Not Loading
```
Error: supabaseUrl is required
```

**Fix:**
1. Check `.env.local` exists in project root
2. Verify environment variables are set
3. Restart dev server to reload env

### Image 404 Errors
```
The requested resource isn't a valid image for /placeholder-images/profile-image.jpg
```

**Root Cause:** Old placeholder paths in localStorage or database

**Fix:**
1. Clear localStorage
2. Use correct paths: `/placeholders/` not `/placeholder-images/`
3. Reset profile data if needed

## 🎯 Component-Specific Issues

### Spotlight Items Not Persisting
**Symptoms:** Changes save initially but revert on refresh

**Debug Steps:**
1. Check browser console for quota errors
2. Verify localStorage has data: `localStorage.getItem('spotlight')`
3. Check network tab for Supabase sync errors

**Solutions:**
- Clear localStorage if corrupted
- Ensure images are compressed before saving
- Check Supabase connection status

### Gallery Card Index Error
```
ReferenceError: index is not defined at GalleryCard
```

**Fix:** Add index prop to GalleryCard component usage

### Profile Image Upload Failures
**Symptoms:** Upload appears to work but image doesn't persist

**Debug Steps:**
1. Check file size (should be compressed)
2. Verify Supabase storage configuration
3. Check network requests for upload errors

## 🛠️ Debug Tools & Commands

### Storage Monitor
Visit: `http://localhost:3010/storage-monitor.html`

Features:
- Real-time localStorage usage
- Compression testing
- Storage cleanup
- Environment validation

### Useful Console Commands
```javascript
// Check localStorage usage
Object.keys(localStorage).map(key => ({
  key,
  size: localStorage[key].length
}))

// Clear specific storage keys
localStorage.removeItem('spotlight')
localStorage.removeItem('profile')

// Test image compression
// (Use storage monitor for full testing)
```

### Git Commands for Recovery
```bash
# Reset to last working state
git status
git stash  # if you have uncommitted changes
git reset --hard HEAD

# Switch to main branch if current branch is broken
git checkout main
git pull origin main

# Create new branch from main
git checkout -b fix-branch-name
```

## 🔍 Debugging Workflow

### 1. Identify the Error Category
- **Build/Compilation**: Module errors, syntax errors
- **Runtime**: Component crashes, state issues
- **Storage**: localStorage quota, data persistence
- **Network**: Supabase connection, API errors

### 2. Check Common Locations
- Browser console for errors
- Network tab for failed requests
- Application tab for localStorage data
- Terminal for build errors

### 3. Apply Progressive Fixes
1. **Soft fixes**: Refresh, clear storage
2. **Medium fixes**: Restart server, clear cache
3. **Hard fixes**: Reset git state, rebuild from scratch

### 4. Verify the Fix
- Test the specific functionality that was broken
- Check for related issues
- Verify no new errors introduced

## 📋 Preventive Measures

### Before Making Changes
1. Commit current working state
2. Test core functionality
3. Note current localStorage state

### During Development
1. Monitor console for warnings
2. Test with various image sizes
3. Check both localStorage and Supabase sync

### After Changes
1. Test full user flow
2. Verify data persistence across refreshes
3. Check for hydration errors on first load

## 🆘 Emergency Recovery

### If App is Completely Broken
1. **Save any important uncommitted work**
2. **Reset to last known good state:**
   ```bash
   git stash
   git reset --hard HEAD~1  # Go back one commit
   npm run dev
   ```
3. **If that doesn't work, reset to main:**
   ```bash
   git checkout main
   git pull origin main
   npm run dev
   ```

### If Data is Corrupted
1. **Clear all storage:**
   ```javascript
   localStorage.clear()
   // Or use storage monitor cleanup
   ```
2. **Reset to placeholder data:**
   - Refresh the page
   - Placeholder data should load automatically

### If Build is Failing
1. **Clean everything:**
   ```bash
   rm -rf .next
   rm -rf node_modules
   npm install
   npm run dev
   ```

## 📞 Getting Help

### Information to Gather
- Current branch name
- Exact error message
- Steps to reproduce
- Browser and OS version
- Recent changes made

### Debug Information Commands
```bash
# System info
node --version
npm --version
git branch
git status

# Project info
cat package.json | grep version
ls -la .env*
```

---

*Keep this guide updated as new issues are discovered and resolved.* 