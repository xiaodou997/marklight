mod commands;
mod menu;

use commands::*;
use notify::{Config, RecommendedWatcher, Watcher, EventKind};
use tauri::{Emitter, Manager};
use std::sync::Mutex;

#[derive(Default)]
struct StartupOpenFile(Mutex<Option<String>>);

#[tauri::command]
fn consume_startup_open_file(state: tauri::State<'_, StartupOpenFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

/// 前端就绪后调用此命令。Rust 收到通知后，将等待中的启动文件推送给该窗口。
#[tauri::command]
fn notify_frontend_ready(app: tauri::AppHandle, state: tauri::State<'_, StartupOpenFile>) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(path) = guard.take() {
            let _ = app.emit("open-startup-file", path);
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_cli::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(StartupOpenFile::default());

            // 处理命令行参数（文件关联打开）
            // macOS 通过 open-url 事件，Windows/Linux 通过命令行参数
            #[cfg(any(target_os = "windows", target_os = "linux", target_os = "macos"))]
            {
                use tauri_plugin_cli::CliExt;
                if let Ok(matches) = app.cli().matches() {
                    // matches.args 在 Tauri v2 中直接就是 HashMap<String, ArgData>
                    if let Some(file_arg) = matches.args.get("file") {
                        if let Some(file_path) = file_arg.value.as_str() {
                            if let Some(state) = app.try_state::<StartupOpenFile>() {
                                if let Ok(mut startup_file) = state.0.lock() {
                                    *startup_file = Some(file_path.to_string());
                                }
                            }
                        }
                    }
                }
            }

            // 设置文件监听器
            let (tx, rx) = std::sync::mpsc::channel();
            let watcher =
                RecommendedWatcher::new(tx, Config::default()).map_err(|e: notify::Error| e.to_string())?;

            // 在后台线程处理监听事件，携带变更路径和类型
            std::thread::spawn(move || {
                use std::time::{Instant, Duration};
                let mut last_emit = Instant::now() - Duration::from_secs(1);

                for res in rx {
                    match res {
                        Ok(event) => {
                            // 防抖：300ms 内不重复发送
                            let now = Instant::now();
                            if now.duration_since(last_emit) < Duration::from_millis(300) {
                                continue;
                            }
                            last_emit = now;

                            let kind = match event.kind {
                                EventKind::Create(_) => "create",
                                EventKind::Modify(_) => "modify",
                                EventKind::Remove(_) => "remove",
                                _ => "other",
                            };
                            let paths: Vec<String> = event.paths
                                .iter()
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            #[derive(Clone, serde::Serialize)]
                            struct FileChangePayload {
                                kind: String,
                                paths: Vec<String>,
                            }

                            let _ = handle.emit("file-changed", FileChangePayload {
                                kind: kind.to_string(),
                                paths,
                            });
                        }
                        Err(e) => println!("watch error: {:?}", e),
                    }
                }
            });

            // 将 watcher 存储在状态中，防止被销毁
            app.manage(std::sync::Mutex::new(watcher));

            menu::setup_menu(&app.handle()).map_err(|e| e.to_string())?;

            if let Some(main_window) = app.get_webview_window("main") {
                // Windows 和 Linux 下禁用原生边框以使用自定义标题栏
                #[cfg(any(target_os = "windows", target_os = "linux"))]
                main_window.set_decorations(false).map_err(|e| e.to_string())?;

                let window_clone = main_window.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.emit("window-close-requested", ());
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            save_file,
            list_directory,
            save_image,
            resolve_image_path,
            fetch_remote_image,
            open_new_window,
            print_document,
            rename_file,
            delete_file,
            create_file,
            create_folder,
            reveal_in_finder,
            get_file_modified_time,
            watch_directory,
            unwatch_directory,
            read_config,
            write_config,
            consume_startup_open_file,
            notify_frontend_ready
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // macOS "打开方式" 通过 OpenedURLs 事件传递文件路径
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                let mut paths: Vec<String> = Vec::new();
                for url in urls {
                    if let Ok(pb) = url.to_file_path() {
                        if let Some(s) = pb.to_str() {
                            paths.push(s.to_string());
                        }
                    }
                }

                if let Some(first_path) = paths.first().cloned() {
                    // 存入 StartupOpenFile 供前端启动时读取（应对窗口还未就绪的情况）
                    if let Some(state) = app_handle.try_state::<StartupOpenFile>() {
                        if let Ok(mut startup_file) = state.0.lock() {
                            if startup_file.is_none() {
                                *startup_file = Some(first_path);
                            }
                        }
                    }
                    // 同时广播给已就绪的窗口
                    let _ = app_handle.emit("tauri://open", paths);
                }
            }
        });
}
