import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const MAPBOX_API_KEY = Deno.env.get('MAPBOX_API_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Parse request
    const { locationText, recordId, tableName } = await req.json()
    
    console.log('Geocoding:', locationText, 'for record:', recordId)

    // Initialize Supabase admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Call Mapbox Geocoding API
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationText)}.json?access_token=${MAPBOX_API_KEY}&types=country,place,locality&limit=1`
    
    const response = await fetch(geocodeUrl)
    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center
      const placeName = data.features[0].place_name

      // Update the record with coordinates
      const { error } = await supabase
        .from(tableName)
        .update({
          location_lat: lat,      // Changed from 'latitude'
          location_lng: lng,      // Changed from 'longitude'
          geocoded_place_name: placeName,
          geocoding_status: 'success',
          geocoded_at: new Date().toISOString()
        })
        .eq('id', recordId)

      if (error) throw error

      console.log('Successfully geocoded:', placeName, lat, lng)

      return new Response(
        JSON.stringify({ success: true, lat, lng, placeName }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // No results found
      await supabase
        .from(tableName)
        .update({
          geocoding_status: 'failed',
          geocoding_error: 'Location not found'
        })
        .eq('id', recordId)

      return new Response(
        JSON.stringify({ success: false, error: 'Location not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})