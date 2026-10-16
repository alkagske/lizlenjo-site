import { describe, expect, it, vi } from 'vitest';
import { authUrl, captionFromFilename, createSession, downloadUrl, exchangeCode, GoogleAuthError, isPhoto, listItems, scaledSize, SCOPE, seconds } from '../../src/lib/google-photos';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('Google sign-in', () => {
  it('asks only for the picker scope and returns to the Workroom callback', () => {
    const u = new URL(authUrl({ clientId: 'cid' }, 'https://lizlenjo.com', 'st4te'));
    expect(u.origin).toBe('https://accounts.google.com');
    expect(u.searchParams.get('scope')).toBe(SCOPE);
    expect(SCOPE).toBe('https://www.googleapis.com/auth/photospicker.mediaitems.readonly');
    expect(u.searchParams.get('redirect_uri')).toBe('https://lizlenjo.com/api/admin/google/callback');
    expect(u.searchParams.get('state')).toBe('st4te');
    expect(u.searchParams.get('access_type')).toBe('online');
  });
  it('exchanges the code for an access token', async () => {
    const f = vi.fn().mockResolvedValue(ok({ access_token: 'tok', expires_in: 3599 }));
    expect(await exchangeCode({ clientId: 'c', clientSecret: 's' }, 'https://x.dev', 'code1', f)).toEqual({ accessToken: 'tok', expiresIn: 3599 });
    const body = f.mock.calls[0]![1].body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('redirect_uri')).toBe('https://x.dev/api/admin/google/callback');
  });
  it('fails clearly when Google refuses', async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    await expect(exchangeCode({ clientId: 'c', clientSecret: 's' }, 'https://x', 'bad', f)).rejects.toThrow('invalid_grant');
  });
});

describe('Picker API calls', () => {
  it('creates a session with the bearer token', async () => {
    const f = vi.fn().mockResolvedValue(ok({ id: 's1', pickerUri: 'https://photos.google.com/picker/s1' }));
    const s = await createSession('tok', f);
    expect(s.id).toBe('s1');
    expect(f.mock.calls[0]![0]).toBe('https://photospicker.googleapis.com/v1/sessions');
    expect(f.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok');
  });
  it('pages through picked items', async () => {
    const f = vi.fn().mockResolvedValue(ok({ mediaItems: [], nextPageToken: 'p2' }));
    await listItems('tok', 's1', 'p1', 20, f);
    const u = new URL(f.mock.calls[0]![0]);
    expect(u.pathname).toBe('/v1/mediaItems');
    expect(Object.fromEntries(u.searchParams)).toEqual({ sessionId: 's1', pageSize: '20', pageToken: 'p1' });
  });
  it('turns 401/403 into a sign-in error', async () => {
    const f = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }));
    await expect(createSession('old', f)).rejects.toBeInstanceOf(GoogleAuthError);
  });
});

describe('helpers', () => {
  it('keeps meaningful file names as captions, drops camera names', () => {
    expect(captionFromFilename('Lagos_Fashion-Week.jpg')).toBe('Lagos Fashion Week');
    expect(captionFromFilename('IMG_20240311_142233.jpg')).toBe('');
    expect(captionFromFilename('PXL_20250101_1.jpg')).toBe('');
    expect(captionFromFilename('WhatsApp Image 2024-05-01 at 10.00.jpeg')).toBe('');
    expect(captionFromFilename('20240311.jpg')).toBe('');
    expect(captionFromFilename(undefined)).toBe('');
  });
  it('scales the long edge to 2400 without upscaling', () => {
    expect(scaledSize(4800, 3200)).toEqual({ width: 2400, height: 1600 });
    expect(scaledSize(1000, 1500)).toEqual({ width: 1000, height: 1500 });
    expect(scaledSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
  it('downloads photos at the import size and skips videos', () => {
    const photo = { id: '1', type: 'PHOTO' as const, mediaFile: { baseUrl: 'https://lh3.googleusercontent.com/abc', mimeType: 'image/jpeg' } };
    expect(downloadUrl(photo)).toBe('https://lh3.googleusercontent.com/abc=w2400-h2400');
    expect(isPhoto(photo)).toBe(true);
    expect(isPhoto({ id: '2', type: 'VIDEO', mediaFile: { baseUrl: 'x', mimeType: 'video/mp4' } })).toBe(false);
    expect(isPhoto({ id: '3' })).toBe(false);
  });
  it('reads Google duration strings', () => {
    expect(seconds('5s', 3)).toBe(5);
    expect(seconds('1.5s', 3)).toBe(1.5);
    expect(seconds(undefined, 3)).toBe(3);
  });
});
