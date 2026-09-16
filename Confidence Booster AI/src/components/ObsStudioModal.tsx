import React, { useState } from 'react';
import { 
  X, 
  Radio, 
  Tv, 
  ExternalLink, 
  RefreshCw, 
  Maximize2, 
  Volume2, 
  CheckCircle2, 
  Video,
  Monitor,
  HelpCircle
} from 'lucide-react';
import { EditPresetId } from '../types';

interface ObsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamTakeoverMode: 'pip' | 'fullscreen';
  onToggleTakeoverMode: () => void;
  autoCyclePresets: boolean;
  onToggleAutoCycle: () => void;
  onEnterZeroUi: () => void;
  onOpenProjector: () => void;
  currentPreset: EditPresetId;
}

export const ObsStudioModal: React.FC<ObsStudioModalProps> = ({
  isOpen,
  onClose,
  streamTakeoverMode,
  onToggleTakeoverMode,
  autoCyclePresets,
  onToggleAutoCycle,
  onEnterZeroUi,
  onOpenProjector,
  currentPreset
}) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'guide'>('controls');

  if (!isOpen) return null;

  const presetLabels: Record<EditPresetId, { name: string; track: string }> = {
    ghost_trail_impact: { name: 'Ghost Trail Impact', track: 'Montagem Tomada' },
    dark_manga_strobe: { name: 'Dark Manga Invert', track: 'Mogger Phonk' },
    sigma_hard_snaps: { name: 'Sigma Hard Snaps', track: 'Marlon Mogged' },
    parallax_dual_speed: { name: 'Parallax Dual Speed', track: 'Montagem Tomada' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-mono select-none">
      <div className="relative w-full max-w-2xl bg-[#080c14] border border-cyber-green rounded-lg shadow-2xl shadow-cyber-green/30 flex flex-col overflow-hidden text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-black/60 border-b border-cyber-green/30">
          <div className="flex items-center gap-2.5 text-cyber-green font-cyber tracking-wider text-sm font-bold">
            <Radio className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <span>OBS STUDIO & LIVE VIDEO CHAT BROADCAST</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#05080e] text-xs">
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex-1 py-2.5 font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'controls'
                ? 'border-b-2 border-cyber-green text-cyber-green bg-cyber-green/10'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>STREAM CONTROLS</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2.5 font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'guide'
                ? 'border-b-2 border-cyber-green text-cyber-green bg-cyber-green/10'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>CONNECTION GUIDE (MEET, OMETV, TEAMS)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
          {activeTab === 'controls' ? (
            <>
              {/* Feature 1: Fullscreen Edit Takeover */}
              <div className="p-3.5 bg-gray-950/70 border border-gray-800 rounded flex items-center justify-between hover:border-cyber-green/40 transition-colors">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-cyber-green" />
                    <span className="font-bold text-sm text-white">Fullscreen Edit Takeover (Streamer Mode)</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    When you sip or adjust glasses, the viral Phonk edit blows up across your <strong className="text-cyber-green">entire camera screen</strong> for viewers, then seamlessly resets back to live webcam.
                  </p>
                </div>
                <button
                  onClick={onToggleTakeoverMode}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs tracking-wider transition-all flex-shrink-0 ${
                    streamTakeoverMode === 'fullscreen'
                      ? 'bg-cyber-green text-black shadow-md shadow-cyber-green/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {streamTakeoverMode === 'fullscreen' ? 'FULLSCREEN' : 'CORNER PIP'}
                </button>
              </div>

              {/* Feature 2: Auto-Cycle Presets */}
              <div className="p-3.5 bg-gray-950/70 border border-gray-800 rounded flex items-center justify-between hover:border-cyber-cyan/40 transition-colors">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 text-cyber-cyan ${autoCyclePresets ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
                    <span className="font-bold text-sm text-white">Auto-Cycle Presets After Every Drop</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Automatically switches to the next style after every edit drop so viewers never see the same edit twice:
                    <br />
                    <span className="text-[11px] text-cyber-cyan">Ghost Trail ➔ Dark Manga ➔ Sigma Hard Snaps ➔ Repeat</span>
                  </p>
                  <div className="pt-1 text-[11px] text-gray-400">
                    Next up: <span className="text-cyber-green font-bold">{presetLabels[currentPreset]?.name || currentPreset}</span>
                  </div>
                </div>
                <button
                  onClick={onToggleAutoCycle}
                  className={`px-3 py-1.5 rounded-full font-bold text-xs tracking-wider transition-all flex-shrink-0 ${
                    autoCyclePresets
                      ? 'bg-cyber-cyan text-black shadow-md shadow-cyber-cyan/30'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {autoCyclePresets ? 'ENABLED' : 'MANUAL'}
                </button>
              </div>

              {/* Broadcast Launch Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                
                {/* Action 1: Pop-out Projector Window */}
                <div className="p-4 bg-gray-950 border border-cyber-cyan/40 rounded flex flex-col justify-between gap-3 shadow-lg shadow-cyber-cyan/10">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-cyber-cyan font-bold text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span>Clean Pop-out Projector</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Opens a clean, borderless 16:9 window with <strong>ZERO UI</strong> that OBS Window Capture can record directly. Keep controls on your screen!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onOpenProjector();
                      onClose();
                    }}
                    className="w-full py-2 bg-cyber-cyan hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-cyber-cyan/20"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>LAUNCH PROJECTOR WINDOW</span>
                  </button>
                </div>

                {/* Action 2: Clean Zero-UI Mode */}
                <div className="p-4 bg-gray-950 border border-cyber-green/40 rounded flex flex-col justify-between gap-3 shadow-lg shadow-cyber-green/10">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-cyber-green font-bold text-sm">
                      <Radio className="w-4 h-4" />
                      <span>Zero-UI Broadcast Mode</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Hides all buttons and bars on this screen for immediate OBS Window/Screen Capture. Press <kbd className="px-1 py-0.5 bg-gray-800 text-cyber-green rounded text-[10px]">ESC</kbd> anytime to restore controls.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onEnterZeroUi();
                      onClose();
                    }}
                    className="w-full py-2 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-cyber-green/20"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>ENTER ZERO-UI MODE</span>
                  </button>
                </div>

              </div>
            </>
          ) : (
            /* Connection Guide Tab */
            <div className="space-y-4 text-xs">
              
              {/* Step 1 */}
              <div className="p-3.5 bg-black/60 border border-gray-800 rounded space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyber-green text-sm">
                  <span className="w-5 h-5 rounded-full bg-cyber-green/20 border border-cyber-green flex items-center justify-center text-xs">1</span>
                  <span>Capture Feed in OBS Studio</span>
                </div>
                <p className="text-gray-300 pl-7">
                  Open OBS Studio. Under <strong>Sources</strong>, click <strong>+</strong> ➔ <strong>Window Capture</strong>.
                  <br />
                  Select either your browser window or the <span className="text-cyber-cyan">Clean Pop-out Projector Window</span>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-black/60 border border-gray-800 rounded space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyber-green text-sm">
                  <span className="w-5 h-5 rounded-full bg-cyber-green/20 border border-cyber-green flex items-center justify-center text-xs">2</span>
                  <span>Start OBS Virtual Camera</span>
                </div>
                <p className="text-gray-300 pl-7">
                  In OBS Studio (bottom right Controls dock), click <strong className="text-white">"Start Virtual Camera"</strong>.
                  <br />
                  This registers a virtual webcam in Windows named <code className="text-cyber-green bg-gray-900 px-1 py-0.5 rounded">OBS Virtual Camera</code>.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-black/60 border border-gray-800 rounded space-y-2">
                <div className="flex items-center gap-2 font-bold text-cyber-green text-sm">
                  <span className="w-5 h-5 rounded-full bg-cyber-green/20 border border-cyber-green flex items-center justify-center text-xs">3</span>
                  <span>Connect to Google Meet, OmeTV, or Teams</span>
                </div>
                <div className="pl-7 space-y-1.5 text-gray-300">
                  <div className="flex items-start gap-2">
                    <Video className="w-4 h-4 text-cyber-green flex-shrink-0 mt-0.5" />
                    <span><strong>Camera:</strong> Select <strong>"OBS Virtual Camera"</strong> in video settings.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Volume2 className="w-4 h-4 text-cyber-cyan flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Audio (Phonk Drops):</strong> In OBS, add <strong>Application Audio Capture</strong> (select Chrome/Browser) or use free <strong>VB-Audio Cable</strong> (select CABLE Output as mic) so callers hear the phonk beats loud and clear!
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded flex items-center gap-2.5 text-cyber-green text-[11px]">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Now sip water or adjust your glasses in your video chat — the edit will blast across the screen for everyone!</span>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-black/60 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>Confidence Booster Broadcast Engine v2.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors text-xs font-bold"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
};
