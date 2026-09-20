# Phase 2 auth — one-time setup

You need your existing Google (Gmail) account. **No new account, no billing, no
credit card** — creating an OAuth client is free. Budget ~10 minutes.

The app offers **both Discord and Google** sign-in. You can enable either or
both in Supabase — only the providers you enable appear to work. Set up whichever
you want (**A** = Google, **A2** = Discord), then **B** configure Supabase and
**C** link yourself to a player.

---

## A. Google Cloud — create the OAuth client

Google recently renamed this area to **"Google Auth Platform"** (formerly "OAuth
consent screen" under APIs & Services). Both names are noted below.

1. Go to <https://console.cloud.google.com> and sign in with your Gmail.
2. **Create a project** (a free container): top bar → project dropdown →
   **New Project** → name it e.g. `mtg-league` → **Create** → then make sure
   that project is selected in the top bar.
3. Open **Google Auth Platform** (search "Google Auth Platform" in the top
   search bar, or **APIs & Services → OAuth consent screen**).
4. If prompted to configure it, click **Get started** and fill:
   - **App name:** `MTG Latvia Standard League` (shown on Google's sign-in screen).
   - **User support email:** your Gmail.
   - **Audience:** **External**.
   - **Contact information:** your Gmail. Save/continue to finish.
5. Choose who can sign in — under **Audience**:
   - **Recommended: click "Publish app" → confirm.** We only request basic
     `email` + `profile` scopes, so **no Google verification review is needed**,
     and anyone with a Google account can sign in.
   - *Alternative (keep it private):* leave it in **Testing** and add each
     member's Gmail under **Test users → Add users**. Only those can sign in.
6. Create the credential — go to **Clients** (or **APIs & Services →
   Credentials**) → **Create client** / **+ Create credentials → OAuth client ID**:
   - **Application type:** **Web application**.
   - **Name:** `supabase-web` (any label).
   - **Authorized redirect URIs → Add URI:**
     `https://shtatdxrwmiyzzvrfaai.supabase.co/auth/v1/callback`
   - **Create.**
7. Copy the **Client ID** and **Client secret** from the dialog (you can reopen
   the client later to see them).

## A2. Discord — create the OAuth app

The league runs on Discord, so this is often the friendlier option for members.

1. Go to <https://discord.com/developers/applications> and sign in.
2. **New Application** → name it `MTG Latvia League` → **Create**.
3. Open the **OAuth2** tab:
   - Copy the **Client ID**.
   - Click **Reset Secret** → confirm → copy the **Client Secret**.
4. Still in **OAuth2 → Redirects → Add Another** →
   `https://shtatdxrwmiyzzvrfaai.supabase.co/auth/v1/callback` → **Save Changes**.
   (Same callback URL as Google — Supabase routes every provider through it.)

That's it — no consent-screen publishing step and no verification. Supabase
requests the `identify email` scope, so you get name, avatar, and email.

## B. Supabase — enable providers + URLs

1. In the Supabase dashboard for project `shtatdxrwmiyzzvrfaai`, open
   **Authentication → Sign In / Providers** and enable whichever you set up:
   - **Google:** paste the Client ID/secret from step A7 → **Save**.
   - **Discord:** paste the Client ID/secret from step A2.3 → **Save**.
2. **Authentication → Providers → Email:** turn **off** "Allow new users to sign
   up" (or disable the Email provider) so the public anon key can't self-register
   or trigger auth emails. Google stays the only way in.
3. **Authentication → URL Configuration:**
   - **Site URL:** your GitHub Pages URL (e.g. `https://<user>.github.io/<repo>/`).
   - **Redirect URLs → Add URL:** the same Pages URL.
   - For local testing you may also add `http://localhost:8000`.

## C. Link your account to a player

The app never lets users link themselves — an admin does it once per person.

1. Deploy PR #25 (or run locally) and click **Sign in** once. This creates your
   row in **Authentication → Users**; copy your **User UID**.
2. **Table Editor → `profiles` → Insert row:**
   - `id` = your User UID from step C1.
   - `player_key` = the player's key (e.g. `alexey b`) — see the `players` table.
   - `created_at` = leave default.
3. Reload the site: the Account page shows the linked player and your Leaderboard
   row is highlighted light-blue.

---

### Notes
- The `profiles` migration is already applied (`profiles_table`).
- Redirect URI must match **exactly**, including `https://` and no trailing slash.
- If sign-in returns "provider is not enabled", re-check step B1 was saved.
- If it returns "redirect_uri_mismatch", the URI in A6 doesn't match the Supabase
  callback URL above — fix and save in Google Cloud.
