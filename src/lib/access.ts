/**
 * Cloudflare Access JWT verification.
 * Access sits in front of /workroom* and /api/admin/* and adds a signed
 * `Cf-Access-Jwt-Assertion` header. We verify it again here so the Workroom
 * stays closed even if the Access policy is misconfigured or bypassed.
 * https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

export interface AccessConfig {
  /** e.g. "lizlenjo.cloudflareaccess.com" */
  teamDomain: string;
  /** Application Audience (AUD) tag from the Access application. */
  aud: string;
  /** Optional allow-list. Empty means any identity Access lets through. */
  allowedEmails?: string[];
  /** Injected for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Injected for tests, in seconds. */
  now?: number;
}

export interface AccessIdentity {
  email: string;
  sub: string;
  exp: number;
}

export type AccessResult = { ok: true; identity: AccessIdentity } | { ok: false; reason: string };

interface Jwk extends JsonWebKey { kid?: string }

const jwksCache = new Map<string, { keys: Jwk[]; at: number }>();
const JWKS_TTL_MS = 60 * 60 * 1000;

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlDecode(s)));

export function normaliseTeamDomain(d: string): string {
  return d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

async function getKeys(teamDomain: string, fetcher: typeof fetch, force = false): Promise<Jwk[]> {
  const cached = jwksCache.get(teamDomain);
  if (!force && cached && Date.now() - cached.at < JWKS_TTL_MS) return cached.keys;
  const res = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache.set(teamDomain, { keys, at: Date.now() });
  return keys;
}

export function clearJwksCache() {
  jwksCache.clear();
}

export async function verifyAccessJwt(token: string | null | undefined, cfg: AccessConfig): Promise<AccessResult> {
  if (!token) return { ok: false, reason: 'missing token' };
  if (!cfg.teamDomain || !cfg.aud) return { ok: false, reason: 'access not configured' };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' };
  const [h, p, sig] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string; sub?: string };
  try {
    header = decodeJson(h);
    payload = decodeJson(p);
  } catch {
    return { ok: false, reason: 'malformed token' };
  }
  if (header.alg !== 'RS256') return { ok: false, reason: 'unsupported alg' };

  const team = normaliseTeamDomain(cfg.teamDomain);
  const fetcher = cfg.fetcher ?? fetch;
  let keys = await getKeys(team, fetcher);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(team, fetcher, true); // keys rotate; refetch once
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return { ok: false, reason: 'unknown key' };

  const key = await crypto.subtle.importKey('jwk', { ...jwk, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!valid) return { ok: false, reason: 'bad signature' };

  const now = cfg.now ?? Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(cfg.aud)) return { ok: false, reason: 'wrong audience' };
  if (payload.iss !== `https://${team}`) return { ok: false, reason: 'wrong issuer' };
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) return { ok: false, reason: 'expired' };
  if (typeof payload.nbf === 'number' && payload.nbf > now + 30) return { ok: false, reason: 'not yet valid' };

  const email = (payload.email ?? '').toLowerCase();
  const allow = (cfg.allowedEmails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(email)) return { ok: false, reason: 'email not allowed' };

  return { ok: true, identity: { email, sub: payload.sub ?? '', exp: payload.exp } };
}

/** Local development only: allow the Workroom on localhost when DEV_ACCESS_BYPASS=1. */
export function devBypassAllowed(url: URL, flag: string | undefined): boolean {
  return flag === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export const isProtectedPath = (path: string) => /^\/(workroom|api\/admin)(\/|$)/.test(path);
