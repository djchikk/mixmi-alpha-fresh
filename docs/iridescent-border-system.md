# Iridescent Border System

Technical documentation for the shimmer/iridescent border effect used on Portal cards and future remix generation indicators.

## Overview

The iridescent border creates a pearlescent, rainbow-shifting effect using pure CSS - no Canvas, WebGL, or external libraries required. This technique is performant (GPU-accelerated CSS animations) and works across all modern browsers.

## How It Works

The effect combines three CSS properties:

1. **Multi-stop linear gradient** - Cycles between white and soft pastel colors
2. **Oversized background** - `background-size: 400% 400%` allows gradient to shift
3. **Keyframe animation** - Moves `background-position` to reveal different gradient segments

```
┌─────────────────────────────────────────────────────────────────┐
│                    Full Gradient (400% width)                   │
│  ┌─────────┬─────────┬─────────┬─────────┐                     │
│  │ white → │ lavender│ → white │ → pink  │ → white → mint      │
│  │         │         │         │         │                     │
│  └─────────┴─────────┴─────────┴─────────┘                     │
│       ▲                                                         │
│       └── Visible viewport (100%) slides left/right            │
└─────────────────────────────────────────────────────────────────┘
```

As the animation runs, the "viewport" slides across the full gradient, making different color sections become visible - creating the flowing iridescent effect.

## Implementation

### Source File
`components/cards/PortalCard.tsx` (lines 104-131)

### CSS Structure

```css
/* The border element */
.portal-border {
  background: linear-gradient(
    135deg,
    #FFFFFF 0%,
    #D4C4F8 14%,    /* lavender */
    #FFFFFF 28%,
    #C4D4F8 42%,    /* blue-lavender */
    #FFFFFF 56%,
    #F8D4E4 70%,    /* pink */
    #FFFFFF 84%,
    #D4F8E4 100%    /* mint green */
  );
  background-size: 400% 400%;
  animation: shimmer 6s ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### HTML Structure (Circular Border Technique)

```tsx
{/* Outer container - defines total size */}
<div className="w-[152px] h-[152px] rounded-full overflow-hidden relative">

  {/* Animated gradient fills entire container */}
  <div className="portal-border absolute inset-0 rounded-full" />

  {/* Inner content - inset creates the "border" gap */}
  <div className="absolute inset-[6px] rounded-full bg-slate-900">
    {/* Card content goes here */}
  </div>
</div>
```

The 6px inset creates a 6px visible "border" of the gradient showing around the inner content.

## Adapting for Remix Generations

The same technique can create tinted shimmer borders for Gen 1 and Gen 2+ remix tracks.

### Gen 1 - Blue/Green Tint (Cool)
For first-generation remixes of original content.

```css
.remix-border-gen1 {
  background: linear-gradient(
    135deg,
    #FFFFFF 0%,
    #A8E6CF 14%,    /* mint */
    #FFFFFF 28%,
    #88D4F2 42%,    /* sky blue */
    #FFFFFF 56%,
    #B8E8D2 70%,    /* seafoam */
    #FFFFFF 84%,
    #7BC8F4 100%    /* light blue */
  );
  background-size: 400% 400%;
  animation: shimmer 6s ease-in-out infinite;
}
```

### Gen 2+ - Red/Orange Tint (Warm)
For second-generation and beyond (remixes of remixes).

```css
.remix-border-gen2 {
  background: linear-gradient(
    135deg,
    #FFFFFF 0%,
    #FFB088 14%,    /* peach */
    #FFFFFF 28%,
    #FF9966 42%,    /* orange */
    #FFFFFF 56%,
    #FFAA88 70%,    /* coral */
    #FFFFFF 84%,
    #FF8866 100%    /* salmon */
  );
  background-size: 400% 400%;
  animation: shimmer 6s ease-in-out infinite;
}
```

### Tailwind Implementation

For use with Tailwind's arbitrary values or custom CSS:

```tsx
// Component using styled-jsx
<style jsx>{`
  .remix-border-gen1 {
    background: linear-gradient(135deg, #FFFFFF 0%, #A8E6CF 14%, #FFFFFF 28%, #88D4F2 42%, #FFFFFF 56%, #B8E8D2 70%, #FFFFFF 84%, #7BC8F4 100%);
    background-size: 400% 400%;
    animation: shimmer 6s ease-in-out infinite;
  }

  .remix-border-gen2 {
    background: linear-gradient(135deg, #FFFFFF 0%, #FFB088 14%, #FFFFFF 28%, #FF9966 42%, #FFFFFF 56%, #FFAA88 70%, #FFFFFF 84%, #FF8866 100%);
    background-size: 400% 400%;
    animation: shimmer 6s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`}</style>
```

## Usage in Track Cards

### Square Card Implementation

For square track cards (vs circular Portal cards):

```tsx
{/* Outer container */}
<div className="w-[160px] h-[160px] rounded-lg overflow-hidden relative">

  {/* Shimmer border - use appropriate class based on generation */}
  <div className={`absolute inset-0 rounded-lg ${
    generation === 1 ? 'remix-border-gen1' :
    generation >= 2 ? 'remix-border-gen2' : ''
  }`} />

  {/* Inner content - 4px border */}
  <div className="absolute inset-[4px] rounded-md bg-slate-900">
    {/* Card content */}
  </div>
</div>
```

### Border Width Options

| Use Case | Inset Value | Visual Effect |
|----------|-------------|---------------|
| Subtle | `inset-[2px]` | Thin accent border |
| Standard | `inset-[4px]` | Noticeable but not dominant |
| Portal-style | `inset-[6px]` | Bold, eye-catching |

## Customization Parameters

### Animation Speed
- Faster (3s): More energetic, draws attention
- Default (6s): Smooth, hypnotic flow
- Slower (10s): Subtle, ambient effect

```css
animation: shimmer 3s ease-in-out infinite;  /* faster */
animation: shimmer 10s ease-in-out infinite; /* slower */
```

### Gradient Angle
- `135deg`: Diagonal flow (default)
- `90deg`: Horizontal flow
- `180deg`: Vertical flow
- `45deg`: Opposite diagonal

### Color Saturation
More saturated colors = more vibrant shimmer:

```css
/* Muted/subtle */
#E8E0F0  /* very light lavender */

/* Balanced (current) */
#D4C4F8  /* soft lavender */

/* Vibrant */
#C4A8F8  /* richer lavender */
```

## Performance Notes

- CSS animations are GPU-accelerated
- No JavaScript required after initial render
- Minimal CPU overhead
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile-friendly

## Related Files

- `components/cards/PortalCard.tsx` - Original implementation
- `docs/PORTAL-SYSTEM.md` - Full Portal system documentation
- `app/dev/portal-preview/page.tsx` - Development preview page

## Color Reference by Content Type

| Type | Border Style | Primary Colors |
|------|--------------|----------------|
| Portal | Rainbow iridescent | White + pastel rainbow |
| Gen 1 Remix | Cool iridescent | White + blue/green |
| Gen 2+ Remix | Warm iridescent | White + red/orange |
| Original | Solid | Content-type color (no shimmer) |

## Future Considerations

- Add shimmer intensity prop (subtle vs bold)
- Consider reduced-motion media query for accessibility
- Potential WebGL version for more complex effects
- Badge overlay showing generation number
