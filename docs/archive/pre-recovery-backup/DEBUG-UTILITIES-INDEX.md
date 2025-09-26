# 🛠️ Debug Utilities Index - Mixmi Profile

## Quick Access
All utilities accessible at: `http://localhost:3010/[filename].html`

## 🔍 Storage & Persistence Debugging

### **storage-monitor.html** - The Ultimate Storage Inspector
- **Purpose**: Real-time localStorage monitoring
- **Features**: 
  - Live quota usage tracking
  - Item-by-item inspection
  - Size calculations and warnings
  - Clear specific items or entire storage
- **When to Use**: First stop for any storage issues

### **debug-shop-storage.html** - Shop-Specific Debugging  
- **Purpose**: Focused shop item debugging
- **Features**:
  - Shop items save/load testing
  - Image size tracking
  - localStorage vs React state comparison
  - Detailed save success/failure logging
- **When to Use**: Shop items not persisting or reverting

### **nuclear-clear.html** - Complete Reset Utility
- **Purpose**: Nuclear option for corrupted states
- **Features**:
  - Clear ALL localStorage
  - Clear Supabase data 
  - Clear browser cache
  - Reset to fresh state
- **When to Use**: Everything is broken, start fresh

### **check-storage.html** - Quick Status Check
- **Purpose**: Fast storage overview
- **Features**:
  - Storage quota status
  - Key item counts
  - Quick health check
- **When to Use**: Quick debugging, daily monitoring

## 🖼️ Image & Path Debugging

### **debug-paths.html** - Image Path Validator
- **Purpose**: Test placeholder image paths
- **Features**:
  - Test `/placeholders/` vs `/placeholder-images/` paths
  - Check image availability
  - Path resolution testing
- **When to Use**: Images not loading, 404 errors

### **simple-debug.html** - Basic Image Testing
- **Purpose**: Simple image loading tests
- **Features**:
  - Basic image load validation
  - Simple path testing
- **When to Use**: Quick image debugging

### **load-placeholders.html** - Placeholder System Test
- **Purpose**: Validate placeholder data loading
- **Features**:
  - Test placeholder data structure
  - Verify data consistency
- **When to Use**: Placeholder data issues

## 🚨 Common Debug Scenarios

### **Shop Items Reverting to Placeholders**
1. Start with `storage-monitor.html` → Check quota usage
2. Use `debug-shop-storage.html` → Test save/load cycle
3. If corrupted: `nuclear-clear.html` → Fresh start

### **Images Not Loading (404 Errors)**
1. Use `debug-paths.html` → Test path availability  
2. Check console for `/placeholder-images/` vs `/placeholders/`
3. Verify image files exist in `public/placeholders/`

### **localStorage Full/Corrupted**
1. `storage-monitor.html` → Check what's taking space
2. Clear specific large items or use `nuclear-clear.html`
3. Test with `check-storage.html` → Verify clean state

### **React Hydration Issues (Empty Boxes)**
1. `simple-debug.html` → Basic functionality test
2. Check browser console for hydration errors
3. Verify localStorage loading in useEffect (not useState)

## 💡 Pro Tips

- **Always start with `storage-monitor.html`** - shows the big picture
- **Use browser dev tools alongside** - console logs are detailed  
- **`nuclear-clear.html` is safe** - placeholder data will reload
- **Check network tab** - see which images are 404ing
- **localStorage can appear to work** but fail silently when full

## 🔮 Future Debug Utilities

Suggested additions for next session:
- **Supabase connection tester**
- **Image compression validator** 
- **Multi-device sync checker**
- **Performance monitor for large profiles** 