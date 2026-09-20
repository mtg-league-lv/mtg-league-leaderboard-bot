# Phase 2 auth — one-time setup

1. **Google Cloud** → create an OAuth 2.0 Client (Web application).
   - Authorized redirect URI: `https://shtatdxrwmiyzzvrfaai.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client secret.
2. **Supabase → Authentication → Providers → Google:** enable, paste the Client ID/secret, save.
3. **Supabase → Authentication → Providers:** ensure **Email** signups are disabled
   (Google-only), so the public anon key can't be used to self-register or spam auth emails.
4. **Supabase → Authentication → URL Configuration:**
   - Site URL: the GitHub Pages URL of the site.
   - Redirect URLs: add the same Pages URL.
5. **Apply the `profiles` migration** (already applied via the Supabase migration `profiles_table`).
6. **Link a user to a player:** after the person signs in once (creating their
   `auth.users` row), insert a `profiles` row in the dashboard:
   `id` = their auth user id (Authentication → Users), `player_key` = the player's key.
