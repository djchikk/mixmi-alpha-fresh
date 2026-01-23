"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import SafeImage from '../shared/SafeImage';

interface StoreCardProps {
  storeCard?: {
    title?: string;
    description?: string;
    image?: string;
  };
  targetWallet?: string;
  isOwnProfile?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function StoreCard({ storeCard, targetWallet, isOwnProfile, onEdit, onDelete }: StoreCardProps) {
  const { isAuthenticated, walletAddress, suiAddress, activePersona } = useAuth();
  // Priority: active persona's wallet > persona's SUI > account SUI > account STX
  const effectiveWallet = activePersona?.sui_address || activePersona?.wallet_address || suiAddress || walletAddress;
  const [trackCount, setTrackCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  // Fetch track count, username, and profile image from Supabase
  useEffect(() => {
    const fetchStoreData = async () => {
      const wallet = targetWallet || effectiveWallet;
      if (!wallet) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch track count
        const { count, error: countError } = await supabase
          .from('ip_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', wallet)
          .is('deleted_at', null); // Exclude soft-deleted tracks

        if (countError) {
          console.error('Error fetching track count:', countError);
          setTrackCount(0);
        } else {
          setTrackCount(count || 0);
        }

        // Fetch username from user_profiles
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('wallet_address', wallet)
          .single();

        if (!profileError && profileData) {
          if (profileData.username) {
            setUsername(profileData.username);
          }
        }
      } catch (error) {
        console.error('Failed to fetch track count:', error);
        setTrackCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStoreData();
  }, [targetWallet, effectiveWallet]);

  const handleCardClick = () => {
    const wallet = targetWallet || effectiveWallet;
    if (!wallet) return;

    // Navigate to store using username if available, otherwise wallet address
    const storeUrl = username ? `/store/${username}` : `/store/${wallet}`;
    router.push(storeUrl);
  };
  
  // Use store card data from context or fallback to defaults
  console.log('🃏 StoreCard received props:', { storeCard, targetWallet, isOwnProfile });
  const cardTitle = storeCard?.title || "My Creator Store";
  const cardDescription = storeCard?.description || "Browse my tracks and loops";
  const cardImage = storeCard?.image;
  console.log('🃏 StoreCard resolved values:', { cardTitle, cardDescription, cardImage });

  return (
    <div 
      className={`relative w-72 aspect-square rounded-lg overflow-hidden border-2 border-gray-700 hover:border-accent hover:border-[3px] transition-all group cursor-pointer bg-slate-800`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Image or default background */}
      {cardImage ? (
        <div className="relative w-full h-full">
          <SafeImage 
            src={cardImage} 
            alt={cardTitle} 
            fill 
            className="object-cover transition-opacity duration-200"
            sizes="320px"
            priority={false}
            onError={() => console.warn('Failed to load store image:', cardImage)}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4 border border-accent/20">
              <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm">Store</p>
          </div>
        </div>
      )}
      
      {/* Bottom gradient with title/description - matching ShopCard style */}
      <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/95 to-slate-900/0 transition-opacity duration-300`}>
        <div className="flex items-start justify-between">
          <div className="border-l-2 border-accent pl-2 flex-1">
            <h3 className="text-white font-medium text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
              {cardTitle}
              {!isLoading && trackCount > 0 && (
                <span className="text-accent text-xs ml-2">({trackCount} tracks)</span>
              )}
            </h3>
            {isHovered && (
              <p className="text-gray-200 text-xs mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {cardDescription}
              </p>
            )}
          </div>
          {/* mixmi logo - subtle branding for store card */}
          <div className="ml-3 flex items-center opacity-80 hover:opacity-100 transition-opacity">
            <img
              src="/logos/mixmi-logotype-240x64.png"
              alt="mixmi"
              className="h-4 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Edit/Delete Controls */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="bg-slate-800/70 p-1 rounded-full hover:bg-slate-700/80"
              aria-label="Edit Store Card"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-accent"
              >
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="bg-slate-800/70 p-1 rounded-full hover:bg-slate-700/80"
              aria-label="Hide Store Card"
              title="Hide Store Card"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            </button>
          )}
        </div>
      )}

    </div>
  );
}