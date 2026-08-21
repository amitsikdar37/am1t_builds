import React, { useState } from 'react';
import { GalaxySceneData, StarData } from '@/lib/types';
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
  Download,
  Shield,
  Zap,
  Globe,
  Radio,
  Share2,
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface GalaxyHUDProps {
  galaxyData: GalaxySceneData | null;
  rivalGalaxyData?: GalaxySceneData | null;
  isLoading: boolean;
  isRivalLoading?: boolean;
  onSearch: (username: string) => void;
  onLoadRival?: (username: string) => void;
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
  rivalGalaxyData,
  isLoading,
  isRivalLoading = false,
  onSearch,
  onLoadRival,
  currentUsername,
  selectedStar,
  isLeftOpen,
  isRightOpen,
}) => {
  const [searchInput, setSearchInput] = useState(currentUsername);
  const [rivalInput, setRivalInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleExportStory = async () => {
    const el = document.getElementById('story-export-node');
    if (!el) return;
    try {
      setIsExporting(true);
      await new Promise(r => setTimeout(r, 200));
      const canvas = await html2canvas(el, {
        width: 1080,
        height: 1920,
        scale: 1,
        backgroundColor: '#030712',
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: 1080,
        windowHeight: 1920,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `flight-pass-${galaxyData?.user.login || 'pilot'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export story:', err);
      alert('Failed to generate Flight Pass image.');
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className={`fixed bottom-24 md:top-24 md:bottom-6 left-4 right-4 md:right-auto md:left-6 w-auto md:w-80 z-20 pointer-events-none flex flex-col justify-end md:justify-start transition-all duration-500 ${isLeftOpen ? 'translate-y-0 md:translate-x-0 opacity-100' : 'translate-y-[150%] md:translate-y-0 md:-translate-x-[120%] opacity-0'}`}>
          <div className="w-full max-h-[32vh] md:max-h-full bg-space-950/50 md:bg-space-950/70 backdrop-blur-md md:backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-4 md:gap-6 overflow-y-auto custom-scrollbar">
            
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
          className={`fixed bottom-24 md:top-24 md:bottom-6 left-4 md:left-auto right-4 md:right-6 w-auto md:w-96 z-20 pointer-events-none flex flex-col justify-end md:justify-start transition-all duration-500 ${
            selectedStar || !isRightOpen ? 'translate-y-[150%] md:translate-y-0 md:translate-x-[120%] opacity-0' : 'translate-y-0 md:translate-x-0 opacity-100'
          }`}
        >
          <div className="w-full max-h-[32vh] md:max-h-full bg-space-950/50 md:bg-space-950/70 backdrop-blur-md md:backdrop-blur-2xl border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col gap-4 md:gap-6 overflow-y-auto custom-scrollbar">
            
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

            {/* 2. Galaxy Collision */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-400" /> Galaxy Collision
                </h3>
                {rivalGalaxyData && (
                  <span className="text-[10px] font-mono text-rose-300 font-bold bg-rose-500/20 px-2 py-0.5 rounded-full">
                    BATTLE ACTIVE
                  </span>
                )}
              </div>

              {!rivalGalaxyData ? (
                <>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Enter a rival developer's handle to merge your galaxies in a 1v1 telemetry battle.
                  </p>
                  <form 
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (rivalInput.trim() && onLoadRival) onLoadRival(rivalInput.trim());
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Rival GitHub handle..."
                      value={rivalInput}
                      onChange={(e) => setRivalInput(e.target.value)}
                      disabled={isRivalLoading}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500/50"
                    />
                    <button 
                      type="submit"
                      disabled={isRivalLoading || !rivalInput.trim()}
                      className="px-3 py-2 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {isRivalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Clash'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col gap-3 animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex flex-col items-center">
                      <img src={galaxyData.user.avatarUrl} className="w-10 h-10 rounded-full border-2 border-cyan-400" />
                      <span className="mt-1 font-bold text-cyan-400">@{galaxyData.user.login}</span>
                    </div>
                    <div className="text-rose-500 font-black italic text-lg">VS</div>
                    <div className="flex flex-col items-center">
                      <img src={rivalGalaxyData.user.avatarUrl} className="w-10 h-10 rounded-full border-2 border-rose-400" />
                      <span className="mt-1 font-bold text-rose-400">@{rivalGalaxyData.user.login}</span>
                    </div>
                  </div>
                  
                  {/* Telemetry Matchup */}
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <span>Galaxy Mass (Stars)</span>
                      </div>
                      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-space-900">
                        <div 
                          className="h-full bg-cyan-400" 
                          style={{ width: `${(galaxyData.metrics.totalStars / (galaxyData.metrics.totalStars + rivalGalaxyData.metrics.totalStars)) * 100}%` }} 
                        />
                        <div 
                          className="h-full bg-rose-400" 
                          style={{ width: `${(rivalGalaxyData.metrics.totalStars / (galaxyData.metrics.totalStars + rivalGalaxyData.metrics.totalStars)) * 100}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono mt-1">
                        <span className="text-cyan-400">{galaxyData.metrics.totalStars}</span>
                        <span className="text-rose-400">{rivalGalaxyData.metrics.totalStars}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                        <span>Velocity (Commits)</span>
                      </div>
                      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-space-900">
                        <div 
                          className="h-full bg-cyan-400" 
                          style={{ width: `${(galaxyData.metrics.totalContributions / (galaxyData.metrics.totalContributions + rivalGalaxyData.metrics.totalContributions)) * 100}%` }} 
                        />
                        <div 
                          className="h-full bg-rose-400" 
                          style={{ width: `${(rivalGalaxyData.metrics.totalContributions / (galaxyData.metrics.totalContributions + rivalGalaxyData.metrics.totalContributions)) * 100}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono mt-1">
                        <span className="text-cyan-400">{galaxyData.metrics.totalContributions}</span>
                        <span className="text-rose-400">{rivalGalaxyData.metrics.totalContributions}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Interstellar Flight Pass & Social Story Card */}
            <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-3">
              {/* In-HUD Flight Pass Preview */}
              <div className="w-full relative rounded-2xl overflow-hidden p-[1px] bg-gradient-to-br from-cyan-400/50 via-purple-500/30 to-blue-600/50 shadow-[0_0_25px_rgba(34,211,238,0.15)] group">
                <div className="w-full h-full bg-space-950/90 backdrop-blur-xl rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden">
                  
                  {/* Background Ambient Glows */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/15 blur-2xl rounded-full" />
                  <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-purple-500/15 blur-2xl rounded-full" />
                  
                  {/* Left: Avatar & Info */}
                  <div className="flex-1 flex flex-col z-10">
                    <div className="flex items-center gap-1.5 mb-1.5 text-cyan-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[9px] uppercase font-bold tracking-[0.2em]">Pilot License</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={galaxyData.user.avatarUrl} 
                          className="w-11 h-11 rounded-xl border border-cyan-400/40 shadow-md object-cover" 
                        />
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-space-950" />
                      </div>
                      <div className="flex flex-col justify-center">
                        <div className="text-sm font-bold text-white leading-none mb-1 tracking-tight">
                          @{galaxyData.user.login}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider line-clamp-1">
                          {galaxyData.metrics.galaxyClassification}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: QR Code */}
                  <div className="z-10 bg-white p-1 rounded-lg shadow-inner shrink-0 border border-cyan-400/40">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'https://github.com')}`}
                      alt="Scan to view Galaxy"
                      className="w-12 h-12 mix-blend-multiply block"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Export Action Button */}
              <button
                onClick={handleExportStory}
                disabled={isExporting}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:via-blue-500/30 hover:to-purple-500/30 border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(34,211,238,0.15)] hover:shadow-[0_0_30px_rgba(34,211,238,0.3)] active:scale-[0.98] disabled:opacity-50 group"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Rendering 4K Story Card...</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-cyan-300 group-hover:scale-110 transition-transform" />
                    <span>Export Social Story Card (Instagram / WhatsApp)</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* HIDDEN STORY EXPORT NODE (1080x1920 - Instagram Story Format) */}
      {galaxyData && (
        <div className="fixed top-[-9999px] left-[-9999px] pointer-events-none select-none z-[-100]">
          <div 
            id="story-export-node" 
            className="w-[1080px] h-[1920px] bg-[#030712] text-white flex flex-col justify-between p-[48px] box-border relative overflow-hidden font-sans"
            style={{
              background: 'radial-gradient(ellipse 90% 60% at 50% 18%, rgba(14, 165, 233, 0.28) 0%, rgba(147, 51, 234, 0.18) 35%, rgba(6, 182, 212, 0.08) 65%, #030712 90%)',
            }}
          >
            {/* Cyberpunk Grid & Stars (Pure SVG for 100% reliable crisp rendering in html2canvas) */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="space-grid" width="80" height="80" patternUnits="userSpaceOnUse">
                  <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
                  <circle cx="80" cy="0" r="1.5" fill="#38bdf8" />
                  <circle cx="0" cy="80" r="1.5" fill="#38bdf8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#space-grid)" />
              <circle cx="150" cy="240" r="3" fill="#ffffff" opacity="0.8" />
              <circle cx="920" cy="180" r="2.5" fill="#ffffff" opacity="0.6" />
              <circle cx="840" cy="580" r="4" fill="#38bdf8" opacity="0.9" />
              <circle cx="200" cy="880" r="3" fill="#a855f7" opacity="0.8" />
              <circle cx="900" cy="1200" r="3.5" fill="#ffffff" opacity="0.7" />
              <circle cx="120" cy="1450" r="2.5" fill="#38bdf8" opacity="0.8" />
              <circle cx="960" cy="1600" r="4" fill="#ffffff" opacity="0.9" />
            </svg>

            {/* Glowing Outer HUD Frame */}
            <div className="absolute inset-[24px] rounded-[44px] border-[2px] border-cyan-500/30 pointer-events-none" />
            <div className="absolute inset-[32px] rounded-[36px] border border-white/5 pointer-events-none" />

            {/* Corner Crosshairs */}
            <div className="absolute top-[36px] left-[36px] text-cyan-400 font-mono text-xl font-black">+</div>
            <div className="absolute top-[36px] right-[36px] text-cyan-400 font-mono text-xl font-black">+</div>
            <div className="absolute bottom-[36px] left-[36px] text-cyan-400 font-mono text-xl font-black">+</div>
            <div className="absolute bottom-[36px] right-[36px] text-cyan-400 font-mono text-xl font-black">+</div>

            {/* TOP HEADER */}
            <div className="relative z-10 w-full flex justify-between items-center px-6 pt-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
                    <span className="text-xl font-black tracking-[0.25em] text-cyan-400 uppercase font-mono">
                      GITHUB 3D GALAXY
                    </span>
                  </div>
                  <span className="text-sm font-mono text-slate-400 uppercase tracking-widest block mt-0.5">
                    INTERSTELLAR FLIGHT PASS // VER 2.4
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="px-5 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-widest">
                    ORBITAL CERTIFIED
                  </span>
                </div>
                <span className="text-xs font-mono text-white/30 tracking-widest mt-1">
                  SYS.ID: #{galaxyData.user.login.toUpperCase().slice(0, 8)}
                </span>
              </div>
            </div>

            {/* HERO PILOT SECTION (Cleanly spaced, solid colors for 100% html2canvas rendering) */}
            <div className="relative z-10 flex flex-col items-center justify-center my-6">
              
              {/* Planetary Orbital Rings around Avatar */}
              <div className="relative flex items-center justify-center">
                <div className="absolute w-[360px] h-[360px] rounded-full border border-cyan-500/20 border-dashed" />
                <div className="absolute w-[290px] h-[290px] rounded-full border-2 border-purple-500/30 shadow-[0_0_80px_rgba(168,85,247,0.25)]" />
                <div className="absolute w-[220px] h-[220px] rounded-full bg-cyan-400/20 blur-[50px]" />
                
                {/* Avatar */}
                <div className="relative z-10">
                  <img 
                    src={galaxyData.user.avatarUrl} 
                    crossOrigin="anonymous"
                    className="w-[210px] h-[210px] rounded-full border-[5px] border-cyan-300 shadow-[0_0_50px_rgba(56,189,248,0.4)] object-cover"
                  />
                  {/* Floating Dominant Language Chip */}
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-[#030712] border-2 border-cyan-400 shadow-xl flex items-center gap-2.5 whitespace-nowrap">
                    <span 
                      className="w-3.5 h-3.5 rounded-full" 
                      style={{ backgroundColor: galaxyData.metrics.dominantLanguageColor || '#38bdf8' }}
                    />
                    <span className="text-sm font-mono font-black text-cyan-300 uppercase tracking-wider">
                      {galaxyData.metrics.dominantLanguage || 'Polyglot'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pilot Details */}
              <div className="flex flex-col items-center text-center mt-8">
                <h1 className="text-6xl font-black text-white tracking-tight leading-tight">
                  @{galaxyData.user.login}
                </h1>
                {galaxyData.user.name && (
                  <div className="text-2xl text-slate-400 font-medium tracking-wide mt-1">
                    {galaxyData.user.name}
                  </div>
                )}

                {/* Archetype Classification Badge (Solid text color so html2canvas renders perfectly!) */}
                <div className="mt-5 px-8 py-3.5 rounded-full bg-cyan-950/70 border-2 border-cyan-400/60 shadow-[0_0_30px_rgba(56,189,248,0.25)] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="text-xl font-mono font-bold text-cyan-300 uppercase tracking-[0.16em]">
                    {galaxyData.metrics.galaxyClassification}
                  </span>
                </div>
              </div>
            </div>

            {/* TELEMETRY METRIC CARDS (2x2 Grid with explicit line-heights to prevent font cutoff) */}
            <div className="relative z-10 grid grid-cols-2 gap-6 px-2 my-4">
              
              {/* Card 1: Stars */}
              <div className="p-7 rounded-[30px] bg-white/[0.04] backdrop-blur-md border border-amber-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                    Stellar Mass
                  </span>
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/40">
                    <Star className="w-6 h-6 fill-amber-400" />
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-5xl font-black font-mono text-white leading-normal">
                    {galaxyData.metrics.totalStars.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-slate-400 mt-1">Total GitHub Stars</div>
                </div>
                <div className="w-full h-1.5 bg-space-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 w-full" />
                </div>
              </div>

              {/* Card 2: Repositories */}
              <div className="p-7 rounded-[30px] bg-white/[0.04] backdrop-blur-md border border-cyan-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest">
                    Stellar Systems
                  </span>
                  <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
                    <GitBranch className="w-6 h-6" />
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-5xl font-black font-mono text-white leading-normal">
                    {galaxyData.metrics.totalRepositories.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-slate-400 mt-1">Orbiting Repositories</div>
                </div>
                <div className="w-full h-1.5 bg-space-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 w-full" />
                </div>
              </div>

              {/* Card 3: Commits */}
              <div className="p-7 rounded-[30px] bg-white/[0.04] backdrop-blur-md border border-fuchsia-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-fuchsia-400 uppercase tracking-widest">
                    Energy Flux
                  </span>
                  <div className="p-2.5 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-400/40">
                    <Flame className="w-6 h-6 fill-fuchsia-400" />
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-5xl font-black font-mono text-white leading-normal">
                    {galaxyData.metrics.totalContributions.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium text-slate-400 mt-1">Annual Core Commits</div>
                </div>
                <div className="w-full h-1.5 bg-space-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-300 w-full" />
                </div>
              </div>

              {/* Card 4: Galaxy Classification */}
              <div className="p-7 rounded-[30px] bg-white/[0.04] backdrop-blur-md border border-emerald-500/30 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    Galaxy Core
                  </span>
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/40">
                    <Zap className="w-6 h-6" />
                  </div>
                </div>
                <div className="py-2">
                  <div className="text-4xl font-black font-mono text-white leading-normal">
                    {galaxyData.metrics.dominantLanguage || 'Polyglot'}
                  </div>
                  <div className="text-sm font-medium text-slate-400 mt-1">
                    {galaxyData.metrics.spiralArmsCount || 3} Gravitational Spiral Arms
                  </div>
                </div>
                <div className="w-full h-1.5 bg-space-900 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 w-full" />
                </div>
              </div>

            </div>

            {/* BOTTOM BOARDING PASS & QR SECTION */}
            <div className="relative z-10 w-full px-2 mb-3">
              <div className="w-full p-7 rounded-[32px] bg-gradient-to-r from-cyan-950/70 via-space-900/90 to-purple-950/70 border border-cyan-500/40 backdrop-blur-xl flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                
                {/* Left Telemetry Text */}
                <div className="flex flex-col justify-center max-w-[620px]">
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <Globe className="w-5 h-5" />
                    <span className="text-xs font-mono font-bold uppercase tracking-[0.25em]">
                      SCAN TO LAUNCH INTERACTIVE UNIVERSE
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white tracking-tight leading-snug">
                    Experience This 3D Galaxy in Real-Time
                  </div>
                  <div className="text-base text-slate-400 mt-2 flex items-center gap-2.5">
                    <span className="px-3.5 py-1 rounded-lg bg-white/10 text-cyan-300 font-mono text-sm font-bold">
                      github.com/{galaxyData.user.login}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-sm font-mono text-slate-400">Scan with phone camera</span>
                  </div>
                </div>

                {/* Right Framed QR Code */}
                <div className="p-3.5 rounded-2xl bg-white border-2 border-cyan-400 shadow-[0_0_30px_rgba(56,189,248,0.35)] shrink-0">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'https://github.com')}`}
                    alt="QR Code"
                    crossOrigin="anonymous"
                    className="w-[125px] h-[125px] mix-blend-multiply block"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Color Bar */}
            <div className="relative z-10 w-full h-2.5 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
          </div>
        </div>
      )}
    </>
  );
};
