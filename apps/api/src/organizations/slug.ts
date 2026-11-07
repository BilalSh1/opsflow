import { randomBytes } from 'crypto';

const MAX_BASE_LENGTH = 48;
const FALLBACK_SLUG = 'organization';

// "Café Ünited, Inc." -> "cafe-united-inc"
export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/-+$/g, '');

  return slug || FALLBACK_SLUG;
}

// Appends 6 hex characters; keeps the slug within the 64-character column.
export function withRandomSuffix(slug: string): string {
  return `${slug}-${randomBytes(3).toString('hex')}`;
}
