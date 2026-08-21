import React from 'react';
import { StarData } from '@/lib/types';
import {
  ExternalLink,
  Star,
  GitFork,
  HardDrive,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
  Github,
  Orbit,
} from 'lucide-react';

interface StarDetailsModalProps {
  star: StarData | null;
  onClose: () => void;
  onPrevStar?: () => void;
  onNextStar?: () => void;
  onReturnToOverview?: () => void;
  isOpen?: boolean;
}

export const StarDetailsModal: React.FC<StarDetailsModalProps> = ({
  star,
  onClose,
  onPrevStar,
  onNextStar,
  onReturnToOverview,
  isOpen = true,
}) => {
  if (!star) return null;

  const formattedDate = new Date(star.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedSize =
    star.diskUsageKB > 1024
      ? `${(star.diskUsageKB / 1024).toFixed(1)} MB`
      : `${star.diskUsageKB} KB`;

  return (
    <div className={`fixed bottom-24 md:top-24 md:bottom-6 left-4 md:left-auto right-4 md:right-6 w-auto md:w-96 z-40 pointer-events-none flex flex-col justify-end md:justify-start transition-all duration-500 ${isOpen ? 'translate-y-0 md:translate-x-0 opacity-100' : 'translate-y-[150%] md:translate-y-0 md:translate-x-[120%] opacity-0'}`}>
      <div className="w-full max-h-[32vh] md:max-h-full bg-space-950/50 md:bg-space-950/70 backdrop-blur-md md:backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] pointer-events-auto flex flex-col gap-4 md:gap-6 overflow-y-auto custom-scrollbar relative">
        
        {/* Top Header & Close Button */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white/5 border ${star.isRival ? 'border-rose-500/50 text-rose-400' : 'border-white/10 text-white'}`}>
              <Github className="w-6 h-6" />
            </div>
            <div>
              <span className={`text-[10px] uppercase tracking-widest font-mono font-semibold mb-1 block ${star.isRival ? 'text-rose-400' : 'text-cyan-400'}`}>
                {star.isRival ? 'Rival Repository' : 'Repository'}
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white leading-tight break-words">
                {star.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Language & Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 shadow-inner"
            style={{
              backgroundColor: `${star.languageColor}15`,
              borderColor: `${star.languageColor}30`,
              color: star.languageColor,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: star.languageColor }} />
            {star.language}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {star.activityRating} Activity
          </span>
        </div>

        {/* Description */}
        <div className="text-sm text-slate-300 leading-relaxed font-light">
          {star.description || 'No description provided for this repository.'}
        </div>

        {/* Topics Tags */}
        {star.topics && star.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {star.topics.map((topic, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-[11px] font-mono text-cyan-300/80"
              >
                #{topic}
              </span>
            ))}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400" /> Stars
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {star.stars.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5 text-cyan-400" /> Forks
            </span>
            <span className="text-xl font-bold text-white font-mono">
              {star.forks.toLocaleString()}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Size
            </span>
            <span className="text-sm font-bold text-white font-mono mt-1">{formattedSize}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> Updated
            </span>
            <span className="text-sm font-bold text-white font-mono mt-1 text-truncate" title={formattedDate}>{formattedDate}</span>
          </div>
        </div>

        {/* Orbit Data */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-space-950/40 border border-cyan-500/20 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400/80 flex items-center gap-1.5">
              <Orbit className="w-3.5 h-3.5" /> Planetary Orbit
            </span>
            <span className="text-xs text-slate-300">Class: {star.spectralClass}</span>
          </div>
          <div className="text-right flex flex-col gap-1">
             <span className="text-xs font-mono text-cyan-300">{star.distanceFromCore} AU</span>
             <span className="text-[9px] text-slate-500 uppercase">From Core</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-white/10">
          <a
            href={star.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-white text-space-950 hover:bg-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onPrevStar && (
                <button
                  onClick={onPrevStar}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {onNextStar && (
                <button
                  onClick={onNextStar}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {onReturnToOverview && (
              <button
                onClick={onReturnToOverview}
                className="px-4 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-cyan-500/20 flex items-center gap-1.5 transition-colors"
              >
                <Orbit className="w-3.5 h-3.5" /> Unfocus
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
