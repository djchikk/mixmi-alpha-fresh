import React from 'react';

interface SimplifiedLicensingStepProps {
  formData: any;
  handleInputChange: (field: string, value: any) => void;
}

export default function SimplifiedLicensingStep({ formData, handleInputChange }: SimplifiedLicensingStepProps) {
  // Simplified licensing for alpha version - keep custom pricing but remove complex options
  if (formData.content_type === 'full_song') {
    // Songs: Download Only with custom pricing
    return (
      <div className="space-y-6">
        {/* Song Download Option */}
        <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">📥</div>
            <div className="flex-1">
              <div className="text-gray-300 font-medium mb-2">DOWNLOAD ONLY</div>
              <ul className="text-gray-400 text-sm space-y-1 ml-4">
                <li>• Personal listening</li>
                <li>• DJ sets and live performance</li>
                <li>• Playlist inclusion</li>
              </ul>
            </div>
          </div>
          
          {/* Download price for full songs */}
          <div className="mt-4 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Download price:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.download_price || 2.5}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    handleInputChange('download_price', price);
                    handleInputChange('price_stx', price);
                  }}
                  className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="2.5"
                  min="0"
                  step="0.1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
              <span className="text-gray-500 text-xs">(Default: 2.5 STX)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EPs: Show EP pricing similar to loop packs but for songs (download-only)
  if (formData.content_type === 'ep') {
    return (
      <div className="space-y-6">
        {/* EP Pricing & Settings */}
        <div className="bg-[#FFE4B5]/10 border border-[#FFE4B5]/30 rounded-lg p-4">
          <h4 className="text-[#FFE4B5] font-medium mb-4">🎤 EP Pricing & Settings</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Number of Songs</label>
              <div className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded-md text-white">
                <span className="text-green-400">✅ {formData.ep_files?.length || 0} songs uploaded</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-detected from uploaded files</p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Price Per Song</label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.price_per_song || 2.5}
                  onChange={(e) => {
                    const pricePerSong = parseFloat(e.target.value) || 0;
                    handleInputChange('price_per_song', pricePerSong);
                    // Calculate total EP price
                    const songCount = formData.ep_files?.length || 0;
                    const totalPrice = pricePerSong * songCount;
                    handleInputChange('price_stx', totalPrice);
                  }}
                  className="w-20 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="2.5"
                  min="0"
                  step="0.1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
            </div>
          </div>
          
          {/* EP price calculation */}
          <div className="bg-slate-800/50 p-3 rounded text-sm mb-4">
            <span className="text-gray-400">Total EP price: </span>
            <span className="text-[#81E4F2] font-medium text-lg">
              {((formData.price_per_song || 2.5) * (formData.ep_files?.length || 0)).toFixed(1)} STX
            </span>
            <span className="text-gray-500 ml-2">
              ({formData.ep_files?.length || 0} songs × {formData.price_per_song || 2.5} STX each)
            </span>
          </div>
        </div>

        {/* EP Total Price Display */}
        <div className="p-4 bg-[#FFE4B5]/10 rounded-lg border border-[#FFE4B5]/30">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">🎤</div>
            <div className="flex-1">
              <div className="text-gray-300 font-medium mb-2">EP TOTAL PRICE</div>
              <div className="text-lg text-[#81E4F2] font-medium">
                {((formData.price_per_song || 2.5) * (formData.ep_files?.length || 0)).toFixed(1)} STX
              </div>
              <div className="text-sm text-gray-400">
                {formData.ep_files?.length || 0} songs × {formData.price_per_song || 2.5} STX each
              </div>
              <p className="text-gray-500 text-xs mt-2">
                This is the total price for the entire EP. EPs are download-only:
              </p>
            </div>
          </div>
        </div>

        {/* EP Download-Only Licensing */}
        <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">📥</div>
            <div className="flex-1">
              <div className="text-gray-300 font-medium mb-2">EP DOWNLOAD ONLY</div>
              <ul className="text-gray-400 text-sm space-y-1 ml-4">
                <li>• Personal listening</li>
                <li>• DJ sets and live performance</li>
                <li>• Playlist inclusion</li>
              </ul>
              <p className="text-gray-600 text-xs mt-3">
                EPs are complete songs and are available for download only (no remix licensing)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loop Packs: Show pack pricing + same licensing options as individual loops
  if (formData.content_type === 'loop_pack') {
    return (
      <div className="space-y-6">
        {/* Loop Pack Pricing & Settings */}
        <div className="bg-[#9772F4]/10 border border-[#9772F4]/30 rounded-lg p-4">
          <h4 className="text-[#9772F4] font-medium mb-4">📦 Loop Pack Pricing & Settings</h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Number of Loops</label>
              <div className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded-md text-white">
                <span className="text-green-400">✅ {formData.loop_files?.length || 0} loops uploaded</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-detected from uploaded files</p>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Price Per Loop</label>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.price_per_loop || 0.5}
                  onChange={(e) => {
                    const pricePerLoop = parseFloat(e.target.value) || 0;
                    handleInputChange('price_per_loop', pricePerLoop);
                    // Calculate total pack price
                    const loopCount = formData.loops_per_pack || 3;
                    const totalPrice = pricePerLoop * loopCount;
                    handleInputChange('price_stx', totalPrice);
                  }}
                  className="w-20 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="0.5"
                  min="0"
                  step="0.1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
            </div>
          </div>
          
          {/* Pack price calculation */}
          <div className="bg-slate-800/50 p-3 rounded text-sm mb-4">
            <span className="text-gray-400">Total pack price: </span>
            <span className="text-[#81E4F2] font-medium text-lg">
              {((formData.price_per_loop || 0.5) * (formData.loop_files?.length || 0)).toFixed(1)} STX
            </span>
            <span className="text-gray-500 ml-2">
              ({formData.loop_files?.length || 0} loops × {formData.price_per_loop || 0.5} STX each)
            </span>
          </div>
        </div>

        {/* Loop Pack Licensing Options */}
        <div className="p-4 bg-[#9772F4]/10 rounded-lg border border-[#9772F4]/30">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-1">📦</div>
            <div className="flex-1">
              <div className="text-gray-300 font-medium mb-2">LOOP PACK TOTAL PRICE</div>
              <div className="text-lg text-[#81E4F2] font-medium">
                {((formData.price_per_loop || 0.5) * (formData.loop_files?.length || 0)).toFixed(1)} STX
              </div>
              <div className="text-sm text-gray-400">
                {formData.loop_files?.length || 0} loops × {formData.price_per_loop || 0.5} STX each
              </div>
              <p className="text-gray-500 text-xs mt-2">
                This is the total price for the entire pack. Choose licensing options below:
              </p>
            </div>
          </div>
        </div>

        {/* Loop Pack Licensing Options - Same as individual loops */}
        <div className="space-y-4">
          <h4 className="text-gray-300 font-medium">Loop Pack Licensing Options</h4>
          
          {/* Remix Only for Pack */}
          <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="license_type"
                value="platform_remix"
                checked={formData.license_selection === 'platform_remix'}
                onChange={() => {
                  handleInputChange('license_selection', 'platform_remix');
                  handleInputChange('allow_remixing', true);
                  handleInputChange('allow_downloads', false);
                }}
                className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-medium">PACK REMIX ONLY</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Most Common</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Buyers can remix all loops within MIXMI platform only</p>
                <p className="text-gray-600 text-xs mt-1">Perfect for: Building remix community with your pack</p>
              </div>
            </label>
          </div>

          {/* Remix + Download for Pack */}
          <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="license_type"
                value="platform_download"
                checked={formData.license_selection === 'platform_download'}
                onChange={() => {
                  handleInputChange('license_selection', 'platform_download');
                  handleInputChange('allow_remixing', true);
                  handleInputChange('allow_downloads', true);
                }}
                className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-medium">PACK REMIX + DOWNLOAD</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Premium</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Remix on platform + download all loops for external use</p>
                <p className="text-gray-600 text-xs mt-1">Perfect for: Producer packs, stems, sample collections</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }

  // Individual Loops: Platform Remix vs Platform Remix + Download
  return (
    <div className="space-y-6">
      {/* License Type Selection - Radio Buttons */}
      <div className="space-y-4">
      
      {/* Remix Only */}
      <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="license_type"
            value="platform_remix"
            checked={formData.license_selection === 'platform_remix'}
            onChange={() => {
              handleInputChange('license_selection', 'platform_remix');
              handleInputChange('allow_remixing', true);
              handleInputChange('allow_downloads', false);
              if (!formData.remix_price) {
                handleInputChange('remix_price', 0.5);
              }
            }}
            className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-medium">REMIX ONLY</span>
              <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Most Common</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Others can remix within MIXMI platform only</p>
            <p className="text-gray-600 text-xs mt-1">Perfect for: Building on-platform community</p>
          </div>
        </label>
        
        {/* Custom pricing for remix */}
        {formData.license_selection === 'platform_remix' && (
          <div className="ml-8 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Remix price:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.remix_price || 0.5}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    handleInputChange('remix_price', price);
                    handleInputChange('price_stx', price);
                  }}
                  className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="0.5"
                  min="0"
                  step="0.1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
              <span className="text-gray-500 text-xs">(Default: 0.5 STX, set 0 for free)</span>
            </div>
          </div>
        )}
      </div>

      {/* Remix + Download */}
      <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="license_type"
            value="platform_download"
            checked={formData.license_selection === 'platform_download'}
            onChange={() => {
              handleInputChange('license_selection', 'platform_download');
              handleInputChange('allow_remixing', true);
              handleInputChange('allow_downloads', true);
              if (!formData.combined_price) {
                handleInputChange('combined_price', 2.5);
              }
            }}
            className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2]"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-300 font-medium">REMIX + DOWNLOAD</span>
              <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Premium</span>
            </div>
            <p className="text-gray-500 text-sm mt-1">Includes remix rights AND download for external use</p>
            <p className="text-gray-600 text-xs mt-1">Perfect for: Sample packs, loops, stems</p>
          </div>
        </label>
        
        {/* Custom pricing for combined option */}
        {formData.license_selection === 'platform_download' && (
          <div className="ml-8 p-3 bg-slate-900/50 rounded">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">Combined price:</span>
              <div className="flex items-center">
                <input
                  type="number"
                  value={formData.combined_price || 2.5}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    handleInputChange('combined_price', price);
                    handleInputChange('price_stx', price);
                  }}
                  className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="2.5"
                  min="0"
                  step="0.1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
              <span className="text-gray-500 text-xs">(Default: 2.5 STX)</span>
            </div>
            <div className="text-xs text-gray-500 bg-slate-800/50 p-2 rounded mt-2">
              💡 Includes both remix rights + download access
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}