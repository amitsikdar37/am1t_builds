/**
 * Mapping of programming languages to vibrant celestial spectral hex colors
 * Ensures high luminosity in deep space rendering (no muddy/slate grey stars)
 */
export const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: '#facc15', // Brilliant Solar Yellow
  TypeScript: '#38bdf8', // Radiant Cyan
  Python: '#60a5fa',     // Vibrant Celestial Blue
  Rust: '#fb923c',       // Glowing Stellar Orange
  'C++': '#f43f5e',      // Hot Pulsar Rose/Magenta
  C: '#3b82f6',          // Deep Radiant Sapphire Blue (replaces dull grey)
  'C#': '#22c55e',       // Vivid Nebula Emerald
  Go: '#06b6d4',         // Ion Turquoise
  Java: '#f97316',       // Amber Supergiant
  Kotlin: '#a855f7',     // Ultraviolet Violet
  Swift: '#ff5436',      // Flare Vermilion
  Ruby: '#ef4444',       // Crimson Star
  PHP: '#818cf8',        // Lavender Blue
  HTML: '#fb7185',       // Coronal Coral
  CSS: '#a78bfa',        // Amethyst Violet
  SCSS: '#f472b6',       // Electric Pink
  Vue: '#34d399',        // Auroral Mint
  Svelte: '#ff6b35',     // Hyper-Orange
  Shell: '#4ade80',      // Gamma Green
  Bash: '#4ade80',       // Gamma Green
  PowerShell: '#38bdf8', // Plasma Blue
  Dart: '#14b8a6',       // Hyperion Teal
  Elixir: '#c084fc',     // Mystic Purple
  Erlang: '#e879f9',     // Magenta Pulse
  Haskell: '#c084fc',    // Supernova Purple
  Lua: '#60a5fa',        // Sky Blue
  R: '#38bdf8',          // Oceanic Cyan
  Julia: '#c084fc',      // Stellar Orchid
  Scala: '#f43f5e',      // Red Flare
  Clojure: '#f87171',    // Coral Red
  Solidity: '#fb923c',   // Molten Gold
  Zig: '#fbbf24',        // Amber Gold
  Nim: '#fde047',        // Solar Yellow
  OCaml: '#4ade80',      // Emerald
  Perl: '#38bdf8',       // Cyan
  GraphQL: '#f43f5e',    // Deep Fuchsia
  SQL: '#fbbf24',        // Warm Amber
  Assembly: '#fb923c',   // Radiant Bronze
  Vim: '#34d399',        // Neon Emerald
  Dockerfile: '#38bdf8', // Atmospheric Cyan
  Markdown: '#f8fafc',   // Stellar White Dwarf
  Unknown: '#f8fafc',    // Stellar Brilliant White
};

/**
 * Returns hex color for a given language name
 * Guarantees zero muddy grey rendering in deep space
 */
export function getLanguageColor(language: string | null | undefined, apiColor?: string | null): string {
  if (!language) {
    return '#f8fafc'; // Intense stellar silver-white
  }

  // 1. Prefer our hand-picked brilliant celestial colors first to maximize variety!
  if (LANGUAGE_COLORS[language]) {
    return LANGUAGE_COLORS[language];
  }

  // 2. Fallback to GitHub API color
  if (apiColor && apiColor.startsWith('#')) {
    const hex = apiColor.toLowerCase();
    // Replace dull grey with vibrant sapphire blue
    if (hex === '#555555' || hex === '#555' || hex === '#333333' || hex === '#666666' || hex === '#888888') {
      return '#3b82f6'; 
    }
    return apiColor;
  }
  
  return '#38bdf8'; // Default vibrant cosmic cyan
}

/**
 * Categorizes celestial spectral class based on language & star count
 */
export function getSpectralClass(language: string, stars: number): string {
  if (stars >= 5000) return 'Class O - Hypergiant Luminary';
  if (stars >= 1000) return 'Class B - Blue Supergiant';
  if (stars >= 200) return 'Class A - Brilliant White Star';
  if (stars >= 50) return 'Class F - Yellow-White Giant';
  if (stars >= 10) return 'Class G - Solar Main-Sequence';
  if (stars >= 2) return 'Class K - Orange Subgiant';
  return 'Class M - Red/White Dwarf';
}
