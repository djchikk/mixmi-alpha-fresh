// BACKUP: Video Mixer Widget from app/page.tsx lines 2093-2209
// This is the inline JSX that renders the floating video mixer on the globe page
// Preserved before mixer separation refactoring - Jan 17, 2026

/* Original code from app/page.tsx:

      {/* Video Display Area - Draggable video mixer display */}
      {isMixerVisible && mixerState && (mixerState.deckATrack?.content_type === 'video_clip' || mixerState.deckBTrack?.content_type === 'video_clip') && (
        <div
          className="fixed"
          style={{
            left: videoDisplayPosition.x === 0 ? '50%' : `${videoDisplayPosition.x}px`,
            top: videoDisplayPosition.y === 0 ? 'auto' : `${videoDisplayPosition.y}px`,
            bottom: videoDisplayPosition.y === 0 ? '508px' : 'auto',
            transform: videoDisplayPosition.x === 0 ? 'translateX(-50%)' : 'none',
            width: '408px',
            zIndex: isDraggingVideo ? 200 : 40,
            cursor: isDraggingVideo ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleVideoMouseDown}
          onMouseEnter={() => setIsVideoMixerHovered(true)}
          onMouseLeave={() => setIsVideoMixerHovered(false)}
        >
          {/* Drag handle - auto-hides when not hovered */}
          <div
            className={`bg-gradient-to-r from-[#5BB5F9]/90 to-[#38BDF8]/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-t-lg flex items-center justify-center transition-opacity duration-200 relative ${
              isVideoMixerHovered || (videoDisplayPosition.x === 0 && videoDisplayPosition.y === 0) ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ cursor: 'grab' }}
          >
            {/* VIDEO MIXER label - absolute positioned left */}
            <span className="absolute left-3 top-1/2 -translate-y-1/2">VIDEO MIXER</span>

            {/* DRAG TO MOVE - centered */}
            <span className="text-white/60 text-[10px]">DRAG TO MOVE</span>

            {/* Collapse/Expand button - absolute positioned right */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsVideoViewerCollapsed(!isVideoViewerCollapsed);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-0.5 transition-colors pointer-events-auto"
              title={isVideoViewerCollapsed ? "Expand viewer" : "Collapse viewer"}
            >
              {isVideoViewerCollapsed ? (
                <ChevronUp className="w-5 h-5" strokeWidth={2.5} />
              ) : (
                <ChevronDown className="w-5 h-5" strokeWidth={2.5} />
              )}
            </button>
          </div>

          {/* Video display - conditionally shown */}
          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: isVideoViewerCollapsed ? '0px' : '408px',
              opacity: isVideoViewerCollapsed ? 0 : 1
            }}
          >
            <WebGLVideoDisplay
              deckATrack={mixerState.deckATrack}
              deckBTrack={mixerState.deckBTrack}
              deckAPlaying={mixerState.deckAPlaying}
              deckBPlaying={mixerState.deckBPlaying}
              crossfaderPosition={mixerState.crossfaderPosition}
              crossfadeMode={crossfadeMode}
              effects={{
                activeEffect: webglActiveEffect,
                intensity: webglIntensity,
                granularity: webglGranularity,
                wetDry: webglWetDry,
                audioReactive: webglAudioReactive,
                ditherColor: webglDitherColor,
                audioLevel: webglAudioLevel,
                ridiculousMode: webglRidiculousMode,
                saturation: webglSaturation
              }}
            />
          </div>

          {/* Inline Control Bar - MIX and FX controls */}
          <WebGLControlBar
            crossfadeMode={crossfadeMode}
            onCrossfadeModeChange={setCrossfadeMode}
            activeEffect={webglActiveEffect}
            onEffectChange={setWebglActiveEffect}
            onOpenSettings={() => setIsWebglFXPanelOpen(true)}
          />

          {/* WebGL FX Panel - extends below control bar */}
          {isWebglFXPanelOpen && (
            <div className="relative z-50">
              <WebGLFXPanel
                isOpen={isWebglFXPanelOpen}
                onClose={() => setIsWebglFXPanelOpen(false)}
                activeEffect={webglActiveEffect}
                intensity={webglIntensity}
                onIntensityChange={setWebglIntensity}
                granularity={webglGranularity}
                onGranularityChange={setWebglGranularity}
                wetDry={webglWetDry}
                onWetDryChange={setWebglWetDry}
                audioReactive={webglAudioReactive}
                onAudioReactiveChange={setWebglAudioReactive}
                audioLevel={webglAudioLevel}
                ditherColor={webglDitherColor}
                onDitherColorChange={setWebglDitherColor}
                ridiculousMode={webglRidiculousMode}
                onRidiculousModeChange={setWebglRidiculousMode}
                saturation={webglSaturation}
                onSaturationChange={setWebglSaturation}
              />
            </div>
          )}
        </div>
      )}

*/

// KEY DIMENSIONS:
// - Container width: 408px
// - Video display height: 408px (maxHeight)
// - Default position: centered horizontally, 508px from bottom
// - z-index: 40 (200 when dragging)

// KEY COUPLING TO BREAK (Phase 3):
// - crossfaderPosition={mixerState.crossfaderPosition} - audio mixer crossfader controls video mixing
