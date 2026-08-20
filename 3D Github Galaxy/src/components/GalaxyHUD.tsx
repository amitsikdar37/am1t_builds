import React, { useState } from 'react';
import { GalaxySceneData } from '@/lib/types';
import {
  Search,
  Sparkles,
  Star,
  GitBranch,
  Flame,
  ArrowRight,
  Loader2,
  Github,
  Users,
  MapPin,
  Calendar,
} from 'lucide-react';

interface GalaxyHUDProps {
  galaxyData: GalaxySceneData | null;
  isLoading: boolean;
  onSearch: (username: string) => void;
  currentUsername: string;
  selectedStar: StarData | null;
  isLeftOpen: boolean;
  isRightOpen: boolean;
}

const PRESET_EXPLORERS = [
  'torvalds',
  'shadcn',
  'gaearon',
  'yyx990803',
  'antfu',
  'vercel',
  'amitsikdar37',
];

export const GalaxyHUD: React.FC<GalaxyHUDProps> = ({
  galaxyData,
  isLoading,
  onSearch,
  currentUsername,
  selectedStar,
  isLeftOpen,
  isRightOpen,
}) => {
  const [searchInput, setSearchInput] = useState(currentUsername);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed && trimmed.toLowerCase() !== currentUsername.toLowerCase()) {
      onSearch(trimmed);
    }
  };

  const handleSelectPreset = (username: string) => {
    setSearchInput(username);
    if (username.toLowerCase() !== currentUsername.toLowerCase()) {
      onSearch(username);
    }
  };

  return (
    <>
      {/* TOP COMMAND CENTER: Search & Presets */}
      <div className="fixed top-0 left-0 right-0 z-30 p-6 pointer-events-none flex flex-col items-center gap-3">
        {/* Brand Logo & Search */}
        <div className="pointer-events-auto flex items-center gap-4 bg-space-950/80 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-2 pl-2 pr-4 border-r border-white/10">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-semibold tracking-wide text-white hidden md:block">
              3D GitHub Galaxy
            </h1>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 w-72">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search GitHub username..."
              disabled={isLoading}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !searchInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Quick Presets */}
        <div className="pointer-events-auto flex items-center gap-2 max-w-full overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mr-1">
            Presets:
          </span>
          {PRESET_EXPLORERS.map((preset) => (
            <button
              key={preset}
              onClick={() => handleSelectPreset(preset)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                currentUsername.toLowerCase() === preset.toLowerCase()
                  ? 'bg-white/20 text-white border border-white/30 shadow-lg'
                  : 'bg-black/40 text-slate-400 hover:text-white border border-white/5 hover:border-white/20 hover:bg-black/60'
              }`}
            >
              @{preset}
            </button>
          ))}
        </div>
      </div>

      {/* LEFT SIDEBAR: GitHub Profile Panel */}
      {galaxyData && (
        <div className={`fixed top-24 bottom-6 left-6 w-80 z-20 pointer-events-none flex flex-col justify-start hidden lg:flex transition-all duration-500 ${isLeftOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
          <div className="w-full bg-space-950/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-6 max-h-full overflow-y-auto custom-scrollbar">
            
            {/* Header: Avatar & Bio */}
            <div className="flex flex-col items-center text-center gap-3">
              <a href={`https://github.com/${galaxyData.user.login}`} target="_blank" rel="noopener noreferrer" className="relative group block">
                <img
                  src={galaxyData.user.avatarUrl}
                  alt={galaxyData.user.login}
                  className="w-24 h-24 rounded-full border-2 border-white/10 group-hover:border-cyan-400/50 transition-colors object-cover shadow-2xl"
                />
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <Github className="w-8 h-8 text-white" />
                </div>
              </a>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {galaxyData.user.name || galaxyData.user.login}
                </h2>
                <a href={`https://github.com/${galaxyData.user.login}`} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                  @{galaxyData.user.login}
                </a>
              </div>
              {galaxyData.user.bio && (
                <p className="text-xs text-slate-300 leading-relaxed max-w-[240px]">
                  {galaxyData.user.bio}
                </p>
              )}
              
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-1 text-[11px] text-slate-400">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{galaxyData.user.followers.toLocaleString()} followers</span>
                </div>
                {galaxyData.user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span>{galaxyData.user.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Separator */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1 border border-white/5">
                <div className="flex items-center gap-1.5 text-amber-300/80 text-[10px] uppercase font-bold tracking-wider">
                  <Star className="w-3.5 h-3.5" />
                  Total Stars
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {galaxyData.metrics.totalStars.toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1 border border-white/5">
                <div className="flex items-center gap-1.5 text-cyan-400/80 text-[10px] uppercase font-bold tracking-wider">
                  <GitBranch className="w-3.5 h-3.5" />
                  Repositories
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {galaxyData.metrics.totalRepositories.toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-3 flex flex-col gap-1 border border-white/5 col-span-2">
                <div className="flex items-center gap-1.5 text-purple-400/80 text-[10px] uppercase font-bold tracking-wider">
                  <Flame className="w-3.5 h-3.5" />
                  Core Commits (Last Year)
                </div>
                <div className="text-2xl font-bold text-white font-mono">
                  {galaxyData.metrics.totalContributions.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Top Languages Progress Bar */}
            <div className="flex flex-col gap-3 mt-2">
              <h3 className="text-xs font-semibold text-white tracking-wide">Top Languages</h3>
              
              {/* The Progress Bar */}
              <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-white/10">
                {galaxyData.metrics.languagesBreakdown.slice(0, 5).map((lang) => (
                  <div
                    key={lang.name}
                    style={{
                      width: `${lang.percentage}%`,
                      backgroundColor: lang.color,
                    }}
                    className="h-full border-r border-space-950 last:border-0"
                    title={`${lang.name}: ${lang.percentage.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Language Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
                {galaxyData.metrics.languagesBreakdown.slice(0, 5).map((lang) => (
                  <div key={lang.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: lang.color }}
                    />
                    <span className="text-[11px] font-medium text-slate-300">
                      {lang.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {lang.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* IDLE RIGHT SIDEBAR: Action & Telemetry Panel (State A) */}
      {galaxyData && (
        <div
          className={`fixed top-24 bottom-6 right-6 w-96 z-20 pointer-events-none flex flex-col justify-start hidden lg:flex transition-all duration-500 ${
            selectedStar || !isRightOpen ? 'translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'
          }`}
        >
          <div className="w-full bg-space-950/70 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-6 max-h-full overflow-y-auto custom-scrollbar">
            
            {/* Developer Archetype Header */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-mono text-cyan-400 font-bold tracking-widest">
                Developer Archetype
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {galaxyData.metrics.galaxyClassification}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A massive {galaxyData.metrics.dominantLanguage} dominant stellar system.
              </p>
            </div>

            {/* Separator */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* 1. Galactic Time Travel */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-400" /> Galactic Time Travel
                </h3>
                <span className="text-[10px] font-mono text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Drag the timeline to watch this developer's galaxy physically evolve over the years.
              </p>
              
              {(() => {
                const minYear = galaxyData.stars.length > 0 
                  ? Math.min(...galaxyData.stars.map(s => new Date(s.createdAt).getFullYear())) 
                  : 2015;
                const maxYear = new Date().getFullYear();
                
                return (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex justify-between text-[10px] font-mono text-cyan-400/80">
                      <span>{minYear}</span>
                      <span>{maxYear}</span>
                    </div>
                    <input
                      type="range"
                      min={minYear}
                      max={maxYear}
                      step="1"
                      defaultValue={maxYear}
                      className="w-full h-1.5 bg-space-900 rounded-full appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.8)] focus:outline-none"
                      onChange={(e) => {
                        const targetYear = parseInt(e.target.value);
                        window.dispatchEvent(new CustomEvent('time-travel-scrub', { detail: targetYear }));
                      }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* 2. Compare Galaxy (Placeholder) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" /> Galaxy Collision
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Enter a rival developer's handle to merge your galaxies in a 1v1 telemetry battle.
              </p>
              <div className="flex gap-2 opacity-50 cursor-not-allowed">
                <input
                  type="text"
                  placeholder="Rival GitHub handle..."
                  disabled
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-500"
                />
                <button disabled className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold">
                  Clash
                </button>
              </div>
            </div>

            {/* 3. Export Flight Pass */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <button
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-500/30 hover:border-cyan-400 text-cyan-100 font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
                onClick={() => alert("Interstellar Flight Pass generator booting up... (Coming Soon)")}
              >
                <span>Export Flight Pass</span>
                <MapPin className="w-4 h-4 group-hover:text-cyan-300" />
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
