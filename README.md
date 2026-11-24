# Bombombini Gusini

Bombombini Gusini is a Windows desktop chat prototype built with Tauri and Rust. It uses the supplied Gusini artwork for the app icon and offers a Windows toast notification with an inline reply box.

## Run on Windows

Install the Rust MSVC toolchain, Microsoft C++ Build Tools, WebView2, and the Tauri CLI (`cargo install tauri-cli --version "^2.0" --locked`). Run the app from the repository root:

```powershell
cargo run --manifest-path src-tauri/Cargo.toml
```

Closing the main window hides the app in the Windows system tray; use the tray icon to reopen it or exit. The app starts with Windows by default and opens hidden, and this can be changed in Settings. To build the Windows setup `.exe`, run `Set-Location src-tauri` and then `cargo tauri build`; the NSIS target produces the installer.

Use the bell button in the chat header to trigger a sample Windows notification. Replies submitted from the toast are delivered back to the open app and shown in the matching conversation. The settings dialog can disable notifications, motion effects, or startup with Windows. Use the refresh button to check the latest public GitHub release; a newer release opens its download page.

The app also includes an animated update-check dialog. Updates are checked against GitHub Releases and downloaded manually; automatic installation is not configured.

This is a local prototype without a messaging server. Sample conversations and replies are held in memory; messages are not delivered to other users.
