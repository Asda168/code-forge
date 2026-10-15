'use strict';
// Pure helpers for "Sign in with Google" (no Electron imports, so scripts/google-auth-test.js can unit-test them).
// Flow: OAuth 2.0 authorization code + PKCE (S256) with a loopback redirect, `state` + `nonce`, and a fully validated
// ID token (RS256 signature against Google's published keys, issuer, audience, expiry, nonce, verified email).
const crypto = require('crypto');

const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';   // appdata: a hidden Drive folder only Asta can read
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CLIENT_ID_RE = /^[0-9]+-[a-z0-9_]+\.apps\.googleusercontent\.com$/;
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

class GoogleAuthError extends Error {
  constructor(code, message) { super(message); this.name = 'GoogleAuthError'; this.code = code; }
}

// ---- configuration ----------------------------------------------------------------------------------------------------
// `sources` are plain objects ({clientId, clientSecret}), earlier sources win. Returns { ok, clientId, clientSecret } or
// { ok:false, code, message } with a message that says exactly what to fix.
function resolveConfig(sources) {
  const src = (sources || []).filter((s) => s && typeof s === 'object');
  const pick = (k) => { for (const s of src) if (typeof s[k] === 'string' && s[k].trim()) return s[k].trim(); return ''; };
  const clientId = pick('clientId'), clientSecret = pick('clientSecret');
  if (!clientId) return { ok: false, code: 'config_missing', message: 'Google sign-in is not set up. Add your Google OAuth client ID to google-oauth.json (see docs/GOOGLE_SIGNIN.md).' };
  if (/x{4,}|your[-_ ]|example|placeholder/i.test(clientId) || (clientSecret && /x{4,}|your[-_ ]|example|placeholder/i.test(clientSecret)))
    return { ok: false, code: 'config_placeholder', message: 'google-oauth.json still contains the example placeholder values. Replace them with your real Google OAuth client ID.' };
  if (!CLIENT_ID_RE.test(clientId)) return { ok: false, code: 'config_invalid', message: 'The Google client ID looks wrong. It should end with ".apps.googleusercontent.com" and come from a "Desktop app" OAuth client.' };
  return { ok: true, clientId, clientSecret };
}

// ---- PKCE / request construction ---------------------------------------------------------------------------------------
function newAuthRequest() {
  const verifier = b64u(crypto.randomBytes(48));
  return { verifier, challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), state: b64u(crypto.randomBytes(24)), nonce: b64u(crypto.randomBytes(24)) };
}
function buildAuthUrl(base, { clientId, redirect, challenge, state, nonce, scope = SCOPE }) {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope, code_challenge: challenge, code_challenge_method: 'S256',
    state, nonce, access_type: 'offline', prompt: 'select_account consent' });
  return base + '?' + q;
}
// Loopback redirect must stay on 127.0.0.1 and keep the callback path; anything else is a bug or an attack.
const isLoopbackRedirect = (u) => { try { const x = new URL(u); return x.protocol === 'http:' && x.hostname === '127.0.0.1' && x.pathname === '/cb' && !x.search && !x.hash; } catch { return false; } };

// Interprets the query string Google (or anyone else) sent to the loopback listener.
function parseCallback(params, expectedState) {
  const err = params.get('error');
  if (err) return { ok: false, code: err === 'access_denied' ? 'cancelled' : 'denied', message: err === 'access_denied' ? 'Google sign-in was cancelled.' : `Google refused the sign-in (${String(err).slice(0, 60)}).` };
  const state = params.get('state') || '', code = params.get('code') || '';
  const a = Buffer.from(state), b = Buffer.from(String(expectedState));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, code: 'state_mismatch', message: 'The sign-in response did not match this request. Please try again.' };
  if (!code || code.length > 2048) return { ok: false, code: 'no_code', message: 'Google did not return a sign-in code. Please try again.' };
  return { ok: true, code };
}

// ---- ID token ----------------------------------------------------------------------------------------------------------
function decodeJwt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts.some((p) => !p)) throw new GoogleAuthError('bad_token', 'Google returned a malformed sign-in token.');
  try {
    return { header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')), payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
      signature: Buffer.from(parts[2], 'base64url'), signingInput: Buffer.from(parts[0] + '.' + parts[1]) };
  } catch { throw new GoogleAuthError('bad_token', 'Google returned a malformed sign-in token.'); }
}
// jwks = { keys: [ {kid, kty:'RSA', n, e, ...} ] }. Throws GoogleAuthError on any problem; returns the verified claims.
function verifyIdToken(idToken, { clientId, nonce, jwks, now = Date.now() }) {
  const t = decodeJwt(idToken), { header: h, payload: c } = t;
  if (h.alg !== 'RS256') throw new GoogleAuthError('bad_token', 'Unexpected sign-in token algorithm.');
  const jwk = ((jwks && jwks.keys) || []).find((k) => k.kid === h.kid && k.kty === 'RSA');
  if (!jwk) throw new GoogleAuthError('key_unknown', 'Could not verify the Google sign-in token (unknown signing key).');
  let ok = false;
  try { ok = crypto.verify('RSA-SHA256', t.signingInput, crypto.createPublicKey({ key: jwk, format: 'jwk' }), t.signature); } catch { ok = false; }
  if (!ok) throw new GoogleAuthError('bad_signature', 'The Google sign-in token signature is invalid.');
  if (!ISSUERS.has(c.iss)) throw new GoogleAuthError('bad_issuer', 'The sign-in token was not issued by Google.');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(clientId)) throw new GoogleAuthError('bad_audience', 'The sign-in token was issued for a different app.');
  if (typeof c.exp !== 'number' || c.exp * 1000 <= now - 60000) throw new GoogleAuthError('expired', 'The Google sign-in expired. Please try again.');
  if (nonce && c.nonce !== nonce) throw new GoogleAuthError('bad_nonce', 'The sign-in response did not match this request. Please try again.');
  if (!c.sub) throw new GoogleAuthError('no_subject', 'Google did not return an account identifier.');
  if (!c.email) throw new GoogleAuthError('no_email', 'Your Google account did not share an email address.');
  if (c.email_verified !== true && c.email_verified !== 'true') throw new GoogleAuthError('email_unverified', 'Your Google email address is not verified.');
  return { sub: String(c.sub), email: String(c.email), name: String(c.name || ''), picture: String(c.picture || '') };
}

// ---- messages ----------------------------------------------------------------------------------------------------------
// Never include tokens, codes or secrets in anything shown to the user.
function friendlyError(e) {
  const code = e && e.code, msg = String((e && e.message) || e || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  if (code === 'config_missing' || code === 'config_placeholder' || code === 'config_invalid') return { code, setup: true, message: msg };
  if (code === 'cancelled') return { code, message: 'Google sign-in was cancelled.' };
  if (code === 'timeout') return { code, message: 'Google sign-in timed out. Please try again.' };
  if (code === 'network') return { code, message: 'Cannot reach Google. Check your internet connection and try again.' };
  if (e && e.name === 'GoogleAuthError') return { code, message: msg };
  return { code: 'unknown', message: 'Unable to sign in with Google. Please try again.' };
}

module.exports = { SCOPE, GoogleAuthError, resolveConfig, newAuthRequest, buildAuthUrl, isLoopbackRedirect, parseCallback, decodeJwt, verifyIdToken, friendlyError, b64u };
