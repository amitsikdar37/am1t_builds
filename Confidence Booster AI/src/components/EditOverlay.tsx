import React from 'react';
import { RotateCcw, Download } from 'lucide-react';

interface EditOverlayProps {
  actionType: 'drink' | 'glasses' | 'manual';
  onSkip: () => void;
  onDownload: () => void;
  canDownload: boolean;
}

export const EditOverlay: React.FC<EditOverlayProps> = ({
  actionType,
  onSkip,
  onDownload,
  canDownload
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-4 md:p-6">
      
      {/* Top Bar: Edit Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 bg-cyber-pink/20 border border-cyber-pink px-3.5 py-1.5 rounded-sm backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-cyber-pink animate-ping" />
          <span className="font-cyber font-bold tracking-wider text-xs md:text-sm text-cyber-pink text-glow-pink">
            STATUS: MOG EDIT ACTIVE // {actionType === 'drink' ? 'DRINK SIP' : actionType === 'glasses' ? 'GLASSES ADJUST' : 'MANUAL DROP'}
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {canDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 bg-cyber-green text-black font-cyber font-bold text-xs px-3 py-1.5 rounded-sm hover:bg-white transition-all shadow-lg shadow-cyber-green/30"
              title="Download generated edit as video"
            >
              <Download className="w-4 h-4" />
              DOWNLOAD CLIP
            </button>
          )}

          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-600 text-gray-200 font-mono text-xs px-2.5 py-1.5 rounded-sm hover:bg-gray-800 transition-colors backdrop-blur-md"
            title="Return to live monitor"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            SKIP TO LIVE
          </button>
        </div>
      </div>

      {/* Bottom Progress Bar Indicator */}
      <div className="w-full bg-gray-950/80 h-1.5 rounded-full overflow-hidden border border-cyber-pink/40">
        <div
          className="h-full bg-gradient-to-r from-cyber-green via-cyber-pink to-cyber-cyan animate-[progressBar_11s_linear_forwards]"
          style={{ width: '0%' }}
        />
      </div>

    </div>
  );
};
