export const BOARD_THEMES = [
  { id: 'classic',    name: 'Classic',    light: '#eeeed2', dark: '#769656' },
  { id: 'walnut',     name: 'Walnut',     light: '#f0d9b5', dark: '#b58863' },
  { id: 'ocean',      name: 'Ocean',      light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'lavender',   name: 'Lavender',   light: '#f0e4ff', dark: '#7c5cbf' },
  { id: 'coral',      name: 'Coral',      light: '#f5dbd5', dark: '#b85040' },
  { id: 'teal',       name: 'Teal',       light: '#d4ede8', dark: '#3a9e8a' },
  { id: 'tournament', name: 'Tournament', light: '#d8d8d8', dark: '#6e6e6e' },
  { id: 'night',      name: 'Night',      light: '#b8a898', dark: '#3a2a1e' },
] as const;

export type BoardTheme = typeof BOARD_THEMES[number];

export function loadSavedTheme(): BoardTheme {
  const saved = localStorage.getItem('chessboard-theme');
  return BOARD_THEMES.find(t => t.id === saved) ?? BOARD_THEMES.find(t => t.id === 'walnut')!;
}
