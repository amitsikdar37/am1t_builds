import React, { useEffect, useState } from 'react';

interface TacticalHUDProps {
  fps: number;
}

export const TacticalHUD: React.FC<TacticalHUDProps> = () => {
  const [timecode, setTimecode] = useState('00:00:00:00');

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ms = Math.floor((elapsed % 1000) / 10);
      const s = Math.floor((elapsed / 1000) % 60);
      const m = Math.floor((elapsed / (1000 * 60)) % 60);
      const h = Math.floor(elapsed / (1000 * 60 * 60));
      setTimecode(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(ms).padStart(2, '0')}`
      );
    }, 40);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 flex flex-col justify-between p-4 md:p-6 font-mono text-cyber-green">
      
      {/* Top Left: [ LIVE (Matching Reference Images 1 & 2) */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded border-l-2 border-cyber-green text-xs font-bold tracking-widest text-glow-green">
          <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
          <span>[ LIVE</span>
        </div>

        {/* Top Center: Action Prompt Banner (Solves "Nothing Happens" Problem) */}
        <div className="hidden sm:flex items-center gap-2 bg-black/80 border border-cyber-green/50 backdrop-blur-md px-4 py-1.5 rounded-full text-xs shadow-lg shadow-black/80 text-cyber-green">
          <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping" />
          <span className="text-gray-300 font-bold">TRIGGER ACTION:</span>
          <span className="font-bold flex items-center gap-2 text-white">
            <span className="bg-cyber-green/20 px-2 py-0.5 rounded text-cyber-green">☕ SIP DRINK</span>
            <span className="text-gray-500">/</span>
            <span className="bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300">👓 ADJUST GLASSES</span>
          </span>
        </div>

        {/* Top Right: CAM 01 (Positioned to the left of the PIP box) */}
        <div className="mr-56 md:mr-72 text-xs font-bold tracking-widest text-cyber-green/80">
          <span>CAM 01</span>
        </div>
      </div>

      {/* Bottom Left: REC 00:00:xx:xx (Matching Reference Images 1 & 2) */}
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider bg-black/40 px-2 py-1 rounded w-fit">
        <span className="text-red-500 font-bold">REC</span>
        <span className="text-cyber-green font-mono">{timecode}</span>
      </div>

    </div>
  );
};
