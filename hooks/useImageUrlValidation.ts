import { useState, useCallback } from 'react';

interface ValidationResult {
  isValid: boolean;
  state: 'valid' | 'invalid' | 'warning';
  message: string;
}

interface UseImageUrlValidationProps {
  onImageChange: (imageData: string) => void;
  onPreviewChange: (preview: string | null) => void;
}

interface UseImageUrlValidationReturn {
  imageUrl: string;
  urlValidationState: 'idle' | 'validating' | 'valid' | 'invalid' | 'warning';
  urlFeedback: string;
  setImageUrl: React.Dispatch<React.SetStateAction<string>>;
  setUrlValidationState: React.Dispatch<React.SetStateAction<'idle' | 'validating' | 'valid' | 'invalid' | 'warning'>>;
  setUrlFeedback: React.Dispatch<React.SetStateAction<string>>;
  handleUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  validateImageUrl: (url: string) => Promise<ValidationResult>;
  testImageUrl: (url: string) => Promise<boolean>;
  resetUrlState: () => void;
}

export function useImageUrlValidation({
  onImageChange,
  onPreviewChange
}: UseImageUrlValidationProps): UseImageUrlValidationReturn {
  const [imageUrl, setImageUrl] = useState('');
  const [urlValidationState, setUrlValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'warning'>('idle');
  const [urlFeedback, setUrlFeedback] = useState<string>('');

  // Test if URL actually loads an image
  const testImageUrl = useCallback((url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      // Timeout after 5 seconds
      setTimeout(() => resolve(false), 5000);
    });
  }, []);

  // Comprehensive URL validation with user-friendly feedback
  const validateImageUrl = useCallback(async (url: string): Promise<ValidationResult> => {
    if (!url.trim()) {
      return { isValid: false, state: 'invalid', message: '' };
    }
    
    try {
      // Basic URL validation
      const urlObj = new URL(url);
      
      // Check protocol
      const validProtocols = ['http:', 'https:'];
      if (!validProtocols.includes(urlObj.protocol)) {
        return {
          isValid: false, 
          state: 'invalid', 
          message: "URL must start with http:// or https://"
        };
      }
      
      // Check for direct image extensions
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i;
      const hasImageExtension = imageExtensions.test(urlObj.pathname);
      
      // Check for known image services (including modern parameterized URLs)
      const imageServices = [
        // Traditional image hosts
        'imgur.com', 'i.imgur.com',
        'cloudinary.com', 'res.cloudinary.com',
        'unsplash.com', 'images.unsplash.com',
        'pexels.com', 'images.pexels.com',
        'pixabay.com', 'cdn.pixabay.com',
        'wikimedia.org', 'upload.wikimedia.org',
        'amazonaws.com', 's3.amazonaws.com',
        'githubusercontent.com',
        
        // Google's image services (public CDNs only)
        'googleusercontent.com', 
        'lh3.googleusercontent.com',
        'lh4.googleusercontent.com',
        'lh5.googleusercontent.com',
        'lh6.googleusercontent.com',
        
        // Other modern services
        'cdn.shopify.com',
        'images.squarespace-cdn.com',
        'static.wixstatic.com',
        'weebly.com',
        'jimdo.com'
      ];
      const isImageService = imageServices.some(service => urlObj.hostname.includes(service));
      
      // Check for suspicious non-image sites
      const nonImageSites = [
        'discogs.com', 'facebook.com', 'instagram.com', 
        'twitter.com', 'linkedin.com', 'youtube.com',
        'spotify.com', 'soundcloud.com', 'bandcamp.com'
      ];
      const isNonImageSite = nonImageSites.some(site => urlObj.hostname.includes(site));
      
      if (isNonImageSite) {
        return {
          isValid: false,
          state: 'invalid',
          message: `${urlObj.hostname} is not an image hosting service. Please use a direct image URL.`
        };
      }
      
      // Special handling for Google Drive sharing URLs
      if (urlObj.hostname.includes('drive.google.com') && urlObj.pathname.includes('/file/d/')) {
        return {
          isValid: false,
          state: 'invalid',
          message: 'Google Drive sharing URLs don\'t work directly. Try uploading the image file instead.'
        };
      }
      
      // Special handling for authenticated Google Photos URLs
      if (urlObj.hostname.includes('photos.fife.usercontent.google.com') && urlObj.search.includes('authuser=')) {
        return {
          isValid: false,
          state: 'invalid',
          message: 'This Google Photos URL requires authentication and cannot be used directly. Try downloading the image and uploading it as a file instead.'
        };
      }
      
      if (hasImageExtension) {
        return {
          isValid: true,
          state: 'valid',
          message: 'Valid image URL detected'
        };
      }
      
      if (isImageService) {
        // Check if it's a highly trusted image service (Google, major CDNs)
        const trustedServices = [
          'googleusercontent.com',
          'lh3.googleusercontent.com',
          'lh4.googleusercontent.com',
          'lh5.googleusercontent.com',
          'lh6.googleusercontent.com',
          'i.imgur.com',
          'res.cloudinary.com',
          'images.unsplash.com'
        ];
        
        const isTrustedService = trustedServices.some(service => urlObj.hostname.includes(service));
        
        if (isTrustedService) {
          return {
            isValid: true,
            state: 'valid',
            message: 'Trusted image service detected'
          };
        } else {
          return {
            isValid: true,
            state: 'warning',
            message: 'Image service detected - will test if image loads'
          };
        }
      }
      
      // For other URLs, show warning
      return {
        isValid: true,
        state: 'warning',
        message: 'URL may not be an image - will test loading'
      };
      
    } catch (urlError) {
      return {
        isValid: false,
        state: 'invalid',
        message: "Please enter a valid URL (example: https://example.com/image.jpg)"
      };
    }
  }, []);

  // Real-time URL validation as user types
  const handleUrlChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setImageUrl(url);
    
    if (url.length === 0) {
      setUrlValidationState('idle');
      setUrlFeedback('');
      onPreviewChange(null);
      onImageChange("");
      return;
    }
    
    // Show validating state
    setUrlValidationState('validating');
    setUrlFeedback('Checking URL...');
    
    try {
      // Validate URL format and type
      const validation = await validateImageUrl(url);
      
      if (!validation.isValid) {
        setUrlValidationState('invalid');
        setUrlFeedback(validation.message);
        onPreviewChange(null);
        onImageChange("");
        return;
      }
      
      // If validation passed, test if image actually loads
      if (validation.state === 'warning') {
        setUrlValidationState('validating');
        setUrlFeedback('Testing if image loads...');
        
        const imageLoads = await testImageUrl(url);
        if (imageLoads) {
          setUrlValidationState('valid');
          setUrlFeedback('Image loads successfully!');
          onPreviewChange(url);
          onImageChange(url);
        } else {
          setUrlValidationState('invalid');
          setUrlFeedback('URL does not load an image. Please check the link or try a different image.');
          onPreviewChange(null);
          onImageChange("");
        }
      } else {
        // Direct image URL, set as valid immediately
        setUrlValidationState('valid');
        setUrlFeedback(validation.message);
        onPreviewChange(url);
        onImageChange(url);
      }
      
    } catch (error) {
      console.error("Error in URL validation:", error);
      setUrlValidationState('invalid');
      setUrlFeedback("Error validating URL");
      onPreviewChange(null);
      onImageChange("");
    }
  }, [validateImageUrl, testImageUrl, onImageChange, onPreviewChange]);

  const resetUrlState = useCallback(() => {
    setImageUrl('');
    setUrlValidationState('idle');
    setUrlFeedback('');
  }, []);

  return {
    imageUrl,
    urlValidationState,
    urlFeedback,
    setImageUrl,
    setUrlValidationState,
    setUrlFeedback,
    handleUrlChange,
    validateImageUrl,
    testImageUrl,
    resetUrlState
  };
}