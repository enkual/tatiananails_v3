/* Shared booking data for the Nail Studio site and the Admin page.
   Classic script — sets window.NailStore. Loaded from both pages' <helmet>. */
(function () {
  const KEY = 'nailstudio.riga.v1';
  const AUTHKEY = 'nailstudio.riga.auth';
  const LANGKEY = 'nailstudio.riga.lang';
  const LOCALE = { lv: 'lv-LV', en: 'en-GB', ru: 'ru-RU' };

  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const pISO = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const m2t = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const t2m = t => { const p = String(t).split(':').map(Number); return p[0] * 60 + p[1]; };
  const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const monday = d => addD(d, -((d.getDay() + 6) % 7));
  const uid = () => Math.random().toString(36).slice(2, 9);

  const SERVICES = [
    { id: 'classic', min: 60, price: 20, n: { lv: 'Klasiskais manikīrs', en: 'Classic manicure', ru: 'Классический маникюр' }, d: { lv: 'Forma, kutikula, pulēšana, eļļa.', en: 'Shape, cuticles, buff, oil.', ru: 'Форма, кутикула, полировка, масло.' } },
    { id: 'gel', min: 90, price: 35, n: { lv: 'Manikīrs ar gēllaku', en: 'Manicure with gel polish', ru: 'Маникюр с гель-лаком' }, d: { lv: 'Manikīrs un noturīgs pārklājums.', en: 'Manicure plus long-wear colour.', ru: 'Маникюр и стойкое покрытие.' } },
    { id: 'ext', min: 150, price: 45, n: { lv: 'Nagu pieaudzēšana', en: 'Gel extensions', ru: 'Наращивание гелем' }, d: { lv: 'Garums un forma, veidota gēlā.', en: 'Length and shape built in gel.', ru: 'Длина и форма, выстроенные гелем.' } },
    { id: 'fill', min: 120, price: 55, n: { lv: 'Korekcija', en: 'Refill', ru: 'Коррекция' }, d: { lv: 'Uzturēšana ik pēc 3–4 nedēļām.', en: 'Upkeep every three to four weeks.', ru: 'Поддержание раз в 3–4 недели.' } },
    { id: 'art', min: 30, price: 15, n: { lv: 'Dizains un dekori', en: 'Nail art', ru: 'Дизайн и декор' }, d: { lv: 'Papildinājums jebkuram pārklājumam.', en: 'Added to any colour service.', ru: 'Дополнение к любому покрытию.' } },
    { id: 'off', min: 30, price: 12, n: { lv: 'Pārklājuma noņemšana', en: 'Removal', ru: 'Снятие покрытия' }, d: { lv: 'Ar nagu atjaunošanu.', en: 'With a conditioning finish.', ru: 'С восстановлением ногтя.' } }
  ];
  const SVC = id => SERVICES.filter(s => s.id === id)[0] || SERVICES[0];

  // Index 0 = Sunday, matching Date.getDay()
  const DEF_HOURS = [
    { closed: true, o: '10:00', c: '15:00' },
    { closed: false, o: '10:00', c: '19:00' },
    { closed: false, o: '10:00', c: '19:00' },
    { closed: false, o: '10:00', c: '19:00' },
    { closed: false, o: '10:00', c: '19:00' },
    { closed: false, o: '10:00', c: '19:00' },
    { closed: false, o: '10:00', c: '15:00' }
  ];

  /* The early demo data shipped into browsers that opened the site before it
     was cleaned, so strip those known rows once and remember it was done. */
  const SEEDKEY = 'nailstudio.riga.seedcleared';
  const SEED_REFS = ['NS-4812', 'NS-4821', 'NS-4822', 'NS-4826', 'NS-4827'];
  function dropSeed(d) {
    let done = false;
    try { done = localStorage.getItem(SEEDKEY) === '1'; } catch (e) { }
    if (done) return d;
    const bookings = (d.bookings || []).filter(b => SEED_REFS.indexOf(b.ref) < 0);
    const blocks = (d.blocks || []).filter(b => b.reason !== 'Kursi / Training');
    const changed = bookings.length !== (d.bookings || []).length || blocks.length !== (d.blocks || []).length;
    d.bookings = bookings; d.blocks = blocks;
    try {
      localStorage.setItem(SEEDKEY, '1');
      if (changed) localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) { }
    return d;
  }

  function load() {
    let d = null;
    try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { }
    if (!d) d = {};
    d = dropSeed(d);
    return {
      bookings: d.bookings || [], blocks: d.blocks || [],
      hours: d.hours || DEF_HOURS.map(h => ({ ...h })),
      step: d.step || 30, lead: typeof d.lead === 'number' ? d.lead : 3
    };
  }
  function save(d) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        bookings: d.bookings, blocks: d.blocks, hours: d.hours, step: d.step, lead: d.lead
      }));
    } catch (e) { }
    push(d);
  }

  const LIVE = b => b.status !== 'declined' && b.status !== 'deleted';

  const hoursFor = (d, dateISO) => { const h = d.hours[pISO(dateISO).getDay()]; return h && !h.closed ? h : null; };
  function busy(d, dateISO) {
    const r = [];
    d.bookings.forEach(b => { if (b.date === dateISO && LIVE(b)) r.push([t2m(b.time), t2m(b.time) + SVC(b.svc).min, b]); });
    d.blocks.forEach(b => { if (b.date === dateISO) r.push([t2m(b.from), t2m(b.to), b]); });
    return r.sort((a, b) => a[0] - b[0]);
  }
  function slots(d, dateISO, dur, ignoreLead, skipId) {
    const h = hoursFor(d, dateISO); if (!h) return [];
    const taken = busy(d, dateISO).filter(x => !skipId || !x[2] || x[2].id !== skipId);
    const now = new Date(), out = [];
    const today = iso(now);
    const minStart = ignoreLead ? -1
      : dateISO === today ? now.getHours() * 60 + now.getMinutes() + d.lead * 60
        : pISO(dateISO) < new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? 1e9 : -1;
    for (let s = t2m(h.o); s + dur <= t2m(h.c); s += (d.step || 30)) {
      if (s < minStart) continue;
      let ok = true;
      for (let i = 0; i < taken.length; i++) if (s < taken[i][1] && s + dur > taken[i][0]) { ok = false; break; }
      if (ok) out.push(m2t(s));
    }
    return out;
  }

  /* ── Supabase ──────────────────────────────────────────────────────────
     The app renders from localStorage (instant, works offline) and treats
     Supabase as the shared copy: pull() reads the database into the local
     cache, save() mirrors the local state back. One master editing at a
     time, so a full-state sync is both simplest and safe. Swapping backend
     means rewriting only this block. */
  const CFG = () => (window.NAIL_CONFIG || {});
  const remote = () => !!(CFG().supabaseUrl && CFG().supabaseAnonKey);

  function api(path, init) {
    const c = CFG();
    const o = init || {};
    return fetch(c.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + path, {
      method: o.method || 'GET',
      headers: Object.assign({
        apikey: c.supabaseAnonKey,
        Authorization: 'Bearer ' + c.supabaseAnonKey,
        'Content-Type': 'application/json'
      }, o.headers || {}),
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(r => {
      if (!r.ok) return r.text().then(t => { throw new Error(r.status + ' ' + t); });
      return r.status === 204 ? null : r.json();
    });
  }

  const rowToBooking = r => ({
    id: r.id, ref: r.ref, date: r.date, time: String(r.time).slice(0, 5), svc: r.svc,
    name: r.name || '', phone: r.phone || '', email: r.email || '', ig: r.ig || '',
    note: r.note || '', first: !!r.first_visit, status: r.status, made: Number(r.made) || Date.now()
  });
  const bookingToRow = b => ({
    id: b.id, ref: b.ref, date: b.date, time: b.time, svc: b.svc, name: b.name,
    phone: b.phone || '', email: b.email || '', ig: b.ig || '', note: b.note || '',
    first_visit: !!b.first, status: b.status, made: b.made || Date.now()
  });
  const rowToBlock = r => ({
    id: r.id, date: r.date, from: String(r.from_time).slice(0, 5),
    to: String(r.to_time).slice(0, 5), reason: r.reason || ''
  });
  const blockToRow = b => ({
    id: b.id, date: b.date, from_time: b.from, to_time: b.to, reason: b.reason || ''
  });

  /* Reads the database into the local cache, then hands the merged state to
     cb. Falls back silently to the local copy when offline or unconfigured. */
  function pull(cb) {
    if (!remote()) { if (cb) cb(load(), false); return; }
    Promise.all([
      api('bookings?select=*'),
      api('blocks?select=*'),
      api('settings?select=*&id=eq.1')
    ]).then(res => {
      const local = load();
      const d = {
        bookings: (res[0] || []).map(rowToBooking),
        blocks: (res[1] || []).map(rowToBlock),
        hours: (res[2] && res[2][0] && res[2][0].hours) || local.hours,
        step: (res[2] && res[2][0] && res[2][0].step) || local.step,
        lead: res[2] && res[2][0] && typeof res[2][0].lead === 'number' ? res[2][0].lead : local.lead
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch (e) { }
      pulledOk = true;
      if (cb) cb(d, true);
    }).catch(err => {
      if (window.console) console.warn('[NailStore] pull failed, using local copy:', err.message);
      if (cb) cb(load(), false);
    });
  }

  /* A full-state sync deletes remote rows that are missing locally, so it may
     only run once this device has genuinely read the database. Without this
     gate, one offline load followed by any save would wipe the table. */
  let pulledOk = false;
  let pushing = false, pendingPush = null;
  function push(d) {
    if (!remote() || !pulledOk) return;
    if (pushing) { pendingPush = d; return; }
    pushing = true;
    const ids = (d.bookings || []).map(b => "'" + b.id + "'").join(',');
    const bids = (d.blocks || []).map(b => "'" + b.id + "'").join(',');
    const merge = { Prefer: 'resolution=merge-duplicates' };
    const jobs = [];
    if ((d.bookings || []).length) jobs.push(api('bookings', { method: 'POST', headers: merge, body: d.bookings.map(bookingToRow) }));
    jobs.push(api('bookings?id=' + (ids ? 'not.in.(' + ids + ')' : 'neq.__none__'), { method: 'DELETE' }));
    if ((d.blocks || []).length) jobs.push(api('blocks', { method: 'POST', headers: merge, body: d.blocks.map(blockToRow) }));
    jobs.push(api('blocks?id=' + (bids ? 'not.in.(' + bids + ')' : 'neq.__none__'), { method: 'DELETE' }));
    jobs.push(api('settings', { method: 'POST', headers: merge, body: [{ id: 1, hours: d.hours, step: d.step, lead: d.lead }] }));
    Promise.all(jobs).catch(err => {
      if (window.console) console.warn('[NailStore] save to Supabase failed (kept locally):', err.message);
    }).then(() => {
      pushing = false;
      if (pendingPush) { const p = pendingPush; pendingPush = null; push(p); }
    });
  }

  /* The public page books through this, never through save(): it inserts the
     one new row and can therefore never delete anyone else's. */
  function insertBooking(b) {
    if (!remote()) return Promise.resolve(false);
    return api('bookings', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: [bookingToRow(b)]
    }).then(() => true).catch(err => {
      if (window.console) console.warn('[NailStore] booking not sent to Supabase (kept locally):', err.message);
      return false;
    });
  }

  /* Re-reads the database on an interval so a second device sees new
     requests without a manual refresh. Returns a stop function. */
  function watch(cb) {
    if (!remote()) return () => { };
    const every = Math.max(5, Number(CFG().pollSeconds) || 20) * 1000;
    const id = setInterval(() => pull(cb), every);
    return () => clearInterval(id);
  }

  /* ── Cloudflare Worker session ─────────────────────────────────────────
     When functions/_middleware.js guards the admin pages, the request never
     reaches them unauthenticated — so if the endpoint confirms a session, the
     page's own passcode screen is redundant and is skipped. Anywhere else
     (local file, preview, unconfigured deploy) the endpoint is absent and the
     passcode stays in charge. */
  function session(cb) {
    let done = false;
    const answer = v => { if (!done) { done = true; cb(v); } };
    setTimeout(() => answer({ ok: false, configured: false }), 4000);
    try {
      fetch('/__admin/session', { credentials: 'same-origin', cache: 'no-store' })
        .then(r => {
          const type = r.headers.get('Content-Type') || '';
          if (!r.ok || type.indexOf('application/json') < 0) throw new Error('no gate');
          return r.json();
        })
        .then(d => answer({ ok: !!(d && d.ok), configured: !!(d && d.configured) }))
        .catch(() => answer({ ok: false, configured: false }));
    } catch (e) { answer({ ok: false, configured: false }); }
  }
  const logoutUrl = '/__admin/logout';

  /* The public page is "Nail Studio.dc.html" in the project but ships as
     index.html on a static host, so the back-links resolve at runtime
     instead of hardcoding either name. */
  let home = 'Nail Studio.dc.html';
  const homeHref = () => home;
  function resolveHome(cb) {
    try {
      fetch('index.html', { method: 'HEAD' }).then(r => {
        if (r && r.ok) { home = 'index.html'; if (cb) cb(home); }
      }).catch(() => { });
    } catch (e) { }
  }

  window.NailStore = {
    KEY, AUTHKEY, LANGKEY, LOCALE, SERVICES, SVC, DEF_HOURS,
    pad, iso, pISO, m2t, t2m, addD, monday, uid, LIVE,
    load, save, hoursFor, busy, slots,
    remote, pull, watch, api, insertBooking, session, logoutUrl,
    homeHref, resolveHome
  };
})();
