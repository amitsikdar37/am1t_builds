import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, ExternalLink, X, Check, Trash2 } from 'lucide-react';

interface CustomTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTokenSaved: (token: string) => void;
}

export const CustomTokenModal: React.FC<CustomTokenModalProps> = ({
  isOpen,
  onClose,
  onTokenSaved,
}) => {
  const [token, setToken] = useState('');
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('github_custom_token') || '';
      setToken(stored);
      setHasExistingToken(Boolean(stored));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      const trimmed = token.trim();
      if (trimmed) {
        localStorage.setItem('github_custom_token', trimmed);
        setHasExistingToken(true);
        onTokenSaved(trimmed);
      } else {
        localStorage.removeItem('github_custom_token');
        setHasExistingToken(false);
        onTokenSaved('');
      }
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    }
  };

  const handleClear = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('github_custom_token');
      setToken('');
      setHasExistingToken(false);
      onTokenSaved('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-space-950/95 border border-cyan-500/30 text-white shadow-[0_0_50px_rgba(6,182,212,0.3)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-wide text-white">
                GitHub API Quantum Token
              </h3>
              <p className="text-xs text-slate-400">
                Boost rate limits from 60 to 5,000 requests/hour
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-cyan-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div>
              <strong className="text-cyan-300">100% Client-Safe & Read-Only:</strong>
              <p className="mt-0.5 text-[11px] text-cyan-200/80">
                Your token is never shared or stored remotely. It is stored securely in your browser's local storage and used solely to fetch public GitHub metrics via GraphQL.
              </p>
            </div>
          </div>

          <div>
            <label className="block mb-1.5 font-medium text-slate-200 font-mono text-[11px] uppercase tracking-wider">
              Personal Access Token (Classic or Fine-Grained)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_... or github_pat_..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-space-900/90 border border-cyan-500/30 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono text-xs shadow-inner"
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline underline-offset-2"
            >
              <span>Generate a token on GitHub (no special scopes needed)</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {hasExistingToken && (
              <button
                onClick={handleClear}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Clear Token
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" /> Saved!
              </>
            ) : (
              'Save & Apply Token'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
