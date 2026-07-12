import { useState, useMemo } from 'react';
import FileTree from './FileTree.jsx';
import CodeViewer from './CodeViewer.jsx';
import PreviewFrame from './PreviewFrame.jsx';
import '../styles/ResultsView.css';

export default function ResultsView({ files, layout, sketchImage }) {
  const [selectedFile, setSelectedFile] = useState(() => {
    // Default selected file priority
    const priority = ['preview.html', 'src/App.jsx', 'index.html'];
    for (const p of priority) {
      if (files[p]) return p;
    }
    return Object.keys(files)[0] || '';
  });

  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fileCount = Object.keys(files).length;

  // Extract preview.html for the iframe
  const previewHtml = useMemo(() => files['preview.html'] || null, [files]);

  // Download all files as ZIP
  const handleDownloadZip = async () => {
    if (!window.JSZip || !window.saveAs) {
      alert('ZIP library not loaded. Please refresh the page.');
      return;
    }

    const zip = new window.JSZip();
    const projectName = layout?.pageTitle?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'my-website';
    const folder = zip.folder(projectName);

    Object.entries(files).forEach(([path, content]) => {
      if (path !== 'preview.html') {
        folder.file(path, content);
      }
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    window.saveAs(blob, `${projectName}.zip`);
  };

  // Stats for the info bar
  const stats = useMemo(() => {
    const allPaths = Object.keys(files);
    const jsxFiles = allPaths.filter(p => p.endsWith('.jsx')).length;
    const cssFiles = allPaths.filter(p => p.endsWith('.css')).length;
    const components = allPaths.filter(p => p.includes('/components/')).length;
    return { total: allPaths.length, jsxFiles, cssFiles, components };
  }, [files]);

  return (
    <div className="results-page">

      {/* ── Top info bar ───────────────────────────────── */}
      <div className="results-infobar">
        <div className="infobar-left">
          <div className="infobar-title">
            <div className="infobar-dot" />
            {layout?.pageTitle || 'Generated Website'}
            <span className="infobar-tag">{layout?.pageType}</span>
          </div>
          <div className="infobar-stats">
            <span>{stats.total} files</span>
            <span className="stat-sep">·</span>
            <span>{stats.components} components</span>
            <span className="stat-sep">·</span>
            <span>{stats.jsxFiles} JSX</span>
            <span className="stat-sep">·</span>
            <span>{stats.cssFiles} CSS</span>
          </div>
        </div>

        <div className="infobar-right">
          {/* View toggle */}
          <div className="view-toggle" role="tablist" aria-label="View mode">
            <button
              role="tab"
              aria-selected={activeTab === 'code'}
              className={`toggle-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
              id="tab-code"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              Code
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'preview'}
              className={`toggle-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
              id="tab-preview"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Preview
            </button>
          </div>

          <button
            className="btn btn-primary download-btn"
            onClick={handleDownloadZip}
            id="btn-download-zip"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download ZIP
          </button>
        </div>
      </div>

      {/* ── Main workspace ─────────────────────────────── */}
      <div className="results-workspace">

        {/* Sidebar toggle button (mobile) */}
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsSidebarOpen(o => !o)}
          aria-label="Toggle file tree"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isSidebarOpen
              ? <><path d="M18 6L6 18M6 6l12 12"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
          {isSidebarOpen ? 'Hide' : 'Files'}
        </button>

        {/* File Tree Sidebar */}
        <aside className={`results-sidebar ${isSidebarOpen ? 'open' : 'collapsed'}`}>
          <FileTree
            files={files}
            selectedFile={selectedFile}
            onSelectFile={(f) => { setSelectedFile(f); setActiveTab('code'); }}
          />

          {/* Sketch thumbnail in sidebar */}
          {sketchImage && (
            <div className="sidebar-sketch-thumb">
              <div className="thumb-label">Original Sketch</div>
              <img src={sketchImage} alt="Original sketch" className="thumb-img" />
            </div>
          )}
        </aside>

        {/* Main panel */}
        <main className="results-main" role="tabpanel">
          {activeTab === 'code' ? (
            <CodeViewer
              files={files}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
            />
          ) : (
            <PreviewFrame html={previewHtml} />
          )}
        </main>

      </div>
    </div>
  );
}
