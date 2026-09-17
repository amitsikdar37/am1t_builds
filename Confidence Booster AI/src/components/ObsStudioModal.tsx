import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  AlertTriangle,
  Mic,
  MicOff,
  Activity,
  Play
} from 'lucide-react';
import { EditPresetId } from '../types';
import { broadcastAudio, AudioOutputDevice } from '../services/broadcastAudioEngine';
import { phonkAudio } from '../services/phonkAudioEngine';

interface ObsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamTakeoverMode: 'pip' | 'fullscreen';
  onToggleTakeoverMode: () => void;
  autoCyclePresets: boolean;
  onToggleAutoCycle: () => void;
  onEnterZeroUi: () => void;
  onOpenProjector: (mode?: 'pip' | 'window') => void;
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
  const [isBroadcastingAudio, setIsBroadcastingAudio] = useState(broadcastAudio.getIsBroadcasting());
  const [audioDevices, setAudioDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState(
    broadcastAudio.getSelectedDeviceId() || broadcastAudio.getAutoCableDeviceId() || 'default'
  );
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [broadcastPhonkVolume, setBroadcastPhonkVolume] = useState(broadcastAudio.getPhonkBroadcastVolume());
  const [isTestingPhonk, setIsTestingPhonk] = useState(false);
  const hasDocumentPiP = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const refreshAudioDevices = async () => {
    const devs = await broadcastAudio.getOutputDevices();
    setAudioDevices(devs);
    const autoCable = broadcastAudio.getAutoCableDeviceId();
    const current = broadcastAudio.getSelectedDeviceId();
    if (current && current !== 'default') {
      setSelectedAudioDevice(current);
    } else if (autoCable) {
      setSelectedAudioDevice(autoCable);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAudioDevices();
      setIsBroadcastingAudio(broadcastAudio.getIsBroadcasting());
    }
  }, [isOpen]);

  useEffect(() => {
    return broadcastAudio.subscribe((active) => {
      setIsBroadcastingAudio(active);
      refreshAudioDevices();
    });
  }, []);

  // Animate live VU meter when broadcasting
  useEffect(() => {
    if (!isBroadcastingAudio || !isOpen) {
      setAudioLevel(0);
      return;
    }
    let animId: number;
    const updateMeter = () => {
      setAudioLevel(broadcastAudio.getAudioLevel());
      animId = requestAnimationFrame(updateMeter);
    };
    animId = requestAnimationFrame(updateMeter);
    return () => cancelAnimationFrame(animId);
  }, [isBroadcastingAudio, isOpen]);

  const handleToggleBroadcastAudio = async () => {
    if (isBroadcastingAudio) {
      broadcastAudio.stopBroadcast();
    } else {
      const autoCable = broadcastAudio.getAutoCableDeviceId();
      const targetDevice = (selectedAudioDevice && selectedAudioDevice !== 'default')
        ? selectedAudioDevice
        : (autoCable || 'default');
      await broadcastAudio.startBroadcast(targetDevice);
      await refreshAudioDevices();
    }
  };

  const handleTestPhonkDrop = async () => {
    setIsTestingPhonk(true);
    await phonkAudio.playQuickPhonkTest();
    setTimeout(() => setIsTestingPhonk(false), 4250);
  };

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

              {/* Feature 3: In-App Voice + Phonk Audio Broadcast (For OmeTV, WhatsApp, Teams) */}
              <div className="p-3.5 bg-gray-950/70 border border-cyber-green/40 rounded flex flex-col gap-3 hover:border-cyber-green transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyber-green" />
                    <span className="font-bold text-sm text-white">Live Voice + Phonk Broadcast Mixer (OmeTV / WhatsApp)</span>
                  </div>
                  <button
                    onClick={handleToggleBroadcastAudio}
                    className={`px-3 py-1.5 rounded-full font-bold text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      isBroadcastingAudio
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/40 animate-pulse'
                        : 'bg-cyber-green text-black hover:bg-white shadow-md shadow-cyber-green/30'
                    }`}
                  >
                    {isBroadcastingAudio ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isBroadcastingAudio ? 'STOP BROADCAST' : 'START AUDIO BROADCAST'}</span>
                  </button>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  Mixes your <strong>real microphone voice</strong> with <strong>Phonk beat drops</strong> directly in-browser and streams it directly to your virtual mic device without changing your Windows default speakers!
                </p>

                {audioDevices.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 font-bold">Broadcast Output Target:</span>
                      <button
                        onClick={refreshAudioDevices}
                        className="text-[10px] text-cyber-cyan hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Refresh Devices</span>
                      </button>
                    </div>
                    <select
                      value={selectedAudioDevice}
                      onChange={(e) => {
                        setSelectedAudioDevice(e.target.value);
                        if (isBroadcastingAudio) {
                          broadcastAudio.changeOutputDevice(e.target.value);
                        }
                      }}
                      className="bg-black border border-gray-700 text-cyber-cyan text-xs rounded px-2.5 py-1.5 focus:border-cyber-green outline-none w-full truncate font-mono"
                    >
                      {audioDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label} {d.isCableInput ? '⭐ [RECOMMENDED FOR MEET / OMETV]' : d.isCable ? '(Virtual Cable)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Phonk Mic Broadcast Volume Slider */}
                <div className="p-2.5 bg-black/60 rounded border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-300 font-bold flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyber-cyan" />
                      Phonk Call Mic Volume (Speech-Calibrated):
                    </span>
                    <span className="font-mono font-bold text-cyber-green">
                      {Math.round(broadcastPhonkVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.0"
                    step="0.02"
                    value={broadcastPhonkVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setBroadcastPhonkVolume(val);
                      broadcastAudio.setPhonkBroadcastVolume(val);
                    }}
                    className="w-full accent-cyber-green h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400">
                    Calibrated to 40%-55% on Chrome's meter so Google Meet / Telegram WebRTC sees it as normal human voice and does not mute it.
                  </p>
                </div>

                {/* Live VU Meter when broadcasting */}
                {isBroadcastingAudio && (
                  <div className="p-2.5 bg-black/80 rounded border border-gray-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <Activity className="w-3.5 h-3.5 text-cyber-green animate-pulse" />
                        Live Broadcast Signal (Mic Voice + Phonk Drops):
                      </span>
                      <span className="font-bold text-cyber-green font-mono">
                        {Math.round(audioLevel * 100)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700 p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${Math.max(4, Math.min(100, audioLevel * 100))}%`,
                          background: audioLevel > 0.65
                            ? 'linear-gradient(90deg, #00ff66 0%, #ffe600 70%, #ff0055 100%)'
                            : 'linear-gradient(90deg, #00f0ff 0%, #00ff66 100%)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 1-Click Phonk Drop Test Button */}
                <div className="pt-0.5">
                  <button
                    onClick={handleTestPhonkDrop}
                    disabled={isTestingPhonk}
                    className={`w-full py-2 px-3 rounded text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                      isTestingPhonk
                        ? 'bg-cyber-green/20 text-cyber-green border-cyber-green animate-pulse'
                        : 'bg-cyber-cyan/15 hover:bg-cyber-cyan/30 text-cyber-cyan border-cyber-cyan/40 hover:border-cyber-cyan active:scale-98'
                    }`}
                  >
                    <Play className={`w-3.5 h-3.5 ${isTestingPhonk ? 'animate-spin' : ''}`} />
                    <span>{isTestingPhonk ? 'PLAYING TEST PHONK DROP...' : 'TEST PHONK DROP (HEAR IN HEADPHONES & CABLE)'}</span>
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-1">
                    Click this button while on your video call to immediately verify that the Phonk beat plays through your headphones and into the call!
                  </p>
                </div>

                {/* WebRTC Anti-Mute Audio Shield Banner */}
                <div className="p-2.5 bg-cyber-green/10 border border-cyber-green/40 rounded flex items-start gap-2 text-xs text-cyber-green">
                  <CheckCircle2 className="w-4 h-4 text-cyber-green flex-shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="text-white">WEBRTC ANTI-MUTE DSP ACTIVE:</strong>
                    <p className="mt-0.5 text-gray-300">
                      Our audio engine injects vocal-formant harmonics and a subtle speech-activity carrier directly into CABLE Input. This tricks Google Meet, Telegram & OmeTV into treating the Phonk beat as active human speech, passing the music across the call even if there are no noise-cancellation settings in your browser!
                    </p>
                  </div>
                </div>

                {isBroadcastingAudio && (
                  <div className="p-2.5 bg-cyber-green/10 border border-cyber-green/50 rounded flex flex-col gap-1 text-[11px] text-cyber-green">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping" />
                      <span>LIVE AUDIO BROADCAST ACTIVE</span>
                    </div>
                    <p className="text-gray-300 text-[10.5px]">
                      👉 In <strong>OmeTV / WhatsApp / Teams / Meet</strong>: Set your <strong>Microphone</strong> to <strong className="text-white bg-black/60 px-1 py-0.5 rounded border border-gray-700">CABLE Output (VB-Audio)</strong>.
                    </p>
                  </div>
                )}

                <div className="p-2 bg-black/60 rounded border border-gray-800 text-[11px] text-gray-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyber-green flex-shrink-0" />
                  <span>
                    <strong>100% Safe:</strong> Your normal headphones, YouTube, reels, and incoming callers remain 100% untouched on your regular headphones!
                  </span>
                </div>
              </div>

              {/* Streamer Golden Rule for Window Capture & Minimization */}
              <div className="p-3 bg-yellow-950/40 border border-yellow-500/50 rounded flex items-start gap-2.5 text-yellow-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-yellow-400">Why Video Freezes on Minimize:</strong> Windows OS DWM permanently stops rendering any window minimized (<kbd className="px-1 py-0.2 bg-black/60 rounded text-[10px]">_</kbd>) to the taskbar. To chat on Google Meet while broadcasting:
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-300">
                    <li><strong className="text-cyber-green">Recommended:</strong> Use <strong>Always-On-Top PiP</strong> (floats neatly over your meeting — zero freeze, no need to minimize!).</li>
                    <li>Or keep the Projector Window open behind Google Meet instead of minimizing to taskbar.</li>
                  </ul>
                </div>
              </div>

              {/* Broadcast Launch Actions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                
                {/* Action 1: Always-on-top PiP (if supported) */}
                {hasDocumentPiP && (
                  <div className="p-4 bg-gray-950 border border-cyber-green/60 rounded flex flex-col justify-between gap-3 shadow-lg shadow-cyber-green/10 md:col-span-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-cyber-green font-bold text-sm">
                        <Maximize2 className="w-4 h-4 text-glow-green" />
                        <span>🌟 Always-On-Top PiP Window (Best for Google Meet / OmeTV)</span>
                        <span className="text-[10px] bg-cyber-green/20 text-cyber-green px-2 py-0.5 rounded font-mono">RECOMMENDED</span>
                      </div>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        Creates an unthrottled, <strong>always-on-top floating camera window</strong> in the corner of your screen that floats directly over Google Meet, Teams, or OmeTV. Because it floats on top, you never have to minimize it, and Chrome <strong>never freezes the feed</strong> when you switch tabs or chat!
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onOpenProjector('pip');
                        onClose();
                      }}
                      className="w-full py-2.5 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-cyber-green/30 cursor-pointer"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>LAUNCH ALWAYS-ON-TOP PIP (RECOMMENDED)</span>
                    </button>
                  </div>
                )}

                {/* Action 2: Pop-out Projector Window */}
                <div className="p-4 bg-gray-950 border border-cyber-cyan/40 rounded flex flex-col justify-between gap-3 shadow-lg shadow-cyber-cyan/10">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-cyber-cyan font-bold text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span>Clean Pop-out Projector</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Opens a clean, borderless 16:9 window with <strong>ZERO UI</strong> powered by an independent 60 FPS video decoder. Perfect for secondary screens or placing behind other apps.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onOpenProjector('window');
                      onClose();
                    }}
                    className="w-full py-2 bg-cyber-cyan hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-cyber-cyan/20 cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>LAUNCH PROJECTOR WINDOW</span>
                  </button>
                </div>

                {/* Action 3: Clean Zero-UI Mode */}
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
                    className="w-full py-2 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all flex items-center justify-center gap-2 shadow-md shadow-cyber-green/20 cursor-pointer"
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
                  <span>Connect Video & Phonk Audio to Google Meet, OmeTV, or Teams</span>
                </div>
                <div className="pl-7 space-y-2.5 text-gray-300">
                  <div className="flex items-start gap-2">
                    <Video className="w-4 h-4 text-cyber-green flex-shrink-0 mt-0.5" />
                    <span><strong>Camera:</strong> In Google Meet / Teams settings, select <strong>"OBS Virtual Camera"</strong>.</span>
                  </div>

                  <div className="flex items-start gap-2 bg-gray-900/80 p-2.5 rounded border border-gray-800">
                    <Volume2 className="w-4 h-4 text-cyber-cyan flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 text-[11px]">
                      <span className="text-cyber-cyan font-bold block">How to Send Phonk Music to the Meeting:</span>
                      <p className="text-gray-300 leading-relaxed">
                        OBS Virtual Camera sends video. To send <strong>both your voice AND the Phonk drop</strong> into the meeting, use the free <strong>VB-CABLE Virtual Audio Driver</strong> (used by all streamers):
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400 pl-1">
                        <li>Install free <strong>VB-CABLE</strong> (creates a virtual audio device in Windows).</li>
                        <li>In OBS, add <strong>Audio Input Capture</strong> (your mic) and <strong>Application Audio Capture</strong> (select Chrome).</li>
                        <li>In OBS <strong>Settings ➔ Audio ➔ Advanced ➔ Monitoring Device</strong>, select <strong>CABLE Input</strong>.</li>
                        <li>In OBS Audio Mixer ➔ <strong>Advanced Audio Properties</strong>, set both your Mic & Chrome audio to <strong>"Monitor and Output"</strong>.</li>
                        <li>In Google Meet / Teams <strong>Audio Settings</strong>, set Microphone to <strong>CABLE Output (VB-Audio)</strong> and <strong className="text-yellow-400">turn OFF Noise Cancellation</strong> (so Meet doesn't filter out 808 bass drops)!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cyber-green/10 border border-cyber-green/30 rounded flex items-center gap-2.5 text-cyber-green text-[11px]">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Now sip water or adjust your glasses in your video chat — the Phonk edit and hard bass drop will blast across the call for everyone!</span>
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
