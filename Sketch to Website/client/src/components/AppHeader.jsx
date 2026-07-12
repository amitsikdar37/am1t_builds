import '../styles/AppHeader.css';

const LogoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#06b6d4" />
      </linearGradient>
    </defs>
    <path d="M12 2L2 7l10 5 10-5-10-5Z" stroke="url(#logo-grad)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M2 17l10 5 10-5" stroke="url(#logo-grad)" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M2 12l10 5 10-5" stroke="url(#logo-grad)" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

const STEPS = [
  { id: 'upload',     label: 'Upload Sketch' },
  { id: 'generating', label: 'AI Analysis'   },
  { id: 'results',    label: 'Your Website'  },
];

const stepIndex = (step) => STEPS.findIndex(s => s.id === step);

export default function AppHeader({ step, onReset }) {
  const current = stepIndex(step);

  return (
    <header className="app-header">
      <div className="app-header-inner">

        {/* Logo */}
        <button
          className="app-logo"
          onClick={onReset}
          disabled={!onReset}
          aria-label="Go back to upload"
        >
          <div className="logo-icon-wrap"><LogoIcon /></div>
          <span className="logo-word">Sketch</span>
          <span className="logo-arrow">→</span>
          <span className="logo-word logo-word-accent">Website</span>
        </button>

        {/* Step progress */}
        <nav className="header-steps" aria-label="Progress steps">
          {STEPS.map((s, i) => {
            const isDone   = i < current;
            const isActive = i === current;
            return (
              <div key={s.id} className="step-item">
                {i > 0 && <div className={`step-line ${isDone ? 'done' : ''}`} />}
                <div className={`step-pill ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                  <span className="step-num">
                    {isDone ? (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          strokeDasharray="30" strokeDashoffset="0" style={{animation:'draw-check 0.3s ease both'}}/>
                      </svg>
                    ) : (i + 1)}
                  </span>
                  <span className="step-label">{s.label}</span>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="header-actions">
          {onReset && (
            <button onClick={onReset} className="btn btn-secondary header-action-btn" id="btn-new-sketch">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              New Sketch
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
