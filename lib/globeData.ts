import { TrackNode } from '@/components/globe/types';

// Real track data from the Creator Store
const creatorStoreTracks = [
  {
    id: "020fe25a-c29a-4d58-b49d-562618fa58d9",
    title: "Speeeeeeed - Vocal - 01 - 174",
    artist: "Muneeb",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Speeeeeeed_-_Vocal_-_01_-_174_sample_1720387893500.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Speeeeeeed_-_Vocal_-_01_-_174_sample_1720387891209.mp3",
    genre: "vocals"
  },
  {
    id: "0258a80d-32a2-48f6-9563-8608ba4b0126",
    title: "Rock Paper Scissors - vocal - 02",
    artist: "Tootles and Soph",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Rock_Paper_Scissors_-_vocal_-_02_-_131_BPM_sample_1720505380644.jpeg",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Rock_Paper_Scissors_-_vocal_-_02_-_131_BPM_sample_1720505378754.mp3",
    genre: "vocals"
  },
  {
    id: "038fcfcb-8dcc-473b-88cc-953827dae2a3",
    title: "STARLA OnLoop VOX",
    artist: "STARLA",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__STARLA_OnLoop_VOX_Bars4_11_68BPM_sample_1720654868734.jpeg",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_STARLA_OnLoop_VOX_Bars4_11_68BPM_sample_1720654866277.mp3",
    genre: "vocals"
  },
  {
    id: "05142de5-665c-47bf-b76e-a379aa314920",
    title: "Gonna Take Off",
    artist: "Lunar Drive",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Kevin_Locke_-_Gonna_Take_Off_-_Accap_-_Sung_-_125_BPM_sample_1715901713124.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Kevin_Locke_-_Gonna_Take_Off_-_Accap_-_Sung_-_125_BPM_sample_1715901711193.mp3",
    genre: "vocals"
  },
  {
    id: "0994872c-7a1a-4a0c-8e91-7b75f5d0d522",
    title: "Could U be - MUSIC - 80 BPM",
    artist: "CP",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__COuld_U_be_-__MUSIC_-_80_BPM_sample_1720483044666.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_COuld_U_be_-__MUSIC_-_80_BPM_sample_1720483042708.mp3",
    genre: "instrumentals"
  },
  {
    id: "129a0fa9-f3a1-4eae-90cc-60363d9a12dd",
    title: "Take Take Take Take - Grrr",
    artist: "Lunar Drive",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Take_Take_Take_Take_-_Grrr_-_Accap_-_02_-_140_BPM_sample_1716331370161.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Take_Take_Take_Take_-_Grrr_-_Accap_-_02_-_140_BPM_sample_1716331367493.mp3",
    genre: "vocals"
  },
  {
    id: "152767be-ea8a-4c69-a104-1d95d9eacac6",
    title: "Nakala Ngai - Music",
    artist: "Merlin",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Nakala_Ngai_-_Music_-_103_BPM_sample_1720481595504.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Nakala_Ngai_-_Music_-_103_BPM_sample_1720481593260.mp3",
    genre: "instrumentals"
  },
  {
    id: "21207581-b6a3-42ce-8be0-e32c8992766e",
    title: "When I Spit - 01",
    artist: "Rey",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__When_I_Spit_-_Vocal_-_01_-_125_BPM_sample_1716311221925.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_When_I_Spit_-_Vocal_-_01_-_125_BPM_sample_1716311219987.mp3",
    genre: "vocals"
  },
  {
    id: "2dec1525-44e7-4f72-a41d-d580507774d6",
    title: "Baba - CJHP Remix",
    artist: "CJHP",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Baba_-__CJHP_Remix_-_107_BPM_sample_1720318201647.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Baba_-__CJHP_Remix_-_107_BPM_sample_1720318199555.mp3",
    genre: "instrumentals"
  },
  {
    id: "36207376-97ca-45ef-bb43-cf4f08b5c2c8",
    title: "Kalimba - 103 BPM",
    artist: "Merlin",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Kalimba__-_103_BPM_sample_1720580501204.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Kalimba__-_103_BPM_sample_1720580498937.mp3",
    genre: "instrumentals"
  },
  {
    id: "39bd1e53-65d6-4f97-9a82-23d1aa8d3f98",
    title: "Powwow Banger Remix",
    artist: "Lunar Drive",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Powwow_Banger_Remix_-_Vocal_-_Intro_-_172_BPM_sample_1720681049423.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Powwow_Banger_Remix_-_Vocal_-_Intro_-_172_BPM_sample_1720681047415.mp3",
    genre: "vocals"
  },
  {
    id: "3d2d224a-66ba-4a02-a25a-11531207479d",
    title: "Nakala Ngai - Vocal",
    artist: "Judy",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__Nakala_Ngai_-_Vocal_-_103_BPM_sample_1720481344106.png",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_Nakala_Ngai_-_Vocal_-_103_BPM_sample_1720481341683.mp3",
    genre: "vocals"
  },
  {
    id: "458bd7c7-f0a4-4f55-97b1-38b26e3e3581",
    title: "Cosmic Highway",
    artist: "Lunar Drive",
    imageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    genre: "full songs"
  },
  {
    id: "57f05639-ee3a-4d96-bed0-02eee11eed54",
    title: "ChatSection - 02",
    artist: "Blah Poodle",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__2X2_-_DrumsnBass_-_ChatSection_-_02_-_178_sample_1716224402859.gif",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_2X2_-_DrumsnBass_-_ChatSection_-_02_-_178_sample_1716224400693.mp3",
    genre: "beats"
  },
  {
    id: "5ade175b-bff5-4e95-88bc-ad62866e5a1c",
    title: "STARLA OnLoop VOX Bars",
    artist: "STARLA",
    imageUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/images/image__STARLA_OnLoop_VOX_Bars28_35_68BPM_sample_1720655133569.jpeg",
    audioUrl: "https://wjcsrlukwobowipdbray.supabase.co/storage/v1/object/public/sample/audios/audio_STARLA_OnLoop_VOX_Bars28_35_68BPM_sample_1720655131052.mp3",
    genre: "vocals"
  }
];

