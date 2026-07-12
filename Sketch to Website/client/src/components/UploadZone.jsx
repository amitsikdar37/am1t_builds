import { useState, useCallback, useRef } from 'react';
import '../styles/UploadZone.css';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

const FEATURES = [
  { icon: '🧠', label: 'Gemini Vision AI' },
  { icon: '⚛️', label: 'React Components' },
  { icon: '🎨', label: 'Separate CSS Files' },
  { icon: '👁️', label: 'Live Preview' },
  { icon: '📦', label: 'ZIP Download' },
];

export default function UploadZone({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview]       = useState(null);
  const [mimeType, setMimeType]     = useState('image/png');
  const [fileName, setFileName]     = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback((file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert('Please upload a PNG, JPG, WEBP, or GIF image.');
      return;
    }
    setMimeType(file.type);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop       = useCallback((e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }, [processFile]);
  const handleDragOver   = useCallback((e) => { e.preventDefault(); setIsDragging(true);  }, []);
  const handleDragLeave  = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleFileChange = (e) => processFile(e.target.files[0]);
  const handleRemove     = () => { setPreview(null); setFileName(''); };

  const handleGenerate = async () => {
    if (!preview || isStarting) return;
    setIsStarting(true);
    await onUpload(preview, mimeType);
    // If onUpload rejects/errors, parent will reset step; component unmounts
  };

  return (
    <div className="upload-page">
      {/* Ambient orbs */}
      <div className="orb orb-purple" aria-hidden="true" />
      <div className="orb orb-cyan"   aria-hidden="true" />
      <div className="grid-overlay"   aria-hidden="true" />

      <div className="upload-container">

        {/* ── Hero text ──────────────────────────────────── */}
        <div className="upload-hero anim-fade-up">
          <div className="hero-badge">
            <span className="badge-pulse" />
            AI-Powered  ·  Gemini 2.0 Flash Vision
          </div>
          <h1 className="hero-title">
            Sketch it.
            <br />
            <span className="gradient-text">We build it.</span>
          </h1>
          <p className="hero-subtitle">
            Drop a hand-drawn sketch of your website layout and let our AI 
            transform it into a beautiful, structured React codebase — instantly.
          </p>
        </div>

        {/* ── Upload / Preview ───────────────────────────── */}
        <div className="upload-card-wrap anim-fade-up" style={{ animationDelay: '0.08s' }}>
          {!preview ? (
            <div
              id="upload-dropzone"
              className={`dropzone ${isDragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload sketch image"
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <div className="dropzone-icon-wrap">
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                  <rect width="44" height="44" rx="13" fill="rgba(139,92,246,0.1)"/>
                  <path d="M22 30V18M22 18l-5 5M22 18l5 5" stroke="url(#dz-g)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 32h18" stroke="url(#dz-g)" strokeWidth="2.2" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="dz-g" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6"/>
                      <stop offset="100%" stopColor="#06b6d4"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <p className="dropzone-main">
                {isDragging ? '✦ Release to upload your sketch' : 'Drop your sketch here'}
              </p>
              <p className="dropzone-sub">
                or <span className="dropzone-link">browse files</span>
                <span className="dropzone-types"> · PNG, JPG, WEBP, GIF</span>
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
                id="file-input"
              />
            </div>
          ) : (
            <div className="preview-card anim-scale-in">
              <div className="preview-topbar">
                <div className="preview-filename">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {fileName}
                </div>
                <button className="preview-remove-btn" onClick={handleRemove} aria-label="Remove image">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                  Remove
                </button>
              </div>

              <div className="preview-img-wrap">
                <img src={preview} alt="Uploaded sketch" className="preview-img" />
                <button
                  className="preview-change-overlay"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Change Image
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="sr-only"/>
              </div>

              <div className="preview-hint">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                Gemini will analyze your sketch and generate a structured React website
              </div>
            </div>
          )}
        </div>

        {/* ── Generate button ────────────────────────────── */}
        {preview && (
          <div className="upload-cta anim-scale-in">
            <button
              id="btn-generate-website"
              className="btn btn-primary generate-btn"
              onClick={handleGenerate}
              disabled={isStarting}
            >
              {isStarting ? (
                <><span className="spinner" /> Connecting...</>
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                  Generate Website
                </>
              )}
            </button>
            <p className="generate-note">Takes ~30–60 seconds · Powered by Gemini 2.0 Flash</p>
          </div>
        )}

        {/* ── Feature pills ──────────────────────────────── */}
        <div className="feature-pills anim-fade-up" style={{ animationDelay: '0.15s' }}>
          {FEATURES.map((f) => (
            <div key={f.label} className="feature-pill">
              <span className="pill-icon">{f.icon}</span>
              <span className="pill-label">{f.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
