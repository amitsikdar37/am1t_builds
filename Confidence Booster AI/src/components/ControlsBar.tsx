import React from 'react';
import { 
  Camera, 
  FlipHorizontal, 
  Volume2, 
  VolumeX, 
  Zap, 
  Download, 
  Sliders, 
  Maximize, 
  Music,
  Eye,
  Coffee
} from 'lucide-react';
import { TriggerMode } from '../types';

interface ControlsBarProps {
  onSwitchCamera: () => void;
  onToggleMirror: () => void;
  isMirrored: boolean;
  soundMuted: boolean;
  onToggleSound: () => void;
  onOpenSoundboard: () => void;
  triggerMode: TriggerMode;
  onChangeTriggerMode: (mode: TriggerMode) => void;
  onForceTrigger: () => void;
  onDownloadClip: () => void;
  hasDownloadableClip: boolean;
  sensitivity: number;
  onChangeSensitivity: (val: number) => void;
  isEditing: boolean;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  onSwitchCamera,
  onToggleMirror,
  isMirrored,
  soundMuted,
  onToggleSound,
  onOpenSoundboard,
  triggerMode,
  onChangeTriggerMode,
  onForceTrigger,
  onDownloadClip,
  hasDownloadableClip,
  sensitivity,
  onChangeSensitivity,
  isEditing
}) => {
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[94%] md:w-auto">
      <div className="bg-[#0b0f17]/90 border border-cyber-green/40 backdrop-blur-lg px-3 py-2 md:px-5 md:py-2.5 rounded-full shadow-2xl shadow-black/80 flex flex-wrap items-center justify-center gap-2 md:gap-3 text-white">
        
        {/* Force Sigma Drop Manual Override */}
        <button
          onClick={onForceTrigger}
          disabled={isEditing}
          className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-cyber-pink hover:from-red-500 hover:to-pink-500 text-white font-cyber font-bold text-xs md:text-sm px-3.5 py-1.5 rounded-full shadow-lg shadow-cyber-pink/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
          title="Trigger edit immediately (Shortcut: SPACEBAR)"
        >
          <Zap className="w-4 h-4 fill-current text-yellow-300 animate-pulse" />
          <span>FORCE SIGMA DROP</span>
          <span className="hidden lg:inline text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono font-normal">
            SPACE
          </span>
        </button>

        <div className="hidden sm:block h-5 w-[1px] bg-cyber-green/30" />

        {/* Trigger Mode Selector */}
        <div className="flex items-center bg-gray-900/80 p-0.5 rounded-full border border-gray-700/80 text-[11px] font-mono">
          <button
            onClick={() => onChangeTriggerMode('both')}
            className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
              triggerMode === 'both' ? 'bg-cyber-green text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
            title="Auto-detect Drink Sip OR Glasses adjust"
          >
            <span>BOTH</span>
          </button>
          <button
            onClick={() => onChangeTriggerMode('drink')}
            className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
              triggerMode === 'drink' ? 'bg-cyber-green text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
            title="Detect Drink Sip only"
          >
            <Coffee className="w-3 h-3" />
            <span className="hidden md:inline">DRINK</span>
          </button>
          <button
            onClick={() => onChangeTriggerMode('glasses')}
            className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${
              triggerMode === 'glasses' ? 'bg-cyber-green text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
            title="Detect Glasses adjust only"
          >
            <Eye className="w-3 h-3" />
            <span className="hidden md:inline">GLASSES</span>
          </button>
        </div>


        <div className="hidden sm:block h-5 w-[1px] bg-cyber-green/30" />

        {/* Camera Switch & Mirror Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSwitchCamera}
            className="p-2 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-cyber-green text-gray-300 hover:text-cyber-green transition-all"
            title="Switch front / rear camera"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleMirror}
            className={`p-2 rounded-full border transition-all ${
              isMirrored
                ? 'bg-cyber-green/20 border-cyber-green text-cyber-green'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle mirror horizontal flip"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-cyber-green/30" />

        {/* Audio & Soundboard */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSound}
            className={`p-2 rounded-full border transition-all ${
              soundMuted
                ? 'bg-red-950/60 border-red-500 text-red-400'
                : 'bg-gray-900 border-gray-700 hover:border-cyber-green text-gray-300 hover:text-cyber-green'
            }`}
            title={soundMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSoundboard}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-cyber-pink text-xs font-mono text-cyber-pink transition-all"
            title="Open Phonk tracks and meme soundboard"
          >
            <Music className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TRACKS</span>
          </button>
        </div>

        <div className="hidden sm:block h-5 w-[1px] bg-cyber-green/30" />

        {/* Sensitivity Toggle */}
        <button
          onClick={() => {
            const next = sensitivity === 1.0 ? 1.5 : sensitivity === 1.5 ? 2.0 : 1.0;
            onChangeSensitivity(next);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-cyber-green text-xs font-mono text-gray-300 transition-all"
          title="Cycle detection sensitivity (Normal / High / Hyper)"
        >
          <Sliders className="w-3.5 h-3.5 text-cyber-green" />
          <span className="hidden sm:inline">SENS:</span>
          <span className="text-cyber-green font-bold">{sensitivity === 1.0 ? 'NORM' : sensitivity === 1.5 ? 'HIGH' : 'HYPER'}</span>
        </button>

        {/* Download Clip (if available) */}
        {hasDownloadableClip && (
          <button
            onClick={onDownloadClip}
            className="flex items-center gap-1.5 bg-cyber-green text-black font-cyber font-bold text-xs px-3 py-1.5 rounded-full hover:bg-white transition-all shadow-md shadow-cyber-green/30"
            title="Download recorded clip"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD</span>
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="hidden md:block p-2 rounded-full bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-cyber-green text-gray-300 hover:text-white transition-all"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};
