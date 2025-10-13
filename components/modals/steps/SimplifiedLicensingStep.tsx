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
                  value={formData.download_price || 2}
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    handleInputChange('download_price', price);
                    handleInputChange('price_stx', price);
                  }}
                  className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                  placeholder="2"
                  min="0"
                  step="1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EPs: Show EP pricing similar to loop packs but for songs (download-only)
  if (formData.content_type === 'ep') {
    const songCount = formData.ep_files?.length || 0;
    const pricePerSong = formData.price_per_song || 2;
    const totalEPPrice = (pricePerSong * songCount).toFixed(1);

    return (
      <div className="space-y-6">
        {/* EP Pricing & Download Info Combined */}
        <div className="bg-[#FFE4B5]/10 border border-[#FFE4B5]/30 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="text-2xl mt-1">🎤</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">EP DOWNLOAD ONLY</span>
              </div>
              <p className="text-gray-400 text-sm mb-1">Complete songs available for download (no remix licensing)</p>
              <ul className="text-gray-500 text-xs space-y-0.5 ml-4">
                <li>• Personal listening & playlist inclusion</li>
                <li>• DJ sets and live performance</li>
              </ul>
            </div>
          </div>

          {/* EP Pricing Section */}
          <div className="space-y-3">
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
                    value={pricePerSong}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0;
                      handleInputChange('price_per_song', price);
                      handleInputChange('price_stx', price * songCount);
                    }}
                    className="w-20 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
                    placeholder="2"
                    min="0"
                    step="1"
                  />
                  <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                </div>
              </div>
            </div>

            {/* Total EP Price */}
            <div className="bg-slate-900/50 p-3 rounded">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Total EP Price:</span>
                <div className="text-right">
                  <div className="text-[#81E4F2] font-bold text-xl">{totalEPPrice} STX</div>
                  <div className="text-gray-500 text-xs">{songCount} songs × {pricePerSong} STX</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loop Packs: Show pack pricing + same licensing options as individual loops
  if (formData.content_type === 'loop_pack') {
    const loopCount = formData.loop_files?.length || 0;
    const downloadPricePerLoop = formData.price_per_loop || 1;
    const totalPackPrice = (downloadPricePerLoop * loopCount).toFixed(1);

    return (
      <div className="space-y-6">
        {/* Remix Pricing - Always Required */}
        <div className="bg-[#81E4F2]/10 border border-[#81E4F2]/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={true}
              disabled={true}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] bg-slate-800 border-slate-600 focus:ring-[#81E4F2] opacity-100"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 font-medium">PLATFORM REMIX</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Required</span>
              </div>
              <p className="text-gray-400 text-sm mb-3">You earn 1 STX each time someone records a remix using a loop from this pack</p>

              {/* Remix fee prominently displayed */}
              <div className="bg-slate-900/50 p-3 rounded">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Recording fee:</span>
                  <span className="text-[#81E4F2] font-bold text-lg">1 STX</span>
                  <span className="text-gray-500 text-xs">per loop</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Download Pricing - Optional */}
        <div className="bg-[#9772F4]/10 border border-[#9772F4]/30 rounded-lg p-4">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              checked={formData.allow_downloads || false}
              onChange={(e) => {
                const checked = e.target.checked;
                handleInputChange('allow_downloads', checked);
                if (!checked) {
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
                      step="1"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                  </div>
                </div>
              </div>

              {/* Total pack download price */}
              <div className="bg-slate-900/50 p-3 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total Pack Price:</span>
                  <div className="text-right">
                    <div className="text-[#81E4F2] font-bold text-xl">{totalPackPrice} STX</div>
                    <div className="text-gray-500 text-xs">{loopCount} loops × {downloadPricePerLoop} STX</div>
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

  // Individual Loops: Platform Remix (always on) + Optional Download
  return (
    <div className="space-y-6">
      {/* License Type Selection - Checkboxes (not radio!) */}
      <div className="space-y-4">

      {/* Platform Remix - Always checked, default 1 STX */}
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
            <p className="text-gray-400 text-sm mt-1">You earn 1 STX each time someone records a remix using this loop</p>
          </div>
        </label>

        {/* Fixed remix price display */}
        <div className="ml-8 p-3 bg-slate-900/50 rounded">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Recording fee:</span>
            <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-[#81E4F2] font-medium text-sm">
              1 STX
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
              if (checked && !formData.download_price_stx) {
                handleInputChange('download_price_stx', 1);
              } else if (!checked) {
                handleInputChange('download_price_stx', null);
              }
              // Always set remix price to 1 STX
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
                  step="1"
                />
                <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-slate-800/50 p-2 rounded mt-2">
              💡 This is separate from the 1 STX remix fee. Download price is what people pay to get the audio file.
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