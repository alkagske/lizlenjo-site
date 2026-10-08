import { describe, expect, it } from 'vitest';
import { isoToNairobiLocal, nairobiLocalToIso } from '../../src/lib/admin';
import { mediaUrl } from '../../src/lib/media';

describe('Nairobi time for scheduling', () => {
  it('treats datetime-local input as UTC+3', () => {
    expect(nairobiLocalToIso('2026-10-21T09:00')).toBe('2026-10-21T06:00:00Z');
    expect(nairobiLocalToIso('2026-01-01T01:30')).toBe('2025-12-31T22:30:00Z');
    expect(nairobiLocalToIso('nonsense')).toBeNull();
  });
  it('round-trips', () => {
    expect(isoToNairobiLocal('2026-10-21T06:00:00Z')).toBe('2026-10-21T09:00');
    expect(isoToNairobiLocal(nairobiLocalToIso('2027-03-05T18:45'))).toBe('2027-03-05T18:45');
    expect(isoToNairobiLocal(null)).toBe('');
  });
});

describe('media URLs', () => {
  it('serves built-in photos from the build-time WebP set', () => {
    expect(mediaUrl('static/piano', 900)).toBe('/lookbook/piano-960.webp');
    expect(mediaUrl('static/piano', 5000)).toBe('/lookbook/piano-1600.webp');
  });
  it('serves R2 keys, with optional Cloudflare transformations', () => {
    expect(mediaUrl('photos/2026/10/a b.jpg')).toBe('/media/photos/2026/10/a%20b.jpg');
    expect(mediaUrl('covers/x.jpg', 800, true)).toBe('/cdn-cgi/image/width=800,quality=82,format=auto,fit=scale-down/media/covers/x.jpg');
  });
});
