import React from 'react';
import { X, Music, Volume2, Sparkles, Play } from 'lucide-react';
import { PhonkTrackId } from '../types';
import { phonkAudio, PHONK_TRACKS } from '../services/phonkAudioEngine';

interface SoundboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack: PhonkTrackId;
  onSelectTrack: (track: PhonkTrackId) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
}

export const SoundboardModal: React.FC<SoundboardModalProps> = ({
  isOpen,
  onClose,
  selectedTrack,
  onSelectTrack,
  volume,
  onVolumeChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-[#0b0f17] border border-cyber-green/50 rounded-md max-w-lg w-full p-5 shadow-2xl shadow-cyber-green/20 flex flex-col gap-4 text-white font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyber-green/30 pb-3">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-cyber-green" />
            <h2 className="font-cyber font-bold text-sm tracking-wider text-cyber-green text-glow-green">
              PHONK SOUNDBOARD & SOUNDTRACKS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-sm hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Volume Slider */}
        <div className="flex items-center gap-3 bg-cyber-dark/80 p-2.5 rounded border border-cyber-green/20">
          <Volume2 className="w-4 h-4 text-cyber-cyan" />
          <span className="text-xs text-gray-300">AUDIO VOLUME:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 accent-cyber-green cursor-pointer h-1.5 bg-gray-700 rounded-lg"
          />
          <span className="text-xs font-bold text-cyber-green w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Soundtrack Presets */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyber-pink" />
            SELECT EDIT SOUNDTRACK PRESET:
          </span>

          <div className="grid grid-cols-1 gap-2">
            {(Object.keys(PHONK_TRACKS) as PhonkTrackId[]).map((trackId) => {
              const track = PHONK_TRACKS[trackId];
              const isSelected = selectedTrack === trackId;
              return (
                <div
                  key={trackId}
                  onClick={() => onSelectTrack(trackId)}
                  className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyber-green bg-cyber-green/15 text-white shadow-md shadow-cyber-green/10'
                      : 'border-gray-800 bg-gray-900/60 text-gray-300 hover:border-cyber-green/40 hover:bg-gray-900'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="font-cyber font-bold text-xs flex items-center gap-2">
                      <span className={isSelected ? 'text-cyber-green' : 'text-gray-400'}>
                        {isSelected ? '▶' : '○'}
                      </span>
                      {track.title}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {track.bpm} BPM // {track.vibe}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      phonkAudio.playEditSequence(trackId);
                    }}
                    className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-cyber-green hover:text-black px-2 py-1 rounded transition-colors text-cyber-green font-mono"
                    title="Preview track beat"
                  >
                    <Play className="w-3 h-3" />
                    PREVIEW
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
