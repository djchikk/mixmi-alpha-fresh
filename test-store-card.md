# Store Card Implementation Test Checklist

## Implementation Complete ✅

### What was implemented:
1. **Store Card Data Management**
   - Added `storeCard` and `storeCardVisible` to ProfileContext
   - Store card is treated as a special ShopItem with ID 'store-card'
   - Added `updateStoreCard()` and `toggleStoreCardVisibility()` methods

2. **StoreCard Component Updates**
   - Now uses dynamic data from context (title, description, image)
   - Supports custom background images with proper overlay for text readability
   - Hide button replaces delete button (eye icon with slash)
   - Falls back to default styling when no custom image

3. **ShopItemModal Enhancements**
   - Detects when editing store card (id === 'store-card')
   - Shows "Edit Store Card" title when editing store
   - Hides "Purchase Link" field for store card (always goes to /store/{wallet})
   - Shows "Save Store Card" button text

4. **ShopSection Logic**
   - When store card visible: Shows store card + 2 shop items (max 3 total)
   - When store card hidden: Shows 3 shop items
   - Edit button opens ShopItemModal with store card data
   - Hide button toggles visibility

### How to Test:

1. **View Store Card**
   - Navigate to profile page
   - Store card should appear in first position of Shop section
   - Shows placeholder data initially

2. **Edit Store Card**
   - Click edit button (pencil icon) on store card
   - Modal should open with title "Edit Store Card"
   - Can edit: Title, Description, Image
   - No purchase link field shown
   - Save button says "Save Store Card"

3. **Hide/Show Store Card**
   - Click hide button (eye with slash icon)
   - Store card should disappear
   - Shop items should expand to fill 3 positions
   - Can restore via section settings (future feature)

4. **Custom Image**
   - Upload custom image for store card
   - Image becomes background with dark overlay
   - Text remains readable over image

### Default Values:
- Title: "My Creator Store"
- Description: "Browse exclusive tracks and loops from the Fluffy Toy Collective"
- Image: Music studio theme from Unsplash
- Link: Always /store/{walletAddress} (not editable)

### Storage Keys:
- `store_card` - Stores the ShopItem data
- `store_card_visible` - Boolean for visibility state

## Notes:
- Store card link is always `/store/{walletAddress}` regardless of edits
- Track count still shows from database (ip_tracks table)
- Visibility state persists in localStorage
- Works with existing PowerUserStorage system for image optimization