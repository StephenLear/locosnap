export interface SpotterEmoji {
  id: string;
  label: string;
  isPro: boolean;
  source: 'unicode' | 'svg';
  glyph?: string;
  svgAsset?: string;
}

/**
 * Full curated set including SVG-source Pro emojis. The SVG assets are not
 * yet sourced — see frontend/assets/emoji-svg/.gitkeep. Until they land,
 * SPOTTER_EMOJIS (the exposed list) filters out SVG entries so users never
 * see broken placeholder tiles. When the assets ship, drop this filter.
 */
const ALL_SPOTTER_EMOJIS: SpotterEmoji[] = [
  // Free tier — Unicode train iconography
  { id: 'train_steam', label: 'Steam locomotive', isPro: false, source: 'unicode', glyph: '\u{1F682}' },
  { id: 'train_diesel', label: 'Diesel train', isPro: false, source: 'unicode', glyph: '\u{1F686}' },
  { id: 'train_metro', label: 'Metro', isPro: false, source: 'unicode', glyph: '\u{1F687}' },
  { id: 'tram', label: 'Tram', isPro: false, source: 'unicode', glyph: '\u{1F68A}' },
  { id: 'station', label: 'Station', isPro: false, source: 'unicode', glyph: '\u{1F689}' },
  { id: 'tracks', label: 'Tracks', isPro: false, source: 'unicode', glyph: '\u{1F6E4}\u{FE0F}' },
  { id: 'ticket', label: 'Ticket', isPro: false, source: 'unicode', glyph: '\u{1F3AB}' },
  { id: 'high_speed', label: 'High-speed train', isPro: false, source: 'unicode', glyph: '\u{1F684}' },
  { id: 'monorail', label: 'Monorail', isPro: false, source: 'unicode', glyph: '\u{1F69D}' },
  { id: 'railway_car', label: 'Railway car', isPro: false, source: 'unicode', glyph: '\u{1F683}' },

  // Pro tier — Mix of custom SVG and Unicode for railway-specific symbols
  { id: 'pro_signal_box', label: 'Signal box', isPro: true, source: 'svg', svgAsset: 'emoji-svg/signal-box.svg' },
  { id: 'pro_semaphore', label: 'Semaphore signal', isPro: true, source: 'svg', svgAsset: 'emoji-svg/semaphore.svg' },
  { id: 'pro_signal_lights', label: 'Signal lights', isPro: true, source: 'svg', svgAsset: 'emoji-svg/signal-lights.svg' },
  { id: 'pro_pantograph', label: 'Pantograph', isPro: true, source: 'svg', svgAsset: 'emoji-svg/pantograph.svg' },
  { id: 'pro_overhead_line', label: 'Overhead line', isPro: true, source: 'svg', svgAsset: 'emoji-svg/overhead-line.svg' },
  { id: 'pro_buffer_stop', label: 'Buffer stop', isPro: true, source: 'svg', svgAsset: 'emoji-svg/buffer-stop.svg' },
  { id: 'pro_turnout', label: 'Turnout (points)', isPro: true, source: 'svg', svgAsset: 'emoji-svg/turnout.svg' },
  { id: 'pro_water_crane', label: 'Water crane', isPro: true, source: 'svg', svgAsset: 'emoji-svg/water-crane.svg' },
  { id: 'pro_roundhouse', label: 'Roundhouse', isPro: true, source: 'svg', svgAsset: 'emoji-svg/roundhouse.svg' },
  { id: 'pro_turntable', label: 'Turntable', isPro: true, source: 'svg', svgAsset: 'emoji-svg/turntable.svg' },
  { id: 'pro_coal_tender', label: 'Coal tender', isPro: true, source: 'svg', svgAsset: 'emoji-svg/coal-tender.svg' },
  { id: 'pro_ice_4', label: 'ICE 4', isPro: true, source: 'svg', svgAsset: 'emoji-svg/ice-4.svg' },
  { id: 'pro_vectron', label: 'Vectron', isPro: true, source: 'svg', svgAsset: 'emoji-svg/vectron.svg' },
  { id: 'pro_class_91', label: 'Class 91', isPro: true, source: 'svg', svgAsset: 'emoji-svg/class-91.svg' },
  { id: 'pro_en57', label: 'EN57', isPro: true, source: 'svg', svgAsset: 'emoji-svg/en57.svg' },
  { id: 'pro_steam_drg52', label: 'DRG 52 Kriegslok', isPro: true, source: 'svg', svgAsset: 'emoji-svg/drg52.svg' },
  { id: 'pro_uk_signal_box', label: 'UK signal box', isPro: true, source: 'unicode', glyph: '\u{1F6A5}' },
  { id: 'pro_compass', label: 'Compass', isPro: true, source: 'unicode', glyph: '\u{1F9ED}' },
  { id: 'pro_camera', label: 'Camera', isPro: true, source: 'unicode', glyph: '\u{1F4F7}' },
  { id: 'pro_clipboard', label: 'Spotter clipboard', isPro: true, source: 'unicode', glyph: '\u{1F4CB}' },
];

// Exposed set: Unicode-only until SVG asset bundle ships. See above.
export const SPOTTER_EMOJIS: SpotterEmoji[] = ALL_SPOTTER_EMOJIS.filter(
  e => e.source === 'unicode'
);

export function getEmojiById(id: string): SpotterEmoji | undefined {
  // Search the full set so values stored on the server (e.g. an SVG id from
  // a future build) still resolve when the user is on a build that filters
  // them out — they just won't be re-selectable.
  return ALL_SPOTTER_EMOJIS.find(e => e.id === id);
}

export function canSelectEmoji(id: string, isPro: boolean): boolean {
  const emoji = getEmojiById(id);
  if (!emoji) return false;
  if (!emoji.isPro) return true;
  return isPro;
}
