'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { GalaxySceneData, StarData } from '@/lib/types';
import { GalaxyCanvas } from '@/components/GalaxyCanvas';
import { GalaxyHUD } from '@/components/GalaxyHUD';
import { StarTooltip } from '@/components/StarTooltip';
import { StarDetailsModal } from '@/components/StarDetailsModal';
import { GalaxyControls } from '@/components/GalaxyControls';
import { ConstellationTour } from '@/components/ConstellationTour';
import { CustomTokenModal } from '@/components/CustomTokenModal';
import { InfoGuideModal } from '@/components/InfoGuideModal';
import { Sparkles, Loader2, Compass, AlertCircle } from 'lucide-react';

export default function Home() {
  const [username, setUsername] = useState<string>('torvalds');
  const [galaxyData, setGalaxyData] = useState<GalaxySceneData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Star & Hover Tooltip
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null);
  const [hoveredStar, setHoveredStar] = useState<StarData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Settings & Toggles
  const [isMuted, setIsMuted] = useState<boolean>(true); // Start muted to comply with browser autoplay policies
  const [isBloomEnabled, setIsBloomEnabled] = useState<boolean>(true);
  const [areConstellationsVisible, setAreConstellationsVisible] = useState<boolean>(true);
  const [resetCameraCounter, setResetCameraCounter] = useState<number>(0);

  // Modals
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // Fetch Galaxy Data
  const loadGalaxy = useCallback(async (userToFetch: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedStar(null);
    setHoveredStar(null);

    try {
      let customToken = '';
      if (typeof window !== 'undefined') {
        customToken = localStorage.getItem('github_custom_token') || '';
      }

      const headers: Record<string, string> = {};
      if (customToken) {
        headers['x-custom-token'] = customToken;
      }

      const res = await fetch(`/api/galaxy?username=${encodeURIComponent(userToFetch)}`, {
        headers,
      });

      const json = await res.json();
      if (json.success && json.data) {
        setGalaxyData(json.data);
        setUsername(userToFetch);
      } else {
        setError(json.error || 'Failed to scan developer coordinates');
      }
    } catch (err: any) {
      console.error('Error fetching galaxy:', err);
      setError('Interstellar communication link interrupted.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadGalaxy('torvalds');
  }, [loadGalaxy]);

  // Navigate Prev / Next Star
  const handlePrevStar = () => {
    if (!galaxyData || !selectedStar) return;
    const currentIndex = galaxyData.stars.findIndex((s) => s.id === selectedStar.id);
    const prevIndex = (currentIndex - 1 + galaxyData.stars.length) % galaxyData.stars.length;
    setSelectedStar(galaxyData.stars[prevIndex]);
  };

  const handleNextStar = () => {
    if (!galaxyData || !selectedStar) return;
    const currentIndex = galaxyData.stars.findIndex((s) => s.id === selectedStar.id);
    const nextIndex = (currentIndex + 1) % galaxyData.stars.length;
    setSelectedStar(galaxyData.stars[nextIndex]);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-space-950">
      {/* 3D WebGL Galaxy Scene */}
      {galaxyData && (
        <GalaxyCanvas
          galaxyData={galaxyData}
          isMuted={isMuted}
          isBloomEnabled={isBloomEnabled}
          areConstellationsVisible={areConstellationsVisible}
          selectedStar={selectedStar}
          onSelectStar={setSelectedStar}
          onHoverStar={(star, pos) => {
            setHoveredStar(star);
            setTooltipPos(pos);
          }}
          onResetTrigger={resetCameraCounter}
        />
      )}

      {/* Top Sci-Fi Navigation HUD */}
      <GalaxyHUD
        galaxyData={galaxyData}
        isLoading={isLoading}
        onSearch={loadGalaxy}
        currentUsername={username}
        selectedStar={selectedStar}
      />

      {/* 2D Projected Hover Tooltip */}
      {!selectedStar && (
        <StarTooltip star={hoveredStar} position={tooltipPos} />
      )}

      {/* Star System Details Sidebar Modal */}
      <StarDetailsModal
        star={selectedStar}
        onClose={() => {
          setSelectedStar(null);
          setResetCameraCounter((c) => c + 1);
        }}
        onPrevStar={galaxyData && galaxyData.stars.length > 1 ? handlePrevStar : undefined}
        onNextStar={galaxyData && galaxyData.stars.length > 1 ? handleNextStar : undefined}
        onReturnToOverview={() => {
          setSelectedStar(null);
          setResetCameraCounter((c) => c + 1);
        }}
      />

      {/* Bottom Interactive Controls Toolbar */}
      <GalaxyControls
        isMuted={isMuted}
        onToggleAudio={() => setIsMuted(!isMuted)}
        isBloomEnabled={isBloomEnabled}
        onToggleBloom={() => setIsBloomEnabled(!isBloomEnabled)}
        areConstellationsVisible={areConstellationsVisible}
        onToggleConstellations={() => setAreConstellationsVisible(!areConstellationsVisible)}
        onResetCamera={() => {
          setSelectedStar(null);
          setResetCameraCounter((c) => c + 1);
        }}
        onOpenTokenModal={() => setIsTokenModalOpen(true)}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
      />

      {/* Quick Star Directory Tour Matrix (Bottom Right) */}
      {galaxyData && galaxyData.stars.length > 0 && (
        <ConstellationTour
          stars={galaxyData.stars}
          selectedStar={selectedStar}
          onSelectStar={(star) => setSelectedStar(star)}
        />
      )}

      {/* Hyperspace Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-space-950/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative flex items-center justify-center mb-6">
            <div className="w-28 h-28 rounded-full border-2 border-cyan-500/20 animate-ping" />
            <div className="absolute w-20 h-20 rounded-full border-2 border-dashed border-cyan-400 animate-spin" />
            <div className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.8)]">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
          </div>

          <h2 className="text-xl font-bold font-mono tracking-wider text-cyan-300 mb-2 uppercase">
            Synthesizing Galaxy Coordinates
          </h2>
          <p className="text-xs font-mono text-slate-400 max-w-sm text-center leading-relaxed">
            Executing GitHub GraphQL telemetry & generating logarithmic stellar spiral arms for <span className="text-white font-bold">@{username}</span>...
          </p>
        </div>
      )}

      {/* Error Toast */}
      {error && !isLoading && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-mono flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 underline text-rose-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Token & Info Modals */}
      <CustomTokenModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenSaved={() => loadGalaxy(username)}
      />

      <InfoGuideModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </main>
  );
}
