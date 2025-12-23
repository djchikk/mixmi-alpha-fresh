import { NextResponse } from 'next/server';
import { fetchGlobeTracksFromSupabase } from '@/lib/globeDataSupabase';

export async function GET() {
  try {
    const nodes = await fetchGlobeTracksFromSupabase();
    
    // Group by location for debugging
    const locationMap = new Map<string, any[]>();
    
    nodes.forEach(node => {
      const key = `${Math.round(node.coordinates.lat * 1000) / 1000},${Math.round(node.coordinates.lng * 1000) / 1000}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, []);
      }
      locationMap.get(key)!.push({
        id: node.id,
        title: node.title,
        location: node.location,
        coordinates: node.coordinates
      });
    });
    
    const groups = Array.from(locationMap.entries()).map(([key, nodes]) => ({
      key,
      count: nodes.length,
      nodes: nodes
    }));
    
    return NextResponse.json({
      totalNodes: nodes.length,
      locationGroups: groups.filter(g => g.count > 1),
      sampleNodes: nodes.slice(0, 5)
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}