import { ProfileData, SpotlightItem, MediaItem, ShopItem, GalleryItem } from "@/types";

/**
 * This file contains placeholder data that can be used in development mode
 * or as initial content for new user profiles
 */

// Placeholder profile data
export const placeholderProfile = {
  id: "placeholder-profile-001",
  name: "FluFFy Toy CoLLecTive",
  title: "House Party Fluffy Crew",
  bio: "All this stuff is just placeholder content. This is now YOUR page to customize. **** But for fun, here's the story: Fluffy Toy Collective is a collective of fluffy frens that make music and pineapple art. Let them ruin your reputation with your neighbors as they bring noise and exploding snacks to your house. Then call your lawyer :))) ****",
  image: "/placeholders/profile/profile-image.jpeg", // Using existing placeholder image
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com/fluffytoys" },
    { platform: "youtube", url: "https://youtube.com/@fluffycrew" }
  ],
  sectionVisibility: {
    spotlight: true,
    media: true,
    shop: true,
    gallery: true,
    sticker: true
  },
  sectionTitles: {
    spotlight: "Spotlight",
    media: "Media",
    shop: "Shop",
    gallery: "Gallery",
    sticker: "Sticker"
  },
  sticker: {
    id: "daisy-blue",
    visible: true
  },
  walletAddress: "SP2J6ZY4...KNRV9EJ7",
  showWalletAddress: true,
  btcAddress: "1AKHyiMr...vAAZMXsP",
  showBtcAddress: true
} as ProfileData;

// Placeholder spotlight items
export const placeholderSpotlightItems: SpotlightItem[] = [
  {
    id: "spotlight-item-001",
    title: "The Band",
    description: "Our fluffy musical collective creating beats and melodies that make neighbors question their life choices!",
    image: "/placeholders/spotlight/spotlight-item-1.jpeg",
    link: "https://fluffyparty.com/the-band"
  },
  {
    id: "spotlight-item-002",
    title: "The Selecta",
    description: "DJ sets that blend fluffy vibes with pineapple-powered energy. Warning: may cause spontaneous dancing.",
    image: "/placeholders/spotlight/spotlight-item-2.jpeg",
    link: "https://fluffyparty.com/the-selecta"
  },
  {
    id: "spotlight-item-003",
    title: "The Art Show",
    description: "Pineapple art installations and fluffy masterpieces that definitely won't explode in your living room... probably.",
    image: "/placeholders/spotlight/spotlight-item-3.jpeg",
    link: "https://fluffyparty.com/the-art-show"
  }
];

// Placeholder media items
export const placeholderMediaItems: MediaItem[] = [
  {
    id: "media-item-001",
    type: "youtube",
    rawUrl: "https://youtu.be/coh2TB6B2EA",
    embedUrl: "https://www.youtube.com/embed/coh2TB6B2EA"
  },
  {
    id: "media-item-002",
    type: "mixcloud",
    rawUrl: "https://www.mixcloud.com/tamio-yamashita/tamio-in-the-world-reconstructing-earth-7gtamio-yamashita-japrican-sounds/",
    embedUrl: "https://www.mixcloud.com/widget/iframe/?hide_cover=1&feed=%2Ftamio-yamashita%2Ftamio-in-the-world-reconstructing-earth-7gtamio-yamashita-japrican-sounds%2F"
  }
];

// Placeholder shop items
// Store Card - Special shop item with reserved ID
export const placeholderStoreCard: ShopItem = {
  id: "store-card",  // Reserved ID for the store card
  title: "My Creator Store",
  description: "Browse exclusive tracks and loops from the Fluffy Toy Collective",
  image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop", // Music/studio themed image
  link: "/store" // This will be dynamically set to /store/{walletAddress}
};

export const placeholderShopItems: ShopItem[] = [
  {
    id: "shop-item-001",
    title: "Blue's Rare Vinyl",
    description: "Limited edition vinyl records from our fluffy DJ Blue. Each one guaranteed to make your turntable purr with joy!",
    image: "/placeholders/shop/product-1.jpeg",
    link: "https://fluffyparty.com/shop/blues-vinyl"
  },
  {
    id: "shop-item-002",
    title: "Collectible stickers",
    description: "Official Fluffy Toy Collective sticker pack! Perfect for decorating your laptop, fridge, or lawyer's office.",
    image: "/placeholders/shop/product-2.png",
    link: "https://fluffyparty.com/shop/stickers"
  },
  {
    id: "shop-item-003",
    title: "The Remixes",
    description: "CHICK-A-FLUFF UKULELE BANGERS - Exclusive remix album that'll have you questioning your music taste in the best way!",
    image: "/placeholders/shop/product-3.jpg",
    link: "https://fluffyparty.com/shop/remixes"
  }
];

// Placeholder gallery items
export const placeholderGalleryItems: GalleryItem[] = [
  {
    id: "gallery-item-001",
    image: "/placeholders/gallery/gallery-item-1.gif",
    createdAt: new Date(2023, 5, 15).toISOString()
  },
  {
    id: "gallery-item-002",
    image: "/placeholders/gallery/gallery-item-2.gif",
    createdAt: new Date(2023, 6, 20).toISOString()
  },
  {
    id: "gallery-item-003",
    image: "/placeholders/gallery/gallery-item-3.gif",
    createdAt: new Date(2023, 7, 10).toISOString()
  }
];

// Function to get all placeholder data in one object
export function getPlaceholderData() {
  return {
    profile: placeholderProfile,
    spotlightItems: placeholderSpotlightItems,
    mediaItems: placeholderMediaItems,
    shopItems: placeholderShopItems,
    galleryItems: placeholderGalleryItems
  };
}