# Bombombini Gusini

Bombombini Gusini is an original Windows chat app built with Tauri, Rust, and Supabase. It supports one-to-one conversations, live message sync, file attachments, reactions, and quick replies from Windows notifications.

## Set up Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the project's SQL Editor. This creates the profile, conversation, message, reaction, and private attachment-storage tables with row-level security.
3. Start the app and enter the project's URL and public anon key. Never enter a service-role key in the app.
4. Create an account with an email, password, and username. If email confirmation is enabled in Supabase, verify the email before signing in. Search for another user's username with the **+** button to start a conversation.

### Automatically remove old attachments

The scheduled cleanup removes attachment files and their storage references after one month; message text remains. Deploy the cleanup function with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```powershell
supabase link --project-ref <project-ref>
supabase functions deploy cleanup-expired-attachments
```

In the Supabase Dashboard, enable Vault, `pg_cron`, and `pg_net`. In the SQL Editor, store your project URL and default Secret API key (`sb_secret_...`) in Vault:

```sql
select vault.create_secret('<project URL>', 'project_url');
select vault.create_secret('<default Secret API key>', 'secret_key');
```

Keep the key in Vault only; never add it to the app or repository. Then run `supabase/schedule_cleanup.sql` in the SQL Editor. The job runs daily at 03:00 UTC and retries failed deletions.

The app stores the project URL and public anon key on the local device. Each message and file is sent directly to Supabase using the signed-in user's session and database policies.

## Run and build on Windows

Install Node.js 22, the Rust MSVC toolchain, Microsoft C++ Build Tools, WebView2, and the Tauri CLI:

```powershell
Set-Location frontend
npm install
Set-Location ..
cargo install tauri-cli --version "^2.0" --locked
```

From the repository root, run the app:

```powershell
Set-Location src-tauri
cargo tauri dev
```

Build the Windows setup `.exe` from the same directory with `cargo tauri build`. The NSIS installer is written to `target\release\bundle\nsis\`.

Closing the main window hides the app in the system tray; use the tray icon to reopen or exit. Startup with Windows is enabled by default and can be changed in Settings. Quick replies work while the app is running, including when hidden in the tray; they are not delivered after the app has been fully exited.

Updates are checked against GitHub Releases and downloaded manually; automatic installation is not configured.
