import React, { useState } from 'react';
import { StarData } from '@/lib/types';
import { Sparkles, Star, ChevronUp, ChevronDown, Filter } from 'lucide-react';

interface ConstellationTourProps {
  stars: StarData[];
  selectedStar: StarData | null;
  onSelectStar: (star: StarData) => void;
}

export const ConstellationTour: React.FC<ConstellationTourProps> = ({
  stars,
  selectedStar,
  onSelectStar,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterLang, setFilterLang] = useState<string>('All');

  // Unique languages
  const languages = ['All', ...Array.from(new Set(stars.map((s) => s.language)))];

  const filteredStars = filterLang === 'All'
    ? stars
    : stars.filter((s) => s.language === filterLang);

  // Sort by star count
  const sortedStars = [...filteredStars].sort((a, b) => b.stars - a.stars);

  return (
    <div className="fixed bottom-24 md:bottom-5 right-4 md:right-5 z-30 pointer-events-auto flex flex-col items-end">
      {/* Expanded Star Systems List */}
      {isOpen && (
        <div className="mb-2 w-72 sm:w-80 max-h-80 bg-space-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-3.5 shadow-[0_0_40px_rgba(6,182,212,0.25)] text-white flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-cyan-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Stellar Nav Matrix</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {filteredStars.length} Stars
            </span>
          </div>

          {/* Language Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => setFilterLang(lang)}
                className={`px-2 py-0.5 rounded-md font-mono transition-colors shrink-0 ${
                  filterLang === lang
                    ? 'bg-cyan-500 text-white font-bold'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Scrollable Star List */}
          <div className="overflow-y-auto custom-scrollbar space-y-1.5 max-h-52 pr-1">
            {sortedStars.map((star) => (
              <button
                key={star.id}
                onClick={() => onSelectStar(star)}
                className={`w-full p-2 rounded-xl text-left transition-all flex items-center justify-between border ${
                  selectedStar?.id === star.id
                    ? 'bg-cyan-500/25 border-cyan-400/60 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                    style={{ backgroundColor: star.languageColor, color: star.languageColor }}
                  />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate">
                      {star.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {star.language} &bull; Arm {star.orbitalArm}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300 shrink-0">
                  <Star className="w-3 h-3 fill-amber-300/40" />
                  <span>{star.stars > 999 ? `${(star.stars / 1000).toFixed(1)}k` : star.stars}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Pill Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3.5 py-2.5 rounded-2xl bg-space-950/85 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 hover:text-white shadow-[0_0_25px_rgba(6,182,212,0.25)] text-xs font-mono flex items-center gap-2 transition-all hover:scale-105"
      >
        <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
        <span className="font-semibold">Star Systems Directory</span>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
