# Visualization Layer: Knowledge Graph Design

## Purpose

Transform attribution data into meaningful human experiences - making the invisible visible, the complex simple, and the abstract tangible.

## Core Visualizations

### 1. The Attribution Journey

#### "Where Did My Sound Go?"

```typescript
interface JourneyVisualization {
  // Starting point
  origin: {
    location: Coordinates;
    timestamp: Date;
    creator: Profile;
    work: Work;
  };
  
  // Journey nodes
  stops: Array<{
    location: Coordinates;
    timestamp: Date;
    transformer: Profile;
    transformation: 'remix' | 'sample' | 'cover' | 'inspiration';
    newWork: Work;
    listenerCount: number;
  }>;
  
  // Current status
  statistics: {
    totalWorks: number;
    countries: number;
    genres: string[];
    revenue: number;
    activeUses: number;
  };
}
```

#### Visual Representation

```
Your Loop (Nairobi, 2024)
    |
    ├─→ Remix (London, 2024) - 10K plays
    │   └─→ Sample (Tokyo, 2024) - 50K plays
    │       └─→ Game Soundtrack (LA, 2025) - 1M players
    │
    ├─→ DJ Mix (Berlin, 2024) - 5K plays
    │   └─→ Club Play (Ibiza, 2024) - 500 people
    │
    └─→ Educational Use (Mumbai, 2024) - 200 students
```

### 2. The Collaboration Web

#### Network Visualization

```typescript
interface CollaborationNetwork {
  // Central node (you)
  center: Creator;
  
  // Direct collaborations
  firstDegree: Array<{
    collaborator: Creator;
    worksogether: number;
    strongestWork: Work;
    totalRevenue: number;
  }>;
  
  // Extended network
  secondDegree: Array<{
    collaborator: Creator;
    connection: Creator; // Who connects you
    potential: 'high' | 'medium' | 'low';
  }>;
  
  // Metrics
  networkStats: {
    directCollaborators: number;
    extendedNetwork: number;
    averageDistance: number;
    strongestConnection: Creator;
  };
}
```

#### Visual Patterns

```
        Producer A
       /    |    \
      /     |     \
   Singer  YOU   Drummer
      \     |     /
       \    |    /
        DJ Curator
```

Shows clusters, bridges, and collaboration opportunities.

### 3. Cultural Flow Patterns

#### Geographic Heat Map

```typescript
interface CulturalFlow {
  // Source regions
  origins: Array<{
    region: string;
    tradition: string;
    uploadCount: number;
    activeKeepers: number;
  }>;
  
  // Flow paths
  flows: Array<{
    from: Region;
    to: Region;
    volume: number;
    type: 'remix' | 'sample' | 'inspiration';
    trending: boolean;
  }>;
  
  // Hot spots
  hotspots: Array<{
    location: Coordinates;
    activity: 'creating' | 'consuming' | 'remixing';
    intensity: number;
    growth: number; // % change
  }>;
}
```

#### Time-Lapse View

Shows how traditional music from rural Morocco influences electronic music in Paris, which then influences producers in Lagos, creating a global creative cycle.

### 4. Revenue Streams Visualization

#### The Money Flow

```typescript
interface RevenueVisualization {
  // Income sources
  sources: Array<{
    type: 'licensing' | 'streaming' | 'sales' | 'tips';
    amount: number;
    frequency: 'once' | 'monthly' | 'sporadic';
    trend: 'growing' | 'stable' | 'declining';
  }>;
  
  // Distribution
  distribution: Array<{
    recipient: string;
    percentage: number;
    amount: number;
    relationship: 'self' | 'collaborator' | 'community' | 'platform';
  }>;
  
  // Projections
  projections: {
    nextMonth: number;
    nextYear: number;
    ifViralTrack: number;
  };
}
```

#### Visual Design

Flowing river metaphor where streams join and split, showing how value flows through the network.

## Interactive Elements

### 1. Time Scrubbing

```typescript
interface TimeControl {
  // View attribution at any point
  scrubber: {
    start: Date;
    end: Date;
    current: Date;
    playbackSpeed: number;
  };
  
  // See evolution
  changes: Array<{
    timestamp: Date;
    event: 'upload' | 'remix' | 'payment' | 'viral';
    impact: 'high' | 'medium' | 'low';
  }>;
}
```

Users can scrub through time to see how their creative work spread - like watching a plant grow in time-lapse.

### 2. Zoom Levels

```typescript
enum ZoomLevel {
  PERSONAL = 1,    // Your immediate work
  LOCAL = 2,       // Your collaborator network
  REGIONAL = 3,    // Your geographic region
  GLOBAL = 4,      // Worldwide impact
  COSMIC = 5       // All creative flow
}
```

Each zoom level reveals different patterns and connections.

### 3. Filter Dimensions

```typescript
interface FilterOptions {
  // Content filters
  contentType: 'music' | 'video' | 'dance' | 'all';
  genre: string[];
  mood: string[];
  
  // Relationship filters
  relationship: 'created' | 'remixed' | 'curated' | 'influenced';
  degree: number; // Degrees of separation
  
  // Time filters
  timeRange: DateRange;
  activity: 'active' | 'dormant' | 'growing';
  
  // Economic filters
  monetized: boolean;
  revenueRange: Range;
  growthRate: Range;
}
```

