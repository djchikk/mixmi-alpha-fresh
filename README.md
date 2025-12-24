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
- **SUI zkLogin Integration** - Google/Apple sign-in with automatic SUI wallet creation
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
- **Authentication**: Stacks blockchain wallet + SUI zkLogin integration
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
- **zkLogin** (`lib/zklogin/`) - SUI zkLogin authentication utilities

## 🚀 Getting Started

### Prerequisites
- Node.js 18.20.4+
- Supabase account with database setup
- Mapbox API key for location services
- Alpha user whitelist access

### Installation
```bash
# Clone repository
git clone https://github.com/djchikk/mixmi-alpha-fresh.git
cd mixmi-alpha-fresh

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
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_SUI_NETWORK=testnet
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
├── auth/callback/           # OAuth callback handler
├── page.tsx                 # Main globe interface
└── layout.tsx               # App layout and providers

components/
├── globe/                   # 3D globe visualization components
├── cards/                   # Track display components
├── modals/                  # Upload and detail modals
├── auth/                    # Authentication components (Google, Apple buttons)
├── shared/                  # Reusable components
└── ui/                      # shadcn/ui components

lib/
├── zklogin/                 # SUI zkLogin utilities
├── auth/                    # Authentication utilities
├── globeDataSupabase.ts    # Globe data fetching
└── supabase.ts             # Database client

hooks/                       # Custom React hooks
contexts/                    # React contexts (Auth, Mixer, etc.)
types/                       # TypeScript definitions
```

## 📚 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Developer guidance and architecture
- **[docs/](./docs/)** - Additional documentation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built for geographic music discovery and seamless alpha content migration to the broader mixmi creator economy ecosystem.**
