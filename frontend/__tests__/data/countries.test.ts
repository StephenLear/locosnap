import { COUNTRIES, getCountryByCode, getDefaultCountryCodeForLocale } from '../../data/countries';

describe('countries data', () => {
  it('contains at least 195 entries', () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(195);
  });
  it('every entry has unique ISO code', () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('every entry has glyph and name', () => {
    COUNTRIES.forEach(c => {
      expect(c.glyph).toMatch(/^.{2,4}$/);
      expect(c.name.length).toBeGreaterThan(0);
    });
  });
  it('priority sort puts DE/PL/UK in first 5', () => {
    const top5 = COUNTRIES.slice(0, 5).map(c => c.code);
    expect(top5).toContain('DE');
    expect(top5).toContain('PL');
    expect(top5).toContain('GB');
  });
  it('getCountryByCode returns the entry', () => {
    expect(getCountryByCode('DE')?.name).toBe('Germany');
    expect(getCountryByCode('XX')).toBeUndefined();
  });
  it('getDefaultCountryCodeForLocale resolves de-DE to DE', () => {
    expect(getDefaultCountryCodeForLocale('de-DE')).toBe('DE');
    expect(getDefaultCountryCodeForLocale('pl-PL')).toBe('PL');
    expect(getDefaultCountryCodeForLocale('en-GB')).toBe('GB');
  });
  it('getDefaultCountryCodeForLocale falls back to GB on unknown', () => {
    expect(getDefaultCountryCodeForLocale('xx-YY')).toBe('GB');
  });
});
