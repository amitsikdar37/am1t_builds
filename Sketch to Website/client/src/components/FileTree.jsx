import { useMemo, useState } from 'react';
import '../styles/FileTree.css';

// Build a tree object from flat file paths
function buildTree(files) {
  const root = {};
  Object.keys(files).forEach((path) => {
    const parts = path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      if (!node[part]) {
        node[part] = i === parts.length - 1
          ? { __isFile: true, __path: path }
          : {};
      }
      if (!node[part].__isFile) node = node[part];
    });
  });
  return root;
}

// Get language color from file extension
function getLangColor(filename) {
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return '#61dafb';
  if (filename.endsWith('.js')  || filename.endsWith('.ts'))  return '#f7df1e';
  if (filename.endsWith('.css'))   return '#264de4';
  if (filename.endsWith('.html'))  return '#e34c26';
  if (filename.endsWith('.json'))  return '#8bc34a';
  if (filename.endsWith('.md'))    return '#ffffff';
  return '#888';
}

function getFileIcon(filename) {
  if (filename.endsWith('.jsx') || filename.endsWith('.tsx')) return '⚛';
  if (filename.endsWith('.css'))   return '🎨';
  if (filename.endsWith('.html'))  return '🌐';
  if (filename.endsWith('.json'))  return '{}';
  if (filename.endsWith('.js'))    return 'JS';
  if (filename.endsWith('.md'))    return '📄';
  return '📄';
}

function TreeNode({ name, node, depth, selectedFile, onSelectFile, defaultOpen = false }) {
  const isFile = node.__isFile;
  const [isOpen, setIsOpen] = useState(defaultOpen || depth < 2);

  if (isFile) {
    const isSelected = node.__path === selectedFile;
    return (
      <button
        className={`tree-file ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => onSelectFile(node.__path)}
        title={node.__path}
        aria-selected={isSelected}
        id={`file-${node.__path.replace(/[^a-z0-9]/gi, '-')}`}
      >
        <span className="file-icon" style={{ color: getLangColor(name) }}>
          {getFileIcon(name)}
        </span>
        <span className="file-name">{name}</span>
        {isSelected && <span className="file-active-dot" />}
      </button>
    );
  }

  // Directory
  const children = Object.entries(node).filter(([k]) => !k.startsWith('__'));

  return (
    <div className="tree-dir">
      <button
        className={`tree-dir-btn ${isOpen ? 'open' : ''}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        onClick={() => setIsOpen(o => !o)}
      >
        <svg
          className={`dir-arrow ${isOpen ? 'rotated' : ''}`}
          width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
        >
          <path d="M3 2l4 3-4 3V2z"/>
        </svg>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dir-icon">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="dir-name">{name}</span>
        <span className="dir-count">{children.length}</span>
      </button>

      {isOpen && (
        <div className="tree-children">
          {children
            .sort(([, a], [, b]) => {
              // Directories first, then files
              const aIsFile = a.__isFile ? 1 : 0;
              const bIsFile = b.__isFile ? 1 : 0;
              return aIsFile - bIsFile;
            })
            .map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                defaultOpen={depth < 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, selectedFile, onSelectFile }) {
  const tree = useMemo(() => buildTree(files), [files]);
  const entries = Object.entries(tree);
  const fileCount = Object.keys(files).length;

  return (
    <div className="file-tree">
      <div className="tree-header">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        Explorer
        <span className="tree-count">{fileCount}</span>
      </div>

      <div className="tree-body">
        {entries
          .sort(([, a], [, b]) => {
            const aIsFile = a.__isFile ? 1 : 0;
            const bIsFile = b.__isFile ? 1 : 0;
            return aIsFile - bIsFile;
          })
          .map(([name, node]) => (
            <TreeNode
              key={name}
              name={name}
              node={node}
              depth={0}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              defaultOpen
            />
          ))}
      </div>
    </div>
  );
}
