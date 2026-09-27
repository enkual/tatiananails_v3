/* ── Nail Studio — backend configuration ─────────────────────────────────
   Fill these two values in to store bookings in Supabase instead of only
   in the visitor's browser. Leave them empty and the site keeps working
   offline (localStorage only).

   Both values are safe to publish: the anon key is a public key, and the
   database is protected by the row-level-security policies in SETUP.md.
   ──────────────────────────────────────────────────────────────────────── */
window.NAIL_CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',  // the long "anon public" key from Supabase → API

  // How often the admin calendar re-checks the database, in seconds.
  pollSeconds: 20
};
