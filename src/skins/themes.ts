// Theme presets for the "Theme" button -- each one just re-points the same
// CSS custom properties every component already reads from (--accent-magenta,
// --bg-panel, etc.), so swapping a theme is purely a runtime variable swap,
// no component changes needed.

export interface ThemeColors {
  accentMagenta: string;
  accentCyan: string;
  accentViolet: string;
  borderViolet: string;
  bgVoid: string;
  bgPanel: string;
  bgPanelRaised: string;
  bgScreen: string;
  glowMagenta: string;
  glowCyan: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  colors: ThemeColors;
}

export const THEMES: ThemePreset[] = [
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Neon',
    // Colors: hazard yellow / red / cyan / black -- closer to the actual
    // Cyberpunk 2077 brand palette. Variable names kept as-is (accentMagenta,
    // accentViolet) to avoid touching every component that reads them, but
    // semantically here: accentMagenta = red, accentViolet = neon yellow.
    colors: {
      accentMagenta: '#ff003c',
      accentCyan: '#00f0ff',
      accentViolet: '#fcee0a',
      borderViolet: '#2e2812',
      bgVoid: '#050403',
      bgPanel: '#100e08',
      bgPanelRaised: '#191509',
      bgScreen: '#030201',
      glowMagenta: '0 0 6px rgba(255, 0, 60, 0.7), 0 0 16px rgba(255, 0, 60, 0.3)',
      glowCyan: '0 0 6px rgba(0, 240, 255, 0.7), 0 0 16px rgba(0, 240, 255, 0.28)',
    },
  },
  {
    id: 'lcd-green',
    label: 'LCD Green',
    colors: {
      accentMagenta: '#39ff6a',
      accentCyan: '#a8ffcf',
      accentViolet: '#2a6b3f',
      borderViolet: '#1e3d27',
      bgVoid: '#050a06',
      bgPanel: '#0c140d',
      bgPanelRaised: '#132018',
      bgScreen: '#030603',
      glowMagenta: '0 0 6px rgba(57, 255, 106, 0.7), 0 0 16px rgba(57, 255, 106, 0.3)',
      glowCyan: '0 0 6px rgba(168, 255, 207, 0.7), 0 0 16px rgba(168, 255, 207, 0.25)',
    },
  },
  {
    id: 'vaporwave',
    label: 'Vaporwave Pastel',
    colors: {
      accentMagenta: '#ff71ce',
      accentCyan: '#01cdfe',
      accentViolet: '#b967ff',
      borderViolet: '#4d3b6b',
      bgVoid: '#140f24',
      bgPanel: '#1f1733',
      bgPanelRaised: '#2b2144',
      bgScreen: '#100b1e',
      glowMagenta: '0 0 6px rgba(255, 113, 206, 0.7), 0 0 16px rgba(255, 113, 206, 0.3)',
      glowCyan: '0 0 6px rgba(1, 205, 254, 0.7), 0 0 16px rgba(1, 205, 254, 0.28)',
    },
  },
  {
    id: 'vampire',
    label: 'Vampire',
    // Mostly black and red, purple pushed way down to near-black so it just
    // reads as shadow rather than its own hue. accentCyan still does double
    // duty as the "readable light accent" role (column headers, marquee
    // text) -- here a pale rose/moonlight tone rather than true cyan or
    // lavender, since it needs to stay light enough for contrast against
    // near-black backgrounds.
    colors: {
      accentMagenta: '#c81e3d',
      accentCyan: '#e6c2c2',
      accentViolet: '#5c1420',
      borderViolet: '#1f0a0e',
      bgVoid: '#0a0505',
      bgPanel: '#140808',
      bgPanelRaised: '#1e0d0d',
      bgScreen: '#070303',
      glowMagenta: '0 0 6px rgba(200, 30, 61, 0.7), 0 0 16px rgba(200, 30, 61, 0.3)',
      glowCyan: '0 0 6px rgba(230, 194, 194, 0.7), 0 0 16px rgba(230, 194, 194, 0.28)',
    },
  },
];
