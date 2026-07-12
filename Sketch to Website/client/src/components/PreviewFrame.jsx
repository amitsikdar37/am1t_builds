import { useState } from 'react';
import '../styles/PreviewFrame.css';

export default function PreviewFrame({ html }) {
  const [scale, setScale] = useState(100);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!html) {
    return (
      <div className="preview-frame no-preview">
        <div className="no-preview-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </div>
        <p className="no-preview-text">No preview available</p>
        <p className="no-preview-sub">
          The AI didn't generate a <code>preview.html</code> file. 
          View the code and download the ZIP to run the full React app.
        </p>
      </div>
    );
  }

  return (
    <div className="preview-frame">
      {/* Browser chrome */}
      <div className="pf-chrome">
        <div className="pf-chrome-dots" aria-hidden="true">
          <span className="dot dot-red"   />
          <span className="dot dot-yellow"/>
          <span className="dot dot-green" />
        </div>

        <div className="pf-address-bar">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          preview.html — Generated Website
        </div>

        <div className="pf-chrome-actions">
          {/* Scale controls */}
          <select
            className="pf-scale-select"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            aria-label="Preview zoom level"
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
          </select>

          <button className="pf-chrome-btn" onClick={handleRefresh} aria-label="Refresh preview">
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: isRefreshing ? 'spin 0.5s linear' : 'none' }}
            >
              <path d="M1 4v6h6M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* iframe */}
      <div className="pf-viewport">
        {!isRefreshing && (
          <iframe
            key={isRefreshing ? 'refreshing' : 'visible'}
            className="pf-iframe"
            srcDoc={html}
            title="Generated website preview"
            sandbox="allow-scripts allow-same-origin"
            style={{ transform: `scale(${scale / 100})`, transformOrigin: 'top left', width: `${10000 / scale}%`, height: `${10000 / scale}%` }}
          />
        )}
      </div>
    </div>
  );
}
