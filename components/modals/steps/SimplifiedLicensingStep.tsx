import React from 'react';
import { PRICING } from '@/config/pricing';

interface SimplifiedLicensingStepProps {
  formData: any;
  handleInputChange: (field: string, value: any) => void;
}

export default function SimplifiedLicensingStep({ formData, handleInputChange }: SimplifiedLicensingStepProps) {
  // Simplified licensing for alpha version - keep custom pricing but remove complex options
  if (formData.content_type === 'full_song') {
    // Songs: Platform Remix (default ON, can opt out) + Optional Downloads
    return (
      <div className="space-y-6">
        {/* Platform Remix - Default ON, can be unchecked to protect */}
        <div className={`${formData.remix_protected ? 'bg-amber-900/20 border-amber-700/30' : 'bg-[#81E4F2]/10 border-[#81E4F2]/30'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={!formData.remix_protected}
              onChange={(e) => {
                handleInputChange('remix_protected', !e.target.checked);
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW IN MIXER</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Recommended</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Your song can be used in the platform mixer for live mixing and recorded remixes.
                You earn <strong>${PRICING.mixer.loopRecording} USDC</strong> each time someone records a remix that includes an 8-bar section from your song.
              </p>

              {/* Protected message when unchecked */}
              {formData.remix_protected && (
                <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded mb-3">
                  <p className="text-amber-300 text-sm">
                    Your song won't be available for mixing. It can still appear on the globe with 20-second previews.
                  </p>
                </div>
              )}

              {/* Remix fee display - only when remix allowed */}
              {!formData.remix_protected && (
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Recording fee:</span>
                    <span className="text-[#81E4F2] font-bold text-lg">${PRICING.mixer.loopRecording} USDC</span>
                    <span className="text-gray-500 text-xs">per recorded remix</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Optional Download */}
        <div className="bg-[#A084F9]/10 border border-[#A084F9]/30 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.allow_downloads || false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleInputChange('allow_downloads', checked);
                handleInputChange('license_type', checked ? 'streaming_download' : 'streaming_only');
                if (checked && !formData.download_price_stx) {
                  handleInputChange('download_price_stx', 2);
                } else if (!checked) {
                  handleInputChange('download_price_stx', null);
                }
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW DOWNLOADS</span>
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Optional</span>
              </div>
              <p className="text-gray-400 text-sm">Allow users to download for offline/DJ use</p>
            </div>
          </div>

          {/* Download pricing - only show if enabled */}
          {formData.allow_downloads && (
            <div className="ml-8 space-y-3">
              <div className="p-3 bg-slate-900/50 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">Download price:</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={formData.download_price_stx || 2}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        handleInputChange('download_price_stx', price);
                        handleInputChange('price_stx', price);
                      }}
                      className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                      placeholder="2"
                      min="0"
                      step="0.01"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">USDC</span>
                  </div>
                </div>
              </div>

              {/* License terms for downloads */}
              <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 text-sm">📋</span>
                  <div>
                    <div className="text-blue-300 text-xs font-medium mb-1">Download License</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Personal listening, DJ sets, live performance, and playlist inclusion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show message when downloads are disabled */}
          {!formData.allow_downloads && (
            <div className="ml-8 text-gray-500 text-sm italic">
              Enable downloads to set custom download pricing
            </div>
          )}
        </div>

        {/* Streaming Option - separate from mixer and downloads */}
        <div className={`${formData.allow_streaming ? 'bg-green-900/20 border-green-700/30' : 'bg-slate-800/30 border-slate-700'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={formData.allow_streaming !== false}
              onChange={(e) => {
                handleInputChange('allow_streaming', e.target.checked);
              }}
              className="w-5 h-5 mt-0.5 text-green-500 bg-slate-800 border-slate-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW STREAMING</span>
                <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded">Coming Soon</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Right now: 20-second previews play in the playlist widget.
                When streaming launches, full plays earn ~$0.08 USDC each (9-12x better than Spotify).
              </p>

              {formData.allow_streaming !== false && (
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-gray-400 text-xs">You'll automatically start earning when streaming goes live</span>
                  </div>
                </div>
              )}

              {formData.allow_streaming === false && (
                <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded">
                  <p className="text-amber-300 text-xs">
                    Preview-only mode: 20-second clips will play but you won't earn from full streams.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EPs: Platform Remix (default ON, can opt out) + Optional Downloads per song
  if (formData.content_type === 'ep') {
    // Use ep_files length for new uploads, or ep_song_count for editing existing EPs
    const songCount = formData.ep_files?.length || formData.ep_song_count || 0;
    const downloadPricePerSong = formData.price_per_song || 2;
    const totalEPPrice = (downloadPricePerSong * songCount).toFixed(1);

    return (
      <div className="space-y-6">
        {/* Platform Remix - Default ON, can be unchecked to protect */}
        <div className={`${formData.remix_protected ? 'bg-amber-900/20 border-amber-700/30' : 'bg-[#81E4F2]/10 border-[#81E4F2]/30'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={!formData.remix_protected}
              onChange={(e) => {
                handleInputChange('remix_protected', !e.target.checked);
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW IN MIXER</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Recommended</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Songs in your EP can be used in the platform mixer for live mixing and recorded remixes.
                You earn <strong>${PRICING.mixer.loopRecording} USDC</strong> per song each time someone records a remix that includes an 8-bar section from a song in your EP.
              </p>

              {/* Protected message when unchecked */}
              {formData.remix_protected && (
                <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded mb-3">
                  <p className="text-amber-300 text-sm">
                    Your EP won't be available for mixing. Songs can still appear on the globe with 20-second previews.
                  </p>
                </div>
              )}

              {/* Remix fee display - only when remix allowed */}
              {!formData.remix_protected && (
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Recording fee:</span>
                    <span className="text-[#81E4F2] font-bold text-lg">${PRICING.mixer.loopRecording} USDC</span>
                    <span className="text-gray-500 text-xs">per song per recorded remix</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Optional EP Downloads */}
        <div className="bg-[#A084F9]/10 border border-[#A084F9]/30 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.allow_downloads || false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleInputChange('allow_downloads', checked);
                handleInputChange('license_type', checked ? 'streaming_download' : 'streaming_only');
                if (checked && !formData.price_per_song) {
                  // Set default price_per_song when enabling downloads
                  handleInputChange('price_per_song', 2);
                  handleInputChange('download_price_stx', 2 * songCount);
                } else if (!checked) {
                  handleInputChange('download_price_stx', null);
                }
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW EP DOWNLOADS</span>
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Optional</span>
              </div>
              <p className="text-gray-400 text-sm">Allow users to download all songs for offline/DJ use</p>
            </div>
          </div>

          {/* Download pricing - only show if enabled */}
          {formData.allow_downloads && (
            <div className="ml-8 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Songs in EP</label>
                  <div className="py-2 px-3 bg-slate-800 border border-slate-600 rounded text-green-400 text-sm">
                    ✅ {songCount} songs
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price Per Song</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={downloadPricePerSong}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        handleInputChange('price_per_song', price);
                        handleInputChange('download_price_stx', price * songCount);
                        handleInputChange('price_stx', price * songCount);
                      }}
                      className="w-20 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                      placeholder="2"
                      min="0"
                      step="0.01"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">USDC</span>
                  </div>
                </div>
              </div>

              {/* Total EP download price */}
              <div className="bg-slate-900/50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total EP Price:</span>
                  <div className="text-right">
                    <div className="text-[#81E4F2] font-bold text-xl">${totalEPPrice} USDC</div>
                    <div className="text-gray-500 text-xs">{songCount} songs × ${downloadPricePerSong} USDC</div>
                  </div>
                </div>
              </div>

              {/* License terms for downloads */}
              <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 text-sm">📋</span>
                  <div>
                    <div className="text-blue-300 text-xs font-medium mb-1">Download License</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Personal listening, DJ sets, live performance, and playlist inclusion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show message when downloads are disabled */}
          {!formData.allow_downloads && (
            <div className="ml-8 text-gray-500 text-sm italic">
              Enable downloads to set EP pricing
            </div>
          )}
        </div>

        {/* Streaming Option - separate from mixer and downloads */}
        <div className={`${formData.allow_streaming ? 'bg-green-900/20 border-green-700/30' : 'bg-slate-800/30 border-slate-700'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={formData.allow_streaming !== false}
              onChange={(e) => {
                handleInputChange('allow_streaming', e.target.checked);
              }}
              className="w-5 h-5 mt-0.5 text-green-500 bg-slate-800 border-slate-600 focus:ring-green-500"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW STREAMING</span>
                <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded">Coming Soon</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">
                Right now: 20-second previews play in the playlist widget.
                When streaming launches, full plays earn ~$0.08 USDC per song (9-12x better than Spotify).
              </p>

              {formData.allow_streaming !== false && (
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-gray-400 text-xs">You'll automatically start earning when streaming goes live</span>
                  </div>
                </div>
              )}

              {formData.allow_streaming === false && (
                <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded">
                  <p className="text-amber-300 text-xs">
                    Preview-only mode: 20-second clips will play but you won't earn from full streams.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loop Packs: Platform Remix (default ON, can opt out) + Optional Downloads
  if (formData.content_type === 'loop_pack') {
    const loopCount = formData.loop_files?.length || formData.loop_count || 0;
    const downloadPricePerLoop = formData.price_per_loop || 1;
    const totalPackPrice = (downloadPricePerLoop * loopCount).toFixed(1);

    return (
      <div className="space-y-6">
        {/* Platform Remix - Default ON, can be unchecked to protect */}
        <div className={`${formData.remix_protected ? 'bg-amber-900/20 border-amber-700/30' : 'bg-[#81E4F2]/10 border-[#81E4F2]/30'} border rounded-lg p-4`}>
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={!formData.remix_protected}
              onChange={(e) => {
                handleInputChange('remix_protected', !e.target.checked);
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">PLATFORM REMIX</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Recommended</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">You earn ${PRICING.mixer.loopRecording} USDC each time someone records a remix using a loop from this pack</p>

              {/* Protected message when unchecked */}
              {formData.remix_protected && (
                <div className="bg-amber-900/30 border border-amber-700/50 p-3 rounded mb-3">
                  <p className="text-amber-300 text-sm">
                    Your loops will be available for streaming and download only - not for mixing with other content.
                  </p>
                </div>
              )}

              {/* Remix fee prominently displayed - only when remix allowed */}
              {!formData.remix_protected && (
                <div className="bg-slate-900/50 p-3 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">Recording fee:</span>
                    <span className="text-[#81E4F2] font-bold text-lg">${PRICING.mixer.loopRecording} USDC</span>
                    <span className="text-gray-500 text-xs">per loop</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download Pricing - Optional */}
        <div className="bg-[#A084F9]/10 border border-[#A084F9]/30 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.allow_downloads || false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleInputChange('allow_downloads', checked);
                handleInputChange('license_type', checked ? 'remix_external' : 'remix_only');
                if (checked && !formData.price_per_loop) {
                  // Set default price_per_loop when enabling downloads
                  handleInputChange('price_per_loop', 1);
                  handleInputChange('download_price_stx', 1 * loopCount);
                } else if (!checked) {
                  handleInputChange('download_price_stx', null);
                }
                handleInputChange('remix_price_stx', 1.0);
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">ALLOW PACK DOWNLOADS</span>
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Optional</span>
              </div>
              <p className="text-gray-400 text-sm">Let buyers download all loops for external use (DAWs, production)</p>
            </div>
          </div>

          {/* Download pricing section - only show if downloads enabled */}
          {formData.allow_downloads && (
            <div className="ml-8 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Loops in Pack</label>
                  <div className="py-2 px-3 bg-slate-800 border border-slate-600 rounded text-green-400 text-sm">
                    ✅ {loopCount} loops
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Price Per Loop</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={downloadPricePerLoop}
                      onChange={(e) => {
                        const price = parseFloat(e.target.value) || 0;
                        handleInputChange('price_per_loop', price);
                        handleInputChange('download_price_stx', price * loopCount);
                        handleInputChange('price_stx', price * loopCount);
                      }}
                      className="w-20 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                      placeholder="1"
                      min="0"
                      step="0.01"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">USDC</span>
                  </div>
                </div>
              </div>

              {/* Total pack download price */}
              <div className="bg-slate-900/50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total Pack Price:</span>
                  <div className="text-right">
                    <div className="text-[#81E4F2] font-bold text-xl">${totalPackPrice} USDC</div>
                    <div className="text-gray-500 text-xs">{loopCount} loops × ${downloadPricePerLoop} USDC</div>
                  </div>
                </div>
              </div>

              {/* License terms for downloads */}
              <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 text-sm">📋</span>
                  <div>
                    <div className="text-blue-300 text-xs font-medium mb-1">Tracked Commercial License</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Buyers may use loops commercially and agree to report releases using samples from this pack.
                      This supports ongoing fair compensation for creators.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show message when downloads are disabled */}
          {!formData.allow_downloads && (
            <div className="ml-8 text-gray-500 text-sm italic">
              Enable downloads to set pack pricing
            </div>
          )}
        </div>
      </div>
    );
  }

  // Video Clips: Platform Remix (always on) + Optional Download
  if (formData.content_type === 'video_clip') {
    return (
      <div className="space-y-6">
        {/* License Type Selection - Checkboxes (not radio!) */}
        <div className="space-y-4">

        {/* Platform Remix - Always checked, default USDC recording fee */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={true}
              disabled={true}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2] opacity-100"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">PLATFORM REMIX</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Required</span>
              </div>
              <p className="text-gray-400 text-sm mt-1">You earn ${PRICING.mixer.loopRecording} USDC each time someone records a mix using this clip</p>
            </div>
          </label>

          {/* Fixed remix price display */}
          <div className="ml-8 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Recording fee:</span>
              <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-[#81E4F2] font-medium text-sm">
                ${PRICING.mixer.loopRecording} USDC
              </div>
            </div>
          </div>
        </div>

        {/* Optional Download - Checkbox with custom price */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.allow_downloads || false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleInputChange('allow_downloads', checked);
                handleInputChange('license_type', checked ? 'remix_external' : 'remix_only');
                if (checked && !formData.download_price_stx) {
                  handleInputChange('download_price_stx', 1);
                } else if (!checked) {
                  handleInputChange('download_price_stx', null);
                }
                // Always set remix price to USDC recording fee
                handleInputChange('remix_price_stx', 1.0);
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">ALLOW DOWNLOADS</span>
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Optional</span>
              </div>
              <p className="text-gray-400 text-sm mt-1">Let people download this clip for external use (DAWs, production)</p>
            </div>
          </label>

          {/* Custom pricing for downloads */}
          {formData.allow_downloads && (
            <div className="ml-8 p-3 bg-slate-900/50 rounded">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Download price:</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={formData.download_price_stx || 1}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0;
                      handleInputChange('download_price_stx', price);
                    }}
                    className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                    placeholder="1"
                    min="0"
                    step="0.01"
                  />
                  <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">USDC</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-slate-800/50 p-2 rounded mt-2">
                💡 This is separate from the ${PRICING.mixer.loopRecording} USDC mix fee. Download price is what people pay to get the video file.
              </div>

              {/* License terms for downloads */}
              <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded mt-3">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 text-sm">📋</span>
                  <div>
                    <div className="text-blue-300 text-xs font-medium mb-1">Tracked Commercial License</div>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Buyers may use this clip commercially and agree to report releases using this clip.
                      This supports ongoing fair compensation for creators.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  // Individual Loops: Platform Remix (default ON, can opt out) + Optional Download
  return (
    <div className="space-y-6">
      {/* License Type Selection - Checkboxes (not radio!) */}
      <div className="space-y-4">

      {/* Platform Remix - Default ON, can be unchecked to protect */}
      <div className={`space-y-3 p-4 rounded-lg border ${formData.remix_protected ? 'bg-amber-900/20 border-amber-700/30' : 'bg-slate-800/30 border-slate-700'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!formData.remix_protected}
            onChange={(e) => {
              handleInputChange('remix_protected', !e.target.checked);
            }}
            className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-medium">PLATFORM REMIX</span>
              <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Recommended</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">You earn ${PRICING.mixer.loopRecording} USDC each time someone records a remix using this loop</p>
          </div>
        </label>

        {/* Protected message when unchecked */}
        {formData.remix_protected && (
          <div className="ml-8 bg-amber-900/30 border border-amber-700/50 p-3 rounded">
            <p className="text-amber-300 text-sm">
              Your loop will be available for streaming and download only - not for mixing with other content.
            </p>
          </div>
        )}

        {/* Fixed remix price display - only when remix allowed */}
        {!formData.remix_protected && (
          <div className="ml-8 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Recording fee:</span>
              <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-[#81E4F2] font-medium text-sm">
                ${PRICING.mixer.loopRecording} USDC
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Optional Download - Checkbox with custom price */}
      <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.allow_downloads || false}
            onChange={(e) => {
              const checked = e.target.checked;
              handleInputChange('allow_downloads', checked);
              handleInputChange('license_type', checked ? 'remix_external' : 'remix_only');
              if (checked && !formData.download_price_stx) {
                handleInputChange('download_price_stx', 1);
              } else if (!checked) {
                handleInputChange('download_price_stx', null);
              }
              // Always set remix price to USDC recording fee
              handleInputChange('remix_price_stx', 1.0);
            }}
            className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-medium">ALLOW DOWNLOADS</span>
              <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Optional</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">Let people download this loop for external use (DAWs, production)</p>
          </div>
        </label>

        {/* Custom pricing for downloads */}
        {formData.allow_downloads && (
          <div className="ml-8 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Download price:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.download_price_stx || 1}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    handleInputChange('download_price_stx', price);
                  }}
                  className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="1"
                  min="0"
                  step="0.01"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">USDC</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-slate-800/50 p-2 rounded mt-2">
              💡 This is separate from the ${PRICING.mixer.loopRecording} USDC remix fee. Download price is what people pay to get the audio file.
            </div>

            {/* License terms for downloads */}
            <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded mt-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 text-sm">📋</span>
                <div>
                  <div className="text-blue-300 text-xs font-medium mb-1">Tracked Commercial License</div>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Buyers may use this loop commercially and agree to report releases using this sample.
                    This supports ongoing fair compensation for creators.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}