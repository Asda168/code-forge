// Unit tests for src/google-auth.js (no Electron, no network). Run: node scripts/google-auth-test.js
const assert = require('assert');
const crypto = require('crypto');
const ga = require('../src/google-auth');

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' -> ' + e.message); } };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { assert.strictEqual(e.code, code, `expected ${code}, got ${e.code} (${e.message})`); return; } assert.fail('expected ' + code); };

const ID = '123456789012-abcdefghijklmnop.apps.googleusercontent.com';

// ---- configuration
t('missing config is reported', () => { const r = ga.resolveConfig([{}, null, undefined]); assert.ok(!r.ok); assert.strictEqual(r.code, 'config_missing'); });
t('example placeholders are rejected', () => { const r = ga.resolveConfig([{ clientId: 'xxxxxxxx.apps.googleusercontent.com', clientSecret: 'GOCSPX-xxxxxxxx' }]); assert.strictEqual(r.code, 'config_placeholder'); });
t('malformed client id is rejected', () => assert.strictEqual(ga.resolveConfig([{ clientId: 'not-a-client-id' }]).code, 'config_invalid'));
t('valid config (secret optional)', () => { const r = ga.resolveConfig([{ clientId: ID }]); assert.ok(r.ok); assert.strictEqual(r.clientSecret, ''); });
t('earlier source wins, blanks fall through', () => { const r = ga.resolveConfig([{ clientId: '' }, { clientId: ID, clientSecret: 'GOCSPX-realvalue123' }]); assert.ok(r.ok); assert.strictEqual(r.clientSecret, 'GOCSPX-realvalue123'); });

// ---- PKCE / request
t('PKCE challenge is S256 of the verifier', () => {
  const r = ga.newAuthRequest();
  assert.strictEqual(r.challenge, crypto.createHash('sha256').update(r.verifier).digest('base64url'));
  assert.ok(r.verifier.length >= 43 && r.state.length >= 16 && r.nonce.length >= 16);
  assert.notStrictEqual(ga.newAuthRequest().state, r.state);
});
t('auth URL carries PKCE, state, nonce and least-privilege scopes', () => {
  const u = new URL(ga.buildAuthUrl('https://accounts.google.com/o/oauth2/v2/auth', { clientId: ID, redirect: 'http://127.0.0.1:5000/cb', challenge: 'c', state: 's', nonce: 'n' }));
  const p = u.searchParams;
  assert.strictEqual(p.get('code_challenge_method'), 'S256'); assert.strictEqual(p.get('response_type'), 'code');
  assert.strictEqual(p.get('state'), 's'); assert.strictEqual(p.get('nonce'), 'n');
  assert.strictEqual(p.get('scope'), 'openid email profile https://www.googleapis.com/auth/drive.appdata');
  assert.ok(!p.has('client_secret'));
});
t('only the loopback callback is an acceptable redirect', () => {
  assert.ok(ga.isLoopbackRedirect('http://127.0.0.1:51234/cb'));
  for (const bad of ['https://127.0.0.1:1/cb', 'http://localhost:1/cb', 'http://127.0.0.1:1/other', 'http://evil.example/cb', 'http://127.0.0.1:1/cb?x=1', 'nonsense']) assert.ok(!ga.isLoopbackRedirect(bad), bad);
});
t('callback: ok / cancelled / state mismatch / no code', () => {
  assert.deepStrictEqual(ga.parseCallback(new URLSearchParams('code=abc&state=S'), 'S'), { ok: true, code: 'abc' });
  assert.strictEqual(ga.parseCallback(new URLSearchParams('error=access_denied&state=S'), 'S').code, 'cancelled');
  assert.strictEqual(ga.parseCallback(new URLSearchParams('code=abc&state=OTHER'), 'S').code, 'state_mismatch');
  assert.strictEqual(ga.parseCallback(new URLSearchParams('state=S'), 'S').code, 'no_code');
});

// ---- ID token
const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }), other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = (k, kid) => ({ ...k.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' });
const jwks = { keys: [jwk(kp, 'k1')] };
const NOW = Date.now();
const mint = (claims = {}, { key = kp, kid = 'k1', alg = 'RS256', header = {} } = {}) => {
  const h = Buffer.from(JSON.stringify({ alg, kid, typ: 'JWT', ...header })).toString('base64url');
  const body = { iss: 'https://accounts.google.com', aud: ID, sub: '1234567890', email: 'a@b.co', email_verified: true, name: 'A B', picture: 'https://lh3.googleusercontent.com/x', nonce: 'N', exp: Math.floor(NOW / 1000) + 3600, ...claims };
  const p = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key.privateKey).toString('base64url');
  return h + '.' + p + '.' + sig;
};
const ctx = { clientId: ID, nonce: 'N', jwks, now: NOW };
t('valid ID token yields the identity', () => { const c = ga.verifyIdToken(mint(), ctx); assert.strictEqual(c.sub, '1234567890'); assert.strictEqual(c.email, 'a@b.co'); assert.strictEqual(c.name, 'A B'); });
t('signature from another key is rejected', () => throwsCode(() => ga.verifyIdToken(mint({}, { key: other }), ctx), 'bad_signature'));
t('tampered payload is rejected', () => { const [h, , s] = mint().split('.'); const p = Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', aud: ID, sub: 'ATTACKER', email: 'x@y.z', email_verified: true, nonce: 'N', exp: 9999999999 })).toString('base64url'); throwsCode(() => ga.verifyIdToken(`${h}.${p}.${s}`, ctx), 'bad_signature'); });
t('wrong audience is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ aud: '999-other.apps.googleusercontent.com' }), ctx), 'bad_audience'));
t('wrong issuer is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ iss: 'https://evil.example' }), ctx), 'bad_issuer'));
t('expired token is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ exp: Math.floor(NOW / 1000) - 3600 }), ctx), 'expired'));
t('nonce mismatch is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ nonce: 'REPLAYED' }), ctx), 'bad_nonce'));
t('unverified email is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ email_verified: false }), ctx), 'email_unverified'));
t('missing email is rejected', () => throwsCode(() => ga.verifyIdToken(mint({ email: undefined }), ctx), 'no_email'));
t('alg none / HS256 are rejected', () => { throwsCode(() => ga.verifyIdToken(mint({}, { alg: 'none' }), ctx), 'bad_token'); throwsCode(() => ga.verifyIdToken(mint({}, { alg: 'HS256' }), ctx), 'bad_token'); });
t('unknown signing key id is rejected', () => throwsCode(() => ga.verifyIdToken(mint({}, { kid: 'nope' }), ctx), 'key_unknown'));
t('garbage token is rejected', () => throwsCode(() => ga.verifyIdToken('not.a.jwt', ctx), 'bad_token'));

// ---- messages
t('friendly errors never leak secrets and map known codes', () => {
  assert.strictEqual(ga.friendlyError(new ga.GoogleAuthError('cancelled', 'x')).message, 'Google sign-in was cancelled.');
  assert.strictEqual(ga.friendlyError(new ga.GoogleAuthError('config_missing', 'set it up')).setup, true);
  assert.strictEqual(ga.friendlyError(new Error('ECONNRESET with code=4/0AbCd secret=GOCSPX-zzz')).message, 'Unable to sign in with Google. Please try again.');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
