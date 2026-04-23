use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

/// 打开新窗口
#[tauri::command]
pub async fn open_new_window(app: tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    let window_label = format!("main-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed));
    let builder = WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App("index.html".into()))
        .title("未命名")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .center();

    let window = builder.build().map_err(|e| e.to_string())?;

    // Windows 和 Linux 下禁用原生边框
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    window.set_decorations(false).map_err(|e| e.to_string())?;

    if let Some(file_path) = path {
        window
            .emit("open-file-in-new-window", file_path)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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
