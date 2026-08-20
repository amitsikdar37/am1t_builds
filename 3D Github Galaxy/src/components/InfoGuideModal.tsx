import React from 'react';
import { X, Sparkles, Orbit, Star, Activity, Layers, Disc } from 'lucide-react';

interface InfoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoGuideModal: React.FC<InfoGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const metaphors = [
    {
      title: 'Central Core',
      metric: 'Total Annual Contributions & Commits',
      desc: 'A supermassive star / black hole at (0,0,0) with a rotating relativistic accretion disk and polar relativistic jets whose mass and luminosity scale with total commits.',
      icon: Disc,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/30',
    },
    {
      title: 'Star Systems',
      metric: 'Public Repositories',
      desc: 'Each public repository is positioned along logarithmic spiral arms calculated using organic 3D astrophysics equations.',
      icon: Orbit,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/30',
    },
    {
      title: 'Star Radius & Luminosity',
      metric: 'Stargazer Count (Log Scale)',
      desc: 'Calculated on a logarithmic scale: radius = log10(stars + 1) × 0.55 + 0.28. Prevents mega-repos from eclipsing the universe while highlighting major hypergiants.',
      icon: Star,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30',
    },
    {
      title: 'Spectral Color',
      metric: 'Primary Programming Language',
      desc: 'Languages map to spectral classifications: TypeScript (Cyan), JavaScript (Yellow), Python (Blue), Rust (Orange), C++ (Purple), Go (Teal), with glowing corona envelopes.',
      icon: Sparkles,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
    },
    {
      title: 'Orbital Particle Belts',
      metric: 'Commit Velocity & Recent Activity',
      desc: 'Swirling micro-particle planetary rings orbiting individual stars. Active repositories feature faster and denser particle belts.',
      icon: Activity,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/30',
    },
    {
      title: 'Interstellar Dust',
      metric: '40,000 Cosmic Background Stars',
      desc: 'Rendered in a single GPU draw call using THREE.Points and BufferGeometry with UnrealBloomPass post-processing glow.',
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl p-6 rounded-2xl bg-space-950/95 border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(6,182,212,0.3)] max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-wide text-white">
                Astrophysical Mapping Architecture
              </h3>
              <p className="text-xs text-slate-400">
                Converting Developer Metrics into Celestial Structures
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metaphors Grid */}
        <div className="py-4 overflow-y-auto custom-scrollbar space-y-3 pr-1">
          {metaphors.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border ${item.bg} flex items-start gap-3.5 transition-all hover:bg-white/[0.04]`}
              >
                <div className={`p-2 rounded-lg bg-black/40 ${item.color} shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-white tracking-wide">{item.title}</h4>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-slate-300">
                      {item.metric}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed font-light">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="font-mono text-[11px] text-cyan-400">
            Powered by Three.js &bull; GSAP &bull; Web Audio API &bull; GitHub GraphQL
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
          >
            Got it, Let's Explore
          </button>
        </div>
      </div>
    </div>
  );
};
