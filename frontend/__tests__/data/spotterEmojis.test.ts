import { SPOTTER_EMOJIS, getEmojiById, canSelectEmoji } from '../../data/spotterEmojis';

describe('spotterEmojis data', () => {
  it('has at least 10 free entries', () => {
    expect(SPOTTER_EMOJIS.filter(e => !e.isPro).length).toBeGreaterThanOrEqual(10);
  });
  // Pro tier ships with Unicode-only entries until the SVG asset bundle
  // lands (see comment in data/spotterEmojis.ts). Threshold reflects what
  // is visible to users today, not the aspirational ~20 in the design doc.
  it('has at least 4 Pro entries (Unicode-only until SVG assets ship)', () => {
    expect(SPOTTER_EMOJIS.filter(e => e.isPro).length).toBeGreaterThanOrEqual(4);
  });
  it('exposes only Unicode entries until SVG assets ship', () => {
    expect(SPOTTER_EMOJIS.every(e => e.source === 'unicode')).toBe(true);
  });
  it('every id is unique', () => {
    const ids = SPOTTER_EMOJIS.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Unicode entries have valid glyph', () => {
    SPOTTER_EMOJIS
      .filter(e => e.source === 'unicode')
      .forEach(e => {
        expect(e.glyph).toBeTruthy();
        expect(e.glyph!.length).toBeGreaterThan(0);
      });
  });
  it('SVG entries have asset path', () => {
    SPOTTER_EMOJIS
      .filter(e => e.source === 'svg')
      .forEach(e => {
        expect(e.svgAsset).toMatch(/^.+\.svg$/);
      });
  });
  it('every entry has label', () => {
    SPOTTER_EMOJIS.forEach(e => {
      expect(e.label.length).toBeGreaterThan(0);
    });
  });
  it('getEmojiById returns the entry', () => {
    expect(getEmojiById('train_steam')?.label).toBeTruthy();
    expect(getEmojiById('nonexistent')).toBeUndefined();
  });
  it('canSelectEmoji: free emoji is always selectable', () => {
    const free = SPOTTER_EMOJIS.find(e => !e.isPro)!;
    expect(canSelectEmoji(free.id, false)).toBe(true);
    expect(canSelectEmoji(free.id, true)).toBe(true);
  });
  it('canSelectEmoji: Pro emoji is only selectable for Pro users', () => {
    const pro = SPOTTER_EMOJIS.find(e => e.isPro)!;
    expect(canSelectEmoji(pro.id, false)).toBe(false);
    expect(canSelectEmoji(pro.id, true)).toBe(true);
  });
  it('canSelectEmoji: unknown id returns false', () => {
    expect(canSelectEmoji('nonexistent', true)).toBe(false);
  });
});
