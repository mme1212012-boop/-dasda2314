use serde::Serialize;
use tauri::Emitter;

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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![show_message_notification])
        .setup(|_| {
            #[cfg(windows)]
            {
                let executable = std::env::current_exe()?;
                winrt_toast_reborn::register(
                    APP_USER_MODEL_ID,
                    APP_NAME,
                    Some(executable.as_path()),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Bombombini Gusini");
}
