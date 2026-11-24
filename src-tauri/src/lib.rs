use serde::Serialize;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

const APP_NAME: &str = "Bombombini Gusini";
const APP_USER_MODEL_ID: &str = "com.bombombini.gusini";
const REPLY_INPUT_ID: &str = "reply";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct NotificationReply {
    conversation_id: String,
    sender: String,
    text: String,
}

#[tauri::command]
fn show_message_notification(
    app: tauri::AppHandle,
    conversation_id: String,
    sender: String,
    message: String,
) -> Result<(), String> {
    if sender.trim().is_empty() || message.trim().is_empty() {
        return Err("Tên người gửi và nội dung tin nhắn không được để trống.".into());
    }

    #[cfg(windows)]
    {
        use winrt_toast_reborn::content::input::InputType;
        use winrt_toast_reborn::{Action, Input, Toast, ToastManager};

        let reply_app = app.clone();
        let reply_conversation = conversation_id.clone();
        let reply_sender = sender.clone();
        let manager = ToastManager::new(APP_USER_MODEL_ID).on_activated(
            Some(REPLY_INPUT_ID),
            move |action| {
                let Some(action) = action else {
                    return;
                };
                if action.arg != "send" {
                    return;
                }
                let Some(text) = action
                    .values
                    .get(REPLY_INPUT_ID)
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                else {
                    return;
                };

                let reply = NotificationReply {
                    conversation_id: reply_conversation.clone(),
                    sender: reply_sender.clone(),
                    text: text.to_owned(),
                };
                if let Err(error) = reply_app.emit("notification-reply", reply) {
                    eprintln!("Could not deliver notification reply to the app: {error}");
                }
            },
        );

        let mut toast = Toast::new();
        toast
            .text1(sender.clone())
            .text2(message.clone())
            .input(Input::new(REPLY_INPUT_ID, InputType::Text).with_title("Trả lời nhanh"))
            .action(Action::new("Gửi", "send", "").with_input_id(REPLY_INPUT_ID));

        manager.show(&toast).map_err(|error| error.to_string())
    }

    #[cfg(not(windows))]
    {
        let _ = (app, conversation_id);
        Err("Trả lời nhanh từ thông báo hiện chỉ hỗ trợ Windows.".into())
    }
}

#[tauri::command]
fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|error| error.to_string())
}

fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Không tìm thấy cửa sổ chính.".to_owned())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let show_item =
        MenuItem::with_id(app, "show", "Mở Bombombini Gusini", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Thoát", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Biểu tượng ứng dụng chưa được cấu hình.",
        )
    })?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip(APP_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Err(error) = show_main_window(app) {
                    eprintln!("Could not show the main window: {error}");
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Err(error) = show_main_window(tray.app_handle()) {
                    eprintln!("Could not show the main window: {error}");
                }
            }
        })
        .build(app)?;

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--background"])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            show_message_notification,
            is_autostart_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            #[cfg(windows)]
            {
                let executable = std::env::current_exe()?;
                winrt_toast_reborn::register(
                    APP_USER_MODEL_ID,
                    APP_NAME,
                    Some(executable.as_path()),
                )?;
            }

            setup_tray(app)?;
            let started_in_background = std::env::args().any(|arg| arg == "--background");
            if !started_in_background {
                show_main_window(&app.handle())
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window.hide() {
                    eprintln!("Could not hide the main window: {error}");
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Bombombini Gusini");
}
