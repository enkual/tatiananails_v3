/* ── Cloudflare Pages Functions: admin authorization ─────────────────────
   Put this file at functions/_middleware.js and Cloudflare runs it as a
   Worker in front of every request to the site.

   It protects the admin pages with a real server-side session: the password
   is never in the client bundle, and the session cookie is HttpOnly and
   signed, so it cannot be forged or read by JavaScript.

   Environment variables (Pages → Settings → Environment variables):
     ADMIN_PASSWORD  the studio password
     ADMIN_SECRET    any long random string (used to sign the cookie)

   See SETUP.md section 7 for the click-by-click setup.
   ──────────────────────────────────────────────────────────────────────── */

const PROTECTED = ['/admin.dc.html', '/history.dc.html'];
const DEFAULT_DEST = '/Admin.dc.html';

/* URL.pathname keeps percent-escapes and duplicate slashes, so matching it
   raw would let /Admin%2Edc.html or //Admin.dc.html slip past the gate and
   reach the asset server, which normalises them. Decode and collapse first. */
function normalise(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return null; }
  p = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  const parts = [];
  p.split('/').forEach(seg => {
    if (seg === '' || seg === '.') return;
    if (seg === '..') { parts.pop(); return; }
    parts.push(seg);
  });
  return '/' + parts.join('/');
}

/* next is form input, so a protocol-relative value like //evil.com would be a
   valid same-prefix redirect. Only the pages this worker guards are allowed. */
function safeDest(raw) {
  const p = normalise(String(raw || ''));
  if (!p) return DEFAULT_DEST;
  return PROTECTED.indexOf(p.toLowerCase()) > -1 ? p : DEFAULT_DEST;
}
const COOKIE = 'ns_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

const enc = new TextEncoder();

async function key(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(value, secret) {
  const mac = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(value));
  return btoa(String.fromCharCode.apply(null, new Uint8Array(mac))).replace(/=+$/, '');
}
async function mint(secret) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return exp + '.' + (await sign(exp, secret));
}
async function valid(token, secret) {
  if (!token) return false;
  const i = token.lastIndexOf('.');
  if (i < 1) return false;
  const exp = token.slice(0, i), mac = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const want = await sign(exp, secret);
  // constant-time-ish compare
  if (want.length !== mac.length) return false;
  let diff = 0;
  for (let n = 0; n < want.length; n++) diff |= want.charCodeAt(n) ^ mac.charCodeAt(n);
  return diff === 0;
}
function cookieValue(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const hit = raw.split(';').map(s => s.trim()).filter(s => s.indexOf(name + '=') === 0)[0];
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : '';
}
const json = (body, status) => new Response(JSON.stringify(body), {
  status: status || 200,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});

function loginPage(next, failed) {
  return new Response(`<!doctype html>
<html lang="lv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  :root{--ink:#201e1d;--bg:#f3f2f2;--rose:#D49286;--rose-dark:#a26154;--line:#d7d4d3}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;
       background:var(--bg);color:var(--ink);font:400 15px/1.5 Archivo,system-ui,sans-serif}
  form{width:min(380px,100%)}
  .kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--rose-dark);font-weight:700;margin-bottom:12px}
  h1{font-size:40px;letter-spacing:-.035em;margin:0 0 8px;font-weight:800}
  p{font-size:14px;margin:0 0 26px;max-width:34ch;color:#6b6765}
  label{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-bottom:6px}
  input{width:100%;min-height:44px;padding:0 12px;font:400 16px Archivo,sans-serif;color:var(--ink);
        background:#fff;border:1px solid var(--line);border-radius:5px}
  input:focus-visible{outline:2px solid var(--rose);outline-offset:2px}
  button{width:100%;min-height:44px;margin-top:14px;font:800 15px Archivo,sans-serif;color:var(--ink);
         background:var(--rose);border:none;border-radius:5px;cursor:pointer}
  button:hover{background:var(--rose-dark);color:#fff}
  .err{font-size:13px;color:#8B1A1A;margin-top:10px;min-height:18px}
  .rule{height:2px;background:var(--line);margin:24px 0}
  a{color:var(--rose-dark);font-size:13px;text-decoration:none}
  a:hover{text-decoration:underline}
</style></head>
<body>
  <form method="POST" action="/__admin/login">
    <div class="kicker">Nail Studio</div>
    <h1>Admin</h1>
    <p>Ievadi studijas paroli, lai atvērtu kalendāru.</p>
    <input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}">
    <label for="p">Parole</label>
    <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">Ienākt</button>
    <div class="err">${failed ? 'Nepareiza parole.' : ''}</div>
    <div class="rule"></div>
    <a href="/">Atpakaļ uz vietni</a>
  </form>
</body></html>`, {
    status: failed ? 401 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const clean = normalise(url.pathname);
  if (clean === null) return new Response('Bad request', { status: 400 });
  const path = clean.toLowerCase();
  const secret = env.ADMIN_SECRET || '';
  const password = env.ADMIN_PASSWORD || '';

  // ── session endpoints ───────────────────────────────────────────────────
  if (path === '/__admin/session') {
    if (!password || !secret) return json({ ok: false, configured: false });
    return json({ ok: await valid(cookieValue(request, COOKIE), secret), configured: true });
  }

  if (path === '/__admin/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
      }
    });
  }

  if (path === '/__admin/login') {
    if (request.method !== 'POST') return Response.redirect(url.origin + '/', 302);
    const form = await request.formData();
    const given = String(form.get('password') || '');
    const dest = safeDest(form.get('next'));
    if (!password || !secret || given !== password) return loginPage(dest, true);
    return new Response(null, {
      status: 302,
      headers: {
        Location: dest,
        'Set-Cookie': COOKIE + '=' + encodeURIComponent(await mint(secret)) +
          '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE
      }
    });
  }

  // ── gate the admin pages ────────────────────────────────────────────────
  if (PROTECTED.indexOf(path) > -1) {
    // Not configured yet: let the page through so its own passcode still works.
    if (!password || !secret) return next();
    if (!(await valid(cookieValue(request, COOKIE), secret))) {
      return loginPage(clean + url.search, false);
    }
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Robots-Tag', 'noindex');
    // sliding window: every authenticated page load extends the session
    out.headers.append('Set-Cookie', COOKIE + '=' + encodeURIComponent(await mint(secret)) +
      '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + MAX_AGE);
    return out;
  }

  return next();
}
