// End-to-end test of "Sign in with Google" in the real Electron app against a local mock of Google's endpoints
// (CODEFORGE_GOOGLE_TEST_BASE). No network, no credentials. Run: node scripts/e2e-google.js
const http = require('http'), crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const electron = require('electron');            // in plain node this is the path to the electron binary

const ID = '123456789012-abcdefghijklmnop.apps.googleusercontent.com', SECRET = 'GOCSPX-realvalue123', PORT = 8765;
const kp = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...kp.publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const files = {}; let n = 0, mode = 'ok', lastNonce = '', lastChallenge = '';
const mint = (c, key = kp) => { const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k1' })).toString('base64url'), p = Buffer.from(JSON.stringify(c)).toString('base64url'); return h + '.' + p + '.' + crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key.privateKey).toString('base64url'); };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); let body = '';
  req.on('data', (d) => body += d);
  req.on('end', () => {
    const send = (c, o, h = {}) => { res.writeHead(c, { 'Content-Type': 'application/json', ...h }); res.end(typeof o === 'string' ? o : JSON.stringify(o)); };
    const q = Object.fromEntries(u.searchParams);
    if (u.pathname === '/certs') return send(200, { keys: [jwk] });
    if (u.pathname === '/auth') {
      lastNonce = q.nonce; lastChallenge = q.code_challenge;
      if (q.code_challenge_method !== 'S256' || !q.state || !q.nonce || !/^http:\/\/127\.0\.0\.1:\d+\/cb$/.test(q.redirect_uri)) return send(400, {});
      if (mode === 'cancel') return send(302, '', { Location: `${q.redirect_uri}?error=access_denied&state=${q.state}` });
      if (mode === 'badstate') return send(302, '', { Location: `${q.redirect_uri}?code=authcode123&state=FORGED` });
      if (mode === 'hang') return send(200, {});
      return send(302, '', { Location: `${q.redirect_uri}?code=authcode123&state=${q.state}` });
    }
    if (u.pathname === '/token') {
      const f = new URLSearchParams(body);
      if (f.get('client_id') !== ID) return send(401, { error: 'invalid_client' });
      if (f.get('grant_type') === 'authorization_code') {
        if (f.get('code') !== 'authcode123' || crypto.createHash('sha256').update(f.get('code_verifier') || '').digest('base64url') !== lastChallenge) return send(400, { error: 'invalid_grant' });
        const now = Math.floor(Date.now() / 1000), other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const claims = { iss: 'https://accounts.google.com', aud: ID, sub: '1029384756', email: 'seng@example.com', email_verified: mode !== 'unverified', name: 'Seng Sokim',
          picture: 'https://lh3.googleusercontent.com/x', nonce: mode === 'badnonce' ? 'REPLAY' : lastNonce, exp: mode === 'expired' ? now - 7200 : now + 3600 };
        return send(200, { access_token: 'at1', refresh_token: 'rt1', expires_in: 3600, scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
          id_token: mint(claims, mode === 'badsig' ? other : kp) });
      }
      return f.get('refresh_token') === 'rt1' ? send(200, { access_token: 'at2', expires_in: 3600 }) : send(400, { error: 'invalid_grant' });
    }
    if (!/^Bearer at[12]$/.test(req.headers.authorization || '')) return send(401, { error: 'unauth' });
    if (u.pathname === '/drive/v3/files') return send(200, { files: Object.keys(files).map((id) => ({ id })) });
    let m;
    if ((m = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/))) return files[m[1]] ? send(200, files[m[1]]) : send(404, {});
    if (u.pathname === '/upload/drive/v3/files' && req.method === 'POST') { files['f' + (++n)] = body.split(/--asta\w+/)[2].split('\r\n\r\n')[1].replace(/\r\n$/, ''); return send(200, { id: 'f' + n }); }
    if ((m = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/)) && req.method === 'PATCH') { files[m[1]] = body; return send(200, { id: m[1] }); }
    send(404, {});
  });
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asta-g-'));
const SCRIPT = `(async () => {
  const out = {};
  const go = async () => { try { const r = await cf.api.google(); return { ok: true, email: r.email, name: r.name, restored: r.restored }; } catch (e) { return { err: String(e.message).replace(/^Error invoking remote method '[^']+': Error: /, '') }; } };
  out.status = await cf.api.googleStatus();
  out.save = await cf.api.googleSaveConfig(%SAVE%).then(() => 'saved', (e) => String(e.message).replace(/^Error invoking remote method '[^']+': Error: /, ''));
  out.first = await go();
  out.after = await cf.sync.status();
  if (out.first.ok) { await CF.setSetting({ theme: 'darcula', fontSize: 22 }); await cf.sync.push(); out.theme = (await cf.settings.get()).theme; }
  out.restoredTheme = (await cf.settings.get()).theme;
  out.logout = await cf.api.logout().then(() => (cf.sync.status())).then((s) => s.signedIn);
  return JSON.stringify(out);
})()`;
const BUSY = `(async () => {
  const a = cf.api.google().catch((e) => String(e.message));
  await new Promise((r) => setTimeout(r, 700));
  const second = await cf.api.google().then(() => 'started', (e) => String(e.message));
  await cf.api.googleCancel();
  return JSON.stringify({ second, first: await a });
})()`;

