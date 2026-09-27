/* ── Nail Studio — backend configuration ─────────────────────────────────
   Fill these two values in to store bookings in Supabase instead of only
   in the visitor's browser. Leave them empty and the site keeps working
   offline (localStorage only).

   Both values are safe to publish: the anon key is a public key, and the
   database is protected by the row-level-security policies in SETUP.md.
   ──────────────────────────────────────────────────────────────────────── */
window.NAIL_CONFIG = {
  supabaseUrl: 'sb_publishable_960C2mn5EG9g7o7qv7WkbQ_UHGOHhfS',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsZ3V5dnVxcG1ic2tpbXFpcXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0OTk1MTQsImV4cCI6MjEwNjA3NTUxNH0.Jvjelx0hD2ax7QoBxei3kZ-5kpfMO94HMM_irM-hGzk',  // the long "anon public" key from Supabase → API

  // How often the admin calendar re-checks the database, in seconds.
  pollSeconds: 20
};
