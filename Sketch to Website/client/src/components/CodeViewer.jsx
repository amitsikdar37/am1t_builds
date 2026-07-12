import { useEffect, useRef, useState } from 'react';
import '../styles/CodeViewer.css';

function getLanguage(filename) {
  if (!filename) return 'plaintext';
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return 'javascript';
  if (filename.endsWith('.js')  || filename.endsWith('.ts'))  return 'javascript';
  if (filename.endsWith('.css'))   return 'css';
  if (filename.endsWith('.html'))  return 'html';
  if (filename.endsWith('.json'))  return 'json';
  if (filename.endsWith('.md'))    return 'markdown';
  return 'plaintext';
}

export default function CodeViewer({ files, selectedFile, onSelectFile }) {
  const codeRef  = useRef(null);
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const code     = files[selectedFile] || '';
  const language = getLanguage(selectedFile);
  const lineCount = code.split('\n').length;

  // Re-highlight whenever the selected file changes
  useEffect(() => {
    if (codeRef.current && window.hljs) {
      // Reset highlight state
      delete codeRef.current.dataset.highlighted;
      codeRef.current.className = `language-${language}`;
      codeRef.current.textContent = code;
      window.hljs.highlightElement(codeRef.current);
    }
  }, [selectedFile, code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!selectedFile) {
    return (
      <div className="code-viewer empty-state">
        <div className="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
        </div>
        <p>Select a file from the explorer</p>
      </div>
    );
  }

  return (
    <div className="code-viewer">
      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="cv-toolbar">
        <div className="cv-file-info">
          <span className="cv-filename">{selectedFile}</span>
          <span className="cv-meta">{lineCount} lines · {language}</span>
        </div>

        <div className="cv-actions">
          <button
            className={`cv-action-btn ${wrapLines ? 'active' : ''}`}
            onClick={() => setWrapLines(w => !w)}
            title="Toggle line wrap"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h15a3 3 0 0 1 0 6H3"/><polyline points="6 15 3 18 6 21"/>
            </svg>
            Wrap
          </button>

          <button
            className={`cv-action-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            id="btn-copy-code"
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Code area ────────────────────────────────── */}
      <div className="cv-code-wrap">
        {/* Line numbers */}
        <div className="cv-line-numbers" aria-hidden="true">
          {code.split('\n').map((_, i) => (
            <span key={i} className="cv-line-num">{i + 1}</span>
          ))}
        </div>

        {/* Highlighted code */}
        <pre className={`cv-pre ${wrapLines ? 'wrap' : ''}`}>
          <code ref={codeRef} className={`language-${language}`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