// Function to generate random coordinates with better distribution
function generateRandomCoordinates(): { lat: number; lng: number } {
  // Use a more realistic distribution that favors populated areas
  const regions = [
    // North America
    { latRange: [25, 50], lngRange: [-130, -70], weight: 3 },
    // Europe
    { latRange: [35, 60], lngRange: [-10, 40], weight: 3 },
    // Asia
    { latRange: [10, 50], lngRange: [60, 140], weight: 3 },
    // South America
    { latRange: [-35, 10], lngRange: [-80, -35], weight: 2 },
    // Africa
    { latRange: [-35, 35], lngRange: [-20, 50], weight: 2 },
    // Australia/Oceania
    { latRange: [-45, -10], lngRange: [110, 180], weight: 1 },
  ];

  // Pick a region based on weights
  const totalWeight = regions.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedRegion = regions[0];

  for (const region of regions) {
    random -= region.weight;
    if (random <= 0) {
      selectedRegion = region;
      break;
    }
  }

  // Generate coordinates within the selected region
  const lat = selectedRegion.latRange[0] + 
    Math.random() * (selectedRegion.latRange[1] - selectedRegion.latRange[0]);
  const lng = selectedRegion.lngRange[0] + 
    Math.random() * (selectedRegion.lngRange[1] - selectedRegion.lngRange[0]);

  return { lat, lng };
}

// Convert creator store tracks to globe nodes with random coordinates
export const globeTrackNodes: TrackNode[] = creatorStoreTracks.map(track => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  coordinates: generateRandomCoordinates(),
  genre: track.genre,
  imageUrl: track.imageUrl,
  audioUrl: track.audioUrl,
}));

// Export a function to get a subset of nodes if needed
export function getGlobeNodes(limit?: number): TrackNode[] {
  if (limit) {
    return globeTrackNodes.slice(0, limit);
  }
  return globeTrackNodes;
}