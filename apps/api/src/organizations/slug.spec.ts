import { slugify, withRandomSuffix } from './slug';

describe('slugify', () => {
  it.each([
    ['Acme Technologies', 'acme-technologies'],
    ['  Acme   Technologies  ', 'acme-technologies'],
    ['Café Ünited, Inc.', 'cafe-united-inc'],
    ['R&D / Ops 24x7', 'r-d-ops-24x7'],
    ['--Already-Slugged--', 'already-slugged'],
  ])('turns %p into %p', (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });

  it('falls back to a default when nothing usable remains', () => {
    expect(slugify('日本語')).toBe('organization');
    expect(slugify('!!!')).toBe('organization');
  });

  it('caps the length without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(47)} bcd`);

    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('withRandomSuffix', () => {
  it('appends six hex characters and stays within 64 characters', () => {
    const base = 'a'.repeat(48);
    const slug = withRandomSuffix(base);

    expect(slug).toMatch(/^a{48}-[0-9a-f]{6}$/);
    expect(slug.length).toBeLessThanOrEqual(64);
  });
});
