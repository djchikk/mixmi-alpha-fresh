// Major city coordinates database
const CITY_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  // North America
  'new york': { lat: 40.7128, lng: -74.0060, name: 'New York' },
  'nyc': { lat: 40.7128, lng: -74.0060, name: 'New York' },
  'los angeles': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
  'la': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
  'chicago': { lat: 41.8781, lng: -87.6298, name: 'Chicago' },
  'houston': { lat: 29.7604, lng: -95.3698, name: 'Houston' },
  'phoenix': { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
  'philadelphia': { lat: 39.9526, lng: -75.1652, name: 'Philadelphia' },
  'san antonio': { lat: 29.4241, lng: -98.4936, name: 'San Antonio' },
  'san diego': { lat: 32.7157, lng: -117.1611, name: 'San Diego' },
  'dallas': { lat: 32.7767, lng: -96.7970, name: 'Dallas' },
  'san jose': { lat: 37.3382, lng: -121.8863, name: 'San Jose' },
  'austin': { lat: 30.2672, lng: -97.7431, name: 'Austin' },
  'miami': { lat: 25.7617, lng: -80.1918, name: 'Miami' },
  'seattle': { lat: 47.6062, lng: -122.3321, name: 'Seattle' },
  'san francisco': { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  'sf': { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  'denver': { lat: 39.7392, lng: -104.9903, name: 'Denver' },
  'boston': { lat: 42.3601, lng: -71.0589, name: 'Boston' },
  'portland': { lat: 45.5152, lng: -122.6784, name: 'Portland' },
  'atlanta': { lat: 33.7490, lng: -84.3880, name: 'Atlanta' },
  'flagstaff': { lat: 35.1983, lng: -111.6513, name: 'Flagstaff, Arizona' },
  'solvang': { lat: 34.5958, lng: -120.1376, name: 'Solvang, California' },
  'toronto': { lat: 43.6532, lng: -79.3832, name: 'Toronto' },
  'montreal': { lat: 45.5017, lng: -73.5673, name: 'Montreal' },
  'vancouver': { lat: 49.2827, lng: -123.1207, name: 'Vancouver' },
  'mexico city': { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },
  
  // Europe  
  'london': { lat: 51.5074, lng: -0.1278, name: 'London' },
  // London boroughs - all map to central London for clustering
  'finsbury park': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'soho': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'hackney': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'shoreditch': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'camden': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'islington': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'westminster': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'kensington': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'chelsea': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'greenwich': { lat: 51.5074, lng: -0.1278, name: 'London' },
  'paris': { lat: 48.8566, lng: 2.3522, name: 'Paris' },
  'berlin': { lat: 52.5200, lng: 13.4050, name: 'Berlin' },
  'madrid': { lat: 40.4168, lng: -3.7038, name: 'Madrid' },
  'rome': { lat: 41.9028, lng: 12.4964, name: 'Rome' },
  'amsterdam': { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' },
  'barcelona': { lat: 41.3851, lng: 2.1734, name: 'Barcelona' },
  'vienna': { lat: 48.2082, lng: 16.3738, name: 'Vienna' },
  'prague': { lat: 50.0755, lng: 14.4378, name: 'Prague' },
  'stockholm': { lat: 59.3293, lng: 18.0686, name: 'Stockholm' },
  'copenhagen': { lat: 55.6761, lng: 12.5683, name: 'Copenhagen' },
  'dublin': { lat: 53.3498, lng: -6.2603, name: 'Dublin' },
  'zurich': { lat: 47.3769, lng: 8.5417, name: 'Zurich' },
  'brussels': { lat: 50.8503, lng: 4.3517, name: 'Brussels' },
  'warsaw': { lat: 52.2297, lng: 21.0122, name: 'Warsaw' },
  'lisbon': { lat: 38.7223, lng: -9.1393, name: 'Lisbon' },
  'athens': { lat: 37.9838, lng: 23.7275, name: 'Athens' },
  'moscow': { lat: 55.7558, lng: 37.6173, name: 'Moscow' },
  'istanbul': { lat: 41.0082, lng: 28.9784, name: 'Istanbul' },
  
  // Asia
  'tokyo': { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
  'beijing': { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
  'shanghai': { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
  'mumbai': { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
  'delhi': { lat: 28.7041, lng: 77.1025, name: 'Delhi' },
  'singapore': { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  'hong kong': { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
  'seoul': { lat: 37.5665, lng: 126.9780, name: 'Seoul' },
  'bangkok': { lat: 13.7563, lng: 100.5018, name: 'Bangkok' },
  'dubai': { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
  'taipei': { lat: 25.0330, lng: 121.5654, name: 'Taipei' },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869, name: 'Kuala Lumpur' },
  'jakarta': { lat: -6.2088, lng: 106.8456, name: 'Jakarta' },
  'manila': { lat: 14.5995, lng: 120.9842, name: 'Manila' },
  'bangalore': { lat: 12.9716, lng: 77.5946, name: 'Bangalore' },
  
  // South America
  'são paulo': { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
  'sao paulo': { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro' },
  'rio': { lat: -22.9068, lng: -43.1729, name: 'Rio de Janeiro' },
  'buenos aires': { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires' },
  'lima': { lat: -12.0464, lng: -77.0428, name: 'Lima' },
  'bogota': { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  'santiago': { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
  'caracas': { lat: 10.4806, lng: -66.9036, name: 'Caracas' },
  
  // Oceania
  'sydney': { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
  'melbourne': { lat: -37.8136, lng: 144.9631, name: 'Melbourne' },
  'brisbane': { lat: -27.4698, lng: 153.0251, name: 'Brisbane' },
  'perth': { lat: -31.9505, lng: 115.8605, name: 'Perth' },
  'auckland': { lat: -36.8485, lng: 174.7633, name: 'Auckland' },
  
  // Africa
  'cairo': { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
  'johannesburg': { lat: -26.2041, lng: 28.0473, name: 'Johannesburg' },
  'cape town': { lat: -33.9249, lng: 18.4241, name: 'Cape Town' },
  'lagos': { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
  'nairobi': { lat: -1.2921, lng: 36.8219, name: 'Nairobi' },
  'casablanca': { lat: 33.5731, lng: -7.5898, name: 'Casablanca' },
  
  // Indigenous Territories & Reservations
  'standing rock': { lat: 45.750, lng: -100.750, name: 'Standing Rock Reservation' },
  'standing rock reservation': { lat: 45.750, lng: -100.750, name: 'Standing Rock Reservation' },
  'pine ridge': { lat: 43.000, lng: -102.500, name: 'Pine Ridge Reservation' },
  'pine ridge reservation': { lat: 43.000, lng: -102.500, name: 'Pine Ridge Reservation' },
  'navajo nation': { lat: 36.000, lng: -109.500, name: 'Navajo Nation' },
  'cherokee nation': { lat: 35.900, lng: -94.800, name: 'Cherokee Nation' },
  'osage nation': { lat: 36.500, lng: -96.300, name: 'Osage Nation' },
  'tohono oodham': { lat: 32.000, lng: -111.900, name: "Tohono O'odham Nation" },
  'tohono oodham nation': { lat: 32.000, lng: -111.900, name: "Tohono O'odham Nation" },
  'hopi reservation': { lat: 35.800, lng: -110.200, name: 'Hopi Reservation' },
  'blackfeet reservation': { lat: 48.600, lng: -113.000, name: 'Blackfeet Reservation' },
  
  // Middle East
  'tel aviv': { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv' },
  'jerusalem': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
  'riyadh': { lat: 24.7136, lng: 46.6753, name: 'Riyadh' },
  'doha': { lat: 25.2854, lng: 51.5310, name: 'Doha' },
  'abu dhabi': { lat: 24.4539, lng: 54.3773, name: 'Abu Dhabi' },
};

// Country coordinates (approximate center)
const COUNTRY_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  'usa': { lat: 37.0902, lng: -95.7129, name: 'USA' },
  'united states': { lat: 37.0902, lng: -95.7129, name: 'United States' },
  'uk': { lat: 55.3781, lng: -3.4360, name: 'UK' },
  'united kingdom': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom' },
  'canada': { lat: 56.1304, lng: -106.3468, name: 'Canada' },
  'france': { lat: 46.2276, lng: 2.2137, name: 'France' },
  'germany': { lat: 51.1657, lng: 10.4515, name: 'Germany' },
  'spain': { lat: 40.4637, lng: -3.7492, name: 'Spain' },
  'italy': { lat: 41.8719, lng: 12.5674, name: 'Italy' },
  'australia': { lat: -25.2744, lng: 133.7751, name: 'Australia' },
  'japan': { lat: 36.2048, lng: 138.2529, name: 'Japan' },
  'china': { lat: 35.8617, lng: 104.1954, name: 'China' },
  'india': { lat: 20.5937, lng: 78.9629, name: 'India' },
  'brazil': { lat: -14.2350, lng: -51.9253, name: 'Brazil' },
  'argentina': { lat: -38.4161, lng: -63.6167, name: 'Argentina' },
  'mexico': { lat: 23.6345, lng: -102.5528, name: 'Mexico' },
  'russia': { lat: 61.5240, lng: 105.3188, name: 'Russia' },
  'south africa': { lat: -30.5595, lng: 22.9375, name: 'South Africa' },
  'egypt': { lat: 26.8206, lng: 30.8025, name: 'Egypt' },
  'nigeria': { lat: 9.0820, lng: 8.6753, name: 'Nigeria' },
  'kenya': { lat: -0.0236, lng: 37.9062, name: 'Kenya' },
  'israel': { lat: 31.0461, lng: 34.8516, name: 'Israel' },
  'uae': { lat: 23.4241, lng: 53.8478, name: 'UAE' },
  'saudi arabia': { lat: 23.8859, lng: 45.0792, name: 'Saudi Arabia' },
  'turkey': { lat: 38.9637, lng: 35.2433, name: 'Turkey' },
  'south korea': { lat: 35.9078, lng: 127.7669, name: 'South Korea' },
  'indonesia': { lat: -0.7893, lng: 113.9213, name: 'Indonesia' },
  'thailand': { lat: 15.8700, lng: 100.9925, name: 'Thailand' },
  'vietnam': { lat: 14.0583, lng: 108.2772, name: 'Vietnam' },
  'philippines': { lat: 12.8797, lng: 121.7740, name: 'Philippines' },
  'new zealand': { lat: -40.9006, lng: 174.8860, name: 'New Zealand' },
};

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

// Geocode location using Mapbox API
async function geocodeWithMapbox(location: string): Promise<LocationData | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    console.warn('⚠️ Mapbox token not configured, skipping API geocoding');
    return null;
  }

  try {
    console.log(`🌍 Geocoding "${location}" with Mapbox API...`);
    const encodedLocation = encodeURIComponent(location);
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${token}&limit=1`
    );

    if (!response.ok) {
      console.error('❌ Mapbox API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      console.log(`📍 No results found for "${location}"`);
      return null;
    }

    const feature = data.features[0];
    const [lng, lat] = feature.center;
    const name = feature.place_name || location;
    
    console.log(`✅ Geocoded "${location}" → ${name} (${lat}, ${lng})`);
    return { lat, lng, name };
    
  } catch (error) {
    console.error('❌ Error geocoding with Mapbox:', error);
    return null;
  }
}

export async function parseLocationsAndGetCoordinates(input: string): Promise<{
  primary: LocationData | null;
  all: LocationData[];
  rawText: string | null;
  rawLocations: string[];
}> {
  if (!input || input.trim() === '') {
    return { primary: null, all: [], rawText: null, rawLocations: [] };
  }

  // For now, treat the entire input as a single location if it contains "city, country" format
  // This preserves "Timbuktu, Mali" as a single location instead of splitting it
  const trimmedInput = input.trim();
  
  // Simple heuristic: if it looks like "City, Country" (one comma), treat as single location
  const commaCount = (trimmedInput.match(/,/g) || []).length;
  
  let rawLocations: string[];
  if (commaCount === 1 && trimmedInput.split(',').every(part => part.trim().split(' ').length <= 3)) {
    // Likely a "City, Country" format - keep as single location
    rawLocations = [trimmedInput];
  } else {
    // Multiple locations or complex format - split by comma
    rawLocations = trimmedInput
      .split(',')
      .map(loc => loc.trim())
      .filter(loc => loc.length > 0);
  }
  
  const foundLocations: LocationData[] = [];

  for (const locationOriginal of rawLocations) {
    const locationLower = locationOriginal.toLowerCase();
    
    // Check cities first (more specific)
    if (CITY_COORDINATES[locationLower]) {
      foundLocations.push(CITY_COORDINATES[locationLower]);
    } 
    // Then check countries
    else if (COUNTRY_COORDINATES[locationLower]) {
      foundLocations.push(COUNTRY_COORDINATES[locationLower]);
    }
    // If not found in hardcoded lists, try Mapbox geocoding
    else {
      console.log(`📍 "${locationOriginal}" not in hardcoded list, trying Mapbox...`);
      const mapboxResult = await geocodeWithMapbox(locationOriginal);
      
      if (mapboxResult) {
        foundLocations.push(mapboxResult);
      } else {
        // Only fall back to 0,0 if Mapbox also failed
        console.log(`⚠️ Could not geocode "${locationOriginal}" - saving as text only`);
        foundLocations.push({
          name: locationOriginal,
          lat: 0,  // Will be saved as NULL in database
          lng: 0   // Will be saved as NULL in database
        });
      }
    }
  }

  // Always return data if we have input
  const primary = foundLocations[0] || {
    name: trimmedInput,
    lat: 0,
    lng: 0
  };

  return {
    primary: primary,
    all: foundLocations.length > 0 ? foundLocations : [primary],
    rawText: trimmedInput,  // Always return the full input text
    rawLocations: rawLocations
  };
}

// Helper function to get single coordinates
export function getCoordinates(location: string): LocationData | null {
  const normalized = location.trim().toLowerCase();
  return CITY_COORDINATES[normalized] || COUNTRY_COORDINATES[normalized] || null;
}

// Helper to format location name for display
export function formatLocationName(locations: LocationData[]): string {
  if (locations.length === 0) return '';
  if (locations.length === 1) return locations[0].name;
  if (locations.length === 2) return `${locations[0].name} & ${locations[1].name}`;
  return `${locations[0].name} & ${locations.length - 1} more`;
}

// Search hardcoded locations for autocomplete
export function searchHardcodedLocations(query: string, limit: number = 5): LocationData[] {
  if (!query || query.length < 2) return [];
  
  const searchTerm = query.toLowerCase().trim();
  const results: LocationData[] = [];
  
  // Combine cities and countries for searching
  const allLocations = { ...CITY_COORDINATES, ...COUNTRY_COORDINATES };
  
  // Exact matches first
  for (const [key, location] of Object.entries(allLocations)) {
    if (key === searchTerm) {
      results.push(location);
    }
  }
  
  // Starts with matches
  for (const [key, location] of Object.entries(allLocations)) {
    if (key.startsWith(searchTerm) && !results.find(r => r.name === location.name)) {
      results.push(location);
      if (results.length >= limit) break;
    }
  }
  
  // Contains matches (if we need more results)
  if (results.length < limit) {
    for (const [key, location] of Object.entries(allLocations)) {
      if (key.includes(searchTerm) && !results.find(r => r.name === location.name)) {
        results.push(location);
        if (results.length >= limit) break;
      }
    }
  }
  
  return results.slice(0, limit);
}