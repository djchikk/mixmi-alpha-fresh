# mixmi Alpha Uploader

> **🎵 Interactive 3D Globe Music Discovery + Loop Pack Upload System**
>
> **Current Status:** Alpha content migration tool for global music discovery via interactive 3D globe interface

A specialized Next.js application for alpha content migration to the broader mixmi creator economy platform. Features a stunning 3D globe interface for geographic music discovery and a streamlined loop pack upload system for alpha users.

## 🌍 Core Features

### 🎯 Interactive 3D Globe Discovery
- **Geographic Music Visualization** - Explore music positioned worldwide on an interactive 3D globe
- **Smart Clustering** - Locations within 200-mile radius cluster for better UX (keeps LA/SF separate)
- **Real-time Audio Previews** - 20-second track previews directly from globe nodes
- **Advanced Hover System** - Track information and tags appear on hover
- **Content Comparison** - Side-by-side track comparison with floating cards

### 📦 Professional Loop Pack System
- **Multi-File Uploads** - Upload 2-5 audio files as cohesive loop packs
- **Content Type Detection** - Automatic categorization (Song | Loop | Loop Pack)
- **Visual Distinction** - Loop packs display with distinctive thick purple borders
- **Detailed Modal Views** - Individual loop audition and metadata within packs
- **BPM Management** - Required user input for loops/packs (detection available but user override essential for mixer compatibility)

### 🔐 Alpha User Authentication
- **Whitelist-Based Access** - Simplified authentication via alpha user verification
- **Stacks Wallet Integration** - Mainnet wallet address authentication
- **No Complex Auth Flow** - Streamlined paste-address-and-upload experience
- **Multi-Contributor Support** - Only uploader needs alpha approval for collaborations

### 🎧 Professional Audio Processing
- **Advanced Upload Pipeline** - 5-stage processing with real-time feedback
- **Audio Compression** - Intelligent format optimization for web delivery
- **Waveform Visualization** - Professional canvas-based audio visualization
- **Clean Audio Management** - Automatic cleanup and 20-second preview limits

## 🏗️ Technical Architecture

### Tech Stack
- **Framework**: Next.js 14 with TypeScript and App Router
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Stacks blockchain wallet integration
- **3D Graphics**: Three.js with @react-three/fiber for globe rendering
- **Storage**: Supabase cloud storage with hybrid local caching
- **Geocoding**: Mapbox API for worldwide location coordinates
- **Styling**: Tailwind CSS with custom animations

### Key Components
- **3D Globe** (`components/globe/`) - Interactive world visualization with clustering
- **Upload System** (`hooks/useIPTrackSubmit.ts`) - Multi-file loop pack processing
- **Audio Engine** (`lib/mixerAudio.ts`) - Professional audio processing and BPM detection
- **Track Cards** (`components/cards/CompactTrackCard.tsx`) - Unified track display system
- **Modal System** (`components/modals/`) - Upload and track detail interfaces

### Storage Architecture
- **User Content Bucket** - Supabase storage for audio files and cover art
- **Account-Specific Organization** - Data isolated by wallet address
- **Hybrid Caching** - localStorage for performance + cloud for persistence
- **Smart Compression** - Multiple quality levels for optimal delivery

## 🎵 Content Management

### Supported Content Types
- **Songs** - Complete tracks with gold accent borders
- **Loops** - Individual music loops with purple accent borders  
- **Loop Packs** - Multi-file collections with thick purple borders

### Upload Flow
1. **Alpha Verification** - Paste Stacks wallet address for whitelist check
2. **Content Selection** - Choose Song, Loop, or Loop Pack upload type
3. **File Upload** - Select audio files via file picker (10MB limit each)
4. **Metadata Entry** - Title, artist, BPM, location, and attribution details
5. **Processing** - 5-stage pipeline with real-time progress feedback
6. **Globe Integration** - Content immediately appears positioned on globe

### BPM Requirements
- **Loops & Loop Packs** - BPM input is required (not optional)
- **Loop Pack Consistency** - All individual loops within a pack must have matching BPM
- **User Override Priority** - Manual BPM entry supersedes automatic detection
- **Mixer Compatibility** - User-provided whole number BPM prevents decimal precision issues in mixer

### Geographic Integration
- **Worldwide Support** - Mapbox geocoding for any location globally
- **Indigenous Territory Recognition** - Support for tribal lands and nations
- **Smart Clustering** - Regional grouping while maintaining local distinctness
- **Visual Positioning** - Content appears precisely positioned on 3D globe

## 🚀 Getting Started

### Prerequisites
- Node.js 18.20.4+
- Supabase account with database setup
- Mapbox API key for location services
- Alpha user whitelist access

