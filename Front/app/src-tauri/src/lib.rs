use tauri::Manager;
use std::sync::Mutex;

const NEXT_PORT: u16 = 3000;

struct NextServer(Mutex<Option<std::process::Child>>);

#[tauri::command]
fn show_notification(app: tauri::AppHandle, title: String, body: String) {
    use tauri_plugin_notification::NotificationExt;
    let _ = app.notification().builder().title(title).body(body).show();
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .manage(NextServer(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![show_notification])
        .setup(|app| {
            #[cfg(not(debug_assertions))]
            {
                let window = app.get_webview_window("main").unwrap();
                if let Ok(url) = std::env::var("TAURI_FRONTEND_URL") {
                    window.navigate(url.parse()?)?;
                } else {
                    launch_sidecar(app)?;
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}

#[cfg(not(debug_assertions))]
fn launch_sidecar(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app.get_webview_window("main").unwrap();
    window.hide()?;

    let server_js = app
        .path()
        .resource_dir()?
        .join("standalone")
        .join("server.js");

    let child = std::process::Command::new("node")
        .arg(&server_js)
        .env("PORT", NEXT_PORT.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .spawn()?;

    *app.state::<NextServer>().0.lock().unwrap() = Some(child);

    // Kill the server when the window is closed
    let app_handle = app.handle().clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            if let Some(mut child) = app_handle.state::<NextServer>().0.lock().unwrap().take() {
                child.kill().ok();
            }
        }
    });

    // Wait for the server in a background thread, then show the window
    let app_handle = app.handle().clone();
    std::thread::spawn(move || {
        for _ in 0..60 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if std::net::TcpStream::connect(("127.0.0.1", NEXT_PORT)).is_ok() {
                break;
            }
        }
        if let Some(win) = app_handle.get_webview_window("main") {
            let url = format!("http://127.0.0.1:{NEXT_PORT}");
            let _ = win.navigate(url.parse().unwrap());
            let _ = win.show();
            let _ = win.set_focus();
        }
    });

    Ok(())
}
