import React, { useState, useEffect, useMemo } from 'react';
import { generateHindiRoast } from '../utils/hindiRoastEngine';

const Dashboard = ({ data, onReset }) => {
  const { profile } = data;
  const [typedRoast, setTypedRoast] = useState('');
  
  // Memoize the generated roast so it doesn't regenerate randomly on every character typed!
  const fullRoast = useMemo(() => generateHindiRoast(data), [data]);

  useEffect(() => {
    let currentText = '';
    let i = 0;
    
    // Typewriter effect
    const interval = setInterval(() => {
      if (i < fullRoast.length) {
        currentText += fullRoast.charAt(i);
        setTypedRoast(currentText);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 20); // Fast 20ms per character typing speed

    return () => clearInterval(interval);
  }, [fullRoast]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#111827] via-[#0B0F19] to-black">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 pb-6 border-b border-gray-800/50">
        <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
          <span className="text-toxicGreen drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">AUDIT_</span>
          <span className="opacity-90">RESULTS</span>
        </h2>
        <button 
          onClick={onReset}
          className="px-6 py-2.5 text-sm font-bold border border-gray-700/50 text-gray-400 hover:text-toxicGreen hover:border-toxicGreen/50 rounded-md transition-all bg-gray-900/50 backdrop-blur-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] uppercase tracking-wider"
        >
          [ NEW AUDIT ]
        </button>
      </header>

      {/* Profile Header */}
      {profile && (
        <div className="w-full max-w-4xl mb-8 p-6 rounded-xl border border-gray-800/50 bg-[#0B0F19]/50 backdrop-blur-md flex flex-col md:flex-row items-center md:items-start gap-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
          <img 
            src={profile.avatar_url} 
            alt="Profile Avatar" 
            className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-toxicGreen/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] object-cover bg-black"
          />
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-black text-white tracking-tight">{profile.name || profile.login}</h1>
            <a href={profile.html_url} target="_blank" rel="noreferrer" className="text-toxicGreen/80 hover:text-toxicGreen hover:underline mb-3 inline-block font-mono text-sm">@{profile.login}</a>
            <p className="text-gray-300 text-sm max-w-2xl leading-relaxed">{profile.bio || "No bio provided. A true mystery developer."}</p>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="text-center p-4 rounded-lg bg-black/60 border border-gray-800/50 min-w-[90px] shadow-inner">
              <div className="text-2xl font-black text-white tracking-tighter">{profile.followers}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Followers</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-black/60 border border-gray-800/50 min-w-[90px] shadow-inner">
              <div className="text-2xl font-black text-white tracking-tighter">{profile.public_repos}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Repos</div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Roast Box */}
      <div className="w-full max-w-4xl p-6 md:p-10 rounded-xl border border-cyberRed/40 bg-black/80 backdrop-blur-md shadow-[0_0_40px_rgba(239,68,68,0.15)] relative overflow-hidden transition-all duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyberRed via-orange-500 to-cyberRed"></div>
        <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-4 text-xs font-mono text-gray-500 tracking-widest uppercase">root@roast-engine:~# ./execute_audit.sh</span>
        </div>
        
        <div className="font-mono text-base md:text-lg lg:text-xl text-red-100 leading-relaxed whitespace-pre-wrap min-h-[200px]">
          {typedRoast}
          <span className="animate-blink inline-block w-2 h-5 bg-toxicGreen ml-1 align-middle"></span>
        </div>
      </div>

      <div className="mt-16 text-center text-xs text-gray-600 max-w-2xl mb-8 font-mono opacity-60 hover:opacity-100 transition-opacity duration-500">
        <p>DISCLAIMER: This roasting algorithm is built for fun. Please don't cry.</p>
      </div>
    </div>
  );
};

export default Dashboard;
