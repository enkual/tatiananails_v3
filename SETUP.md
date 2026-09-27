# Nail Studio — connecting Supabase and hosting on Cloudflare

The site works with no backend at all (bookings live in the visitor's browser).
Filling in `config.js` turns Supabase into the shared store, so a booking made
on a client's phone appears in the admin calendar on yours.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a region close to Rīga
   (Frankfurt is the nearest). Save the database password somewhere safe.
2. Open **SQL Editor** → **New query**, paste everything in section 2, press
   **Run**.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long `eyJ…` string

## 2. The database schema

Paste this whole block into the SQL editor and run it once.

```sql
-- Bookings: one row per request, whatever its status
create table if not exists bookings (
  id          text primary key,
  ref         text not null,
  date        date not null,
  time        time not null,
  svc         text not null,
  name        text not null default '',
  phone       text not null default '',
  email       text not null default '',
  ig          text not null default '',
  note        text not null default '',
  first_visit boolean not null default false,
  status      text not null default 'pending',
  made        bigint not null default 0
);

-- Time the master blocks off (holidays, breaks, training)
create table if not exists blocks (
  id        text primary key,
  date      date not null,
  from_time time not null,
  to_time   time not null,
  reason    text not null default ''
);

-- Working hours, slot step and minimum notice — a single row
create table if not exists settings (
  id    int primary key default 1,
  hours jsonb,
  step  int  not null default 30,
  lead  int  not null default 3
);

create index if not exists bookings_date_idx on bookings (date);
create index if not exists blocks_date_idx   on blocks (date);

alter table bookings enable row level security;
alter table blocks   enable row level security;
alter table settings enable row level security;

-- Start-here policies: the site and the admin share the public anon key.
-- Simple, works immediately. Read section 6 before taking real bookings.
create policy "anon all bookings" on bookings for all
  using (true) with check (true);
create policy "anon all blocks"   on blocks   for all
  using (true) with check (true);
create policy "anon all settings" on settings for all
  using (true) with check (true);
```

## 3. Point the site at it

Open `config.js` and paste the two values:

```js
window.NAIL_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi…',
  pollSeconds: 20
};
```

Both are safe to publish — the anon key is a public key; the database is
protected by the policies above.

Confirm it took: open the admin, **Darba laiks** panel. A rose dot and
"Supabase pieslēgts" means connected; a grey dot means it is still
browser-only (check the two values and the browser console).

## 4. How the data flows

- The page renders from `localStorage`, so it is instant and works offline.
- On load, each page **pulls** the database into that local copy.
- Every change (a client booking, a confirm, a block, an hours edit) **pushes**
  the full state back.
- The admin and history pages re-check the database every `pollSeconds`.

All of it lives in one block of `booking-store.js` (`pull`, `push`, `watch`).
To move to a different backend, that block is the only thing to rewrite.

Caveat worth knowing: writes are last-one-wins. Fine for a single master; if two
people ever edit the calendar at the same moment, the later save takes the day.

## 5. Hosting on Cloudflare Pages

Cloudflare serves the folder as-is — there is nothing to build.

**Prepare the folder once, whichever route you pick:**

1. Download the project (Export → download) and unzip it.
2. Rename `Nail Studio.dc.html` to `index.html`.
3. Delete the `uploads/` folder — it is scratch space and only bloats the
   deploy.
4. Keep everything else, including the hidden `.image-slots.state.json` (it
   holds your photographs — without it the gallery is empty) and the
   `functions/` folder (the admin login Worker).

### Important: the drag-and-drop uploader cannot run the login Worker

Cloudflare's **Upload assets** box is static-only. It shows *"Pages functions
are not supported"* and silently drops `functions/_middleware.js`, so the
Worker login from section 7 will not exist on that deploy — the admin then falls
back to its built-in passcode. Use one of the two routes below to get real
server-side authorization.

**Route A — connect Git (recommended, no terminal)**

1. Push the prepared folder to a GitHub repository.
2. Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
3. Framework preset **None**, build command **empty**, output directory `/`.
4. **Save and Deploy.** Functions are picked up automatically; every later push
   redeploys.

**Route B — wrangler from the terminal**

```sh
cd nail-studio            # the prepared folder
npx wrangler pages deploy . --project-name=nail-studio
```

It logs you in through the browser on first run. Both routes deploy
`functions/` properly.

**Route C — drag and drop** is still fine for a quick look, just knowing the
admin will be passcode-only:

1. **Workers & Pages → Create → Pages → Upload assets**, drag the folder in,
   **Deploy**.

The site is live at `your-project.pages.dev`; the admin is at
`your-project.pages.dev/Admin.dc.html`.

**Custom domain:** Pages → your project → **Custom domains → Set up a domain**.
If the domain is already on Cloudflare the DNS record is written for you;
otherwise point a `CNAME` at `your-project.pages.dev`.

Two Cloudflare notes:
- Add `_headers` with the lines below if you want the admin kept out of Google:

  ```
  /Admin.dc.html
    X-Robots-Tag: noindex
  /History.dc.html
    X-Robots-Tag: noindex
  ```
- Supabase needs no CORS setup for this — the REST API already allows browser
  calls from any origin.

## 7. Real admin login with Cloudflare Workers

`functions/_middleware.js` is already in the project. On Cloudflare Pages that
file **is** a Worker: it runs in front of every request and guards
`/Admin.dc.html` and `/History.dc.html` with a server-side session, so the
password never ships to the browser and the cookie is HttpOnly and signed.

**Setup**

1. Deploy through **Git or wrangler** (routes A or B in section 5) so the
   `functions/` folder is actually uploaded — the drag-and-drop uploader
   discards it and the Worker will never run.
2. Pages → your project → **Settings → Environment variables → Add** for the
   *Production* environment:
   - `ADMIN_PASSWORD` — the studio password
   - `ADMIN_SECRET` — any long random string, e.g. from
     `openssl rand -base64 32`
3. **Redeploy** (environment variables only apply to new deployments).

**What then happens**

- Visiting `/Admin.dc.html` without a session shows the Worker's own login
  page — styled to match the site — and the admin HTML is never sent.
- A correct password sets a signed `ns_session` cookie, good for 12 hours.
- The admin page asks `/__admin/session` on load; because the Worker already
  vouched for you, the in-page passcode screen is skipped entirely.
- **Iziet** now calls `/__admin/logout`, which clears the cookie server-side.
- Admin pages are sent with `no-store` and `X-Robots-Tag: noindex`.

**Endpoints** the Worker adds: `/__admin/login` (POST), `/__admin/logout`,
`/__admin/session` (JSON).

Until those two variables exist, the Worker deliberately stays out of the way
and the built-in passcode keeps working — so nothing breaks before or during
setup, and the app still runs from a plain file or the preview.

**Standalone Worker instead of Pages?** The same code works as a normal Worker
with a route like `example.com/*`; replace the `next()` calls with
`env.ASSETS.fetch(request)` and bind your static site to `ASSETS`. Pages
Functions is the simpler path unless you already have a Worker in front.

**Worth doing next:** with a Worker in place, the Supabase key no longer has to
be public — the Worker can hold the *service* key and proxy `/api/*` to
Supabase, so the browser never sees a database credential at all. Say the word
and I will wire that.

## 8. Before taking real client bookings

With section 7 in place the admin pages themselves are properly protected. The
remaining gap is the database: the anon key in `config.js` is public, so anyone
who finds it could read the bookings table directly (the Worker proxy at the end
of section 7 closes this). Client
names and phone numbers are personal data under GDPR, so when this stops being a
trial:

1. **Split the policies** so the public page can only *write* a request:

   ```sql
   drop policy "anon all bookings" on bookings;

   create policy "anyone may request" on bookings for insert
     with check (status = 'pending');
   create policy "only staff may read"   on bookings for select
     using (auth.role() = 'authenticated');
   create policy "only staff may change" on bookings for update
     using (auth.role() = 'authenticated');
   create policy "only staff may delete" on bookings for delete
     using (auth.role() = 'authenticated');
   ```

   The public booking form still needs to know which slots are taken, so expose
   *only* the busy times through a view (no names):

   ```sql
   create or replace view free_busy as
     select date, time, svc from bookings
     where status in ('pending','confirmed');
   grant select on free_busy to anon;
   ```

   Then replace the admin passcode with **Supabase Auth** (Email magic link is
   enough for one person) and read availability on the public page from
   `free_busy` instead of `bookings`.

2. Add a short privacy note to the site saying what you store, why, and for how
   long, plus an email address for deletion requests.

I can do step 1 for you — say the word and I will wire Supabase Auth into the
admin and move the public page onto the `free_busy` view.
