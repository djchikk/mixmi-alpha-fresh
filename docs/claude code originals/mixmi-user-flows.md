---
name: mixmi-user-flows
description: Step-by-step user journeys through the mixmi platform including onboarding, upload, remix creation, purchasing, and discovery
---

# mixmi User Flows

Complete step-by-step journeys showing how users interact with the mixmi platform.

---

## Table of Contents

1. [Flow 1: Alpha User Onboarding](#flow-1-alpha-user-onboarding)
2. [Flow 2: Quick Upload (Minimal)](#flow-2-quick-upload-minimal)
3. [Flow 3: Advanced Upload (Full Metadata)](#flow-3-advanced-upload-full-metadata)
4. [Flow 4: Creating a Remix (Planned)](#flow-4-creating-a-remix-planned)
5. [Flow 5: Purchasing Content](#flow-5-purchasing-content)
6. [Flow 6: Discovery via Globe](#flow-6-discovery-via-globe)
7. [Flow 7: Discovery via Search](#flow-7-discovery-via-search)
8. [Flow 8: Browsing Creator Stores](#flow-8-browsing-creator-stores)
9. [Flow 9: Exploring Artist Profiles](#flow-9-exploring-artist-profiles)
10. [Flow 10: Editing Your Profile](#flow-10-editing-your-profile)

---

## Flow 1: Alpha User Onboarding

**Goal:** Authenticate and gain upload access
**Duration:** 1-2 minutes
**Authentication Methods:** Stacks Wallet OR Alpha Invite Code

---

### Path A: Stacks Wallet Authentication (Preferred)

#### Step 1: Navigate to Platform

**URL:** `https://mixmi-alpha.vercel.app/` (or localhost)
**Page:** Globe homepage (`app/page.tsx`)
**State:** User not authenticated

**UI:**
- Header shows "Sign In" button (top-right)
- Globe visible with existing content
- No upload button visible

---

#### Step 2: Click "Sign In"

**Action:** User clicks "Sign In" in header
**Component:** `Header.tsx` → opens `SignInModal.tsx`

**Modal Displays:**
- "Welcome to mixmi Alpha" header
- Two options:
  1. **"Connect Wallet"** button (cyan, primary)
  2. **"Use Alpha Code"** link (secondary, text link below)

---

#### Step 3: Click "Connect Wallet"

**Action:** User clicks "Connect Wallet"
**Library:** `@stacks/connect` (Stacks blockchain wallet integration)

**What Happens:**
```javascript
import { showConnect } from '@stacks/connect';

showConnect({
  appDetails: {
    name: 'mixmi Alpha',
    icon: window.location.origin + '/logo.png'
  },
  onFinish: (data) => {
    // Wallet connection successful
    const walletAddress = data.userSession.loadUserData().profile.stxAddress.mainnet;
    // Store in AuthContext
  },
  onCancel: () => {
    // User closed wallet popup
  }
});
```

**Wallet Popup Appears:**
- Shows available wallets (Hiro, Xverse, Leather, etc.)
- User selects their wallet
- Wallet asks to approve connection
- User signs authentication message

---

#### Step 4: Alpha Whitelist Verification

**Backend Call:**
```javascript
const response = await fetch('/api/auth/alpha-check', {
  method: 'POST',
  body: JSON.stringify({ walletAddress })
});

const { isApproved, alphaCode } = await response.json();
```

**Database Query:**
```sql
SELECT alpha_code, is_active
FROM alpha_users
WHERE wallet_address = 'SP...'
  AND is_active = true;
```

**Two Outcomes:**

**✅ If Approved:**
- `AuthContext` sets `isAuthenticated = true`
- `walletAddress` stored in context
- Modal closes automatically
- Header now shows:
  - "Upload" button appears
  - Wallet address (truncated): "SP1ABC...XYZ"
  - Cart icon

**❌ If Not Approved:**
- Error message: "Wallet not approved for alpha access"
- Option to request access (future)
- User must use alpha code instead

---

### Path B: Alpha Code Authentication (Fallback)

#### Step 1-2: Same as Path A

---

#### Step 3: Click "Use Alpha Code"

**UI Changes:**
- "Connect Wallet" button dims/hides
- Text input appears: "Enter your alpha invite code"
- Placeholder: "mixmi-ABC123"
- "Submit" button

---

#### Step 4: Enter Alpha Code

**User Types:** `mixmi-ABC123`
**Action:** Clicks "Submit"

**Validation (Frontend):**
```javascript
const isAlphaCode = (code) => {
  return /^mixmi-[A-Z0-9]{6}$/.test(code);
};
```

**Backend Conversion:**
```javascript
// User entered: mixmi-ABC123
// Backend resolves to actual wallet

const response = await fetch('/api/auth/resolve-wallet', {
  method: 'POST',
  body: JSON.stringify({ authIdentity: 'mixmi-ABC123' })
});

const { walletAddress } = await response.json();
// Returns: SP1ABC...XYZ
```

**Why This Works:**
- UI never shows "wallet address" (prevents security scanner warnings)
- Backend transparently converts alpha code → wallet
- Blockchain operations use real wallet address
- User-friendly authentication

---

#### Step 5: Authenticated State

**AuthContext State:**
```javascript
{
  isAuthenticated: true,
  walletAddress: 'SP1ABC...',
  alphaCode: 'mixmi-ABC123', // For display
  authMethod: 'alpha_code' // or 'wallet'
}
```

**UI Changes:**
- Modal closes
- Header shows upload button
- User can now upload content

---

### First Upload Incentive

**After Authentication:**
- Toast notification: "You're in! Ready to upload your first track?"
- Welcome page: "Sign In and Upload" button now says "Upload Your First Track"

---

## Flow 2: Quick Upload (Minimal)

**Goal:** Upload a loop or song in ~60 seconds
**Prerequisites:** User authenticated
**Duration:** 1-2 minutes

---

### Step 1: Open Upload Modal

**Triggers:**
- Click "Upload" in header
- Click "Sign In and Upload" on Welcome page (if authenticated)
- Click "+" in own store

**Component:** `IPTrackModal` opens
**Mode:** Quick Upload (default, toggle enabled)

---

### Step 2: Select Content Type

**UI:** 5 large buttons with icons

```
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ 🎵 Song │ 🔁 Loop │📦 Pack │ 💿 EP  │ 🎚️ Mix │
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

**User Clicks:** "🔁 Loop"

**State Change:**
```javascript
setFormData({ ...formData, content_type: 'loop' });
```

**UI Updates:**
- BPM field becomes required (red asterisk)
- Loop category dropdown appears

---

### Step 3: Upload Audio File

**UI:** File picker or drag zone (drag-and-drop for audio not yet implemented)

**User Actions:**
- Clicks "Choose Audio File"
- Selects `trap-beat-140.wav` (8MB)

**File Validation:**
```javascript
// Check format
const validFormats = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/flac'];
if (!validFormats.includes(file.type)) {
  throw new Error('Invalid audio format');
}

// Check size
if (file.size > 10 * 1024 * 1024) {
  throw new Error('File too large (max 10MB)');
}
```

**Auto-Detection Starts:**
```javascript
// BPM detection
setIsDetectingBPM(true);
const detectedBPM = await detectBPM(file);
// Result: 140 BPM

// Duration detection
const duration = await detectDuration(file);
// Result: 32 seconds
```

**UI Updates:**
- Progress bar shows during detection
- "BPM: 140 (auto-detected)" appears
- User MUST verify/override this value

---

### Step 4: Fill Basic Metadata

**Required Fields (Quick Mode):**

```
Title: [Trap Beat 140      ]  *
Artist: [DJ Example        ]  *
BPM: [140                  ]  * (pre-filled, editable)
Loop Category: [▼ Beats    ]  * (dropdown)
Location: [Los Angeles, CA ]  * (autocomplete)
```

**BPM Verification:**
```
⚠️ User clicks BPM field
Modal: "Auto-detected 140 BPM. Is this correct?"
[Yes, 140 is correct] [No, let me change it]

If user changes to 142:
✓ BPM updated to 142 (whole number only)
```

**Location Autocomplete:**
```
User types: "Los"

Suggestions appear:
┌──────────────────────────┐
│ 🏙️ Los Angeles, CA, USA  │
│ 🏙️ Los Alamos, NM, USA   │
│ 🏙️ Louisiana, USA        │
│ 🏔️ Louisiana Nation      │
└──────────────────────────┘

User selects: Los Angeles, CA, USA
```

**Coordinates Stored:**
```javascript
{
  location_lat: 34.0522,
  location_lng: -118.2437,
  primary_location: "Los Angeles, CA, USA"
}
```

---

### Step 5: Cover Image (Optional)

**UI:** File picker for image (optional in Quick mode)

**Two Paths:**

**Path A: Upload Custom Cover**
- User clicks "Choose Cover Image"
- Selects `album-art.jpg` (2MB)
- Crop tool appears (react-easy-crop)
- User adjusts crop (square, 1:1 aspect ratio)
- "Upload Cover" button

**Path B: Skip Cover**
- User leaves blank
- System uses default placeholder
- Can add later via edit

---

### Step 6: Attribution (Auto-Fill)

**UI:**
```
IP Attribution

✓ Use authenticated account

Composition Rights:
  Contributor 1: mixmi-ABC123  100%

Production Rights:
  Contributor 1: mixmi-ABC123  100%
```

**Checkbox Behavior:**
- ✓ Checked by default
- Auto-fills both composition and production with user's wallet
- Both at 100%
- User can uncheck to manually enter different wallets

**What Happens Behind Scenes:**
```javascript
// UI shows: mixmi-ABC123 (alpha code)
// Backend converts before save:
composition_split_1_wallet = 'SP1ABC...' (actual wallet)
composition_split_1_percentage = 100
```

---

### Step 7: Submit

**Button:** "Save Track" (cyan, bottom-right)

**5-Stage Upload Process:**

```
Stage 1: Validating metadata ⏳
  ✓ Title exists
  ✓ Artist exists
  ✓ BPM is whole number
  ✓ Location has coordinates
  ✓ Splits total 100%

Stage 2: Uploading audio ⏳
  [████████░░] 80% - Uploading trap-beat-140.wav
  → Supabase Storage: user-content/{wallet}/audio-1729876543210.wav

Stage 3: Uploading cover ⏳
  [██████████] 100% - Uploading cover
  → Supabase Storage: track-covers/{wallet}/cover-1729876543210.png
  (or using default placeholder)

Stage 4: Saving to database ⏳
  INSERT INTO ip_tracks (...)
  VALUES (...)

Stage 5: Complete ✅
  Track saved successfully!
```

**Toast Notification:**
```
✅ Loop saved! Refresh to see it on the globe!
```

---

### Step 8: Post-Upload

**Modal Closes**
**User Redirected:** Back to globe (`/`)

**To See Track:**
- User must refresh page (globe data cached)
- Track appears as purple-bordered node at Los Angeles coordinates

**Store View:**
- Track appears in user's store (`/store/{wallet}`)
- Filterable by "Loops" → "Beats"

---

## Flow 3: Advanced Upload (Full Metadata)

**Goal:** Upload with complete metadata and custom pricing
**Duration:** 3-5 minutes

---

### Steps 1-2: Same as Quick Upload

---

### Step 3: Disable Quick Mode

**UI:** Toggle switch at top of modal
**Action:** User clicks "Quick Upload" to disable it

**UI Changes:**
- Modal transforms into 7-step wizard
- Progress indicator appears:
  ```
  1. Content Type → 2. Audio → 3. Metadata → 4. Cover → 5. Attribution → 6. Licensing → 7. Review
  ```

---

### Step 4: Audio Upload (Wizard Step 2)

**Same as Quick Mode, but shows:**
- Waveform preview (planned)
- Duration display: "32 seconds"
- BPM graph (planned)
- File info: "8.2 MB • WAV • 44.1kHz • 16-bit"

**Next Button:** Advances to Step 3

---

### Step 5: Extended Metadata (Wizard Step 3)

**Additional Fields (Not in Quick Mode):**

```
Basic Info:
  Title: [Trap Beat 140              ] *
  Artist: [DJ Example                ] *
  Version: [Extended Mix             ] (optional)

Description:
  [Dark trap beat with 808s and hi-hats...]
  (500 characters, optional)

Tell Us More:
  [Created in Ableton Live using Roland 808...]
  (1000 characters, optional)

Tags:
  [trap, 808, dark, instrumental     ]
  (comma-separated, optional)

Musical Metadata:
  BPM: [140   ] *
  Key: [▼ D minor] (optional)
  Loop Category: [▼ Beats] *

Professional:
  ISRC: [US-XYZ-24-12345] (optional)
```

**Tag Auto-Suggest:**
```
User types: "tra"

Suggestions from existing tags:
┌──────────────┐
│ trap         │
│ trance       │
│ traditional  │
└──────────────┘
```

---

### Step 6: Cover Upload (Wizard Step 4)

**Component:** `TrackCoverUploader`

**Features:**
- Drag-and-drop or file picker
- Image preview
- Crop tool (react-easy-crop)
  - Zoom slider
  - Rotate buttons
  - Aspect ratio locked to 1:1 (square)
- Upload progress: `[████████░░] 85%`

**Result:** Clean URL stored
```
https://apvdneaduthfbieywwjv.supabase.co/storage/v1/object/public/track-covers/SP1ABC.../cover-1729876543210.png
```

---

### Step 7: Attribution Splits (Wizard Step 5)

**More Complex Example:**

```
Composition Rights (Must total 100%)

✓ Use authenticated account

Contributor 1:
  Wallet: SP1ABC... (auto-filled)  [100%] ←────┐
                                                │ Real-time
Contributor 2: [+ Add Collaborator]            │ total shown
  Wallet: [                    ]  [  0%]        │
                                                │
Contributor 3: [+ Add Collaborator]            │
  Wallet: [                    ]  [  0%]        │
                                                │
Total: 100% ✓ ──────────────────────────────────┘

Production Rights (Separate 100% pie)
  (same structure)
```

**Adding Collaborator:**
```
User clicks [+ Add Collaborator]

Contributor 2 fields appear:
  Wallet: [SP2DEF...           ]
  Percentage: [▓▓▓▓▓░░░░░] 50%

Contributor 1 auto-adjusts:
  Percentage: [▓▓▓▓▓░░░░░] 50%

Total: 100% ✓
```

**Preset System:**
```
[💾 Save as Preset]  [📂 Load Preset ▼]

User clicks Load Preset:
┌─────────────────────────┐
│ My Band (3 composers)   │
│ Producer Team (2 prods) │
│ Solo Project (1-1 split)│
└─────────────────────────┘

Selecting "My Band" auto-fills:
  Contributor 1: 34%
  Contributor 2: 33%
  Contributor 3: 33%
```

---

### Step 8: Licensing & Pricing (Wizard Step 6)

**Component:** `SimplifiedLicensingStep`

**UI:**

```
Remix Licensing (For Loops Only)

✓ Allow others to use this loop in remixes

Remix Price: [1.0] STX per use
  ○ 0 STX (Free remixing)
  ● 1 STX (Default)
  ○ Custom: [____] STX

────────────────────────────

Download Licensing

☐ Allow downloads

Download Price: [____] STX
  (Only shown if "Allow downloads" checked)

────────────────────────────

Advanced Options (Planned)

☐ Open to collaboration
  Contact: [email@example.com]

────────────────────────────

Terms

☐ I agree to mixmi Terms of Service *
  [View Terms]
```

**Validation:**
- Cannot submit if Terms not accepted
- Download price required if downloads enabled
- Remix price defaults to 1.0 STX

---

### Step 9: Review (Wizard Step 7)

**Summary Display:**

```
REVIEW YOUR TRACK

Content Type: Loop (Beats)
Title: Trap Beat 140
Artist: DJ Example
BPM: 140
Location: Los Angeles, CA

Cover: [🖼️ Preview]

Pricing:
  Remix: 1.0 STX
  Download: Not available

IP Attribution:
  Composition: DJ Example (100%)
  Production: DJ Example (100%)

[← Back]  [Submit Track →]
```

**Edit Buttons:**
- Each section has "Edit" icon
- Clicking jumps back to that step
- All data preserved

---

### Step 10: Submit (Same 5-Stage Process)

After submission: Same as Quick Upload

---

## Flow 4: Creating a Remix (Planned)

**Status:** ⚠️ UI exists but recording not implemented
**Goal:** Mix 2 loops, pay licensing fee, save as Gen 1 remix

---

### Step 1: Load Loops into Mixer

**Page:** `/mixer`
**Action:** User drags 2 loops from Crate to mixer decks

**Deck A:**
- Loop: "Trap Beat 140" by DJ Example
- BPM: 140
- Price: 1 STX (remix license)

**Deck B:**
- Loop: "808 Bass Line" by Producer Pro
- BPM: 140
- Price: 1 STX (remix license)

**Total Cost:** 2 STX upfront licensing

---

### Step 2: Mix in Mixer

**User Actions:**
- Adjust crossfader
- Apply FX (reverb, delay, EQ)
- Set loop lengths (8 bars each)
- Sync BPM
- Practice mix

**Duration:** User mixes for 1-2 minutes

---

### Step 3: Click "Record" (Planned)

**Button:** Red "⏺ Record" button in mixer

**Modal Appears:**
```
START RECORDING

You're about to record a remix of:
  • Trap Beat 140 (DJ Example)
  • 808 Bass Line (Producer Pro)

Licensing Fee: 2 STX
  (1 STX per loop)

This payment goes directly to the loop creators.

[Cancel]  [Pay & Record →]
```

---

### Step 4: Pay Licensing Fee

**User Clicks:** "Pay & Record"

**Wallet Popup:**
```
Stacks Wallet - Confirm Transaction

Contract: music-payment-splitter-v3
Function: split-track-payment
Amount: 2.0 STX

Recipients:
  DJ Example (composition): 0.5 STX
  DJ Example (production): 0.5 STX
  Producer Pro (composition): 0.5 STX
  Producer Pro (production): 0.5 STX

Network Fee: ~0.001 STX

[Cancel]  [Confirm]
```

**User Confirms**

---

### Step 5: Recording Session

**UI Changes:**
- Record button changes to "⏹ Stop Recording"
- Bar counter starts: "Recording... 4 bars"
- Waveform shows recording in progress
- User continues mixing

**After 32 Bars (or user clicks Stop):**
- Recording stops
- Audio processing begins
- Preview available

---

### Step 6: Preview & Save

**Modal:**
```
PREVIEW YOUR REMIX

Duration: 2:08
Bars Recorded: 32

[▶ Play Preview]  [🔄 Re-record]  [💾 Save Remix]
```

**User Clicks:** "Save Remix"

---

### Step 7: Remix Metadata

**Auto-Filled:**
```
Title: Trap Beat 140 x 808 Bass Line Remix
Artist: [Your Name]
Content Type: Mix (auto-set)
BPM: 140 (inherited)
Location: [Choose location]

Source Loops: (auto-detected)
  • Trap Beat 140
  • 808 Bass Line

IP Attribution: (auto-calculated)
  Composition:
    DJ Example: 50%
    Producer Pro: 50%

  Production:
    DJ Example: 50%
    Producer Pro: 50%

Remixer Commission: 20% on sales
  (You are NOT an IP holder, you're a distributor)

Pricing:
  Remix Price: 1.0 STX (if someone wants to remix THIS)
  Download Price: 2.0 STX (sum of parent loop download prices, if both allowed)
```

---

### Step 8: Remix Saved

**Database Record:**
```sql
INSERT INTO ip_tracks (
  content_type = 'mix',
  remix_depth = 1,
  source_track_ids = ['loop-a-uuid', 'loop-b-uuid'],
  composition_split_1_wallet = 'SP_DJ_Example',
  composition_split_1_percentage = 50,
  composition_split_2_wallet = 'SP_Producer_Pro',
  composition_split_2_percentage = 50,
  -- Same for production
  primary_uploader_wallet = 'SP_Your_Wallet',
  remix_price_stx = 1.0,
  download_price_stx = 2.0
  -- ...
)
```

**Result:**
- Remix appears on globe
- Remix appears in your store
- Remix shows lineage (links to parent loops)

---

### Step 9: When Someone Buys Your Remix (Planned)

**Customer pays 2 STX for download:**

```
2 STX →
  You (remixer commission): 20% = 0.4 STX

  Loop creators (IP revenue): 80% = 1.6 STX
    DJ Example (25% of total): 0.4 STX
    Producer Pro (25% of total): 0.4 STX
    DJ Example (25% of total): 0.4 STX
    Producer Pro (25% of total): 0.4 STX

Total: 2.0 STX ✓
```

**Status:** ❌ Not yet implemented (20% commission flow)

---

## Flow 5: Purchasing Content

**Goal:** Buy and download a track using STX
**Duration:** 2-3 minutes

---

### Step 1: Browse and Add to Cart

**Context:** User on globe, search, or store page

**User Actions:**
- Hovers over track card
- Clicks shopping cart icon 🛒

**State Change:**
```javascript
// CartContext
addToCart({
  id: 'track-uuid',
  title: 'Trap Beat 140',
  artist: 'DJ Example',
  price_stx: '2.5', // Uses download_price_stx
  primary_uploader_wallet: 'SP1ABC...'
});
```

**UI Feedback:**
- Cart icon in header increments: (1)
- Toast: "Added to cart"

---

### Step 2: Add More Tracks (Optional)

**User Continues Shopping:**
- Adds "808 Bass Line" (2.0 STX)
- Adds "Vocal Chops Pack" (3.5 STX)

**Cart Now:**
```
Cart (3 items)
Total: 8.0 STX
```

---

### Step 3: Open Cart

**Action:** User clicks cart icon in header

**Dropdown Appears:**
```
┌────────────────────────────┐
│ CART (3)                   │
├────────────────────────────┤
│ Trap Beat 140         2.5₿ │
│ by DJ Example          [×] │
├────────────────────────────┤
│ 808 Bass Line         2.0₿ │
│ by Producer Pro        [×] │
├────────────────────────────┤
│ Vocal Chops Pack      3.5₿ │
│ by Vocalist            [×] │
├────────────────────────────┤
│ Total: 8.0 STX             │
│                            │
│ [Clear Cart]               │
│ [Purchase All →]           │
└────────────────────────────┘
```

---

### Step 4: Click "Purchase All"

**Validation:**
```javascript
if (!isAuthenticated) {
  error: "Please connect your wallet first"
  return;
}

if (cart.length === 0) {
  // Cart empty, no action
  return;
}
```

**Loading State:**
- Button changes: "Calculating splits..."
- Modal opens: "Payment Processing"

---

### Step 5: Backend Calculates Splits

**For Each Track:**
```javascript
const track1Splits = await fetch('/api/calculate-payment-splits?trackId=track-uuid-1');
const track2Splits = await fetch('/api/calculate-payment-splits?trackId=track-uuid-2');
const track3Splits = await fetch('/api/calculate-payment-splits?trackId=track-uuid-3');
```

**Response Example (Track 1):**
```json
{
  "compositionSplits": [
    {"wallet": "SP1ABC...", "percentage": 100}
  ],
  "productionSplits": [
    {"wallet": "SP1ABC...", "percentage": 100}
  ]
}
```

---

### Step 6: Aggregate Payments

**Function:** `aggregateCartPayments(tracksWithSplits)`

**Logic:**
```javascript
// Track 1: 2.5 STX → DJ Example (100% comp, 100% prod)
// Track 2: 2.0 STX → Producer Pro (100% comp, 100% prod)
// Track 3: 3.5 STX → Vocalist (100% comp, 100% prod)

// Total: 8.0 STX
// Aggregated distribution:
{
  totalPriceMicroSTX: 8000000,
  compositionSplits: [
    {wallet: "SP_DJ_Example", percentage: 31.25},      // 2.5/8 = 31.25%
    {wallet: "SP_Producer_Pro", percentage: 25},       // 2.0/8 = 25%
    {wallet: "SP_Vocalist", percentage: 43.75}         // 3.5/8 = 43.75%
  ],
  productionSplits: [
    // Same as composition in this case
  ]
}
```

---

### Step 7: Smart Contract Call

**Wallet Popup:**
```
Stacks Wallet - Confirm Transaction

Contract: music-payment-splitter-v3
Function: split-track-payment

Total Amount: 8.0 STX

Payment Distribution:
  Composition (4.0 STX):
    DJ Example: 1.25 STX
    Producer Pro: 1.0 STX
    Vocalist: 1.75 STX

  Production (4.0 STX):
    DJ Example: 1.25 STX
    Producer Pro: 1.0 STX
    Vocalist: 1.75 STX

Network Fee: ~0.002 STX

[Cancel]  [Confirm]
```

---

### Step 8: User Confirms

**Action:** User clicks "Confirm" in wallet

**What Happens:**
1. Transaction broadcast to Stacks blockchain
2. Contract receives 8.0 STX (escrow)
3. Contract distributes to all 6 recipients (3 comp + 3 prod)
4. Transaction mined in block (~10 minutes)

**Immediate Feedback:**
```
Transaction Submitted! ✓

Transaction ID: 0xabc123...

Status: Pending confirmation
Estimated time: ~10 minutes

Your cart has been cleared.
Downloads will be available once confirmed.
```

---

### Step 9: Post-Purchase (Planned)

**Once Confirmed:**
- Download links appear (not yet implemented)
- Tracks added to user's vault (not yet implemented)
- On-chain certificate generated (planned)

**Current Reality:**
- ✅ Payment works perfectly
- ❌ Download delivery not implemented
- ❌ Vault/library system not implemented

---

## Flow 6: Discovery via Globe

**Goal:** Find and preview music geographically
**Duration:** Continuous browsing

---

### Step 1: Land on Globe

**URL:** `/`
**Component:** `app/page.tsx`

**UI:**
- 3D spinning Earth
- Content nodes as glowing pins
- Location clustering (200-mile radius)
- Search bar at top
- Widgets (mixer, playlist, radio) if enabled

---

### Step 2: Rotate Globe

**User Actions:**
- Click and drag to rotate
- Scroll to zoom in/out
- Click continent to navigate

**Cluster Behavior:**
```
Zoomed Out:
  Los Angeles cluster: 12 tracks

Zoom In:
  Cluster expands showing individual nodes:
    - Trap Beat 140 (purple glow = loop)
    - Sunset Vibes (gold glow = song)
    - LA Beat Pack (thick purple = loop pack)
```

---

### Step 3: Hover Over Node

**Action:** Mouse over track node

**UI Changes:**
- Node glows brighter
- Node scales up (1.2x)
- Track info tooltip appears:
  ```
  ┌─────────────────────┐
  │ Trap Beat 140       │
  │ by DJ Example       │
  │ 140 BPM • Beats     │
  │ 1.0₿ remix          │
  └─────────────────────┘
  ```

---

### Step 4: Click Node

**Action:** User clicks node

**State Change:**
```javascript
setSelectedNode(trackNode);
```

**UI Changes:**
- `GlobeTrackCard` appears (floating)
- Card shows:
  - Cover image
  - Title, artist
  - BPM, price
  - Tags
  - Play button
  - Add to cart button
  - Info icon

**Card Position:**
- Right side of screen
- Semi-transparent background
- Above globe but below header

---

### Step 5: Play Preview

**Action:** User clicks ▶ play button on card

**Audio Playback:**
```javascript
const audio = new Audio(track.audio_url);
audio.volume = 0.5;
audio.play();

// Auto-stop after 20 seconds
setTimeout(() => {
  audio.pause();
  setPlayingTrackId(null);
}, 20000);
```

**UI Updates:**
- Play button → Pause button
- Progress indicator (planned)
- 20-second limit

---

### Step 6: Add to Comparison (Optional)

**Feature:** Compare tracks side-by-side

**Action:** User clicks "Compare" button
**Slots:** Left or Right comparison slot

**UI:**
```
┌──────────────┐     ┌──────────────┐
│ Track A      │     │ Track B      │
│ 140 BPM      │     │ 135 BPM      │
│ D minor      │     │ C major      │
│ [▶] [🛒] [i] │     │ [▶] [🛒] [i] │
└──────────────┘     └──────────────┘
```

---

### Step 7: Add to Cart

**Action:** User clicks 🛒 on card

**Same as Flow 5, Step 1**

---

### Step 8: Open Details Modal

**Action:** User clicks ℹ️ info icon

**Modal:** `TrackDetailsModal`

**Content:**
- Full metadata
- Complete IP attribution
- Source loops (if remix)
- Download button (planned)
- Add to Cart button

**For Remix:**
```
IP ATTRIBUTION

From Loop A (Trap Beat 140):
  Composition:
    DJ Example: 100% → 50% of remix
  Production:
    DJ Example: 100% → 50% of remix

From Loop B (808 Bass Line):
  Composition:
    Producer Pro: 100% → 50% of remix
  Production:
    Producer Pro: 100% → 50% of remix

Note: Remixer gets 20% commission on sales,
not IP ownership.
```

---

## Flow 7: Discovery via Search

**Goal:** Find specific tracks by name, artist, or tags
**Duration:** Seconds

---

### Step 1: Open Search

**Available On:** Globe (`/`) and Mixer (`/mixer`) pages
**Component:** `GlobeSearch`

**UI:** Search bar at top with icon 🔍

---

### Step 2: Type Query

**User Types:** "trap"

**Debounced Search (300ms):**
```javascript
const results = globeNodes.filter(node =>
  node.title.toLowerCase().includes('trap') ||
  node.artist.toLowerCase().includes('trap') ||
  node.tags.some(tag => tag.toLowerCase().includes('trap')) ||
  node.primary_location.toLowerCase().includes('trap')
);
```

**Results Appear (Dropdown):**
```
Search: trap

┌────────────────────────────┐
│ Trap Beat 140              │
│ by DJ Example • 140 BPM    │
│ [▶] [🛒]                   │
├────────────────────────────┤
│ Trap Vocal Pack            │
│ by Vocalist • Loop Pack    │
│ [▶] [🛒]                   │
├────────────────────────────┤
│ Dark Trap Mix              │
│ by Remixer • Mix           │
│ [▶] [🛒]                   │
└────────────────────────────┘

Showing 3 results
```

---

### Step 3: Filter Results (Optional)

**UI:** Filter buttons below search

```
Content Type: [All ▼] [Songs] [Loops] [Packs] [EPs]
Category: [All ▼] [Instrumental] [Vocal] [Beats] [Stem]
```

**User Clicks:** "Loops" → "Beats"

**Results Update:**
```
Showing 1 result (Loops • Beats)

Trap Beat 140
by DJ Example • 140 BPM
[▶] [🛒]
```

---

### Step 4: Preview from Search

**Action:** User clicks ▶ in search results

**Same preview behavior as globe**

---

### Step 5: Close Search

**Action:** User clicks X or presses Escape

**Search closes, results cleared**

---

## Flow 8: Browsing Creator Stores

**Goal:** Explore all content from a specific creator
**Duration:** 2-10 minutes

---

### Step 1: Navigate to Store

**Triggers:**
- Click artist name on track card
- Click "Visit Store" on profile
- Direct URL: `/store/djchikk` or `/store/SP1ABC...`

**Component:** `app/store/[walletAddress]/page.tsx`

---

### Step 2: Store Loads

**Username Resolution:**
```javascript
// User visited: /store/djchikk

// Backend resolves username → wallet
const { wallet_address } = await supabase
  .from('user_profiles')
  .select('wallet_address')
  .eq('username', 'djchikk')
  .single();

// Fetch all tracks for this wallet
const tracks = await supabase
  .from('ip_tracks')
  .select('*')
  .eq('primary_uploader_wallet', wallet_address)
  .eq('deleted_at', null)
  .order('created_at', { ascending: false });
```

---

### Step 3: Store UI

**Header:**
```
┌────────────────────────────────────┐
│ [Avatar] DJ Example                │
│          djchikk                   │
│          24 tracks                 │
│          [+ Upload] (if own store) │
└────────────────────────────────────┘
```

**Filters:**
```
Content Type: [All ▼] Songs (5) | Loops (12) | Packs (7)
Category: [All ▼] Instrumental | Vocal | Beats | Stem
```

---

### Step 4: Browse Tracks

**Grid Layout:**
```
┌─────┬─────┬─────┬─────┬─────┬─────┐
│ [1] │ [2] │ [3] │ [4] │ [5] │ [6] │
├─────┼─────┼─────┼─────┼─────┼─────┤
│ [7] │ [8] │ [9] │ [10]│ [11]│ [12]│
├─────┼─────┼─────┼─────┼─────┼─────┤
│ [13]│ [14]│ [15]│ [16]│ [17]│ [18]│
├─────┼─────┼─────┼─────┼─────┼─────┤
│ [19]│ [20]│ [21]│ [22]│ [23]│ [24]│
└─────┴─────┴─────┴─────┴─────┴─────┘

[Load More]  (if > 24 tracks)
```

**Each Card:** 160px × 160px `CompactTrackCardWithFlip`

---

### Step 5: Wave Loading Animation

**Prevents overwhelming UI:**
```javascript
// Cards appear in waves of 6
Wave 1 (cards 1-6): Fade in at 0ms
Wave 2 (cards 7-12): Fade in at 100ms
Wave 3 (cards 13-18): Fade in at 200ms
Wave 4 (cards 19-24): Fade in at 300ms
```

---

### Step 6: Hover & Interact

**Hover on Card:**
- Overlay appears (dark semi-transparent)
- Shows: Title, Artist, BPM, Price
- Buttons: ▶ Play, 🛒 Cart, ℹ️ Info

**Actions:**
- Play preview (20 seconds)
- Add to cart
- Open details modal
- Drag to crate (if visible)

---

### Step 7: Filter by Type

**User Clicks:** "Loops"

**State Change:**
```javascript
setActiveFilter({ type: 'loop' });
```

**UI Updates:**
- Grid refreshes
- Only loop cards shown
- Count updates: "12 loops"

---

### Step 8: Edit Mode (Own Store Only)

**Condition:** `walletAddress === actualWalletAddress`

**UI Changes:**
- "+ Upload" button appears in header
- Each card shows edit controls:
  - ✏️ Edit button
  - 🗑️ Delete button

**Edit Action:**
- Opens IPTrackModal in edit mode
- Pre-fills all fields
- Save updates database

**Delete Action:**
- Soft delete (sets `deleted_at`)
- Card fades out
- Can be restored by admin

---

## Flow 9: Exploring Artist Profiles

**Goal:** Learn about a creator and navigate to their content
**Duration:** 1-2 minutes

---

### Step 1: Navigate to Profile

**Triggers:**
- Click artist name on track card (if no store or profile preferred)
- Direct URL: `/profile/djchikk` or `/profile/SP1ABC...`

**Component:** `app/profile/[walletAddress]/page.tsx`

---

### Step 2: Profile Loads

**Auto-Initialize (If First Visit):**
```javascript
// Check if profile exists
const profile = await UserProfileService.getProfile(wallet);

if (!profile.exists) {
  // Initialize with defaults
  await UserProfileService.initializeProfile(wallet);
}

// Fetch first track for fallbacks
const firstTrack = await supabase
  .from('ip_tracks')
  .select('artist, cover_image_url')
  .eq('primary_uploader_wallet', wallet)
  .order('created_at', { ascending: true })
  .limit(1);

if (!profile.display_name || profile.display_name === 'New User') {
  profile.display_name = firstTrack.artist;
}

if (!profile.avatar_url) {
  profile.avatar_url = firstTrack.cover_image_url;
}
```

---

### Step 3: Profile UI

**Layout:**
```
┌────────────────────────────────────┐
│         [Avatar Image]             │
│         DJ Example                 │
│         Lo-fi beats & chill vibes  │
│         ───────────────            │
│         Bio text here...           │
│                                    │
│  [Instagram] [Twitter] [Website]  │
│                                    │
│  [🏪 Visit Store →]                │
│                                    │
│  [Badge/Sticker]                   │
└────────────────────────────────────┘
```

**Edit Button (Own Profile):**
- ✏️ Edit Profile (top-right)
- Opens edit modal

---

### Step 4: Edit Profile (Own Profile)

**Modal Fields:**
```
Display Name: [DJ Example           ]
Tagline: [Lo-fi beats & chill vibes]
Bio: [Textarea with 500 char limit  ]

Avatar: [Upload new image]

Social Links:
  Instagram: [https://...           ]
  Twitter: [https://...             ]
  Website: [https://...             ]

Sticker: [Daisy Blue ▼]
  ○ Daisy Purple
  ● Daisy Blue
  ○ Fruit Slice
  ○ Custom Upload

[Cancel]  [Save Changes]
```

---

### Step 5: Navigate to Store

**User Clicks:** "Visit Store" button

**Redirects to:** `/store/{wallet or username}`

---

## Success Metrics

**Onboarding:**
- Time to first authentication: < 2 minutes
- Alpha code vs wallet auth split: Track usage

**Upload:**
- Quick vs Advanced mode usage: Track preference
- Completion rate: % who finish upload after starting
- Average time: Quick ~60s, Advanced ~5min

**Discovery:**
- Tracks previewed per session: Average
- Searches per session: Frequency
- Globe vs Search vs Store: Primary discovery method

**Purchase:**
- Cart size: Average items per purchase
- Completion rate: % who complete after adding to cart
- Transaction confirmation time: ~10 minutes average

---

## Common Drop-Off Points

**Onboarding:**
- Not on alpha whitelist (100% drop-off if not approved)
- Wallet connection failure (browser extension issues)

**Upload:**
- BPM confusion (decimal vs whole number)
- Split percentages not totaling 100%
- File size too large (> 10MB)

**Purchase:**
- Insufficient STX balance
- Wallet not connected
- Transaction cancelled in wallet popup

**Discovery:**
- No content in geographic area
- Search returns no results
- Preview audio fails to load

---

## Code Locations

**Authentication:**
- `contexts/AuthContext.tsx` - Auth state
- `components/modals/SignInModal.tsx` - Sign-in UI
- `lib/auth/wallet-mapping.ts` - Alpha code conversion
- `app/api/auth/resolve-wallet/route.ts` - Backend resolver

**Upload:**
- `components/modals/IPTrackModal.tsx` - Main modal
- `hooks/useIPTrackSubmit.ts` - Submit logic
- `hooks/useAudioUpload.ts` - Audio processing
- `hooks/useLocationAutocomplete.ts` - Location search

**Discovery:**
- `app/page.tsx` - Globe page
- `components/globe/GlobeSearch.tsx` - Search
- `app/store/[walletAddress]/page.tsx` - Store page
- `app/profile/[walletAddress]/page.tsx` - Profile page

**Purchase:**
- `contexts/CartContext.tsx` - Cart state & purchase
- `components/layout/Header.tsx` - Cart UI
- `app/api/calculate-payment-splits/route.ts` - Split calculation
- `lib/batch-payment-aggregator.ts` - Payment aggregation

**Profile Editing:**
- `app/profile/[walletAddress]/page.tsx` - Profile page
- `components/profile/ProfileInfo.tsx` - Display component with edit button
- `components/profile/ProfileInfoModal.tsx` - Edit modal
- `components/profile/ProfileImage.tsx` - Avatar upload
- `supabase` - user_profiles table

---

## Flow 10: Editing Your Profile

**Goal:** Customize profile information and appearance
**Duration:** 2-5 minutes
**Prerequisites:** Must be authenticated and viewing own profile

---

### Step 1: Navigate to Your Profile

**Starting Points:**
- Click "My Profile" link in header (when authenticated)
- Navigate to `/profile/{your-wallet-address}` or `/profile/{your-username}`

**Page Load:**
- Profile page displays with your current information
- Auto-initializes if this is first visit (pulls from first uploaded track)
- Edit controls visible because it's your own profile

**UI State:**
```
┌─────────────────────────────────────┐
│  [Avatar]                    [Edit] │ ← Edit button for avatar
│                                     │
│  Your Name                   [Edit] │ ← Edit button for profile info
│  Your Tagline                       │
│  Your bio text here...              │
│                                     │
│  🔗 Social Links                    │
│                                     │
│  [STX: SP1234...5678]              │
└─────────────────────────────────────┘
```

---

### Step 2: Click "Edit" on Profile Info

**Location:** Small edit button (Edit2 icon) in top-right of ProfileInfo section

**Component:** `components/profile/ProfileInfo.tsx` opens `ProfileInfoModal.tsx`

**Modal Opens:**
```
┌──────────────────────────────────────┐
│  Edit Profile Details           [×]  │
├──────────────────────────────────────┤
│                                      │
│  Name                        0/40    │
│  [Your Name___________________]      │
│  Choose any display name             │
│                                      │
│  What You Do                 0/40    │
│  [Your Tagline________________]      │
│  A short description                 │
│                                      │
│  Bio                        0/350    │
│  ┌──────────────────────────┐       │
│  │ Tell us about yourself...│       │
│  │                          │       │
│  └──────────────────────────┘       │
│                                      │
│        [Cancel]  [Save Changes]      │
└──────────────────────────────────────┘
```

---

### Step 3: Edit Profile Fields

**Field 1: Name (Display Name)**
```typescript
field: "name"
type: text input
limit: 40 characters
required: yes
placeholder: "Choose any display name - change it any time"
current_value: profile.display_name || ""

// Character counter updates live
onChange: (e) => {
  if (e.target.value.length <= 40) {
    setFormData({...formData, name: e.target.value});
  }
}
```

**Field 2: What You Do (Tagline)**
```typescript
field: "title"
type: text input
limit: 40 characters
required: no
placeholder: "A short description of who you are or what you do"
current_value: profile.tagline || ""

// Examples: "Producer", "DJ & Sound Designer", "Bedroom Beatmaker"
```

**Field 3: Bio**
```typescript
field: "bio"
type: textarea (3 rows)
limit: 350 characters
required: no
placeholder: "Share a bit about yourself, your work, interests..."
current_value: profile.bio || ""

// Longer form description
```

**Character Limits Enforced:**
```typescript
const CHARACTER_LIMITS = {
  name: 40,
  title: 40,
  bio: 350
};

// Live character count displayed: "23/40"
```

---

### Step 4: Save Profile Changes

**Action:** Click "Save Changes" button

**Validation:**
- Name is required (cannot be empty)
- Character limits enforced client-side
- Other fields optional

**Save Process:**
```typescript
// 1. Update ProfileContext
const updatedProfile = {
  ...formData,
  showWalletAddress: profile.showWalletAddress,  // Preserve
  showBtcAddress: profile.showBtcAddress,        // Preserve
  image: profile.image,                          // Preserve (managed separately)
  socialLinks: profile.socialLinks               // Preserve (managed separately)
};

updateProfile(updatedProfile);

// 2. Persist to Supabase
await supabase
  .from('user_profiles')
  .upsert({
    wallet_address: walletAddress,
    display_name: formData.name,
    tagline: formData.title,
    bio: formData.bio,
    updated_at: new Date().toISOString()
  });

// 3. Close modal
onClose();

// 4. UI updates immediately (optimistic update)
```

**Success State:**
- Modal closes
- Profile page shows updated information
- No page refresh needed

---

### Step 5: Edit Avatar Image

**Location:** Large edit button overlay on avatar (ProfileImage component)

**Trigger:** Click edit icon on avatar

**Avatar Upload Modal Opens:**
```
┌──────────────────────────────────────┐
│  Edit Profile Image             [×]  │
├──────────────────────────────────────┤
│                                      │
│     ┌──────────────────┐            │
│     │                  │            │
│     │  Current Avatar  │            │
│     │                  │            │
│     └──────────────────┘            │
│                                      │
│  Drag & drop image or                │
│  [Choose File]                       │
│                                      │
│  Accepted: PNG, JPG, WebP, GIF       │
│  Max size: 5MB                       │
│  Recommended: Square (500x500px)     │
│                                      │
│        [Cancel]  [Upload Image]      │
└──────────────────────────────────────┘
```

**Upload Process:**
```typescript
// 1. User selects image file
const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?[0];
  if (!file) return;

  // Validate file size
  if (file.size > 5 * 1024 * 1024) {
    alert('File too large (max 5MB)');
    return;
  }

  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    alert('Invalid file type');
    return;
  }

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    setPreview(e.target?.result as string);
  };
  reader.readAsDataURL(file);
};

// 2. Upload to Supabase Storage
const uploadAvatar = async () => {
  const fileName = `avatar-${Date.now()}.${file.name.split('.').pop()}`;
  const filePath = `${walletAddress}/${fileName}`;

  // Upload to user-content bucket
  const { data, error } = await supabase.storage
    .from('user-content')
    .upload(filePath, file);

  if (error) throw error;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('user-content')
    .getPublicUrl(filePath);

  // 3. Update profile with new avatar URL
  await supabase
    .from('user_profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('wallet_address', walletAddress);

  // 4. Update local state
  updateProfile({ ...profile, image: urlData.publicUrl });
};
```

---

### Step 6: Add/Edit Social Links (Future Feature)

**Location:** Social links section below bio

**Current State:**
- Displays existing social links with icons
- Shows "No social links added" if empty on own profile

**Future Modal:**
```
┌──────────────────────────────────────┐
│  Edit Social Links              [×]  │
├──────────────────────────────────────┤
│                                      │
│  Instagram                           │
│  [https://instagram.com/username___] │
│                                      │
│  Twitter                             │
│  [https://twitter.com/username_____] │
│                                      │
│  SoundCloud                          │
│  [https://soundcloud.com/username__] │
│                                      │
│  + Add Another Platform              │
│                                      │
│        [Cancel]  [Save Links]        │
└──────────────────────────────────────┘
```

**Supported Platforms:**
- Instagram, Twitter/X, YouTube
- Spotify, SoundCloud, Mixcloud
- TikTok, Twitch, GitHub

**Data Structure:**
```typescript
interface SocialLink {
  platform: string;  // 'instagram' | 'twitter' | etc.
  url: string;       // Full URL
}

// Stored as JSONB array in user_profiles.social_links
social_links: [
  { platform: 'instagram', url: 'https://instagram.com/user' },
  { platform: 'twitter', url: 'https://twitter.com/user' }
]
```

---

### Step 7: Toggle Wallet Address Visibility

**Location:** Wallet address display section

**Current Behavior:**
- Wallet addresses shown if `show_wallet_address` or `show_btc_address` flags enabled
- Managed separately from main profile edit (WalletSettingsModal)

**Toggle Options:**
```
┌──────────────────────────────────────┐
│  Wallet Visibility              [×]  │
├──────────────────────────────────────┤
│                                      │
│  ☑ Show Stacks Address (STX)        │
│  ☐ Show Bitcoin Address (BTC)       │
│                                      │
│  Note: Visible addresses can be      │
│  copied by visitors for tips/donations│
│                                      │
│        [Cancel]  [Save Settings]     │
└──────────────────────────────────────┘
```

**Database Update:**
```typescript
await supabase
  .from('user_profiles')
  .update({
    show_wallet_address: showSTX,
    show_btc_address: showBTC
  })
  .eq('wallet_address', walletAddress);
```

---

### Profile Auto-Initialization

**Trigger:** User visits their own profile for the first time

**Fallback Data Source:** First uploaded track

**Auto-Fill Logic:**
```typescript
// If user has no profile data yet
if (!profile || !profile.display_name) {
  // Fetch user's first track
  const { data: firstTrack } = await supabase
    .from('ip_tracks')
    .select('artist, title')
    .eq('primary_uploader_wallet', walletAddress)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (firstTrack) {
    // Auto-initialize profile
    await supabase
      .from('user_profiles')
      .insert({
        wallet_address: walletAddress,
        display_name: firstTrack.artist,  // Use artist name from first track
        tagline: null,
        bio: null,
        avatar_url: null,
        created_at: new Date().toISOString()
      });
  }
}
```

**User Experience:**
1. New user uploads first track with artist name "DJ Example"
2. User navigates to "My Profile"
3. Profile auto-creates with display_name = "DJ Example"
4. User can immediately edit to customize

---

## Profile Editing Flow Summary

**Time Investment:**
- Quick edit (name only): 30 seconds
- Full profile (all fields): 2-3 minutes
- With avatar upload: 3-5 minutes

**Update Frequency:**
- Character limits prevent excessive content
- No rate limiting on updates
- Changes reflect immediately (optimistic UI)

**Persistence:**
- All data saved to `user_profiles` table in Supabase
- Avatar images stored in `user-content` bucket
- Changes visible to all users immediately

**Visibility:**
- Profile viewable at `/profile/{wallet or username}`
- Username routing preferred (cleaner URLs)
- Profile linked from store page, track cards, etc.

---
