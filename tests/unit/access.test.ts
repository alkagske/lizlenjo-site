import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearJwksCache, devBypassAllowed, isProtectedPath, verifyAccessJwt } from '../../src/lib/access';

const TEAM = 'lizlenjo.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const NOW = 1_800_000_000;
let keys: CryptoKeyPair;
let otherKeys: CryptoKeyPair;
let jwks: { keys: JsonWebKey[] };

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function sign(payload: Record<string, unknown>, opts: { kid?: string; key?: CryptoKey; alg?: string } = {}) {
  const header = b64url(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? 'k1', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', opts.key ?? keys.privateKey, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${b64url(sig)}`;
}

const good = () => ({ aud: [AUD], iss: `https://${TEAM}`, email: 'Liz@Example.com', sub: 'u1', exp: NOW + 3600, iat: NOW });
let fetchCount = 0;
const fetcher = (async () => { fetchCount++; return new Response(JSON.stringify(jwks)); }) as unknown as typeof fetch;
const cfg = (extra = {}) => ({ teamDomain: TEAM, aud: AUD, fetcher, now: NOW, ...extra });

beforeAll(async () => {
  const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  keys = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  otherKeys = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', keys.publicKey);
  jwks = { keys: [{ ...pub, kid: 'k1' } as JsonWebKey] };
});
beforeEach(() => { clearJwksCache(); fetchCount = 0; });

describe('verifyAccessJwt', () => {
  it('accepts a valid token and lower-cases the email', async () => {
    const r = await verifyAccessJwt(await sign(good()), cfg());
    expect(r).toEqual({ ok: true, identity: { email: 'liz@example.com', sub: 'u1', exp: NOW + 3600 } });
  });
  it('accepts a string aud and a team domain given as a URL', async () => {
    const r = await verifyAccessJwt(await sign({ ...good(), aud: AUD }), cfg({ teamDomain: `https://${TEAM}/` }));
    expect(r.ok).toBe(true);
  });
  it('rejects missing, malformed and unsupported tokens', async () => {
    expect(await verifyAccessJwt(null, cfg())).toEqual({ ok: false, reason: 'missing token' });
    expect(await verifyAccessJwt('a.b', cfg())).toEqual({ ok: false, reason: 'malformed token' });
    expect(await verifyAccessJwt('!!.!!.!!', cfg())).toEqual({ ok: false, reason: 'malformed token' });
    expect((await verifyAccessJwt(await sign(good(), { alg: 'HS256' }), cfg())).ok).toBe(false);
  });
  it('fails closed when Access is not configured', async () => {
    expect(await verifyAccessJwt(await sign(good()), cfg({ aud: '' }))).toEqual({ ok: false, reason: 'access not configured' });
  });
  it('rejects a bad signature', async () => {
    expect(await verifyAccessJwt(await sign(good(), { key: otherKeys.privateKey }), cfg())).toEqual({ ok: false, reason: 'bad signature' });
  });
  it('rejects a tampered payload', async () => {
    const t = (await sign(good())).split('.');
    t[1] = b64url(JSON.stringify({ ...good(), email: 'attacker@evil.com' }));
    expect((await verifyAccessJwt(t.join('.'), cfg())).ok).toBe(false);
  });
  it('rejects the wrong audience, issuer and expired tokens', async () => {
    expect(await verifyAccessJwt(await sign({ ...good(), aud: ['other'] }), cfg())).toEqual({ ok: false, reason: 'wrong audience' });
    expect(await verifyAccessJwt(await sign({ ...good(), iss: 'https://evil.cloudflareaccess.com' }), cfg())).toEqual({ ok: false, reason: 'wrong issuer' });
    expect(await verifyAccessJwt(await sign({ ...good(), exp: NOW - 120 }), cfg())).toEqual({ ok: false, reason: 'expired' });
    expect(await verifyAccessJwt(await sign({ ...good(), nbf: NOW + 600 }), cfg())).toEqual({ ok: false, reason: 'not yet valid' });
  });
  it('rejects unknown key ids after one refetch', async () => {
    expect(await verifyAccessJwt(await sign(good(), { kid: 'nope' }), cfg())).toEqual({ ok: false, reason: 'unknown key' });
    expect(fetchCount).toBe(2);
  });
  it('caches the JWKS between requests', async () => {
    await verifyAccessJwt(await sign(good()), cfg());
    await verifyAccessJwt(await sign(good()), cfg());
    expect(fetchCount).toBe(1);
  });
  it('enforces the optional email allow-list', async () => {
    expect((await verifyAccessJwt(await sign(good()), cfg({ allowedEmails: ['liz@example.com'] }))).ok).toBe(true);
    expect(await verifyAccessJwt(await sign(good()), cfg({ allowedEmails: ['someone@else.com'] }))).toEqual({ ok: false, reason: 'email not allowed' });
    expect((await verifyAccessJwt(await sign(good()), cfg({ allowedEmails: ['', ' '] }))).ok).toBe(true);
  });
});

describe('helpers', () => {
  it('only allows the dev bypass on localhost', () => {
    expect(devBypassAllowed(new URL('http://localhost:4321/workroom'), '1')).toBe(true);
    expect(devBypassAllowed(new URL('http://127.0.0.1:8787/workroom'), '1')).toBe(true);
    expect(devBypassAllowed(new URL('https://lizlenjo.com/workroom'), '1')).toBe(false);
    expect(devBypassAllowed(new URL('http://localhost/workroom'), undefined)).toBe(false);
  });
  it('protects the Workroom and admin API only', () => {
    expect(isProtectedPath('/workroom')).toBe(true);
    expect(isProtectedPath('/workroom/editor/3')).toBe(true);
    expect(isProtectedPath('/api/admin/posts')).toBe(true);
    expect(isProtectedPath('/api/comment')).toBe(false);
    expect(isProtectedPath('/workrooms')).toBe(false);
    expect(isProtectedPath('/notes/workroom-tips')).toBe(false);
  });
});
