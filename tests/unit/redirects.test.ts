import { describe, expect, it } from 'vitest';
import { legacyRedirect } from '../../src/lib/redirects';

describe('old WordPress URLs', () => {
  it('sends posts at /<slug>/ to Liz Notes', () => {
    expect(legacyRedirect('/realising-the-value-in-entertainment/')).toBe('/notes/realising-the-value-in-entertainment');
    expect(legacyRedirect('/Branding-Suicide')).toBe('/notes/branding-suicide');
    expect(legacyRedirect('/branding-suicide/feed/')).toBe('/notes/branding-suicide');
  });
  it('sends pages, archives and feeds somewhere sensible', () => {
    expect(legacyRedirect('/about-liz/')).toBe('/about');
    expect(legacyRedirect('/blog/')).toBe('/notes');
    expect(legacyRedirect('/feed/')).toBe('/notes/rss.xml');
    expect(legacyRedirect('/category/ip-law/')).toBe('/notes');
    expect(legacyRedirect('/tag/kecobo/')).toBe('/notes');
    expect(legacyRedirect('/2014/03/')).toBe('/notes');
    expect(legacyRedirect('/page/3/')).toBe('/notes');
  });
  it('leaves everything else alone', () => {
    expect(legacyRedirect('/notes/branding-suicide')).toBeNull();
    expect(legacyRedirect('/workroom')).toBeNull();
    expect(legacyRedirect('/no-such-post/')).toBeNull();
    expect(legacyRedirect('/%E0%A4%A')).toBeNull();
  });
});