## Storytelling Features

### 1. Milestone Moments

```typescript
interface Milestone {
  type: 'first_remix' | 'viral_moment' | 'community_impact' | 
        'collaboration_unlock' | 'tradition_preserved';
  timestamp: Date;
  description: string;
  impact: string;
  celebration: Animation;
}
```

The system celebrates meaningful moments:
- "Your melody just reached its 100th remix!"
- "Your traditional song is now preserved forever!"
- "You've collaborated with someone on every continent!"

### 2. Impact Narratives

```typescript
class ImpactStory {
  generateNarrative(creator: Creator): string {
    return `
      Your ${creator.uploads} uploads have:
      - Reached ${creator.countries} countries
      - Inspired ${creator.remixes} new works
      - Generated ${creator.revenue} for ${creator.collaborators} people
      - Preserved ${creator.traditions} traditional pieces
      
      Most impactful work: "${creator.topWork.title}"
      - ${creator.topWork.plays} plays across ${creator.topWork.platforms} platforms
      - Remixed by ${creator.topWork.remixers} including ${creator.topWork.notableRemixer}
      - Still growing at ${creator.topWork.growthRate}% monthly
    `;
  }
}
```

### 3. Connection Stories

Shows the human stories behind connections:
- "Your beat connected a producer in Seoul with a singer in Accra"
- "Three generations of your family's music are now preserved"
- "Your curation introduced 1,000 people to traditional Mongolian music"

## Technical Implementation

### 1. Graph Database

```typescript
// Neo4j or similar
interface GraphSchema {
  nodes: {
    Work: WorkNode;
    Creator: CreatorNode;
    Community: CommunityNode;
    Tradition: TraditionNode;
  };
  
  relationships: {
    CREATED_BY: { timestamp: Date; percentage: number };
    REMIXED_FROM: { timestamp: Date; transformation: string };
    INFLUENCED_BY: { strength: number };
    MEMBER_OF: { since: Date; role: string };
    PRESERVES: { authenticity: number };
  };
}
```

### 2. Real-Time Updates

```typescript
class RealtimeVisualization {
  // WebSocket connection for live updates
  subscribe(workId: string) {
    ws.on(`work:${workId}:play`, (data) => {
      this.animatePlay(data.location);
    });
    
    ws.on(`work:${workId}:remix`, (data) => {
      this.addRemixBranch(data);
    });
    
    ws.on(`work:${workId}:payment`, (data) => {
      this.showRevenueFlow(data);
    });
  }
}
```

### 3. Performance Optimization

```typescript
interface CacheStrategy {
  // Pre-calculate expensive queries
  preCalculated: {
    attributionTrees: boolean;
    revenueFlows: boolean;
    collaborationNetworks: boolean;
  };
  
  // Progressive loading
  lazyLoad: {
    initialDepth: 2;
    expandOnDemand: true;
    maxDepth: 10;
  };
  
  // Level of detail
  lod: {
    near: 'full';
    medium: 'simplified';
    far: 'aggregate';
  };
}
```

## Visual Design Language

### Color Semantics

```css
:root {
  /* Creation & Origin */
  --color-creation: #FFD700;      /* Gold - original work */
  --color-tradition: #8B4513;     /* Brown - traditional/ancient */
  
  /* Transformation */
  --color-remix: #00CED1;         /* Turquoise - remixes */
  --color-sample: #FF69B4;        /* Pink - samples */
  --color-cover: #98FB98;         /* Pale green - covers */
  
  /* Flow & Movement */
  --color-active-flow: #00FFFF;   /* Cyan - active movement */
  --color-dormant: #708090;       /* Gray - inactive */
  
  /* Value & Impact */
  --color-revenue: #00FF00;       /* Green - money flow */
  --color-impact: #FFE153;        /* Yellow - cultural impact */
}
```

### Animation Principles

```typescript
interface AnimationConfig {
  // Organic movement
  flows: {
    type: 'bezier';
    tension: 0.4;
    friction: 0.2;
  };
  
  // Meaningful timing
  durations: {
    quickUpdate: 200;    // ms
    stateChange: 500;
    storyReveal: 2000;
  };
  
  // Natural physics
  physics: {
    gravity: true;
    collision: true;
    attraction: true;
  };
}
```

## Accessibility

### Universal Design

```typescript
interface AccessibilityFeatures {
  // Visual alternatives
  textDescriptions: boolean;
  highContrast: boolean;
  colorBlindModes: string[];
  
  // Interaction alternatives
  keyboardNavigation: boolean;
  voiceControl: boolean;
  reducedMotion: boolean;
  
  // Cognitive aids
  simplifiedView: boolean;
  guidedTours: boolean;
  contextHelp: boolean;
}
```

## The Spiritual Dimension

This visualization layer makes visible:
- Your place in the creative cosmos
- The ripples of your creativity
- Connections you didn't know existed
- The value you bring beyond money
- Your creative legacy

It transforms data into meaning, statistics into stories, and attribution into connection.