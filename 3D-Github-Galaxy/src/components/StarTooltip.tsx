import React from 'react';
import { StarData } from '@/lib/types';
import { Star, GitFork, Activity } from 'lucide-react';

interface StarTooltipProps {
  star: StarData | null;
  position: { x: number; y: number } | null;
}

export const StarTooltip: React.FC<StarTooltipProps> = ({ star, position }) => {
  if (!star || !position) return null;

  return (
    <div
      className="pointer-events-none fixed z-30 transition-transform duration-75"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -120%)',
      }}
    >
      <div className="relative px-3.5 py-2.5 rounded-xl bg-space-950/85 backdrop-blur-md border border-cyan-500/30 shadow-[0_0_25px_rgba(56,189,248,0.25)] text-white text-xs max-w-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Glowing Language Tag & Star Name */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
            style={{ backgroundColor: star.languageColor, color: star.languageColor }}
          />
          <h4 className="font-semibold text-sm tracking-wide text-cyan-100 truncate max-w-[180px]">
            {star.name}
          </h4>
        </div>

        {/* Short Description */}
        {star.description && (
          <p className="text-slate-300 line-clamp-2 text-[11px] mb-2 font-light leading-relaxed">
            {star.description}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-[11px] text-slate-300 pt-1.5 border-t border-white/10">
          <div className="flex items-center gap-1 font-medium text-amber-300">
            <Star className="w-3 h-3 fill-amber-300/40" />
            <span>{star.stars.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300">
            <GitFork className="w-3 h-3 text-cyan-400" />
            <span>{star.forks.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1 text-emerald-400 font-mono text-[10px] ml-auto">
            <Activity className="w-3 h-3" />
            <span>{star.activityRating}</span>
          </div>
        </div>

        {/* Action Prompt */}
        <div className="mt-1.5 text-[9px] uppercase tracking-wider text-cyan-400/80 font-mono text-center">
          Click to zoom into Star System
        </div>

        {/* Bottom Pointer Caret */}
        <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-space-950/90 border-r border-b border-cyan-500/30 rotate-45" />
      </div>
    </div>
  );
};
