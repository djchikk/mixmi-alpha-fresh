# 🎵 PROJECT MANAGER SPECS: EP Functionality Implementation

**Project Manager**: Claude Code #2 (CC #2) - Deep system architecture knowledge  
**Developer**: Claude Code #3 (CC #3) - Implementation specialist  
**Date**: September 7, 2025  
**Branch**: `ep-functionality-sept7-2025` *(Ready for development)*

---

## 🎯 **PROJECT OVERVIEW**

### **What We're Building:**
**EP (Extended Play) functionality** - Essentially "song packs" of 2-5 full songs, leveraging our proven loop pack architecture.

### **Why This Makes Sense:**
- 🏗️ **Proven architecture** - Loop pack system works perfectly, just adapt for songs  
- 🎵 **Musical logic** - EPs are common music format (2-5 full songs)
- 📦 **User workflow** - Same upload pattern as loop packs but for complete tracks
- 🎨 **Visual consistency** - Thick borders like loop packs, song colors like singles

---

## 🎨 **VISUAL DESIGN SPECIFICATIONS**

### **Border Design System:**
- **Single Songs**: `#FFE4B5` border (gold/cream) - regular thickness ✅ *(existing)*
- **Single Loops**: Purple border - regular thickness ✅ *(existing)*  
- **Loop Packs**: Purple border - **thick** ✅ *(existing)*
- **EPs**: `#FFE4B5` border - **thick** ← **NEW REQUIREMENT**

### **Visual Hierarchy Logic:**
```
Single content = Regular border
Multi-content = THICK border  

Song color (#FFE4B5) = Full songs  
Purple = Loops/loop content
```

**Result**: EPs get **thick gold borders** - perfect visual identity!

### **Card Display Requirements:**
- **Badge text**: "EP (3 songs)" *(vs "Loop Pack (3 loops)")*
- **Border**: Thick `#FFE4B5` 
- **Hover states**: Same interaction as loop packs
- **Modal display**: Individual song playback like loop pack → individual loops

---

## 🏗️ **TECHNICAL SPECIFICATIONS**

### **Database Schema Addition:**
```typescript
// Add to CONTENT_TYPES in types/index.ts:
export const CONTENT_TYPES = [
  'full_song',
  'loop', 
  'loop_pack',
  'ep'  // ← NEW!
] as const;
```

### **Upload Form Changes:**
**Duplicate Loop Pack form section for EP:**
- **Same multi-file upload** (2-5 files instead of 2-5 loops)
- **Same validation pattern** (file count, size limits)  
- **Different labeling**: "EP Songs" vs "Loop Files"
- **Same metadata**: Title, artist, description, location, etc.
- **Same cover image**: Use TrackCoverUploader for EP artwork

### **File Organization:**
**Leverage existing structure:**
```
Database:
- Master EP record: content_type = 'ep', pack_id = null
- Individual song records: content_type = 'full_song', pack_id = {ep_id}

Storage:
- Audio files: user-content/{wallet}/audio/ep-song-files...  
- Cover art: track-covers/{wallet}/cover-{timestamp}.jpg
```

---

## 📋 **IMPLEMENTATION TASKS FOR CC #3**

### **TASK 1: Database & Types**
```typescript
// File: types/index.ts
// Add 'ep' to CONTENT_TYPES array
// Ensure TypeScript types include EP content type

// Test: Verify no TypeScript errors after addition
```

### **TASK 2: Form UI Updates**  
```typescript
// File: components/modals/IPTrackModal.tsx
// Find the content_type radio buttons
// Add "EP (2-5 songs)" option alongside existing options
// Copy loop pack conditional UI sections for EP

// Requirements:
// - Show multi-file upload when EP is selected
// - Update file validation for song files vs loop files  
// - Change labels: "EP Songs" vs "Loop Files"
// - Maintain all other form functionality
```

### **TASK 3: Card Visual Updates**
```typescript
// File: components/cards/CompactTrackCardWithFlip.tsx
// Find border styling logic for content types
// Add EP border styling:

// Current logic (example):
// border-2 border-purple-500 (loop_pack)
// border-1 border-[#FFE4B5] (full_song)

// Add:
// border-2 border-[#FFE4B5] (ep) ← Thick gold border!
```

### **TASK 4: Search Integration**
```typescript
// File: components/globe/GlobeSearch.tsx  
// Add to FILTER_TYPES array:
{ id: 'ep', label: 'EPs' }

// Add to filtering logic:
if (activeFilters.has('ep') && track.content_type === 'ep') return true;
```

### **TASK 5: Badge Display**
```typescript
// Find badge/label logic in cards
// Add EP badge display:
// "EP (X songs)" format vs "Loop Pack (X loops)"
```

---

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements:**
- ✅ **Upload workflow**: Can upload 2-5 songs as EP
- ✅ **Visual identity**: Thick gold borders distinguish EPs  
- ✅ **Search filtering**: "EPs" filter finds EP content
- ✅ **Globe display**: EPs appear with correct styling
- ✅ **Modal display**: Individual song playback within EP

### **Technical Requirements:**
- ✅ **Database consistency**: Same pack_id architecture as loop packs
- ✅ **Performance maintained**: No impact on 17ms globe loading
- ✅ **Type safety**: No TypeScript errors  
- ✅ **UI consistency**: Follows existing design patterns

---

## 🚀 **PROJECT MANAGER DIRECTIVES FOR CC #3**

### **APPROACH:**
1. **Start with types** - Safest foundation first
2. **Copy loop pack patterns** - Don't reinvent, adapt proven code  
3. **Test incrementally** - Verify each change works before next
4. **Preserve performance** - Don't break our 17ms globe loading!

### **TESTING PLAN:**
1. **Upload test EP** - 3 songs in one upload  
2. **Verify globe display** - Thick gold border appears
3. **Test search filtering** - EP filter finds content  
4. **Test modal playback** - Individual song preview works

### **COMMUNICATION:**
- **CC #3**: Focus on clean implementation following existing patterns  
- **CC #2 (me)**: Available for architecture questions and code review
- **Human**: Final UI/UX approval and testing

---

## 📚 **CONTEXT FOR CC #3**

### **Proven Architecture to Follow:**
- 🎵 **Loop pack system** in IPTrackModal.tsx (lines ~800-900)
- 🎨 **Border styling** in CompactTrackCardWithFlip.tsx  
- 🔍 **Search filtering** in GlobeSearch.tsx
- 📦 **Database structure** using existing pack_id system

### **Performance Context:**
- ⚡ **Maintain 17ms** globe loading (don't add expensive operations!)
- 🖼️ **Use TrackCoverUploader** for EP artwork (proven system)
- 🗺️ **Same location system** (exact coordinates from autocomplete)
- 📊 **Leverage existing queries** (add EP to existing OR conditions)

---

## 🎊 **PROJECT VISION**

**End Result**: Users can upload **"song EPs"** just as easily as loop packs, with:
- 🎨 **Distinctive thick gold borders** (immediate visual recognition)  
- 🔍 **Searchable content** with dedicated EP filter
- 🎵 **Individual song playback** within EP collections  
- ⚡ **Same blazing performance** as our optimized system

**This extends our proven multi-content architecture to serve the complete spectrum of music releases!** 

**🚀 READY TO BRIEF CC #3?** 🎵✨