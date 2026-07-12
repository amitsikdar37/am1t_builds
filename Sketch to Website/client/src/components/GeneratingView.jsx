import { useEffect, useState } from 'react';
import '../styles/GeneratingView.css';

// Steps map to SSE event step values
const STEPS = [
  { id: 'analyzing',  label: 'Waking up local Agent',                 icon: '🧠' },
  { id: 'generating', label: 'Agent is building your site locally',   icon: '⚛️' },
  { id: 'parsing',    label: 'Packaging generated files',             icon: '📁' },
];

const stepOrder = STEPS.map(s => s.id);

export default function GeneratingView({ sketchImage, progress }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const currentIndex = Math.max(0, stepOrder.indexOf(progress.step));

  // Animate steps entering one by one
  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCount(prev => {
        if (prev < STEPS.length) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 300);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="gen-page">
      <div className="gen-orb gen-orb-1" aria-hidden="true" />
      <div className="gen-orb gen-orb-2" aria-hidden="true" />

      <div className="gen-container">

        {/* ── Left: Sketch Preview ──────────────────────── */}
        <div className="gen-sketch-panel anim-fade-up">
          <div className="gen-sketch-label">Your Sketch</div>
          <div className="gen-sketch-frame">
            {sketchImage && (
              <img src={sketchImage} alt="Your sketch" className="gen-sketch-img" />
            )}
            <div className="gen-scan-line" aria-hidden="true" />
          </div>
          <div className="gen-sketch-badge">
            <span className="spinner" />
            Agent is looking at this...
          </div>
        </div>

        {/* ── Right: Progress Steps ─────────────────────── */}
        <div className="gen-progress-panel">
          <div className="gen-progress-header anim-fade-up">
            <h2 className="gen-title">Building your website</h2>
            <p className="gen-subtitle">
              {progress.message || 'Connecting to local Antigravity Agent...'}
            </p>
          </div>

          <div className="gen-steps">
            {STEPS.map((step, i) => {
              const isDone    = i < currentIndex;
              const isActive  = i === currentIndex;
              const isVisible = i < visibleCount;

              return (
                <div
                  key={step.id}
                  className={`gen-step ${isVisible ? 'visible' : ''} ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="gen-step-icon-wrap">
                    {isDone ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : isActive ? (
                      <span className="step-spin-icon" aria-hidden="true" />
                    ) : (
                      <span>{step.icon}</span>
                    )}
                  </div>

                  <div className="gen-step-content">
                    <span className="gen-step-label">{step.label}</span>
                    {isActive && (
                      <span className="gen-step-status">In progress...</span>
                    )}
                    {isDone && (
                      <span className="gen-step-status done">Complete</span>
                    )}
                  </div>

                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div className={`gen-step-connector ${isDone ? 'done' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <div className="gen-tip" style={{ marginTop: '30px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
            </svg>
            This uses a local AI agent and may take 2–5 minutes. Don't close the tab.
          </div>
        </div>

      </div>
    </div>
  );
}