function run(name, scriptText, env = {}) {
  const f = path.join(tmp, name + '.js'); fs.writeFileSync(f, scriptText);
  const ud = path.join(tmp, 'ud-' + name);
  return new Promise((resolve) => {
    const p = require('child_process').spawn(electron, ['.', '--user-data-dir=' + ud], { cwd: path.join(__dirname, '..'), env: { ...process.env, CODEFORGE_API: 'http://127.0.0.1:9/api', CODEFORGE_GOOGLE_TEST_BASE: 'http://127.0.0.1:' + PORT,
      CODEFORGE_E2E: f, CODEFORGE_GOOGLE_CLIENT_ID: '', CODEFORGE_GOOGLE_CLIENT_SECRET: '', ...env } });
    let out = ''; p.stdout.on('data', (d) => out += d); p.stderr.on('data', (d) => out += d);
    const kill = setTimeout(() => p.kill(), 90000);
    p.on('exit', () => { clearTimeout(kill); const m = out.match(/\[e2e\] (\{[\s\S]*?\})\r?\n/); try { resolve(JSON.parse(m[1])); } catch { resolve({ crash: out.slice(-400) }); } });
  });
}

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' -> ' + JSON.stringify(extra) : '')); } };
const CFG = { CODEFORGE_GOOGLE_CLIENT_ID: ID, CODEFORGE_GOOGLE_CLIENT_SECRET: SECRET };
const withSave = (s) => SCRIPT.replace('%SAVE%', s);

server.listen(PORT, '127.0.0.1', async () => {
  try {
    let r;
    r = await run('missing', withSave("'nope', ''"));
    check('missing config -> setup message, nobody signed in', r.status && r.status.configured === false && /config_missing|config_invalid/.test(r.first.err || '') && r.after.signedIn === false, r);
    check('invalid client id is refused by the in-app setup', /config_invalid|config_placeholder/.test(r.save), r);
    r = await run('placeholder', withSave("'xxxxxxxx.apps.googleusercontent.com', 'GOCSPX-xxxxxxxx'"));
    check('placeholder values are refused', /config_placeholder/.test(r.save), r);

    mode = 'ok';
    r = await run('setup', withSave(`'${ID}', '${SECRET}'`));          // configure from inside the app, then sign up
    check('in-app setup saves the client and sign-up (new user) works', r.save === 'saved' && r.first.ok && r.first.restored === false && r.after.signedIn && r.after.email === 'seng@example.com', r);
    check('settings were uploaded and logout clears the session', r.theme === 'darcula' && r.logout === false, r);

    r = await run('returning', withSave("'', ''").replace(/out\.save = .*\n/, ''), CFG);   // fresh profile = reinstall
    check('existing Google user signs in again and settings are restored', r.first.ok && r.first.restored === true && r.restoredTheme === 'darcula', r);

    for (const [m, re] of [['cancel', /cancelled/], ['badstate', /state_mismatch/], ['badnonce', /bad_nonce/], ['badsig', /bad_signature/], ['expired', /expired/], ['unverified', /email_unverified/]]) {
      mode = m; r = await run('m-' + m, withSave("'', ''").replace(/out\.save = .*\n/, ''), CFG);
      check(`${m}: rejected and not signed in`, re.test((r.first && r.first.err) || '') && r.after.signedIn === false, r);
    }
    mode = 'hang'; r = await run('busy', BUSY, CFG);
    check('second sign-in is refused while one is running; cancel cleans up', /busy/.test(r.second || '') && /cancelled/.test(r.first || ''), r);
  } catch (e) { fail++; console.log('FAIL harness -> ' + e.stack); }
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
