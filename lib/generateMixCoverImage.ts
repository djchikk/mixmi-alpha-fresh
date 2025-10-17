export async function generateMixCoverImage(
  deckAImageUrl: string,
  deckBImageUrl: string,
  profileImageUrl?: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    let imagesLoaded = 0;
    const totalImages = profileImageUrl ? 3 : 2;
    
    // Load all images
    const deckAImage = new Image();
    const deckBImage = new Image();
    const profileImage = profileImageUrl ? new Image() : null;
    
    // Configure CORS for images
    deckAImage.crossOrigin = 'anonymous';
    deckBImage.crossOrigin = 'anonymous';
    if (profileImage) {
      profileImage.crossOrigin = 'anonymous';
    }

    const checkAllLoaded = () => {
      imagesLoaded++;
      if (imagesLoaded === totalImages) {
        drawComposite();
      }
    };

    const drawComposite = () => {
      // Fill background with app color first
      ctx.fillStyle = '#0F172A'; // App background color
      ctx.fillRect(0, 0, 400, 400);

      // Draw the two track covers side by side at the top
      // Left: Deck A (200x200)
      ctx.drawImage(deckAImage, 0, 0, deckAImage.width, deckAImage.height, 0, 0, 200, 200);

      // Right: Deck B (200x200)
      ctx.drawImage(deckBImage, 0, 0, deckBImage.width, deckBImage.height, 200, 0, 200, 200);

      // Bottom section: gradient background
      const gradient = ctx.createLinearGradient(0, 200, 0, 400);
      gradient.addColorStop(0, '#1E293B');
      gradient.addColorStop(1, '#0F172A');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 200, 400, 200);

      // Add Mixmi branding in bottom section
      ctx.fillStyle = 'rgba(129, 228, 242, 0.5)';
      ctx.font = 'bold 32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('mixmi', 200, 300);

      // Add subtle gradient overlay for cohesion
      const overlayGradient = ctx.createRadialGradient(200, 200, 0, 200, 200, 300);
      overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, 400, 400);

      // Add centered, overlapping remixer profile image (replaces REMIX badge)
      if (profileImage) {
        const profileSize = 80;
        const profileX = 200 - (profileSize / 2); // Center horizontally
        const profileY = 100 - (profileSize / 2); // Center vertically on the dividing line between images

        // Draw shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 5;

        // Draw rounded square background (white border)
        ctx.fillStyle = 'white';
        const borderRadius = 12;
        ctx.beginPath();
        ctx.roundRect(profileX - 3, profileY - 3, profileSize + 6, profileSize + 6, borderRadius);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Clip to rounded square for profile image
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(profileX, profileY, profileSize, profileSize, borderRadius);
        ctx.clip();

        // Draw profile image
        ctx.drawImage(profileImage, 0, 0, profileImage.width, profileImage.height, profileX, profileY, profileSize, profileSize);

        ctx.restore();
      } else {
        // Fallback: Show REMIX badge if no profile image
        ctx.fillStyle = 'rgba(129, 228, 242, 0.9)';
        ctx.fillRect(150, 80, 100, 40);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('REMIX', 200, 100);
      }

      // Add subtle Mixmi branding
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText('mixmi', 390, 390);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      }, 'image/jpeg', 0.9);
    };

    // Handle loading errors
    const handleError = (error: Event) => {
      reject(new Error('Failed to load image'));
    };

    // Set up event listeners
    deckAImage.onload = checkAllLoaded;
    deckBImage.onload = checkAllLoaded;
    deckAImage.onerror = handleError;
    deckBImage.onerror = handleError;
    
    if (profileImage) {
      profileImage.onload = checkAllLoaded;
      profileImage.onerror = handleError;
    }

    // Start loading images
    deckAImage.src = deckAImageUrl;
    deckBImage.src = deckBImageUrl;
    if (profileImage && profileImageUrl) {
      profileImage.src = profileImageUrl;
    }
  });
}