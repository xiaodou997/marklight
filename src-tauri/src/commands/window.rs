use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct PendingWindowOpenFiles(pub Mutex<HashMap<String, String>>);

fn next_window_label() -> String {
    format!("main-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed))
}

pub fn attach_close_interceptor(window: &WebviewWindow) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_clone.emit("window-close-requested", ());
        }
    });
}

/// 打开新窗口
#[tauri::command]
pub async fn open_new_window(
    app: tauri::AppHandle,
    pending_files: State<'_, PendingWindowOpenFiles>,
    path: Option<String>,
) -> Result<(), String> {
    let window_label = next_window_label();
    let builder = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App("index.html".into()))
        .title("未命名")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center();

    let window = builder.build().map_err(|e| e.to_string())?;

    // Windows 和 Linux 下禁用原生边框
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    window.set_decorations(false).map_err(|e| e.to_string())?;

    attach_close_interceptor(&window);

    if let Some(file_path) = path {
        pending_files
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(window_label, file_path);
    }
    Ok(())
}

#[tauri::command]
pub fn consume_pending_window_open_file(
    pending_files: State<'_, PendingWindowOpenFiles>,
    window: WebviewWindow,
) -> Option<String> {
    pending_files.0.lock().ok()?.remove(window.label())
}

/// 打印当前文档
#[tauri::command]
pub fn print_document(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// 在 Finder/资源管理器 中显示文件
#[tauri::command]
pub async fn reveal_in_finder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    #[cfg(target_os = "linux")]
    {
        use std::path::Path;
        let path_buf = Path::new(&path);
        let dir = if path_buf.is_dir() {
            path_buf
        } else {
            path_buf.parent().unwrap_or(Path::new("/"))
        };
        app.opener()
            .open_path(dir.to_string_lossy().to_string(), None::<String>)
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "linux"))]
    {
        app.opener().reveal_item_in_dir(path).map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::next_window_label;

    #[test]
    fn next_window_label_is_unique() {
        let first = next_window_label();
        let second = next_window_label();
        assert_ne!(first, second);
        assert!(first.starts_with("main-"));
        assert!(second.starts_with("main-"));
    }
}
