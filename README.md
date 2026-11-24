# Bombombini Gusini

Bombombini Gusini is a Windows desktop chat prototype built with Tauri and Rust. It uses the supplied Gusini artwork for the app icon and offers a Windows toast notification with an inline reply box.

## Run on Windows

Install the Rust MSVC toolchain, Microsoft C++ Build Tools, and WebView2, then run from the repository root:

```powershell
cargo run --manifest-path src-tauri/Cargo.toml
```

Use the bell button in the chat header to trigger a sample Windows notification. Replies submitted from the toast are delivered back to the open app and shown in the matching conversation. The settings dialog can disable notifications or motion effects. Use the refresh button to check the latest public GitHub release; a newer release opens its download page.

The app also includes an animated update-check dialog. Updates are checked against GitHub Releases and downloaded manually; automatic installation is not configured.

This is a local prototype without a messaging server. Sample conversations and replies are held in memory; messages are not delivered to other users.
