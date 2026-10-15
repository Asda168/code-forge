# Google sign-in and settings sync

Asta signs in with Google **directly from the desktop app**: OAuth 2.0 authorization code + **PKCE**, no Asta server and
no database. After sign-in your settings, theme, keyboard shortcuts and declarative extensions are kept in a hidden file in
**your own Google Drive app-data folder** (`asta-sync.json`) and restored the next time you sign in, even after a reinstall.

> Why you see "Google sign-in is not set up": Google requires every app to have its own OAuth client, which can only be
> created in a Google account you control. Asta ships without one; follow the steps below once.

## 1. Create the OAuth client (Google Cloud Console)

1. Create (or pick) a project at <https://console.cloud.google.com/>.
2. **APIs & Services -> Library**: enable **Google Drive API**.
3. **APIs & Services -> OAuth consent screen**: user type *External*, fill in the app name (`Asta IDE`) and support email.
   Add the scope `https://www.googleapis.com/auth/drive.appdata` (plus `openid`, `email`, `profile`).
   While the app is in *Testing*, add every account that should be able to sign in under **Test users**.
4. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**, application type **Desktop app**.
   *Desktop app* clients need **no redirect URI to register**: Google accepts `http://127.0.0.1:<random port>/cb`
   (the loopback redirect Asta uses) automatically. Do not choose "Web application".
5. Copy the **Client ID** (`123456789012-xxxx.apps.googleusercontent.com`). Google also shows a *client secret* for Desktop
   clients; Google documents it as **not confidential**, and Asta only ever sends it from the main process to Google. It is
   optional in Asta's config but Google's token endpoint currently still asks for it for Desktop clients.

Asta requests only: `openid email profile` and `drive.appdata` (a folder only Asta can see; it cannot read your other files).

## 2. Give the app the client

**Easiest: do nothing by hand.** Click **Sign in** or **Sign up** in Asta. When no client is configured, a *Set up Google sign-in*
dialog asks for the Client ID (and optional secret), validates them, stores them for your user (`google-oauth.json` in the
user-data folder, owner-only permissions) and continues straight into Google's account chooser.

For CI and release builds, or to prepare the file yourself, `desktop/src/google-oauth.example.json` shows the format
(placeholders only). Sources, earlier wins:

| Priority | Source | Use for |
|---|---|---|
| 1 | env `CODEFORGE_GOOGLE_CLIENT_ID` / `CODEFORGE_GOOGLE_CLIENT_SECRET` | development, CI |
| 2 | `<userData>/google-oauth.json` (Windows `%APPDATA%\Asta`, macOS `~/Library/Application Support/Asta`, Linux `~/.config/Asta`) | per-user override of any build |
| 3 | `desktop/src/google-oauth.json` (git-ignored; packaged into the installer) | release builds |

```json
{ "clientId": "123456789012-abcdefghijklmnop.apps.googleusercontent.com", "clientSecret": "GOCSPX-..." }
```

`google-oauth.json` is in `.gitignore`. **Never commit real values.**

## 3. Release builds

The GitHub workflow (`.github/workflows/release.yml`) writes `src/google-oauth.json` before packaging from two repository
secrets, so installers for Windows, macOS and Linux all carry the client:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (optional)

Without the secrets the build still succeeds; Sign in then shows the setup message instead of failing. Local builds
(`npm run dist:win|mac|linux`) pick up `desktop/src/google-oauth.json` because `src/**` is packaged.

## What the app validates

State (CSRF) and PKCE verifier per attempt, loopback-only redirect used once, the ID token's RS256 signature against
Google's published keys, issuer, audience (your client ID), expiry, `nonce`, and a **verified email**. The refresh token is
encrypted with the OS credential store (DPAPI / Keychain / libsecret) and never reaches the renderer. Tokens, codes and
secrets are never logged.

## Accounts and sign-up vs sign-in

There is one button flow: the first time a Google account signs in it is a **sign-up** ("Google sign-up completed successfully."),
afterwards it is a **sign-in** ("Welcome back!").

The identity is Google's stable account id (`sub`), so signing in again from a new install or computer always finds the same
saved settings; there is nothing to register and no duplicate accounts. Username/password accounts (optional Django backend)
are separate and are never merged with a Google identity by email.

On the optional Django backend the same rules are enforced in the database: the `SocialIdentity` table has a unique
constraint on `(provider, subject)`, creation is transactional with a race fallback, and a verified email that matches an
existing password account does **not** link or take over that account.

## Troubleshooting

| Message | Fix |
|---|---|
| Google sign-in is not set up | No client ID found: complete step 2 |
| ...still contains the example placeholder values | Replace the `xxxx` values with your real client ID |
| The Google client ID looks wrong | Use the *Desktop app* client ID (ends with `.apps.googleusercontent.com`) |
| Error 403 `access_denied` in the browser | Add your account under *Test users* on the consent screen |
| Google did not return an offline session | Remove Asta at <https://myaccount.google.com/permissions> and sign in again |
| Needs permission to store settings in Drive | Sign in again and allow the Drive app-data permission |
| Cannot reach Google | Check the internet connection / proxy |

## Testing

| Command | Covers |
|---|---|
| `node desktop/scripts/google-auth-test.js` | config validation, PKCE, state, nonce, ID-token signature and claims, error messages |
| `node desktop/scripts/e2e-google.js` | the real Electron app against a local mock of Google: in-app setup, new user, returning user + restore, cancel, forged state, replayed nonce, bad signature, expired and unverified tokens, single-flight |
| `python backend/manage.py test core` | backend identity binding, duplicate prevention, no email takeover, session and logout |

The mock is wired through the test-only override `CODEFORGE_GOOGLE_TEST_BASE` (ignored unless set). Real Google, the
consent screens and macOS/Linux packaging still need a manual check with your own OAuth client.
