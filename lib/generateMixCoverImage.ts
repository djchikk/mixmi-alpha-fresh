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
      
      // Draw 2x2 grid layout
      // Top left: Deck A (200x200)
      ctx.drawImage(deckAImage, 0, 0, deckAImage.width, deckAImage.height, 0, 0, 200, 200);
      
      // Top right: Deck B (200x200)
      ctx.drawImage(deckBImage, 0, 0, deckBImage.width, deckBImage.height, 200, 0, 200, 200);
      
      // Bottom left: Profile image or placeholder (200x200)
      if (profileImage) {
        ctx.drawImage(profileImage, 0, 0, profileImage.width, profileImage.height, 0, 200, 200, 200);
      } else {
        // Placeholder for profile - gradient with icon
        const gradient = ctx.createLinearGradient(0, 200, 200, 400);
        gradient.addColorStop(0, '#1E293B');
        gradient.addColorStop(1, '#0F172A');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 200, 200, 200);
        
        // Add user icon placeholder
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '60px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👤', 100, 300);
      }
      
      // Bottom right: Mixmi branding
      ctx.fillStyle = 'rgba(129, 228, 242, 0.1)';
      ctx.fillRect(200, 200, 200, 200);
      
      // Add Mixmi text
      ctx.fillStyle = 'rgba(129, 228, 242, 0.5)';
      ctx.font = 'bold 32px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('mixmi', 300, 300);
      
      // Add subtle grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      // Vertical center line
      ctx.beginPath();
      ctx.moveTo(200, 0);
      ctx.lineTo(200, 400);
      ctx.stroke();
      
      // Horizontal center line
      ctx.beginPath();
      ctx.moveTo(0, 200);
      ctx.lineTo(400, 200);
      ctx.stroke();
      
      // Add subtle gradient overlay for cohesion
      const overlayGradient = ctx.createRadialGradient(200, 200, 0, 200, 200, 300);
      overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, 400, 400);
      
      // Add "REMIX" badge
      ctx.fillStyle = 'rgba(129, 228, 242, 0.9)';
      ctx.fillRect(150, 20, 100, 30);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('REMIX', 200, 35);
      
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