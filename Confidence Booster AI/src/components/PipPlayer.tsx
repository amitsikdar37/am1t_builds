import React from 'react';
import { Download, RotateCcw } from 'lucide-react';

export type PipState = 'STANDBY' | 'EDITING' | 'PLAYING';

interface PipPlayerProps {
  state: PipState;
  editCanvasRef: React.RefObject<HTMLCanvasElement>;
  onSkip: () => void;
  onDownload: () => void;
  canDownload: boolean;
}

export const PipPlayer: React.FC<PipPlayerProps> = ({
  state,
  editCanvasRef,
  onSkip,
  onDownload,
  canDownload
}) => {
  const isPlaying = state === 'PLAYING';
  const isEditing = state === 'EDITING';

  return (
    <div
      className={`absolute transition-all duration-300 ease-out z-20 overflow-hidden font-mono ${
        isPlaying
          ? 'top-4 right-4 bottom-20 w-[42%] max-w-lg bg-black border-2 border-cyber-green shadow-2xl shadow-cyber-green/40 rounded-sm flex flex-col'
          : 'top-4 right-4 w-52 h-36 md:w-64 md:h-44 bg-[#05080e]/90 border border-cyber-green/80 backdrop-blur-md rounded-sm'
      }`}
    >
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-black/80 border-b border-cyber-green/30 text-[10px] text-cyber-green z-30 flex-shrink-0 select-none">
        <span className="font-bold flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isPlaying
                ? 'bg-cyber-pink animate-ping'
                : isEditing
                ? 'bg-amber-400 animate-pulse'
                : 'bg-cyber-green'
            }`}
          />
          {isPlaying ? 'EDIT PLAYBACK' : isEditing ? 'EDITING...' : 'MONITOR STANDBY'}
        </span>

        {isPlaying && (
          <div className="flex items-center gap-1 pointer-events-auto">
            {canDownload && (
              <button
                onClick={onDownload}
                className="p-1 text-cyber-green hover:text-white transition-colors"
                title="Download edit clip"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onSkip}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Close edit player"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
        
        {/* Reticle View (Visible during STANDBY and EDITING) */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-200 ${
            isPlaying ? 'opacity-0 pointer-events-none hidden' : 'opacity-100 flex'
          }`}
        >
          {/* Tactical Crosshair Lines */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
            <div className="w-full h-[1px] bg-cyber-green" />
            <div className="h-full w-[1px] bg-cyber-green absolute" />
          </div>

          {/* Polygon / Octagon Radar Geometry (Image 2 style) */}
          <div
            className={`relative w-20 h-20 md:w-24 md:h-24 border border-cyber-green flex items-center justify-center transition-transform ${
              isEditing
                ? 'animate-[spin_4s_linear_infinite] border-amber-400 scale-110 shadow-lg shadow-amber-400/20'
                : 'opacity-75'
            }`}
            style={{
              clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
            }}
          >
            <div className="w-12 h-12 rounded-full border border-dashed border-cyber-green opacity-60" />
          </div>

          {/* Center Status Text (Image 2 style: EDITING...) */}
          <div className="absolute z-10 text-center font-bold tracking-widest text-xs md:text-sm">
            {isEditing ? (
              <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse font-mono">
                EDITING...
              </span>
            ) : (
              <span className="text-cyber-green/70 text-[10px] font-mono">
                STANDBY
              </span>
            )}
          </div>
        </div>

        {/* Video Canvas (Always mounted so ref is never null!) */}
        <canvas
          ref={editCanvasRef}
          className={`w-full h-full object-contain transition-opacity duration-300 ${
            isPlaying ? 'opacity-100 block' : 'opacity-0 pointer-events-none hidden'
          }`}
        />
      </div>

    </div>
  );
};
