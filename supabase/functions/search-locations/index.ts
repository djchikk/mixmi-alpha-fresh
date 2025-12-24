import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    
    // Parse request
    const { query, types = 'country,place,locality,neighborhood', limit = 5 } = await req.json()
    
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Query too short' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    console.log('Searching for:', query)

    // Call Mapbox Geocoding API for autocomplete
    const searchUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `access_token=${MAPBOX_API_KEY}&` +
      `types=${types}&` +
      `limit=${limit}&` +
      `autocomplete=true`
    
    const response = await fetch(searchUrl)
    const data = await response.json()

    if (data.features) {
      // Simplify the response for frontend
      const suggestions = data.features.map((feature: any) => ({
        id: feature.id,
        text: feature.text,
        place_name: feature.place_name,
        center: feature.center,
        place_type: feature.place_type,
        properties: feature.properties
      }))

      console.log(`Found ${suggestions.length} suggestions for: ${query}`)

      return new Response(
        JSON.stringify({ success: true, suggestions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ success: true, suggestions: [] }),
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