### Installation
```bash
# Clone repository
git clone https://github.com/djchikk/mixmi-alpha-uploader.git
cd mixmi-alpha-uploader

# Install dependencies  
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_api_key
```

### Development
```bash
npm run dev          # Start dev server on port 3001
npm run build        # Production build
npm run lint         # Code linting
```

## 📁 Project Structure

```
app/                          # Next.js app router
├── api/                     # Authentication and debug APIs
├── page.tsx                 # Main globe interface
└── layout.tsx               # App layout and providers

components/
├── globe/                   # 3D globe visualization components
├── cards/                   # Track display components
├── modals/                  # Upload and detail modals
├── shared/                  # Reusable components
└── ui/                      # shadcn/ui components

hooks/                       # Custom React hooks
├── useIPTrackSubmit.ts      # Upload processing logic
├── useAudioUpload.ts        # Multi-file handling
└── useMixerAudio.ts        # Audio processing

lib/                         # Core utilities and services
├── globeDataSupabase.ts    # Globe data fetching
├── auth/alpha-auth.ts      # Alpha user authentication
├── supabase.ts             # Database client
└── locationLookup.ts       # Geographic services

types/                       # TypeScript definitions
scripts/                     # Database utilities and migration tools
```

## 🎯 Current Status & Known Issues

### ✅ Working Features
- **3D Globe Performance** - Optimized loading (150ms vs 7+ seconds)
- **Loop Pack System** - Complete upload and display pipeline
- **Audio Processing** - BPM detection and preview system
- **Geographic Positioning** - Worldwide location support via Mapbox
- **Alpha Authentication** - Whitelist-based user verification

### 🔧 Active Development Areas
- **Individual Loop Database Records** - Loop pack details modal population
- **Enhanced Modal System** - Individual loop audition within packs
- **Audio Drag & Drop** - File drag & drop support for audio uploads (currently images only)
- **Production Polish** - Code cleanup and optimization for deployment

### 🚫 Known Limitations
- **Alpha User Only** - Requires whitelist approval for uploads
- **Node.js Dependency** - Development requires Node.js environment
- **Single Environment** - Separate from main mixmi app to avoid production conflicts
- **Pre-Production Status** - Aiming for production quality, planned for hosting without dedicated domain
- **Audio File Selection** - No drag & drop for audio files yet (file picker only)

## 🔄 Integration Roadmap

### Phase 1: Content Migration (Current)
- ✅ Alpha user content upload and verification
- ✅ 3D globe geographic discovery interface
- ✅ Professional loop pack system
- ✅ Audio processing and BPM detection

### Phase 2: Feature Enhancement
- 🔧 Individual loop database record creation
- 📱 Enhanced modal system for loop pack interaction
- 🧹 Production code cleanup and optimization
- 📊 Content management dashboard

### Phase 3: Main App Integration
- 🔄 Component portability back to main mixmi platform
- 🔗 Creator economy feature integration
- 💰 IP attribution and revenue sharing systems
- 🤝 Advanced collaboration tools

## 🌟 Vision Connection

This alpha uploader serves as both a standalone tool and a testing ground for components that will integrate into the broader **mixmi Creator Economy Platform**. The vision of "infinite remix at a global level with value flow and attribution connected" drives the technical architecture, with this alpha tool focusing on content discovery and upload workflows.

### Future Integration Elements
- **Multi-Account System** - Framework exists for multiple creative identities
- **IP Attribution** - Database schema ready for composition/production splits
- **Creator Stores** - Individual creator catalog system in development
- **Revenue Sharing** - Blockchain integration prepared for automated royalty distribution

## 📚 Documentation

- **[Current Work Status](./CURRENT_WORK_STATUS.md)** - Active development priorities
- **[Claude Implementation Guide](./CLAUDE.md)** - Developer guidance and architecture
- **[Creator Economy Overview](./docs/CREATOR-ECONOMY-OVERVIEW.md)** - Broader platform vision
- **[Technical Handoff](./docs/TECHNICAL-HANDOFF.md)** - Deployment and handoff details

## 🤝 Contributing

This alpha tool prioritizes rapid iteration and testing of core components. When contributing:

1. **Maintain Performance** - Globe rendering and audio processing are critical paths
2. **Preserve Data Integrity** - Alpha user content must be protected during development
3. **Follow Existing Patterns** - Use established component patterns for consistency
4. **Test Multi-File Uploads** - Loop packs are a key differentiator
5. **Consider Integration** - Components may be ported back to main app

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Stacks Blockchain** - Decentralized authentication infrastructure
- **Supabase** - Database and storage backend
- **Three.js Community** - 3D globe visualization capabilities
- **Mapbox** - Global geocoding and location services
- **Alpha Contributors** - Early content creators and testers

---

**Built for geographic music discovery and seamless alpha content migration to the broader mixmi creator economy ecosystem.**