use crate::events::emit_window_close_requested;
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSColor, NSWindow};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{State, TitleBarStyle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Default)]
pub struct PendingWindowOpenFiles(pub Mutex<HashMap<String, String>>);

impl PendingWindowOpenFiles {
    fn insert(&self, window_label: String, file_path: String) -> Result<(), String> {
        self.0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(window_label, file_path);
        Ok(())
    }

    fn take(&self, window_label: &str) -> Option<String> {
        self.0.lock().ok()?.remove(window_label)
    }
}

fn next_window_label() -> String {
    format!("main-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed))
}

pub fn attach_close_interceptor(window: &WebviewWindow) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            emit_window_close_requested(&window_clone);
        }
    });
}

fn parse_hex_color(color: &str) -> Option<(f64, f64, f64, f64)> {
    let hex = color.trim().trim_start_matches('#');
    match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some((
                f64::from(r) / 255.0,
                f64::from(g) / 255.0,
                f64::from(b) / 255.0,
                1.0,
            ))
        }
        8 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            let a = u8::from_str_radix(&hex[6..8], 16).ok()?;
            Some((
                f64::from(r) / 255.0,
                f64::from(g) / 255.0,
                f64::from(b) / 255.0,
                f64::from(a) / 255.0,
            ))
        }
        _ => None,
    }
}

#[cfg(target_os = "macos")]
pub fn apply_macos_window_background(window: &WebviewWindow, color: &str) -> Result<(), String> {
    let (red, green, blue, alpha) =
        parse_hex_color(color).ok_or_else(|| format!("invalid color: {}", color))?;
    unsafe {
        let ns_window: &NSWindow = &*window.ns_window().map_err(|e| e.to_string())?.cast();
        let background = NSColor::colorWithDeviceRed_green_blue_alpha(red, green, blue, alpha);
        ns_window.setBackgroundColor(Some(&background));
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn apply_macos_window_background(_window: &WebviewWindow, _color: &str) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn set_window_background_color(window: WebviewWindow, color: String) -> Result<(), String> {
    apply_macos_window_background(&window, &color)
}

/// 打开新窗口
#[tauri::command]
pub async fn open_new_window(
    app: tauri::AppHandle,
    pending_files: State<'_, PendingWindowOpenFiles>,
    path: Option<String>,
) -> Result<(), String> {
    let window_label = next_window_label();
    let builder =
        WebviewWindowBuilder::new(&app, &window_label, WebviewUrl::App("index.html".into()))
            .title("未命名")
            .inner_size(1200.0, 800.0)
            .min_inner_size(800.0, 600.0)
            .center();

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.decorations(false);

    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(TitleBarStyle::Transparent);

    let window = builder.build().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    apply_macos_window_background(&window, "#ffffff")?;

    attach_close_interceptor(&window);

    if let Some(file_path) = path {
        pending_files.insert(window_label, file_path)?;
    }
    Ok(())
}

#[tauri::command]
pub fn consume_pending_window_open_file(
    pending_files: State<'_, PendingWindowOpenFiles>,
    window: WebviewWindow,
) -> Option<String> {
    pending_files.take(window.label())
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
        app.opener()
            .reveal_item_in_dir(path)
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{next_window_label, parse_hex_color, PendingWindowOpenFiles};

    #[test]
    fn next_window_label_is_unique() {
        let first = next_window_label();
        let second = next_window_label();
        assert_ne!(first, second);
        assert!(first.starts_with("main-"));
        assert!(second.starts_with("main-"));
    }

    #[test]
    fn pending_window_open_files_are_consumed_once() {
        let pending = PendingWindowOpenFiles::default();
        pending
            .insert("main-9".to_string(), "/tmp/demo.md".to_string())
            .unwrap();

        assert_eq!(pending.take("main-9"), Some("/tmp/demo.md".to_string()));
        assert_eq!(pending.take("main-9"), None);
    }

    #[test]
    fn parses_hex_rgb_colors() {
        assert_eq!(parse_hex_color("#ffffff"), Some((1.0, 1.0, 1.0, 1.0)));
        assert_eq!(
            parse_hex_color("1e1e2e"),
            Some((30.0 / 255.0, 30.0 / 255.0, 46.0 / 255.0, 1.0))
        );
        assert_eq!(
            parse_hex_color("#11223344"),
            Some((17.0 / 255.0, 34.0 / 255.0, 51.0 / 255.0, 68.0 / 255.0))
        );
        assert_eq!(parse_hex_color("oops"), None);
    }
}
