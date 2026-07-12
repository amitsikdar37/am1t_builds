import { useState } from 'react';
import AppHeader from './components/AppHeader.jsx';
import UploadZone from './components/UploadZone.jsx';
import GeneratingView from './components/GeneratingView.jsx';
import ResultsView from './components/ResultsView.jsx';

/**
 * App — top-level state machine
 * steps: 'upload' → 'generating' → 'results'
 */
export default function App() {
  const [step, setStep] = useState('upload');
  const [sketchImage, setSketchImage] = useState(null);  // data URL for preview
  const [layout, setLayout] = useState(null);
  const [files, setFiles] = useState({});
  const [progress, setProgress] = useState({ step: '', message: 'Starting up...' });

  /**
   * Called by UploadZone when the user hits "Generate Website".
   * @param {string} dataUrl  - base64 data URL of the sketch image
   * @param {string} mimeType - image MIME type
   */
  const handleSketchUpload = async (dataUrl, mimeType) => {
    setSketchImage(dataUrl);
    setStep('generating');
    setProgress({ step: 'starting', message: 'Connecting to AI...' });

    try {
      // Phase 1: POST the image to start the job
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

      const startRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType })
      });

      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `HTTP ${startRes.status}`);
      }

      const { jobId } = await startRes.json();

      // Phase 2: Open SSE stream for real-time progress
      const eventSource = new EventSource(`/api/generate/${jobId}/progress`);

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'progress') {
            setProgress({ step: event.step, message: event.message, layout: event.layout });

          } else if (event.type === 'complete') {
            eventSource.close();
            setLayout(event.layout);
            setFiles(event.files);
            setStep('results');

          } else if (event.type === 'error') {
            eventSource.close();
            const msg = event.message || '';
            let friendly = `Generation failed:\n${msg}`;

            if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              friendly = '⚠️ Gemini API Quota Exceeded\n\nYour API key has run out of free tier requests.\n\nFix: Go to https://aistudio.google.com/apikey → create a NEW key → paste it in the .env file, then restart the server.';
            } else if (msg.includes('401') || msg.includes('API_KEY_INVALID') || msg.includes('403')) {
              friendly = '🔑 Invalid API Key\n\nYour GEMINI_API_KEY is incorrect or expired.\n\nFix: Go to https://aistudio.google.com/apikey → create a new key → paste it in the .env file.';
            }

            alert(friendly);
            setStep('upload');
          }
        } catch (parseErr) {
          console.error('SSE parse error:', parseErr);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        eventSource.close();
        // Only reset if we haven't already moved to results
        setStep(prev => prev === 'generating' ? 'upload' : prev);
      };

    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to start generation:\n${error.message}`);
      setStep('upload');
    }
  };

  const handleReset = () => {
    setStep('upload');
    setSketchImage(null);
    setLayout(null);
    setFiles({});
    setProgress({ step: '', message: '' });
  };

  return (
    <div className="app">
      <AppHeader step={step} onReset={step !== 'upload' ? handleReset : null} />

      <main className="app-main">
        {step === 'upload' && (
          <UploadZone onUpload={handleSketchUpload} />
        )}

        {step === 'generating' && (
          <GeneratingView sketchImage={sketchImage} progress={progress} />
        )}

        {step === 'results' && (
          <ResultsView files={files} layout={layout} sketchImage={sketchImage} />
        )}
      </main>
    </div>
  );
}
