import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Share2,
  RotateCcw,
  Key,
  Info,
  Sliders,
  Maximize,
} from 'lucide-react';

interface GalaxyControlsProps {
  isMuted: boolean;
  onToggleAudio: () => void;
  isBloomEnabled: boolean;
  onToggleBloom: () => void;
  areConstellationsVisible: boolean;
  onToggleConstellations: () => void;
  onResetCamera: () => void;
  onOpenTokenModal: () => void;
  onOpenInfoModal: () => void;
}

export const GalaxyControls: React.FC<GalaxyControlsProps> = ({
  isMuted,
  onToggleAudio,
  isBloomEnabled,
  onToggleBloom,
  areConstellationsVisible,
  onToggleConstellations,
  onResetCamera,
  onOpenTokenModal,
  onOpenInfoModal,
}) => {
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-space-950/80 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)] text-slate-200 text-xs">
        {/* Audio Mute / Unmute Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${
            !isMuted
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
              : 'hover:bg-white/5 text-slate-400 border border-transparent'
          }`}
          title={isMuted ? 'Unmute Space Sound Hum' : 'Mute Space Sound Hum'}
          aria-label="Toggle Space Audio"
        >
          {!isMuted ? (
            <>
              <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 h-3 bg-cyan-400 animate-bounce" />
                <span className="w-0.5 h-2 bg-cyan-400 animate-pulse" />
                <span className="w-0.5 h-3.5 bg-cyan-400 animate-bounce" />
              </div>
            </>
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>

        {/* Reset Camera to Overview */}
        <button
          onClick={onResetCamera}
          className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 border border-transparent hover:border-white/10"
          title="Reset Camera to Galaxy Overview"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline font-mono text-[11px]">Orbit Reset</span>
        </button>

        {/* Constellation Lines Toggle */}
        <button
          onClick={onToggleConstellations}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            areConstellationsVisible
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'hover:bg-white/5 text-slate-400 border border-transparent'
          }`}
          title="Toggle Language Constellation Lines"
        >
          <Share2 className="w-4 h-4 text-purple-400" />
          <span className="hidden sm:inline font-mono text-[11px]">Constellations</span>
        </button>

        {/* Postprocessing Bloom Glow Toggle */}
        <button
          onClick={onToggleBloom}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
            isBloomEnabled
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'hover:bg-white/5 text-slate-400 border border-transparent'
          }`}
          title="Toggle Unreal Bloom Post-Processing"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline font-mono text-[11px]">Bloom</span>
        </button>

        {/* GitHub Token Config Key Modal Button */}
        <button
          onClick={onOpenTokenModal}
          className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-emerald-300 transition-all border border-transparent hover:border-emerald-500/30"
          title="Configure Custom GitHub Token (Rate Limit Boost)"
        >
          <Key className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Info & Celestial Guide Modal Button */}
        <button
          onClick={onOpenInfoModal}
          className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-all border border-transparent hover:border-cyan-500/30"
          title="Astrophysics Guide & Celestial Metaphor"
        >
          <Info className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-transparent hover:border-white/10 hidden md:block"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
